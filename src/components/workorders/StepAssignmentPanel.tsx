import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { Users, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';

interface ProductionStep {
  id: string;
  step_number: number;
  title_en: string;
  title_nl: string;
}

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface StepAssignment {
  step_id: string;
  operator_id: string | null;
}

interface StepAssignmentPanelProps {
  workOrderId: string;
  productType: string;
  scheduledDate?: string | null;
  onAssignmentChange?: () => void;
}

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
  const [unavailableOperatorIds, setUnavailableOperatorIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [workOrderId, productType]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch production steps for this product type
      const { data: stepsData, error: stepsError } = await supabase
        .from('production_steps')
        .select('id, step_number, title_en, title_nl')
        .eq('product_type', productType as any)
        .order('step_number');

      if (stepsError) throw stepsError;
      setSteps(stepsData || []);

      // Fetch production team operators
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      setOperators(profilesData || []);

      // Check operator availability for scheduled date
      if (scheduledDate) {
        const { data: availabilityData } = await supabase
          .from('operator_availability')
          .select('user_id, available_hours')
          .eq('date', scheduledDate)
          .eq('available_hours', 0);

        const unavailIds = new Set<string>((availabilityData || []).map((a: any) => a.user_id as string));
        setUnavailableOperatorIds(unavailIds);
      }

      // Fetch existing assignments for this work order
      const { data: assignmentData } = await supabase
        .from('operator_assignments')
        .select('*')
        .eq('work_order_id', workOrderId);

      // Build assignment map (using operator_id as we'll extend this later with step support)
      const assignMap = new Map<string, string>();
      // For now, we'll assign the same operator to all steps if there's a work order assignment
      if (assignmentData && assignmentData.length > 0) {
        const primaryAssignment = assignmentData[0];
        (stepsData || []).forEach(step => {
          assignMap.set(step.id, primaryAssignment.operator_id);
        });
      }
      setAssignments(assignMap);

    } catch (error) {
      console.error('Error fetching step assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignmentChange = async (stepId: string, operatorId: string) => {
    if (operatorId === 'unassigned') {
      // Remove assignment
      setAssignments(prev => {
        const next = new Map(prev);
        next.delete(stepId);
        return next;
      });
      onAssignmentChange?.();
      return;
    }

    // Check if operator is unavailable
    if (unavailableOperatorIds.has(operatorId)) {
      toast.error(language === 'nl' 
        ? 'Deze operator is niet beschikbaar op de geplande datum' 
        : 'This operator is unavailable on the scheduled date');
      return;
    }

    setSaving(stepId);
    try {
      // Update local state immediately for better UX
      setAssignments(prev => {
        const next = new Map(prev);
        next.set(stepId, operatorId);
        return next;
      });

      // For now, we'll use the operator_assignments table
      // In the future, this could be extended to a step_assignments table
      const assignedDate = scheduledDate || new Date().toISOString().split('T')[0];
      
      // Upsert the assignment
      const { error } = await supabase
        .from('operator_assignments')
        .upsert({
          work_order_id: workOrderId,
          operator_id: operatorId,
          assigned_date: assignedDate,
          planned_hours: 4,
        }, {
          onConflict: 'work_order_id,operator_id,assigned_date'
        });

      if (error) throw error;

      toast.success(language === 'nl' ? 'Operator toegewezen' : 'Operator assigned');
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error assigning operator:', error);
      toast.error(error.message || 'Failed to assign operator');
      // Revert on error
      fetchData();
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
          <Badge variant={assignedCount === totalSteps ? 'default' : 'secondary'} className="font-mono">
            {assignedCount}/{totalSteps}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {language === 'nl' 
            ? 'Wijs operators toe aan specifieke productiestappen' 
            : 'Assign operators to specific production steps'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
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
                onValueChange={(value) => handleAssignmentChange(step.id, value)}
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
                    const isUnavailable = unavailableOperatorIds.has(op.id);
                    return (
                      <SelectItem 
                        key={op.id} 
                        value={op.id} 
                        disabled={isUnavailable}
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
                          {isUnavailable && (
                            <Badge variant="destructive" className="text-[9px] px-1 py-0">
                              {language === 'nl' ? 'Afwezig' : 'Away'}
                            </Badge>
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
      </CardContent>
    </Card>
  );
};

export default StepAssignmentPanel;
