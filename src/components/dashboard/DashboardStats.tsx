import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, Clock, TrendingUp, Factory, AlertCircle, RefreshCw } from 'lucide-react';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

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
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error && !stats) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
          <AlertCircle className="h-8 w-8 text-destructive" />
          <p className="text-sm text-muted-foreground">Failed to load stats</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {isStale && (
        <div className="col-span-full flex items-center justify-center gap-2 text-xs text-muted-foreground py-1">
          <AlertCircle className="h-3 w-3" />
          <span>Showing cached data</span>
          <Button variant="ghost" size="sm" className="h-6 px-2" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3" />
          </Button>
        </div>
      )}
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('activeWorkOrdersTitle')}</CardTitle>
          <Clock className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{displayStats.activeWorkOrders}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('ofTotal').replace('{0}', String(displayStats.totalWorkOrders))}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-accent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('inProduction')}</CardTitle>
          <Factory className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{displayStats.inProgressItems}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('itemsActive')}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-secondary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('completedUnits')}</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{displayStats.completedItems}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('readyForShipment')}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('stepExecutions')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{displayStats.totalSteps}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('qualityCheckpoints')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
