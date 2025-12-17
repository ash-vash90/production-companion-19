import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, addDays, addWeeks, subWeeks, subDays, isSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight, GripVertical, Package, X, Layers } from 'lucide-react';
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
import { useIsMobile } from '@/hooks/use-mobile';

// Product type colors for breakdown badges
const productTypeColors: Record<string, string> = {
  SDM_ECO: 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
  SENSOR: 'bg-sky-500/20 text-sky-700 dark:text-sky-400 border-sky-500/30',
  MLA: 'bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
  HMI: 'bg-purple-500/20 text-purple-700 dark:text-purple-400 border-purple-500/30',
  TRANSMITTER: 'bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
};

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

// Work order card in grid - shows batch size badge
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
        "p-3 rounded-lg text-xs bg-primary/10 border border-primary/20 cursor-grab active:cursor-grabbing",
        "hover:bg-primary/20 transition-colors touch-manipulation min-h-[56px]",
        isDragging && "ring-2 ring-primary"
      )}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium truncate">{workOrder.wo_number}</p>
          <div className="flex items-center gap-1.5 mt-1">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 font-mono">
              {workOrder.batch_size}×
            </Badge>
            <span className="text-[11px] text-muted-foreground truncate">
              {formatProductType(workOrder.product_type)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Unassigned work order card
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
        "p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing min-h-[64px]",
        "hover:border-primary/50 hover:bg-muted/30 transition-colors touch-manipulation",
        isDragging && "ring-2 ring-primary shadow-lg"
      )}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="font-mono text-sm font-medium truncate">{workOrder.wo_number}</p>
            <Badge variant="outline" className="text-[10px] shrink-0 font-mono">
              <Layers className="h-3 w-3 mr-1" />
              {workOrder.batch_size}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatProductType(workOrder.product_type)}
          </p>
          {workOrder.customer_name && (
            <p className="text-[11px] text-muted-foreground truncate mt-1">
              {workOrder.customer_name}
            </p>
          )}
        </div>
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
        "min-h-[80px] p-2 border-l transition-colors",
        isOver && "bg-primary/10 ring-2 ring-primary ring-inset"
      )}
    >
      {children}
    </div>
  );
};

