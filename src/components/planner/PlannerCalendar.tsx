import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isSameMonth, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, Package, ChevronDown, GripVertical } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';
import { PlannerWorkOrder } from '@/pages/ProductionPlanner';
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragEndEvent,
  DragStartEvent,
  useDroppable,
  useDraggable,
} from '@dnd-kit/core';

interface PlannerCalendarProps {
  currentDate: Date;
  calendarView: 'month' | 'week';
  workOrders: PlannerWorkOrder[];
  unscheduledOrders: PlannerWorkOrder[];
  loading: boolean;
  selectedWorkOrderId: string | null;
  onSelectWorkOrder: (id: string) => void;
  onNavigatePrevious: () => void;
  onNavigateNext: () => void;
  onNavigateToday: () => void;
  onViewChange: (view: 'month' | 'week') => void;
  onWorkOrderUpdate: () => void;
  isAdmin: boolean;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'planned': return 'bg-info text-info-foreground';
    case 'in_progress': return 'bg-warning text-warning-foreground';
    case 'completed': return 'bg-success text-success-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

// Draggable unscheduled work order item
const DraggableWorkOrder: React.FC<{ order: PlannerWorkOrder; onSelect: () => void; isSelected: boolean }> = ({ 
  order, 
  onSelect,
  isSelected,
}) => {
  const { language } = useLanguage();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: order.id,
    data: { order },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "text-left p-3 rounded-lg border transition-colors hover:bg-muted/50 cursor-grab active:cursor-grabbing",
        isSelected && "ring-2 ring-primary bg-muted/50",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start gap-2">
        <div 
          {...attributes} 
          {...listeners}
          className="flex-shrink-0 mt-1 text-muted-foreground hover:text-foreground"
        >
          <GripVertical className="h-4 w-4" />
        </div>
        <button onClick={onSelect} className="flex-1 text-left">
          <div className="flex items-center justify-between mb-1">
            <span className="font-mono text-sm font-medium">{order.wo_number}</span>
            <Badge variant="outline" className="text-[10px]">
              {formatProductType(order.product_type)}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {order.customer_name || (language === 'nl' ? 'Geen klant' : 'No customer')}
          </p>
          <p className="text-xs text-muted-foreground">
            {order.batch_size} {language === 'nl' ? 'items' : 'items'}
          </p>
        </button>
      </div>
    </div>
  );
};

// Droppable calendar cell
const DroppableCalendarCell: React.FC<{
  day: Date;
  isCurrentMonth: boolean;
  isDayToday: boolean;
  dayOrders: PlannerWorkOrder[];
  selectedWorkOrderId: string | null;
  onSelectWorkOrder: (id: string) => void;
  calendarView: 'month' | 'week';
}> = ({ day, isCurrentMonth, isDayToday, dayOrders, selectedWorkOrderId, onSelectWorkOrder, calendarView }) => {
  const { setNodeRef, isOver } = useDroppable({
    id: `day-${format(day, 'yyyy-MM-dd')}`,
    data: { date: day },
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "border rounded-lg p-1 transition-colors min-h-[80px]",
        !isCurrentMonth && calendarView === 'month' && "bg-muted/30",
        isDayToday && "ring-2 ring-primary ring-offset-1",
        "hover:bg-muted/20",
        isOver && "bg-primary/10 ring-2 ring-primary/50"
      )}
    >
      <div className={cn(
        "text-xs font-medium mb-1 px-1",
        !isCurrentMonth && calendarView === 'month' && "text-muted-foreground",
        isDayToday && "text-primary"
      )}>
        {format(day, 'd')}
      </div>

      <div className="space-y-0.5">
        {dayOrders.slice(0, calendarView === 'week' ? 5 : 3).map((order) => (
          <button
            key={order.id}
            onClick={() => onSelectWorkOrder(order.id)}
            className={cn(
              "w-full text-left rounded px-1.5 py-0.5 text-[10px] truncate transition-colors",
              getStatusColor(order.status),
              selectedWorkOrderId === order.id && "ring-2 ring-primary"
            )}
          >
            <span className="font-mono">{order.wo_number}</span>
          </button>
        ))}
        {dayOrders.length > (calendarView === 'week' ? 5 : 3) && (
          <div className="text-[10px] text-muted-foreground px-1">
            +{dayOrders.length - (calendarView === 'week' ? 5 : 3)} more
          </div>
        )}
      </div>
    </div>
  );
};

