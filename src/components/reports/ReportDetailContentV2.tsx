/**
 * Report Detail Content (Refactored)
 *
 * Orchestrates entity components to display production report details.
 * Each entity is responsible for its own rendering logic.
 */

import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { StepTimeline } from '@/components/reports/StepTimeline';
import { ProductionStory } from '@/components/reports/ProductionStory';
import { ExportReportDialog } from '@/components/reports/ExportReportDialog';
import {
  MaterialsSection,
  CertificatesSection,
  ChecklistsSection,
  OperatorsSection,
  ActivitySection,
  LabelsSection,
} from '@/components/reports/entities';
import {
  FileDown,
  Loader2,
  BookOpen,
  LayoutGrid,
  Clock,
  CheckCircle,
  XCircle,
  Award,
  Printer,
  Calendar,
  User,
  Package,
} from 'lucide-react';
import { formatDate, cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ProductionReportData, ExportSections } from '@/types/reports';
import { calculateStats } from '@/types/reports';

interface ReportDetailContentProps {
  data: ProductionReportData;
  onExportPdf?: (sections: ExportSections) => void;
  exporting?: boolean;
  compact?: boolean;
}

type ViewMode = 'story' | 'sections';

export function ReportDetailContentV2({
  data,
  onExportPdf,
  exporting = false,
  compact = false,
}: ReportDetailContentProps) {
  const { t, language } = useLanguage();
  const isMobile = useIsMobile();
  const [viewMode, setViewMode] = useState<ViewMode>('story');
  const [showExportDialog, setShowExportDialog] = useState(false);

  const stats = calculateStats(data);

  const handleExport = (selectedSections: ExportSections) => {
    onExportPdf?.(selectedSections);
    setShowExportDialog(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-semibold">{data.workOrder.wo_number}</h2>
            <WorkOrderStatusBadge status={data.workOrder.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {data.workOrder.product_type.replace(/_/g, ' ')} • {data.workOrder.batch_size}{' '}
            {language === 'nl' ? 'stuks' : 'units'}
            {data.workOrder.customer_name && ` • ${data.workOrder.customer_name}`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          {!compact && (
            <div className="flex border rounded-md">
              <Button
                variant={viewMode === 'story' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-r-none h-8 px-2"
                onClick={() => setViewMode('story')}
              >
                <BookOpen className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'sections' ? 'secondary' : 'ghost'}
                size="sm"
                className="rounded-l-none h-8 px-2"
                onClick={() => setViewMode('sections')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </div>
          )}

          {/* Export Button */}
          {onExportPdf && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportDialog(true)}
              disabled={exporting}
              className="h-8"
            >
              {exporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileDown className="h-4 w-4" />
              )}
              <span className="ml-1 hidden sm:inline">PDF</span>
            </Button>
          )}
        </div>
      </div>

      {/* Quick Stats */}
      <Card>
        <CardContent className="py-3">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('items')}</p>
                <p className="font-semibold">
                  {stats.completedItems}/{stats.totalItems}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-success" />
              <div>
                <p className="text-xs text-muted-foreground">{t('passed')}</p>
                <p className="font-semibold text-success">{stats.passedValidations}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-4 w-4 text-destructive" />
              <div>
                <p className="text-xs text-muted-foreground">{t('failed')}</p>
                <p className="font-semibold text-destructive">{stats.failedValidations}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('certificates')}</p>
                <p className="font-semibold">{stats.certificatesIssued}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Printer className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('labels')}</p>
                <p className="font-semibold">{stats.labelsPrinted}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs text-muted-foreground">{t('operators')}</p>
                <p className="font-semibold">{stats.uniqueOperators}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Dates */}
      <Card>
        <CardContent className="py-3">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">{t('created')}:</span>
              <span className="font-medium">{formatDate(data.workOrder.created_at)}</span>
            </div>
            {data.workOrder.start_date && (
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-info" />
                <span className="text-muted-foreground">{t('startDate')}:</span>
                <span className="font-medium">{formatDate(data.workOrder.start_date)}</span>
              </div>
            )}
            {data.workOrder.completed_at && (
              <div className="flex items-center gap-1.5">
                <CheckCircle className="h-3.5 w-3.5 text-success" />
                <span className="text-muted-foreground">{t('completed')}:</span>
                <span className="font-medium">{formatDate(data.workOrder.completed_at)}</span>
              </div>
            )}
            {data.workOrder.shipping_date && (
              <div className="flex items-center gap-1.5">
                <Package className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t('shippingDate')}:</span>
                <span className="font-medium">{formatDate(data.workOrder.shipping_date)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      {viewMode === 'story' ? (
        <StoryView data={data} />
      ) : (
        <SectionsView data={data} />
      )}

      {/* Export Dialog */}
      <ExportReportDialog
        open={showExportDialog}
        onOpenChange={setShowExportDialog}
        onExport={handleExport}
        data={data}
      />
    </div>
  );
}

