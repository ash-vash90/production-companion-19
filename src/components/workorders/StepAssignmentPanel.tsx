import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Users, Loader2, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';

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
  daily_capacity_hours: number;
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

// Local storage key for step assignments
const getStorageKey = (workOrderId: string) => `step_assignments_${workOrderId}`;

const StepAssignmentPanel: React.FC<StepAssignmentPanelProps> = ({
  workOrderId,
  productType,
  scheduledDate,
  onAssignmentChange,
}) => {
  const { language } = useLanguage();
  const [steps, setSteps] = useState<ProductionStep[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [assignments, setAssignments] = useState<Map<string, string>>(new Map());
  const [availability, setAvailability] = useState<Map<string, OperatorAvailability>>(new Map());
  const [workloads, setWorkloads] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [assignAllMode, setAssignAllMode] = useState(false);
  const [selectedOperatorForAll, setSelectedOperatorForAll] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [workOrderId, productType, scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch production steps for this product type
      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select('id, step_number, title_en, title_nl, product_type')
        .eq('product_type', productType as any)
        .order('step_number');

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      // Fetch production team operators with capacity info
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, daily_capacity_hours, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      setOperators(profilesData || []);

      // Check operator availability for scheduled date
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

        // Get workload for the scheduled date (assignments to other work orders)
        const { data: assignmentsData } = await supabase
          .from('operator_assignments')
          .select('operator_id, planned_hours')
          .eq('assigned_date', scheduledDate)
          .neq('work_order_id', workOrderId);

        const workloadMap = new Map<string, number>();
        (assignmentsData || []).forEach((a: any) => {
          const current = workloadMap.get(a.operator_id) || 0;
          workloadMap.set(a.operator_id, current + Number(a.planned_hours));
        });
        setWorkloads(workloadMap);
      }

      // Load step assignments from localStorage
      const storedAssignments = localStorage.getItem(getStorageKey(workOrderId));
      if (storedAssignments) {
        try {
          const parsed = JSON.parse(storedAssignments);
          setAssignments(new Map(Object.entries(parsed)));
        } catch (e) {
          console.error('Error parsing stored assignments:', e);
        }
      }

    } catch (error) {
      console.error('Error fetching step assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveAssignments = (newAssignments: Map<string, string>) => {
    // Save to localStorage
    const obj: Record<string, string> = {};
    newAssignments.forEach((value, key) => {
      obj[key] = value;
    });
    localStorage.setItem(getStorageKey(workOrderId), JSON.stringify(obj));
    
    // Also update operator_assignments for filtering
    updateOperatorAssignmentsTable(newAssignments);
  };

  const updateOperatorAssignmentsTable = async (newAssignments: Map<string, string>) => {
    // Get unique operators assigned
    const uniqueOperators = new Set(newAssignments.values());
    const assignedDate = scheduledDate || new Date().toISOString().split('T')[0];

    // Delete existing assignments for this work order
    await supabase
      .from('operator_assignments')
      .delete()
      .eq('work_order_id', workOrderId);

    // Insert new assignments for each unique operator
    if (uniqueOperators.size > 0) {
      const assignmentsToInsert = Array.from(uniqueOperators).map(operatorId => ({
        work_order_id: workOrderId,
        operator_id: operatorId,
        assigned_date: assignedDate,
        planned_hours: 4,
      }));

      await supabase
        .from('operator_assignments')
        .insert(assignmentsToInsert);
    }

    // Update work_orders.assigned_to with first operator (for backward compatibility)
    const firstOperator = Array.from(uniqueOperators)[0] || null;
    await supabase
      .from('work_orders')
      .update({ assigned_to: firstOperator })
      .eq('id', workOrderId);
  };

  const handleStepAssignment = async (stepId: string, operatorId: string) => {
    if (operatorId === 'unassigned') {
      // Remove assignment for this step only
      const newAssignments = new Map(assignments);
      newAssignments.delete(stepId);
      setAssignments(newAssignments);
      saveAssignments(newAssignments);
      onAssignmentChange?.();
      return;
    }

    // Check if operator is unavailable (0 hours)
    const avail = availability.get(operatorId);
    if (avail && avail.available_hours === 0) {
      toast.error(language === 'nl' 
        ? 'Deze operator is niet beschikbaar op de geplande datum' 
        : 'This operator is unavailable on the scheduled date');
      return;
    }

    setSaving(stepId);
    try {
      // Update this specific step assignment only
      const newAssignments = new Map(assignments);
      newAssignments.set(stepId, operatorId);
      setAssignments(newAssignments);
      saveAssignments(newAssignments);

      toast.success(language === 'nl' ? 'Stap toegewezen' : 'Step assigned');
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error assigning step:', error);
      toast.error(error.message || 'Failed to assign step');
    } finally {
      setSaving(null);
    }
  };

  const handleAssignAllSteps = async () => {
    if (!selectedOperatorForAll || selectedOperatorForAll === 'unassigned') {
      toast.error(language === 'nl' ? 'Selecteer eerst een operator' : 'Select an operator first');
      return;
    }

    // Check availability
    const avail = availability.get(selectedOperatorForAll);
    if (avail && avail.available_hours === 0) {
      toast.error(language === 'nl' 
        ? 'Deze operator is niet beschikbaar op de geplande datum' 
        : 'This operator is unavailable on the scheduled date');
      return;
    }

    setSaving('all');
    try {
      // Assign all steps to the selected operator
      const newAssignments = new Map<string, string>();
      steps.forEach(step => {
        newAssignments.set(step.id, selectedOperatorForAll);
      });
      setAssignments(newAssignments);
      saveAssignments(newAssignments);

      toast.success(language === 'nl' ? 'Alle stappen toegewezen' : 'All steps assigned');
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error assigning all steps:', error);
      toast.error(error.message || 'Failed to assign steps');
    } finally {
      setSaving(null);
    }
  };

  const handleClearAllAssignments = async () => {
    setSaving('clear');
    try {
      setAssignments(new Map());
      localStorage.removeItem(getStorageKey(workOrderId));
      
      // Clear database assignments
      await supabase
        .from('operator_assignments')
        .delete()
        .eq('work_order_id', workOrderId);

      await supabase
        .from('work_orders')
        .update({ assigned_to: null })
        .eq('id', workOrderId);

      toast.success(language === 'nl' ? 'Toewijzingen gewist' : 'Assignments cleared');
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error clearing assignments:', error);
    } finally {
      setSaving(null);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getStepTitle = (step: ProductionStep) => {
    return language === 'nl' && step.title_nl ? step.title_nl : step.title_en;
  };

  const getOperatorStatus = (operator: Operator) => {
    const avail = availability.get(operator.id);
    const workload = workloads.get(operator.id) || 0;
    const capacity = avail ? avail.available_hours : operator.daily_capacity_hours;
    const remaining = capacity - workload;
    
    return {
      isUnavailable: avail?.available_hours === 0,
      reason: avail?.reason || avail?.reason_type,
      capacity,
      workload,
      remaining,
      isOverloaded: remaining < 2,
    };
  };

  const assignedCount = assignments.size;
  const totalSteps = steps.length;

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

  if (steps.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Staptoewijzingen' : 'Step Assignments'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant={assignedCount === totalSteps ? 'default' : 'secondary'} className="font-mono">
              {assignedCount}/{totalSteps}
            </Badge>
            {assignedCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
                onClick={handleClearAllAssignments}
                disabled={saving === 'clear'}
              >
                {language === 'nl' ? 'Wis' : 'Clear'}
              </Button>
            )}
          </div>
        </div>
        <CardDescription className="text-xs">
          {language === 'nl' 
            ? 'Wijs operators toe aan specifieke productiestappen' 
            : 'Assign operators to specific production steps'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Assign All Toggle */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2">
            <Switch
              id="assign-all"
              checked={assignAllMode}
              onCheckedChange={setAssignAllMode}
            />
            <Label htmlFor="assign-all" className="text-sm cursor-pointer">
              {language === 'nl' ? 'Alle stappen aan één operator' : 'Assign all steps to one operator'}
            </Label>
          </div>
        </div>

        {assignAllMode ? (
          <div className="space-y-3">
            <Select
              value={selectedOperatorForAll}
              onValueChange={setSelectedOperatorForAll}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={language === 'nl' ? 'Selecteer operator...' : 'Select operator...'} />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => {
                  const status = getOperatorStatus(op);
                  return (
                    <SelectItem 
                      key={op.id} 
                      value={op.id} 
                      disabled={status.isUnavailable}
                    >
                      <div className="flex items-center justify-between w-full gap-3">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                            <AvatarFallback className="text-[10px]">
                              {getInitials(op.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{op.full_name}</span>
                        </div>
                        {status.isUnavailable ? (
                          <Badge variant="destructive" className="text-[9px] px-1 py-0">
                            {status.reason || (language === 'nl' ? 'Afwezig' : 'Away')}
                          </Badge>
                        ) : (
                          <span className={`text-xs ${status.isOverloaded ? 'text-warning' : 'text-muted-foreground'}`}>
                            {status.remaining}h {language === 'nl' ? 'vrij' : 'free'}
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Button 
              onClick={handleAssignAllSteps} 
              disabled={!selectedOperatorForAll || saving === 'all'}
              className="w-full"
            >
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
            {/* Operators Overview - Capacity & Availability */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">
                {language === 'nl' ? 'Beschikbare operators' : 'Available Operators'}
                {scheduledDate && (
                  <span className="ml-1 opacity-70">
                    ({new Date(scheduledDate).toLocaleDateString(language === 'nl' ? 'nl-NL' : 'en-US', { month: 'short', day: 'numeric' })})
                  </span>
                )}
              </p>
              <div className="flex flex-wrap gap-2">
                {operators.map((op) => {
                  const status = getOperatorStatus(op);
                  const assignedStepsCount = Array.from(assignments.values()).filter(id => id === op.id).length;
                  
                  return (
                    <div
                      key={op.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border text-xs ${
                        status.isUnavailable 
                          ? 'bg-destructive/5 border-destructive/20 opacity-60' 
                          : status.isOverloaded
                            ? 'bg-warning/5 border-warning/20'
                            : 'bg-muted/30 border-border/50'
                      }`}
                    >
                      <Avatar className="h-5 w-5">
                        {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                        <AvatarFallback className="text-[9px]">
                          {getInitials(op.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{op.full_name.split(' ')[0]}</span>
                      {status.isUnavailable ? (
                        <Badge variant="destructive" className="text-[9px] px-1 py-0">
                          {status.reason || (language === 'nl' ? 'Afwezig' : 'Off')}
                        </Badge>
                      ) : (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          <span className={status.isOverloaded ? 'text-warning' : ''}>
                            {status.remaining}/{status.capacity}h
                          </span>
                          {assignedStepsCount > 0 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0 ml-1">
                              {assignedStepsCount} {language === 'nl' ? 'stappen' : 'steps'}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <Separator />

            {/* Individual Step Assignments */}
            <div className="space-y-2">
              {steps.map((step) => {
                const assignedOperatorId = assignments.get(step.id);
                const assignedOperator = operators.find(op => op.id === assignedOperatorId);
                const isSaving = saving === step.id;

                return (
                  <div
                    key={step.id}
                    className="flex items-center justify-between gap-3 p-2.5 border rounded-lg bg-muted/30"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Badge variant="outline" className="shrink-0 font-mono text-xs">
                        {step.step_number}
                      </Badge>
                      <span className="text-sm truncate">{getStepTitle(step)}</span>
                    </div>
                    
                    <Select
                      value={assignedOperatorId || 'unassigned'}
                      onValueChange={(value) => handleStepAssignment(step.id, value)}
                      disabled={isSaving}
                    >
                      <SelectTrigger className="w-[160px] h-8 text-xs">
                        {isSaving ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : assignedOperator ? (
                          <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5">
                              {assignedOperator.avatar_url && <AvatarImage src={assignedOperator.avatar_url} />}
                              <AvatarFallback className="text-[9px]">
                                {getInitials(assignedOperator.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="truncate">{assignedOperator.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-warning" />
                            {language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
                          </span>
                        )}
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unassigned" className="text-xs">
                          <span className="text-muted-foreground">
                            {language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
                          </span>
                        </SelectItem>
                        {operators.map((op) => {
                          const status = getOperatorStatus(op);
                          return (
                            <SelectItem 
                              key={op.id} 
                              value={op.id} 
                              disabled={status.isUnavailable}
                              className="text-xs"
                            >
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                                  <AvatarFallback className="text-[9px]">
                                    {getInitials(op.full_name)}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{op.full_name}</span>
                                {status.isUnavailable ? (
                                  <Badge variant="destructive" className="text-[9px] px-1 py-0">
                                    {language === 'nl' ? 'Afwezig' : 'Away'}
                                  </Badge>
                                ) : (
                                  <span className={`text-[10px] ml-1 ${status.isOverloaded ? 'text-warning' : 'text-muted-foreground'}`}>
                                    ({status.remaining}h)
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          );
                        })}
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