const PlannerCalendar: React.FC<PlannerCalendarProps> = ({
  currentDate,
  calendarView,
  workOrders,
  unscheduledOrders,
  loading,
  selectedWorkOrderId,
  onSelectWorkOrder,
  onNavigatePrevious,
  onNavigateNext,
  onNavigateToday,
  onViewChange,
  onWorkOrderUpdate,
  isAdmin,
}) => {
  const { language } = useLanguage();
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const getDaysInView = useCallback(() => {
    if (calendarView === 'month') {
      const monthStart = startOfMonth(currentDate);
      const monthEnd = endOfMonth(currentDate);
      const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
      const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
      return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
    }
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start: weekStart, end: weekEnd });
  }, [currentDate, calendarView]);

  const getWorkOrdersForDate = useCallback((date: Date) => {
    return workOrders.filter(wo => 
      wo.start_date && isSameDay(parseISO(wo.start_date), date)
    );
  }, [workOrders]);

  const days = useMemo(() => getDaysInView(), [getDaysInView]);
  const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekDaysNl = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  if (loading) {
    return (
      <div className="h-full flex flex-col p-4 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="flex-1 grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      </div>
    );
  }

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    
    if (!over || !active) return;
    
    const overId = over.id as string;
    if (!overId.startsWith('day-')) return;
    
    const dateStr = overId.replace('day-', '');
    const workOrderId = active.id as string;
    
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ start_date: dateStr })
        .eq('id', workOrderId);
      
      if (error) throw error;
      
      const order = unscheduledOrders.find(o => o.id === workOrderId);
      toast.success(
        language === 'nl' 
          ? `${order?.wo_number} ingepland voor ${format(parseISO(dateStr), 'd MMMM yyyy')}`
          : `${order?.wo_number} scheduled for ${format(parseISO(dateStr), 'MMMM d, yyyy')}`
      );
      onWorkOrderUpdate();
    } catch (error) {
      console.error('Error scheduling work order:', error);
      toast.error(language === 'nl' ? 'Fout bij inplannen' : 'Error scheduling');
    }
  };

  const activeOrder = activeId ? unscheduledOrders.find(o => o.id === activeId) : null;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={onNavigatePrevious}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <h2 className="font-semibold min-w-[140px] text-center">
                {calendarView === 'month'
                  ? format(currentDate, language === 'nl' ? 'MMMM yyyy' : 'MMMM yyyy')
                  : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'd MMM yyyy')}`
                }
              </h2>
              <Button variant="outline" size="icon" onClick={onNavigateNext}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onNavigateToday}>
                {language === 'nl' ? 'Vandaag' : 'Today'}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Tabs value={calendarView} onValueChange={(v) => onViewChange(v as 'month' | 'week')}>
                <TabsList className="h-8">
                  <TabsTrigger value="month" className="text-xs gap-1.5 px-2">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {language === 'nl' ? 'Maand' : 'Month'}
                  </TabsTrigger>
                  <TabsTrigger value="week" className="text-xs gap-1.5 px-2">
                    <LayoutGrid className="h-3.5 w-3.5" />
                    {language === 'nl' ? 'Week' : 'Week'}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </div>

        {/* Calendar Grid */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            {/* Week day headers */}
            <div className="grid grid-cols-7 mb-2">
              {(language === 'nl' ? weekDaysNl : weekDays).map((day) => (
                <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className={cn(
              "grid grid-cols-7 gap-1",
              calendarView === 'week' ? 'auto-rows-[minmax(120px,1fr)]' : 'auto-rows-[minmax(80px,1fr)]'
            )}>
              {days.map((day) => {
                const dayOrders = getWorkOrdersForDate(day);
                const isCurrentMonth = isSameMonth(day, currentDate);
                const isDayToday = isToday(day);

                return (
                  <DroppableCalendarCell
                    key={day.toISOString()}
                    day={day}
                    isCurrentMonth={isCurrentMonth}
                    isDayToday={isDayToday}
                    dayOrders={dayOrders}
                    selectedWorkOrderId={selectedWorkOrderId}
                    onSelectWorkOrder={onSelectWorkOrder}
                    calendarView={calendarView}
                  />
                );
              })}
            </div>

            {/* Unscheduled Orders */}
            {unscheduledOrders.length > 0 && (
              <Collapsible open={unscheduledOpen} onOpenChange={setUnscheduledOpen} className="mt-6">
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      {language === 'nl' 
                        ? `${unscheduledOrders.length} ongeplande werkorders - sleep naar kalender om in te plannen` 
                        : `${unscheduledOrders.length} unscheduled work orders - drag to calendar to schedule`
                      }
                    </span>
                    <ChevronDown className={cn("h-4 w-4 transition-transform", unscheduledOpen && "rotate-180")} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2">
                  <Card>
                    <CardContent className="p-3">
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {unscheduledOrders.map((order) => (
                          <DraggableWorkOrder
                            key={order.id}
                            order={order}
                            onSelect={() => onSelectWorkOrder(order.id)}
                            isSelected={selectedWorkOrderId === order.id}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Drag Overlay */}
      <DragOverlay>
        {activeOrder && (
          <div className="p-3 rounded-lg border bg-background shadow-lg">
            <div className="flex items-center justify-between mb-1">
              <span className="font-mono text-sm font-medium">{activeOrder.wo_number}</span>
              <Badge variant="outline" className="text-[10px]">
                {formatProductType(activeOrder.product_type)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {activeOrder.customer_name || (language === 'nl' ? 'Geen klant' : 'No customer')}
            </p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
};

export default PlannerCalendar;
