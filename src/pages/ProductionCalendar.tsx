import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { PageHeader } from '@/components/PageHeader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Package, CalendarIcon } from 'lucide-react';
import { cn, formatProductType } from '@/lib/utils';

interface WorkOrder {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  scheduled_date: string | null;
}

const ProductionCalendar = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<WorkOrder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDate, setNewDate] = useState<Date | undefined>(undefined);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (user) {
      fetchWorkOrders();
    }
  }, [user, currentDate]);

  const fetchWorkOrders = async () => {
    try {
      setLoading(true);
      const start = startOfMonth(currentDate);
      const end = endOfMonth(currentDate);

      const { data, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, scheduled_date')
        .neq('status', 'cancelled')
        .or(`scheduled_date.gte.${format(start, 'yyyy-MM-dd')},scheduled_date.lte.${format(end, 'yyyy-MM-dd')},scheduled_date.is.null`)
        .order('scheduled_date', { ascending: true });

      if (error) throw error;
      setWorkOrders(data || []);
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

  const getDaysInMonth = () => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getWorkOrdersForDate = (date: Date) => {
    return workOrders.filter(wo => 
      wo.scheduled_date && isSameDay(parseISO(wo.scheduled_date), date)
    );
  };

  const unscheduledOrders = workOrders.filter(wo => !wo.scheduled_date && wo.status !== 'completed');

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const handleOrderClick = (order: WorkOrder) => {
    // Don't allow date changes for completed orders
    if (order.status === 'completed') {
      navigate(`/production/${order.id}`);
      return;
    }
    setSelectedOrder(order);
    setNewDate(order.scheduled_date ? parseISO(order.scheduled_date) : undefined);
    setDialogOpen(true);
  };

  const handleSaveDate = async () => {
    if (!selectedOrder) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date: newDate ? format(newDate, 'yyyy-MM-dd') : null })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast.success(t('success'), { description: t('workOrderScheduled') || 'Work order scheduled' });
      setDialogOpen(false);
      fetchWorkOrders();
    } catch (error) {
      console.error('Error scheduling work order:', error);
      toast.error(t('error'), { description: t('errorSchedulingWorkOrder') || 'Failed to schedule work order' });
    } finally {
      setUpdating(false);
    }
  };

  const handleClearDate = async () => {
    if (!selectedOrder) return;
    
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date: null })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      toast.success(t('success'), { description: t('scheduleCleared') || 'Schedule cleared' });
      setDialogOpen(false);
      fetchWorkOrders();
    } catch (error) {
      console.error('Error clearing schedule:', error);
      toast.error(t('error'));
    } finally {
      setUpdating(false);
    }
  };

  const formatStatus = (status: string) => {
    return status.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <Layout>
      <div className="space-y-6">
        <PageHeader title={t('productionCalendar')} description={t('productionCalendarDescription')} />

        {/* Status Legend */}
        <Card>
          <CardContent className="py-3">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-medium text-muted-foreground">{t('legend')}:</span>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-info"></div>
                <span className="text-sm">{t('planned')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning"></div>
                <span className="text-sm">{t('inProgress')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-success"></div>
                <span className="text-sm">{t('completed')}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Unscheduled Work Orders */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{t('unscheduledOrders')}</CardTitle>
              <CardDescription>{t('clickToSchedule')}</CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
              ) : unscheduledOrders.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">{t('noUnscheduledOrders')}</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unscheduledOrders.map((order) => (
                    <div
                      key={order.id}
                      onClick={() => handleOrderClick(order)}
                      className={cn(
                        "p-3 bg-card border-l-4 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors",
                        getStatusBorderColor(order.status)
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm truncate">{order.wo_number}</span>
                        <Badge className={getStatusColor(order.status)}>{formatStatus(order.status)}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatProductType(order.product_type)} • {order.batch_size} units
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Calendar Grid */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{format(currentDate, 'MMMM yyyy')}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="icon" onClick={goToNextMonth}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-2">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                  <div key={day} className="text-center font-semibold text-sm py-2 text-muted-foreground">
                    {day}
                  </div>
                ))}
                {getDaysInMonth().map((date) => {
                  const dayOrders = getWorkOrdersForDate(date);
                  const isToday = isSameDay(date, new Date());
                  
                  return (
                    <div
                      key={date.toISOString()}
                      className={cn(
                        "min-h-[100px] p-2 border rounded-lg bg-card",
                        isToday && "bg-primary/5 border-primary/20"
                      )}
                    >
                      <div className={cn(
                        "text-sm font-medium mb-2",
                        isToday ? "text-primary" : "text-foreground"
                      )}>
                        {format(date, 'd')}
                      </div>
                      <div className="space-y-1">
                        {dayOrders.map((order) => (
                          <div
                            key={order.id}
                            onClick={() => handleOrderClick(order)}
                            className={cn(
                              "p-1.5 border-l-2 bg-background/50 rounded text-xs cursor-pointer hover:bg-background/80 transition-colors",
                              getStatusBorderColor(order.status)
                            )}
                          >
                            <div className="font-medium truncate">{order.wo_number}</div>
                            <div className="text-muted-foreground truncate text-[10px]">
                              {formatProductType(order.product_type)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Schedule Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('scheduleWorkOrder')}</DialogTitle>
              <DialogDescription>
                {selectedOrder?.wo_number} - {selectedOrder && formatProductType(selectedOrder.product_type)}
              </DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">{t('currentStatus')}:</span>
                <Badge className={selectedOrder ? getStatusColor(selectedOrder.status) : ''}>
                  {selectedOrder && formatStatus(selectedOrder.status)}
                </Badge>
              </div>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !newDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {newDate ? format(newDate, "PPP") : <span>{t('selectDate')}</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={newDate}
                    onSelect={setNewDate}
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
            <DialogFooter className="gap-2">
              {selectedOrder?.scheduled_date && (
                <Button variant="outline" onClick={handleClearDate} disabled={updating}>
                  {t('clearSchedule')}
                </Button>
              )}
              <Button onClick={handleSaveDate} disabled={updating || !newDate}>
                {t('save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default ProductionCalendar;