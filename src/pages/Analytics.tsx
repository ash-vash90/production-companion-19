import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, TrendingUp, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const Analytics = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<any>({
    completionRate: 0,
    avgTimePerStep: 0,
    totalCompleted: 0,
    totalFailed: 0,
  });
  const [completionTrend, setCompletionTrend] = useState<any[]>([]);
  const [stepPerformance, setStepPerformance] = useState<any[]>([]);
  const [statusDistribution, setStatusDistribution] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchAnalytics();
  }, [user, navigate]);

  const fetchAnalytics = async () => {
    try {
      // Fetch work order items for completion metrics
      const { data: items } = await supabase
        .from('work_order_items')
        .select('status, completed_at, created_at');

      // Fetch step executions for timing data
      const { data: executions } = await supabase
        .from('step_executions')
        .select('status, validation_status, started_at, completed_at, production_step:production_steps(title_en, step_number)')
        .order('completed_at', { ascending: false })
        .limit(1000);

      if (items) {
        const completed = items.filter(i => i.status === 'completed').length;
        const total = items.length;
        const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

        // Calculate status distribution
        const statusCounts = items.reduce((acc: any, item) => {
          acc[item.status] = (acc[item.status] || 0) + 1;
          return acc;
        }, {});

        const statusData = Object.entries(statusCounts).map(([status, count]) => ({
          name: t(status as any) || status,
          value: count as number,
        }));

        setStatusDistribution(statusData);
        setMetrics(prev => ({ ...prev, completionRate, totalCompleted: completed }));

        // Calculate completion trend over last 30 days
        const last30Days = Array.from({ length: 30 }, (_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (29 - i));
          return date.toISOString().split('T')[0];
        });

        const trendData = last30Days.map(date => {
          const completedOnDate = items.filter(i => 
            i.completed_at && i.completed_at.startsWith(date)
          ).length;
          return {
            date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
            completed: completedOnDate,
          };
        });

        setCompletionTrend(trendData);
      }

      if (executions) {
        // Calculate average time per step
        const completedExecs = executions.filter(e => 
          e.status === 'completed' && e.started_at && e.completed_at
        );

        if (completedExecs.length > 0) {
          const totalTime = completedExecs.reduce((sum, exec) => {
            const start = new Date(exec.started_at!);
            const end = new Date(exec.completed_at!);
            return sum + (end.getTime() - start.getTime());
          }, 0);
          const avgTime = Math.round(totalTime / completedExecs.length / 1000 / 60); // minutes
          setMetrics(prev => ({ ...prev, avgTimePerStep: avgTime }));
        }

        // Calculate step performance
        const stepStats: any = {};
        executions.forEach(exec => {
          if (exec.production_step) {
            const key = `${exec.production_step.step_number}. ${exec.production_step.title_en}`;
            if (!stepStats[key]) {
              stepStats[key] = { completed: 0, failed: 0 };
            }
            if (exec.validation_status === 'failed') {
              stepStats[key].failed++;
            } else if (exec.status === 'completed') {
              stepStats[key].completed++;
            }
          }
        });

        const stepData = Object.entries(stepStats)
          .slice(0, 10)
          .map(([step, stats]: [string, any]) => ({
            step: step.length > 20 ? step.substring(0, 20) + '...' : step,
            completed: stats.completed,
            failed: stats.failed,
          }));

        setStepPerformance(stepData);

        const totalFailed = executions.filter(e => e.validation_status === 'failed').length;
        setMetrics(prev => ({ ...prev, totalFailed }));
      }
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const COLORS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  if (!user) return null;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t('analytics')}</h1>
            <p className="text-muted-foreground">{t('analyticsDescription')}</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('completionRate')}</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.completionRate}%</div>
                    <p className="text-xs text-muted-foreground mt-1">{t('ofAllItems')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('avgTimePerStep')}</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.avgTimePerStep} {t('min')}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t('averageTime')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('totalCompleted')}</CardTitle>
                    <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalCompleted}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t('itemsCompleted')}</p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{t('failedValidations')}</CardTitle>
                    <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{metrics.totalFailed}</div>
                    <p className="text-xs text-muted-foreground mt-1">{t('validationsFailed')}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>{t('completionTrend')}</CardTitle>
                    <CardDescription>{t('last30Days')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={completionTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} name={t('completed')} />
                      </LineChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>{t('statusDistribution')}</CardTitle>
                    <CardDescription>{t('currentStatus')}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={statusDistribution}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {statusDistribution.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t('stepPerformance')}</CardTitle>
                  <CardDescription>{t('topStepsByActivity')}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={stepPerformance}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="step" angle={-45} textAnchor="end" height={100} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="completed" fill="#22c55e" name={t('completed')} />
                      <Bar dataKey="failed" fill="#ef4444" name={t('failed')} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default Analytics;
