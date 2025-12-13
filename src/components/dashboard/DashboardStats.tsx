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

interface StatItemProps {
  label: string;
  value: number;
  subtext?: string;
  icon: React.ReactNode;
  accentColor?: string;
}

function StatItem({ label, value, subtext, icon, accentColor = 'text-primary' }: StatItemProps) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn("p-2.5 rounded-xl bg-muted/50", accentColor.replace('text-', 'text-opacity-100 '))}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-semibold font-mono tabular-nums">{value}</span>
          {subtext && <span className="text-xs text-muted-foreground">{subtext}</span>}
        </div>
        <p className="text-xs text-muted-foreground truncate">{label}</p>
      </div>
    </div>
  );
}

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
      <div className="grid gap-6 grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <div className="flex items-center justify-center py-6 gap-3 text-muted-foreground">
        <AlertCircle className="h-5 w-5" />
        <span className="text-sm">Failed to load stats</span>
        <Button variant="ghost" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      {isStale && (
        <div className="absolute -top-6 right-0 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3 w-3" />
          <span>Cached</span>
          <Button variant="ghost" size="sm" className="h-5 px-1.5" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )}
      <div className="grid gap-6 sm:gap-8 grid-cols-2 lg:grid-cols-4">
        <StatItem
          label={t('activeWorkOrdersTitle')}
          value={displayStats.activeWorkOrders}
          subtext={`/ ${displayStats.totalWorkOrders}`}
          icon={<Clock className="h-5 w-5 text-primary" />}
          accentColor="text-primary"
        />
        <StatItem
          label={t('inProduction')}
          value={displayStats.inProgressItems}
          subtext={t('itemsActive')}
          icon={<Factory className="h-5 w-5 text-warning" />}
          accentColor="text-warning"
        />
        <StatItem
          label={t('completedUnits')}
          value={displayStats.completedItems}
          icon={<CheckCircle2 className="h-5 w-5 text-success" />}
          accentColor="text-success"
        />
        <StatItem
          label={t('stepExecutions')}
          value={displayStats.totalSteps}
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
          accentColor="text-muted-foreground"
        />
      </div>
    </div>
  );
}
