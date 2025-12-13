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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkOrderStatusBadge } from '@/components/workorders/WorkOrderStatusBadge';
import { ProductBreakdownBadges } from '@/components/workorders/ProductBreakdownBadges';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Loader2, ArrowLeft, Package, ClipboardList, Users, Clock, CheckCircle2, XCircle, 
  FileText, Tag, History, Download, Printer, CheckSquare
} from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { formatProductType, getProductBreakdown, formatDate } from '@/lib/utils';

interface ReportData {
  workOrder: {
    id: string;
    wo_number: string;
    product_type: string;
    batch_size: number;
    status: string;
    created_at: string;
    completed_at: string | null;
    start_date: string | null;
    shipping_date: string | null;
    customer_name: string | null;
  };
  items: Array<{
    id: string;
    serial_number: string;
    status: string;
    completed_at: string | null;
    label_printed: boolean;
    label_printed_at: string | null;
    label_printed_by: string | null;
    label_printed_by_name?: string;
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
  certificates: Array<{
    id: string;
    serial_number: string;
    generated_at: string | null;
    generated_by_name: string | null;
    pdf_url: string | null;
  }>;
  checklistResponses: Array<{
    id: string;
    serial_number: string;
    item_text: string;
    checked: boolean;
    checked_at: string | null;
    checked_by_name: string | null;
  }>;
  activityLog: Array<{
    id: string;
    action: string;
    created_at: string;
    user_name: string | null;
    details: any;
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
        .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, start_date, shipping_date, customer_name')
        .eq('id', id)
        .single();

      if (woError) throw woError;

      // Fetch items with label info
      const { data: items, error: itemsError } = await supabase
        .from('work_order_items')
        .select('id, serial_number, status, completed_at, label_printed, label_printed_at, label_printed_by')
        .eq('work_order_id', id)
        .order('position_in_batch', { ascending: true });

      if (itemsError) throw itemsError;

      const itemIds = items?.map(i => i.id) || [];

      // Parallel fetch all related data
      const [
        executionsResult,
        materialsResult,
        certificatesResult,
        checklistResult,
        activityResult
      ] = await Promise.all([
        // Step executions
        itemIds.length > 0 ? supabase
          .from('step_executions')
          .select(`
            id, status, completed_at, measurement_values, validation_status, operator_initials, executed_by, work_order_item_id,
            production_step:production_steps(step_number, title_en, title_nl)
          `)
          .in('work_order_item_id', itemIds)
          .eq('status', 'completed')
          .order('completed_at', { ascending: true }) : { data: [] },
        
        // Batch materials
        itemIds.length > 0 ? supabase
          .from('batch_materials')
          .select('material_type, batch_number, scanned_at, work_order_item_id')
          .in('work_order_item_id', itemIds)
          .order('scanned_at', { ascending: true }) : { data: [] },
        
        // Quality certificates
        itemIds.length > 0 ? supabase
          .from('quality_certificates')
          .select('id, work_order_item_id, generated_at, generated_by, pdf_url')
          .in('work_order_item_id', itemIds) : { data: [] },
        
        // Checklist responses
        itemIds.length > 0 ? supabase
          .from('checklist_responses')
          .select(`
            id, checked, checked_at, checked_by, step_execution_id,
            checklist_item:checklist_items(item_text_en, item_text_nl)
          `)
          .in('step_execution_id', (await supabase
            .from('step_executions')
            .select('id')
            .in('work_order_item_id', itemIds)).data?.map(e => e.id) || []) : { data: [] },
        
        // Activity log
        supabase
          .from('activity_logs')
          .select('id, action, created_at, user_id, details')
          .eq('entity_type', 'work_order')
          .eq('entity_id', id)
          .order('created_at', { ascending: false })
          .limit(50)
      ]);

      // Get all user IDs we need to look up
      const userIds = new Set<string>();
      (executionsResult.data || []).forEach(e => e.executed_by && userIds.add(e.executed_by));
      (certificatesResult.data || []).forEach(c => c.generated_by && userIds.add(c.generated_by));
      (checklistResult.data || []).forEach(c => c.checked_by && userIds.add(c.checked_by));
      (activityResult.data || []).forEach(a => a.user_id && userIds.add(a.user_id));
      (items || []).forEach(i => i.label_printed_by && userIds.add(i.label_printed_by));

      // Fetch all profiles at once
      let profilesMap: Record<string, { full_name: string; avatar_url: string | null }> = {};
      if (userIds.size > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', Array.from(userIds));
        
        for (const p of profiles || []) {
          profilesMap[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
        }
      }

      // Map items to serial numbers
      const itemSerialMap: Record<string, string> = {};
      for (const item of items || []) {
        itemSerialMap[item.id] = item.serial_number;
      }

      // Process step executions
      const stepExecutions = (executionsResult.data || []).map(e => {
        const step = e.production_step as any;
        const operator = e.executed_by ? profilesMap[e.executed_by] : null;
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

      // Process batch materials
      const batchMaterials = (materialsResult.data || []).map(m => ({
        material_type: m.material_type,
        batch_number: m.batch_number,
        serial_number: itemSerialMap[m.work_order_item_id] || 'Unknown',
        scanned_at: m.scanned_at,
      }));

      // Process certificates
      const certificates = (certificatesResult.data || []).map(c => ({
        id: c.id,
        serial_number: itemSerialMap[c.work_order_item_id] || 'Unknown',
        generated_at: c.generated_at,
        generated_by_name: c.generated_by ? profilesMap[c.generated_by]?.full_name || null : null,
        pdf_url: c.pdf_url,
      }));

      // Get step execution IDs for checklist lookup
      const stepExecIds = (executionsResult.data || []).map(e => e.id);
      const stepExecToItem: Record<string, string> = {};
      for (const e of executionsResult.data || []) {
        stepExecToItem[e.id] = e.work_order_item_id;
      }

      // Process checklist responses
      const checklistResponses = (checklistResult.data || []).map(c => {
        const item = c.checklist_item as any;
        return {
          id: c.id,
          serial_number: itemSerialMap[stepExecToItem[c.step_execution_id]] || 'Unknown',
          item_text: language === 'nl' ? item?.item_text_nl : item?.item_text_en || 'Unknown',
          checked: c.checked,
          checked_at: c.checked_at,
          checked_by_name: c.checked_by ? profilesMap[c.checked_by]?.full_name || null : null,
        };
      });

      // Process activity log
      const activityLog = (activityResult.data || []).map(a => ({
        id: a.id,
        action: a.action,
        created_at: a.created_at,
        user_name: a.user_id ? profilesMap[a.user_id]?.full_name || null : null,
        details: a.details,
      }));

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

      // Add label printed by names
      const itemsWithNames = (items || []).map(item => ({
        ...item,
        label_printed_by_name: item.label_printed_by ? profilesMap[item.label_printed_by]?.full_name : undefined,
      }));

      setData({
        workOrder: wo,
        items: itemsWithNames,
        stepExecutions,
        batchMaterials,
        operators: Object.values(operatorStats).sort((a, b) => b.steps_completed - a.steps_completed),
        certificates,
        checklistResponses,
        activityLog,
      });
    } catch (error: any) {
      console.error('Error fetching report:', error);
      toast.error(t('error'), { description: error.message || 'Failed to load report' });
    } finally {
      setLoading(false);
    }
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
  const labelsPrinted = data.items.filter(i => i.label_printed).length;
  const productBreakdown = getProductBreakdown(data.items.map(i => ({ serial_number: i.serial_number })));

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          {/* Back Button */}
          <Button variant="ghost" size="sm" onClick={() => navigate('/production-reports')} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {t('backToReports')}
          </Button>

          {/* Report Header Card */}
          <Card>
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-2xl font-bold">{data.workOrder.wo_number}</CardTitle>
                  <CardDescription className="mt-1">
                    {data.workOrder.customer_name && <span>{data.workOrder.customer_name} • </span>}
                    {t('productionReport')}
                  </CardDescription>
                </div>
                <WorkOrderStatusBadge status={data.workOrder.status} />
              </div>
              <div className="mt-3">
                <ProductBreakdownBadges breakdown={productBreakdown} />
              </div>
            </CardHeader>
          </Card>

          {/* Summary Statistics Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Package className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t('items')}</span>
              </div>
              <p className="text-2xl font-bold">{completedItems}/{data.items.length}</p>
              <p className="text-xs text-muted-foreground">{t('completed')}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-success mb-1">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t('passed')}</span>
              </div>
              <p className="text-2xl font-bold text-success">{passedValidations}</p>
              <p className="text-xs text-muted-foreground">{t('validations')}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-destructive mb-1">
                <XCircle className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t('failed')}</span>
              </div>
              <p className="text-2xl font-bold text-destructive">{failedValidations}</p>
              <p className="text-xs text-muted-foreground">{t('validations')}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-info mb-1">
                <FileText className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t('certificates')}</span>
              </div>
              <p className="text-2xl font-bold">{data.certificates.length}</p>
              <p className="text-xs text-muted-foreground">{t('issued')}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-warning mb-1">
                <Tag className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t('labels')}</span>
              </div>
              <p className="text-2xl font-bold">{labelsPrinted}/{data.items.length}</p>
              <p className="text-xs text-muted-foreground">{t('printed')}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Users className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">{t('operators')}</span>
              </div>
              <p className="text-2xl font-bold">{data.operators.length}</p>
              <p className="text-xs text-muted-foreground">{t('involved')}</p>
            </Card>
          </div>

          {/* Key Dates Card */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                {t('keyDates')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('created')}</p>
                  <p className="font-medium">{formatDate(data.workOrder.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('startDate')}</p>
                  <p className="font-medium">{data.workOrder.start_date ? formatDate(data.workOrder.start_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('shippingDate')}</p>
                  <p className="font-medium">{data.workOrder.shipping_date ? formatDate(data.workOrder.shipping_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">{t('completed')}</p>
                  <p className="font-medium">{data.workOrder.completed_at ? formatDate(data.workOrder.completed_at) : '—'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tabbed Content */}
          <Tabs defaultValue="steps" className="space-y-4">
            <TabsList className="flex-wrap h-auto">
              <TabsTrigger value="steps" className="gap-1">
                <ClipboardList className="h-4 w-4" />
                {t('steps')} ({data.stepExecutions.length})
              </TabsTrigger>
              <TabsTrigger value="materials" className="gap-1">
                <Package className="h-4 w-4" />
                {t('materials')} ({data.batchMaterials.length})
              </TabsTrigger>
              <TabsTrigger value="certificates" className="gap-1">
                <FileText className="h-4 w-4" />
                {t('certificates')} ({data.certificates.length})
              </TabsTrigger>
              <TabsTrigger value="labels" className="gap-1">
                <Tag className="h-4 w-4" />
                {t('labels')} ({labelsPrinted})
              </TabsTrigger>
              <TabsTrigger value="checklists" className="gap-1">
                <CheckSquare className="h-4 w-4" />
                {t('checklists')} ({data.checklistResponses.length})
              </TabsTrigger>
              <TabsTrigger value="operators" className="gap-1">
                <Users className="h-4 w-4" />
                {t('operators')} ({data.operators.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-1">
                <History className="h-4 w-4" />
                {t('activity')} ({data.activityLog.length})
              </TabsTrigger>
            </TabsList>

            {/* Production Steps Tab */}
            <TabsContent value="steps">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('productionSteps')}</CardTitle>
                  <CardDescription>{t('allCompletedStepsForThisOrder')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.stepExecutions.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('noStepsCompleted')}</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.stepExecutions.map((exec) => (
                        <div key={exec.id} className="p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                            <div className="flex items-center gap-3 flex-wrap">
                              <Badge variant="outline" className="font-mono text-xs">
                                {exec.serial_number}
                              </Badge>
                              <span className="font-medium text-sm">
                                {t('step')} {exec.step_number}: {exec.step_title}
                              </span>
                            </div>
                            {exec.validation_status && (
                              <Badge variant={exec.validation_status === 'passed' ? 'success' : exec.validation_status === 'failed' ? 'destructive' : 'secondary'}>
                                {exec.validation_status.toUpperCase()}
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center justify-between text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarImage src={exec.operator_avatar || undefined} />
                                <AvatarFallback className="text-[10px]">
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
                            <div className="mt-3 pt-3 border-t border-dashed text-sm flex flex-wrap gap-x-4 gap-y-1">
                              {Object.entries(exec.measurement_values).map(([key, value]) => (
                                <span key={key} className="text-muted-foreground">
                                  {key}: <span className="font-mono font-medium text-foreground">{String(value)}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Batch Materials Tab */}
            <TabsContent value="materials">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('batchMaterials')}</CardTitle>
                  <CardDescription>{t('materialsScannedDuringProduction')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.batchMaterials.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('noMaterialsScanned')}</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.batchMaterials.map((mat, index) => (
                        <div key={index} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3 flex-wrap">
                            <Badge variant="outline" className="font-mono text-xs">{mat.serial_number}</Badge>
                            <Badge variant="secondary" className="text-xs">{mat.material_type}</Badge>
                            <span className="font-mono font-medium text-sm">{mat.batch_number}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(mat.scanned_at), 'PPp', { locale: dateLocale })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Quality Certificates Tab */}
            <TabsContent value="certificates">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('qualityCertificates')}</CardTitle>
                  <CardDescription>{t('certificatesIssuedForThisOrder')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.certificates.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('noCertificatesGenerated')}</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.certificates.map((cert) => (
                        <div key={cert.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <FileText className="h-4 w-4 text-primary" />
                            <Badge variant="outline" className="font-mono text-xs">{cert.serial_number}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {cert.generated_by_name && `${t('generatedBy')} ${cert.generated_by_name}`}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-muted-foreground">
                              {cert.generated_at && format(new Date(cert.generated_at), 'PPp', { locale: dateLocale })}
                            </span>
                            {cert.pdf_url && (
                              <Button variant="outline" size="sm" asChild>
                                <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer" className="gap-1">
                                  <Download className="h-4 w-4" />
                                  PDF
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Labels Printed Tab */}
            <TabsContent value="labels">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('labelsPrinted')}</CardTitle>
                  <CardDescription>{t('serialNumberLabelsPrinted')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {labelsPrinted === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('noLabelsPrinted')}</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.items.filter(i => i.label_printed).map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            <Printer className="h-4 w-4 text-warning" />
                            <Badge variant="outline" className="font-mono text-xs">{item.serial_number}</Badge>
                            <span className="text-sm text-muted-foreground">
                              {item.label_printed_by_name && `${t('printedBy')} ${item.label_printed_by_name}`}
                            </span>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            {item.label_printed_at && format(new Date(item.label_printed_at), 'PPp', { locale: dateLocale })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Checklist Responses Tab */}
            <TabsContent value="checklists">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('checklistResponses')}</CardTitle>
                  <CardDescription>{t('allChecklistItemsForThisOrder')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.checklistResponses.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('noChecklistResponses')}</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.checklistResponses.map((resp) => (
                        <div key={resp.id} className="flex items-center justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-3">
                            {resp.checked ? (
                              <CheckCircle2 className="h-4 w-4 text-success" />
                            ) : (
                              <XCircle className="h-4 w-4 text-destructive" />
                            )}
                            <Badge variant="outline" className="font-mono text-xs">{resp.serial_number}</Badge>
                            <span className="text-sm">{resp.item_text}</span>
                          </div>
                          <div className="text-sm text-muted-foreground text-right">
                            {resp.checked_by_name && <div>{resp.checked_by_name}</div>}
                            {resp.checked_at && <div>{format(new Date(resp.checked_at), 'PPp', { locale: dateLocale })}</div>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Operators Tab */}
            <TabsContent value="operators">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('operatorsInvolved')}</CardTitle>
                  <CardDescription>{t('teamMembersWhoWorkedOnThisOrder')}</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.operators.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('noOperators')}</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {data.operators.map((op) => (
                        <div key={op.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
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
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Activity Log Tab */}
            <TabsContent value="activity">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{t('activityLog')}</CardTitle>
                  <CardDescription>{t('chronologicalHistoryOfActions')}</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {data.activityLog.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">{t('noActivity')}</p>
                  ) : (
                    <div className="divide-y divide-border">
                      {data.activityLog.map((log) => (
                        <div key={log.id} className="flex items-start justify-between p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start gap-3">
                            <History className="h-4 w-4 text-muted-foreground mt-0.5" />
                            <div>
                              <span className="font-medium text-sm">{log.action}</span>
                              {log.user_name && (
                                <span className="text-sm text-muted-foreground ml-2">by {log.user_name}</span>
                              )}
                              {log.details && typeof log.details === 'object' && (
                                <div className="text-xs text-muted-foreground mt-1 font-mono">
                                  {JSON.stringify(log.details).slice(0, 100)}...
                                </div>
                              )}
                            </div>
                          </div>
                          <span className="text-sm text-muted-foreground whitespace-nowrap">
                            {format(new Date(log.created_at), 'PPp', { locale: dateLocale })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionReportDetail;
