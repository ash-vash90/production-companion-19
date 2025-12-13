import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getProductBreakdown, formatProductBreakdownText, ProductBreakdown } from '@/lib/utils';
import { ExternalLink, Plus, Eye, AlertCircle, RefreshCw } from 'lucide-react';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkOrderWithItems {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
  productBreakdown: ProductBreakdown[];
}

export function ProductionOverview() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { data: workOrders, loading, error, refetch, isStale } = useResilientQuery<WorkOrderWithItems[]>({
    queryFn: async () => {
      // Fetch work orders with minimal data
      const { data: workOrdersData, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, created_by')
        .in('status', ['planned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (woError) throw woError;

      const woIds = workOrdersData?.map(wo => wo.id) || [];
      
      // Run parallel fetches for items and profiles
      const [itemsRes, profilesRes] = await Promise.all([
        woIds.length > 0 
          ? supabase
              .from('work_order_items')
              .select('work_order_id, serial_number')
              .in('work_order_id', woIds)
          : { data: [] },
        (() => {
          const creatorIds = [...new Set(workOrdersData?.map(wo => wo.created_by).filter(Boolean) || [])];
          return creatorIds.length > 0
            ? supabase
                .from('profiles')
                .select('id, full_name')
                .in('id', creatorIds)
            : { data: [] };
        })()
      ]);

      // Build lookup maps
      const itemsMap: Record<string, Array<{ serial_number: string }>> = {};
      for (const item of itemsRes.data || []) {
        if (!itemsMap[item.work_order_id]) {
          itemsMap[item.work_order_id] = [];
        }
        itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
      }

      const profilesMap = (profilesRes.data || []).reduce((acc, p) => {
        acc[p.id] = p.full_name;
        return acc;
      }, {} as Record<string, string>);

      // Merge data
      return (workOrdersData || []).map(wo => ({
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] 
          ? { full_name: profilesMap[wo.created_by] } 
          : null,
        productBreakdown: getProductBreakdown(itemsMap[wo.id] || [])
      })) as WorkOrderWithItems[];
    },
    fallbackData: [],
    timeout: 12000,
    retryCount: 3,
  });

  // Set up realtime subscription separately for updates
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel('production-overview-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders' },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            refetch();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const getStatusVariant = useCallback((status: string): 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'> = {
      planned: 'info',
      in_progress: 'warning',
      completed: 'success',
      on_hold: 'secondary',
      cancelled: 'destructive',
    };
    return variants[status] || 'secondary';
  }, []);

  const getStatusLabel = useCallback((status: string) => {
    if (status === 'in_progress') return t('inProgressStatus');
    if (status === 'planned') return t('planned');
    if (status === 'completed') return t('completed');
    if (status === 'on_hold') return t('onHold');
    if (status === 'cancelled') return t('cancelled');
    return status;
  }, [t]);

  // Memoize displayed orders and counts
  const { displayedOrders, inProgressCount, plannedCount } = useMemo(() => {
    const orders = workOrders || [];
    const inProgress = orders.filter(wo => wo.status === 'in_progress');
    const planned = orders.filter(wo => wo.status === 'planned');
    return {
      displayedOrders: showAll ? orders : inProgress,
      inProgressCount: inProgress.length,
      plannedCount: planned.length,
    };
  }, [workOrders, showAll]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('activeWorkOrdersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-4" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && (!workOrders || workOrders.length === 0)) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('activeWorkOrdersTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Failed to load work orders</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="w-full">
        <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0 pb-3 sm:pb-4 px-3 sm:px-6">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <CardTitle className="text-sm sm:text-base">{t('activeWorkOrdersTitle')}</CardTitle>
            <Badge variant="warning" className="text-xs">{inProgressCount}</Badge>
            {plannedCount > 0 && !showAll && (
              <span className="text-xs sm:text-sm text-muted-foreground">
                +{plannedCount} {language === 'nl' ? 'gepland' : 'planned'}
              </span>
            )}
            {isStale && (
              <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => refetch()}>
                <RefreshCw className="h-3 w-3" />
              </Button>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
            {(plannedCount > 0 || showAll) && (
              <Button 
                variant="ghost" 
                size="sm"
                className="text-xs sm:text-sm h-8"
                onClick={() => setShowAll(!showAll)}
              >
                <Eye className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1" />
                {showAll ? (language === 'nl' ? 'Actief' : 'Active') : (language === 'nl' ? 'Alles' : 'All')}
              </Button>
            )}
            <Button variant="default" size="sm" className="text-xs sm:text-sm h-8 ml-auto sm:ml-0" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">{t('createWorkOrder')}</span>
              <span className="sm:hidden">{language === 'nl' ? 'Nieuw' : 'New'}</span>
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          {displayedOrders.length > 0 ? (
            <div className="space-y-1.5 sm:space-y-2">
              {displayedOrders.map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/production/${wo.id}`)}
                  className="flex items-center justify-between rounded-lg border bg-card p-2 sm:p-3 transition-all cursor-pointer hover:bg-accent/50 hover:border-primary/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-semibold">{wo.wo_number}</span>
                      <Badge variant={getStatusVariant(wo.status)} className="text-[10px] sm:text-xs">
                        {getStatusLabel(wo.status)}
                      </Badge>
                    </div>
                    <div className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted-foreground truncate">
                      {wo.productBreakdown.length > 0 
                        ? formatProductBreakdownText(wo.productBreakdown)
                        : `${wo.batch_size} items`
                      }
                      {wo.profiles?.full_name && (
                        <span className="ml-1.5 sm:ml-2 opacity-70 hidden sm:inline">• {wo.profiles.full_name}</span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-muted-foreground shrink-0 ml-2 sm:ml-3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-4 sm:py-8 text-center text-xs sm:text-sm text-muted-foreground">
              {showAll ? t('noActiveWorkOrders') : (language === 'nl' ? 'Geen actieve werkorders' : 'No work orders in progress')}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateWorkOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          refetch();
        }}
      />
    </>
  );
}
