import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO, addWeeks, subWeeks, differenceInDays, isWithinInterval, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Package, CalendarIcon, LayoutGrid, List, ArrowRight, Play, Flag, Plus, GanttChartSquare, X, Users } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';
import { CreateWorkOrderDialogWithDate } from '@/components/calendar/CreateWorkOrderFromCalendar';
import { CancelWorkOrderDialog } from '@/components/workorders/CancelWorkOrderDialog';
import { OperatorCapacityPanel } from '@/components/calendar/OperatorCapacityPanel';
import { OperatorAssignmentSelect } from '@/components/calendar/OperatorAssignmentSelect';
import { CapacityIndicator, useCapacityData } from '@/components/calendar/CapacityIndicator';
import WeeklyCapacityPlanner from '@/components/calendar/WeeklyCapacityPlanner';

interface WorkOrder {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  start_date: string | null;
  shipping_date: string | null;
  customer_name: string | null;
}

type DateViewMode = 'start' | 'ship' | 'timeline';
type CalendarViewMode = 'month' | 'week' | 'capacity';

const ProductionCalendar = () => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { isAdmin } = useUserProfile();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [calendarView, setCalendarView] = useState<CalendarViewMode>('month');
  const [dateView, setDateView] = useState<DateViewMode>('start');
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newStartDate, setNewStartDate] = useState<Date | undefined>(undefined);
  const [newShipDate, setNewShipDate] = useState<Date | undefined>(undefined);
  const [updating, setUpdating] = useState(false);
  
  // Click-to-schedule state
  const [schedulingDate, setSchedulingDate] = useState<Date | null>(null);
  const [unscheduledOrders, setUnscheduledOrders] = useState<WorkOrder[]>([]);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [selectedUnscheduledOrder, setSelectedUnscheduledOrder] = useState<string>('');
  const [operatorAssignments, setOperatorAssignments] = useState<{ operatorId: string; plannedHours: number }[]>([]);
  
  // Create new work order from calendar
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForDate, setCreateForDate] = useState<Date | null>(null);
  
  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  // Capacity panel state
  const [selectedCapacityDate, setSelectedCapacityDate] = useState(new Date());
  const [showCapacityPanel, setShowCapacityPanel] = useState(true);

  // Calculate date range for current view
  const viewStartDate = calendarView === 'month'
    ? startOfMonth(currentDate)
    : startOfWeek(currentDate, { weekStartsOn: 1 });
  const viewEndDate = calendarView === 'month'
    ? endOfMonth(currentDate)
    : endOfWeek(currentDate, { weekStartsOn: 1 });

  // Capacity data for calendar indicators
  const { getCapacityForDate } = useCapacityData(viewStartDate, viewEndDate, calendarView === 'capacity' ? 'week' : calendarView);

  useEffect(() => {
    if (user) {
      fetchWorkOrders();
    }
  }, [user, currentDate, calendarView]);

  // Sync capacity panel date with calendar navigation
  useEffect(() => {
    setSelectedCapacityDate(currentDate);
  }, [currentDate]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      let start: Date, end: Date;
      
      if (calendarView === 'month') {
        start = startOfMonth(currentDate);
        end = endOfMonth(currentDate);
      } else {
        start = startOfWeek(currentDate, { weekStartsOn: 1 });
        end = endOfWeek(currentDate, { weekStartsOn: 1 });
      }

      // For timeline view, we need both start_date and shipping_date in range
      const { data, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, start_date, shipping_date, customer_name')
        .neq('status', 'cancelled')
        .or(`start_date.gte.${format(start, 'yyyy-MM-dd')},shipping_date.gte.${format(start, 'yyyy-MM-dd')}`)
        .or(`start_date.lte.${format(end, 'yyyy-MM-dd')},shipping_date.lte.${format(end, 'yyyy-MM-dd')}`)
        .order('start_date', { ascending: true });

      if (error) throw error;
      
      // Filter to orders that overlap with the view range
      const filtered = (data || []).filter(wo => {
        const woStart = wo.start_date ? parseISO(wo.start_date) : null;
        const woEnd = wo.shipping_date ? parseISO(wo.shipping_date) : null;
        
        // For timeline, show if any part overlaps
        if (woStart && woEnd) {
          return woStart <= end && woEnd >= start;
        }
        // For single date, check if within range
        if (woStart) return woStart >= start && woStart <= end;
        if (woEnd) return woEnd >= start && woEnd <= end;
        return false;
      });
      
      setWorkOrders(filtered);
      
      // Also fetch unscheduled orders for click-to-schedule
      const { data: unscheduled } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, start_date, shipping_date, customer_name')
        .neq('status', 'cancelled')
        .neq('status', 'completed')
        .is('start_date', null)
        .order('created_at', { ascending: false })
        .limit(50);
      
      setUnscheduledOrders(unscheduled || []);
    } catch (error) {
      console.error('Error fetching work orders:', error);
      toast.error(t('errorFetchingData'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-info text-info-foreground';
      case 'in_progress': return 'bg-warning text-warning-foreground';
      case 'completed': return 'bg-success text-success-foreground';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getStatusBorderColor = (status: string) => {
    switch (status) {
      case 'planned': return 'border-info';
      case 'in_progress': return 'border-warning';
      case 'completed': return 'border-success';
      default: return 'border-border';
    }
  };

  const getStatusBgColor = (status: string) => {
    switch (status) {
      case 'planned': return 'bg-info/20';
      case 'in_progress': return 'bg-warning/20';
      case 'completed': return 'bg-success/20';
      default: return 'bg-muted/20';
    }
  };

  const getDaysInView = () => {
    if (calendarView === 'month') {
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);
      return eachDayOfInterval({ start, end });
    } else {
      const start = startOfWeek(currentDate, { weekStartsOn: 1 });
      const end = endOfWeek(currentDate, { weekStartsOn: 1 });
      return eachDayOfInterval({ start, end });
    }
  };

  const getWorkOrdersForDate = useCallback((date: Date) => {
    return workOrders.filter(wo => {
      if (dateView === 'start') {
        return wo.start_date && isSameDay(parseISO(wo.start_date), date);
      } else if (dateView === 'ship') {
        return wo.shipping_date && isSameDay(parseISO(wo.shipping_date), date);
      }
      return false;
    });
  }, [workOrders, dateView]);

  // For timeline view: check if a work order spans this date
  const getTimelineOrdersForDate = useCallback((date: Date) => {
    return workOrders.filter(wo => {
      if (!wo.start_date || !wo.shipping_date) return false;
      const start = parseISO(wo.start_date);
      const end = parseISO(wo.shipping_date);
      return isWithinInterval(date, { start, end }) || isSameDay(date, start) || isSameDay(date, end);
    });
  }, [workOrders]);

  const goToPrevious = () => {
    if (calendarView === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subWeeks(currentDate, 1));
    }
  };

  const goToNext = () => {
    if (calendarView === 'month') {
      setCurrentDate(addMonths(currentDate, 1));
    } else {
      setCurrentDate(addWeeks(currentDate, 1));
    }
  };

  const handleOrderClick = (order: WorkOrder) => {
    if (!isAdmin) {
      navigate(`/production/${order.id}`);
      return;
    }
    if (order.status === 'completed') {
      navigate(`/production/${order.id}`);
      return;
    }
    setSelectedOrder(order);
    setNewStartDate(order.start_date ? parseISO(order.start_date) : undefined);
    setNewShipDate(order.shipping_date ? parseISO(order.shipping_date) : undefined);
    setDialogOpen(true);
  };

  // Click on empty day to schedule or create new
  const handleDayClick = (date: Date) => {
    // Always update capacity panel date when clicking on a day
    setSelectedCapacityDate(date);

    if (!isAdmin) return;
    setSchedulingDate(date);
    setSelectedUnscheduledOrder('');
    setOperatorAssignments([]);
    setScheduleDialogOpen(true);
  };
  
  // Open create work order dialog with date pre-filled
  const handleCreateNewFromCalendar = () => {
    if (!schedulingDate) return;
    setCreateForDate(schedulingDate);
    setScheduleDialogOpen(false);
    setCreateDialogOpen(true);
  };
  
  const handleWorkOrderCreated = () => {
    setCreateDialogOpen(false);
    setCreateForDate(null);
    fetchWorkOrders();
  };

  const handleSaveDate = async () => {
    if (!selectedOrder) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ 
          start_date: newStartDate ? format(newStartDate, 'yyyy-MM-dd') : null,
          shipping_date: newShipDate ? format(newShipDate, 'yyyy-MM-dd') : null 
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast.success(t('success'), { description: 'Work order dates updated' });
      setDialogOpen(false);
      fetchWorkOrders();
    } catch (error) {
      console.error('Error scheduling work order:', error);
      toast.error(t('error'), { description: 'Failed to update work order' });
    } finally {
      setUpdating(false);
    }
  };

  const handleQuickSchedule = async () => {
    if (!schedulingDate || !selectedUnscheduledOrder) return;

    setUpdating(true);
    try {
      const dateStr = format(schedulingDate, 'yyyy-MM-dd');

      // Update work order start date
      const { error: woError } = await supabase
        .from('work_orders')
        .update({ start_date: dateStr })
        .eq('id', selectedUnscheduledOrder);

      if (woError) throw woError;

      // Save operator assignments if any
      if (operatorAssignments.length > 0) {
        const assignmentRecords = operatorAssignments.map(a => ({
          work_order_id: selectedUnscheduledOrder,
          operator_id: a.operatorId,
          assigned_date: dateStr,
          planned_hours: a.plannedHours,
          assigned_by: user?.id,
        }));

        const { error: assignError } = await supabase
          .from('operator_assignments')
          .upsert(assignmentRecords, {
            onConflict: 'work_order_id,operator_id,assigned_date',
          });

        if (assignError) {
          console.error('Error saving operator assignments:', assignError);
          // Don't fail the whole operation, just log it
        }
      }

      toast.success(t('success'), { description: language === 'nl' ? 'Werkorder gepland' : 'Work order scheduled' });
      setScheduleDialogOpen(false);
      setOperatorAssignments([]);
      fetchWorkOrders();
    } catch (error) {
      console.error('Error scheduling work order:', error);
      toast.error(t('error'), { description: language === 'nl' ? 'Kon werkorder niet plannen' : 'Failed to schedule work order' });
    } finally {
      setUpdating(false);
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const handleCancelWorkOrder = async (reason: string) => {
    if (!selectedOrder) return;
    
    setIsCancelling(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ 
          status: 'cancelled',
          cancellation_reason: reason 
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast.success(t('success'), { description: language === 'nl' ? 'Werkorder geannuleerd' : 'Work order cancelled' });
      setCancelDialogOpen(false);
      setDialogOpen(false);
      fetchWorkOrders();
    } catch (error) {
      console.error('Error cancelling work order:', error);
      toast.error(t('error'), { description: language === 'nl' ? 'Kon werkorder niet annuleren' : 'Failed to cancel work order' });
    } finally {
      setIsCancelling(false);
    }
  };

  // Timeline view component
  const renderTimelineView = () => {
    const days = getDaysInView();
    const ordersWithBothDates = workOrders.filter(wo => wo.start_date && wo.shipping_date);
    
    return (
      <div className="overflow-x-auto">
        <div className="min-w-[800px]">
          {/* Header row with dates */}
          <div className="flex border-b">
            <div className="w-48 flex-shrink-0 p-2 font-medium text-sm bg-muted/30">
              Work Order
            </div>
            <div className="flex flex-1">
              {days.map(day => (
                <div 
                  key={day.toISOString()} 
                  className={cn(
                    "flex-1 min-w-[40px] p-1 text-center text-xs border-l",
                    isSameDay(day, new Date()) && "bg-primary/10"
                  )}
                >
                  <div className="font-medium">{format(day, 'd')}</div>
                  <div className="text-muted-foreground text-[10px]">{format(day, 'EEE')}</div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Work order rows */}
          {ordersWithBothDates.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">
              No work orders with both start and ship dates in this period
            </div>
          ) : (
            ordersWithBothDates.map(order => {
              const startDate = parseISO(order.start_date!);
              const endDate = parseISO(order.shipping_date!);
              
              return (
                <div key={order.id} className="flex border-b hover:bg-muted/20">
                  <div 
                    className="w-48 flex-shrink-0 p-2 border-r cursor-pointer hover:bg-muted/30"
                    onClick={() => handleOrderClick(order)}
                  >
                    <div className="font-medium text-sm truncate">{order.wo_number}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {formatProductType(order.product_type)}
                    </div>
                    <Badge className={cn("mt-1 text-[10px]", getStatusColor(order.status))}>
                      {formatStatus(order.status)}
                    </Badge>
                  </div>
                  <div className="flex flex-1 relative">
                    {days.map((day, dayIndex) => {
                      const isStart = isSameDay(day, startDate);
                      const isEnd = isSameDay(day, endDate);
                      const isInRange = isWithinInterval(day, { start: startDate, end: endDate });
                      const isToday = isSameDay(day, new Date());
                      
                      return (
                        <div 
                          key={day.toISOString()} 
                          className={cn(
                            "flex-1 min-w-[40px] min-h-[60px] border-l relative",
                            isToday && "bg-primary/5"
                          )}
                        >
                          {(isStart || isEnd || isInRange) && (
                            <div 
                              className={cn(
                                "absolute inset-y-2 flex items-center justify-center",
                                isStart && "left-0 rounded-l-md",
                                isEnd && "right-0 rounded-r-md",
                                !isStart && "left-0",
                                !isEnd && "right-0",
                                getStatusBgColor(order.status),
                                getStatusBorderColor(order.status),
                                "border-y-2",
                                isStart && "border-l-2",
                                isEnd && "border-r-2"
                              )}
                              style={{
                                left: isStart ? '4px' : '0',
                                right: isEnd ? '4px' : '0',
                              }}
                            >
                              {isStart && <Play className="h-3 w-3 text-foreground/70" />}
                              {isEnd && <Flag className="h-3 w-3 text-foreground/70" />}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Regular calendar grid
  const renderCalendarGrid = () => {
    const days = getDaysInView();
    
    return (
      <div className="w-full">
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 md:gap-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
            <div key={day} className="text-center font-semibold text-[10px] sm:text-xs md:text-sm py-1 sm:py-2 text-muted-foreground">
              <span className="hidden md:inline">{day}</span>
              <span className="hidden sm:inline md:hidden">{day.slice(0, 2)}</span>
              <span className="sm:hidden">{day.slice(0, 1)}</span>
            </div>
          ))}
          {days.map((date) => {
            const dayOrders = getWorkOrdersForDate(date);
            const isToday = isSameDay(date, new Date());
            const hasUnscheduled = isAdmin && unscheduledOrders.length > 0;
            
            return (
              <div
                key={date.toISOString()}
                className={cn(
                  "min-h-[50px] sm:min-h-[70px] md:min-h-[90px] lg:min-h-[100px] p-0.5 sm:p-1 md:p-2 border rounded sm:rounded-lg bg-card relative group",
                  isToday && "bg-primary/5 border-primary/20",
                  hasUnscheduled && isAdmin && "cursor-pointer hover:border-primary/40"
                )}
                onClick={() => dayOrders.length === 0 && handleDayClick(date)}
              >
                <div className={cn(
                  "text-[10px] sm:text-xs md:text-sm font-medium mb-0.5 sm:mb-1 md:mb-2 flex items-center justify-between",
                  isToday ? "text-primary" : "text-foreground"
                )}>
                  <span>{format(date, 'd')}</span>
                  <div className="flex items-center gap-1">
                    <CapacityIndicator
                      date={date}
                      capacityData={getCapacityForDate(date)}
                      compact
                    />
                    {hasUnscheduled && dayOrders.length === 0 && (
                      <Plus className="h-3 w-3 opacity-0 group-hover:opacity-100 text-primary transition-opacity" />
                    )}
                  </div>
                </div>
                <div className="space-y-0.5">
                  {dayOrders.slice(0, 2).map((order) => (
                    <div
                      key={order.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOrderClick(order);
                      }}
                      className={cn(
                        "p-0.5 sm:p-1 md:p-1.5 border-l-2 bg-background/50 rounded text-[8px] sm:text-[10px] md:text-xs cursor-pointer hover:bg-background/80 transition-colors",
                        getStatusBorderColor(order.status)
                      )}
                    >
                      <div className="font-medium truncate">{order.wo_number}</div>
                      <div className="text-muted-foreground truncate text-[7px] sm:text-[9px] md:text-[10px] hidden md:block">
                        {formatProductType(order.product_type)}
                      </div>
                    </div>
                  ))}
                  {dayOrders.length > 2 && (
                    <div className="text-[8px] sm:text-[10px] md:text-xs text-muted-foreground text-center">
                      +{dayOrders.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Week list view
  const renderWeekView = () => {
    const days = getDaysInView();
    
    return (
      <div className="space-y-4">
        {days.map((date) => {
          const dayOrders = getWorkOrdersForDate(date);
          const isToday = isSameDay(date, new Date());
          const hasUnscheduled = isAdmin && unscheduledOrders.length > 0;
          
          return (
            <div
              key={date.toISOString()}
              className={cn(
                "p-4 border rounded-lg bg-card",
                isToday && "bg-primary/5 border-primary/20"
              )}
            >
              <div className={cn(
                "text-sm font-semibold mb-3 pb-2 border-b flex items-center justify-between",
                isToday ? "text-primary" : "text-foreground"
              )}>
                <div className="flex items-center gap-3">
                  <span>
                    {format(date, 'EEEE, MMMM d')}
                    {isToday && <span className="ml-2 text-xs font-normal text-muted-foreground">(Today)</span>}
                  </span>
                  <CapacityIndicator
                    date={date}
                    capacityData={getCapacityForDate(date)}
                  />
                </div>
                {hasUnscheduled && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => handleDayClick(date)}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Schedule
                  </Button>
                )}
              </div>
              {dayOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No work orders scheduled</p>
              ) : (
                <div className="space-y-2">
                  {dayOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order)}
                      className={cn(
                        "p-3 border-l-4 bg-background/50 rounded-lg cursor-pointer hover:bg-background/80 transition-colors",
                        getStatusBorderColor(order.status)
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold">{order.wo_number}</span>
                        <Badge className={getStatusColor(order.status)}>
                          {formatStatus(order.status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {formatProductType(order.product_type)} • {order.batch_size} units
                        {order.customer_name && ` • ${order.customer_name}`}
                      </div>
                      {order.start_date && order.shipping_date && (
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <Play className="h-3 w-3" />
                          {format(parseISO(order.start_date), 'MMM d')}
                          <ArrowRight className="h-3 w-3" />
                          <Flag className="h-3 w-3" />
                          {format(parseISO(order.shipping_date), 'MMM d')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Layout>
      <div className="space-y-4 sm:space-y-6 w-full max-w-full overflow-hidden">
        <PageHeader title={t('productionCalendar')} description={t('productionCalendarDescription')} />

        {/* Status Legend */}
        <Card>
          <CardContent className="py-2 sm:py-3 px-3 sm:px-6">
            <div className="flex flex-wrap items-center gap-2 sm:gap-4">
              <span className="text-xs sm:text-sm font-medium text-muted-foreground">{t('legend')}:</span>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-info"></div>
                <span className="text-xs sm:text-sm">{t('planned')}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-warning"></div>
                <span className="text-xs sm:text-sm">{t('inProgress')}</span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full bg-success"></div>
                <span className="text-xs sm:text-sm">{t('completed')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main content with calendar and capacity panel */}
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-6">
          {/* Calendar card */}
          <div className="flex-1 min-w-0">
          <Card>
            <CardHeader className="px-3 sm:px-6 pb-3 sm:pb-4">
              <div className="flex flex-col gap-3">
                {/* Top row: Title and navigation */}
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base sm:text-lg">
                    {calendarView === 'month' 
                      ? format(currentDate, 'MMMM yyyy')
                      : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d')} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), 'MMM d, yyyy')}`
                    }
                  </CardTitle>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToPrevious}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={goToNext}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Second row: View controls */}
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Calendar view toggle */}
                  <div className="flex border rounded-md">
                    <Button 
                      variant={calendarView === 'week' ? 'secondary' : 'ghost'} 
                      size="sm"
                      className="rounded-r-none text-xs h-8 px-2 sm:px-3"
                      onClick={() => setCalendarView('week')}
                    >
                      <List className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">{t('week')}</span>
                    </Button>
                    <Button 
                      variant={calendarView === 'month' ? 'secondary' : 'ghost'} 
                      size="sm"
                      className="rounded-none border-x text-xs h-8 px-2 sm:px-3"
                      onClick={() => setCalendarView('month')}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">{t('month')}</span>
                    </Button>
                    <Button 
                      variant={calendarView === 'capacity' ? 'secondary' : 'ghost'} 
                      size="sm"
                      className="rounded-l-none text-xs h-8 px-2 sm:px-3"
                      onClick={() => setCalendarView('capacity')}
                    >
                      <Users className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">{language === 'nl' ? 'Capaciteit' : 'Capacity'}</span>
                    </Button>
                  </div>

                  {/* Date view selector */}
                  <Select value={dateView} onValueChange={(v) => setDateView(v as DateViewMode)}>
                    <SelectTrigger className="w-[140px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="start">
                        <div className="flex items-center gap-2">
                          <Play className="h-3 w-3" />
                          Start Dates
                        </div>
                      </SelectItem>
                      <SelectItem value="ship">
                        <div className="flex items-center gap-2">
                          <Flag className="h-3 w-3" />
                          Ship Dates
                        </div>
                      </SelectItem>
                      <SelectItem value="timeline">
                        <div className="flex items-center gap-2">
                          <GanttChartSquare className="h-3 w-3" />
                          Timeline
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  {/* Unscheduled count badge */}
                  {isAdmin && unscheduledOrders.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {unscheduledOrders.length} unscheduled
                    </Badge>
                  )}

                  {/* Capacity panel toggle - only show when not in capacity view */}
                  {calendarView !== 'capacity' && (
                    <Button
                      variant={showCapacityPanel ? 'secondary' : 'outline'}
                      size="sm"
                      className="h-8 text-xs px-2 sm:px-3 hidden lg:flex"
                      onClick={() => setShowCapacityPanel(!showCapacityPanel)}
                    >
                      <Users className="h-3.5 w-3.5 sm:mr-1" />
                      <span className="hidden sm:inline">{language === 'nl' ? 'Capaciteit' : 'Capacity'}</span>
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 sm:px-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : calendarView === 'capacity' ? (
                <WeeklyCapacityPlanner />
              ) : dateView === 'timeline' ? (
                renderTimelineView()
              ) : calendarView === 'month' ? (
                renderCalendarGrid()
              ) : (
                renderWeekView()
              )}
            </CardContent>
          </Card>
          </div>

          {/* Capacity Panel Sidebar - hide when in capacity view */}
          {showCapacityPanel && calendarView !== 'capacity' && (
            <div className="hidden lg:block w-[340px] flex-shrink-0">
              <OperatorCapacityPanel
                selectedDate={selectedCapacityDate}
                onAssignOperator={(operatorId, date) => {
                  // Open scheduling dialog to assign operator to a work order
                  setSchedulingDate(date);
                  setScheduleDialogOpen(true);
                }}
              />
            </div>
          )}
        </div>

        {/* Edit Work Order Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Work Order Dates</DialogTitle>
              <DialogDescription>
                {selectedOrder?.wo_number} - {selectedOrder && formatProductType(selectedOrder.product_type)}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{t('currentStatus')}:</span>
                <Badge className={selectedOrder ? getStatusColor(selectedOrder.status) : ''}>
                  {selectedOrder && formatStatus(selectedOrder.status)}
                </Badge>
              </div>
              
              {/* Start Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Play className="h-4 w-4" /> Start Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newStartDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newStartDate ? format(newStartDate, "PPP") : <span>Select start date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newStartDate}
                      onSelect={setNewStartDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Ship Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Flag className="h-4 w-4" /> Ship Date
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !newShipDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {newShipDate ? format(newShipDate, "PPP") : <span>Select ship date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={newShipDate}
                      onSelect={setNewShipDate}
                      initialFocus
                      className="pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {newStartDate && newShipDate && (
                <div className="text-sm text-muted-foreground flex items-center gap-2 p-2 bg-muted/30 rounded">
                  <span>Duration:</span>
                  <span className="font-medium">{differenceInDays(newShipDate, newStartDate)} days</span>
                </div>
              )}
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button 
                variant="destructive" 
                onClick={() => setCancelDialogOpen(true)}
                className="w-full sm:w-auto order-last sm:order-first"
              >
                <X className="h-4 w-4 mr-1" />
                {t('cancel')}
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setDialogOpen(false);
                    navigate(`/production/${selectedOrder?.id}`);
                  }}
                  className="flex-1 sm:flex-none"
                >
                  {t('viewWorkOrder')}
                </Button>
                <Button onClick={handleSaveDate} disabled={updating} className="flex-1 sm:flex-none">
                  {t('save')}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Quick Schedule Dialog */}
        <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{language === 'nl' ? 'Werkorder Plannen' : 'Schedule Work Order'}</DialogTitle>
              <DialogDescription>
                {schedulingDate && format(schedulingDate, 'MMMM d, yyyy')}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 space-y-4">
              {unscheduledOrders.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    {language === 'nl' ? 'Bestaande werkorder plannen' : 'Schedule existing work order'}
                  </Label>
                  <Select value={selectedUnscheduledOrder} onValueChange={setSelectedUnscheduledOrder}>
                    <SelectTrigger>
                      <SelectValue placeholder={language === 'nl' ? 'Selecteer een werkorder...' : 'Select a work order...'} />
                    </SelectTrigger>
                    <SelectContent>
                      {unscheduledOrders.map(order => (
                        <SelectItem key={order.id} value={order.id}>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{order.wo_number}</span>
                            <span className="text-muted-foreground text-xs">
                              {formatProductType(order.product_type)} • {order.batch_size} units
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Operator Assignment Section */}
              {selectedUnscheduledOrder && schedulingDate && (
                <OperatorAssignmentSelect
                  selectedDate={schedulingDate}
                  workOrderId={selectedUnscheduledOrder}
                  initialAssignments={operatorAssignments}
                  onChange={setOperatorAssignments}
                />
              )}

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {language === 'nl' ? 'of' : 'or'}
                  </span>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleCreateNewFromCalendar}
              >
                <Plus className="h-4 w-4 mr-2" />
                {language === 'nl' ? 'Nieuwe werkorder aanmaken' : 'Create new work order'}
              </Button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setScheduleDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button 
                onClick={handleQuickSchedule} 
                disabled={updating || !selectedUnscheduledOrder}
              >
                {language === 'nl' ? 'Plannen' : 'Schedule'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Create Work Order from Calendar Dialog */}
        <CreateWorkOrderDialogWithDate
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={handleWorkOrderCreated}
          initialStartDate={createForDate}
        />
        
        {/* Cancel Work Order Dialog */}
        <CancelWorkOrderDialog
          open={cancelDialogOpen}
          onOpenChange={setCancelDialogOpen}
          onConfirm={handleCancelWorkOrder}
          woNumber={selectedOrder?.wo_number || ''}
          isLoading={isCancelling}
        />
      </div>
    </Layout>
  );
};

export default ProductionCalendar;
