import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { ReportDetailContent } from '@/components/reports/ReportDetailContent';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Package } from 'lucide-react';
import { getProductBreakdown } from '@/lib/utils';
import { generateProductionReportPdf, ExportSections } from '@/services/reportPdfService';
interface ReportData {
  workOrder: {
    id: string;
    wo_number: string;
    product_type: string;
    batch_size: number;
    status: string;
    created_at: string;
    completed_at: string | null;
    start_date: string | null;
    shipping_date: string | null;
    customer_name: string | null;
  };
  items: Array<{
    id: string;
    serial_number: string;
    status: string;
    completed_at: string | null;
    label_printed: boolean;
    label_printed_at: string | null;
    label_printed_by: string | null;
    label_printed_by_name?: string;
  }>;
  stepExecutions: Array<{
    id: string;
    step_number: number;
    step_title: string;
    status: string;
    operator_name: string;
    operator_avatar: string | null;
    operator_initials: string | null;
    completed_at: string | null;
    measurement_values: Record<string, unknown>;
    validation_status: string | null;
    serial_number: string;
  }>;
  batchMaterials: Array<{
    material_type: string;
    batch_number: string;
    serial_number: string;
    scanned_at: string;
  }>;
  operators: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    steps_completed: number;
  }>;
  certificates: Array<{
    id: string;
    serial_number: string;
    generated_at: string | null;
    generated_by_name: string | null;
    pdf_url: string | null;
  }>;
  checklistResponses: Array<{
    id: string;
    serial_number: string;
    item_text: string;
    checked: boolean;
    checked_at: string | null;
    checked_by_name: string | null;
  }>;
  activityLog: Array<{
    id: string;
    action: string;
    created_at: string;
    user_name: string | null;
    details: any;
  }>;
}

const ProductionReportDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [data, setData] = useState<ReportData | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (id) {
      fetchReportData();
    }
  }, [user, id, navigate]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, start_date, shipping_date, customer_name')
        .eq('id', id)
        .single();

      if (woError) throw woError;

      const { data: items, error: itemsError } = await supabase
        .from('work_order_items')
        .select('id, serial_number, status, completed_at, label_printed, label_printed_at, label_printed_by')
        .eq('work_order_id', id)
        .order('position_in_batch', { ascending: true });

      if (itemsError) throw itemsError;

      const itemIds = items?.map(i => i.id) || [];

      const [executionsResult, materialsResult, certificatesResult, checklistResult, activityResult] = await Promise.all([
        itemIds.length > 0 ? supabase
          .from('step_executions')
          .select(`id, status, completed_at, measurement_values, validation_status, operator_initials, executed_by, work_order_item_id, production_step:production_steps(step_number, title_en, title_nl)`)
          .in('work_order_item_id', itemIds)
          .eq('status', 'completed')
          .order('completed_at', { ascending: true }) : { data: [] },
        
        itemIds.length > 0 ? supabase
          .from('batch_materials')
          .select('material_type, batch_number, scanned_at, work_order_item_id')
          .in('work_order_item_id', itemIds)
          .order('scanned_at', { ascending: true }) : { data: [] },
        
        itemIds.length > 0 ? supabase
          .from('quality_certificates')
          .select('id, work_order_item_id, generated_at, generated_by, pdf_url')
          .in('work_order_item_id', itemIds) : { data: [] },
        
        itemIds.length > 0 ? supabase
          .from('checklist_responses')
          .select(`id, checked, checked_at, checked_by, step_execution_id, checklist_item:checklist_items(item_text_en, item_text_nl)`)
          .in('step_execution_id', (await supabase.from('step_executions').select('id').in('work_order_item_id', itemIds)).data?.map(e => e.id) || []) : { data: [] },
        
        supabase
          .from('activity_logs')
          .select('id, action, created_at, user_id, details')
          .eq('entity_type', 'work_order')
          .eq('entity_id', id)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      const userIds = new Set<string>();
      (executionsResult.data || []).forEach(e => e.executed_by && userIds.add(e.executed_by));
      (certificatesResult.data || []).forEach(c => c.generated_by && userIds.add(c.generated_by));
      (checklistResult.data || []).forEach(c => c.checked_by && userIds.add(c.checked_by));
      (activityResult.data || []).forEach(a => a.user_id && userIds.add(a.user_id));
      (items || []).forEach(i => i.label_printed_by && userIds.add(i.label_printed_by));

      let profilesMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', Array.from(userIds));
        for (const p of profiles || []) {
          profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        }
      }

      const itemSerialMap: Record<string, string> = {};
      for (const item of items || []) {
        itemSerialMap[item.id] = item.serial_number;
      }

      const stepExecutions = (executionsResult.data || []).map(e => {
        const step = e.production_step as any;
        const operator = e.executed_by ? profilesMap[e.executed_by] : null;
        const measurementVals = typeof e.measurement_values === 'object' && e.measurement_values !== null && !Array.isArray(e.measurement_values) ? e.measurement_values as Record<string, unknown> : {};
        return {
          id: e.id,
          step_number: step?.step_number || 0,
          step_title: language === 'nl' ? step?.title_nl : step?.title_en || 'Unknown',
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

      const batchMaterials = (materialsResult.data || []).map(m => ({
        material_type: m.material_type,
        batch_number: m.batch_number,
        serial_number: itemSerialMap[m.work_order_item_id] || 'Unknown',
        scanned_at: m.scanned_at,
      }));

      const certificates = (certificatesResult.data || []).map(c => ({
        id: c.id,
        serial_number: itemSerialMap[c.work_order_item_id] || 'Unknown',
        generated_at: c.generated_at,
        generated_by_name: c.generated_by ? profilesMap[c.generated_by]?.full_name || null : null,
        pdf_url: c.pdf_url,
      }));

      const stepExecToItem: Record<string, string> = {};
      for (const e of executionsResult.data || []) {
        stepExecToItem[e.id] = e.work_order_item_id;
      }

      const checklistResponses = (checklistResult.data || []).map(c => {
        const item = c.checklist_item as any;
        return {
          id: c.id,
          serial_number: itemSerialMap[stepExecToItem[c.step_execution_id]] || 'Unknown',
          item_text: language === 'nl' ? item?.item_text_nl : item?.item_text_en || 'Unknown',
          checked: c.checked,
          checked_at: c.checked_at,
          checked_by_name: c.checked_by ? profilesMap[c.checked_by]?.full_name || null : null,
        };
      });

      const activityLog = (activityResult.data || []).map(a => ({
        id: a.id,
        action: a.action,
        created_at: a.created_at,
        user_name: a.user_id ? profilesMap[a.user_id]?.full_name || null : null,
        details: a.details,
      }));

      const operatorStats: Record<string, { id: string; full_name: string; avatar_url: string | null; steps_completed: number }> = {};
      for (const exec of stepExecutions) {
        const key = exec.operator_name;
        if (!operatorStats[key]) {
          operatorStats[key] = { id: key, full_name: exec.operator_name, avatar_url: exec.operator_avatar, steps_completed: 0 };
        }
        operatorStats[key].steps_completed++;
      }

      const itemsWithNames = (items || []).map(item => ({
        ...item,
        label_printed_by_name: item.label_printed_by ? profilesMap[item.label_printed_by]?.full_name : undefined,
      }));

      setData({
        workOrder: wo,
        items: itemsWithNames,
        stepExecutions,
        batchMaterials,
        operators: Object.values(operatorStats).sort((a, b) => b.steps_completed - a.steps_completed),
        certificates,
        checklistResponses,
        activityLog,
      });
    } catch (error: any) {
      console.error('Error fetching report:', error);
      toast.error(t('error'), { description: error.message || 'Failed to load report' });
    } finally {
      setLoading(false);
    }
  };

  const handleExportPdf = async (sections: ExportSections) => {
    if (!data) return;
    setExporting(true);
    try {
      await generateProductionReportPdf(data, { language: language as 'en' | 'nl', sections });
      toast.success(t('pdfExported'));
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(t('error'), { description: error.message || 'Failed to export PDF' });
    } finally {
      setExporting(false);
    }
  };

  if (!user) return null;

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!data) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('workOrderNotFound')}</h3>
            <Button onClick={() => navigate('/production-reports')}>
              {t('backToWorkOrders')}
            </Button>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const productBreakdown = getProductBreakdown(data.items.map(i => ({ serial_number: i.serial_number })));

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-4">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => navigate('/production-reports')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('backToReports')}
          </Button>

          {/* Report Header */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{data.workOrder.wo_number}</h1>
              <p className="text-muted-foreground mt-1">
                {data.workOrder.customer_name && <span>{data.workOrder.customer_name} • </span>}
                {t('productionReport')}
              </p>
              <div className="mt-2">
                <ProductBreakdownBadges breakdown={productBreakdown} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <WorkOrderStatusBadge status={data.workOrder.status} />
            </div>
          </div>

          {/* Main Content - no card wrapper on mobile */}
          <ReportDetailContent 
            data={data} 
            onExportPdf={handleExportPdf}
            exporting={exporting}
          />
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReportDetail;
