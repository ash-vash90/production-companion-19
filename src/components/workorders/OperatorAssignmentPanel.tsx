import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Users, Plus, Trash2, Loader2, Calendar, Clock, UserPlus } from 'lucide-react';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  daily_capacity_hours: number;
  is_available: boolean;
}

interface Assignment {
  id: string;
  operator_id: string;
  work_order_id: string;
  assigned_date: string;
  planned_hours: number;
  operator?: Operator;
}

interface OperatorAssignmentPanelProps {
  workOrderId: string;
  scheduledDate?: string | null;
  onAssignmentChange?: () => void;
}

const OperatorAssignmentPanel: React.FC<OperatorAssignmentPanelProps> = ({
  workOrderId,
  scheduledDate,
  onAssignmentChange,
}) => {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // New assignment form
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [plannedHours, setPlannedHours] = useState('4');
  const [assignDate, setAssignDate] = useState(scheduledDate || format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    fetchData();
  }, [workOrderId]);

  useEffect(() => {
    if (scheduledDate) {
      setAssignDate(scheduledDate);
    }
  }, [scheduledDate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch assignments for this work order
      const { data: assignmentData, error: assignError } = await supabase
        .from('operator_assignments')
        .select('*')
        .eq('work_order_id', workOrderId);

      if (assignError) throw assignError;

      // Fetch all available operators (users in Production team)
      const { data: teamMembers, error: teamError } = await supabase
        .from('user_teams')
        .select(`
          user_id,
          team:teams(name)
        `)
        .eq('team.name', 'Production');

      // Get profiles for team members
      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, daily_capacity_hours, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      if (profilesError) throw profilesError;

      // Map operator data to assignments
      const profileMap = new Map((profilesData || []).map(p => [p.id, p]));
      const enrichedAssignments = (assignmentData || []).map(a => ({
        ...a,
        operator: profileMap.get(a.operator_id),
      }));

      setAssignments(enrichedAssignments);
      setOperators(profilesData || []);
    } catch (error) {
      console.error('Error fetching assignment data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addAssignment = async () => {
    if (!selectedOperator || !assignDate) return;

    setSaving(true);
    try {
      // Check for existing assignment
      const existing = assignments.find(
        a => a.operator_id === selectedOperator && a.assigned_date === assignDate
      );

      if (existing) {
        toast.error('This operator is already assigned for this date');
        return;
      }

      const { error } = await supabase
        .from('operator_assignments')
        .insert({
          work_order_id: workOrderId,
          operator_id: selectedOperator,
          assigned_date: assignDate,
          planned_hours: parseFloat(plannedHours) || 4,
        });

      if (error) throw error;

      toast.success('Operator assigned');
      fetchData();
      setSelectedOperator('');
      setPlannedHours('4');
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error adding assignment:', error);
      toast.error(error.message || 'Failed to assign operator');
    } finally {
      setSaving(false);
    }
  };

  const removeAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('operator_assignments')
        .delete()
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Assignment removed');
      fetchData();
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error removing assignment:', error);
      toast.error(error.message || 'Failed to remove assignment');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Get operators not yet assigned for the selected date
  const availableOperators = operators.filter(op => 
    !assignments.some(a => a.operator_id === op.id && a.assigned_date === assignDate)
  );

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

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Users className="h-5 w-5" />
          Operator Assignments
        </CardTitle>
        <CardDescription>
          Assign operators to work on this order
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Assignments */}
        {assignments.length > 0 ? (
          <div className="space-y-2">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    {assignment.operator?.avatar_url && (
                      <AvatarImage src={assignment.operator.avatar_url} />
                    )}
                    <AvatarFallback className="text-xs">
                      {assignment.operator ? getInitials(assignment.operator.full_name) : '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-sm">
                      {assignment.operator?.full_name || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>{format(new Date(assignment.assigned_date), 'MMM d, yyyy')}</span>
                      <Clock className="h-3 w-3 ml-1" />
                      <span>{assignment.planned_hours}h</span>
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAssignment(assignment.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 border rounded-lg border-dashed">
            <UserPlus className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No operators assigned yet</p>
          </div>
        )}

        {/* Add Assignment Form */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Assignment
          </h4>
          
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operator</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No available operators
                    </div>
                  ) : (
                    availableOperators.map(op => (
                      <SelectItem key={op.id} value={op.id}>
                        <div className="flex items-center gap-2">
                          <span>{op.full_name}</span>
                          {!op.is_available && (
                            <Badge variant="secondary" className="text-xs">Away</Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="flex items-end gap-3">
            <div className="space-y-1.5 flex-1 max-w-[120px]">
              <Label className="text-xs">Hours</Label>
              <Input
                type="number"
                min="0.5"
                max="24"
                step="0.5"
                value={plannedHours}
                onChange={(e) => setPlannedHours(e.target.value)}
                className="h-9"
              />
            </div>
            <Button
              onClick={addAssignment}
              disabled={!selectedOperator || saving}
              className="h-9"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  Assign
                </>
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default OperatorAssignmentPanel;
