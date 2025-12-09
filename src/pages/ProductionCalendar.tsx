import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '@/components/Layout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Package } from 'lucide-react';

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
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draggedOrder, setDraggedOrder] = useState<WorkOrder | null>(null);

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

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    const order = workOrders.find(wo => wo.id === active.id);
    setDraggedOrder(order || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    setDraggedOrder(null);

    if (!over || active.id === over.id) return;

    const workOrderId = active.id as string;
    const newDate = over.id as string;

    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ scheduled_date: newDate })
        .eq('id', workOrderId);

      if (error) throw error;

      toast.success(t('workOrderRescheduled'));
      fetchWorkOrders();
    } catch (error) {
      console.error('Error rescheduling work order:', error);
      toast.error(t('errorUpdatingWorkOrder'));
    }
  };

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'> = {
      planned: 'secondary',
      in_progress: 'info',
      completed: 'success',
      on_hold: 'warning',
      cancelled: 'destructive',
    };
    return variants[status] || 'secondary';
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

  const unscheduledOrders = workOrders.filter(wo => !wo.scheduled_date);

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('productionCalendar')}</h1>
          <p className="text-muted-foreground mt-2">{t('productionCalendarDescription')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Unscheduled Work Orders */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>{t('unscheduledOrders')}</CardTitle>
              <CardDescription>{t('dragToSchedule')}</CardDescription>
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
                    <DraggableWorkOrder key={order.id} order={order} getStatusVariant={getStatusVariant} />
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
              <DndContext
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              >
                <div className="grid grid-cols-7 gap-2">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="text-center font-semibold text-sm py-2 text-muted-foreground">
                      {day}
                    </div>
                  ))}
                  {getDaysInMonth().map((date) => (
                    <CalendarDay
                      key={date.toISOString()}
                      date={date}
                      workOrders={getWorkOrdersForDate(date)}
                      getStatusVariant={getStatusVariant}
                      navigate={navigate}
                      onRefetch={fetchWorkOrders}
                    />
                  ))}
                </div>
                <DragOverlay>
                  {activeId && draggedOrder ? (
                    <div className="p-3 bg-card border rounded-lg shadow-lg cursor-grabbing">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="font-semibold text-sm">{draggedOrder.wo_number}</span>
                        <Badge variant={getStatusVariant(draggedOrder.status)}>
                          {draggedOrder.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {draggedOrder.product_type} • {draggedOrder.batch_size} units
                      </p>
                    </div>
                  ) : null}
                </DragOverlay>
              </DndContext>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

// Draggable Work Order Component
const DraggableWorkOrder: React.FC<{
  order: WorkOrder;
  getStatusVariant: (status: string) => 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline';
}> = ({ order, getStatusVariant }) => {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsDragging(true);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('workOrderId', order.id);
      }}
      onDragEnd={() => setIsDragging(false)}
      className={`p-3 bg-card border rounded-lg cursor-grab active:cursor-grabbing transition-opacity ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="font-semibold text-sm truncate">{order.wo_number}</span>
        <Badge variant={getStatusVariant(order.status)}>{order.status}</Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {order.product_type} • {order.batch_size} units
      </p>
    </div>
  );
};

// Calendar Day Component
const CalendarDay: React.FC<{
  date: Date;
  workOrders: WorkOrder[];
  getStatusVariant: (status: string) => 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline';
  navigate: (path: string) => void;
  onRefetch: () => void;
}> = ({ date, workOrders, getStatusVariant, navigate, onRefetch }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const dateString = format(date, 'yyyy-MM-dd');
  const isToday = isSameDay(date, new Date());

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const workOrderId = e.dataTransfer.getData('workOrderId');
    
    if (workOrderId) {
      try {
        const { error } = await supabase
          .from('work_orders')
          .update({ scheduled_date: dateString })
          .eq('id', workOrderId);

        if (error) throw error;

        toast.success(t('success'), { description: t('workOrderScheduled') || 'Work order scheduled' });
        onRefetch(); // Refetch to show updated schedule (SPA-friendly)
      } catch (error) {
        console.error('Error scheduling work order:', error);
        toast.error(t('error'), { description: t('errorSchedulingWorkOrder') || 'Failed to schedule work order' });
      }
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`min-h-[100px] p-2 border rounded-lg transition-colors ${
        isToday ? 'bg-primary/5 border-primary/20' : 'bg-card'
      } ${isDragOver ? 'bg-primary/10 border-primary' : ''}`}
    >
      <div className={`text-sm font-medium mb-2 ${isToday ? 'text-primary' : 'text-foreground'}`}>
        {format(date, 'd')}
      </div>
      <div className="space-y-1">
        {workOrders.map((order) => (
          <div
            key={order.id}
            onClick={() => navigate(`/production/${order.id}`)}
            className="p-1.5 bg-background/50 border rounded text-xs cursor-pointer hover:bg-background/80 transition-colors"
          >
            <div className="font-medium truncate">{order.wo_number}</div>
            <div className="text-muted-foreground truncate text-[10px]">
              {order.product_type}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductionCalendar;