// Mobile droppable operator card with product type breakdown
const DroppableOperatorCard: React.FC<{
  operator: Operator;
  date: Date;
  assignments: Assignment[];
  workOrders: Map<string, WorkOrder>;
  availability: Availability | undefined;
  onWorkOrderTap: (wo: WorkOrder, date: string) => void;
  language: string;
}> = ({ operator, date, assignments, workOrders, availability, onWorkOrderTap, language }) => {
  const dateStr = format(date, 'yyyy-MM-dd');
  const isUnavailable = availability && availability.available_hours === 0;
  const { setNodeRef, isOver } = useDroppable({
    id: `${operator.id}-${dateStr}`,
    data: { operatorId: operator.id, date },
  });

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Calculate product type breakdown
  const productBreakdown = assignments.reduce((acc, a) => {
    const wo = workOrders.get(a.work_order_id);
    if (wo) {
      acc[wo.product_type] = (acc[wo.product_type] || 0) + wo.batch_size;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalItems = Object.values(productBreakdown).reduce((sum, count) => sum + count, 0);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border bg-card p-4 transition-all min-h-[100px]",
        isOver && "ring-2 ring-primary bg-primary/5",
        isUnavailable && "bg-destructive/5 border-destructive/20"
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            {operator.avatar_url && <AvatarImage src={operator.avatar_url} />}
            <AvatarFallback className="text-sm font-medium">
              {getInitials(operator.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{operator.full_name}</p>
            {isUnavailable ? (
              <Badge variant="outline" className="text-[10px] bg-destructive/10 border-destructive/30 mt-1">
                {availability?.reason_type || (language === 'nl' ? 'Afwezig' : 'Off')}
              </Badge>
            ) : assignments.length > 0 ? (
              <p className="text-xs text-muted-foreground">
                {assignments.length} {language === 'nl' ? 'orders' : 'orders'} · {totalItems} items
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {language === 'nl' ? 'Beschikbaar' : 'Available'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Product type breakdown badges */}
      {!isUnavailable && Object.keys(productBreakdown).length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {Object.entries(productBreakdown).map(([type, count]) => (
            <Badge 
              key={type} 
              variant="outline" 
              className={cn(
                "text-[10px] px-2 py-0.5 font-mono",
                productTypeColors[type] || 'bg-muted'
              )}
            >
              {count}× {formatProductType(type)}
            </Badge>
          ))}
        </div>
      )}

      {!isUnavailable && (
        <div className="space-y-2">
          {assignments.map(assignment => {
            const wo = workOrders.get(assignment.work_order_id);
            if (!wo) return null;
            return (
              <DraggableWorkOrder
                key={assignment.id}
                assignment={assignment}
                workOrder={wo}
                onTap={() => onWorkOrderTap(wo, dateStr)}
              />
            );
          })}
          {assignments.length === 0 && (
            <div className="text-center py-4 text-muted-foreground text-sm border border-dashed rounded-lg">
              {language === 'nl' ? 'Sleep hier om toe te wijzen' : 'Drop here to assign'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Swipe gesture container for mobile day navigation
const SwipeContainer: React.FC<{
  children: React.ReactNode;
  onSwipeLeft: () => void;
  onSwipeRight: () => void;
}> = ({ children, onSwipeLeft, onSwipeRight }) => {
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);
  const touchStartTime = useRef<number | null>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
    touchStartTime.current = Date.now();
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null || touchStartTime.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;
    const duration = Date.now() - touchStartTime.current;

    // Only trigger if horizontal swipe is dominant, distance > 50px, and duration < 500ms
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50 && duration < 500) {
      if (deltaX > 0) {
        onSwipeRight();
        navigator.vibrate?.(10);
      } else {
        onSwipeLeft();
        navigator.vibrate?.(10);
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
    touchStartTime.current = null;
  }, [onSwipeLeft, onSwipeRight]);

  return (
    <div 
      onTouchStart={handleTouchStart} 
      onTouchEnd={handleTouchEnd}
      className="touch-pan-y"
    >
      {children}
    </div>
  );
};

const WeeklyCapacityPlanner: React.FC = () => {
  const { language } = useLanguage();
  const isMobile = useIsMobile();
  
  const [currentWeekStart, setCurrentWeekStart] = useState(() => 
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );
  const [currentMobileDate, setCurrentMobileDate] = useState(() => new Date());
  const [operators, setOperators] = useState<Operator[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [workOrders, setWorkOrders] = useState<Map<string, WorkOrder>>(new Map());
  const [unassignedOrders, setUnassignedOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'assignment' | 'unassigned' | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showDesktopSidebar, setShowDesktopSidebar] = useState(true);
  
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

        // Apply to the whole batch (all items in the work order)
        await supabase
          .from('work_order_items')
          .update({ assigned_to: newOperatorId })
          .eq('work_order_id', workOrder.id);

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

  // Mobile navigation
  const goToPrevDay = () => setCurrentMobileDate(d => subDays(d, 1));
  const goToNextDay = () => setCurrentMobileDate(d => addDays(d, 1));
  const goToToday = () => setCurrentMobileDate(new Date());

  // Desktop navigation
  const goToPrevWeek = () => setCurrentWeekStart(subWeeks(currentWeekStart, 1));
  const goToNextWeek = () => setCurrentWeekStart(addWeeks(currentWeekStart, 1));
  const goToThisWeek = () => setCurrentWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }));

  const activeAssignment = activeId && activeType === 'assignment'
    ? assignments.find(a => a.id === activeId) 
    : null;
  const activeWorkOrder = activeAssignment 
    ? workOrders.get(activeAssignment.work_order_id) 
    : activeType === 'unassigned' && activeId
      ? unassignedOrders.find(wo => `unassigned-${wo.id}` === activeId)
      : null;

  // Unassigned sidebar content (shared between desktop and mobile)
  const UnassignedContent = () => (
    <div className="space-y-2">
      {unassignedOrders.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
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
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // MOBILE VIEW: Day-by-day with swipe navigation
  if (isMobile) {
    const isToday = isSameDay(currentMobileDate, new Date());
    const dayAssignments = assignments.filter(
      a => a.assigned_date === format(currentMobileDate, 'yyyy-MM-dd')
    );

    // Calculate product type breakdown for day summary
    const dayProductBreakdown = dayAssignments.reduce((acc, a) => {
      const wo = workOrders.get(a.work_order_id);
      if (wo) {
        acc[wo.product_type] = (acc[wo.product_type] || 0) + wo.batch_size;
      }
      return acc;
    }, {} as Record<string, number>);

    return (
      <>
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SwipeContainer onSwipeLeft={goToNextDay} onSwipeRight={goToPrevDay}>
            <div className="space-y-3">
              {/* Compact Header */}
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={goToPrevDay}>
                    <ChevronLeft className="h-5 w-5" />
                  </Button>
                  <div className="text-center min-w-[140px]">
                    <p className={cn(
                      "text-lg font-semibold",
                      isToday && "text-primary"
                    )}>
                      {format(currentMobileDate, 'EEEE')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(currentMobileDate, 'MMM d, yyyy')}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={goToNextDay}>
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>

                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-10 px-3 text-xs"
                    onClick={goToToday}
                  >
                    {language === 'nl' ? 'Vandaag' : 'Today'}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 px-3 text-xs relative"
                    onClick={() => setMobileSidebarOpen(true)}
                  >
                    <Package className="h-4 w-4" />
                    {unassignedOrders.length > 0 && (
                      <Badge 
                        variant="destructive" 
                        className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]"
                      >
                        {unassignedOrders.length}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* Day summary with product breakdown */}
              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <span className="text-muted-foreground">
                  {dayAssignments.length} {language === 'nl' ? 'orders' : 'orders'}
                </span>
                {Object.keys(dayProductBreakdown).length > 0 && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(dayProductBreakdown).map(([type, count]) => (
                        <Badge 
                          key={type} 
                          variant="outline" 
                          className={cn(
                            "text-[10px] px-1.5 py-0 font-mono",
                            productTypeColors[type] || 'bg-muted'
                          )}
                        >
                          {count}× {formatProductType(type)}
                        </Badge>
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Operators List */}
              <div className="space-y-3">
                {operators.map(operator => (
                  <DroppableOperatorCard
                    key={operator.id}
                    operator={operator}
                    date={currentMobileDate}
                    assignments={getAssignmentsForCell(operator.id, currentMobileDate)}
                    workOrders={workOrders}
                    availability={getAvailability(operator.id, currentMobileDate)}
                    onWorkOrderTap={handleWorkOrderTap}
                    language={language}
                  />
                ))}

                {operators.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground border rounded-lg">
                    <p className="text-sm">
                      {language === 'nl' 
                        ? 'Geen operators in het productieteam' 
                        : 'No operators in production team'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </SwipeContainer>

          <DragOverlay>
            {activeWorkOrder && (
              <div className="p-3 rounded-lg bg-primary text-primary-foreground shadow-lg text-xs max-w-[180px]">
                <div className="font-mono font-medium">{activeWorkOrder.wo_number}</div>
                <div className="text-[10px] opacity-80 truncate mt-0.5">
                  {formatProductType(activeWorkOrder.product_type)}
                </div>
                <Badge variant="secondary" className="mt-1 text-[9px] bg-primary-foreground/20">
                  {activeWorkOrder.batch_size} items
                </Badge>
              </div>
            )}
          </DragOverlay>
        </DndContext>

        {/* Mobile Unassigned Sheet */}
        <Sheet open={mobileSidebarOpen} onOpenChange={setMobileSidebarOpen}>
          <SheetContent side="bottom" className="h-[70vh]">
            <SheetHeader className="pb-2">
              <SheetTitle className="flex items-center gap-2">
                <Package className="h-4 w-4" />
                {language === 'nl' ? 'Ongeplande Werkorders' : 'Unassigned Work Orders'}
                <Badge variant="secondary">{unassignedOrders.length}</Badge>
              </SheetTitle>
            </SheetHeader>
            <ScrollArea className="h-full pb-8">
              <div className="space-y-2 pr-4">
                <UnassignedContent />
              </div>
            </ScrollArea>
          </SheetContent>
        </Sheet>

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
  }

  // DESKTOP VIEW: Weekly grid
  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Planner Grid */}
          <Card className="flex-1 overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToPrevWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9" onClick={goToNextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <p className="font-semibold">
                    {format(currentWeekStart, 'MMM d')} – {format(weekEnd, 'MMM d, yyyy')}
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={goToThisWeek}>
                  {language === 'nl' ? 'Deze week' : 'This Week'}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {/* Desktop sidebar toggle */}
                <Button
                  variant={showDesktopSidebar ? 'secondary' : 'outline'}
                  size="sm"
                  className="h-9 px-3 text-xs"
                  onClick={() => setShowDesktopSidebar(!showDesktopSidebar)}
                >
                  <Package className="h-4 w-4 mr-1.5" />
                  {language === 'nl' ? 'Ongepland' : 'Unassigned'}
                  {unassignedOrders.length > 0 && (
                    <Badge variant="secondary" className="ml-1.5 text-[10px]">
                      {unassignedOrders.length}
                    </Badge>
                  )}
                </Button>
              </div>
            </div>

            <CardContent className="p-0">
              <ScrollArea className="w-full">
                <div className="min-w-[700px]">
                  {/* Header row */}
                  <div className="flex border-b bg-muted/30">
                    <div className="w-36 flex-shrink-0 p-3 border-r">
                      <span className="text-xs font-medium text-muted-foreground">
                        {language === 'nl' ? 'Operator' : 'Operator'}
                      </span>
                    </div>
                    {weekDays.map(day => {
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <div
                          key={day.toISOString()}
                          className={cn(
                            "flex-1 min-w-[90px] p-3 text-center border-l",
                            isToday && "bg-primary/10"
                          )}
                        >
                          <div className="text-xs font-medium text-muted-foreground">
                            {format(day, 'EEE')}
                          </div>
                          <div className={cn(
                            "text-lg font-semibold",
                            isToday && "text-primary"
                          )}>
                            {format(day, 'd')}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Operator rows */}
                  {operators.map(operator => (
                    <div key={operator.id} className="flex border-b hover:bg-muted/10">
                      <div className="w-36 flex-shrink-0 p-3 border-r">
                        <div className="flex items-center gap-2">
                          <Avatar className="h-8 w-8">
                            {operator.avatar_url && <AvatarImage src={operator.avatar_url} />}
                            <AvatarFallback className="text-xs">
                              {getInitials(operator.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">
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
                              "h-full min-h-[80px]",
                              isUnavailable && "bg-destructive/5"
                            )}>
                              {isUnavailable ? (
                                <div className="flex items-center justify-center h-full">
                                  <Badge variant="outline" className="text-[10px] bg-destructive/10 border-destructive/30">
                                    {avail?.reason_type || (language === 'nl' ? 'Afwezig' : 'Off')}
                                  </Badge>
                                </div>
                              ) : (
                                <div className="space-y-1.5">
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

          {/* Desktop Unassigned Work Orders Sidebar */}
          {showDesktopSidebar && (
            <Card className="hidden xl:block w-72 flex-shrink-0">
              <div className="flex items-center justify-between p-4 border-b">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  <span className="font-medium text-sm">{language === 'nl' ? 'Ongepland' : 'Unassigned'}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    {unassignedOrders.length}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setShowDesktopSidebar(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardContent className="p-3">
                <p className="text-[11px] text-muted-foreground mb-3">
                  {language === 'nl' 
                    ? 'Sleep of tik om toe te wijzen' 
                    : 'Drag or tap to assign'}
                </p>
                <ScrollArea className="h-[500px]">
                  <div className="pr-2">
                    <UnassignedContent />
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </div>

        <DragOverlay>
          {activeWorkOrder && (
            <div className="p-3 rounded-lg bg-primary text-primary-foreground shadow-lg text-xs max-w-[180px]">
              <div className="font-mono font-medium">{activeWorkOrder.wo_number}</div>
              <div className="text-[10px] opacity-80 truncate mt-0.5">
                {formatProductType(activeWorkOrder.product_type)}
              </div>
              <Badge variant="secondary" className="mt-1 text-[9px] bg-primary-foreground/20">
                {activeWorkOrder.batch_size} items
              </Badge>
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
