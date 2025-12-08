import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Package } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatProductType, formatStatus, getProductBreakdown, formatProductBreakdownText } from '@/lib/utils';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

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
  scheduled_date: string | null;
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
      .select('id, wo_number, status, product_type, batch_size, scheduled_date')
      .eq('scheduled_date', today)
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
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm min-w-0">
          <Calendar className="h-4 w-4 shrink-0" />
          <span className="truncate">{language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}</span>
          {workOrders.length > 0 && (
            <Badge variant="secondary" className="shrink-0 text-[10px]">
              {workOrders.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col pt-0">
        {workOrders.length === 0 ? (
          <div className="text-xs text-muted-foreground py-4 text-center flex-1 flex items-center justify-center">
            {language === 'nl' 
              ? 'Geen werkorders gepland voor vandaag' 
              : 'No work orders scheduled for today'}
          </div>
        ) : (
          <div className="space-y-2 flex-1">
            {workOrders.slice(0, 4).map((wo) => {
              const productBreakdown = wo.items ? getProductBreakdown(wo.items) : [];
              const breakdownText = formatProductBreakdownText(productBreakdown);
              
              return (
                <div
                  key={wo.id}
                  className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => navigate(`/production/${wo.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-xs">{wo.wo_number}</span>
                      <Badge variant={getStatusVariant(wo.status) as any} className="text-[9px] h-4 px-1">
                        {formatStatus(wo.status)}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 mt-0.5 text-[10px] text-muted-foreground">
                      <Package className="h-2.5 w-2.5" />
                      <span className="truncate">{breakdownText || formatProductType(wo.product_type)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
            {workOrders.length > 4 && (
              <div className="text-[10px] text-muted-foreground text-center">
                +{workOrders.length - 4} {language === 'nl' ? 'meer' : 'more'}
              </div>
            )}
          </div>
        )}
        <div className="pt-3 mt-auto border-t">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-7 text-[10px]"
            onClick={() => navigate('/calendar')}
          >
            <Calendar className="h-3 w-3 mr-1.5" />
            {language === 'nl' ? 'Bekijk kalender' : 'View calendar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}