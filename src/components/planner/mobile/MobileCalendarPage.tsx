import React, { useState, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  format, 
  addDays, 
  subDays, 
  addWeeks, 
  subWeeks, 
  addMonths, 
  subMonths, 
  isSameDay, 
  isSameWeek, 
  isSameMonth,
  parseISO, 
  isToday, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  eachDayOfInterval,
  getDay
} from 'date-fns';
import { nl } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, Users, AlertTriangle } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';
import { PlannerWorkOrder } from '@/pages/ProductionPlanner';

type CalendarView = 'day' | 'week' | 'month';

interface MobileCalendarPageProps {
  currentDate: Date;
  calendarView: CalendarView;
  workOrders: PlannerWorkOrder[];
  unscheduledOrders: PlannerWorkOrder[];
  loading: boolean;
  onSelectWorkOrder: (id: string) => void;
  onDateChange: (date: Date) => void;
  onViewCapacity: () => void;
  onScheduleOrder: (orderId: string) => void;
  onViewChange: (view: CalendarView) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'planned': return 'bg-info text-info-foreground';
    case 'in_progress': return 'bg-warning text-warning-foreground';
    case 'completed': return 'bg-success text-success-foreground';
    default: return 'bg-muted text-muted-foreground';
  }
};

const MobileCalendarPage: React.FC<MobileCalendarPageProps> = ({
  currentDate,
  calendarView,
  workOrders,
  unscheduledOrders,
  loading,
  onSelectWorkOrder,
  onDateChange,
  onViewCapacity,
  onScheduleOrder,
  onViewChange,
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'unscheduled'>('scheduled');
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const locale = language === 'nl' ? nl : undefined;

  // Get orders for the current view
  const filteredOrders = useMemo(() => {
    return workOrders.filter(wo => {
      if (!wo.start_date) return false;
      const woDate = parseISO(wo.start_date);
      
      switch (calendarView) {
        case 'day':
          return isSameDay(woDate, currentDate);
        case 'week':
          return isSameWeek(woDate, currentDate, { weekStartsOn: 1 });
        case 'month':
          return isSameMonth(woDate, currentDate);
        default:
          return false;
      }
    });
  }, [workOrders, currentDate, calendarView]);

  // Group orders by date for week/month view
  const ordersByDate = useMemo(() => {
    const grouped: Record<string, PlannerWorkOrder[]> = {};
    filteredOrders.forEach(order => {
      if (order.start_date) {
        const dateKey = format(parseISO(order.start_date), 'yyyy-MM-dd');
        if (!grouped[dateKey]) grouped[dateKey] = [];
        grouped[dateKey].push(order);
      }
    });
    return grouped;
  }, [filteredOrders]);

  // Get days for week view
  const weekDays = useMemo(() => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    const end = endOfWeek(currentDate, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  // Get days for month view (simplified calendar grid)
  const monthDays = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    });
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const diffX = touchStart.x - touchEndX;
    const diffY = Math.abs(touchStart.y - touchEndY);
    
    // Only trigger navigation if horizontal swipe is significantly larger than vertical
    // This prevents accidental navigation during vertical scrolling
    if (Math.abs(diffX) > 50 && Math.abs(diffX) > diffY * 1.5) {
      if (diffX > 0) {
        goToNext();
      } else {
        goToPrev();
      }
    }
    setTouchStart(null);
  };

  const goToPrev = () => {
    switch (calendarView) {
      case 'day':
        onDateChange(subDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(subWeeks(currentDate, 1));
        break;
      case 'month':
        onDateChange(subMonths(currentDate, 1));
        break;
    }
  };

  const goToNext = () => {
    switch (calendarView) {
      case 'day':
        onDateChange(addDays(currentDate, 1));
        break;
      case 'week':
        onDateChange(addWeeks(currentDate, 1));
        break;
      case 'month':
        onDateChange(addMonths(currentDate, 1));
        break;
    }
  };

  const goToToday = () => onDateChange(new Date());

  const getHeaderText = () => {
    switch (calendarView) {
      case 'day':
        return {
          primary: format(currentDate, 'EEEE', { locale }),
          secondary: format(currentDate, 'd MMMM yyyy', { locale })
        };
      case 'week':
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return {
          primary: language === 'nl' ? 'Week' : 'Week',
          secondary: `${format(weekStart, 'd MMM', { locale })} - ${format(weekEnd, 'd MMM yyyy', { locale })}`
        };
      case 'month':
        return {
          primary: format(currentDate, 'MMMM', { locale }),
          secondary: format(currentDate, 'yyyy')
        };
    }
  };

  const headerText = getHeaderText();

  if (loading) {
    return (
      <div className="h-full flex flex-col p-4 space-y-4">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="space-y-3 flex-1">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div 
      className="h-full flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Date Navigation Header */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="icon" onClick={goToPrev} className="h-11 w-11">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 text-center">
            <div className="font-semibold">
              {headerText.primary}
            </div>
            <div className="text-sm text-muted-foreground">
              {headerText.secondary}
            </div>
          </div>
          
          <Button variant="outline" size="icon" onClick={goToNext} className="h-11 w-11">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>

        {!isToday(currentDate) && (
          <Button variant="ghost" size="sm" onClick={goToToday} className="w-full mt-2">
            <CalendarIcon className="h-4 w-4 mr-2" />
            {language === 'nl' ? 'Naar vandaag' : 'Go to Today'}
          </Button>
        )}
      </div>

      {/* Tabs: Scheduled vs Unscheduled */}
      <div className="flex-none px-4 pt-3">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'scheduled' | 'unscheduled')}>
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="scheduled" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {language === 'nl' ? 'Gepland' : 'Scheduled'}
              {filteredOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {filteredOrders.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="unscheduled" className="gap-2">
              <Package className="h-4 w-4" />
              {language === 'nl' ? 'Ongepland' : 'Unscheduled'}
              {unscheduledOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {unscheduledOrders.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {activeTab === 'scheduled' ? (
          <div className="space-y-3">
            {calendarView === 'day' ? (
              // Day View - list of orders
              filteredOrders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center">
                    <CalendarIcon className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                    <p className="text-muted-foreground">
                      {language === 'nl' 
                        ? 'Geen werkorders gepland voor deze dag' 
                        : 'No work orders scheduled for this day'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {language === 'nl' 
                        ? 'Swipe links/rechts voor andere dagen' 
                        : 'Swipe left/right for other days'}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredOrders.map((order) => (
                  <OrderCard key={order.id} order={order} onSelect={onSelectWorkOrder} language={language} />
                ))
              )
            ) : calendarView === 'week' ? (
              // Week View - days with orders
              weekDays.map((day) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayOrders = ordersByDate[dateKey] || [];
                
                return (
                  <div key={dateKey}>
                    <div 
                      className={cn(
                        "flex items-center gap-2 py-2 px-1 sticky top-0 bg-background z-10",
                        isToday(day) && "text-primary font-semibold"
                      )}
                    >
                      <span className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-sm",
                        isToday(day) && "bg-primary text-primary-foreground"
                      )}>
                        {format(day, 'd')}
                      </span>
                      <span className="text-sm">
                        {format(day, 'EEEE', { locale })}
                      </span>
                      {dayOrders.length > 0 && (
                        <Badge variant="secondary" className="ml-auto text-xs">
                          {dayOrders.length}
                        </Badge>
                      )}
                    </div>
                    {dayOrders.length > 0 ? (
                      <div className="space-y-2 ml-10">
                        {dayOrders.map((order) => (
                          <OrderCard key={order.id} order={order} onSelect={onSelectWorkOrder} language={language} compact />
                        ))}
                      </div>
                    ) : (
                      <div className="ml-10 py-2 text-xs text-muted-foreground">
                        {language === 'nl' ? 'Geen orders' : 'No orders'}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              // Month View - calendar grid
              <div>
                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-2">
                  {['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'].map((day, i) => (
                    <div key={i} className="text-center text-xs text-muted-foreground font-medium py-1">
                      {language === 'nl' ? day : ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'][i]}
                    </div>
                  ))}
                </div>
                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-1">
                  {/* Empty cells for days before month starts */}
                  {Array.from({ length: (getDay(startOfMonth(currentDate)) + 6) % 7 }).map((_, i) => (
                    <div key={`empty-${i}`} className="aspect-square" />
                  ))}
                  {monthDays.map((day) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayOrders = ordersByDate[dateKey] || [];
                    
                    return (
                      <button
                        key={dateKey}
                        onClick={() => {
                          onDateChange(day);
                          onViewChange('day');
                        }}
                        className={cn(
                          "aspect-square rounded-lg flex flex-col items-center justify-center text-sm relative transition-colors",
                          "hover:bg-muted/50 active:bg-muted",
                          isToday(day) && "bg-primary text-primary-foreground hover:bg-primary/90",
                          isSameDay(day, currentDate) && !isToday(day) && "ring-2 ring-primary"
                        )}
                      >
                        {format(day, 'd')}
                        {dayOrders.length > 0 && (
                          <div className="absolute bottom-1 flex gap-0.5">
                            {dayOrders.slice(0, 3).map((_, i) => (
                              <div 
                                key={i} 
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  isToday(day) ? "bg-primary-foreground" : "bg-primary"
                                )} 
                              />
                            ))}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
                
                {/* Orders list below calendar */}
                {filteredOrders.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <div className="text-sm font-medium text-muted-foreground">
                      {language === 'nl' ? `${filteredOrders.length} orders deze maand` : `${filteredOrders.length} orders this month`}
                    </div>
                    {filteredOrders.slice(0, 5).map((order) => (
                      <OrderCard key={order.id} order={order} onSelect={onSelectWorkOrder} language={language} compact showDate />
                    ))}
                    {filteredOrders.length > 5 && (
                      <p className="text-xs text-muted-foreground text-center py-2">
                        {language === 'nl' ? `+${filteredOrders.length - 5} meer` : `+${filteredOrders.length - 5} more`}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {unscheduledOrders.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center">
                  <Package className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                  <p className="text-muted-foreground">
                    {language === 'nl' 
                      ? 'Alle werkorders zijn ingepland' 
                      : 'All work orders are scheduled'}
                  </p>
                </CardContent>
              </Card>
            ) : (
              unscheduledOrders.map((order) => (
                <Card key={order.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono font-semibold">{order.wo_number}</span>
                          <Badge variant="outline" className="font-mono text-xs">
                            {formatProductType(order.product_type)}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {order.customer_name || (language === 'nl' ? 'Geen klant' : 'No customer')}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {order.batch_size} items
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 mt-3">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 h-11"
                        onClick={() => onScheduleOrder(order.id)}
                      >
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        {language === 'nl' ? 'Inplannen' : 'Schedule'}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1 h-11"
                        onClick={() => onSelectWorkOrder(order.id)}
                      >
                        {language === 'nl' ? 'Details' : 'Details'}
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex-none p-4 border-t bg-background/95 backdrop-blur">
        <Button 
          variant="outline" 
          className="w-full h-12 gap-2"
          onClick={onViewCapacity}
        >
          <Users className="h-5 w-5" />
          {language === 'nl' ? 'Team capaciteit bekijken' : 'View Team Capacity'}
        </Button>
      </div>
    </div>
  );
};

// Extracted OrderCard component for reuse
interface OrderCardProps {
  order: PlannerWorkOrder;
  onSelect: (id: string) => void;
  language: string;
  compact?: boolean;
  showDate?: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onSelect, language, compact, showDate }) => {
  if (compact) {
    return (
      <button
        onClick={() => onSelect(order.id)}
        className="w-full text-left"
      >
        <Card className="transition-colors hover:bg-muted/50 active:bg-muted">
          <CardContent className="p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-semibold text-sm">{order.wo_number}</span>
                <Badge className={cn('text-xs', getStatusColor(order.status))}>
                  {order.status}
                </Badge>
              </div>
              {showDate && order.start_date && (
                <span className="text-xs text-muted-foreground">
                  {format(parseISO(order.start_date), 'd MMM')}
                </span>
              )}
              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            </div>
          </CardContent>
        </Card>
      </button>
    );
  }

  return (
    <button
      onClick={() => onSelect(order.id)}
      className="w-full text-left"
    >
      <Card className="transition-colors hover:bg-muted/50 active:bg-muted">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono font-semibold">{order.wo_number}</span>
                <Badge className={cn('text-xs', getStatusColor(order.status))}>
                  {order.status}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground truncate">
                {order.customer_name || (language === 'nl' ? 'Geen klant' : 'No customer')}
              </p>
              <div className="flex items-center gap-3 mt-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {formatProductType(order.product_type)}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {order.batch_size} items
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-1" />
          </div>
          
          {!order.assigned_to && (
            <div className="flex items-center gap-2 mt-3 p-2 bg-warning/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-warning" />
              <span className="text-xs text-warning">
                {language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </button>
  );
};

export default MobileCalendarPage;
