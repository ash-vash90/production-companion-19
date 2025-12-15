import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
import { Loader2, ArrowLeft, CheckCircle2, AlertCircle, ScanBarcode, History, XCircle, Users, Link2, MoreVertical, ChevronLeft, ChevronRight, RefreshCw, Play, ClipboardCheck, Ruler } from 'lucide-react';
import { formatDateTime } from '@/lib/utils';
import { useTouchDevice, useSwipeGesture, usePullToRefresh, useHapticFeedback } from '@/hooks/useTouchDevice';
import { FloatingActionButton, ActionSheet, MobileActionBar } from '@/components/mobile/MobileActionBar';
import MeasurementDialog from '@/components/production/MeasurementDialog';
import ChecklistDialog from '@/components/production/ChecklistDialog';
import BatchScanDialog from '@/components/production/BatchScanDialog';
import ValidationHistoryDialog from '@/components/production/ValidationHistoryDialog';
import StepDetailDialog from '@/components/production/StepDetailDialog';
import StepEditDialog from '@/components/production/StepEditDialog';
import SubAssemblyLinkDialog from '@/components/production/SubAssemblyLinkDialog';
import { SimpleNotes } from '@/components/production/SimpleNotes';
import { WorkOrderComments } from '@/components/production/WorkOrderComments';
import { WorkInstructionViewer } from '@/components/production/WorkInstructionViewer';
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();

  // Mobile-specific hooks
  const isTouchDevice = useTouchDevice();
  const haptic = useHapticFeedback();
  const containerRef = useRef<HTMLDivElement>(null);
  const [showMobileActions, setShowMobileActions] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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
  const [showStepDetail, setShowStepDetail] = useState(false);
  const [showStepEdit, setShowStepEdit] = useState(false);
  const [showSubAssemblyLink, setShowSubAssemblyLink] = useState(false);
  const [viewingStepNumber, setViewingStepNumber] = useState<number | null>(null);
  const [editingStepNumber, setEditingStepNumber] = useState<number | null>(null);
  const [failedSteps, setFailedSteps] = useState<Set<number>>(new Set());
  const [stepCompletions, setStepCompletions] = useState<Map<number, StepCompletionInfo>>(new Map());
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null);
  const [expectedLinkType, setExpectedLinkType] = useState<'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER'>('SENSOR');

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
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [user, itemId, currentUserProfile]);

  // Handle viewStep query param for viewing completed steps
  useEffect(() => {
    const viewStep = searchParams.get('viewStep');
    if (viewStep) {
      const stepNum = parseInt(viewStep, 10);
      if (!isNaN(stepNum)) {
        setViewingStepNumber(stepNum);
        setShowStepDetail(true);
        // Clear the query param
        setSearchParams({});
      }
    }
  }, [searchParams, setSearchParams]);

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

      // Fetch production steps for this item's product type (or fallback to work order product type)
      const itemProductType = (itemData.product_type || woData.product_type) as 'SDM_ECO' | 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER';
      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select('*')
        .eq('product_type', itemProductType)
        .order('sort_order', { ascending: true });
      
      // For SDM_ECO items, check if all linked sub-assemblies are completed
      if (itemProductType === 'SDM_ECO') {
        const { data: subAssemblies } = await supabase
          .from('sub_assemblies')
          .select('child_item_id')
          .eq('parent_item_id', itemId);
        
        if (subAssemblies && subAssemblies.length > 0) {
          const childIds = subAssemblies.map(sa => sa.child_item_id);
          const { data: childItems } = await supabase
            .from('work_order_items')
            .select('id, serial_number, status, product_type')
            .in('id', childIds);
          
          const incompleteComponents = childItems?.filter(item => item.status !== 'completed') || [];
          if (incompleteComponents.length > 0) {
            const componentList = incompleteComponents.map(c => `${c.serial_number} (${c.product_type})`).join(', ');
            toast.error(t('dependencyNotMet') || 'Dependencies not met', { 
              description: `Complete these components first: ${componentList}` 
            });
            navigate(`/production/${itemData.work_order_id}`);
            return;
          }
        }
      }

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
      
      // Update work order item status to in_progress if it's planned
      if (item.status === 'planned') {
        await supabase
          .from('work_order_items')
          .update({ status: 'in_progress' })
          .eq('id', itemId);
        setItem({ ...item, status: 'in_progress' });
      }
      
      // Update work order status to in_progress if it's planned
      if (workOrder.status === 'planned') {
        await supabase
          .from('work_orders')
          .update({ status: 'in_progress', started_at: new Date().toISOString() })
          .eq('id', workOrder.id);
        setWorkOrder({ ...workOrder, status: 'in_progress' });
      }
      
      // Show appropriate dialog based on step requirements
      // For SDM_ECO linking steps (barcode scan steps that link components)
      const itemProductType = item.product_type || workOrder.product_type;
      if (itemProductType === 'SDM_ECO' && currentStep.requires_barcode_scan) {
        // Determine which component type to link based on step title
        const stepTitle = currentStep.title_en.toLowerCase();
        if (stepTitle.includes('sensor')) {
          setExpectedLinkType('SENSOR');
          setShowSubAssemblyLink(true);
        } else if (stepTitle.includes('mla')) {
          setExpectedLinkType('MLA');
          setShowSubAssemblyLink(true);
        } else if (stepTitle.includes('hmi')) {
          setExpectedLinkType('HMI');
          setShowSubAssemblyLink(true);
        } else if (stepTitle.includes('transmitter')) {
          setExpectedLinkType('TRANSMITTER');
          setShowSubAssemblyLink(true);
        }
      } else if (currentStep.requires_batch_number) {
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
        product_type: item.product_type || workOrder.product_type,
      });

      // If all steps completed, trigger work order completion webhook and navigate
      if (isCompleted) {
        await triggerWebhook('work_order_item_completed', {
          serial_number: item.serial_number,
          work_order_id: item.work_order_id,
          product_type: item.product_type || workOrder.product_type,
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

  // Pull-to-refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    haptic.medium();
    await fetchData();
    setIsRefreshing(false);
  }, [haptic]);

  // Use pull-to-refresh on touch devices
  usePullToRefresh({
    onRefresh: handleRefresh,
    threshold: 80,
    enabled: isTouchDevice && !loading,
  });

  // Swipe gesture handlers for step navigation (view previous completed steps)
  useSwipeGesture(
    {
      onSwipeLeft: () => {
        // Show next completed step if available
        if (item && viewingStepNumber !== null) {
          const nextStep = viewingStepNumber + 1;
          if (nextStep < item.current_step) {
            haptic.light();
            setViewingStepNumber(nextStep);
          }
        }
      },
      onSwipeRight: () => {
        // Show previous completed step if available
        if (item && viewingStepNumber !== null) {
          const prevStep = viewingStepNumber - 1;
          if (prevStep >= 1) {
            haptic.light();
            setViewingStepNumber(prevStep);
          }
        } else if (item && item.current_step > 1) {
          // Open the previous step viewer
          haptic.light();
          setViewingStepNumber(item.current_step - 1);
          setShowStepDetail(true);
        }
      },
    },
    {
      threshold: 75,
      enabled: isTouchDevice && showStepDetail,
    }
  );

  // Mobile action handlers with haptic feedback
  const handleMobileStartStep = () => {
    haptic.medium();
    handleStartStep();
  };

  const handleMobileCompleteStep = () => {
    haptic.heavy();
    handleCompleteStep();
  };

  // Get mobile actions for the action sheet
  const getMobileActions = () => {
    const actions: Array<{
      label: string;
      icon?: React.ReactNode;
      onClick: () => void;
      variant?: 'default' | 'destructive';
    }> = [];

    if (stepExecution) {
      // Show available actions based on step requirements
      const itemProductType = item?.product_type || workOrder?.product_type;

      if (itemProductType === 'SDM_ECO' && currentStep?.requires_barcode_scan) {
        actions.push({
          label: t('linkComponent') || 'Link Component',
          icon: <Link2 className="h-5 w-5" />,
          onClick: () => {
            const stepTitle = currentStep.title_en.toLowerCase();
            if (stepTitle.includes('sensor')) setExpectedLinkType('SENSOR');
            else if (stepTitle.includes('mla')) setExpectedLinkType('MLA');
            else if (stepTitle.includes('hmi')) setExpectedLinkType('HMI');
            else if (stepTitle.includes('transmitter')) setExpectedLinkType('TRANSMITTER');
            setShowSubAssemblyLink(true);
            setShowMobileActions(false);
          },
        });
      }

      if (currentStep?.requires_batch_number) {
        actions.push({
          label: t('scanMaterials'),
          icon: <ScanBarcode className="h-5 w-5" />,
          onClick: () => {
            setShowBatchScanDialog(true);
            setShowMobileActions(false);
          },
        });
      }

      if (currentStep?.requires_value_input || currentStep?.measurement_fields) {
        actions.push({
          label: t('enterMeasurements'),
          icon: <Ruler className="h-5 w-5" />,
          onClick: () => {
            setShowMeasurementDialog(true);
            setShowMobileActions(false);
          },
        });
      }

      if (currentStep?.has_checklist) {
        actions.push({
          label: t('completeChecklist'),
          icon: <ClipboardCheck className="h-5 w-5" />,
          onClick: () => {
            setShowChecklistDialog(true);
            setShowMobileActions(false);
          },
        });
      }
    }

    // Always add history action
    actions.push({
      label: t('history'),
      icon: <History className="h-5 w-5" />,
      onClick: () => {
        setShowValidationHistory(true);
        setShowMobileActions(false);
      },
    });

    return actions;
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
      <div ref={containerRef} className="space-y-6 md:space-y-8 max-w-3xl mx-auto pb-24 md:pb-8">
        {/* Pull-to-refresh indicator */}
        {isRefreshing && (
          <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-lg flex items-center gap-2 animate-in slide-in-from-top">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm font-medium">{t('refreshing') || 'Refreshing...'}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(`/production/${item.work_order_id}`)}
              className="h-12 w-12 md:h-10 md:w-10 touch-target"
            >
              <ArrowLeft className="h-6 w-6 md:h-5 md:w-5" />
            </Button>
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight font-data">{item.serial_number}</h1>
              <p className="text-sm sm:text-base md:text-lg text-muted-foreground font-data">
                {item.product_type || workOrder.product_type} • {t('step')} {item.current_step} {t('of')} {productionSteps.length}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Active users indicator */}
            {presentUsers.length > 0 && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-2 px-2 sm:px-3 py-2 bg-accent/50 rounded-lg border">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <div className="flex -space-x-2">
                        {presentUsers.slice(0, 3).map((pUser) => (
                          <Avatar key={pUser.id} className="h-7 w-7 sm:h-8 sm:w-8 border-2 border-background">
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                              {getInitials(pUser.name)}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {presentUsers.length > 3 && (
                          <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
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

            {/* Desktop actions */}
            <div className="hidden sm:flex items-center gap-2">
              <Button variant="outline" size="lg" onClick={() => setShowValidationHistory(true)} className="gap-2">
                <History className="h-5 w-5" />
                <span className="hidden md:inline">{t('history')}</span>
              </Button>

              <WorkInstructionViewer
                productType={(item.product_type || workOrder.product_type) as 'SDM_ECO' | 'SENSOR' | 'MLA' | 'HMI' | 'TRANSMITTER'}
                productionStepId={currentStep?.id}
                productionStepNumber={currentStep?.step_number}
              />
            </div>

            {/* Mobile more actions button */}
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowMobileActions(true)}
              className="sm:hidden h-12 w-12 touch-target"
            >
              <MoreVertical className="h-5 w-5" />
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

            {/* Desktop/tablet action buttons - hidden on mobile where FAB is used */}
            <div className="hidden sm:block">
              {!stepExecution ? (
                <Button onClick={handleStartStep} variant="default" size="lg" className="w-full h-14 text-base">
                  <Play className="mr-2 h-5 w-5" />
                  {t('startStep')}
                </Button>
              ) : (
                <div className="space-y-3">
                  {/* SDM_ECO component linking button */}
                  {(item.product_type || workOrder.product_type) === 'SDM_ECO' && currentStep.requires_barcode_scan && (
                    <Button
                      onClick={() => {
                        const stepTitle = currentStep.title_en.toLowerCase();
                        if (stepTitle.includes('sensor')) setExpectedLinkType('SENSOR');
                        else if (stepTitle.includes('mla')) setExpectedLinkType('MLA');
                        else if (stepTitle.includes('hmi')) setExpectedLinkType('HMI');
                        else if (stepTitle.includes('transmitter')) setExpectedLinkType('TRANSMITTER');
                        setShowSubAssemblyLink(true);
                      }}
                      variant="outline"
                      size="lg"
                      className="w-full h-14 text-base"
                    >
                      <Link2 className="mr-2 h-5 w-5" />
                      {t('linkComponent') || 'Link Component'}
                    </Button>
                  )}

                  {currentStep.requires_batch_number && (
                    <Button onClick={() => setShowBatchScanDialog(true)} variant="outline" size="lg" className="w-full h-14 text-base">
                      <ScanBarcode className="mr-2 h-5 w-5" />
                      {t('scanMaterials')}
                    </Button>
                  )}

                  {(currentStep.requires_value_input || currentStep.measurement_fields) && (
                    <Button onClick={() => setShowMeasurementDialog(true)} variant="outline" size="lg" className="w-full h-14 text-base">
                      <Ruler className="mr-2 h-5 w-5" />
                      {t('enterMeasurements')}
                    </Button>
                  )}

                  {currentStep.has_checklist && (
                    <Button onClick={() => setShowChecklistDialog(true)} variant="outline" size="lg" className="w-full h-14 text-base">
                      <ClipboardCheck className="mr-2 h-5 w-5" />
                      {t('completeChecklist')}
                    </Button>
                  )}

                  <Button onClick={handleCompleteStep} variant="default" size="lg" className="w-full h-14 text-base">
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                    {t('completeStep')}
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile action summary - shows on mobile where FAB is primary action */}
            <div className="sm:hidden">
              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg border">
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {stepExecution ? t('stepInProgress') || 'Step in progress' : t('readyToStart') || 'Ready to start'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {stepExecution
                      ? t('tapFabToComplete') || 'Tap the button below to complete'
                      : t('tapFabToStart') || 'Tap the button below to start'}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {stepExecution && (
                    <>
                      {currentStep.requires_batch_number && (
                        <Button onClick={() => setShowBatchScanDialog(true)} variant="outline" size="icon" className="h-10 w-10 touch-target">
                          <ScanBarcode className="h-5 w-5" />
                        </Button>
                      )}
                      {(currentStep.requires_value_input || currentStep.measurement_fields) && (
                        <Button onClick={() => setShowMeasurementDialog(true)} variant="outline" size="icon" className="h-10 w-10 touch-target">
                          <Ruler className="h-5 w-5" />
                        </Button>
                      )}
                      {currentStep.has_checklist && (
                        <Button onClick={() => setShowChecklistDialog(true)} variant="outline" size="icon" className="h-10 w-10 touch-target">
                          <ClipboardCheck className="h-5 w-5" />
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
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
                const canNavigate = isCompleted;
                
                return (
                  <div
                    key={step.id}
                    onClick={() => canNavigate && navigate(`/production/step/${item.id}?viewStep=${step.step_number}`)}
                    className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                      canNavigate ? 'cursor-pointer hover:shadow-md' : ''
                    } ${
                      isCurrent
                        ? 'bg-primary/10 border-2 border-primary'
                        : isCompleted
                        ? hasFailed
                          ? 'bg-destructive/10 border border-destructive/30 hover:bg-destructive/20'
                          : 'bg-accent/50 border border-border hover:bg-accent'
                        : 'bg-muted/30 border border-border'
                    }`}
                  >
                    <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 ${
                      isCompleted
                        ? hasFailed
                          ? 'bg-destructive text-destructive-foreground'
                          : 'bg-primary text-primary-foreground'
                        : isCurrent
                        ? 'bg-primary/20 text-primary border-2 border-primary'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {isCompleted ? (
                        hasFailed ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <span className="text-sm font-bold">{step.step_number}</span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{step.title_en}</span>
                      {isCompleted && completion && (
                        <p className="text-xs text-muted-foreground">
                          {completion.completed_by_name} • {formatDateTime(completion.completed_at)}
                        </p>
                      )}
                    </div>
                    {hasFailed && <Badge variant="destructive" className="text-xs">{t('failed')}</Badge>}
                    {isCompleted && <Badge variant="outline" className="text-xs">{t('view')}</Badge>}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Notes section - quick annotations */}
        <SimpleNotes 
          workOrderId={item.work_order_id} 
          workOrderItemId={item.id}
          currentStepNumber={item.current_step}
        />

        {/* Comments section - threaded discussions */}
        <WorkOrderComments 
          workOrderId={item.work_order_id} 
          workOrderItemId={item.id}
          currentStepNumber={item.current_step}
        />
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
        </>
      )}

      {/* SubAssembly linking dialog for SDM_ECO */}
      {stepExecution && (
        <SubAssemblyLinkDialog
          open={showSubAssemblyLink}
          onOpenChange={setShowSubAssemblyLink}
          parentItemId={item.id}
          parentSerialNumber={item.serial_number}
          expectedComponentType={expectedLinkType}
          stepExecutionId={stepExecution.id}
          onComplete={fetchData}
        />
      )}

      {/* Always show validation history dialog - not dependent on stepExecution */}
      <ValidationHistoryDialog
        open={showValidationHistory}
        onOpenChange={setShowValidationHistory}
        workOrderItemId={item.id}
        serialNumber={item.serial_number}
      />

      {/* Step detail dialog for viewing completed steps */}
      {viewingStepNumber && (
        <StepDetailDialog
          open={showStepDetail}
          onOpenChange={(open) => {
            setShowStepDetail(open);
            if (!open) setViewingStepNumber(null);
          }}
          workOrderItemId={item.id}
          stepNumber={viewingStepNumber}
          productType={item.product_type || workOrder.product_type}
          onEdit={() => {
            setEditingStepNumber(viewingStepNumber);
            setShowStepEdit(true);
          }}
        />
      )}

      {/* Step edit dialog for editing completed steps (admin only) */}
      {editingStepNumber && (
        <StepEditDialog
          open={showStepEdit}
          onOpenChange={(open) => {
            setShowStepEdit(open);
            if (!open) setEditingStepNumber(null);
          }}
          workOrderItemId={item.id}
          stepNumber={editingStepNumber}
          productType={item.product_type || workOrder.product_type}
          onSave={fetchData}
        />
      )}

      {/* Mobile action sheet */}
      <ActionSheet
        open={showMobileActions}
        onClose={() => setShowMobileActions(false)}
        title={t('actions') || 'Actions'}
        description={`${t('step')} ${item.current_step}: ${currentStep.title_en}`}
        actions={getMobileActions()}
        cancelLabel={t('cancel') || 'Cancel'}
      />

      {/* Mobile floating action button */}
      {isTouchDevice && (
        <FloatingActionButton
          icon={stepExecution ? <CheckCircle2 className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          onClick={stepExecution ? handleMobileCompleteStep : handleMobileStartStep}
          label={stepExecution ? t('completeStep') : t('startStep')}
          variant={stepExecution ? 'default' : 'default'}
          position="bottom-right"
        />
      )}

      {/* Mobile step navigation hint */}
      {isTouchDevice && item.current_step > 1 && (
        <div className="fixed bottom-24 left-4 right-4 sm:hidden pointer-events-none">
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-3 py-2 rounded-lg border shadow-sm">
            <div className="flex items-center gap-1">
              <ChevronLeft className="h-3 w-3" />
              <span>{t('swipeToViewPrevious') || 'Swipe to view previous'}</span>
            </div>
            <div className="flex items-center gap-1">
              <span>{t('pullToRefresh') || 'Pull to refresh'}</span>
              <RefreshCw className="h-3 w-3" />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
};

export default ProductionStep;
