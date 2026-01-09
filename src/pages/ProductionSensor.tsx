import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { StepStatusIndicator, getStepStatusClasses } from '@/components/ui/step-status-indicator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CheckCircle2, Clock, AlertCircle } from 'lucide-react';

const isUuid = (value?: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value ?? "");

const ProductionSensor = () => {
  const { itemId } = useParams();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [productionSteps, setProductionSteps] = useState<any[]>([]);

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (!itemId || !isUuid(itemId)) {
      console.error('Invalid itemId:', itemId);
      navigate('/work-orders');
      return;
    }

    fetchData();
  }, [user, itemId, navigate]);

  const fetchData = async () => {
    try {
      const { data: itemData, error: itemError } = await supabase
        .from('work_order_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (itemError) throw itemError;
      setItem(itemData);

      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', itemData.work_order_id)
        .single();

      if (woError) throw woError;
      setWorkOrder(woData);

      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select('*')
        .eq('product_type', 'SENSOR')
        .order('sort_order', { ascending: true });

      if (stepsError) throw stepsError;
      setProductionSteps(stepsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('error'), { description: t('failedLoadProduction') });
    } finally {
      setLoading(false);
    }
  };

  const getStepStatus = (stepNumber: number) => {
    if (stepNumber < item.current_step) return 'completed';
    if (stepNumber === item.current_step) return 'current';
    return 'pending';
  };

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

  if (!item || !workOrder) {
    return (
      <ProtectedRoute>
        <Layout>
          <div className="text-center py-12">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">Item not found</h3>
            <Button onClick={() => navigate('/work-orders')}>
              Back to Work Orders
            </Button>
          </div>
        </Layout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/production/${workOrder.id}`)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{item.serial_number}</h1>
              <p className="text-lg text-muted-foreground">
                Sensor Production • Step {item.current_step} of {productionSteps.length}
              </p>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Production Workflow</CardTitle>
              <CardDescription>Sensor assembly and quality control steps</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {productionSteps.map((step) => {
                  const status = getStepStatus(step.step_number);
                  return (
                    <div
                      key={step.id}
                      className={`flex items-center gap-4 p-4 rounded-lg border-2 transition-all ${
                        status === 'current'
                          ? 'border-status-in-progress-foreground/50 bg-status-in-progress/20'
                          : status === 'completed'
                          ? 'border-status-completed-foreground/50 bg-status-completed/20'
                          : 'border-border bg-muted/30'
                      }`}
                      onClick={() => status === 'current' && navigate(`/production/step/${item.id}`)}
                      style={{ cursor: status === 'current' ? 'pointer' : 'default' }}
                    >
                      <div className={`flex items-center justify-center h-10 w-10 rounded-full ${
                        status === 'completed'
                          ? 'bg-status-completed text-status-completed-foreground'
                          : status === 'current'
                          ? 'bg-status-in-progress text-status-in-progress-foreground'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        {status === 'completed' ? (
                          <CheckCircle2 className="h-5 w-5" />
                        ) : status === 'current' ? (
                          <Clock className="h-5 w-5" />
                        ) : (
                          <span className="text-sm font-bold">{step.step_number}</span>
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">
                          {language === 'nl' ? step.title_nl : step.title_en}
                        </div>
                        {(language === 'nl' ? step.description_nl : step.description_en) && (
                          <div className="text-sm text-muted-foreground">
                            {language === 'nl' ? step.description_nl : step.description_en}
                          </div>
                        )}
                      </div>
                      {status === 'current' && (
                        <StepStatusIndicator status="current" size="sm" language={language as 'en' | 'nl'} />
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </ProtectedRoute>
  );
};

export default ProductionSensor;
