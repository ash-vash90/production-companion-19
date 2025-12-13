import React, { useState, useMemo } from 'react';
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
import { useProductionReports, ProductionReportItem } from '@/hooks/useProductionReports';
import { LayoutGrid, Table as TableIcon, RefreshCw, AlertCircle, BarChart3 } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, subDays } from 'date-fns';
import { ReportFilters, ReportFilterState } from '@/components/reports/ReportFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { ResponsiveVirtualizedGrid } from '@/components/VirtualizedList';

type ViewMode = 'cards' | 'table';

const VIEWMODE_STORAGE_KEY = 'productionreports_viewmode';

const ProductionReports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  // Use resilient hook - now only fetches completed/cancelled orders
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
      
      // Age filter
      let matchesAge = true;
      if (filters.ageFilter !== 'all') {
        const createdDate = new Date(wo.created_at);
        if (filters.ageFilter === 'today') matchesAge = isToday(createdDate);
        else if (filters.ageFilter === 'week') matchesAge = isThisWeek(createdDate);
        else if (filters.ageFilter === 'month') matchesAge = isThisMonth(createdDate);
        else if (filters.ageFilter === 'older') matchesAge = createdDate < subDays(new Date(), 30);
      }

      // Created month filter
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
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <PageHeader title={t('productionReports')} description={t('viewAnalyzeProduction')} />
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
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
            <div className="space-y-6">
              {Object.entries(groupedWorkOrders).map(([groupKey, orders]) => (
                <div key={groupKey} className="space-y-3">
                  {groupBy !== 'none' && (
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-semibold text-sm sm:text-base">
                        {getGroupLabel(groupKey)}
                      </h3>
                      <Badge variant="secondary">{orders.length}</Badge>
                    </div>
                  )}
                  
                  {viewMode === 'cards' ? (
                    <ResponsiveVirtualizedGrid
                      items={orders}
                      renderItem={(wo) => (
                        <WorkOrderCard
                          key={wo.id}
                          workOrder={wo}
                          showUrgency={false}
                          showActions={false}
                          linkTo={`/production-reports/${wo.id}`}
                        />
                      )}
                      itemHeight={140}
                      minItemWidth={300}
                    />
                  ) : (
                    <Card className="overflow-hidden">
                      <CardContent className="p-0">
                        <div className="w-full overflow-x-auto">
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
                                  linkTo={`/production-reports/${wo.id}`}
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
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReports;
