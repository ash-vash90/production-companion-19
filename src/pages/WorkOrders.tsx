import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { WorkOrderFilters, FilterState, GroupByOption } from '@/components/workorders/WorkOrderFilters';
import { WorkOrderCard } from '@/components/workorders/WorkOrderCard';
import { WorkOrderTableRow, WorkOrderRowData } from '@/components/workorders/WorkOrderTableRow';
import { WorkOrderKanbanView } from '@/components/workorders/WorkOrderKanbanView';
import { CancelWorkOrderDialog } from '@/components/workorders/CancelWorkOrderDialog';
import { BulkActionsToolbar } from '@/components/workorders/BulkActionsToolbar';
import { useWorkOrders, invalidateWorkOrdersCache, WorkOrderListItem } from '@/hooks/useWorkOrders';
import { prefetchProductionOnHover } from '@/services/prefetchService';
import { ResponsiveVirtualizedGrid } from '@/components/VirtualizedList';
import { PullToRefresh } from '@/components/PullToRefresh';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { Plus, Package, RotateCcw, LayoutGrid, List, ChevronDown, ChevronRight, Columns, CheckSquare, Square } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { format, differenceInDays, parseISO } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDebounce } from '@/hooks/useDebounce';

// Type alias for backwards compatibility
type WorkOrderWithItems = WorkOrderListItem;

// GroupByOption is now imported from WorkOrderFilters

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

type ViewMode = 'cards' | 'table' | 'kanban';

interface ViewPreferences {
  work_orders?: {
    viewMode?: ViewMode;
    groupBy?: GroupByOption;
    filters?: FilterState;
  };
}

