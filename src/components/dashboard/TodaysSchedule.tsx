import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Package, AlertTriangle, Clock, ArrowRight } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatProductType, formatStatus, getProductBreakdown, formatProductBreakdownText } from '@/lib/utils';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface WorkOrderItem {
  id: string;
  serial_number: string;
}

interface WorkOrder {
  id: string;
  wo_number: string;
  status: string;
  product_type: string;
  batch_size: number;
  start_date: string | null;
  shipping_date: string | null;
  items?: WorkOrderItem[];
}

export const TodaysSchedule = memo(function TodaysSchedule() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const isMountedRef = useRef(true);

  const fetchTodaysWorkOrders = useCallback(async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: woData, error: woError } = await supabase
      .from('work_orders')
      .select('id, wo_number, status, product_type, batch_size, start_date, shipping_date')
      .eq('start_date', today)
      .neq('status', 'cancelled')
      .order('wo_number', { ascending: true });

    if (woError) {
      console.error('Error fetching work orders:', woError);
      if (isMountedRef.current) setLoading(false);
      return;
    }

    if (!woData || woData.length === 0 || !isMountedRef.current) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }

    const woIds = woData.map(wo => wo.id);
    const { data: itemsData } = await supabase
      .from('work_order_items')
      .select('id, serial_number, work_order_id')
      .in('work_order_id', woIds);

    if (!isMountedRef.current) return;

    const workOrdersWithItems = woData.map(wo => ({
      ...wo,
      items: itemsData?.filter(item => item.work_order_id === wo.id) || [],
    }));

    setWorkOrders(workOrdersWithItems);
    setLoading(false);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    fetchTodaysWorkOrders();

    // Debounced realtime
    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel('todays-schedule-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders' },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (isMountedRef.current) fetchTodaysWorkOrders();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      isMountedRef.current = false;
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchTodaysWorkOrders]);

  const getStatusVariant = useCallback((status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'info';
      case 'on_hold': return 'muted';
      default: return 'muted';
    }
  }, []);

  const getShippingUrgency = useCallback((shippingDate: string | null) => {
    if (!shippingDate) return null;
    const today = new Date();
    const shipDate = parseISO(shippingDate);
    const daysUntilShipping = differenceInDays(shipDate, today);
    
    if (isAfter(today, shipDate)) {
      return 'overdue';
    } else if (daysUntilShipping <= 2) {
      return 'urgent';
    }
    return null;
  }, []);

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <span>{language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col w-full">
      <CardHeader className="pb-2 sm:pb-3 px-4 sm:px-6">
        <CardTitle className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
          </div>
          <span className="truncate">{language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}</span>
          {workOrders.length > 0 && (
            <Badge variant="secondary" className="ml-auto">
              {workOrders.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0 px-4 sm:px-6">
        {workOrders.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'nl' 
                ? 'Geen werkorders gepland voor vandaag' 
                : 'No work orders scheduled for today'}
            </p>
          </div>
        ) : (
          <div className="space-y-2 flex-1">
            {workOrders.slice(0, 4).map((wo, index) => {
              const productBreakdown = wo.items ? getProductBreakdown(wo.items) : [];
              const breakdownText = formatProductBreakdownText(productBreakdown);
              const urgency = getShippingUrgency(wo.shipping_date);
              
              return (
                <div
                  key={wo.id}
                  className={cn(
                    "group flex items-center justify-between p-3 rounded-lg border bg-card",
                    "hover:shadow-card-hover hover:border-primary/20 transition-all duration-normal cursor-pointer",
                    urgency === 'overdue' && "border-destructive/50 bg-destructive/5",
                    urgency === 'urgent' && "border-warning/50 bg-warning/5"
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                  onClick={() => navigate(`/production/${wo.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-data font-semibold text-sm">{wo.wo_number}</span>
                      <Badge variant={getStatusVariant(wo.status) as any}>
                        {formatStatus(wo.status)}
                      </Badge>
                      {urgency === 'overdue' && (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {urgency === 'urgent' && (
                        <Clock className="h-3.5 w-3.5 text-warning" />
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-muted-foreground">
                      <Package className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{breakdownText || formatProductType(wo.product_type)}</span>
                      {wo.shipping_date && (
                        <span className={cn(
                          "text-xs ml-auto shrink-0 font-data",
                          urgency === 'overdue' && "text-destructive font-medium",
                          urgency === 'urgent' && "text-warning font-medium"
                        )}>
                          → {format(parseISO(wo.shipping_date), 'dd/MM')}
                        </span>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity ml-2" />
                </div>
              );
            })}
            {workOrders.length > 4 && (
              <div className="text-sm text-muted-foreground text-center py-2">
                +{workOrders.length - 4} {language === 'nl' ? 'meer' : 'more'}
              </div>
            )}
          </div>
        )}
        <div className="pt-4 mt-auto border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full group"
            onClick={() => navigate('/calendar')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            {language === 'nl' ? 'Bekijk kalender' : 'View calendar'}
            <ArrowRight className="h-4 w-4 ml-auto opacity-50 group-hover:opacity-100 transition-opacity" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
