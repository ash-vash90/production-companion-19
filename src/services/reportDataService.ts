/**
 * Report Data Service
 *
 * Centralized data fetching for production reports.
 * Eliminates duplicated fetch logic across components.
 */

import { supabase } from '@/integrations/supabase/client';
import type {
  ProductionReportData,
  WorkOrderSummary,
  ProductionItem,
  StepExecution,
  BatchMaterial,
  OperatorSummary,
  QualityCertificate,
  ChecklistResponse,
  ActivityLogEntry,
  TimelineEvent,
} from '@/types/reports';

// ============================================================================
// Profile Cache
// ============================================================================

interface ProfileInfo {
  full_name: string;
  avatar_url: string | null;
}

async function fetchProfiles(userIds: Set<string>): Promise<Record<string, ProfileInfo>> {
  if (userIds.size === 0) return {};

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, full_name, avatar_url')
    .in('id', Array.from(userIds));

  const map: Record<string, ProfileInfo> = {};
  for (const p of profiles || []) {
    map[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
  }
  return map;
}

// ============================================================================
// Main Fetch Function
// ============================================================================

export async function fetchProductionReportData(
  workOrderId: string,
  language: 'en' | 'nl' = 'en'
): Promise<ProductionReportData> {
  // 1. Fetch work order
  const { data: wo, error: woError } = await supabase
    .from('work_orders')
    .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, start_date, shipping_date, customer_name')
    .eq('id', workOrderId)
    .single();

  if (woError) throw woError;

  // 2. Fetch items
  const { data: rawItems, error: itemsError } = await supabase
    .from('work_order_items')
    .select('id, serial_number, status, completed_at, label_printed, label_printed_at, label_printed_by')
    .eq('work_order_id', workOrderId)
    .order('position_in_batch', { ascending: true });

  if (itemsError) throw itemsError;

  const itemIds = rawItems?.map(i => i.id) || [];

  // 3. Fetch related data in parallel
  const [executionsResult, materialsResult, certificatesResult, activityResult] = await Promise.all([
    itemIds.length > 0
      ? supabase
          .from('step_executions')
          .select(`id, status, completed_at, measurement_values, validation_status, operator_initials, executed_by, work_order_item_id, production_step:production_steps(step_number, title_en, title_nl)`)
          .in('work_order_item_id', itemIds)
          .eq('status', 'completed')
          .order('completed_at', { ascending: true })
      : { data: [] },

    itemIds.length > 0
      ? supabase
          .from('batch_materials')
          .select('material_type, batch_number, scanned_at, work_order_item_id')
          .in('work_order_item_id', itemIds)
          .order('scanned_at', { ascending: true })
      : { data: [] },

    itemIds.length > 0
      ? supabase
          .from('quality_certificates')
          .select('id, work_order_item_id, generated_at, generated_by, pdf_url')
          .in('work_order_item_id', itemIds)
      : { data: [] },

    supabase
      .from('activity_logs')
      .select('id, action, created_at, user_id, details')
      .eq('entity_type', 'work_order')
      .eq('entity_id', workOrderId)
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  // 4. Fetch checklist responses (optimized - single query)
  const stepExecutionIds = (executionsResult.data || []).map(e => e.id);
  const checklistResult = stepExecutionIds.length > 0
    ? await supabase
        .from('checklist_responses')
        .select(`id, checked, checked_at, checked_by, step_execution_id, checklist_item:checklist_items(item_text_en, item_text_nl)`)
        .in('step_execution_id', stepExecutionIds)
    : { data: [] };

  // 5. Collect all user IDs and fetch profiles
  const userIds = new Set<string>();
  (executionsResult.data || []).forEach(e => e.executed_by && userIds.add(e.executed_by));
  (certificatesResult.data || []).forEach(c => c.generated_by && userIds.add(c.generated_by));
  (checklistResult.data || []).forEach(c => c.checked_by && userIds.add(c.checked_by));
  (activityResult.data || []).forEach(a => a.user_id && userIds.add(a.user_id));
  (rawItems || []).forEach(i => i.label_printed_by && userIds.add(i.label_printed_by));

  const profilesMap = await fetchProfiles(userIds);

  // 6. Build lookup maps
  const itemSerialMap: Record<string, string> = {};
  for (const item of rawItems || []) {
    itemSerialMap[item.id] = item.serial_number;
  }

  const stepExecToItem: Record<string, string> = {};
  for (const e of executionsResult.data || []) {
    stepExecToItem[e.id] = e.work_order_item_id;
  }

  // 7. Transform data
  const workOrder: WorkOrderSummary = wo;

  const items: ProductionItem[] = (rawItems || []).map(item => ({
    id: item.id,
    serial_number: item.serial_number,
    status: item.status,
    completed_at: item.completed_at,
    label_printed: item.label_printed,
    label_printed_at: item.label_printed_at,
    label_printed_by: item.label_printed_by,
    label_printed_by_name: item.label_printed_by ? profilesMap[item.label_printed_by]?.full_name : undefined,
  }));

  const stepExecutions: StepExecution[] = (executionsResult.data || []).map(e => {
    const step = e.production_step as { step_number?: number; title_en?: string; title_nl?: string } | null;
    const operator = e.executed_by ? profilesMap[e.executed_by] : null;
    const measurementVals =
      typeof e.measurement_values === 'object' && e.measurement_values !== null && !Array.isArray(e.measurement_values)
        ? (e.measurement_values as Record<string, unknown>)
        : {};

    return {
      id: e.id,
      step_number: step?.step_number || 0,
      step_title: language === 'nl' ? step?.title_nl || step?.title_en || 'Unknown' : step?.title_en || 'Unknown',
      status: e.status,
      operator_name: operator?.full_name || 'Unknown',
      operator_avatar: operator?.avatar_url || null,
      operator_initials: e.operator_initials || null,
      completed_at: e.completed_at,
      measurement_values: measurementVals,
      validation_status: e.validation_status,
      serial_number: itemSerialMap[e.work_order_item_id] || 'Unknown',
    };
  });

  const batchMaterials: BatchMaterial[] = (materialsResult.data || []).map(m => ({
    material_type: m.material_type,
    batch_number: m.batch_number,
    serial_number: itemSerialMap[m.work_order_item_id] || 'Unknown',
    scanned_at: m.scanned_at,
  }));

  const certificates: QualityCertificate[] = (certificatesResult.data || []).map(c => ({
    id: c.id,
    serial_number: itemSerialMap[c.work_order_item_id] || 'Unknown',
    generated_at: c.generated_at,
    generated_by_name: c.generated_by ? profilesMap[c.generated_by]?.full_name || null : null,
    pdf_url: c.pdf_url,
  }));

  const checklistResponses: ChecklistResponse[] = (checklistResult.data || []).map(c => {
    const item = c.checklist_item as { item_text_en?: string; item_text_nl?: string } | null;
    return {
      id: c.id,
      serial_number: itemSerialMap[stepExecToItem[c.step_execution_id]] || 'Unknown',
      item_text: language === 'nl' ? item?.item_text_nl || item?.item_text_en || 'Unknown' : item?.item_text_en || 'Unknown',
      checked: c.checked,
      checked_at: c.checked_at,
      checked_by_name: c.checked_by ? profilesMap[c.checked_by]?.full_name || null : null,
    };
  });

  const activityLog: ActivityLogEntry[] = (activityResult.data || []).map(a => ({
    id: a.id,
    action: a.action,
    created_at: a.created_at,
    user_name: a.user_id ? profilesMap[a.user_id]?.full_name || null : null,
    details: a.details as Record<string, unknown> | null,
  }));

  // 8. Calculate operator statistics
  const operatorStats: Record<string, OperatorSummary> = {};
  for (const exec of stepExecutions) {
    const key = exec.operator_name;
    if (!operatorStats[key]) {
      operatorStats[key] = {
        id: key,
        full_name: exec.operator_name,
        avatar_url: exec.operator_avatar,
        steps_completed: 0,
      };
    }
    operatorStats[key].steps_completed++;
  }
  const operators = Object.values(operatorStats).sort((a, b) => b.steps_completed - a.steps_completed);

  return {
    workOrder,
    items,
    stepExecutions,
    batchMaterials,
    operators,
    certificates,
    checklistResponses,
    activityLog,
  };
}

// ============================================================================
// Build Timeline Events (For Story View)
// ============================================================================

export function buildTimelineEvents(data: ProductionReportData): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  // Work order created
  events.push({
    id: `created-${data.workOrder.id}`,
    type: 'created',
    timestamp: data.workOrder.created_at,
    title: 'Work order created',
    description: `${data.workOrder.wo_number} - ${data.workOrder.batch_size} units`,
  });

  // Work order started
  if (data.workOrder.start_date) {
    events.push({
      id: `started-${data.workOrder.id}`,
      type: 'started',
      timestamp: data.workOrder.start_date,
      title: 'Production started',
    });
  }

  // Step completions
  for (const step of data.stepExecutions) {
    if (step.completed_at) {
      events.push({
        id: `step-${step.id}`,
        type: 'step_completed',
        timestamp: step.completed_at,
        title: `Step ${step.step_number}: ${step.step_title}`,
        actor: step.operator_name,
        actorAvatar: step.operator_avatar,
        serialNumber: step.serial_number,
        metadata: {
          validation_status: step.validation_status,
          measurement_values: step.measurement_values,
        },
      });
    }
  }

  // Material scans
  for (const material of data.batchMaterials) {
    events.push({
      id: `material-${material.batch_number}-${material.serial_number}`,
      type: 'material_scanned',
      timestamp: material.scanned_at,
      title: `${material.material_type} scanned`,
      description: `Batch: ${material.batch_number}`,
      serialNumber: material.serial_number,
    });
  }

  // Certificates
  for (const cert of data.certificates) {
    if (cert.generated_at) {
      events.push({
        id: `cert-${cert.id}`,
        type: 'certificate_generated',
        timestamp: cert.generated_at,
        title: 'Quality certificate generated',
        actor: cert.generated_by_name || undefined,
        serialNumber: cert.serial_number,
      });
    }
  }

  // Labels printed
  for (const item of data.items) {
    if (item.label_printed && item.label_printed_at) {
      events.push({
        id: `label-${item.id}`,
        type: 'label_printed',
        timestamp: item.label_printed_at,
        title: 'Label printed',
        actor: item.label_printed_by_name,
        serialNumber: item.serial_number,
      });
    }
  }

  // Work order completed
  if (data.workOrder.completed_at) {
    events.push({
      id: `completed-${data.workOrder.id}`,
      type: 'completed',
      timestamp: data.workOrder.completed_at,
      title: 'Production completed',
      description: `${data.items.filter(i => i.status === 'completed').length} items completed`,
    });
  }

  // Shipped
  if (data.workOrder.shipping_date && data.workOrder.status === 'completed') {
    events.push({
      id: `shipped-${data.workOrder.id}`,
      type: 'shipped',
      timestamp: data.workOrder.shipping_date,
      title: 'Order shipped',
    });
  }

  // Sort by timestamp
  events.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  return events;
}

// ============================================================================
// React Hook
// ============================================================================

import { useState, useCallback } from 'react';

export function useProductionReportDetail() {
  const [data, setData] = useState<ProductionReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReport = useCallback(async (workOrderId: string, language: 'en' | 'nl' = 'en') => {
    setLoading(true);
    setError(null);
    try {
      const reportData = await fetchProductionReportData(workOrderId, language);
      setData(reportData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch report'));
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const clear = useCallback(() => {
    setData(null);
    setError(null);
  }, []);

  return { data, loading, error, fetchReport, clear };
}
