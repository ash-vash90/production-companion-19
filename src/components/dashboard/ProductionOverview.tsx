import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getProductBreakdown, formatProductBreakdownText, ProductBreakdown } from '@/lib/utils';
import { ExternalLink, Plus, Eye, AlertCircle, RefreshCw, Package } from 'lucide-react';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

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

  const { data: workOrders, loading, error, refetch, isStale } =
    useResilientQuery<WorkOrderWithItems[]>({
      queryFn: async () => {
        const { data: workOrdersData, error: woError } = await supabase
          .from('work_orders')
          .select('id, wo_number, product_type, batch_size, status, created_at, created_by')
          .in('status', ['planned', 'in_progress'])
          .order('created_at', { ascending: false })
          .limit(10);

        if (woError) throw woError;

        const woIds = workOrdersData?.map((wo) => wo.id) || [];

        const [itemsRes, profilesRes] = await Promise.all([
          woIds.length > 0
            ? supabase
                .from('work_order_items')
                .select('work_order_id, serial_number')
                .in('work_order_id', woIds)
            : { data: [] },
          (() => {
            const creatorIds = [
              ...new Set(workOrdersData?.map((wo) => wo.created_by).filter(Boolean) || []),
            ];
            return creatorIds.length > 0
              ? supabase
                  .from('profiles')
                  .select('id, full_name')
                  .in('id', creatorIds)
              : { data: [] };
          })(),
        ]);

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

        return (workOrdersData || []).map((wo) => ({
          ...wo,
          profiles:
            wo.created_by && profilesMap[wo.created_by]
              ? { full_name: profilesMap[wo.created_by] }
              : null,
          productBreakdown: getProductBreakdown(itemsMap[wo.id] || []),
        })) as WorkOrderWithItems[];
      },
      fallbackData: [],
      timeout: 12000,
      retryCount: 3,
    });

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
        },
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const getStatusVariant = useCallback(
    (
      status: string,
    ): 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline' => {
      const variants: Record<
        string,
        'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'
      > = {
        planned: 'info',
        in_progress: 'warning',
        completed: 'success',
        on_hold: 'secondary',
        cancelled: 'destructive',
      };
      return variants[status] || 'secondary';
    },
    [],
  );

  const getStatusLabel = useCallback(
    (status: string) => {
      if (status === 'in_progress') return t('inProgressStatus');
      if (status === 'planned') return t('planned');
      if (status === 'completed') return t('completed');
      if (status === 'on_hold') return t('onHold');
      if (status === 'cancelled') return t('cancelled');
      return status;
    },
    [t],
  );

  const { displayedOrders, inProgressCount, plannedCount } = useMemo(() => {
    const orders = workOrders || [];
    const inProgress = orders.filter((wo) => wo.status === 'in_progress');
    const planned = orders.filter((wo) => wo.status === 'planned');
    return {
      displayedOrders: showAll ? orders : inProgress,
      inProgressCount: inProgress.length,
      plannedCount: planned.length,
    };
  }, [workOrders, showAll]);

  if (loading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Package className="h-4 w-4 text-warning" />
            </div>
            <h2 className="font-semibold text-sm">{t('activeWorkOrdersTitle')}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 py-3">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-32 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && (!workOrders || workOrders.length === 0)) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10">
              <Package className="h-4 w-4 text-warning" />
            </div>
            <h2 className="font-semibold text-sm">{t('activeWorkOrdersTitle')}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-center py-6 gap-3 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Failed to load work orders</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-xl border bg-card overflow-hidden">
        {/* Section Header */}
        <div className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-warning/10">
                <Package className="h-4 w-4 text-warning" />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-semibold text-sm">{t('activeWorkOrdersTitle')}</h2>
                <Badge variant="warning" className="text-xs">{inProgressCount}</Badge>
                {plannedCount > 0 && !showAll && (
                  <span className="text-xs text-muted-foreground">
                    +{plannedCount} {language === 'nl' ? 'gepland' : 'planned'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isStale && (
                <Button variant="ghost" size="sm" className="h-7" onClick={() => refetch()}>
                  <RefreshCw className="h-3 w-3" />
                </Button>
              )}
              {(plannedCount > 0 || showAll) && (
                <Button variant="ghost" size="sm" onClick={() => setShowAll(!showAll)}>
                  <Eye className="h-4 w-4 mr-1.5" />
                  {showAll
                    ? language === 'nl' ? 'Actief' : 'Active'
                    : language === 'nl' ? 'Alles' : 'All'}
                </Button>
              )}
              <Button variant="default" size="sm" onClick={() => setDialogOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {language === 'nl' ? 'Nieuw' : 'New'}
              </Button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-5">
          {displayedOrders.length > 0 ? (
            <div className="space-y-2">
              {displayedOrders.map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/production/${wo.id}`)}
                  className="group flex items-center gap-3 p-3 cursor-pointer rounded-lg border border-border bg-background hover:border-primary/30 hover:shadow-sm transition-all"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-sm">{wo.wo_number}</span>
                      <Badge variant={getStatusVariant(wo.status)} className="text-[10px]">
                        {getStatusLabel(wo.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground truncate">
                      {wo.productBreakdown.length > 0
                        ? formatProductBreakdownText(wo.productBreakdown)
                        : `${wo.batch_size} items`}
                      {wo.profiles?.full_name && (
                        <span className="ml-2 opacity-70">• {wo.profiles.full_name}</span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 rounded-full bg-muted/50 mb-3">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                {showAll
                  ? t('noActiveWorkOrders')
                  : language === 'nl'
                    ? 'Geen actieve werkorders'
                    : 'No work orders in progress'}
              </p>
            </div>
          )}
        </div>
      </div>

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
