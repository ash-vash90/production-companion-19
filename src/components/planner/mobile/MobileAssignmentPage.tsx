import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatProductType, cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  Check, 
  Loader2, 
  AlertTriangle,
  Users,
  Package,
  ChevronDown,
  CheckCircle2,
  Circle,
  Clock
} from 'lucide-react';

interface StepExecution {
  id: string;
  work_order_item_id: string;
  production_step_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
}

interface ProductionStep {
  id: string;
  step_number: number;
  title_en: string;
  title_nl: string;
  product_type: string;
}

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_available: boolean;
  unavailable?: boolean;
  dayCount?: number;
  reason?: string;
}

interface WorkOrderItem {
  id: string;
  serial_number: string;
  product_type: string;
  position_in_batch: number | null;
  assigned_to: string | null;
}

interface MobileAssignmentPageProps {
  workOrderId: string;
  productType: string;
  scheduledDate?: string | null;
  onBack: () => void;
  onUpdate: () => void;
}

const MobileAssignmentPage: React.FC<MobileAssignmentPageProps> = ({
  workOrderId,
  productType,
  scheduledDate,
  onBack,
  onUpdate,
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState<WorkOrderItem[]>([]);
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [stepAssignments, setStepAssignments] = useState<Map<string, Map<string, string>>>(new Map()); // itemId -> (stepId -> operatorId)
  const [stepExecutions, setStepExecutions] = useState<Map<string, Map<string, StepExecution>>>(new Map()); // itemId -> (stepId -> execution)
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [selectedOperatorForAll, setSelectedOperatorForAll] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workOrderId, productType, scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch items
      const { data: itemsData } = await supabase
        .from('work_order_items')
        .select('id, serial_number, product_type, position_in_batch, assigned_to')
        .eq('work_order_id', workOrderId)
        .order('position_in_batch');

      const fetchedItems: WorkOrderItem[] = (itemsData || []).map((i: any) => ({
        id: i.id,
        serial_number: i.serial_number,
        product_type: i.product_type || productType,
        position_in_batch: i.position_in_batch ?? null,
        assigned_to: i.assigned_to ?? null,
      }));
      setItems(fetchedItems);

      // Fetch steps for this product type
      const { data: stepsData } = await supabase
        .from('production_steps')
        .select('id, step_number, title_en, title_nl, product_type')
        .eq('product_type', productType as any)
        .order('step_number');

      setSteps(stepsData || []);

      // Fetch operators (Production team)
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('full_name');

      // Check availability
      let availabilityMap = new Map<string, { unavailable: boolean; reason: string }>();
      let dayCounts = new Map<string, number>();

      if (scheduledDate) {
        const { data: availabilityData } = await supabase
          .from('operator_availability')
          .select('user_id, available_hours, reason_type, reason')
          .eq('date', scheduledDate);

        (availabilityData || []).forEach((a: any) => {
          if (a.available_hours === 0) {
            availabilityMap.set(a.user_id, {
              unavailable: true,
              reason: a.reason || a.reason_type || 'Away',
            });
          }
        });

        const { data: dayAssignments } = await supabase
          .from('operator_assignments')
          .select('operator_id')
          .eq('assigned_date', scheduledDate);

        (dayAssignments || []).forEach((a: any) => {
          const current = dayCounts.get(a.operator_id) || 0;
          dayCounts.set(a.operator_id, current + 1);
        });
      }

      setOperators((profilesData || []).map((op: any) => ({
        ...op,
        unavailable: availabilityMap.get(op.id)?.unavailable || false,
        reason: availabilityMap.get(op.id)?.reason,
        dayCount: dayCounts.get(op.id) || 0,
      })));

      // Initialize step assignments from item assigned_to
      const initialAssignments = new Map<string, Map<string, string>>();
      fetchedItems.forEach(item => {
        if (item.assigned_to && stepsData) {
          const itemStepMap = new Map<string, string>();
          stepsData.forEach((step: any) => {
            itemStepMap.set(step.id, item.assigned_to!);
          });
          initialAssignments.set(item.id, itemStepMap);
        }
      });
      setStepAssignments(initialAssignments);

      // Fetch step executions for completion status
      const itemIds = fetchedItems.map(i => i.id);
      if (itemIds.length > 0) {
        const { data: executionsData } = await supabase
          .from('step_executions')
          .select('id, work_order_item_id, production_step_id, status')
          .in('work_order_item_id', itemIds);

        const executionsMap = new Map<string, Map<string, StepExecution>>();
        (executionsData || []).forEach((exec: any) => {
          if (!executionsMap.has(exec.work_order_item_id)) {
            executionsMap.set(exec.work_order_item_id, new Map());
          }
          executionsMap.get(exec.work_order_item_id)!.set(exec.production_step_id, exec);
        });
        setStepExecutions(executionsMap);
      }

    } catch (error) {
      console.error('Error fetching assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const getStepTitle = (step: ProductionStep) => 
    language === 'nl' && step.title_nl ? step.title_nl : step.title_en;

  const getStepStatus = (itemId: string, stepId: string) => {
    const itemExecs = stepExecutions.get(itemId);
    if (!itemExecs) return 'pending';
    const exec = itemExecs.get(stepId);
    return exec?.status || 'pending';
  };

  const getItemCompletionStats = (itemId: string) => {
    const itemExecs = stepExecutions.get(itemId);
    if (!itemExecs || steps.length === 0) {
      return { completed: 0, inProgress: 0, total: steps.length, percentage: 0 };
    }
    
    let completed = 0;
    let inProgress = 0;
    
    steps.forEach(step => {
      const exec = itemExecs.get(step.id);
      if (exec?.status === 'completed' || exec?.status === 'skipped') {
        completed++;
      } else if (exec?.status === 'in_progress') {
        inProgress++;
      }
    });
    
    return { 
      completed, 
      inProgress, 
      total: steps.length, 
      percentage: steps.length > 0 ? Math.round((completed / steps.length) * 100) : 0 
    };
  };

  const getStepStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'skipped':
        return <CheckCircle2 className="h-3.5 w-3.5 text-status-completed-foreground" />;
      case 'in_progress':
        return <Clock className="h-3.5 w-3.5 text-status-in-progress-foreground" />;
      default:
        return <Circle className="h-3.5 w-3.5 text-muted-foreground/50" />;
    }
  };

  const assignmentStats = useMemo(() => {
    const assignedItems = items.filter(i => i.assigned_to || stepAssignments.has(i.id)).length;
    return { assigned: assignedItems, total: items.length };
  }, [items, stepAssignments]);

  const handleAssignAllItems = async () => {
    if (!selectedOperatorForAll) {
      toast.error(language === 'nl' ? 'Selecteer eerst een operator' : 'Select an operator first');
      return;
    }

    const operator = operators.find(o => o.id === selectedOperatorForAll);
    if (operator?.unavailable) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar' : 'Operator is unavailable');
      return;
    }

    setSavingId('all');
    try {
      // Update all items
      const itemIds = items.map(i => i.id);
      await supabase
        .from('work_order_items')
        .update({ assigned_to: selectedOperatorForAll })
        .in('id', itemIds);

      // Update step assignments
      const newAssignments = new Map<string, Map<string, string>>();
      items.forEach(item => {
        const itemStepMap = new Map<string, string>();
        steps.forEach(step => {
          itemStepMap.set(step.id, selectedOperatorForAll);
        });
        newAssignments.set(item.id, itemStepMap);
      });
      setStepAssignments(newAssignments);

      // Update work order
      await supabase.from('work_orders').update({ assigned_to: selectedOperatorForAll }).eq('id', workOrderId);

      toast.success(language === 'nl' ? 'Alle items toegewezen' : 'All items assigned');
      await fetchData();
      onUpdate();
    } catch (e: any) {
      console.error('Error assigning all items:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingId(null);
      setSelectedOperatorForAll(null);
    }
  };

  const handleAssignItem = async (itemId: string, operatorId: string | null) => {
    const operator = operatorId ? operators.find(o => o.id === operatorId) : null;
    if (operator?.unavailable) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar' : 'Operator is unavailable');
      return;
    }

    setSavingId(itemId);
    try {
      await supabase
        .from('work_order_items')
        .update({ assigned_to: operatorId })
        .eq('id', itemId);

      // Update step assignments for this item
      if (operatorId) {
        const itemStepMap = new Map<string, string>();
        steps.forEach(step => {
          itemStepMap.set(step.id, operatorId);
        });
        setStepAssignments(prev => new Map(prev).set(itemId, itemStepMap));
      } else {
        setStepAssignments(prev => {
          const next = new Map(prev);
          next.delete(itemId);
          return next;
        });
      }

      toast.success(language === 'nl' ? 'Item toegewezen' : 'Item assigned');
      await fetchData();
      onUpdate();
    } catch (e: any) {
      console.error('Error assigning item:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingId(null);
    }
  };

  const handleAssignStep = async (itemId: string, stepId: string, operatorId: string | null) => {
    const operator = operatorId ? operators.find(o => o.id === operatorId) : null;
    if (operator?.unavailable) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar' : 'Operator is unavailable');
      return;
    }

    setSavingId(`${itemId}-${stepId}`);
    try {
      setStepAssignments(prev => {
        const next = new Map(prev);
        const itemMap = new Map(next.get(itemId) || new Map());
        if (operatorId) {
          itemMap.set(stepId, operatorId);
        } else {
          itemMap.delete(stepId);
        }
        next.set(itemId, itemMap);
        return next;
      });

      // Update the item's assigned_to to the first operator in steps
      const itemSteps = stepAssignments.get(itemId) || new Map();
      const operators_assigned = new Set(itemSteps.values());
      if (operatorId) operators_assigned.add(operatorId);
      const firstOp = Array.from(operators_assigned)[0] || null;
      
      await supabase
        .from('work_order_items')
        .update({ assigned_to: firstOp })
        .eq('id', itemId);

      toast.success(language === 'nl' ? 'Stap toegewezen' : 'Step assigned');
      onUpdate();
    } catch (e: any) {
      console.error('Error assigning step:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingId(null);
    }
  };

  const getItemAssignmentSummary = (item: WorkOrderItem) => {
    const itemSteps = stepAssignments.get(item.id);
    if (!itemSteps || itemSteps.size === 0) {
      if (item.assigned_to) {
        const op = operators.find(o => o.id === item.assigned_to);
        return op?.full_name || (language === 'nl' ? 'Toegewezen' : 'Assigned');
      }
      return language === 'nl' ? 'Niet toegewezen' : 'Unassigned';
    }

    const uniqueOperators = new Set(itemSteps.values());
    if (uniqueOperators.size === 1) {
      const opId = Array.from(uniqueOperators)[0];
      const op = operators.find(o => o.id === opId);
      return op?.full_name || (language === 'nl' ? 'Toegewezen' : 'Assigned');
    }

    return `${uniqueOperators.size} ${language === 'nl' ? 'operators' : 'operators'}`;
  };

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-none p-4 border-b">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold">
              {language === 'nl' ? 'Toewijzingen' : 'Assignments'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {assignmentStats.assigned}/{assignmentStats.total} {language === 'nl' ? 'items toegewezen' : 'items assigned'}
            </p>
          </div>
        </div>
      </div>

      {/* Assign All Section */}
      <div className="flex-none p-4 border-b bg-muted/30">
        <p className="text-sm font-medium mb-3">
          {language === 'nl' ? 'Wijs alle items toe aan:' : 'Assign all items to:'}
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {operators.map((op) => (
            <button
              key={op.id}
              onClick={() => setSelectedOperatorForAll(selectedOperatorForAll === op.id ? null : op.id)}
              disabled={op.unavailable}
              className={cn(
                'flex items-center gap-2 p-2 rounded-lg border transition-colors min-h-[44px]',
                selectedOperatorForAll === op.id 
                  ? 'border-primary bg-primary/10' 
                  : 'border-border hover:border-primary/50',
                op.unavailable && 'opacity-50 cursor-not-allowed'
              )}
            >
              <Avatar className="h-8 w-8">
                {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                <AvatarFallback className="text-xs">{getInitials(op.full_name)}</AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="text-sm font-medium">{op.full_name}</p>
                {op.unavailable ? (
                  <p className="text-xs text-destructive">{op.reason || (language === 'nl' ? 'Afwezig' : 'Away')}</p>
                ) : (
                  <p className="text-xs text-muted-foreground">{op.dayCount} orders</p>
                )}
              </div>
              {selectedOperatorForAll === op.id && (
                <Check className="h-4 w-4 text-primary ml-auto" />
              )}
            </button>
          ))}
        </div>
        <Button 
          onClick={handleAssignAllItems} 
          disabled={!selectedOperatorForAll || savingId === 'all'}
          className="w-full h-11"
        >
          {savingId === 'all' ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Users className="h-4 w-4 mr-2" />
          )}
          {language === 'nl' ? 'Wijs alle items toe' : 'Assign All Items'}
        </Button>
      </div>

      {/* Items Accordion */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <p className="text-xs text-muted-foreground mb-3">
            {language === 'nl' ? 'Of wijs individueel toe (tap om stappen te zien):' : 'Or assign individually (tap to see steps):'}
          </p>
          
          <Accordion type="multiple" className="space-y-2">
            {items.map((item) => {
              const itemSteps = stepAssignments.get(item.id) || new Map();
              const isUnassigned = !item.assigned_to && itemSteps.size === 0;
              const completionStats = getItemCompletionStats(item.id);
              const isComplete = completionStats.completed === completionStats.total && completionStats.total > 0;
              const hasProgress = completionStats.completed > 0 || completionStats.inProgress > 0;
              
              return (
                <AccordionItem 
                  key={item.id} 
                  value={item.id}
                  className={cn(
                    "border rounded-lg overflow-hidden",
                    isComplete && "border-emerald-500/50 bg-emerald-500/5"
                  )}
                >
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50">
                    <div className="flex items-center gap-3 flex-1 text-left">
                      {isComplete ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm truncate">{item.serial_number}</span>
                          <Badge variant="outline" className="text-[10px] h-5">
                            #{item.position_in_batch}
                          </Badge>
                          {hasProgress && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[10px] h-5",
                                isComplete 
                                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-600"
                                  : completionStats.inProgress > 0
                                    ? "border-amber-500/50 bg-amber-500/10 text-amber-600"
                                    : "border-sky-500/50 bg-sky-500/10 text-sky-600"
                              )}
                            >
                              {completionStats.completed}/{completionStats.total}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <p className={cn(
                            "text-xs",
                            isUnassigned ? "text-warning" : "text-muted-foreground"
                          )}>
                            {getItemAssignmentSummary(item)}
                          </p>
                          {hasProgress && !isComplete && (
                            <Progress 
                              value={completionStats.percentage} 
                              className="h-1 w-16 flex-shrink-0"
                            />
                          )}
                        </div>
                      </div>
                    </div>
                  </AccordionTrigger>
                  
                  <AccordionContent className="px-4 pb-4">
                    {/* Assign whole item */}
                    <div className="mb-4 pb-4 border-b">
                      <p className="text-xs text-muted-foreground mb-2">
                        {language === 'nl' ? 'Wijs dit item toe (alle stappen):' : 'Assign this item (all steps):'}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {operators.map((op) => (
                          <button
                            key={op.id}
                            onClick={() => handleAssignItem(item.id, item.assigned_to === op.id ? null : op.id)}
                            disabled={op.unavailable || savingId === item.id}
                            className={cn(
                              'flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-colors min-h-[36px]',
                              item.assigned_to === op.id
                                ? 'border-primary bg-primary/10 text-primary'
                                : 'border-border hover:border-primary/50',
                              op.unavailable && 'opacity-50 cursor-not-allowed'
                            )}
                          >
                            {savingId === item.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Avatar className="h-5 w-5">
                                {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                                <AvatarFallback className="text-[8px]">{getInitials(op.full_name)}</AvatarFallback>
                              </Avatar>
                            )}
                            <span className="truncate max-w-[80px]">{op.full_name.split(' ')[0]}</span>
                            {item.assigned_to === op.id && <Check className="h-3 w-3" />}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Individual steps */}
                    <div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {language === 'nl' ? 'Of wijs stappen individueel toe:' : 'Or assign steps individually:'}
                      </p>
                      <div className="space-y-2">
                        {steps.map((step) => {
                          const assignedOpId = itemSteps.get(step.id);
                          const stepStatus = getStepStatus(item.id, step.id);
                          const isStepComplete = stepStatus === 'completed' || stepStatus === 'skipped';
                          const isStepInProgress = stepStatus === 'in_progress';
                          
                          return (
                            <div 
                              key={step.id} 
                              className={cn(
                                "rounded-md p-2",
                                isStepComplete 
                                  ? "bg-emerald-500/10 border border-emerald-500/30"
                                  : isStepInProgress
                                    ? "bg-amber-500/10 border border-amber-500/30"
                                    : "bg-muted/30"
                              )}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                {getStepStatusIcon(stepStatus)}
                                <Badge 
                                  variant="outline" 
                                  className={cn(
                                    "text-[10px] h-5 w-5 flex items-center justify-center p-0 font-semibold",
                                    isStepComplete && "border-status-completed-foreground/50 text-status-completed-foreground",
                                    isStepInProgress && "border-status-in-progress-foreground/50 text-status-in-progress-foreground"
                                  )}
                                >
                                  {step.step_number}
                                </Badge>
                                <span className={cn(
                                  "text-xs flex-1 truncate",
                                  isStepComplete && "text-status-completed-foreground",
                                  isStepInProgress && "text-status-in-progress-foreground"
                                )}>
                                  {getStepTitle(step)}
                                </span>
                                {isStepComplete && (
                                  <Badge variant="outline" className="text-[9px] h-4 border-status-completed-foreground/50 bg-status-completed/30 text-status-completed-foreground">
                                    {language === 'nl' ? 'Klaar' : 'Done'}
                                  </Badge>
                                )}
                                {isStepInProgress && (
                                  <Badge variant="outline" className="text-[9px] h-4 border-status-in-progress-foreground/50 bg-status-in-progress/30 text-status-in-progress-foreground">
                                    {language === 'nl' ? 'Bezig' : 'Active'}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1">
                                {operators.map((op) => (
                                  <button
                                    key={op.id}
                                    onClick={() => handleAssignStep(item.id, step.id, assignedOpId === op.id ? null : op.id)}
                                    disabled={op.unavailable || savingId === `${item.id}-${step.id}`}
                                    className={cn(
                                      'flex items-center gap-1 px-1.5 py-1 rounded border text-[10px] transition-colors min-h-[28px]',
                                      assignedOpId === op.id
                                        ? 'border-primary bg-primary/10 text-primary'
                                        : 'border-border hover:border-primary/50',
                                      op.unavailable && 'opacity-50 cursor-not-allowed'
                                    )}
                                  >
                                    {savingId === `${item.id}-${step.id}` ? (
                                      <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                    ) : (
                                      <Avatar className="h-4 w-4">
                                        {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                                        <AvatarFallback className="text-[6px]">{getInitials(op.full_name)}</AvatarFallback>
                                      </Avatar>
                                    )}
                                    <span className="truncate max-w-[60px]">{op.full_name.split(' ')[0]}</span>
                                    {assignedOpId === op.id && <Check className="h-2.5 w-2.5" />}
                                  </button>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </div>
      </ScrollArea>
    </div>
  );
};

export default MobileAssignmentPage;
