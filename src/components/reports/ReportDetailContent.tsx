import React, { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { StepTimeline } from '@/components/reports/StepTimeline';
import { 
  Package, ClipboardList, Users, Clock, CheckCircle2, XCircle, 
  FileText, Tag, History, Download, Printer, CheckSquare, Calendar, FileDown, Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { formatDate, getProductBreakdown } from '@/lib/utils';
import { cn } from '@/lib/utils';

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
  onExportPdf?: () => void;
  exporting?: boolean;
  compact?: boolean;
}

const sections: { id: SectionId; icon: React.ElementType; labelKey: string }[] = [
  { id: 'overview', icon: Package, labelKey: 'overview' },
  { id: 'steps', icon: ClipboardList, labelKey: 'steps' },
  { id: 'materials', icon: Package, labelKey: 'materials' },
  { id: 'certificates', icon: FileText, labelKey: 'certificates' },
  { id: 'labels', icon: Tag, labelKey: 'labels' },
  { id: 'checklists', icon: CheckSquare, labelKey: 'checklists' },
  { id: 'operators', icon: Users, labelKey: 'operators' },
  { id: 'activity', icon: History, labelKey: 'activity' },
];

export function ReportDetailContent({ data, onExportPdf, exporting, compact = false }: ReportDetailContentProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'nl' ? nl : enUS;
  const [activeSection, setActiveSection] = useState<SectionId>('overview');

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

  const renderContent = () => {
    switch (activeSection) {
      case 'overview':
        return (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Package className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t('items')}</span>
                </div>
                <p className="text-2xl font-bold">{completedItems}/{data.items.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                <div className="flex items-center gap-2 text-success mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t('passed')}</span>
                </div>
                <p className="text-2xl font-bold text-success">{passedValidations}</p>
              </div>
              <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 text-destructive mb-1">
                  <XCircle className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t('failed')}</span>
                </div>
                <p className="text-2xl font-bold text-destructive">{failedValidations}</p>
              </div>
              <div className="p-4 rounded-lg bg-info/10 border border-info/20">
                <div className="flex items-center gap-2 text-info mb-1">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t('certificates')}</span>
                </div>
                <p className="text-2xl font-bold">{data.certificates.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
                <div className="flex items-center gap-2 text-warning mb-1">
                  <Tag className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t('labels')}</span>
                </div>
                <p className="text-2xl font-bold">{labelsPrinted}/{data.items.length}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs font-medium uppercase tracking-wide">{t('operators')}</span>
                </div>
                <p className="text-2xl font-bold">{data.operators.length}</p>
              </div>
            </div>

            {/* Key Dates */}
            <div>
              <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {t('keyDates')}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">{t('created')}</p>
                  <p className="font-medium">{formatDate(data.workOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('startDate')}</p>
                  <p className="font-medium">
                    {data.workOrder.start_date ? formatDate(data.workOrder.start_date) : <span className="text-muted-foreground italic">{t('notSet')}</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('shippingDate')}</p>
                  <p className="font-medium">
                    {data.workOrder.shipping_date ? formatDate(data.workOrder.shipping_date) : <span className="text-muted-foreground italic">{t('notSet')}</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{t('completed')}</p>
                  <p className="font-medium">
                    {data.workOrder.completed_at ? formatDate(data.workOrder.completed_at) : <span className="text-muted-foreground italic">{t('notSet')}</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Operators Preview */}
            {data.operators.length > 0 && (
              <div>
                <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">{t('teamInvolved')}</h4>
                <div className="flex flex-wrap gap-2">
                  {data.operators.map((op) => (
                    <div key={op.id} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border text-sm">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={op.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">{getInitials(op.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{op.full_name}</span>
                      <span className="text-muted-foreground text-xs">({op.steps_completed})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );

      case 'steps':
        return <StepTimeline stepExecutions={data.stepExecutions} />;

      case 'materials':
        return data.batchMaterials.length === 0 ? (
          <EmptyState icon={Package} message={t('noMaterialsScanned')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {data.batchMaterials.map((mat, index) => (
              <div key={index} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                  <Badge variant="outline" className="font-mono text-xs">{mat.serial_number}</Badge>
                  <Badge variant="secondary" className="text-xs">{mat.material_type}</Badge>
                  <span className="font-mono font-medium text-sm">{mat.batch_number}</span>
                </div>
                <span className="text-xs text-muted-foreground ml-2">
                  {format(new Date(mat.scanned_at), 'MMM d, HH:mm', { locale: dateLocale })}
                </span>
              </div>
            ))}
          </div>
        );

      case 'certificates':
        return data.certificates.length === 0 ? (
          <EmptyState icon={FileText} message={t('noCertificatesGenerated')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {data.certificates.map((cert) => (
              <div key={cert.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 text-primary flex-shrink-0" />
                  <Badge variant="outline" className="font-mono text-xs">{cert.serial_number}</Badge>
                  {cert.generated_by_name && (
                    <span className="text-xs text-muted-foreground truncate">{cert.generated_by_name}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs text-muted-foreground hidden sm:block">
                    {cert.generated_at && format(new Date(cert.generated_at), 'MMM d', { locale: dateLocale })}
                  </span>
                  {cert.pdf_url && (
                    <Button variant="outline" size="sm" asChild className="h-7 px-2">
                      <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer" className="gap-1">
                        <Download className="h-3 w-3" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'labels':
        return labelsPrinted === 0 ? (
          <EmptyState icon={Tag} message={t('noLabelsPrinted')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {data.items.filter(i => i.label_printed).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  <Printer className="h-4 w-4 text-warning flex-shrink-0" />
                  <Badge variant="outline" className="font-mono text-xs">{item.serial_number}</Badge>
                  {item.label_printed_by_name && (
                    <span className="text-xs text-muted-foreground truncate">{item.label_printed_by_name}</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
                  {item.label_printed_at && format(new Date(item.label_printed_at), 'MMM d, HH:mm', { locale: dateLocale })}
                </span>
              </div>
            ))}
          </div>
        );

      case 'checklists':
        return data.checklistResponses.length === 0 ? (
          <EmptyState icon={CheckSquare} message={t('noChecklistResponses')} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            {data.checklistResponses.map((resp) => (
              <div key={resp.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2 min-w-0">
                  {resp.checked ? (
                    <CheckCircle2 className="h-4 w-4 text-success flex-shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive flex-shrink-0" />
                  )}
                  <Badge variant="outline" className="font-mono text-xs flex-shrink-0">{resp.serial_number}</Badge>
                  <span className="text-sm truncate">{resp.item_text}</span>
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

      case 'operators':
        return data.operators.length === 0 ? (
          <EmptyState icon={Users} message={t('noOperators')} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.operators.map((op) => (
              <div key={op.id} className="flex items-center gap-3 p-4 rounded-lg bg-muted/30 border">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={op.avatar_url || undefined} />
                  <AvatarFallback>{getInitials(op.full_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="font-medium truncate">{op.full_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {op.steps_completed} {t('stepsCompleted')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        );

      case 'activity':
        return data.activityLog.length === 0 ? (
          <EmptyState icon={History} message={t('noActivity')} />
        ) : (
          <div className="space-y-2">
            {data.activityLog.map((log) => (
              <div key={log.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-start gap-3 min-w-0">
                  <History className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-medium text-sm">{log.action}</span>
                    {log.user_name && (
                      <span className="text-muted-foreground text-sm ml-1">• {log.user_name}</span>
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

      default:
        return null;
    }
  };

  return (
    <div className={cn("flex flex-col lg:flex-row gap-4 h-full", compact && "h-[calc(100vh-200px)]")}>
      {/* Left sidebar navigation */}
      <div className={cn(
        "flex lg:flex-col gap-1 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0",
        compact ? "lg:w-48 flex-shrink-0" : "lg:w-56 flex-shrink-0"
      )}>
        {/* Header for compact mode */}
        {compact && (
          <div className="hidden lg:block mb-4">
            <h3 className="font-bold text-lg truncate">{data.workOrder.wo_number}</h3>
            <div className="flex items-center gap-2 mt-1">
              <WorkOrderStatusBadge status={data.workOrder.status} />
            </div>
            {data.workOrder.customer_name && (
              <p className="text-sm text-muted-foreground mt-1 truncate">{data.workOrder.customer_name}</p>
            )}
            <div className="mt-2">
              <ProductBreakdownBadges breakdown={productBreakdown} compact />
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        {sections.map((section) => {
          const Icon = section.icon;
          const count = getSectionCount(section.id);
          const isActive = activeSection === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveSection(section.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap",
                "hover:bg-muted/80",
                isActive 
                  ? "bg-primary text-primary-foreground" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline lg:inline">{t(section.labelKey as any)}</span>
              {count > 0 && section.id !== 'overview' && (
                <Badge 
                  variant={isActive ? "secondary" : "outline"} 
                  className={cn("text-[10px] h-5 px-1.5 ml-auto", isActive && "bg-primary-foreground/20 text-primary-foreground border-0")}
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}

        {/* Export button */}
        {onExportPdf && (
          <Button
            variant="outline"
            size="sm"
            onClick={onExportPdf}
            disabled={exporting}
            className="mt-2 gap-2 hidden lg:flex"
          >
            {exporting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4" />
            )}
            {t('exportPdf')}
          </Button>
        )}
      </div>

      {/* Content area */}
      <div className="flex-1 min-w-0">
        <ScrollArea className={cn(compact ? "h-full" : "max-h-[70vh]")}>
          <div className="pr-4">
            {renderContent()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon className="h-12 w-12 mb-3 opacity-50" />
      <p className="text-sm">{message}</p>
    </div>
  );
}
