import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { Users, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

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
}

interface OperatorAvailability {
  user_id: string;
  available_hours: number;
  reason_type: string;
  reason: string | null;
}

interface StepAssignmentPanelProps {
  workOrderId: string;
  productType: string;
  scheduledDate?: string | null;
  onAssignmentChange?: () => void;
}

const getStorageKey = (workOrderId: string) => `step_assignments_${workOrderId}`;

const StepAssignmentPanel: React.FC<StepAssignmentPanelProps> = ({
  workOrderId,
  productType,
  scheduledDate,
  onAssignmentChange,
}) => {
  const { language } = useLanguage();
  const { user } = useAuth();

  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [availability, setAvailability] = useState<Map<string, OperatorAvailability>>(new Map());
  const [dayAssignmentCounts, setDayAssignmentCounts] = useState<Map<string, number>>(new Map());

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const [assignAllMode, setAssignAllMode] = useState(false);
  const [selectedOperatorForAll, setSelectedOperatorForAll] = useState<string>('');

  const totalSteps = steps.length;
  const assignedCount = assignments.size;

  useEffect(() => {
    fetchData();
  }, [workOrderId, productType, scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // 1) Steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select('id, step_number, title_en, title_nl, product_type')
        .eq('product_type', productType as any)
        .order('step_number');

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      // 2) Operators (Production team)
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

      setOperators(profilesData || []);

      // 3) Availability
      if (scheduledDate) {
        const { data: availabilityData } = await supabase
          .from('operator_availability')
          .select('user_id, available_hours, reason_type, reason')
          .eq('date', scheduledDate);

        const availMap = new Map<string, OperatorAvailability>();
        (availabilityData || []).forEach((a: any) => {
          availMap.set(a.user_id, a);
        });
        setAvailability(availMap);

        // 4) Daily load (count of work orders assigned on that day)
        const { data: dayAssignments } = await supabase
          .from('operator_assignments')
          .select('operator_id')
          .eq('assigned_date', scheduledDate);

        const countMap = new Map<string, number>();
        (dayAssignments || []).forEach((a: any) => {
          const current = countMap.get(a.operator_id) || 0;
          countMap.set(a.operator_id, current + 1);
        });
        setDayAssignmentCounts(countMap);
      } else {
        setAvailability(new Map());
        setDayAssignmentCounts(new Map());
      }

      // 5) Step assignments: database if available, else localStorage
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

  const getStepTitle = (step: ProductionStep) => (language === 'nl' && step.title_nl ? step.title_nl : step.title_en);

  const getOperatorMeta = (operatorId: string) => {
    const avail = availability.get(operatorId);
    const isUnavailable = avail?.available_hours === 0;
    const reason = avail?.reason || avail?.reason_type;
    const dayCount = dayAssignmentCounts.get(operatorId) || 0;
    return { isUnavailable, reason, dayCount };
  };

  const persistAssignments = async (newAssignments: Map<string, string>) => {
    // localStorage (backward compatibility)
    const obj: Record<string, string> = {};
    newAssignments.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(getStorageKey(workOrderId), JSON.stringify(obj));

    // database (if exists)
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

    // Keep operator_assignments in sync for the daily planner
    await syncOperatorAssignments(newAssignments);
  };

  const syncOperatorAssignments = async (newAssignments: Map<string, string>) => {
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

  const handleStepAssignment = async (stepId: string, operatorId: string) => {
    if (operatorId === 'unassigned') {
      setSaving(stepId);
      try {
        const next = new Map(assignments);
        next.delete(stepId);
        setAssignments(next);
        await persistAssignments(next);
        onAssignmentChange?.();
      } catch (e: any) {
        console.error('Error removing assignment:', e);
        toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
      } finally {
        setSaving(null);
      }
      return;
    }

    const meta = getOperatorMeta(operatorId);
    if (meta.isUnavailable) {
      toast.error(language === 'nl'
        ? 'Deze operator is niet beschikbaar op de geplande datum'
        : 'This operator is unavailable on the scheduled date');
      return;
    }

    setSaving(stepId);
    try {
      const next = new Map(assignments);
      next.set(stepId, operatorId);
      setAssignments(next);
      await persistAssignments(next);
      toast.success(language === 'nl' ? 'Stap toegewezen' : 'Step assigned');
      onAssignmentChange?.();
    } catch (e: any) {
      console.error('Error assigning step:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSaving(null);
    }
  };

  const handleAssignAllSteps = async () => {
    if (!selectedOperatorForAll || selectedOperatorForAll === 'unassigned') {
      toast.error(language === 'nl' ? 'Selecteer eerst een operator' : 'Select an operator first');
      return;
    }

    const meta = getOperatorMeta(selectedOperatorForAll);
    if (meta.isUnavailable) {
      toast.error(language === 'nl'
        ? 'Deze operator is niet beschikbaar op de geplande datum'
        : 'This operator is unavailable on the scheduled date');
      return;
    }

    setSaving('all');
    try {
      const next = new Map<string, string>();
      steps.forEach((s) => next.set(s.id, selectedOperatorForAll));
      setAssignments(next);
      await persistAssignments(next);
      toast.success(language === 'nl' ? 'Alle stappen toegewezen' : 'All steps assigned');
      onAssignmentChange?.();
    } catch (e: any) {
      console.error('Error assigning all steps:', e);
      toast.error(e?.message || (language === 'nl' ? 'Opslaan mislukt' : 'Failed to save'));
    } finally {
      setSaving(null);
    }
  };

  const handleClearAll = async () => {
    setSaving('clear');
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
      onAssignmentChange?.();
    } catch (e) {
      console.error('Error clearing assignments:', e);
    } finally {
      setSaving(null);
    }
  };

  const operatorSelectItems = useMemo(() => {
    return operators.map((op) => {
      const meta = getOperatorMeta(op.id);
      return { op, meta };
    });
  }, [operators, availability, dayAssignmentCounts]);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (steps.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Staptoewijzingen' : 'Step Assignments'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={assignedCount === totalSteps ? 'default' : 'secondary'} className="tabular-nums">
              {assignedCount}/{totalSteps}
            </Badge>
            {assignedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearAll}
                disabled={saving === 'clear'}
              >
                {language === 'nl' ? 'Wis' : 'Clear'}
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          {language === 'nl'
            ? 'Wijs operators toe aan stappen (dagplanning toont aantallen, geen uren).'
            : 'Assign operators to steps (daily planning shows counts, not hours).'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Switch id="assign-all" checked={assignAllMode} onCheckedChange={setAssignAllMode} />
            <Label htmlFor="assign-all" className="text-sm cursor-pointer">
              {language === 'nl' ? 'Alle stappen aan één operator' : 'Assign all steps to one operator'}
            </Label>
          </div>
        </div>

        {assignAllMode ? (
          <div className="space-y-3">
            <Select value={selectedOperatorForAll} onValueChange={setSelectedOperatorForAll}>
              <SelectTrigger className="w-full h-10">
                <span className="text-sm text-muted-foreground">
                  {selectedOperatorForAll
                    ? operators.find((o) => o.id === selectedOperatorForAll)?.full_name
                    : (language === 'nl' ? 'Selecteer operator…' : 'Select operator…')}
                </span>
              </SelectTrigger>
              <SelectContent>
                {operatorSelectItems.map(({ op, meta }) => (
                  <SelectItem key={op.id} value={op.id} disabled={meta.isUnavailable}>
                    <div className="flex items-center justify-between w-full gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar className="h-6 w-6">
                          {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                          <AvatarFallback className="text-[10px]">{getInitials(op.full_name)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{op.full_name}</span>
                      </div>
                      {meta.isUnavailable ? (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">
                          {meta.reason || (language === 'nl' ? 'Afwezig' : 'Away')}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-[9px] px-1 py-0 tabular-nums">
                          {meta.dayCount} {language === 'nl' ? 'orders' : 'orders'}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button onClick={handleAssignAllSteps} disabled={!selectedOperatorForAll || saving === 'all'} className="w-full">
              {saving === 'all' ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              {language === 'nl' ? `Wijs alle ${totalSteps} stappen toe` : `Assign all ${totalSteps} steps`}
            </Button>
          </div>
        ) : (
          <>
            <Separator />
            <div className="space-y-2">
              {steps.map((step) => {
                const assignedOperatorId = assignments.get(step.id);
                const assignedOperator = operators.find((op) => op.id === assignedOperatorId);

                return (
                  <div
                    key={step.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 py-3 px-3 rounded-lg bg-muted/30 border border-border/50"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge
                        variant="outline"
                        className="shrink-0 tabular-nums text-[10px] h-6 w-6 flex items-center justify-center p-0"
                      >
                        {step.step_number}
                      </Badge>
                      <span className="text-sm truncate">{getStepTitle(step)}</span>
                    </div>

                    <Select
                      value={assignedOperatorId || 'unassigned'}
                      onValueChange={(value) => handleStepAssignment(step.id, value)}
                      disabled={saving === step.id}
                    >
                      <SelectTrigger className="w-full sm:w-[220px] h-10 text-sm">
                        {saving === step.id ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>{language === 'nl' ? 'Opslaan…' : 'Saving…'}</span>
                          </div>
                        ) : assignedOperator ? (
                          <div className="flex items-center gap-2 min-w-0">
                            <Avatar className="h-6 w-6">
                              {assignedOperator.avatar_url && <AvatarImage src={assignedOperator.avatar_url} />}
                              <AvatarFallback className="text-[10px]">{getInitials(assignedOperator.full_name)}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{assignedOperator.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            {language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
                          </span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned">
                          <span className="text-muted-foreground">
                            {language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
                          </span>
                        </SelectItem>
                        {operatorSelectItems.map(({ op, meta }) => (
                          <SelectItem key={op.id} value={op.id} disabled={meta.isUnavailable} className="py-2">
                            <div className="flex items-center gap-2 w-full">
                              <Avatar className="h-6 w-6">
                                {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                                <AvatarFallback className="text-[10px]">{getInitials(op.full_name)}</AvatarFallback>
                              </Avatar>
                              <span className="truncate">{op.full_name}</span>
                              {meta.isUnavailable && <AlertTriangle className="h-3 w-3 text-destructive ml-auto" />}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StepAssignmentPanel;

