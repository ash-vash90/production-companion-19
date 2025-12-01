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
        .neq('status', 'cancelled')
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
      planned: 'bg-secondary text-secondary-foreground',
      in_progress: 'bg-primary text-primary-foreground',
      completed: 'bg-accent text-accent-foreground',
      on_hold: 'bg-muted text-muted-foreground',
      cancelled: 'bg-destructive text-destructive-foreground',
    };
    return colors[status] || 'bg-muted';
  };

  if (!user) {
    return null;
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6 md:space-y-8">
          <div className="space-y-2">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {t('dashboard')}
            </h1>
            <p className="text-base md:text-lg text-muted-foreground">
              Production overview and statistics
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-data">{stats.totalWorkOrders}</div>
                <p className="text-xs text-muted-foreground mt-1">Active production orders</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('inProgress')}</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-data">{stats.inProgress}</div>
                <p className="text-xs text-muted-foreground mt-1">Currently processing</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('completed')}</CardTitle>
                <CheckCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-data">{stats.completed}</div>
                <p className="text-xs text-muted-foreground mt-1">Finished today</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t('onHold')}</CardTitle>
                <AlertCircle className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-data">{stats.onHold}</div>
                <p className="text-xs text-muted-foreground mt-1">Awaiting action</p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Recent Work Orders</CardTitle>
                  <CardDescription>Latest production orders in the system</CardDescription>
                </div>
                <Button variant="default" onClick={() => navigate('/work-orders')}>
                  {t('createWorkOrder')}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-10 w-10 md:h-8 md:w-8 animate-spin text-primary" />
                </div>
              ) : recentWorkOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground/50" />
                  <p className="text-lg mb-4">No work orders found</p>
                </div>
              ) : (
                <div className="space-y-3 md:space-y-4">
                  {recentWorkOrders.map((wo) => (
                    <div
                      key={wo.id}
                      className="flex items-center justify-between p-5 md:p-4 border-2 rounded-lg hover:bg-accent/50 hover:border-primary cursor-pointer transition-all active:scale-98"
                      onClick={() => navigate(`/production/${wo.id}`)}
                    >
                      <div className="space-y-1.5 md:space-y-1">
                        <p className="font-medium text-lg md:text-base font-data">{wo.wo_number}</p>
                        <p className="text-base md:text-sm text-muted-foreground">
                          {wo.product_type} • Batch: {wo.batch_size}
                        </p>
                      </div>
                      <Badge className={`${getStatusColor(wo.status)} text-white h-8 px-4 text-sm md:h-auto md:px-3 md:text-xs`}>
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
