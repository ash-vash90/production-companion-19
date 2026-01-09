import React, { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { 
  ChevronLeft, 
  Check, 
  Loader2, 
  AlertTriangle,
  Users
} from 'lucide-react';

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

interface MobileStepAssignmentPageProps {
  workOrderId: string;
  productType: string;
  scheduledDate?: string | null;
  onBack: () => void;
  onUpdate: () => void;
}

const getStorageKey = (workOrderId: string) => `step_assignments_${workOrderId}`;

const MobileStepAssignmentPage: React.FC<MobileStepAssignmentPageProps> = ({
  workOrderId,
  productType,
  scheduledDate,
  onBack,
  onUpdate,
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [assignAllMode, setAssignAllMode] = useState(false);
  const [selectedOperator, setSelectedOperator] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workOrderId, productType, scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select('id, step_number, title_en, title_nl, product_type')
        .eq('product_type', productType as any)
        .order('step_number');

      if (stepsError) throw stepsError;
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

      // Load assignments from DB or localStorage
      let dbAssignmentsLoaded = false;
      try {
        const { data: dbAssignments, error: dbError } = await supabase
          .from('step_assignments' as any)
          .select('production_step_id, operator_id')
          .eq('work_order_id', workOrderId);

        if (!dbError && dbAssignments && dbAssignments.length > 0) {
          const assignMap = new Map<string, string>();
          dbAssignments.forEach((a: any) => {
            assignMap.set(a.production_step_id, a.operator_id);
          });
          setAssignments(assignMap);
          dbAssignmentsLoaded = true;
        }
      } catch {
        // ignore
      }

      if (!dbAssignmentsLoaded) {
        const stored = localStorage.getItem(getStorageKey(workOrderId));
        if (stored) {
          try {
            const parsed = JSON.parse(stored);
            setAssignments(new Map(Object.entries(parsed)));
          } catch {
            // ignore
          }
        }
      }
    } catch (error) {
      console.error('Error fetching step assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const getStepTitle = (step: ProductionStep) => 
    language === 'nl' && step.title_nl ? step.title_nl : step.title_en;

  const persistAssignments = async (newAssignments: Map<string, string>) => {
    // localStorage
    const obj: Record<string, string> = {};
    newAssignments.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(getStorageKey(workOrderId), JSON.stringify(obj));

    // database
    try {
      await supabase.from('step_assignments' as any).delete().eq('work_order_id', workOrderId);

      if (newAssignments.size > 0) {
        const records = Array.from(newAssignments.entries()).map(([stepId, operatorId]) => ({
          work_order_id: workOrderId,
          production_step_id: stepId,
          operator_id: operatorId,
          assigned_by: user?.id,
        }));

        await supabase.from('step_assignments' as any).insert(records);
      }
    } catch {
      // ignore
    }

    // Sync operator_assignments
    const uniqueOperators = new Set(newAssignments.values());
    const assignedDate = scheduledDate || new Date().toISOString().split('T')[0];

    await supabase.from('operator_assignments').delete().eq('work_order_id', workOrderId);

    if (uniqueOperators.size > 0) {
      const rows = Array.from(uniqueOperators).map((operatorId) => ({
        work_order_id: workOrderId,
        operator_id: operatorId,
        assigned_date: assignedDate,
      }));

      await supabase.from('operator_assignments').insert(rows);
    }

    const firstOperator = Array.from(uniqueOperators)[0] || null;
    await supabase.from('work_orders').update({ assigned_to: firstOperator }).eq('id', workOrderId);
  };

  const assignmentStats = useMemo(() => {
    return { assigned: assignments.size, total: steps.length };
  }, [assignments, steps]);

  const handleAssignStep = async (stepId: string, operatorId: string | null) => {
    const operator = operatorId ? operators.find(o => o.id === operatorId) : null;
    if (operator?.unavailable) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar' : 'Operator is unavailable');
      return;
    }

    setSavingId(stepId);
    try {
      const next = new Map(assignments);
      if (operatorId) {
        next.set(stepId, operatorId);
      } else {
        next.delete(stepId);
      }
      setAssignments(next);
      await persistAssignments(next);
      toast.success(language === 'nl' ? 'Stap toegewezen' : 'Step assigned');
      onUpdate();
    } catch (e: any) {
      console.error('Error assigning step:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingId(null);
    }
  };

  const handleAssignAll = async () => {
    if (!selectedOperator) {
      toast.error(language === 'nl' ? 'Selecteer eerst een operator' : 'Select an operator first');
      return;
    }

    const operator = operators.find(o => o.id === selectedOperator);
    if (operator?.unavailable) {
      toast.error(language === 'nl' ? 'Operator is niet beschikbaar' : 'Operator is unavailable');
      return;
    }

    setSavingId('all');
    try {
      const next = new Map<string, string>();
      steps.forEach((s) => next.set(s.id, selectedOperator));
      setAssignments(next);
      await persistAssignments(next);
      toast.success(language === 'nl' ? 'Alle stappen toegewezen' : 'All steps assigned');
      onUpdate();
    } catch (e: any) {
      console.error('Error assigning all steps:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSavingId(null);
      setSelectedOperator(null);
    }
  };

  const handleClearAll = async () => {
    setSavingId('clear');
    try {
      setAssignments(new Map());
      localStorage.removeItem(getStorageKey(workOrderId));

      try {
        await supabase.from('step_assignments' as any).delete().eq('work_order_id', workOrderId);
      } catch {
        // ignore
      }

      await supabase.from('operator_assignments').delete().eq('work_order_id', workOrderId);
      await supabase.from('work_orders').update({ assigned_to: null }).eq('id', workOrderId);

      toast.success(language === 'nl' ? 'Toewijzingen gewist' : 'Assignments cleared');
      onUpdate();
    } catch (e) {
      console.error('Error clearing assignments:', e);
    } finally {
      setSavingId(null);
    }
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
              {language === 'nl' ? 'Stappen toewijzen' : 'Assign Steps'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {assignmentStats.assigned}/{assignmentStats.total} {language === 'nl' ? 'toegewezen' : 'assigned'}
            </p>
          </div>
          {assignments.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-destructive"
              onClick={handleClearAll}
              disabled={savingId === 'clear'}
            >
              {language === 'nl' ? 'Wis' : 'Clear'}
            </Button>
          )}
        </div>
      </div>

      {/* Assign All Toggle */}
      <div className="flex-none p-4 border-b bg-muted/30">
        <div className="flex items-center gap-3 mb-3">
          <Switch 
            id="assign-all" 
            checked={assignAllMode} 
            onCheckedChange={setAssignAllMode} 
          />
          <Label htmlFor="assign-all" className="text-sm cursor-pointer">
            {language === 'nl' ? 'Alle stappen aan één operator' : 'Assign all steps to one operator'}
          </Label>
        </div>
        
        {assignAllMode && (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {operators.map((op) => (
                <button
                  key={op.id}
                  onClick={() => setSelectedOperator(selectedOperator === op.id ? null : op.id)}
                  disabled={op.unavailable}
                  className={cn(
                    'flex items-center gap-2 p-2 rounded-lg border transition-colors min-h-[44px]',
                    selectedOperator === op.id 
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
                  {selectedOperator === op.id && (
                    <Check className="h-4 w-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>
            <Button 
              onClick={handleAssignAll} 
              disabled={!selectedOperator || savingId === 'all'}
              className="w-full h-11"
            >
              {savingId === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Users className="h-4 w-4 mr-2" />
              )}
              {language === 'nl' ? `Wijs alle ${steps.length} stappen toe` : `Assign all ${steps.length} steps`}
            </Button>
          </div>
        )}
      </div>

      {/* Steps List */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-2">
          {!assignAllMode && (
            <p className="text-xs text-muted-foreground mb-3">
              {language === 'nl' ? 'Wijs individuele stappen toe:' : 'Assign individual steps:'}
            </p>
          )}
          
          {steps.map((step) => {
            const assignedOperatorId = assignments.get(step.id);
            const assignedOperator = operators.find(o => o.id === assignedOperatorId);
            
            return (
              <Card key={step.id} className={assignAllMode ? 'opacity-50' : ''}>
                <CardContent className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className="text-xs font-semibold h-6 w-6 flex items-center justify-center p-0">
                      {step.step_number}
                    </Badge>
                    <span className="text-sm flex-1 truncate">{getStepTitle(step)}</span>
                  </div>
                  
                  {!assignAllMode && (
                    <div className="flex flex-wrap gap-2">
                      {operators.map((op) => (
                        <button
                          key={op.id}
                          onClick={() => handleAssignStep(step.id, assignedOperatorId === op.id ? null : op.id)}
                          disabled={op.unavailable || savingId === step.id}
                          className={cn(
                            'flex items-center gap-1.5 px-2 py-1.5 rounded-md border text-xs transition-colors min-h-[36px]',
                            assignedOperatorId === op.id
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50',
                            op.unavailable && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          {savingId === step.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Avatar className="h-5 w-5">
                              {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                              <AvatarFallback className="text-[8px]">{getInitials(op.full_name)}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="truncate max-w-[80px]">{op.full_name.split(' ')[0]}</span>
                          {assignedOperatorId === op.id && <Check className="h-3 w-3" />}
                        </button>
                      ))}
                    </div>
                  )}
                  
                  {assignAllMode && assignedOperator && (
                    <div className="flex items-center gap-2 mt-1">
                      <Avatar className="h-5 w-5">
                        {assignedOperator.avatar_url && <AvatarImage src={assignedOperator.avatar_url} />}
                        <AvatarFallback className="text-[8px]">{getInitials(assignedOperator.full_name)}</AvatarFallback>
                      </Avatar>
                      <span className="text-xs text-muted-foreground">{assignedOperator.full_name}</span>
                    </div>
                  )}
                  
                  {assignedOperator?.unavailable && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-warning">
                      <AlertTriangle className="h-3 w-3" />
                      {language === 'nl' ? 'Toegewezen operator is afwezig' : 'Assigned operator is away'}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MobileStepAssignmentPage;
