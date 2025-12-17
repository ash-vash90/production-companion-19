import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useLanguage } from '@/contexts/LanguageContext';
import { format, addDays, subDays, isSameDay, parseISO, isToday } from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Package, Users, AlertTriangle } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';
import { PlannerWorkOrder } from '@/pages/ProductionPlanner';

interface MobileCalendarPageProps {
  currentDate: Date;
  workOrders: PlannerWorkOrder[];
  unscheduledOrders: PlannerWorkOrder[];
  loading: boolean;
  onSelectWorkOrder: (id: string) => void;
  onDateChange: (date: Date) => void;
  onViewCapacity: () => void;
  onScheduleOrder: (orderId: string) => void;
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
  workOrders,
  unscheduledOrders,
  loading,
  onSelectWorkOrder,
  onDateChange,
  onViewCapacity,
  onScheduleOrder,
}) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'unscheduled'>('scheduled');
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const dayOrders = workOrders.filter(wo => 
    wo.start_date && isSameDay(parseISO(wo.start_date), currentDate)
  );

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStart) return;
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;
    
    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        onDateChange(addDays(currentDate, 1));
      } else {
        onDateChange(subDays(currentDate, 1));
      }
    }
    setTouchStart(null);
  };

  const goToPrevDay = () => onDateChange(subDays(currentDate, 1));
  const goToNextDay = () => onDateChange(addDays(currentDate, 1));
  const goToToday = () => onDateChange(new Date());

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
          <Button variant="outline" size="icon" onClick={goToPrevDay} className="h-11 w-11">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          
          <div className="flex-1 text-center">
            <div className="font-semibold">
              {format(currentDate, language === 'nl' ? 'EEEE' : 'EEEE')}
            </div>
            <div className="text-sm text-muted-foreground">
              {format(currentDate, 'd MMMM yyyy')}
            </div>
          </div>
          
          <Button variant="outline" size="icon" onClick={goToNextDay} className="h-11 w-11">
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
              {dayOrders.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                  {dayOrders.length}
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
            {dayOrders.length === 0 ? (
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
              dayOrders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => onSelectWorkOrder(order.id)}
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
              ))
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

export default MobileCalendarPage;
