import React from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, Clock, TrendingUp, Factory, AlertCircle, RefreshCw } from 'lucide-react';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatsData {
  activeWorkOrders: number;
  totalWorkOrders: number;
  inProgressItems: number;
  completedItems: number;
  totalItems: number;
  totalSteps: number;
}

const defaultStats: StatsData = {
  activeWorkOrders: 0,
  totalWorkOrders: 0,
  inProgressItems: 0,
  completedItems: 0,
  totalItems: 0,
  totalSteps: 0,
};

export function DashboardStats() {
  const { t } = useLanguage();
  
  const { data: stats, loading, error, refetch, isStale } = useResilientQuery<StatsData>({
    queryFn: async () => {
      const [workOrdersResult, itemsResult, stepsResult] = await Promise.all([
        supabase.from('work_orders').select('*', { count: 'exact' }),
        supabase.from('work_order_items').select('*', { count: 'exact' }),
        supabase.from('step_executions').select('*', { count: 'exact' }),
      ]);

      return {
        totalWorkOrders: workOrdersResult.count || 0,
        activeWorkOrders: workOrdersResult.data?.filter((wo) => wo.status === 'in_progress').length || 0,
        inProgressItems: itemsResult.data?.filter((item) => item.status === 'in_progress').length || 0,
        completedItems: itemsResult.data?.filter((item) => item.status === 'completed').length || 0,
        totalItems: itemsResult.count || 0,
        totalSteps: stepsResult.count || 0,
      };
    },
    fallbackData: defaultStats,
    timeout: 10000,
    retryCount: 3,
  });

  const displayStats = stats || defaultStats;

  if (loading) {
    return (
      <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-2 border-b border-border/50">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2">
            <Skeleton className="h-4 w-4" />
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center gap-3 py-2 text-muted-foreground border-b border-border/50">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">Failed to load stats</span>
        <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-3 border-b border-border/50">
      {/* Active Work Orders */}
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">{t('activeWorkOrdersTitle')}:</span>
        <span className="font-semibold tabular-nums tracking-wide">
          {displayStats.activeWorkOrders}
          <span className="text-muted-foreground font-normal">/{displayStats.totalWorkOrders}</span>
        </span>
      </div>

      {/* In Production */}
      <div className="flex items-center gap-2">
        <Factory className="h-4 w-4 text-warning" />
        <span className="text-sm text-muted-foreground">{t('inProduction')}:</span>
        <span className="font-semibold tabular-nums tracking-wide">{displayStats.inProgressItems}</span>
      </div>

      {/* Completed */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-success" />
        <span className="text-sm text-muted-foreground">{t('completedUnits')}:</span>
        <span className="font-semibold tabular-nums tracking-wide">{displayStats.completedItems}</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground">{t('stepExecutions')}:</span>
        <span className="font-semibold tabular-nums tracking-wide">{displayStats.totalSteps}</span>
      </div>

      {isStale && (
        <Button variant="ghost" size="sm" className="h-6 px-2 ml-auto" onClick={() => refetch()}>
          <RefreshCw className="h-3 w-3 mr-1" />
          <span className="text-xs">Refresh</span>
        </Button>
      )}
    </div>
  );
}