// Story View - Chronological narrative
function StoryView({ data }: { data: ProductionReportData }) {
  return (
    <div className="space-y-6">
      {/* Production Timeline */}
      <ProductionStory data={data} showStats={false} showTeam={false} />

      {/* Entity Summaries */}
      <div className="grid gap-4 md:grid-cols-2">
        <OperatorsSection operators={data.operators} totalSteps={data.stepExecutions.length} />
        <MaterialsSection materials={data.batchMaterials} compact />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <CertificatesSection certificates={data.certificates} compact />
        <ChecklistsSection responses={data.checklistResponses} compact />
      </div>
    </div>
  );
}

// Sections View - Tabbed entity sections
function SectionsView({ data }: { data: ProductionReportData }) {
  const { language } = useLanguage();

  return (
    <Tabs defaultValue="steps" className="w-full">
      <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-transparent p-0">
        <TabsTrigger value="steps" className="data-[state=active]:bg-primary/10">
          {language === 'nl' ? 'Stappen' : 'Steps'}
          <Badge variant="secondary" className="ml-1.5 h-5">
            {data.stepExecutions.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="materials" className="data-[state=active]:bg-primary/10">
          {language === 'nl' ? 'Materialen' : 'Materials'}
          <Badge variant="secondary" className="ml-1.5 h-5">
            {data.batchMaterials.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="certificates" className="data-[state=active]:bg-primary/10">
          {language === 'nl' ? 'Certificaten' : 'Certificates'}
          <Badge variant="secondary" className="ml-1.5 h-5">
            {data.certificates.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="labels" className="data-[state=active]:bg-primary/10">
          {language === 'nl' ? 'Labels' : 'Labels'}
          <Badge variant="secondary" className="ml-1.5 h-5">
            {data.items.filter(i => i.label_printed).length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="checklists" className="data-[state=active]:bg-primary/10">
          {language === 'nl' ? 'Checklists' : 'Checklists'}
          <Badge variant="secondary" className="ml-1.5 h-5">
            {data.checklistResponses.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="team" className="data-[state=active]:bg-primary/10">
          {language === 'nl' ? 'Team' : 'Team'}
          <Badge variant="secondary" className="ml-1.5 h-5">
            {data.operators.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="activity" className="data-[state=active]:bg-primary/10">
          {language === 'nl' ? 'Activiteit' : 'Activity'}
          <Badge variant="secondary" className="ml-1.5 h-5">
            {data.activityLog.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <div className="mt-4">
        <TabsContent value="steps" className="m-0">
          <StepTimeline executions={data.stepExecutions} />
        </TabsContent>

        <TabsContent value="materials" className="m-0">
          <MaterialsSection materials={data.batchMaterials} />
        </TabsContent>

        <TabsContent value="certificates" className="m-0">
          <CertificatesSection certificates={data.certificates} />
        </TabsContent>

        <TabsContent value="labels" className="m-0">
          <LabelsSection items={data.items} />
        </TabsContent>

        <TabsContent value="checklists" className="m-0">
          <ChecklistsSection responses={data.checklistResponses} />
        </TabsContent>

        <TabsContent value="team" className="m-0">
          <OperatorsSection operators={data.operators} totalSteps={data.stepExecutions.length} />
        </TabsContent>

        <TabsContent value="activity" className="m-0">
          <ActivitySection activities={data.activityLog} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

export default ReportDetailContentV2;
