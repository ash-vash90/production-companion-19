import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Package, AlertTriangle, Clock } from 'lucide-react';
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

export function TodaysSchedule() {
  const { language, t } = useLanguage();
  const navigate = useNavigate();
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTodaysWorkOrders = async () => {
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data: woData, error: woError } = await supabase
      .from('work_orders')
      .select('id, wo_number, status, product_type, batch_size, start_date, shipping_date')
      .eq('start_date', today)
      .neq('status', 'cancelled')
      .order('wo_number', { ascending: true });

    if (woError) {
      console.error('Error fetching work orders:', woError);
      setLoading(false);
      return;
    }

    if (!woData || woData.length === 0) {
      setWorkOrders([]);
      setLoading(false);
      return;
    }

    const woIds = woData.map(wo => wo.id);
    const { data: itemsData } = await supabase
      .from('work_order_items')
      .select('id, serial_number, work_order_id')
      .in('work_order_id', woIds);

    const workOrdersWithItems = woData.map(wo => ({
      ...wo,
      items: itemsData?.filter(item => item.work_order_id === wo.id) || [],
    }));

    setWorkOrders(workOrdersWithItems);
    setLoading(false);
  };

  useEffect(() => {
    fetchTodaysWorkOrders();

    const channel = supabase
      .channel('todays-schedule-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders',
        },
        () => {
          fetchTodaysWorkOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed': return 'success';
      case 'in_progress': return 'warning';
      case 'planned': return 'info';
      case 'on_hold': return 'secondary';
      default: return 'secondary';
    }
  };

  const getShippingUrgency = (shippingDate: string | null) => {
    if (!shippingDate) return null;
    const today = new Date();
    const shipDate = parseISO(shippingDate);
    const daysUntilShipping = differenceInDays(shipDate, today);
    
    if (isAfter(today, shipDate)) {
      return 'overdue'; // Past due - red
    } else if (daysUntilShipping <= 2) {
      return 'urgent'; // Nearing - yellow
    }
    return null;
  };

  if (loading) {
    return (
      <Card className="h-full">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4" />
            {language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-xs text-muted-foreground">
            {language === 'nl' ? 'Laden...' : 'Loading...'}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base min-w-0">
          <Calendar className="h-5 w-5 shrink-0" />
          <span className="truncate">{language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}</span>
          {workOrders.length > 0 && (
            <Badge variant="secondary" className="shrink-0">
              {workOrders.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0">
        {workOrders.length === 0 ? (
          <div className="text-sm text-muted-foreground py-6 text-center flex-1 flex items-center justify-center">
            {language === 'nl' 
              ? 'Geen werkorders gepland voor vandaag' 
              : 'No work orders scheduled for today'}
          </div>
        ) : (
          <div className="space-y-2 flex-1">
            {workOrders.slice(0, 4).map((wo) => {
              const productBreakdown = wo.items ? getProductBreakdown(wo.items) : [];
              const breakdownText = formatProductBreakdownText(productBreakdown);
              const urgency = getShippingUrgency(wo.shipping_date);
              
              return (
                <div
                  key={wo.id}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors cursor-pointer",
                    urgency === 'overdue' && "border-destructive/50 bg-destructive/5",
                    urgency === 'urgent' && "border-warning/50 bg-warning/5"
                  )}
                  onClick={() => navigate(`/production/${wo.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{wo.wo_number}</span>
                      <Badge variant={getStatusVariant(wo.status) as any} className="text-xs">
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
                      <Package className="h-3.5 w-3.5" />
                      <span className="truncate">{breakdownText || formatProductType(wo.product_type)}</span>
                      {wo.shipping_date && (
                        <span className={cn(
                          "text-xs ml-auto",
                          urgency === 'overdue' && "text-destructive font-medium",
                          urgency === 'urgent' && "text-warning font-medium"
                        )}>
                          → {format(parseISO(wo.shipping_date), 'dd/MM')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {workOrders.length > 4 && (
              <div className="text-sm text-muted-foreground text-center">
                +{workOrders.length - 4} {language === 'nl' ? 'meer' : 'more'}
              </div>
            )}
          </div>
        )}
        <div className="pt-4 mt-auto border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => navigate('/calendar')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            {language === 'nl' ? 'Bekijk kalender' : 'View calendar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}