import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  Clock,
  AlertTriangle,
  Loader2,
  Check,
  X
} from 'lucide-react';
import { format } from 'date-fns';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  daily_capacity_hours: number;
  is_available: boolean;
  currentHours: number;
}

interface OperatorAssignment {
  operatorId: string;
  plannedHours: number;
}

interface OperatorAssignmentSelectProps {
  selectedDate: Date;
  workOrderId?: string;
  initialAssignments?: OperatorAssignment[];
  onChange: (assignments: OperatorAssignment[]) => void;
  compact?: boolean;
}

export function OperatorAssignmentSelect({
  selectedDate,
  workOrderId,
  initialAssignments = [],
  onChange,
  compact = false
}: OperatorAssignmentSelectProps) {
  const { language } = useLanguage();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [assignments, setAssignments] = useState<OperatorAssignment[]>(initialAssignments);
  const [expanded, setExpanded] = useState(!compact);

  useEffect(() => {
    loadOperators();
  }, [selectedDate]);

  useEffect(() => {
    setAssignments(initialAssignments);
  }, [initialAssignments]);

  const loadOperators = async () => {
    try {
      setLoading(true);
      const dateStr = format(selectedDate, 'yyyy-MM-dd');

      // First try to get the Production team
      const { data: productionTeam } = await supabase
        .from('teams' as any)
        .select('id')
        .eq('name', 'Production')
        .single() as { data: { id: string } | null; error: any };

      let profilesData: { id: string; full_name: string; avatar_url: string | null; role: string; daily_capacity_hours: number; is_available: boolean }[] | null = null;

      if (productionTeam) {
        // Fetch operators from Production team
        const { data: teamMembers, error: teamError } = await supabase
          .from('user_teams' as any)
          .select('user_id')
          .eq('team_id', productionTeam.id) as { data: { user_id: string }[] | null; error: any };

        if (!teamError && teamMembers && teamMembers.length > 0) {
          const userIds = teamMembers.map(m => m.user_id);
          const { data, error } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, role, daily_capacity_hours, is_available')
            .in('id', userIds) as { data: typeof profilesData; error: any };
          
          if (!error) {
            profilesData = data;
          }
        }
      }

      // Fallback to role-based query if no Production team or no members
      if (!profilesData || profilesData.length === 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role, daily_capacity_hours, is_available')
          .in('role', ['operator', 'supervisor', 'admin']) as { data: typeof profilesData; error: any };

        if (!error) {
          profilesData = data;
        }
      }

      // Fetch existing assignments for this date
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('operator_assignments' as any)
        .select('operator_id, planned_hours, work_order_id')
        .eq('assigned_date', dateStr) as { data: { operator_id: string; planned_hours: number; work_order_id: string }[] | null; error: any };

      if (assignmentsError) throw assignmentsError;

      // Calculate current workload per operator
      const operatorsWithLoad: Operator[] = (profilesData || []).map(profile => {
        const existingHours = (assignmentsData || [])
          .filter(a => a.operator_id === profile.id)
          // Exclude hours from the current work order (if editing)
          .filter(a => !workOrderId || a.work_order_id !== workOrderId)
          .reduce((sum, a) => sum + a.planned_hours, 0);

        return {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
          daily_capacity_hours: profile.daily_capacity_hours || 8,
          is_available: profile.is_available !== false,
          currentHours: existingHours,
        };
      });

      // Sort by availability then by remaining capacity
      operatorsWithLoad.sort((a, b) => {
        if (a.is_available !== b.is_available) return a.is_available ? -1 : 1;
        const aRemaining = a.daily_capacity_hours - a.currentHours;
        const bRemaining = b.daily_capacity_hours - b.currentHours;
        return bRemaining - aRemaining;
      });

      setOperators(operatorsWithLoad);
    } catch (error) {
      console.error('Failed to load operators:', error);
    } finally {
      setLoading(false);
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

  const isAssigned = (operatorId: string) => {
    return assignments.some(a => a.operatorId === operatorId);
  };

  const getAssignment = (operatorId: string) => {
    return assignments.find(a => a.operatorId === operatorId);
  };

  const toggleOperator = (operator: Operator) => {
    let newAssignments: OperatorAssignment[];
    if (isAssigned(operator.id)) {
      newAssignments = assignments.filter(a => a.operatorId !== operator.id);
    } else {
      // Default to remaining capacity or 4 hours
      const remainingHours = operator.daily_capacity_hours - operator.currentHours;
      const defaultHours = Math.min(Math.max(remainingHours, 0), 4);
      newAssignments = [...assignments, { operatorId: operator.id, plannedHours: defaultHours || 4 }];
    }
    setAssignments(newAssignments);
    onChange(newAssignments);
  };

  const updateHours = (operatorId: string, hours: number) => {
    const newAssignments = assignments.map(a =>
      a.operatorId === operatorId ? { ...a, plannedHours: hours } : a
    );
    setAssignments(newAssignments);
    onChange(newAssignments);
  };

  const getCapacityColor = (operator: Operator, assignedHours: number = 0) => {
    const totalHours = operator.currentHours + assignedHours;
    const utilization = (totalHours / operator.daily_capacity_hours) * 100;
    if (utilization >= 100) return 'text-red-600';
    if (utilization >= 80) return 'text-amber-600';
    return 'text-green-600';
  };

  const availableOperators = operators.filter(o => o.is_available);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (compact && !expanded) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full justify-start"
        onClick={() => setExpanded(true)}
      >
        <Users className="h-4 w-4 mr-2" />
        {assignments.length > 0 ? (
          <span>
            {assignments.length} {language === 'nl' ? 'operator(s) toegewezen' : 'operator(s) assigned'}
          </span>
        ) : (
          <span className="text-muted-foreground">
            {language === 'nl' ? 'Operators toewijzen' : 'Assign operators'}
          </span>
        )}
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-medium flex items-center gap-2">
          <Users className="h-4 w-4" />
          {language === 'nl' ? 'Operators Toewijzen' : 'Assign Operators'}
        </Label>
        {compact && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setExpanded(false)}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <ScrollArea className="h-[180px] border rounded-md">
        <div className="p-2 space-y-1">
          {availableOperators.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {language === 'nl' ? 'Geen operators beschikbaar' : 'No operators available'}
            </p>
          ) : (
            availableOperators.map(operator => {
              const assigned = isAssigned(operator.id);
              const assignment = getAssignment(operator.id);
              const remainingHours = operator.daily_capacity_hours - operator.currentHours;
              const isOverloaded = remainingHours <= 0;
              const wouldOverload = assignment && (operator.currentHours + assignment.plannedHours) > operator.daily_capacity_hours;

              return (
                <div
                  key={operator.id}
                  className={`flex items-center gap-2 p-2 rounded-md transition-colors ${
                    assigned ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50'
                  }`}
                >
                  <button
                    type="button"
                    className="flex items-center gap-2 flex-1 text-left"
                    onClick={() => toggleOperator(operator)}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                      assigned ? 'bg-primary border-primary' : 'border-muted-foreground/30'
                    }`}>
                      {assigned && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={operator.avatar_url || undefined} />
                      <AvatarFallback className="text-[10px]">
                        {getInitials(operator.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium truncate block">
                        {operator.full_name}
                      </span>
                      <span className={`text-xs ${getCapacityColor(operator, assignment?.plannedHours || 0)}`}>
                        {operator.currentHours}h / {operator.daily_capacity_hours}h
                        {remainingHours > 0 && ` (${remainingHours}h ${language === 'nl' ? 'vrij' : 'free'})`}
                      </span>
                    </div>
                  </button>

                  {assigned && (
                    <div className="flex items-center gap-1">
                      {wouldOverload && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger>
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                            </TooltipTrigger>
                            <TooltipContent>
                              {language === 'nl' ? 'Overschrijdt capaciteit' : 'Exceeds capacity'}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                      <Input
                        type="number"
                        min="0.5"
                        max="12"
                        step="0.5"
                        value={assignment?.plannedHours || 4}
                        onChange={(e) => updateHours(operator.id, parseFloat(e.target.value) || 0)}
                        className="w-16 h-7 text-xs text-center"
                        onClick={(e) => e.stopPropagation()}
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {assignments.length > 0 && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            {assignments.length} {language === 'nl' ? 'toegewezen' : 'assigned'}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {assignments.reduce((sum, a) => sum + a.plannedHours, 0)}h {language === 'nl' ? 'totaal' : 'total'}
          </span>
        </div>
      )}
    </div>
  );
}

export default OperatorAssignmentSelect;
