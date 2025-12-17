import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar, Users, GripVertical, Package, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  daily_capacity_hours: number;
  is_available: boolean;
}

interface WorkOrder {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  scheduled_date: string | null;
  customer_name: string | null;
}

interface Assignment {
  id: string;
  work_order_id: string;
  operator_id: string;
  assigned_date: string;
  planned_hours: number;
  work_order?: WorkOrder;
}

interface Availability {
  user_id: string;
  date: string;
  available_hours: number;
  reason_type: string;
  reason: string | null;
}

interface DraggableWorkOrderProps {
  assignment: Assignment;
  workOrder: WorkOrder;
}

interface DroppableCellProps {
  operatorId: string;
  date: Date;
  children: React.ReactNode;
  isOver?: boolean;
}

const DraggableWorkOrder: React.FC<DraggableWorkOrderProps> = ({ assignment, workOrder }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: assignment.id,
    data: { assignment, workOrder },
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    opacity: isDragging ? 0.5 : 1,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "p-1.5 rounded text-xs bg-primary/10 border border-primary/20 cursor-grab active:cursor-grabbing",
        "hover:bg-primary/20 transition-colors",
        isDragging && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center gap-1">
        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] truncate">{workOrder.wo_number}</p>
          <p className="text-[9px] text-muted-foreground truncate">
            {assignment.planned_hours}h
          </p>
        </div>
      </div>
    </div>
  );
};

const DroppableCell: React.FC<DroppableCellProps> = ({ operatorId, date, children, isOver }) => {
  const { setNodeRef } = useDroppable({
    id: `${operatorId}-${format(date, 'yyyy-MM-dd')}`,
    data: { operatorId, date },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[80px] p-1 border-l transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset"
      )}
    >
      {children}
    </div>
  );
};

