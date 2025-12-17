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

import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WorkOrderCard } from '@/components/workorders/WorkOrderCard';
import { WorkOrderTableRow } from '@/components/workorders/WorkOrderTableRow';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { ReportDetailContentV2 } from '@/components/reports/ReportDetailContentV2';
import { useProductionReports, ProductionReportItem } from '@/hooks/useProductionReports';
import { useProductionReportDetail } from '@/services/reportDataService';
import { toast } from 'sonner';
import { LayoutGrid, List, RefreshCw, AlertCircle, BarChart3, X, ChevronRight, Loader2 } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, subDays } from 'date-fns';
import { ReportFilters, ReportFilterState } from '@/components/reports/ReportFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveVirtualizedGrid } from '@/components/VirtualizedList';
import { generateProductionReportPdf } from '@/services/reportPdfService';
import { getProductBreakdown, formatDate } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ExportSections } from '@/types/reports';

type ViewMode = 'cards' | 'table';

const VIEWMODE_STORAGE_KEY = 'productionreports_viewmode';

const ProductionReports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const { reports: workOrders, loading, error, refetch, isStale } = useProductionReports();
  
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEWMODE_STORAGE_KEY);
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

  // Master-detail state using new hook
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);
  const { data: selectedReportData, loading: loadingDetail, fetchReport, clear: clearReport } = useProductionReportDetail();
  const [exporting, setExporting] = useState(false);

  // Persist view mode to localStorage (perpetual)
  React.useEffect(() => {
    localStorage.setItem(VIEWMODE_STORAGE_KEY, viewMode);
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

  // Handle report selection
  const handleSelectReport = useCallback((wo: ProductionReportItem) => {
    if (isMobile) {
      navigate(`/production-reports/${wo.id}`);
    } else {
      setSelectedReportId(wo.id);
      fetchReport(wo.id, language as 'en' | 'nl');
    }
  }, [isMobile, navigate, fetchReport, language]);

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
                {/* View toggle - always visible */}
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
                    <List className="h-4 w-4" />
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
              <div className="flex-1 overflow-auto">
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
                      ) : viewMode === 'cards' ? (
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
                                showStatusEdit={false}
                              />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="rounded-lg border overflow-hidden overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="bg-muted/30">
                                <TableHead className="text-xs">{t('woNumber')}</TableHead>
                                <TableHead className="text-xs">{t('productType')}</TableHead>
                                <TableHead className="text-xs hidden md:table-cell">{t('customer')}</TableHead>
                                <TableHead className="text-xs">{t('status')}</TableHead>
                                <TableHead className="text-xs hidden lg:table-cell">{t('dates')}</TableHead>
                                <TableHead className="text-xs">{t('completed')}</TableHead>
                                <TableHead className="text-xs text-right">{t('actions')}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {orders.map((wo) => (
                                <WorkOrderTableRow
                                  key={wo.id}
                                  workOrder={{
                                    ...wo,
                                    progressPercent: wo.status === 'completed' ? 100 : 0,
                                  }}
                                  showUrgency={false}
                                  showCompletedDate={true}
                                  onClick={() => handleSelectReport(wo)}
                                  actionLabel={t('viewReport')}
                                />
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
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
                      clearReport();
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
                  <ReportDetailContentV2
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
