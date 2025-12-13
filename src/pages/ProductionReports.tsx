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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { VirtualizedList } from '@/components/VirtualizedList';
import { useProductionReports, ProductionReportItem } from '@/hooks/useProductionReports';
import { Loader2, BarChart3, RefreshCw, AlertCircle } from 'lucide-react';
import { format, isToday, isThisWeek, isThisMonth, subDays } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { ReportFilters, ReportFilterState } from '@/components/reports/ReportFilters';
import { Skeleton } from '@/components/ui/skeleton';

const ProductionReports = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  // Use resilient hook instead of manual fetching
  const { reports: workOrders, loading, error, refetch, isStale } = useProductionReports();
  
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

  const getStatusVariant = (status: string): 'info' | 'warning' | 'success' | 'secondary' | 'destructive' => {
    switch (status) {
      case 'planned': return 'info';
      case 'in_progress': return 'warning';
      case 'completed': return 'success';
      case 'on_hold': return 'secondary';
      case 'cancelled': return 'destructive';
      default: return 'secondary';
    }
  };

  const getStatusLabel = (status: string) => {
    if (status === 'in_progress') return t('inProgressStatus');
    if (status === 'planned') return t('planned');
    if (status === 'completed') return t('completed');
    if (status === 'on_hold') return t('onHold');
    if (status === 'cancelled') return t('cancelled');
    return status;
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

  const renderTableRow = (wo: ProductionReportItem) => (
    <TableRow key={wo.id}>
      <TableCell className="font-mono font-semibold whitespace-nowrap">
        {wo.wo_number}
      </TableCell>
      <TableCell>
        {wo.productBreakdown.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {wo.productBreakdown.map((b) => (
              <Badge key={b.type} variant="outline">
                {b.count}× {b.label}
              </Badge>
            ))}
          </div>
        ) : (
          <Badge variant="outline">{wo.batch_size} items</Badge>
        )}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
        {wo.customer_name || '-'}
      </TableCell>
      <TableCell className="font-mono whitespace-nowrap">{wo.batch_size}</TableCell>
      <TableCell>
        <Badge variant={getStatusVariant(wo.status)}>
          {getStatusLabel(wo.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {format(new Date(wo.created_at), 'dd/MM/yyyy', { locale: language === 'nl' ? nl : enUS })}
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap">
        {wo.completed_at ? format(new Date(wo.completed_at), 'dd/MM/yyyy', { locale: language === 'nl' ? nl : enUS }) : '-'}
      </TableCell>
      <TableCell className="text-right whitespace-nowrap">
        <Button
          size="sm"
          variant="outline"
          onClick={() => navigate(`/production-reports/${wo.id}`)}
        >
          {t('viewReport')}
        </Button>
      </TableCell>
    </TableRow>
  );

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
          <div className="flex items-center justify-between">
            <PageHeader title={t('productionReports')} description={t('viewAnalyzeProduction')} />
            {(isStale || error) && (
              <div className="flex items-center gap-2">
                {error && <AlertCircle className="h-4 w-4 text-destructive" />}
                <Button variant="outline" size="sm" onClick={refetch}>
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {t('refresh')}
                </Button>
              </div>
            )}
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
                <Card key={groupKey} className="overflow-hidden">
                  {groupBy !== 'none' && (
                    <div className="px-4 sm:px-6 py-3 border-b bg-muted/30">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-sm sm:text-base truncate">
                          {groupBy === 'status' ? getStatusLabel(groupKey) : groupKey.replace('_', ' ')}
                        </h3>
                        <Badge variant="secondary">{orders.length}</Badge>
                      </div>
                    </div>
                  )}
                  <CardContent className="p-0">
                    <div className="w-full overflow-x-auto">
                      <Table className="min-w-[720px]">
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t('woNumber')}</TableHead>
                            <TableHead>{t('productType')}</TableHead>
                            <TableHead>{t('customer')}</TableHead>
                            <TableHead>{t('batchSize')}</TableHead>
                            <TableHead>{t('status')}</TableHead>
                            <TableHead>{t('created')}</TableHead>
                            <TableHead>{t('completed')}</TableHead>
                            <TableHead className="text-right">{t('actions')}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orders.length > 100 ? (
                            <VirtualizedList
                              items={orders}
                              renderItem={(wo) => renderTableRow(wo)}
                              itemHeight={52}
                              maxHeight={500}
                            />
                          ) : (
                            orders.map((wo) => renderTableRow(wo))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReports;
