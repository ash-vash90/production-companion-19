import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface StatsData {
  activeWorkOrders: number;
  totalWorkOrders: number;
  inProgressItems: number;
  completedItems: number;
}

const defaultStats: StatsData = {
  activeWorkOrders: 0,
  totalWorkOrders: 0,
  inProgressItems: 0,
  completedItems: 0,
};

export function DashboardStats() {
  const { t } = useLanguage();
  
  const { data: stats, loading, error, refetch } = useResilientQuery<StatsData>({
    queryFn: async () => {
      const [workOrdersResult, itemsResult] = await Promise.all([
        supabase.from('work_orders').select('status', { count: 'exact' }),
        supabase.from('work_order_items').select('status', { count: 'exact' }),
      ]);

      return {
        totalWorkOrders: workOrdersResult.count || 0,
        activeWorkOrders: workOrdersResult.data?.filter((wo) => wo.status === 'in_progress').length || 0,
        inProgressItems: itemsResult.data?.filter((item) => item.status === 'in_progress').length || 0,
        completedItems: itemsResult.data?.filter((item) => item.status === 'completed').length || 0,
      };
    },
    fallbackData: defaultStats,
    timeout: 8000,
    retryCount: 2,
  });

  const s = stats || defaultStats;

  if (loading) {
    return (
      <div className="flex gap-8 sm:gap-12 flex-wrap">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="space-y-1">
            <Skeleton className="h-8 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" />
        <span>Stats unavailable</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex gap-8 sm:gap-12 flex-wrap">
      <div>
        <div className="text-3xl font-semibold tabular-nums text-primary">{s.activeWorkOrders}</div>
        <div className="text-xs text-muted-foreground">{t('activeWorkOrdersTitle')}</div>
      </div>
      <div>
        <div className="text-3xl font-semibold tabular-nums">{s.inProgressItems}</div>
        <div className="text-xs text-muted-foreground">{t('inProduction')}</div>
      </div>
      <div>
        <div className="text-3xl font-semibold tabular-nums text-success">{s.completedItems}</div>
        <div className="text-xs text-muted-foreground">{t('completedUnits')}</div>
      </div>
      <div>
        <div className="text-3xl font-semibold tabular-nums text-muted-foreground">{s.totalWorkOrders}</div>
        <div className="text-xs text-muted-foreground">Total Orders</div>
      </div>
    </div>
  );
}
