import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { WorkOrderFilters, FilterState } from '@/components/workorders/WorkOrderFilters';
import { useWorkOrders, invalidateWorkOrdersCache, WorkOrderListItem } from '@/hooks/useWorkOrders';
import { prefetchProductionOnHover } from '@/services/prefetchService';
import { ResponsiveVirtualizedGrid } from '@/components/VirtualizedList';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDate, getProductBreakdown, ProductBreakdown } from '@/lib/utils';
import { Plus, Package, Eye, AlertTriangle, ChevronDown, ChevronRight, Layers, RotateCcw, LayoutGrid, Table, Clock, Link2, RefreshCw, AlertCircle, Loader2, Filter } from 'lucide-react';
import { format, differenceInDays, parseISO, isBefore } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';

// Type alias for backwards compatibility
type WorkOrderWithItems = WorkOrderListItem;

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
};

type GroupByOption = 'none' | 'status' | 'deliveryMonth' | 'createdMonth' | 'batchSize' | 'customer';

const DEFAULT_FILTERS: FilterState = {
  searchTerm: '',
  statusFilter: 'all',
  productFilter: 'all',
  customerFilter: 'all',
  ageFilter: 'all',
  deliveryMonthFilter: 'all',
  createdMonthFilter: 'all',
  batchSizeFilter: 'all',
};

const FILTERS_STORAGE_KEY = 'workorders_filters';
const GROUPBY_STORAGE_KEY = 'workorders_groupby';
const VIEWMODE_STORAGE_KEY = 'workorders_viewmode';

type ViewMode = 'cards' | 'table';

