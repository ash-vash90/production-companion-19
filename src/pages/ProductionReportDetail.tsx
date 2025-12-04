import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, Package, ClipboardList, Users, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { formatProductType } from '@/lib/utils';

interface ReportData {
  workOrder: {
    id: string;
    wo_number: string;
    product_type: string;
    batch_size: number;
    status: string;
    created_at: string;
    completed_at: string | null;
    scheduled_date: string | null;
  };
  items: Array<{
    id: string;
    serial_number: string;
    status: string;
    completed_at: string | null;
  }>;
  stepExecutions: Array<{
    id: string;
    step_number: number;
    step_title: string;
    status: string;
    operator_name: string;
    operator_avatar: string | null;
    operator_initials: string | null;
    completed_at: string | null;
    measurement_values: Record<string, unknown>;
    validation_status: string | null;
    serial_number: string;
  }>;
  batchMaterials: Array<{
    material_type: string;
    batch_number: string;
    serial_number: string;
    scanned_at: string;
  }>;
  operators: Array<{
    id: string;
    full_name: string;
    avatar_url: string | null;
    steps_completed: number;
  }>;
}

const ProductionReportDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ReportData | null>(null);

  const dateLocale = language === 'nl' ? nl : enUS;

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    if (id) {
      fetchReportData();
    }
  }, [user, id, navigate]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Fetch work order
      const { data: wo, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, scheduled_date')
        .eq('id', id)
        .single();

      if (woError) throw woError;

      // Fetch items
      const { data: items, error: itemsError } = await supabase
        .from('work_order_items')
        .select('id, serial_number, status, completed_at')
        .eq('work_order_id', id)
        .order('position_in_batch', { ascending: true });

      if (itemsError) throw itemsError;

      const itemIds = items?.map(i => i.id) || [];

      // Fetch step executions with operator info
      let stepExecutions: ReportData['stepExecutions'] = [];
      if (itemIds.length > 0) {
        const { data: executions, error: execError } = await supabase
          .from('step_executions')
          .select(`
            id,
            status,
            completed_at,
            measurement_values,
            validation_status,
            operator_initials,
            executed_by,
            work_order_item_id,
            production_step:production_steps(step_number, title_en, title_nl)
          `)
          .in('work_order_item_id', itemIds)
          .eq('status', 'completed')
          .order('completed_at', { ascending: true });

        if (execError) throw execError;

        // Get operator profiles
        const operatorIds = [...new Set((executions || []).map(e => e.executed_by).filter(Boolean))];
        let operatorMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
        
        if (operatorIds.length > 0) {
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .in('id', operatorIds);
          
          for (const p of profiles || []) {
            operatorMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
          }
        }

        // Map items to serial numbers
        const itemSerialMap: Record<string, string> = {};
        for (const item of items || []) {
          itemSerialMap[item.id] = item.serial_number;
        }

        stepExecutions = (executions || []).map(e => {
          const step = e.production_step as any;
          const operator = e.executed_by ? operatorMap[e.executed_by] : null;
          const measurementVals = typeof e.measurement_values === 'object' && e.measurement_values !== null && !Array.isArray(e.measurement_values)
            ? e.measurement_values as Record<string, unknown>
            : {};
          return {
            id: e.id,
            step_number: step?.step_number || 0,
            step_title: language === 'nl' ? step?.title_nl : step?.title_en || 'Unknown',
            status: e.status,
            operator_name: operator?.full_name || 'Unknown',
            operator_avatar: operator?.avatar_url || null,
            operator_initials: e.operator_initials || null,
            completed_at: e.completed_at,
            measurement_values: measurementVals,
            validation_status: e.validation_status,
            serial_number: itemSerialMap[e.work_order_item_id] || 'Unknown',
          };
        });
      }

      // Fetch batch materials
      let batchMaterials: ReportData['batchMaterials'] = [];
      if (itemIds.length > 0) {
        const { data: materials, error: matError } = await supabase
          .from('batch_materials')
          .select('material_type, batch_number, scanned_at, work_order_item_id')
          .in('work_order_item_id', itemIds)
          .order('scanned_at', { ascending: true });

        if (matError) throw matError;

        const itemSerialMap: Record<string, string> = {};
        for (const item of items || []) {
          itemSerialMap[item.id] = item.serial_number;
        }

        batchMaterials = (materials || []).map(m => ({
          material_type: m.material_type,
          batch_number: m.batch_number,
          serial_number: itemSerialMap[m.work_order_item_id] || 'Unknown',
          scanned_at: m.scanned_at,
        }));
      }

      // Calculate operator stats
      const operatorStats: Record<string, { id: string; full_name: string; avatar_url: string | null; steps_completed: number }> = {};
      for (const exec of stepExecutions) {
        const key = exec.operator_name;
        if (!operatorStats[key]) {
          operatorStats[key] = {
            id: key,
            full_name: exec.operator_name,
            avatar_url: exec.operator_avatar,
            steps_completed: 0,
          };
        }
        operatorStats[key].steps_completed++;
      }

      setData({
        workOrder: wo,
        items: items || [],
        stepExecutions,
        batchMaterials,
        operators: Object.values(operatorStats).sort((a, b) => b.steps_completed - a.steps_completed),
      });
    } catch (error: any) {
      console.error('Error fetching report:', error);
      toast.error(t('error'), { description: error.message || 'Failed to load report' });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'planned': return 'bg-info text-info-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  if (!user) return null;

  if (loading) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  if (!data) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">{t('workOrderNotFound')}</h3>
            <Button onClick={() => navigate('/production-reports')}>
              {t('backToWorkOrders')}
            </Button>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  const completedItems = data.items.filter(i => i.status === 'completed').length;
  const passedValidations = data.stepExecutions.filter(e => e.validation_status === 'passed').length;
  const failedValidations = data.stepExecutions.filter(e => e.validation_status === 'failed').length;

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/production-reports')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <PageHeader 
                title={`${t('productionReport')}: ${data.workOrder.wo_number}`}
                description={`${formatProductType(data.workOrder.product_type)} • ${data.workOrder.batch_size} ${t('units')}`}
              />
            </div>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Package className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedItems}/{data.items.length}</p>
                    <p className="text-sm text-muted-foreground">{t('itemsCompleted')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{passedValidations}</p>
                    <p className="text-sm text-muted-foreground">{t('passedValidations')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                    <XCircle className="h-5 w-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{failedValidations}</p>
                    <p className="text-sm text-muted-foreground">{t('failedValidations')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-info/10 flex items-center justify-center">
                    <Users className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{data.operators.length}</p>
                    <p className="text-sm text-muted-foreground">{t('operatorsInvolved')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Work Order Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                {t('workOrderDetails')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">{t('status')}</p>
                  <Badge className={getStatusBadgeClass(data.workOrder.status)}>
                    {formatStatus(data.workOrder.status)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('created')}</p>
                  <p className="font-medium">{format(new Date(data.workOrder.created_at), 'PPP', { locale: dateLocale })}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('scheduledDate')}</p>
                  <p className="font-medium">
                    {data.workOrder.scheduled_date 
                      ? format(new Date(data.workOrder.scheduled_date), 'PPP', { locale: dateLocale })
                      : '-'
                    }
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('completed')}</p>
                  <p className="font-medium">
                    {data.workOrder.completed_at 
                      ? format(new Date(data.workOrder.completed_at), 'PPP', { locale: dateLocale })
                      : '-'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operators */}
          {data.operators.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  {t('operatorsInvolved')}
                </CardTitle>
                <CardDescription>{t('operatorsWhoWorkedOnOrder')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4">
                  {data.operators.map((op) => (
                    <div key={op.id} className="flex items-center gap-3 p-3 border rounded-lg">
                      <Avatar className="h-10 w-10">
                        <AvatarImage src={op.avatar_url || undefined} />
                        <AvatarFallback>{getInitials(op.full_name)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">{op.full_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {op.steps_completed} {t('stepsCompleted')}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step Executions */}
          {data.stepExecutions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ClipboardList className="h-5 w-5" />
                  {t('productionSteps')}
                </CardTitle>
                <CardDescription>{t('allCompletedSteps')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data.stepExecutions.map((exec) => (
                    <div key={exec.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-3">
                          <Badge variant="outline" className="font-mono">
                            {exec.serial_number}
                          </Badge>
                          <span className="font-medium">
                            {t('step')} {exec.step_number}: {exec.step_title}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {exec.validation_status && (
                            <Badge className={
                              exec.validation_status === 'passed' 
                                ? 'bg-success text-success-foreground' 
                                : exec.validation_status === 'failed'
                                ? 'bg-destructive text-destructive-foreground'
                                : 'bg-muted text-muted-foreground'
                            }>
                              {exec.validation_status.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={exec.operator_avatar || undefined} />
                            <AvatarFallback className="text-xs">
                              {exec.operator_initials || getInitials(exec.operator_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{exec.operator_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {exec.completed_at && format(new Date(exec.completed_at), 'PPp', { locale: dateLocale })}
                        </div>
                      </div>
                      {Object.keys(exec.measurement_values).length > 0 && (
                        <div className="mt-2 pt-2 border-t text-sm">
                          {Object.entries(exec.measurement_values).map(([key, value]) => (
                            <span key={key} className="mr-4">
                              {key}: <span className="font-mono font-medium">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Batch Materials */}
          {data.batchMaterials.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  {t('batchMaterials')}
                </CardTitle>
                <CardDescription>{t('materialsUsedInProduction')}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {data.batchMaterials.map((mat, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Badge variant="outline" className="font-mono">{mat.serial_number}</Badge>
                        <Badge variant="secondary">{mat.material_type}</Badge>
                        <span className="font-mono font-medium">{mat.batch_number}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">
                        {format(new Date(mat.scanned_at), 'PPp', { locale: dateLocale })}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReportDetail;
