import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getProductBreakdown, formatProductBreakdownText } from '@/lib/utils';
import { Plus, ChevronRight, Package } from 'lucide-react';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkOrder {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  customer_name?: string;
  profiles?: { full_name: string } | null;
  productBreakdown: { label: string; count: number; type: string }[];
}

export function ProductionOverview() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const { data: workOrders, loading, refetch } = useResilientQuery<WorkOrder[]>({
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, customer_name, created_by')
        .in('status', ['planned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(12);

      if (error) throw error;

      const ids = data?.map(w => w.id) || [];
      const creatorIds = [...new Set(data?.map(w => w.created_by).filter(Boolean) || [])];

      const [itemsRes, profilesRes] = await Promise.all([
        ids.length ? supabase.from('work_order_items').select('work_order_id, serial_number').in('work_order_id', ids) : { data: [] },
        creatorIds.length ? supabase.from('profiles').select('id, full_name').in('id', creatorIds) : { data: [] },
      ]);

      const itemsMap: Record<string, { serial_number: string }[]> = {};
      (itemsRes.data || []).forEach(i => {
        if (!itemsMap[i.work_order_id]) itemsMap[i.work_order_id] = [];
        itemsMap[i.work_order_id].push({ serial_number: i.serial_number });
      });

      const profilesMap: Record<string, string> = {};
      (profilesRes.data || []).forEach(p => { profilesMap[p.id] = p.full_name; });

      return (data || []).map(wo => ({
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] ? { full_name: profilesMap[wo.created_by] } : null,
        productBreakdown: getProductBreakdown(itemsMap[wo.id] || []),
      }));
    },
    fallbackData: [],
    timeout: 10000,
    retryCount: 2,
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const channel = supabase
      .channel('prod-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        clearTimeout(timer);
        timer = setTimeout(refetch, 500);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [refetch]);

  const { displayed, activeCount, plannedCount } = useMemo(() => {
    const list = workOrders || [];
    const active = list.filter(w => w.status === 'in_progress');
    const planned = list.filter(w => w.status === 'planned');
    return {
      displayed: showAll ? list : active,
      activeCount: active.length,
      plannedCount: planned.length,
    };
  }, [workOrders, showAll]);

  return (
    <>
      <div>
        {/* Section header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Package className="h-4 w-4" />
            {t('activeWorkOrdersTitle')}
            <Badge variant="warning" className="ml-1">{activeCount}</Badge>
            {plannedCount > 0 && !showAll && (
              <span className="text-xs font-normal normal-case">+{plannedCount} planned</span>
            )}
          </h2>
          <div className="flex items-center gap-2">
            {(plannedCount > 0 || showAll) && (
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setShowAll(!showAll)}>
                {showAll ? 'Active only' : 'Show all'}
              </Button>
            )}
            <Button size="sm" className="h-7" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              New
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="flex items-center gap-3 py-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-3 w-32 ml-auto" />
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6">
            {language === 'nl' ? 'Geen actieve werkorders' : 'No active work orders'}
          </p>
        ) : (
          <div className="space-y-1">
            {displayed.map((wo) => (
              <button
                key={wo.id}
                onClick={() => navigate(`/production/${wo.id}`)}
                className="w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-md text-left transition-colors hover:bg-muted/50 group"
              >
                <span className="font-mono text-sm font-medium">{wo.wo_number}</span>
                <Badge variant={wo.status === 'in_progress' ? 'warning' : 'info'} className="text-[10px]">
                  {wo.status === 'in_progress' ? 'Active' : 'Planned'}
                </Badge>
                <span className="text-xs text-muted-foreground truncate hidden sm:block">
                  {formatProductBreakdownText(wo.productBreakdown) || `${wo.batch_size} items`}
                </span>
                {wo.customer_name && (
                  <span className="text-xs text-muted-foreground ml-auto truncate hidden md:block">
                    {wo.customer_name}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 shrink-0" />
              </button>
            ))}
          </div>
        )}

        <Button
          variant="link"
          size="sm"
          className="px-0 mt-3 text-muted-foreground hover:text-foreground"
          onClick={() => navigate('/work-orders')}
        >
          View all work orders →
        </Button>
      </div>

      <CreateWorkOrderDialog open={dialogOpen} onOpenChange={setDialogOpen} onSuccess={refetch} />
    </>
  );
}
