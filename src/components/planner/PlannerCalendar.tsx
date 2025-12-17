import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, isSameMonth, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, LayoutGrid, Package, ChevronDown } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';
import { PlannerWorkOrder } from '@/pages/ProductionPlanner';

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
  isAdmin,
}) => {
  const { language } = useLanguage();
  const [unscheduledOpen, setUnscheduledOpen] = useState(false);

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

  return (
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
                <div
                  key={day.toISOString()}
                  className={cn(
                    "border rounded-lg p-1 transition-colors min-h-[80px]",
                    !isCurrentMonth && calendarView === 'month' && "bg-muted/30",
                    isDayToday && "ring-2 ring-primary ring-offset-1",
                    "hover:bg-muted/20 cursor-pointer"
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
                      ? `${unscheduledOrders.length} ongeplande werkorders` 
                      : `${unscheduledOrders.length} unscheduled work orders`
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
                        <button
                          key={order.id}
                          onClick={() => onSelectWorkOrder(order.id)}
                          className={cn(
                            "text-left p-3 rounded-lg border transition-colors hover:bg-muted/50",
                            selectedWorkOrderId === order.id && "ring-2 ring-primary bg-muted/50"
                          )}
                        >
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
  );
};

export default PlannerCalendar;
