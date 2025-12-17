import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, Users, GripVertical, Package, AlertTriangle, X, Calendar } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';
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
import ProductAssignmentSheet from '@/components/workorders/ProductAssignmentSheet';

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
  start_date: string | null;
  customer_name: string | null;
}

interface Assignment {
  id: string;
  work_order_id: string;
  operator_id: string;
  assigned_date: string;
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
  onTap?: () => void;
}

interface DraggableUnassignedOrderProps {
  workOrder: WorkOrder;
  onTap?: () => void;
}

interface DroppableCellProps {
  operatorId: string;
  date: Date;
  children: React.ReactNode;
}

const DraggableWorkOrder: React.FC<DraggableWorkOrderProps> = ({ assignment, workOrder, onTap }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: assignment.id,
    data: { type: 'assignment', assignment, workOrder },
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
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onTap?.();
        }
      }}
      className={cn(
        "p-1.5 rounded text-xs bg-primary/10 border border-primary/20 cursor-grab active:cursor-grabbing",
        "hover:bg-primary/20 transition-colors touch-manipulation",
        isDragging && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center gap-1">
        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] truncate">{workOrder.wo_number}</p>
          <p className="text-[9px] text-muted-foreground truncate">
            {formatProductType(workOrder.product_type)}
          </p>
        </div>
      </div>
    </div>
  );
};