const WeeklyCapacityPlanner: React.FC = () => {
  const { language } = useLanguage();
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [operators, setOperators] = useState<Operator[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [workOrders, setWorkOrders] = useState<Map<string, WorkOrder>>(new Map());
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    })
  );

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(currentWeekStart, i));
  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });

  useEffect(() => {
    fetchData();
  }, [currentWeekStart]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const startStr = format(currentWeekStart, 'yyyy-MM-dd');
      const endStr = format(weekEnd, 'yyyy-MM-dd');

      // Fetch production team operators
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, daily_capacity_hours, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('full_name');

      setOperators(profilesData || []);

      // Fetch assignments for the week
      const { data: assignmentsData } = await supabase
        .from('operator_assignments')
        .select('id, work_order_id, operator_id, assigned_date, planned_hours')
        .gte('assigned_date', startStr)
        .lte('assigned_date', endStr);

      // Fetch work orders for assignments
      const woIds = [...new Set((assignmentsData || []).map(a => a.work_order_id))];
      if (woIds.length > 0) {
        const { data: woData } = await supabase
          .from('work_orders')
          .select('id, wo_number, product_type, batch_size, status, scheduled_date, customer_name')
          .in('id', woIds);

        const woMap = new Map<string, WorkOrder>();
        (woData || []).forEach(wo => woMap.set(wo.id, wo));
        setWorkOrders(woMap);
      }

      setAssignments(assignmentsData || []);

      // Fetch availability for the week
      const { data: availData } = await supabase
        .from('operator_availability')
        .select('user_id, date, available_hours, reason_type, reason')
        .gte('date', startStr)
        .lte('date', endStr);

      setAvailability(availData || []);
    } catch (error) {
      console.error('Error fetching capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getAssignmentsForCell = (operatorId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return assignments.filter(
      a => a.operator_id === operatorId && a.assigned_date === dateStr
    );
  };

  const getAvailability = (operatorId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    return availability.find(a => a.user_id === operatorId && a.date === dateStr);
  };

  const getWorkload = (operatorId: string, date: Date) => {
    const cellAssignments = getAssignmentsForCell(operatorId, date);
    return cellAssignments.reduce((sum, a) => sum + a.planned_hours, 0);
  };

  const getCapacity = (operator: Operator, date: Date) => {
    const avail = getAvailability(operator.id, date);
    return avail ? avail.available_hours : operator.daily_capacity_hours;
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    if ('ontouchstart' in window) {
      navigator.vibrate?.(10);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    
    const { active, over } = event;
    if (!over) return;

    const assignment = (active.data.current as any)?.assignment as Assignment;
    if (!assignment) return;

    const dropData = over.data.current as { operatorId: string; date: Date } | undefined;
    if (!dropData) return;

    const newOperatorId = dropData.operatorId;
    const newDate = format(dropData.date, 'yyyy-MM-dd');

    // Don't update if same cell
    if (assignment.operator_id === newOperatorId && assignment.assigned_date === newDate) {
      return;
    }

    // Check availability
    const operator = operators.find(op => op.id === newOperatorId);
    if (operator) {
      const avail = getAvailability(newOperatorId, dropData.date);
      if (avail && avail.available_hours === 0) {
        toast.error(language === 'nl' 
          ? 'Operator niet beschikbaar op deze datum' 
          : 'Operator unavailable on this date');
        return;
      }
    }

    try {
      const { error } = await supabase
        .from('operator_assignments')
        .update({
          operator_id: newOperatorId,
          assigned_date: newDate,
        })
        .eq('id', assignment.id);

      if (error) throw error;

      // Optimistically update local state
      setAssignments(prev => prev.map(a => 
        a.id === assignment.id 
          ? { ...a, operator_id: newOperatorId, assigned_date: newDate }
          : a
      ));

      toast.success(language === 'nl' ? 'Toewijzing verplaatst' : 'Assignment moved');
      
      if ('ontouchstart' in window) {
        navigator.vibrate?.(20);
      }
    } catch (error) {
      console.error('Error moving assignment:', error);
      toast.error(language === 'nl' ? 'Verplaatsen mislukt' : 'Failed to move assignment');
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const activeAssignment = activeId 
    ? assignments.find(a => a.id === activeId) 
    : null;
  const activeWorkOrder = activeAssignment 
    ? workOrders.get(activeAssignment.work_order_id) 
    : null;

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Weekcapaciteit' : 'Weekly Capacity'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(subWeeks(currentWeekStart, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              {language === 'nl' ? 'Vandaag' : 'Today'}
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setCurrentWeekStart(addWeeks(currentWeekStart, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <ScrollArea className="w-full">
            <div className="min-w-[800px]">
              {/* Header row */}
              <div className="flex border-b bg-muted/30">
                <div className="w-40 flex-shrink-0 p-2 border-r">
                  <span className="text-xs font-medium text-muted-foreground">
                    {language === 'nl' ? 'Operator' : 'Operator'}
                  </span>
                </div>
                {weekDays.map(day => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "flex-1 min-w-[100px] p-2 text-center border-l",
                      isSameDay(day, new Date()) && "bg-primary/10"
                    )}
                  >
                    <div className="text-xs font-medium">
                      {format(day, 'EEE')}
                    </div>
                    <div className={cn(
                      "text-sm font-semibold",
                      isSameDay(day, new Date()) && "text-primary"
                    )}>
                      {format(day, 'd')}
                    </div>
                  </div>
                ))}
              </div>

              {/* Operator rows */}
              {operators.map(operator => (
                <div key={operator.id} className="flex border-b hover:bg-muted/10">
                  <div className="w-40 flex-shrink-0 p-2 border-r">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        {operator.avatar_url && <AvatarImage src={operator.avatar_url} />}
                        <AvatarFallback className="text-[9px]">
                          {getInitials(operator.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium truncate">
                          {operator.full_name.split(' ')[0]}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {operator.daily_capacity_hours}h/day
                        </p>
                      </div>
                    </div>
                  </div>

                  {weekDays.map(day => {
                    const cellAssignments = getAssignmentsForCell(operator.id, day);
                    const capacity = getCapacity(operator, day);
                    const workload = getWorkload(operator.id, day);
                    const utilization = capacity > 0 ? (workload / capacity) * 100 : 0;
                    const isUnavailable = capacity === 0;
                    const avail = getAvailability(operator.id, day);
                    const isOver = activeId !== null; // simplified - would need more context

                    return (
                      <DroppableCell
                        key={day.toISOString()}
                        operatorId={operator.id}
                        date={day}
                      >
                        <div className={cn(
                          "h-full",
                          isUnavailable && "bg-destructive/5"
                        )}>
                          {isUnavailable ? (
                            <div className="flex items-center justify-center h-full">
                              <Badge variant="outline" className="text-[9px] bg-destructive/10 border-destructive/30">
                                {avail?.reason_type || (language === 'nl' ? 'Afwezig' : 'Off')}
                              </Badge>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              {/* Capacity indicator */}
                              <div className="flex items-center justify-between px-1">
                                <span className={cn(
                                  "text-[9px]",
                                  utilization > 100 ? "text-destructive" :
                                  utilization > 80 ? "text-warning" :
                                  "text-muted-foreground"
                                )}>
                                  {workload}/{capacity}h
                                </span>
                                {utilization > 100 && (
                                  <AlertTriangle className="h-3 w-3 text-destructive" />
                                )}
                              </div>

                              {/* Assignments */}
                              <div className="space-y-1">
                                {cellAssignments.map(assignment => {
                                  const wo = workOrders.get(assignment.work_order_id);
                                  if (!wo) return null;
                                  return (
                                    <DraggableWorkOrder
                                      key={assignment.id}
                                      assignment={assignment}
                                      workOrder={wo}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      </DroppableCell>
                    );
                  })}
                </div>
              ))}

              {operators.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  {language === 'nl' 
                    ? 'Geen operators in het productieteam' 
                    : 'No operators in production team'}
                </div>
              )}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>

          <DragOverlay>
            {activeAssignment && activeWorkOrder && (
              <div className="p-2 rounded bg-primary text-primary-foreground shadow-lg text-xs">
                <div className="font-mono">{activeWorkOrder.wo_number}</div>
                <div className="text-[10px] opacity-80">
                  {activeAssignment.planned_hours}h
                </div>
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </CardContent>
    </Card>
  );
};

export default WeeklyCapacityPlanner;
