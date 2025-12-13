import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { StepTimeline } from '@/components/reports/StepTimeline';
import { ExportReportDialog, ExportSections } from '@/components/reports/ExportReportDialog';
import { 
  Package, ClipboardList, Users, CheckCircle2, XCircle, 
  FileText, Tag, History, FileDown, Printer, CheckSquare, Calendar,
  ChevronDown, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { formatDate, getProductBreakdown, cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

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

type SectionId = 'overview' | 'steps' | 'materials' | 'certificates' | 'labels' | 'checklists' | 'operators' | 'activity';

interface ReportDetailContentProps {
  data: ReportData;
  onExportPdf?: (sections: ExportSections) => void;
  exporting?: boolean;
  compact?: boolean;
}

export function ReportDetailContent({ data, onExportPdf, exporting = false, compact = false }: ReportDetailContentProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'nl' ? nl : enUS;
  const isMobile = useIsMobile();
  
  // For mobile: accordion state; for desktop: active section
  const [activeSection, setActiveSection] = useState<SectionId>('overview');
  const [openSections, setOpenSections] = useState<Set<SectionId>>(new Set(['overview', 'steps']));
  const [showExportDialog, setShowExportDialog] = useState(false);

  const completedItems = data.items.filter(i => i.status === 'completed').length;
  const passedValidations = data.stepExecutions.filter(e => e.validation_status === 'passed').length;
  const failedValidations = data.stepExecutions.filter(e => e.validation_status === 'failed').length;
  const labelsPrinted = data.items.filter(i => i.label_printed).length;
  const productBreakdown = getProductBreakdown(data.items.map(i => ({ serial_number: i.serial_number })));

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getSectionCount = (id: SectionId): number => {
    switch (id) {
      case 'steps': return data.stepExecutions.length;
      case 'materials': return data.batchMaterials.length;
      case 'certificates': return data.certificates.length;
      case 'labels': return labelsPrinted;
      case 'checklists': return data.checklistResponses.length;
      case 'operators': return data.operators.length;
      case 'activity': return data.activityLog.length;
      default: return 0;
    }
  };

  const toggleAccordion = (id: SectionId) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const sections: { id: SectionId; icon: React.ElementType; labelKey: string }[] = [
    { id: 'overview', icon: Package, labelKey: 'overview' },
    { id: 'steps', icon: ClipboardList, labelKey: 'productionSteps' },
    { id: 'materials', icon: Package, labelKey: 'batchMaterials' },
    { id: 'certificates', icon: FileText, labelKey: 'certificates' },
    { id: 'labels', icon: Tag, labelKey: 'labels' },
    { id: 'checklists', icon: CheckSquare, labelKey: 'checklists' },
    { id: 'operators', icon: Users, labelKey: 'operators' },
    { id: 'activity', icon: History, labelKey: 'activity' },
  ];

  const handleExportClick = () => {
    setShowExportDialog(true);
  };

  const handleExport = (selectedSections: ExportSections) => {
    onExportPdf?.(selectedSections);
    setShowExportDialog(false);
  };

  // Content renderers
  const renderOverview = () => (
    <div className="space-y-4">
      {/* Stats - inline on mobile */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <div className="flex items-center gap-1.5">
          <Package className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t('items')}:</span>
          <span className="font-semibold">{completedItems}/{data.items.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-success" />
          <span className="text-muted-foreground">{t('passed')}:</span>
          <span className="font-semibold text-success">{passedValidations}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-destructive" />
          <span className="text-muted-foreground">{t('failed')}:</span>
          <span className="font-semibold text-destructive">{failedValidations}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t('certificates')}:</span>
          <span className="font-semibold">{data.certificates.length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Tag className="h-4 w-4 text-muted-foreground" />
          <span className="text-muted-foreground">{t('labels')}:</span>
          <span className="font-semibold">{labelsPrinted}</span>
        </div>
      </div>

      {/* Key Dates - horizontal flow */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
        <div>
          <span className="text-muted-foreground">{t('created')}: </span>
          <span className="font-medium">{formatDate(data.workOrder.created_at)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('startDate')}: </span>
          <span className="font-medium">{data.workOrder.start_date ? formatDate(data.workOrder.start_date) : <span className="italic text-muted-foreground">{t('notSet')}</span>}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('shippingDate')}: </span>
          <span className="font-medium">{data.workOrder.shipping_date ? formatDate(data.workOrder.shipping_date) : <span className="italic text-muted-foreground">{t('notSet')}</span>}</span>
        </div>
        <div>
          <span className="text-muted-foreground">{t('completed')}: </span>
          <span className="font-medium">{data.workOrder.completed_at ? formatDate(data.workOrder.completed_at) : <span className="italic text-muted-foreground">{t('notSet')}</span>}</span>
        </div>
      </div>

      {/* Team Preview */}
      {data.operators.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap text-sm">
          <span className="text-muted-foreground">{t('teamInvolved')}:</span>
          <div className="flex -space-x-1">
            {data.operators.slice(0, 5).map((op) => (
              <Avatar key={op.id} className="h-6 w-6 border-2 border-background">
                <AvatarImage src={op.avatar_url || undefined} />
                <AvatarFallback className="text-[10px]">{getInitials(op.full_name)}</AvatarFallback>
              </Avatar>
            ))}
            {data.operators.length > 5 && (
              <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium">
                +{data.operators.length - 5}
              </div>
            )}
          </div>
          <span className="text-muted-foreground">
            {data.operators.map(o => o.full_name.split(' ')[0]).slice(0, 3).join(', ')}
            {data.operators.length > 3 && ` +${data.operators.length - 3}`}
          </span>
        </div>
      )}
    </div>
  );

  const renderMaterials = () => data.batchMaterials.length === 0 ? (
    <EmptyState icon={Package} message={t('noMaterialsScanned')} />
  ) : (
    <div className="space-y-1">
      {data.batchMaterials.map((mat, index) => (
        <div key={index} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0 text-sm">
            <Badge variant="outline" className="font-mono text-xs">{mat.serial_number}</Badge>
            <span className="text-muted-foreground">{mat.material_type}</span>
            <span className="font-mono font-medium">{mat.batch_number}</span>
          </div>
          <span className="text-xs text-muted-foreground ml-2 flex-shrink-0">
            {format(new Date(mat.scanned_at), 'MMM d, HH:mm', { locale: dateLocale })}
          </span>
        </div>
      ))}
    </div>
  );

  const renderCertificates = () => data.certificates.length === 0 ? (
    <EmptyState icon={FileText} message={t('noCertificatesGenerated')} />
  ) : (
    <div className="space-y-1">
      {data.certificates.map((cert) => (
        <div key={cert.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <FileText className="h-4 w-4 text-primary flex-shrink-0" />
            <Badge variant="outline" className="font-mono text-xs">{cert.serial_number}</Badge>
            {cert.generated_by_name && (
              <span className="text-muted-foreground truncate">{cert.generated_by_name}</span>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-2">
            <span className="text-xs text-muted-foreground">
              {cert.generated_at && format(new Date(cert.generated_at), 'MMM d', { locale: dateLocale })}
            </span>
            {cert.pdf_url && (
              <Button variant="ghost" size="sm" asChild className="h-7 px-2">
                <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer">
                  <FileDown className="h-3.5 w-3.5" />
                </a>
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderLabels = () => labelsPrinted === 0 ? (
    <EmptyState icon={Tag} message={t('noLabelsPrinted')} />
  ) : (
    <div className="space-y-1">
      {data.items.filter(i => i.label_printed).map((item) => (
        <div key={item.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <Printer className="h-4 w-4 text-warning flex-shrink-0" />
            <Badge variant="outline" className="font-mono text-xs">{item.serial_number}</Badge>
            {item.label_printed_by_name && (
              <span className="text-muted-foreground truncate">{item.label_printed_by_name}</span>
            )}
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {item.label_printed_at && format(new Date(item.label_printed_at), 'MMM d, HH:mm', { locale: dateLocale })}
          </span>
        </div>
      ))}
    </div>
  );

  const renderChecklists = () => data.checklistResponses.length === 0 ? (
    <EmptyState icon={CheckSquare} message={t('noChecklistResponses')} />
  ) : (
    <div className="space-y-1">
      {data.checklistResponses.map((resp) => (
        <div key={resp.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            {resp.checked ? (
              <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
            )}
            <Badge variant="outline" className="font-mono text-xs flex-shrink-0">{resp.serial_number}</Badge>
            <span className="truncate">{resp.item_text}</span>
          </div>
          {resp.checked_by_name && (
            <span className="text-xs text-muted-foreground ml-2 flex-shrink-0 truncate max-w-[80px]">
              {resp.checked_by_name}
            </span>
          )}
        </div>
      ))}
    </div>
  );

  const renderOperators = () => data.operators.length === 0 ? (
    <EmptyState icon={Users} message={t('noOperators')} />
  ) : (
    <div className="flex flex-wrap gap-3">
      {data.operators.map((op) => (
        <div key={op.id} className="flex items-center gap-2 text-sm">
          <Avatar className="h-7 w-7">
            <AvatarImage src={op.avatar_url || undefined} />
            <AvatarFallback className="text-xs">{getInitials(op.full_name)}</AvatarFallback>
          </Avatar>
          <div>
            <span className="font-medium">{op.full_name}</span>
            <span className="text-muted-foreground ml-1">({op.steps_completed})</span>
          </div>
        </div>
      ))}
    </div>
  );

  const renderActivity = () => data.activityLog.length === 0 ? (
    <EmptyState icon={History} message={t('noActivity')} />
  ) : (
    <div className="space-y-1">
      {data.activityLog.map((log) => (
        <div key={log.id} className="flex items-start justify-between py-2 border-b border-border/50 last:border-0 text-sm">
          <div className="flex items-start gap-2 min-w-0">
            <History className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <span className="font-medium">{log.action}</span>
              {log.user_name && (
                <span className="text-muted-foreground ml-1">• {log.user_name}</span>
              )}
            </div>
          </div>
          <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
            {format(new Date(log.created_at), 'MMM d, HH:mm', { locale: dateLocale })}
          </span>
        </div>
      ))}
    </div>
  );

  const renderSectionContent = (id: SectionId) => {
    switch (id) {
      case 'overview': return renderOverview();
      case 'steps': return <StepTimeline stepExecutions={data.stepExecutions} />;
      case 'materials': return renderMaterials();
      case 'certificates': return renderCertificates();
      case 'labels': return renderLabels();
      case 'checklists': return renderChecklists();
      case 'operators': return renderOperators();
      case 'activity': return renderActivity();
      default: return null;
    }
  };

  // Mobile: Accordion layout
  if (isMobile) {
    return (
      <div className="space-y-0">
        {/* Export button at top */}
        {onExportPdf && (
          <div className="flex justify-end pb-3 mb-3 border-b">
            <Button variant="outline" size="sm" onClick={handleExportClick} disabled={exporting} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
              {t('exportPdf')}
            </Button>
          </div>
        )}

        {/* Accordion sections */}
        {sections.map((section) => {
          const Icon = section.icon;
          const count = getSectionCount(section.id);
          const isOpen = openSections.has(section.id);

          return (
            <Collapsible
              key={section.id}
              open={isOpen}
              onOpenChange={() => toggleAccordion(section.id)}
              className="border-b border-border/50"
            >
              <CollapsibleTrigger className="w-full flex items-center justify-between py-3 hover:bg-muted/30 transition-colors -mx-1 px-1 rounded">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{t(section.labelKey as any)}</span>
                  {count > 0 && section.id !== 'overview' && (
                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                      {count}
                    </Badge>
                  )}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform",
                  isOpen && "rotate-180"
                )} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pb-4 pt-1">
                {renderSectionContent(section.id)}
              </CollapsibleContent>
            </Collapsible>
          );
        })}

        <ExportReportDialog
          open={showExportDialog}
          onOpenChange={setShowExportDialog}
          onExport={handleExport}
          exporting={exporting}
          woNumber={data.workOrder.wo_number}
          sectionCounts={{
            steps: data.stepExecutions.length,
            materials: data.batchMaterials.length,
            certificates: data.certificates.length,
            labels: labelsPrinted,
            checklists: data.checklistResponses.length,
            operators: data.operators.length,
            activity: data.activityLog.length,
          }}
        />
      </div>
    );
  }

  // Desktop: Sidebar navigation layout
  return (
    <div className={cn("flex gap-4 h-full", compact && "h-[calc(100vh-200px)]")}>
      {/* Slim sidebar navigation */}
      <div className="w-40 flex-shrink-0 space-y-1">
        {compact && (
          <div className="mb-4 pb-3 border-b">
            <h3 className="font-bold text-sm truncate">{data.workOrder.wo_number}</h3>
            <div className="flex items-center gap-2 mt-1">
              <WorkOrderStatusBadge status={data.workOrder.status} />
            </div>
            {data.workOrder.customer_name && (
              <p className="text-xs text-muted-foreground mt-1 truncate">{data.workOrder.customer_name}</p>
            )}
            <div className="mt-2">
              <ProductBreakdownBadges breakdown={productBreakdown} compact />
            </div>
          </div>
        )}

        {sections.map((section) => {
          const Icon = section.icon;
          const count = getSectionCount(section.id);
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm transition-colors text-left",
                "hover:bg-muted/80",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="truncate flex-1">{t(section.labelKey as any)}</span>
              {count > 0 && section.id !== 'overview' && (
                <Badge 
                  variant={isActive ? "secondary" : "outline"} 
                  className={cn("text-[10px] h-5 px-1.5", isActive && "bg-primary-foreground/20 text-primary-foreground border-0")}
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}

        {onExportPdf && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportClick}
            disabled={exporting}
            className="w-full mt-3 gap-2"
          >
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            {t('exportPdf')}
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="pr-2">
          {renderSectionContent(activeSection)}
        </div>
      </div>

      <ExportReportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onExport={handleExport}
        exporting={exporting}
        woNumber={data.workOrder.wo_number}
        sectionCounts={{
          steps: data.stepExecutions.length,
          materials: data.batchMaterials.length,
          certificates: data.certificates.length,
          labels: labelsPrinted,
          checklists: data.checklistResponses.length,
          operators: data.operators.length,
          activity: data.activityLog.length,
        }}
      />
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
      <Icon className="h-10 w-10 mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
