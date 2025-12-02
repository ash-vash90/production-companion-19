import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, Clock, TrendingUp, Factory, Loader2 } from 'lucide-react';

export function DashboardStats() {
  const { t } = useLanguage();
  const [stats, setStats] = useState({
    activeWorkOrders: 0,
    totalWorkOrders: 0,
    inProgressItems: 0,
    completedItems: 0,
    totalItems: 0,
    totalSteps: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const [workOrdersResult, itemsResult, stepsResult] = await Promise.all([
        supabase.from('work_orders').select('*', { count: 'exact' }),
        supabase.from('work_order_items').select('*', { count: 'exact' }),
        supabase.from('step_executions').select('*', { count: 'exact' }),
      ]);

      setStats({
        totalWorkOrders: workOrdersResult.count || 0,
        activeWorkOrders: workOrdersResult.data?.filter((wo) => wo.status === 'in_progress').length || 0,
        inProgressItems: itemsResult.data?.filter((item) => item.status === 'in_progress').length || 0,
        completedItems: itemsResult.data?.filter((item) => item.status === 'completed').length || 0,
        totalItems: itemsResult.count || 0,
        totalSteps: stepsResult.count || 0,
      });
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="flex justify-center items-center h-32">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card className="border-l-4 border-l-primary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('activeWorkOrdersTitle')}</CardTitle>
          <Clock className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{stats.activeWorkOrders}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('ofTotal').replace('{0}', String(stats.totalWorkOrders))}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-accent">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('inProduction')}</CardTitle>
          <Factory className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{stats.inProgressItems}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('itemsActive')}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-secondary">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('completedUnits')}</CardTitle>
          <CheckCircle2 className="h-4 w-4 text-secondary" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{stats.completedItems}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('readyForShipment')}</p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-muted">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{t('stepExecutions')}</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold font-mono">{stats.totalSteps}</div>
          <p className="mt-1 text-xs text-muted-foreground">{t('qualityCheckpoints')}</p>
        </CardContent>
      </Card>
    </div>
  );
}
