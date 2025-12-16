/**
 * Production Reports Types
 *
 * Centralized type definitions for production report entities.
 * Each entity represents a distinct aspect of the production story.
 */

// ============================================================================
// Core Work Order Entity
// ============================================================================

export interface WorkOrderSummary {
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
}

// ============================================================================
// Production Items Entity
// ============================================================================

export interface ProductionItem {
  id: string;
  serial_number: string;
  status: string;
  completed_at: string | null;
  label_printed: boolean;
  label_printed_at: string | null;
  label_printed_by: string | null;
  label_printed_by_name?: string;
}

// ============================================================================
// Step Execution Entity
// ============================================================================

export interface StepExecution {
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
}

// ============================================================================
// Batch Materials Entity
// ============================================================================

export interface BatchMaterial {
  material_type: string;
  batch_number: string;
  serial_number: string;
  scanned_at: string;
}

// ============================================================================
// Operator Entity
// ============================================================================

export interface OperatorSummary {
  id: string;
  full_name: string;
  avatar_url: string | null;
  steps_completed: number;
}

// ============================================================================
// Quality Certificate Entity
// ============================================================================

export interface QualityCertificate {
  id: string;
  serial_number: string;
  generated_at: string | null;
  generated_by_name: string | null;
  pdf_url: string | null;
}

// ============================================================================
// Checklist Response Entity
// ============================================================================

export interface ChecklistResponse {
  id: string;
  serial_number: string;
  item_text: string;
  checked: boolean;
  checked_at: string | null;
  checked_by_name: string | null;
}

// ============================================================================
// Activity Log Entity
// ============================================================================

export interface ActivityLogEntry {
  id: string;
  action: string;
  created_at: string;
  user_name: string | null;
  details: Record<string, unknown> | null;
}

// ============================================================================
// Composite Report Data (All Entities Combined)
// ============================================================================

export interface ProductionReportData {
  workOrder: WorkOrderSummary;
  items: ProductionItem[];
  stepExecutions: StepExecution[];
  batchMaterials: BatchMaterial[];
  operators: OperatorSummary[];
  certificates: QualityCertificate[];
  checklistResponses: ChecklistResponse[];
  activityLog: ActivityLogEntry[];
}

// ============================================================================
// Report Statistics (Derived)
// ============================================================================

export interface ProductionStats {
  totalItems: number;
  completedItems: number;
  passedValidations: number;
  failedValidations: number;
  certificatesIssued: number;
  labelsPrinted: number;
  totalSteps: number;
  uniqueOperators: number;
}

export function calculateStats(data: ProductionReportData): ProductionStats {
  const completedItems = data.items.filter(i => i.status === 'completed').length;
  const passedValidations = data.stepExecutions.filter(s => s.validation_status === 'passed').length;
  const failedValidations = data.stepExecutions.filter(s => s.validation_status === 'failed').length;
  const certificatesIssued = data.certificates.filter(c => c.pdf_url).length;
  const labelsPrinted = data.items.filter(i => i.label_printed).length;

  return {
    totalItems: data.items.length,
    completedItems,
    passedValidations,
    failedValidations,
    certificatesIssued,
    labelsPrinted,
    totalSteps: data.stepExecutions.length,
    uniqueOperators: data.operators.length,
  };
}

// ============================================================================
// Timeline Event (For Story View)
// ============================================================================

export type TimelineEventType =
  | 'created'
  | 'started'
  | 'step_completed'
  | 'material_scanned'
  | 'certificate_generated'
  | 'label_printed'
  | 'completed'
  | 'shipped';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  timestamp: string;
  title: string;
  description?: string;
  actor?: string;
  actorAvatar?: string | null;
  serialNumber?: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Filter State
// ============================================================================

export interface ReportFilterState {
  searchTerm: string;
  statusFilter: string;
  productFilter: string;
  customerFilter: string;
  ageFilter: string;
  createdMonthFilter: string;
  batchSizeFilter: string;
}

// ============================================================================
// Export Configuration
// ============================================================================

export interface ExportSections {
  overview: boolean;
  statistics: boolean;
  steps: boolean;
  materials: boolean;
  certificates: boolean;
  labels: boolean;
  checklists: boolean;
  operators: boolean;
  activity: boolean;
}

export const DEFAULT_EXPORT_SECTIONS: ExportSections = {
  overview: true,
  statistics: true,
  steps: true,
  materials: true,
  certificates: true,
  labels: true,
  checklists: true,
  operators: true,
  activity: false,
};

// ============================================================================
// Report List Item (For Master List View)
// ============================================================================

export interface ProductionReportListItem {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  shipping_date: string | null;
  customer_name: string | null;
  productBreakdown?: Array<{
    type: string;
    count: number;
    serials: string[];
  }>;
  isMainAssembly?: boolean;
  hasSubassemblies?: boolean;
}
