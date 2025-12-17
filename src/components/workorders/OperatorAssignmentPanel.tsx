import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Users, Plus, Trash2, Loader2, Calendar, UserPlus, ChevronDown, UsersRound, Package } from 'lucide-react';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_available: boolean;
}

interface Assignment {
  id: string;
  operator_id: string;
  work_order_id: string;
  assigned_date: string;
  operator?: Operator;
}

interface OperatorUnavailability {
  user_id: string;
  available_hours: number;
  reason: string | null;
  reason_type: string;
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
  const [unavailabilityMap, setUnavailabilityMap] = useState<Map<string, OperatorUnavailability>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Single assignment form
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [assignDate, setAssignDate] = useState(scheduledDate || format(new Date(), 'yyyy-MM-dd'));

  // Bulk assignment state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelectedOperators, setBulkSelectedOperators] = useState<Set<string>>(new Set());
  const [bulkSaving, setBulkSaving] = useState(false);

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
      const { data: assignmentData, error: assignError } = await supabase
        .from('operator_assignments')
        .select('*')
        .eq('work_order_id', workOrderId);

      if (assignError) throw assignError;

      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select(`user_id, team:teams(name)`)
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);
      
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000']);

      if (profilesError) throw profilesError;

      await fetchUnavailability(assignDate);

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

  const fetchUnavailability = async (date: string) => {
    try {
      const { data } = await (supabase
        .from('operator_availability' as any)
        .select('user_id, available_hours, reason, reason_type')
        .eq('date', date) as any);

      const unavailMap = new Map<string, OperatorUnavailability>();
      (data || []).forEach((entry: OperatorUnavailability) => {
        unavailMap.set(entry.user_id, entry);
      });
      setUnavailabilityMap(unavailMap);
    } catch (error) {
      console.error('Error fetching unavailability:', error);
    }
  };

  useEffect(() => {
    if (assignDate) {
      fetchUnavailability(assignDate);
      setBulkSelectedOperators(new Set());
    }
  }, [assignDate]);

  const addAssignment = async () => {
    if (!selectedOperator || !assignDate) return;

    const unavailability = unavailabilityMap.get(selectedOperator);
    if (unavailability && unavailability.available_hours === 0) {
      const reasonLabel = unavailability.reason_type === 'holiday' ? 'on holiday' :
                         unavailability.reason_type === 'sick' ? 'on sick leave' :
                         unavailability.reason_type === 'training' ? 'in training' : 'unavailable';
      toast.error(`This operator is ${reasonLabel} on ${format(new Date(assignDate), 'MMM d')}`);
      return;
    }

    setSaving(true);
    try {
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
        });

      if (error) throw error;

      toast.success('Operator assigned');
      fetchData();
      setSelectedOperator('');
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error adding assignment:', error);
      toast.error(error.message || 'Failed to assign operator');
    } finally {
      setSaving(false);
    }
  };

  const bulkAssign = async () => {
    if (bulkSelectedOperators.size === 0 || !assignDate) return;

    setBulkSaving(true);
    try {
      const operatorIds = Array.from(bulkSelectedOperators);
      const existingOperatorIds = new Set(
        assignments.filter(a => a.assigned_date === assignDate).map(a => a.operator_id)
      );

      // Filter out already assigned operators
      const newOperatorIds = operatorIds.filter(id => !existingOperatorIds.has(id));

      if (newOperatorIds.length === 0) {
        toast.error('All selected operators are already assigned for this date');
        return;
      }

      const insertData = newOperatorIds.map(operatorId => ({
        work_order_id: workOrderId,
        operator_id: operatorId,
        assigned_date: assignDate,
      }));

      const { error } = await supabase
        .from('operator_assignments')
        .insert(insertData);

      if (error) throw error;

      const skipped = operatorIds.length - newOperatorIds.length;
      const message = skipped > 0 
        ? `${newOperatorIds.length} operators assigned (${skipped} already assigned)`
        : `${newOperatorIds.length} operators assigned`;
      toast.success(message);
      
      fetchData();
      setBulkSelectedOperators(new Set());
      setBulkOpen(false);
      onAssignmentChange?.();
    } catch (error: any) {
      console.error('Error bulk assigning:', error);
      toast.error(error.message || 'Failed to assign operators');
    } finally {
      setBulkSaving(false);
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

  const availableOperators = operators.filter(op => 
    !assignments.some(a => a.operator_id === op.id && a.assigned_date === assignDate)
  );

  const isOperatorUnavailable = (operatorId: string) => {
    const unavail = unavailabilityMap.get(operatorId);
    return unavail && unavail.available_hours === 0;
  };

  const getUnavailabilityReason = (operatorId: string) => {
    const unavail = unavailabilityMap.get(operatorId);
    if (!unavail) return null;
    switch (unavail.reason_type) {
      case 'holiday': return 'Holiday';
      case 'sick': return 'Sick';
      case 'training': return 'Training';
      default: return 'Unavailable';
    }
  };

  const toggleBulkOperator = (operatorId: string) => {
    setBulkSelectedOperators(prev => {
      const next = new Set(prev);
      if (next.has(operatorId)) {
        next.delete(operatorId);
      } else {
        next.add(operatorId);
      }
      return next;
    });
  };

  const selectAllAvailable = () => {
    const availableIds = availableOperators
      .filter(op => !isOperatorUnavailable(op.id))
      .map(op => op.id);
    setBulkSelectedOperators(new Set(availableIds));
  };

  const clearBulkSelection = () => {
    setBulkSelectedOperators(new Set());
  };

  // Get daily assignment count for an operator
  const getOperatorDailyCount = (operatorId: string) => {
    return assignments.filter(a => a.operator_id === operatorId && a.assigned_date === assignDate).length;
  };

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
                  <Avatar className="h-9 w-9">
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
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-muted-foreground hover:text-destructive"
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

        {/* Bulk Assignment Section */}
        <Collapsible open={bulkOpen} onOpenChange={setBulkOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="outline" className="w-full justify-between h-11">
              <span className="flex items-center gap-2">
                <UsersRound className="h-4 w-4" />
                Bulk Assign Operators
                {bulkSelectedOperators.size > 0 && (
                  <Badge variant="secondary" className="ml-1">{bulkSelectedOperators.size}</Badge>
                )}
              </span>
              <ChevronDown className={`h-4 w-4 transition-transform ${bulkOpen ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Select operators for {format(new Date(assignDate), 'MMM d')}</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={selectAllAvailable}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearBulkSelection}>
                  Clear
                </Button>
              </div>
            </div>
            
            <div className="grid gap-2 max-h-[240px] overflow-y-auto pr-1">
              {availableOperators.map(op => {
                const unavailable = isOperatorUnavailable(op.id);
                const reason = getUnavailabilityReason(op.id);
                const isSelected = bulkSelectedOperators.has(op.id);
                const dailyCount = getOperatorDailyCount(op.id);
                
                return (
                  <label
                    key={op.id}
                    className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors min-h-[52px] ${
                      unavailable ? 'opacity-50 cursor-not-allowed bg-muted/30' :
                      isSelected ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'
                    }`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => !unavailable && toggleBulkOperator(op.id)}
                      disabled={unavailable}
                      className="h-5 w-5"
                    />
                    <Avatar className="h-8 w-8">
                      {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                      <AvatarFallback className="text-xs">{getInitials(op.full_name)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium">{op.full_name}</span>
                      {dailyCount > 0 && (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          ({dailyCount} assignment{dailyCount > 1 ? 's' : ''} today)
                        </span>
                      )}
                    </div>
                    {unavailable && reason && (
                      <Badge variant="destructive" className="text-xs shrink-0">{reason}</Badge>
                    )}
                  </label>
                );
              })}
              {availableOperators.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">All operators already assigned</p>
              )}
            </div>

            <div className="flex items-center gap-3 pt-2 border-t">
              <Button
                onClick={bulkAssign}
                disabled={bulkSelectedOperators.size === 0 || bulkSaving}
                className="h-11 flex-1"
              >
                {bulkSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <UsersRound className="h-4 w-4 mr-2" />
                    Assign {bulkSelectedOperators.size > 0 ? `(${bulkSelectedOperators.size})` : ''}
                  </>
                )}
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Single Add Assignment Form */}
        <div className="pt-4 border-t space-y-3">
          <h4 className="text-sm font-medium flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Add Single Assignment
          </h4>
          
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Operator</Label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select operator" />
                </SelectTrigger>
                <SelectContent>
                  {availableOperators.length === 0 ? (
                    <div className="p-2 text-sm text-muted-foreground text-center">
                      No available operators
                    </div>
                  ) : (
                    availableOperators.map(op => {
                      const unavailable = isOperatorUnavailable(op.id);
                      const reason = getUnavailabilityReason(op.id);
                      return (
                        <SelectItem key={op.id} value={op.id} disabled={unavailable}>
                          <div className="flex items-center gap-2">
                            <span className={unavailable ? 'text-muted-foreground' : ''}>{op.full_name}</span>
                            {unavailable && reason && (
                              <Badge variant="destructive" className="text-xs">{reason}</Badge>
                            )}
                            {!unavailable && !op.is_available && (
                              <Badge variant="secondary" className="text-xs">Away</Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })
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
                className="h-11"
              />
            </div>
          </div>

          <Button
            onClick={addAssignment}
            disabled={!selectedOperator || saving}
            className="h-11 w-full sm:w-auto"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Assign Operator
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default OperatorAssignmentPanel;