const WorkOrders = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isAdmin } = useUserProfile();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Use the resilient work orders hook
  const { workOrders, loading, error, refetch, isStale, setupRealtime } = useWorkOrders({
    excludeCancelled: true,
    enableRealtime: true,
  });
  
  // Set up realtime updates
  useEffect(() => {
    const cleanup = setupRealtime();
    return cleanup;
  }, [setupRealtime]);
  
  // Load persisted filters from sessionStorage
  const [filters, setFilters] = useState<FilterState>(() => {
    try {
      const saved = sessionStorage.getItem(FILTERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  
  // Load persisted groupBy from sessionStorage
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => {
    try {
      const saved = sessionStorage.getItem(GROUPBY_STORAGE_KEY);
      return (saved as GroupByOption) || 'none';
    } catch {
      return 'none';
    }
  });
  
  // Load persisted viewMode from sessionStorage
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = sessionStorage.getItem(VIEWMODE_STORAGE_KEY);
      return (saved as ViewMode) || 'cards';
    } catch {
      return 'cards';
    }
  });
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Persist filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  // Persist groupBy to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(GROUPBY_STORAGE_KEY, groupBy);
  }, [groupBy]);

  // Persist viewMode to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(VIEWMODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Reset all filters
  const resetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setGroupBy('none');
  };

  // Check if any filters are active
  const hasActiveFilters = useMemo(() => {
    return filters.searchTerm !== '' ||
      filters.statusFilter !== 'all' ||
      filters.productFilter !== 'all' ||
      filters.customerFilter !== 'all' ||
      filters.ageFilter !== 'all' ||
      filters.deliveryMonthFilter !== 'all' ||
      filters.createdMonthFilter !== 'all' ||
      filters.batchSizeFilter !== 'all' ||
      groupBy !== 'none';
  }, [filters, groupBy]);

  // Get unique values for filter options
  const customers = useMemo(() => {
    const uniqueCustomers = [...new Set(workOrders.map(wo => wo.customer_name).filter(Boolean))];
    return uniqueCustomers.sort();
  }, [workOrders]);

  const deliveryMonths = useMemo(() => {
    const months = new Set<string>();
    workOrders.forEach(wo => {
      if (wo.shipping_date) {
        months.add(format(parseISO(wo.shipping_date), 'yyyy-MM'));
      }
    });
    return Array.from(months).sort().reverse();
  }, [workOrders]);

  const createdMonths = useMemo(() => {
    const months = new Set<string>();
    workOrders.forEach(wo => {
      months.add(format(parseISO(wo.created_at), 'yyyy-MM'));
    });
    return Array.from(months).sort().reverse();
  }, [workOrders]);

  // Filter logic
  const filteredOrders = useMemo(() => {
    let filtered = [...workOrders];

    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(wo =>
        wo.wo_number.toLowerCase().includes(term) ||
        wo.product_type.toLowerCase().includes(term) ||
        wo.customer_name?.toLowerCase().includes(term)
      );
    }

    if (filters.statusFilter !== 'all') {
      filtered = filtered.filter(wo => wo.status === filters.statusFilter);
    }

    if (filters.productFilter !== 'all') {
      filtered = filtered.filter(wo => wo.product_type === filters.productFilter);
    }

    if (filters.customerFilter !== 'all') {
      filtered = filtered.filter(wo => wo.customer_name === filters.customerFilter);
    }

    if (filters.ageFilter !== 'all') {
      const now = new Date();
      filtered = filtered.filter(wo => {
        const createdDate = parseISO(wo.created_at);
        const ageDays = differenceInDays(now, createdDate);
        switch (filters.ageFilter) {
          case 'today': return ageDays === 0;
          case 'week': return ageDays <= 7;
          case 'month': return ageDays <= 30;
          case 'older': return ageDays > 30;
          default: return true;
        }
      });
    }

    if (filters.deliveryMonthFilter !== 'all') {
      filtered = filtered.filter(wo => {
        if (!wo.shipping_date) return false;
        return format(parseISO(wo.shipping_date), 'yyyy-MM') === filters.deliveryMonthFilter;
      });
    }

    if (filters.createdMonthFilter !== 'all') {
      filtered = filtered.filter(wo => {
        return format(parseISO(wo.created_at), 'yyyy-MM') === filters.createdMonthFilter;
      });
    }

    if (filters.batchSizeFilter !== 'all') {
      filtered = filtered.filter(wo => {
        switch (filters.batchSizeFilter) {
          case 'small': return wo.batch_size <= 5;
          case 'medium': return wo.batch_size > 5 && wo.batch_size <= 20;
          case 'large': return wo.batch_size > 20;
          default: return true;
        }
      });
    }

    return filtered;
  }, [filters, workOrders]);

  // Grouping logic
  const getGroupKey = (wo: WorkOrderWithItems, groupOption: GroupByOption): string => {
    switch (groupOption) {
      case 'status': return wo.status;
      case 'deliveryMonth': return wo.shipping_date ? format(parseISO(wo.shipping_date), 'yyyy-MM') : 'unscheduled';
      case 'createdMonth': return format(parseISO(wo.created_at), 'yyyy-MM');
      case 'batchSize': 
        if (wo.batch_size <= 5) return 'small';
        if (wo.batch_size <= 20) return 'medium';
        return 'large';
      case 'customer': return wo.customer_name || 'no-customer';
      default: return 'all';
    }
  };

  const getGroupLabel = (key: string, groupOption: GroupByOption): string => {
    switch (groupOption) {
      case 'status':
        return t(key as any) || key;
      case 'deliveryMonth':
        if (key === 'unscheduled') return t('notScheduled');
        return format(parseISO(`${key}-01`), 'MMMM yyyy');
      case 'createdMonth':
        return format(parseISO(`${key}-01`), 'MMMM yyyy');
      case 'batchSize':
        if (key === 'small') return `${t('batchSize')}: 1-5`;
        if (key === 'medium') return `${t('batchSize')}: 6-20`;
        return `${t('batchSize')}: 20+`;
      case 'customer':
        return key === 'no-customer' ? t('noCustomer') : key;
      default:
        return key;
    }
  };

  const groupedOrders = useMemo(() => {
    if (groupBy === 'none') {
      return { all: filteredOrders };
    }
    
    const groups: Record<string, WorkOrderWithItems[]> = {};
    filteredOrders.forEach(wo => {
      const key = getGroupKey(wo, groupBy);
      if (!groups[key]) groups[key] = [];
      groups[key].push(wo);
    });
    return groups;
  }, [filteredOrders, groupBy]);

  // Expand all groups when groupBy changes
  useEffect(() => {
    if (groupBy !== 'none') {
      setExpandedGroups(new Set(Object.keys(groupedOrders)));
    }
  }, [groupBy, groupedOrders]);

  const toggleGroup = (key: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(key)) {
      newExpanded.delete(key);
    } else {
      newExpanded.add(key);
    }
    setExpandedGroups(newExpanded);
  };

  // Check if shipping date is overdue (not completed)
  const isShippingOverdue = (wo: WorkOrderWithItems): boolean => {
    if (!wo.shipping_date || wo.status === 'completed') return false;
    return isBefore(parseISO(wo.shipping_date), new Date());
  };

  // Check if shipping date is approaching (within 3 days, not completed)
  const isShippingApproaching = (wo: WorkOrderWithItems): boolean => {
    if (!wo.shipping_date || wo.status === 'completed') return false;
    const daysUntil = differenceInDays(parseISO(wo.shipping_date), new Date());
    return daysUntil >= 0 && daysUntil <= 3;
  };

  // Check if start date is overdue (only for planned orders)
  const isStartOverdue = (wo: WorkOrderWithItems): boolean => {
    if (!wo.start_date || wo.status !== 'planned') return false;
    return isBefore(parseISO(wo.start_date), new Date());
  };

  // Check if start date is approaching (within 2 days, only for planned)
  const isStartApproaching = (wo: WorkOrderWithItems): boolean => {
    if (!wo.start_date || wo.status !== 'planned') return false;
    const daysUntil = differenceInDays(parseISO(wo.start_date), new Date());
    return daysUntil >= 0 && daysUntil <= 2;
  };

  const getStatusVariant = (status: string): 'success' | 'warning' | 'info' | 'secondary' | 'destructive' => {
    const variants: Record<string, 'success' | 'warning' | 'info' | 'secondary' | 'destructive'> = {
      planned: 'info',
      in_progress: 'warning',
      completed: 'success',
      on_hold: 'secondary',
      cancelled: 'destructive',
    };
    return variants[status] || 'secondary';
  };

  const renderWorkOrderCard = (wo: WorkOrderWithItems) => {
    const shippingOverdue = isShippingOverdue(wo);
    const shippingApproaching = isShippingApproaching(wo);
    const startOverdue = isStartOverdue(wo);
    const startApproaching = isStartApproaching(wo);
    
    let urgencyClass = '';
    if (shippingOverdue) urgencyClass = 'border-l-destructive bg-destructive/5';
    else if (startOverdue) urgencyClass = 'border-l-warning bg-warning/5';
    else if (shippingApproaching) urgencyClass = 'border-l-warning/50';
    else if (startApproaching) urgencyClass = 'border-l-info/50';
    
    return (
      <div
        key={wo.id}
        className={`group relative rounded-lg border border-l-4 bg-card p-3 md:p-4 transition-all cursor-pointer hover:shadow-md hover:border-primary/30 ${urgencyClass}`}
        onClick={() => navigate(`/production/${wo.id}`)}
        onMouseEnter={() => prefetchProductionOnHover(wo.id)}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono font-semibold text-sm truncate">{wo.wo_number}</span>
            {shippingOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
            {startOverdue && !shippingOverdue && <Clock className="h-3.5 w-3.5 text-warning shrink-0" />}
          </div>
          <Badge variant={getStatusVariant(wo.status)} className="shrink-0">
            {t(wo.status as any)}
          </Badge>
        </div>

        {/* Product badges */}
        <div className="flex flex-wrap gap-1 mb-2">
          {(wo.isMainAssembly || wo.hasSubassemblies) && (
            <Badge variant="outline" className="gap-0.5 text-[10px]">
              <Link2 className="h-2.5 w-2.5" />
              {wo.isMainAssembly ? 'Assembly' : 'Sub'}
            </Badge>
          )}
          {wo.productBreakdown.length > 0
            ? wo.productBreakdown.slice(0, 2).map((item, idx) => (
                <Badge key={idx} variant="secondary" className="text-[10px]">
                  {item.count}× {item.label}
                </Badge>
              ))
            : <span className="text-xs text-muted-foreground">{wo.batch_size} items</span>
          }
          {wo.productBreakdown.length > 2 && (
            <Badge variant="secondary" className="text-[10px]">+{wo.productBreakdown.length - 2}</Badge>
          )}
        </div>

        {/* Details - compact list */}
        <div className="space-y-0.5 text-xs text-muted-foreground">
          {wo.customer_name && (
            <div className="truncate">{wo.customer_name}</div>
          )}
          <div className="flex items-center gap-3">
            {wo.shipping_date && (
              <span className={shippingOverdue ? 'text-destructive font-medium' : ''}>
                {t('ship')}: {formatDate(wo.shipping_date)}
              </span>
            )}
            {wo.order_value && (
              <span className="font-medium text-foreground">€{wo.order_value.toLocaleString('nl-NL')}</span>
            )}
          </div>
        </div>

        {/* Hover actions */}
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/production/${wo.id}`);
            }}
          >
            <Eye className="h-3 w-3 mr-1" />
            {t('view')}
          </Button>
          {isAdmin && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={async (e) => {
                e.stopPropagation();
                if (confirm(t('confirmCancelWorkOrder'))) {
                  try {
                    const { error } = await supabase
                      .from('work_orders')
                      .update({ status: 'cancelled' })
                      .eq('id', wo.id);
                    if (error) throw error;
                    toast.success(t('success'), { description: t('workOrderCancelled') });
                    refetch();
                  } catch (error: any) {
                    toast.error(t('error'), { description: error.message });
                  }
                }
              }}
            >
              {t('cancel')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderTableView = (orders: WorkOrderWithItems[]) => (
    <div className="rounded-lg border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/30 border-b">
            <tr>
              <th className="text-left p-3 font-medium text-xs text-muted-foreground">{t('workOrderNumber')}</th>
              <th className="text-left p-3 font-medium text-xs text-muted-foreground">{t('products')}</th>
              <th className="text-left p-3 font-medium text-xs text-muted-foreground hidden md:table-cell">{t('customer')}</th>
              <th className="text-left p-3 font-medium text-xs text-muted-foreground">{t('status')}</th>
              <th className="text-left p-3 font-medium text-xs text-muted-foreground hidden lg:table-cell">{language === 'nl' ? 'Verzending' : 'Ship'}</th>
              <th className="text-right p-3 font-medium text-xs text-muted-foreground">{t('actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.map((wo) => {
              const shippingOverdue = isShippingOverdue(wo);
              const startOverdue = isStartOverdue(wo);
              return (
                <tr 
                  key={wo.id} 
                  className={`hover:bg-muted/30 cursor-pointer transition-colors ${shippingOverdue ? 'bg-destructive/5' : startOverdue ? 'bg-warning/5' : ''}`}
                  onClick={() => navigate(`/production/${wo.id}`)}
                >
                  <td className="p-3 font-mono font-medium text-sm">
                    <div className="flex items-center gap-2">
                      {shippingOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                      {startOverdue && !shippingOverdue && <Clock className="h-3.5 w-3.5 text-warning shrink-0" />}
                      {wo.wo_number}
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap gap-1">
                      {wo.productBreakdown.length > 0 
                        ? wo.productBreakdown.slice(0, 2).map((item, idx) => (
                            <Badge key={idx} variant="secondary" className="text-[10px]">
                              {item.count}× {item.label}
                            </Badge>
                          ))
                        : <span className="text-muted-foreground text-xs">{wo.batch_size} items</span>
                      }
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground text-xs hidden md:table-cell">{wo.customer_name || '—'}</td>
                  <td className="p-3">
                    <Badge variant={getStatusVariant(wo.status)} className="text-[10px]">{t(wo.status as any)}</Badge>
                  </td>
                  <td className={`p-3 text-xs hidden lg:table-cell ${shippingOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}`}>
                    {wo.shipping_date ? formatDate(wo.shipping_date) : '—'}
                  </td>
                  <td className="p-3 text-right">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-7"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/production/${wo.id}`);
                      }}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-3 lg:space-y-4">
          <PageHeader
            title={t('workOrders')}
            description={t('manageWorkOrders')}
            actions={
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setDialogOpen(true)}
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                {t('createWorkOrder')}
              </Button>
            }
          />

          {/* Filters and Grouping Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <WorkOrderFilters
                filters={filters}
                onFiltersChange={setFilters}
                customers={customers}
                deliveryMonths={deliveryMonths}
                createdMonths={createdMonths}
              />
              {hasActiveFilters && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs text-muted-foreground"
                  onClick={resetFilters}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />
                  {t('reset')}
                </Button>
              )}
            </div>
            
            {/* View Toggle and Grouping */}
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center border rounded-md">
                <Button
                  variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-2 rounded-r-none"
                  onClick={() => setViewMode('cards')}
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-8 px-2 rounded-l-none"
                  onClick={() => setViewMode('table')}
                >
                  <Table className="h-4 w-4" />
                </Button>
              </div>
              
              {/* Grouping Select */}
              <div className="flex items-center gap-2">
                <Layers className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupByOption)}>
                  <SelectTrigger className="h-8 w-[140px] text-xs">
                    <SelectValue placeholder={t('groupBy')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('noGrouping')}</SelectItem>
                    <SelectItem value="status">{t('status')}</SelectItem>
                    <SelectItem value="deliveryMonth">{t('deliveryMonth')}</SelectItem>
                    <SelectItem value="createdMonth">{t('createdMonth')}</SelectItem>
                    <SelectItem value="batchSize">{t('batchSize')}</SelectItem>
                    <SelectItem value="customer">{t('customer')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredOrders.length === 0 ? (
            workOrders.length === 0 ? (
              <Card className="shadow-sm">
                <CardContent className="py-8 text-center">
                  <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-base font-semibold mb-2">{t('noWorkOrdersYet')}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{t('createFirstWorkOrder')}</p>
                  <Button onClick={() => setDialogOpen(true)} variant="default" size="sm">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    {t('createWorkOrder')}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Card className="shadow-sm">
                <CardContent className="py-8 text-center">
                  <Filter className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-sm font-semibold mb-2">{t('noMatchingOrders')}</h3>
                  <p className="text-xs text-muted-foreground mb-4">{t('tryDifferentFilters')}</p>
                  <Button onClick={resetFilters} variant="outline" size="sm">
                    <RotateCcw className="h-3 w-3 mr-1" />
                    {t('clearFilters')}
                  </Button>
                </CardContent>
              </Card>
            )
          ) : groupBy === 'none' ? (
            viewMode === 'cards' ? (
              filteredOrders.length > 50 ? (
                <ResponsiveVirtualizedGrid
                  items={filteredOrders}
                  renderItem={(wo, index) => renderWorkOrderCard(wo)}
                  itemHeight={280}
                  minItemWidth={280}
                  gap={12}
                  maxHeight={700}
                  threshold={50}
                />
              ) : (
                <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                  {filteredOrders.map(renderWorkOrderCard)}
                </div>
              )
            ) : (
              renderTableView(filteredOrders)
            )
          ) : (
            <div className="space-y-2">
              {Object.entries(groupedOrders).sort().map(([groupKey, orders]) => (
                <Collapsible 
                  key={groupKey} 
                  open={expandedGroups.has(groupKey)}
                  onOpenChange={() => toggleGroup(groupKey)}
                >
                  <Card className="shadow-sm">
                    <CollapsibleTrigger className="w-full">
                      <CardHeader className="py-2.5 px-3 flex flex-row items-center justify-between hover:bg-muted/50 transition-colors cursor-pointer">
                        <div className="flex items-center gap-2">
                          {expandedGroups.has(groupKey) ? (
                            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                          )}
                          <CardTitle className="text-xs font-medium">
                            {getGroupLabel(groupKey, groupBy)}
                          </CardTitle>
                          <Badge variant="secondary" className="text-[10px]">
                            {orders.length}
                          </Badge>
                        </div>
                      </CardHeader>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <CardContent className="pt-0 pb-3">
                        {viewMode === 'cards' ? (
                          <div className="grid gap-2 md:gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                            {orders.map(renderWorkOrderCard)}
                          </div>
                        ) : (
                          renderTableView(orders)
                        )}
                      </CardContent>
                    </CollapsibleContent>
                  </Card>
                </Collapsible>
              ))}
            </div>
          )}
        </div>

        <CreateWorkOrderDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen} 
          onSuccess={refetch}
        />
      </Layout>
    </ProtectedRoute>
  );
};

export default WorkOrders;