const DraggableUnassignedOrder: React.FC<DraggableUnassignedOrderProps> = ({ workOrder, onTap }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `unassigned-${workOrder.id}`,
    data: { type: 'unassigned', workOrder },
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
      onClick={(e) => {
        if (!isDragging) {
          e.stopPropagation();
          onTap?.();
        }
      }}
      className={cn(
        "p-2 rounded-lg border bg-card cursor-grab active:cursor-grabbing",
        "hover:border-primary/50 hover:bg-muted/30 transition-colors touch-manipulation",
        isDragging && "ring-2 ring-primary shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-xs font-medium truncate">{workOrder.wo_number}</p>
          <p className="text-[10px] text-muted-foreground truncate">
            {formatProductType(workOrder.product_type)}
          </p>
          {workOrder.customer_name && (
            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
              {workOrder.customer_name}
            </p>
          )}
        </div>
        <Badge variant="outline" className="text-[9px] shrink-0">
          {workOrder.batch_size}x
        </Badge>
      </div>
    </div>
  );
};

const DroppableCell: React.FC<DroppableCellProps> = ({ operatorId, date, children }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `${operatorId}-${format(date, 'yyyy-MM-dd')}`,
    data: { operatorId, date },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[70px] p-1 border-l transition-colors",
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
  const [unassignedOrders, setUnassignedOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'assignment' | 'unassigned' | null>(null);
  const [showSidebar, setShowSidebar] = useState(true);
  
  // Assignment sheet state
  const [assignmentSheetOpen, setAssignmentSheetOpen] = useState(false);
  const [selectedWorkOrder, setSelectedWorkOrder] = useState<WorkOrder | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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
        .select('id, work_order_id, operator_id, assigned_date')
        .gte('assigned_date', startStr)
        .lte('assigned_date', endStr);

      setAssignments(assignmentsData || []);

      // Fetch work orders for assignments
      const woIds = [...new Set((assignmentsData || []).map(a => a.work_order_id))];
      if (woIds.length > 0) {
        const { data: woData } = await supabase
          .from('work_orders')
          .select('id, wo_number, product_type, batch_size, status, scheduled_date, start_date, customer_name')
          .in('id', woIds);

        const woMap = new Map<string, WorkOrder>();
        (woData || []).forEach(wo => woMap.set(wo.id, wo));
        setWorkOrders(woMap);
      }

      // Fetch availability for the week
      const { data: availData } = await supabase
        .from('operator_availability')
        .select('user_id, date, available_hours, reason_type, reason')
        .gte('date', startStr)
        .lte('date', endStr);

      setAvailability(availData || []);

      // Fetch unassigned work orders
      const { data: unassignedData } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, scheduled_date, start_date, customer_name')
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter to orders without assignments
      const assignedWoIds = new Set((assignmentsData || []).map(a => a.work_order_id));
      const unassigned = (unassignedData || []).filter(wo => !assignedWoIds.has(wo.id));
      setUnassignedOrders(unassigned);

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

  // Get assignment count for a cell (daily planning - no hours)
  const getAssignmentCount = (operatorId: string, date: Date) => {
    return getAssignmentsForCell(operatorId, date).length;
  };

  // Get daily totals - count of assignments per day
  const getDailyTotals = (date: Date) => {
    let totalAssignments = 0;
    let availableOperators = 0;

    operators.forEach(op => {
      const avail = getAvailability(op.id, date);
      const isAvailable = !avail || avail.available_hours > 0;
      if (isAvailable) {
        availableOperators++;
        totalAssignments += getAssignmentCount(op.id, date);
      }
    });

    return { totalAssignments, availableOperators };
  };

  const handleDragStart = (event: DragStartEvent) => {
    const data = event.active.data.current as any;
    setActiveId(event.active.id as string);
    setActiveType(data?.type || null);
    if ('ontouchstart' in window) {
      navigator.vibrate?.(10);
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const activeData = active.data.current as any;
    
    setActiveId(null);
    setActiveType(null);
    
    if (!over) return;

    const dropData = over.data.current as { operatorId: string; date: Date } | undefined;
    if (!dropData) return;

    const newOperatorId = dropData.operatorId;
    const newDate = format(dropData.date, 'yyyy-MM-dd');

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

    // Handle existing assignment drag
    if (activeData?.type === 'assignment') {
      const assignment = activeData.assignment as Assignment;
      
      // Don't update if same cell
      if (assignment.operator_id === newOperatorId && assignment.assigned_date === newDate) {
        return;
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
    }
    // Handle unassigned work order drag
    else if (activeData?.type === 'unassigned') {
      const workOrder = activeData.workOrder as WorkOrder;
      
      try {
        // Create new assignment
        const { data: newAssignment, error } = await supabase
          .from('operator_assignments')
          .insert({
            work_order_id: workOrder.id,
            operator_id: newOperatorId,
            assigned_date: newDate,
          })
          .select()
          .single();

        if (error) throw error;

        // Update work order start date
        await supabase
          .from('work_orders')
          .update({ start_date: newDate, assigned_to: newOperatorId })
          .eq('id', workOrder.id);

        // Update local state
        setAssignments(prev => [...prev, newAssignment]);
        setWorkOrders(prev => new Map(prev).set(workOrder.id, workOrder));
        setUnassignedOrders(prev => prev.filter(wo => wo.id !== workOrder.id));

        toast.success(language === 'nl' ? 'Werkorder toegewezen' : 'Work order assigned');
        
        if ('ontouchstart' in window) {
          navigator.vibrate?.(20);
        }
      } catch (error) {
        console.error('Error assigning work order:', error);
        toast.error(language === 'nl' ? 'Toewijzen mislukt' : 'Failed to assign work order');
      }
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const handleWorkOrderTap = (workOrder: WorkOrder, date?: string) => {
    setSelectedWorkOrder(workOrder);
    setSelectedDate(date || null);
    setAssignmentSheetOpen(true);
  };

  const handleAssignmentComplete = () => {
    setAssignmentSheetOpen(false);
    setSelectedWorkOrder(null);
    setSelectedDate(null);
    fetchData();
  };

  const activeAssignment = activeId && activeType === 'assignment'
    ? assignments.find(a => a.id === activeId) 
    : null;
  const activeWorkOrder = activeAssignment 
    ? workOrders.get(activeAssignment.work_order_id) 
    : activeType === 'unassigned' && activeId
      ? unassignedOrders.find(wo => `unassigned-${wo.id}` === activeId)
      : null;

  if (loading) {
    return (
      <div className="flex gap-4">
        <Card className="flex-1">
          <CardHeader>
            <Skeleton className="h-6 w-48" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Main Planner Grid */}
          <Card className="flex-1 overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-4 w-4" />
                  {language === 'nl' ? 'Dagplanning' : 'Daily Planning'}
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
                  <Button
                    variant={showSidebar ? 'secondary' : 'outline'}
                    size="sm"
                    className="h-8 px-3 text-xs hidden lg:flex"
                    onClick={() => setShowSidebar(!showSidebar)}
                  >
                    <Package className="h-3.5 w-3.5 mr-1" />
                    {language === 'nl' ? 'Ongepland' : 'Unassigned'}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                {format(currentWeekStart, 'MMM d')} - {format(weekEnd, 'MMM d, yyyy')}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <div className="min-w-[600px]">
                  {/* Header row with daily summary */}
                  <div className="flex border-b bg-muted/30">
                    <div className="w-32 sm:w-40 flex-shrink-0 p-2 border-r">
                      <span className="text-xs font-medium text-muted-foreground">
                        {language === 'nl' ? 'Operator' : 'Operator'}
                      </span>
                    </div>
                    {weekDays.map(day => {
                      const { totalAssignments, availableOperators } = getDailyTotals(day);
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "flex-1 min-w-[80px] p-2 text-center border-l",
                            isToday && "bg-primary/10"
                          )}
                        >
                          <div className="text-xs font-medium">
                            {format(day, 'EEE')}
                          </div>
                          <div className={cn(
                            "text-sm font-semibold",
                            isToday && "text-primary"
                          )}>
                            {format(day, 'd')}
                          </div>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="mt-1">
                                  <Badge variant="outline" className="text-[9px] px-1.5">
                                    {totalAssignments} {language === 'nl' ? 'orders' : 'orders'}
                                  </Badge>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">
                                  {availableOperators} {language === 'nl' ? 'beschikbaar' : 'available'}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      );
                    })}
                  </div>

                  {/* Operator rows */}
                  {operators.map(operator => (
                    <div key={operator.id} className="flex border-b hover:bg-muted/10">
                      <div className="w-32 sm:w-40 flex-shrink-0 p-2 border-r">
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
                          </div>
                        </div>
                      </div>

                      {weekDays.map(day => {
                        const cellAssignments = getAssignmentsForCell(operator.id, day);
                        const avail = getAvailability(operator.id, day);
                        const isUnavailable = avail && avail.available_hours === 0;
                        const dateStr = format(day, 'yyyy-MM-dd');

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
                                  {cellAssignments.map(assignment => {
                                    const wo = workOrders.get(assignment.work_order_id);
                                    if (!wo) return null;
                                    return (
                                      <DraggableWorkOrder
                                        key={assignment.id}
                                        assignment={assignment}
                                        workOrder={wo}
                                        onTap={() => handleWorkOrderTap(wo, dateStr)}
                                      />
                                    );
                                  })}
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
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {language === 'nl' 
                          ? 'Geen operators in het productieteam' 
                          : 'No operators in production team'}
                      </p>
                      <p className="text-xs mt-1">
                        {language === 'nl'
                          ? 'Voeg gebruikers toe aan het "Production" team'
                          : 'Add users to the "Production" team'}
                      </p>
                    </div>
                  )}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Unassigned Work Orders Sidebar */}
          {showSidebar && (
            <Card className="w-full lg:w-64 flex-shrink-0">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    {language === 'nl' ? 'Ongepland' : 'Unassigned'}
                    <Badge variant="secondary" className="text-[10px]">
                      {unassignedOrders.length}
                    </Badge>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 hidden lg:flex"
                    onClick={() => setShowSidebar(false)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {language === 'nl' 
                    ? 'Sleep of tik om toe te wijzen' 
                    : 'Drag or tap to assign'}
                </p>
              </CardHeader>
              <CardContent className="p-2">
                <ScrollArea className="h-[300px] lg:h-[400px]">
                  <div className="space-y-2 pr-2">
                    {unassignedOrders.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        {language === 'nl' 
                          ? 'Alle werkorders zijn toegewezen' 
                          : 'All work orders assigned'}
                      </p>
                    ) : (
                      unassignedOrders.map(wo => (
                        <DraggableUnassignedOrder 
                          key={wo.id} 
                          workOrder={wo} 
                          onTap={() => handleWorkOrderTap(wo)}
                        />
                      ))
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        <DragOverlay>
          {activeWorkOrder && (
            <div className="p-2 rounded bg-primary text-primary-foreground shadow-lg text-xs max-w-[150px]">
              <div className="font-mono">{activeWorkOrder.wo_number}</div>
              <div className="text-[10px] opacity-80 truncate">
                {formatProductType(activeWorkOrder.product_type)}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {/* Mobile-friendly assignment sheet */}
      <ProductAssignmentSheet
        open={assignmentSheetOpen}
        onOpenChange={setAssignmentSheetOpen}
        workOrder={selectedWorkOrder}
        initialDate={selectedDate}
        onComplete={handleAssignmentComplete}
      />
    </>
  );
};

export default WeeklyCapacityPlanner;
