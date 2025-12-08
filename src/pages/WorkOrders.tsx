import React, { useEffect, useState, useMemo } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { getProductBreakdown, ProductBreakdown, formatDate } from '@/lib/utils';
import { Loader2, Plus, Package, Filter, Eye, AlertTriangle, ChevronDown, ChevronRight, Layers, RotateCcw } from 'lucide-react';
import { format, differenceInDays, parseISO, isBefore } from 'date-fns';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface WorkOrderWithItems {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  scheduled_date: string | null;
  customer_name: string | null;
  external_order_number: string | null;
  order_value: number | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
  productBreakdown: ProductBreakdown[];
}

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

const WorkOrders = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { isAdmin } = useUserProfile();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [workOrders, setWorkOrders] = useState<WorkOrderWithItems[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  
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
  
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  // Persist filters to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters));
  }, [filters]);

  // Persist groupBy to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(GROUPBY_STORAGE_KEY, groupBy);
  }, [groupBy]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchWorkOrders();
  }, [user, navigate]);

  const fetchWorkOrders = async () => {
    try {
      const { data: workOrdersData, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, created_by, customer_name, external_order_number, order_value, scheduled_date')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: false });

      if (woError) throw woError;

      const woIds = workOrdersData?.map(wo => wo.id) || [];
      
      let itemsMap: Record<string, Array<{ serial_number: string }>> = {};
      if (woIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('work_order_items')
          .select('work_order_id, serial_number')
          .in('work_order_id', woIds);
        
        for (const item of itemsData || []) {
          if (!itemsMap[item.work_order_id]) {
            itemsMap[item.work_order_id] = [];
          }
          itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
        }
      }

      const creatorIds = [...new Set(workOrdersData?.map(wo => wo.created_by).filter(Boolean) || [])];
      let profilesMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', creatorIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          return acc;
        }, {} as Record<string, { full_name: string; avatar_url: string | null }>);
      }

      const enrichedData = (workOrdersData || []).map(wo => ({
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] 
          ? profilesMap[wo.created_by] 
          : null,
        productBreakdown: getProductBreakdown(itemsMap[wo.id] || [])
      }));

      setWorkOrders(enrichedData as WorkOrderWithItems[]);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error(t('error'), { description: t('failedLoadWorkOrders') });
    } finally {
      setLoading(false);
    }
  };

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
      if (wo.scheduled_date) {
        months.add(format(parseISO(wo.scheduled_date), 'yyyy-MM'));
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
        if (!wo.scheduled_date) return false;
        return format(parseISO(wo.scheduled_date), 'yyyy-MM') === filters.deliveryMonthFilter;
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
      case 'deliveryMonth': return wo.scheduled_date ? format(parseISO(wo.scheduled_date), 'yyyy-MM') : 'unscheduled';
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

  const isOverdue = (wo: WorkOrderWithItems): boolean => {
    if (!wo.scheduled_date || wo.status === 'completed') return false;
    return isBefore(parseISO(wo.scheduled_date), new Date());
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
    const overdue = isOverdue(wo);
    
    return (
      <Card
        key={wo.id}
        className={`hover:shadow-md transition-all border flex flex-col max-w-xs ${overdue ? 'border-destructive/50 bg-destructive/5' : ''}`}
      >
        <CardHeader className="pb-2 p-3 lg:p-4">
          <div className="flex items-center justify-between mb-2 gap-2">
            <CardTitle className="text-sm font-data truncate">{wo.wo_number}</CardTitle>
            <div className="flex items-center gap-1.5 shrink-0">
              {overdue && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('overdue')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
              <Badge variant={getStatusVariant(wo.status)}>
                {t(wo.status as any)}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-1">
            {wo.productBreakdown.length > 0 
              ? wo.productBreakdown.map((item, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {item.count}× {item.label}
                  </Badge>
                ))
              : <span className="text-xs text-muted-foreground">{wo.batch_size} items</span>
            }
          </div>
        </CardHeader>
        <CardContent className="p-3 lg:p-4 pt-0 flex-1 flex flex-col">
          <div className="space-y-1.5 text-xs lg:text-sm flex-1">
            {wo.customer_name && (
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('customer')}:</span>
                <span className="font-medium truncate ml-2 max-w-[120px]">{wo.customer_name}</span>
              </div>
            )}
            {wo.external_order_number && (
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('orderNumber')}:</span>
                <span className="font-medium font-data">{wo.external_order_number}</span>
              </div>
            )}
            {wo.order_value && (
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">{t('value')}:</span>
                <span className="font-semibold">€{wo.order_value.toLocaleString('nl-NL', { minimumFractionDigits: 2 })}</span>
              </div>
            )}
            {wo.scheduled_date && (
              <div className={`flex justify-between items-center py-1 ${overdue ? 'text-destructive' : ''}`}>
                <span className="text-muted-foreground">{t('scheduledDate')}:</span>
                <span className="font-medium">{formatDate(wo.scheduled_date)}</span>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-3 pt-3 border-t">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => navigate(`/production/${wo.id}`)}
            >
              <Eye className="h-4 w-4 mr-1.5" />
              {t('view')}
            </Button>
            {isAdmin && (
              <Button
                variant="destructive"
                size="sm"
                className="flex-1"
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
                      fetchWorkOrders();
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
        </CardContent>
      </Card>
    );
  };

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
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
              {filteredOrders.map(renderWorkOrderCard)}
            </div>
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
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
                          {orders.map(renderWorkOrderCard)}
                        </div>
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
          onSuccess={fetchWorkOrders}
        />
      </Layout>
    </ProtectedRoute>
  );
};

export default WorkOrders;