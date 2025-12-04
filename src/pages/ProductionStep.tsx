import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import Layout from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle, ScanBarcode, History, XCircle, Users } from 'lucide-react';
import MeasurementDialog from '@/components/production/MeasurementDialog';
import ChecklistDialog from '@/components/production/ChecklistDialog';
import BatchScanDialog from '@/components/production/BatchScanDialog';
import ValidationHistoryDialog from '@/components/production/ValidationHistoryDialog';
import { generateQualityCertificate } from '@/services/certificateService';

interface PresenceUser {
  id: string;
  name: string;
  online_at: string;
}

interface StepCompletionInfo {
  step_number: number;
  completed_by_name: string;
  completed_at: string;
  operator_initials: string | null;
  avatar_url: string | null;
}

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
  const [showValidationHistory, setShowValidationHistory] = useState(false);
  const [failedSteps, setFailedSteps] = useState<Set<number>>(new Set());
  const [stepCompletions, setStepCompletions] = useState<Map<number, StepCompletionInfo>>(new Map());
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);

  // Fetch current user profile
  useEffect(() => {
    if (user) {
      supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
        .then(({ data }) => {
          setCurrentUserProfile(data);
        });
    }
  }, [user]);

  // Set up real-time presence
  useEffect(() => {
    if (!user || !itemId || !currentUserProfile) return;

    const channel = supabase.channel(`item-presence-${itemId}`);

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        Object.values(state).forEach((presences: any) => {
          presences.forEach((presence: any) => {
            if (presence.id !== user.id) {
              users.push(presence);
            }
          });
        });
        setPresentUsers(users);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: user.id,
            name: currentUserProfile.full_name,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, itemId, currentUserProfile]);

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
      
      // Block access to cancelled work orders
      if (woData.status === 'cancelled') {
        toast.error(t('error'), { description: t('workOrderCancelledAccess') });
        navigate('/work-orders');
        return;
      }
      
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
      } else {
        setStepExecution(null);
      }

      // Fetch completed step executions
      const { data: completedExecs } = await supabase
        .from('step_executions')
        .select(`
          *,
          production_step:production_steps(step_number)
        `)
        .eq('work_order_item_id', itemId)
        .eq('status', 'completed');

      if (completedExecs && completedExecs.length > 0) {
        // Fetch profiles for executors
        const executorIds = [...new Set(completedExecs.map((e: any) => e.executed_by).filter(Boolean))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', executorIds);
        
        const profileMap = new Map(profiles?.map(p => [p.id, { name: p.full_name, avatar_url: p.avatar_url }]) || []);
        
        const completionsMap = new Map<number, StepCompletionInfo>();
        completedExecs.forEach((exec: any) => {
          const stepNumber = exec.production_step?.step_number;
          if (stepNumber) {
            // Keep the most recent completion for each step
            const existing = completionsMap.get(stepNumber);
            if (!existing || new Date(exec.completed_at) > new Date(existing.completed_at)) {
              const profile = profileMap.get(exec.executed_by);
              completionsMap.set(stepNumber, {
                step_number: stepNumber,
                completed_by_name: profile?.name || 'Unknown',
                completed_at: exec.completed_at,
                operator_initials: exec.operator_initials,
                avatar_url: profile?.avatar_url || null,
              });
            }
          }
        });
        setStepCompletions(completionsMap);
      }

      // Fetch failed steps for visual indicators
      const { data: failedExecsData } = await supabase
        .from('step_executions')
        .select('production_step:production_steps(step_number)')
        .eq('work_order_item_id', itemId)
        .eq('validation_status', 'failed');

      if (failedExecsData) {
        const failedStepNumbers = new Set(
          failedExecsData
            .map((exec: any) => exec.production_step?.step_number)
            .filter((num: number | undefined) => num !== undefined)
        );
        setFailedSteps(failedStepNumbers);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error(t('error'), { description: t('failedLoadProduction') });
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

      toast.success(t('success'), { description: t('stepStarted') });
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
      const isCompleted = nextStepNumber > productionSteps.length;
      
      const { error: itemError } = await supabase
        .from('work_order_items')
        .update({
          current_step: nextStepNumber,
          status: isCompleted ? 'completed' : 'in_progress',
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

      // Trigger webhook for step completion
      const { triggerWebhook } = await import('@/lib/webhooks');
      await triggerWebhook('production_step_completed', {
        serial_number: item.serial_number,
        step_number: item.current_step,
        step_name: currentStep.title_en,
        work_order_id: item.work_order_id,
        product_type: workOrder.product_type,
      });

      // If all steps completed, trigger work order completion webhook and navigate
      if (isCompleted) {
        await triggerWebhook('work_order_item_completed', {
          serial_number: item.serial_number,
          work_order_id: item.work_order_id,
          product_type: workOrder.product_type,
        });

        // Check if all items in the batch are completed
        const { data: allItems, error: allItemsError } = await supabase
          .from('work_order_items')
          .select('id, status')
          .eq('work_order_id', item.work_order_id);

        if (!allItemsError && allItems) {
          const allCompleted = allItems.every(i => i.status === 'completed');

          if (allCompleted) {
            // Trigger batch_completed webhook
            await triggerWebhook('batch_completed', {
              work_order_id: item.work_order_id,
              wo_number: workOrder.wo_number,
              product_type: workOrder.product_type,
              batch_size: allItems.length,
              completed_at: new Date().toISOString(),
            });
          }
        }

        // Auto-generate quality certificate for completed items
        try {
          toast.loading(t('generatingCertificate') || 'Generating quality certificate...', { id: 'cert-gen' });

          const { pdfUrl } = await generateQualityCertificate(itemId as string);

          toast.success(t('certificateGenerated') || 'Certificate generated!', {
            id: 'cert-gen',
            description: t('certificateReady') || 'Quality certificate is ready',
            action: {
              label: t('download') || 'Download',
              onClick: () => window.open(pdfUrl, '_blank'),
            },
            duration: 10000,
          });
        } catch (certError) {
          console.error('Auto-generate certificate failed:', certError);
          // Don't block navigation if certificate generation fails
          toast.error(t('certificateGenerationFailed') || 'Certificate generation failed', {
            id: 'cert-gen',
            description: t('canGenerateLater') || 'You can generate it later from the production page',
          });
        }

        toast.success(t('success'), { description: t('itemCompleted') });
        navigate(`/production/${item.work_order_id}`);
      } else {
        // Stay on the page and refresh data to show next step
        toast.success(t('success'), { description: t('stepCompleted') });
        setLoading(true);
        await fetchData();
      }
    } catch (error: any) {
      console.error('Error completing step:', error);
      toast.error(t('error'), { description: error.message });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
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
          <h3 className="text-lg font-semibold mb-2">{t('productionStepNotFound')}</h3>
          <Button onClick={() => navigate('/work-orders')}>
            {t('backToWorkOrders')}
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 md:space-y-8">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(`/production/${item.work_order_id}`)} className="h-12 w-12 md:h-10 md:w-10">
              <ArrowLeft className="h-6 w-6 md:h-5 md:w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight font-data">{item.serial_number}</h1>
              <p className="text-base md:text-lg text-muted-foreground font-data">
                {workOrder.product_type} • {t('step')} {item.current_step} {t('of')} {productionSteps.length}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Active users indicator */}
            {presentUsers.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-3 py-2 bg-accent/50 rounded-lg border">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="flex -space-x-2">
                        {presentUsers.slice(0, 3).map((pUser) => (
                          <Avatar key={pUser.id} className="h-8 w-8 border-2 border-background">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {getInitials(pUser.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {presentUsers.length > 3 && (
                          <div className="h-8 w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                            +{presentUsers.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-xs">
                    <p className="font-semibold mb-1">{t('alsoViewing')}</p>
                    <ul className="text-sm">
                      {presentUsers.map((pUser) => (
                        <li key={pUser.id}>{pUser.name}</li>
                      ))}
                    </ul>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            
            <Button variant="outline" size="lg" onClick={() => setShowValidationHistory(true)} className="gap-2">
              <History className="h-5 w-5" />
              <span className="hidden sm:inline">{t('history')}</span>
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <span className="text-2xl md:text-xl font-ui">{currentStep.title_en}</span>
              <Badge variant={stepExecution ? 'default' : 'outline'} className="h-10 px-5 text-base md:h-auto md:px-3 md:text-sm self-start">
                {stepExecution ? t('inProgress') : t('notStarted')}
              </Badge>
            </CardTitle>
            <CardDescription className="text-base md:text-sm">
              {currentStep.description_en || t('followInstructions')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wide">{t('howToComplete')}</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                {currentStep.requires_batch_number && (
                  <li>{t('scanMaterialsInstruction')}</li>
                )}
                {(currentStep.requires_value_input || currentStep.measurement_fields) && (
                  <li>{t('enterMeasurementsInstruction')}</li>
                )}
                {currentStep.has_checklist && (
                  <li>{t('completeChecklistInstruction')}</li>
                )}
                <li>{t('completeStepInstruction')}</li>
              </ol>
            </div>

            {currentStep.requires_barcode_scan && (
              <div className="flex items-center gap-3 p-4 bg-accent/50 rounded-lg border-2">
                <ScanBarcode className="h-6 w-6 text-primary" />
                <span className="text-base font-medium">{t('requiresBarcode')}</span>
              </div>
            )}

            {!stepExecution ? (
              <Button onClick={handleStartStep} variant="default" size="lg" className="w-full">
                {t('startStep')}
              </Button>
            ) : (
              <div className="space-y-4">
                {currentStep.requires_batch_number && (
                  <Button onClick={() => setShowBatchScanDialog(true)} variant="outline" size="lg" className="w-full">
                    <ScanBarcode className="mr-2" />
                    {t('scanMaterials')}
                  </Button>
                )}
                
                {(currentStep.requires_value_input || currentStep.measurement_fields) && (
                  <Button onClick={() => setShowMeasurementDialog(true)} variant="outline" size="lg" className="w-full">
                    {t('enterMeasurements')}
                  </Button>
                )}

                {currentStep.has_checklist && (
                  <Button onClick={() => setShowChecklistDialog(true)} variant="outline" size="lg" className="w-full">
                    {t('completeChecklist')}
                  </Button>
                )}

                <Button onClick={handleCompleteStep} variant="default" size="lg" className="w-full">
                  <CheckCircle2 className="mr-2" />
                  {t('completeStep')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress indicator */}
        <Card>
          <CardHeader>
            <CardTitle className="font-ui">{t('progress')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 md:space-y-2">
              {productionSteps.map((step) => {
                const hasFailed = failedSteps.has(step.step_number);
                const completion = stepCompletions.get(step.step_number);
                const isCompleted = step.step_number < item.current_step;
                const isCurrent = step.step_number === item.current_step;
                
                return (
                  <div
                    key={step.id}
                    className={`flex items-center gap-4 md:gap-3 p-4 md:p-3 rounded-lg transition-all ${
                      isCurrent
                        ? 'bg-primary/10 border-2 border-primary'
                        : isCompleted
                        ? hasFailed
                          ? 'bg-destructive/10 border border-destructive/30'
                          : 'bg-accent/50 border border-border'
                        : 'bg-muted/30 border border-border'
                    }`}
                  >
                    <div className={`flex items-center justify-center h-10 w-10 md:h-8 md:w-8 rounded-full ${
                      isCompleted
                        ? hasFailed
                          ? 'bg-destructive text-destructive-foreground shadow-lg'
                          : 'bg-primary text-primary-foreground shadow-lg'
                        : isCurrent
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? (
                        hasFailed ? (
                          <XCircle className="h-5 w-5 md:h-4 md:w-4" />
                        ) : (
                          <CheckCircle2 className="h-5 w-5 md:h-4 md:w-4" />
                        )
                      ) : (
                        <span className="text-base md:text-sm font-bold font-data">{step.step_number}</span>
                      )}
                    </div>
                    <div className="flex-1 flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <span className="text-base md:text-sm font-medium font-data">{step.title_en}</span>
                        {isCompleted && completion && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {completion.operator_initials || completion.completed_by_name} • {new Date(completion.completed_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isCompleted && completion && (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Avatar className="h-7 w-7">
                                  {completion.avatar_url && (
                                    <AvatarImage src={completion.avatar_url} alt={completion.completed_by_name} />
                                  )}
                                  <AvatarFallback className="bg-muted text-xs">
                                    {completion.operator_initials || getInitials(completion.completed_by_name)}
                                  </AvatarFallback>
                                </Avatar>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>{completion.completed_by_name}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                        {hasFailed && (
                          <Badge variant="destructive" className="ml-2">{t('failed')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
            workOrderItem={item}
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

          <ValidationHistoryDialog
            open={showValidationHistory}
            onOpenChange={setShowValidationHistory}
            workOrderItemId={item.id}
            serialNumber={item.serial_number}
          />
        </>
      )}
    </Layout>
  );
};

export default ProductionStep;