const WorkOrders = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isAdmin } = useUserProfile();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingWorkOrder, setCancellingWorkOrder] = useState<{ id: string; wo_number: string } | null>(null);
  const [cancellingWorkOrders, setCancellingWorkOrders] = useState<Array<{ id: string; wo_number: string }>>([]);
  const [isCancelling, setIsCancelling] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  
  // Use the resilient work orders hook - disable realtime to reduce memory/subscriptions
  const { workOrders, loading, error, refetch } = useWorkOrders({
    excludeCancelled: true,
    enableRealtime: false,
  });
  
  // Track if component is mounted to prevent state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);
  
  // Load persisted filters from sessionStorage (fallback)
  const [filters, setFilters] = useState<FilterState>(() => {
    try {
      const saved = sessionStorage.getItem(FILTERS_STORAGE_KEY);
      return saved ? JSON.parse(saved) : DEFAULT_FILTERS;
    } catch {
      return DEFAULT_FILTERS;
    }
  });
  
  // Load persisted groupBy from sessionStorage (fallback)
  const [groupBy, setGroupBy] = useState<GroupByOption>(() => {
    try {
      const saved = sessionStorage.getItem(GROUPBY_STORAGE_KEY);
      return (saved as GroupByOption) || 'none';
    } catch {
      return 'none';
    }
  });
  
  // Load persisted viewMode from localStorage (fallback)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEWMODE_STORAGE_KEY);
      return (saved as ViewMode) || 'cards';
    } catch {
      return 'cards';
    }
  });
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Load view preferences from database on mount
  useEffect(() => {
    const loadPrefsFromDB = async () => {
      if (!user?.id) return;
      try {
        // Use raw query to bypass type checking for new column
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (error || !data) return;
        
        // Cast to access the view_preferences column
        const prefs = (data as any).view_preferences as ViewPreferences | null;
        if (prefs?.work_orders) {
          if (prefs.work_orders.viewMode) setViewMode(prefs.work_orders.viewMode);
          if (prefs.work_orders.groupBy) setGroupBy(prefs.work_orders.groupBy);
          if (prefs.work_orders.filters) setFilters(prefs.work_orders.filters);
        }
      } catch (e) {
        console.warn('Failed to load view preferences:', e);
      } finally {
        setPrefsLoaded(true);
      }
    };
    
    loadPrefsFromDB();
  }, [user?.id]);

  // Debounce preferences for saving
  const debouncedPrefs = useDebounce({ viewMode, groupBy, filters }, 1000);

  // Save view preferences to database
  useEffect(() => {
    if (!user?.id || !prefsLoaded) return;
    
    const savePrefsToDb = async () => {
      try {
        // First get existing preferences
        const { data: existingData } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        const existing = ((existingData as any)?.view_preferences as ViewPreferences) || {};
        
        const updated: ViewPreferences = {
          ...existing,
          work_orders: {
            viewMode: debouncedPrefs.viewMode,
            groupBy: debouncedPrefs.groupBy,
            filters: debouncedPrefs.filters,
          }
        };
        
        // Use update with type assertion
        await supabase
          .from('profiles')
          .update({ view_preferences: updated } as any)
          .eq('id', user.id);
      } catch (e) {
        console.warn('Failed to save view preferences:', e);
      }
    };
    
    savePrefsToDb();
  }, [debouncedPrefs, user?.id, prefsLoaded]);

  // Also persist to local storage as fallback
  useEffect(() => {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  useEffect(() => {
    sessionStorage.setItem(GROUPBY_STORAGE_KEY, groupBy);
  }, [groupBy]);

  useEffect(() => {
    localStorage.setItem(VIEWMODE_STORAGE_KEY, viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
    }
  }, [user, navigate]);

  // Reset all filters
  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
    setGroupBy('none');
    setSelectedIds(new Set());
  }, []);

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

  // Open cancel dialog
  const openCancelDialog = useCallback((workOrder: { id: string; wo_number: string }) => {
    setCancellingWorkOrder(workOrder);
    setCancellingWorkOrders([]);
    setCancelDialogOpen(true);
  }, []);

  // Open bulk cancel dialog
  const openBulkCancelDialog = useCallback((workOrders: Array<{ id: string; wo_number: string }>) => {
    setCancellingWorkOrder(null);
    setCancellingWorkOrders(workOrders);
    setCancelDialogOpen(true);
  }, []);

  // Handle cancel work order with reason
  const handleCancelWorkOrder = useCallback(async (reason: string) => {
    const idsToCancel = cancellingWorkOrder 
      ? [cancellingWorkOrder.id] 
      : cancellingWorkOrders.map(wo => wo.id);
    
    if (idsToCancel.length === 0) return;
    
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ 
          status: 'cancelled',
          cancellation_reason: reason 
        })
        .in('id', idsToCancel);
      if (error) throw error;
      toast.success(t('success'), { 
        description: idsToCancel.length > 1 
          ? `${idsToCancel.length} work orders cancelled`
          : t('workOrderCancelled') 
      });
      setCancelDialogOpen(false);
      setCancellingWorkOrder(null);
      setCancellingWorkOrders([]);
      setSelectedIds(new Set());
      if (isMountedRef.current) refetch();
    } catch (error: any) {
      toast.error(t('error'), { description: error.message });
    } finally {
      setIsCancelling(false);
    }
  }, [cancellingWorkOrder, cancellingWorkOrders, t, refetch]);

  // Selection handlers
  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectedWorkOrders = useMemo(() => {
    return filteredOrders
      .filter(wo => selectedIds.has(wo.id))
      .map(wo => ({ id: wo.id, wo_number: wo.wo_number, status: wo.status }));
  }, [filteredOrders, selectedIds]);

  // Transform work order to row data format
  const toRowData = useCallback((wo: WorkOrderWithItems): WorkOrderRowData => ({
    id: wo.id,
    wo_number: wo.wo_number,
    product_type: wo.product_type,
    batch_size: wo.batch_size,
    status: wo.status,
    created_at: wo.created_at,
    customer_name: wo.customer_name,
    shipping_date: wo.shipping_date,
    start_date: wo.start_date,
    order_value: wo.order_value,
    productBreakdown: wo.productBreakdown,
    progressPercent: wo.progressPercent,
  }), []);

  // Handle status change with optimistic update
  const handleStatusChange = useCallback((workOrderId: string, newStatus: string) => {
    // Invalidate cache and refetch
    invalidateWorkOrdersCache();
    refetch();
  }, [refetch]);

  // Render table view with shared component
  const renderTableView = (orders: WorkOrderWithItems[]) => {
    const allSelected = orders.length > 0 && orders.every(wo => selectedIds.has(wo.id));
    const someSelected = orders.some(wo => selectedIds.has(wo.id));

    const toggleAllInView = () => {
      if (allSelected) {
        // Deselect all in current view
        setSelectedIds(prev => {
          const next = new Set(prev);
          orders.forEach(wo => next.delete(wo.id));
          return next;
        });
      } else {
        // Select all in current view
        setSelectedIds(prev => {
          const next = new Set(prev);
          orders.forEach(wo => next.add(wo.id));
          return next;
        });
      }
    };

    return (
      <div className="rounded-lg border overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  ref={(el) => {
                    if (el) (el as any).indeterminate = someSelected && !allSelected;
                  }}
                  onCheckedChange={toggleAllInView}
                  className="h-4 w-4"
                />
              </TableHead>
              <TableHead className="text-xs">{t('workOrderNumber')}</TableHead>
              <TableHead className="text-xs">{t('products')}</TableHead>
              <TableHead className="text-xs hidden md:table-cell">{t('customer')}</TableHead>
              <TableHead className="text-xs">{t('status')}</TableHead>
              <TableHead className="text-xs hidden lg:table-cell">{t('dates')}</TableHead>
              <TableHead className="text-xs hidden xl:table-cell">{t('price')}</TableHead>
              <TableHead className="text-xs hidden sm:table-cell">{t('progress')}</TableHead>
              <TableHead className="text-xs text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((wo) => (
              <WorkOrderTableRow
                key={wo.id}
                workOrder={toRowData(wo)}
                linkTo={`/production/${wo.id}`}
                onCancel={isAdmin ? () => openCancelDialog({ id: wo.id, wo_number: wo.wo_number }) : undefined}
                onStatusChange={() => handleStatusChange(wo.id, wo.status)}
                editableStatus={isAdmin}
                showProgress
                showPrice
                selectable
                selected={selectedIds.has(wo.id)}
                onSelectionChange={() => toggleSelection(wo.id)}
              />
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  // Render card view with shared component
  const renderCardView = useCallback((orders: WorkOrderWithItems[]) => (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {orders.map((wo) => (
        <WorkOrderCard
          key={wo.id}
          workOrder={toRowData(wo)}
          onClick={() => navigate(`/production/${wo.id}`)}
          onCancel={isAdmin ? () => openCancelDialog({ id: wo.id, wo_number: wo.wo_number }) : undefined}
          onHover={() => prefetchProductionOnHover(wo.id)}
          onStatusChange={() => handleStatusChange(wo.id, wo.status)}
          selectable
          selected={selectedIds.has(wo.id)}
          onSelectionChange={() => toggleSelection(wo.id)}
        />
      ))}
    </div>
  ), [toRowData, navigate, isAdmin, openCancelDialog, handleStatusChange, selectedIds, toggleSelection]);

  const isMobile = useIsMobile();

  // Pull to refresh handler
  const handlePullRefresh = useCallback(async () => {
    invalidateWorkOrdersCache();
    await refetch();
    toast.success(t('refreshed') || 'Refreshed');
  }, [refetch, t]);

  return (
    <ProtectedRoute>
      <Layout>
        <PullToRefresh 
          onRefresh={handlePullRefresh} 
          disabled={!isMobile || loading}
          className="h-full"
        >
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
                groupBy={groupBy}
                onGroupByChange={(v) => setGroupBy(v)}
                hideGroupBy={viewMode === 'kanban'}
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
            
            {/* View Toggle */}
            <div className="flex items-center border rounded-md">
              <Button
                variant={viewMode === 'cards' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2 rounded-r-none"
                onClick={() => setViewMode('cards')}
                title={t('cardView') || 'Card View'}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'table' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2 rounded-none border-x"
                onClick={() => setViewMode('table')}
                title={t('tableView') || 'Table View'}
              >
                <List className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'kanban' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-8 px-2 rounded-l-none"
                onClick={() => setViewMode('kanban')}
                title={t('kanbanView') || 'Kanban View'}
              >
                <Columns className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Select All Bar */}
          {!loading && filteredOrders.length > 0 && viewMode !== 'kanban' && (
            <div className="flex items-center justify-between py-2 px-1">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 gap-2 text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (selectedIds.size === filteredOrders.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(filteredOrders.map(wo => wo.id)));
                    }
                  }}
                >
                  {selectedIds.size === filteredOrders.length ? (
                    <>
                      <CheckSquare className="h-4 w-4" />
                      {t('deselectAll') || 'Deselect All'}
                    </>
                  ) : (
                    <>
                      <Square className="h-4 w-4" />
                      {t('selectAll') || 'Select All'}
                    </>
                  )}
                </Button>
                {selectedIds.size > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} of {filteredOrders.length} {t('selected') || 'selected'}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Work Orders List */}
          <div className="w-full">
            {loading ? (
              viewMode === 'cards' ? (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {[...Array(6)].map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <Skeleton className="h-5 w-24" />
                          <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                        <Skeleton className="h-4 w-32" />
                        <div className="flex gap-2">
                          <Skeleton className="h-6 w-16 rounded-full" />
                          <Skeleton className="h-6 w-12 rounded-full" />
                        </div>
                        <div className="flex items-center gap-4 pt-2">
                          <Skeleton className="h-4 w-20" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                        <Skeleton className="h-2 w-full rounded-full" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="w-10"><Skeleton className="h-4 w-4" /></TableHead>
                        <TableHead className="text-xs">{t('workOrderNumber')}</TableHead>
                        <TableHead className="text-xs">{t('products')}</TableHead>
                        <TableHead className="text-xs hidden md:table-cell">{t('customer')}</TableHead>
                        <TableHead className="text-xs">{t('status')}</TableHead>
                        <TableHead className="text-xs hidden lg:table-cell">{t('dates')}</TableHead>
                        <TableHead className="text-xs hidden xl:table-cell">{t('price')}</TableHead>
                        <TableHead className="text-xs hidden sm:table-cell">{t('progress')}</TableHead>
                        <TableHead className="text-xs text-right">{t('actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...Array(6)].map((_, i) => (
                        <TableRow key={i}>
                          <TableCell><Skeleton className="h-4 w-4" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                          <TableCell><div className="flex gap-1"><Skeleton className="h-5 w-16 rounded-full" /><Skeleton className="h-5 w-8 rounded-full" /></div></TableCell>
                          <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
                          <TableCell><Skeleton className="h-5 w-20 rounded-full" /></TableCell>
                          <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-32" /></TableCell>
                          <TableCell className="hidden xl:table-cell"><Skeleton className="h-4 w-16" /></TableCell>
                          <TableCell className="hidden sm:table-cell"><Skeleton className="h-2 w-24 rounded-full" /></TableCell>
                          <TableCell className="text-right"><Skeleton className="h-8 w-8 rounded-md ml-auto" /></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )
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
                    <Package className="h-10 w-10 mx-auto mb-4 text-muted-foreground/50" />
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
              viewMode === 'kanban' ? (
                <WorkOrderKanbanView
                  workOrders={filteredOrders.map(toRowData)}
                  onStatusChange={() => {
                    invalidateWorkOrdersCache();
                    refetch();
                  }}
                  onCancel={isAdmin ? openCancelDialog : undefined}
                />
              ) : viewMode === 'cards' ? (
                filteredOrders.length > 50 ? (
                  <ResponsiveVirtualizedGrid
                    items={filteredOrders}
                    renderItem={(wo) => (
                      <WorkOrderCard
                        workOrder={toRowData(wo)}
                        onClick={() => navigate(`/production/${wo.id}`)}
                        onCancel={isAdmin ? () => openCancelDialog({ id: wo.id, wo_number: wo.wo_number }) : undefined}
                        onHover={() => prefetchProductionOnHover(wo.id)}
                        onStatusChange={() => handleStatusChange(wo.id, wo.status)}
                        selectable
                        selected={selectedIds.has(wo.id)}
                        onSelectionChange={() => toggleSelection(wo.id)}
                      />
                    )}
                    itemHeight={280}
                    minItemWidth={300}
                    gap={12}
                    maxHeight={700}
                    threshold={50}
                  />
                ) : (
                  renderCardView(filteredOrders)
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
                            renderCardView(orders)
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
        </div>
        </PullToRefresh>

        <CreateWorkOrderDialog 
          open={dialogOpen} 
          onOpenChange={setDialogOpen} 
          onSuccess={refetch}
        />

        <CancelWorkOrderDialog
          open={cancelDialogOpen}
          onOpenChange={(open) => {
            setCancelDialogOpen(open);
            if (!open) {
              setCancellingWorkOrder(null);
              setCancellingWorkOrders([]);
            }
          }}
          woNumber={
            cancellingWorkOrder?.wo_number || 
            (cancellingWorkOrders.length > 0 
              ? `${cancellingWorkOrders.length} work orders`
              : '')
          }
          onConfirm={handleCancelWorkOrder}
          isLoading={isCancelling}
        />

        <BulkActionsToolbar
          selectedIds={Array.from(selectedIds)}
          selectedWorkOrders={selectedWorkOrders}
          onClearSelection={clearSelection}
          onRefresh={refetch}
          onRequestCancel={isAdmin ? openBulkCancelDialog : undefined}
        />
      </Layout>
    </ProtectedRoute>
  );
};

export default WorkOrders;
