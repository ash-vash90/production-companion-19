import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WorkOrderCard } from '@/components/workorders/WorkOrderCard';
import { WorkOrderTableRow } from '@/components/workorders/WorkOrderTableRow';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { ReportDetailContent } from '@/components/reports/ReportDetailContent';
import { useProductionReports, ProductionReportItem } from '@/hooks/useProductionReports';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { LayoutGrid, Table as TableIcon, RefreshCw, AlertCircle, BarChart3, X, ChevronRight, Loader2 } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, subDays } from 'date-fns';
import { ReportFilters, ReportFilterState } from '@/components/reports/ReportFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveVirtualizedGrid } from '@/components/VirtualizedList';
import { generateProductionReportPdf, ExportSections } from '@/services/reportPdfService';
import { getProductBreakdown, formatDate } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type ViewMode = 'cards' | 'table';

const VIEWMODE_STORAGE_KEY = 'productionreports_viewmode';

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

const ProductionReports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const { reports: workOrders, loading, error, refetch, isStale } = useProductionReports();
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = sessionStorage.getItem(VIEWMODE_STORAGE_KEY);
      return (saved as ViewMode) || 'table';
    } catch {
      return 'table';
    }
  });
  
  const [groupBy, setGroupBy] = useState('none');
  const [filters, setFilters] = useState<ReportFilterState>({
    searchTerm: '',
    statusFilter: 'all',
    productFilter: 'all',
    customerFilter: 'all',
    ageFilter: 'all',
    createdMonthFilter: 'all',
    batchSizeFilter: 'all',
  });

  // Master-detail state
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const [selectedReportData, setSelectedReportData] = useState<ReportData | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Persist view mode
  React.useEffect(() => {
    sessionStorage.setItem(VIEWMODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  // Extract unique customers and months for filter options
  const customers = useMemo(() => {
    return [...new Set(workOrders.map(wo => wo.customer_name).filter(Boolean))];
  }, [workOrders]);

  const createdMonths = useMemo(() => {
    const months = workOrders.map(wo => format(new Date(wo.created_at), 'yyyy-MM'));
    return [...new Set(months)].sort().reverse();
  }, [workOrders]);

  // Apply filters
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter((wo) => {
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = wo.wo_number.toLowerCase().includes(searchLower) ||
        (wo.customer_name?.toLowerCase().includes(searchLower));
      const matchesStatus = filters.statusFilter === 'all' || wo.status === filters.statusFilter;
      const matchesProduct = filters.productFilter === 'all' || wo.product_type === filters.productFilter;
      const matchesCustomer = filters.customerFilter === 'all' || wo.customer_name === filters.customerFilter;
      
      let matchesAge = true;
      if (filters.ageFilter !== 'all') {
        const createdDate = new Date(wo.created_at);
        if (filters.ageFilter === 'today') matchesAge = isToday(createdDate);
        else if (filters.ageFilter === 'week') matchesAge = isThisWeek(createdDate);
        else if (filters.ageFilter === 'month') matchesAge = isThisMonth(createdDate);
        else if (filters.ageFilter === 'older') matchesAge = createdDate < subDays(new Date(), 30);
      }

      let matchesCreatedMonth = true;
      if (filters.createdMonthFilter !== 'all') {
        matchesCreatedMonth = format(new Date(wo.created_at), 'yyyy-MM') === filters.createdMonthFilter;
      }

      return matchesSearch && matchesStatus && matchesProduct && matchesCustomer && matchesAge && matchesCreatedMonth;
    });
  }, [workOrders, filters]);

  // Group work orders
  const groupedWorkOrders = useMemo(() => {
    if (groupBy === 'none') return { 'all': filteredWorkOrders };
    
    return filteredWorkOrders.reduce((acc, wo) => {
      let key = '';
      if (groupBy === 'status') key = wo.status;
      else if (groupBy === 'product') key = wo.product_type;
      else if (groupBy === 'customer') key = wo.customer_name || 'No Customer';
      
      if (!acc[key]) acc[key] = [];
      acc[key].push(wo);
      return acc;
    }, {} as Record<string, ProductionReportItem[]>);
  }, [filteredWorkOrders, groupBy]);

  const getGroupLabel = (key: string): string => {
    if (groupBy === 'status') {
      return t(key as any);
    }
    return key === 'all' ? '' : key;
  };

  const clearAllFilters = () => {
    setFilters({
      searchTerm: '',
      statusFilter: 'all',
      productFilter: 'all',
      customerFilter: 'all',
      ageFilter: 'all',
      createdMonthFilter: 'all',
      batchSizeFilter: 'all',
    });
  };

  // Fetch detail data for selected report
  const fetchReportDetail = useCallback(async (id: string) => {
    try {
      setLoadingDetail(true);

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

      setSelectedReportData({
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
      toast.error(t('error'), { description: error.message });
    } finally {
      setLoadingDetail(false);
    }
  }, [language, t]);

  // Handle report selection
  const handleSelectReport = useCallback((wo: ProductionReportItem) => {
    if (isMobile) {
      navigate(`/production-reports/${wo.id}`);
    } else {
      setSelectedReportId(wo.id);
      fetchReportDetail(wo.id);
    }
  }, [isMobile, navigate, fetchReportDetail]);

  // Handle PDF export
  const handleExportPdf = async (sections?: ExportSections) => {
    if (!selectedReportData) return;
    setExporting(true);
    try {
      await generateProductionReportPdf(selectedReportData, { language: language as 'en' | 'nl', sections });
      toast.success(t('pdfExported'));
    } catch (error: any) {
      console.error('PDF export error:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setExporting(false);
    }
  };

  if (!user) return null;

  // Loading skeleton
  if (loading && workOrders.length === 0) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="space-y-6">
            <PageHeader title={t('productionReports')} description={t('viewAnalyzeProduction')} />
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Card key={i}>
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      <Skeleton className="h-6 w-32" />
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-6 w-20" />
                      <Skeleton className="h-6 flex-1" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-8rem)]">
          {/* Left panel - List */}
          <div className={cn(
            "flex flex-col gap-4",
            selectedReportId ? "lg:w-[400px] xl:w-[450px] flex-shrink-0" : "flex-1"
          )}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <PageHeader title={t('productionReports')} description={t('viewAnalyzeProduction')} />
              <div className="flex items-center gap-2">
                <div className="flex border rounded-lg overflow-hidden">
                  <Button
                    variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('cards')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                    size="sm"
                    className="rounded-none"
                    onClick={() => setViewMode('table')}
                  >
                    <TableIcon className="h-4 w-4" />
                  </Button>
                </div>
                {(isStale || error) && (
                  <Button variant="outline" size="sm" onClick={refetch}>
                    {error && <AlertCircle className="h-4 w-4 mr-1 text-destructive" />}
                    <RefreshCw className="h-4 w-4 mr-1" />
                    {t('refresh')}
                  </Button>
                )}
              </div>
            </div>

            <ReportFilters
              filters={filters}
              onFiltersChange={setFilters}
              customers={customers}
              createdMonths={createdMonths}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
            />

            {filteredWorkOrders.length === 0 ? (
              <Card>
                <CardContent className="py-16 text-center">
                  <BarChart3 className="h-16 w-16 mx-auto mb-6 text-muted-foreground/50" />
                  <h3 className="text-xl font-semibold mb-3">
                    {t('noMatchingReports')}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-6">
                    {t('tryAdjustingFilters')}
                  </p>
                  <Button onClick={clearAllFilters} variant="outline">
                    {t('clearFilters')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="flex-1 touch-pan-x">
                <div className="space-y-4 pr-4">
                  {Object.entries(groupedWorkOrders).map(([groupKey, orders]) => (
                    <div key={groupKey} className="space-y-2">
                      {groupBy !== 'none' && (
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-semibold text-sm">{getGroupLabel(groupKey)}</h3>
                          <Badge variant="secondary">{orders.length}</Badge>
                        </div>
                      )}
                      
                      {/* Compact list items for master-detail */}
                      {selectedReportId ? (
                        <div className="space-y-1">
                          {orders.map((wo) => {
                            const isSelected = wo.id === selectedReportId;
                            const breakdown = getProductBreakdown(wo.productBreakdown?.map(b => ({ serial_number: `${b.type}-001` })) || []);
                            
                            return (
                              <button
                                key={wo.id}
                                onClick={() => handleSelectReport(wo)}
                                className={cn(
                                  "w-full text-left p-3 rounded-lg border transition-colors",
                                  isSelected 
                                    ? "bg-primary/10 border-primary" 
                                    : "bg-card hover:bg-muted/50 border-border"
                                )}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-medium text-sm truncate">{wo.wo_number}</span>
                                      <WorkOrderStatusBadge status={wo.status} />
                                    </div>
                                    {wo.customer_name && (
                                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{wo.customer_name}</p>
                                    )}
                                  </div>
                                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : viewMode === 'cards' || isMobile ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                          {orders.map((wo) => (
                            <div 
                              key={wo.id} 
                              className="cursor-pointer"
                              onClick={() => handleSelectReport(wo)}
                            >
                              <WorkOrderCard
                                workOrder={wo}
                                showUrgency={false}
                                showActions={false}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <Card className="overflow-hidden">
                          <CardContent className="p-0">
                            <div className="w-full overflow-x-auto touch-pan-x">
                              <Table className="min-w-[720px]">
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t('woNumber')}</TableHead>
                                    <TableHead>{t('productType')}</TableHead>
                                    <TableHead className="hidden md:table-cell">{t('customer')}</TableHead>
                                    <TableHead>{t('status')}</TableHead>
                                    <TableHead className="hidden lg:table-cell">{t('ship')}</TableHead>
                                    <TableHead>{t('completed')}</TableHead>
                                    <TableHead className="text-right">{t('actions')}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {orders.map((wo) => (
                                    <WorkOrderTableRow
                                      key={wo.id}
                                      workOrder={wo}
                                      showUrgency={false}
                                      showCompletedDate={true}
                                      onClick={() => handleSelectReport(wo)}
                                      actionLabel={t('viewReport')}
                                    />
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Right panel - Detail (desktop only) */}
          {selectedReportId && !isMobile && (
            <Card className="flex-1 min-w-0 hidden lg:flex flex-col overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-3">
                  {selectedReportData && (
                    <>
                      <h2 className="font-bold text-lg">{selectedReportData.workOrder.wo_number}</h2>
                      <WorkOrderStatusBadge status={selectedReportData.workOrder.status} />
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/production-reports/${selectedReportId}`)}
                    className="text-xs"
                  >
                    {t('openFullPage')}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      setSelectedReportId(null);
                      setSelectedReportData(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="flex-1 p-4 overflow-hidden">
                {loadingDetail ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  </div>
                ) : selectedReportData ? (
                  <ReportDetailContent 
                    data={selectedReportData} 
                    onExportPdf={handleExportPdf}
                    exporting={exporting}
                    compact
                  />
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReports;
