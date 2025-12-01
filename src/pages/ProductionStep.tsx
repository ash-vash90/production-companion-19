import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle, ScanBarcode } from 'lucide-react';
import MeasurementDialog from '@/components/production/MeasurementDialog';
import ChecklistDialog from '@/components/production/ChecklistDialog';
import BatchScanDialog from '@/components/production/BatchScanDialog';

const ProductionStep = () => {
  const { itemId } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [item, setItem] = useState<any>(null);
  const [workOrder, setWorkOrder] = useState<any>(null);
  const [productionSteps, setProductionSteps] = useState<any[]>([]);
  const [currentStep, setCurrentStep] = useState<any>(null);
  const [stepExecution, setStepExecution] = useState<any>(null);
  
  const [showMeasurementDialog, setShowMeasurementDialog] = useState(false);
  const [showChecklistDialog, setShowChecklistDialog] = useState(false);
  const [showBatchScanDialog, setShowBatchScanDialog] = useState(false);

  useEffect(() => {
    if (user && itemId) {
      fetchData();
    }
  }, [user, itemId]);

  const fetchData = async () => {
    try {
      // Fetch work order item
      const { data: itemData, error: itemError } = await supabase
        .from('work_order_items')
        .select('*')
        .eq('id', itemId)
        .single();

      if (itemError) throw itemError;
      setItem(itemData);

      // Fetch work order
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('*')
        .eq('id', itemData.work_order_id)
        .single();

      if (woError) throw woError;
      setWorkOrder(woData);

      // Fetch production steps for this product type
      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select('*')
        .eq('product_type', woData.product_type)
        .order('sort_order', { ascending: true });

      if (stepsError) throw stepsError;
      setProductionSteps(stepsData || []);

      // Find current step
      const current = stepsData?.find(s => s.step_number === itemData.current_step);
      setCurrentStep(current);

      // Check if there's an existing step execution
      if (current) {
        const { data: execData } = await supabase
          .from('step_executions')
          .select('*')
          .eq('work_order_item_id', itemId)
          .eq('production_step_id', current.id)
          .eq('status', 'in_progress')
          .maybeSingle();

        setStepExecution(execData);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('error'), { description: 'Failed to load production data' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartStep = async () => {
    if (!currentStep || !user) return;

    try {
      const { data, error } = await supabase
        .from('step_executions')
        .insert({
          work_order_item_id: itemId,
          production_step_id: currentStep.id,
          status: 'in_progress',
          executed_by: user.id,
          started_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      setStepExecution(data);
      
      // Show appropriate dialog based on step requirements
      if (currentStep.requires_batch_number) {
        setShowBatchScanDialog(true);
      } else if (currentStep.requires_value_input || currentStep.measurement_fields) {
        setShowMeasurementDialog(true);
      } else if (currentStep.has_checklist) {
        setShowChecklistDialog(true);
      }

      toast.success(t('success'), { description: 'Step started' });
    } catch (error: any) {
      console.error('Error starting step:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const handleCompleteStep = async () => {
    if (!stepExecution || !user) return;

    try {
      // Update step execution
      const { error: execError } = await supabase
        .from('step_executions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', stepExecution.id);

      if (execError) throw execError;

      // Move to next step
      const nextStepNumber = item.current_step + 1;
      const { error: itemError } = await supabase
        .from('work_order_items')
        .update({
          current_step: nextStepNumber,
          status: nextStepNumber > productionSteps.length ? 'completed' : 'in_progress',
        })
        .eq('id', itemId);

      if (itemError) throw itemError;

      // Log activity
      await supabase.from('activity_logs').insert({
        user_id: user.id,
        action: 'complete_step',
        entity_type: 'step_execution',
        entity_id: stepExecution.id,
        details: { step_number: item.current_step, serial_number: item.serial_number },
      });

      toast.success(t('success'), { description: 'Step completed' });
      navigate(`/production/${item.work_order_id}`);
    } catch (error: any) {
      console.error('Error completing step:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </Layout>
    );
  }

  if (!item || !workOrder || !currentStep) {
    return (
      <Layout>
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">Production step not found</h3>
          <Button onClick={() => navigate('/work-orders')}>
            Back to Work Orders
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/production/${item.work_order_id}`)} className="h-12 w-12 md:h-10 md:w-10">
            <ArrowLeft className="h-6 w-6 md:h-5 md:w-5" />
          </Button>
          <div className="space-y-1">
            <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-data">{item.serial_number}</h1>
            <p className="text-base md:text-lg text-muted-foreground font-data">
              {workOrder.product_type} • Step {item.current_step} of {productionSteps.length}
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-2xl md:text-xl font-ui">{currentStep.title_en}</span>
              <Badge variant={stepExecution ? 'default' : 'outline'} className="h-10 px-5 text-base md:h-auto md:px-3 md:text-sm self-start">
                {stepExecution ? 'In Progress' : 'Not Started'}
              </Badge>
            </CardTitle>
            <CardDescription className="text-base md:text-sm">
              {currentStep.description_en || 'Follow the instructions to complete this step'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentStep.requires_barcode_scan && (
              <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg border-2">
                <ScanBarcode className="h-6 w-6 text-primary" />
                <span className="text-base font-medium">This step requires barcode scanning</span>
              </div>
            )}

            {!stepExecution ? (
              <Button onClick={handleStartStep} variant="rhosonics" size="lg" className="w-full">
                Start Step
              </Button>
            ) : (
              <div className="space-y-4">
                {currentStep.requires_batch_number && (
                  <Button onClick={() => setShowBatchScanDialog(true)} variant="outline" size="lg" className="w-full">
                    <ScanBarcode className="mr-2" />
                    Scan Materials
                  </Button>
                )}
                
                {(currentStep.requires_value_input || currentStep.measurement_fields) && (
                  <Button onClick={() => setShowMeasurementDialog(true)} variant="outline" size="lg" className="w-full">
                    Enter Measurements
                  </Button>
                )}

                {currentStep.has_checklist && (
                  <Button onClick={() => setShowChecklistDialog(true)} variant="outline" size="lg" className="w-full">
                    Complete Checklist
                  </Button>
                )}

                <Button onClick={handleCompleteStep} variant="rhosonics" size="lg" className="w-full">
                  <CheckCircle2 className="mr-2" />
                  Complete Step
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress indicator */}
        <Card>
          <CardHeader>
            <CardTitle className="font-ui">Progress</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-2">
              {productionSteps.map((step, idx) => (
                <div
                  key={step.id}
                  className={`flex items-center gap-4 md:gap-3 p-4 md:p-3 rounded-lg transition-all ${
                    step.step_number === item.current_step
                      ? 'bg-primary/10 border-2 border-primary'
                      : step.step_number < item.current_step
                      ? 'bg-accent/50 border border-border'
                      : 'bg-muted/30 border border-border'
                  }`}
                >
                  <div className={`flex items-center justify-center h-10 w-10 md:h-8 md:w-8 rounded-full ${
                    step.step_number < item.current_step
                      ? 'bg-primary text-primary-foreground shadow-lg'
                      : step.step_number === item.current_step
                      ? 'bg-primary/20 text-primary border-2 border-primary'
                      : 'bg-muted text-muted-foreground'
                  }`}>
                    {step.step_number < item.current_step ? (
                      <CheckCircle2 className="h-5 w-5 md:h-4 md:w-4" />
                    ) : (
                      <span className="text-base md:text-sm font-bold font-data">{step.step_number}</span>
                    )}
                  </div>
                  <span className="text-base md:text-sm font-medium font-data">{step.title_en}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {stepExecution && currentStep && (
        <>
          <MeasurementDialog
            open={showMeasurementDialog}
            onOpenChange={setShowMeasurementDialog}
            stepExecution={stepExecution}
            productionStep={currentStep}
            onComplete={fetchData}
          />

          <ChecklistDialog
            open={showChecklistDialog}
            onOpenChange={setShowChecklistDialog}
            stepExecution={stepExecution}
            productionStep={currentStep}
            onComplete={fetchData}
          />

          <BatchScanDialog
            open={showBatchScanDialog}
            onOpenChange={setShowBatchScanDialog}
            workOrderItem={item}
            productionStep={currentStep}
            onComplete={fetchData}
          />
        </>
      )}
    </Layout>
  );
};

export default ProductionStep;
