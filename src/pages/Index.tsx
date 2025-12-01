import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Package, Clock, CheckCircle, AlertCircle, TrendingUp } from 'lucide-react';

const Index = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalWorkOrders: 0,
    inProgress: 0,
    completed: 0,
    onHold: 0,
  });
  const [recentWorkOrders, setRecentWorkOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchDashboardData();
  }, [user, navigate]);

  const fetchDashboardData = async () => {
    try {
      const { data: workOrders } = await supabase
        .from('work_orders')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

      if (workOrders) {
        setRecentWorkOrders(workOrders);
        setStats({
          totalWorkOrders: workOrders.length,
          inProgress: workOrders.filter(wo => wo.status === 'in_progress').length,
          completed: workOrders.filter(wo => wo.status === 'completed').length,
          onHold: workOrders.filter(wo => wo.status === 'on_hold').length,
        });
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      planned: 'bg-status-planned',
      in_progress: 'bg-status-in-progress',
      completed: 'bg-status-completed',
      on_hold: 'bg-status-on-hold',
      cancelled: 'bg-status-cancelled',
    };
    return colors[status] || 'bg-muted';
  };

  if (!user) {
    return null;
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              {t('dashboard')}
            </h1>
            <p className="text-muted-foreground">
              Production overview and statistics
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Work Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.totalWorkOrders}</div>
                <p className="text-xs text-muted-foreground">Active production orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('inProgress')}</CardTitle>
                <Clock className="h-4 w-4 text-warning" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.inProgress}</div>
                <p className="text-xs text-muted-foreground">Currently being processed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('completed')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-success" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.completed}</div>
                <p className="text-xs text-muted-foreground">Finished today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('onHold')}</CardTitle>
                <AlertCircle className="h-4 w-4 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.onHold}</div>
                <p className="text-xs text-muted-foreground">Awaiting action</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Recent Work Orders</CardTitle>
              <CardDescription>Latest production orders in the system</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : recentWorkOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p>No work orders found</p>
                  <Button className="mt-4" onClick={() => navigate('/work-orders')}>
                    {t('createWorkOrder')}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentWorkOrders.map((wo) => (
                    <div
                      key={wo.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/production/${wo.id}`)}
                    >
                      <div className="space-y-1">
                        <p className="font-medium">{wo.wo_number}</p>
                        <p className="text-sm text-muted-foreground">
                          {wo.product_type} • Batch: {wo.batch_size}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(wo.status)} text-white`}>
                        {t(wo.status as any)}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Index;
