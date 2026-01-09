import { useEffect, useCallback, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Package, AlertTriangle, Clock, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatProductType, formatStatus, getProductBreakdown, formatProductBreakdownText } from '@/lib/utils';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';

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
  const { language } = useLanguage();
  const navigate = useNavigate();

  const { data: workOrders, loading, error, refetch, isStale } = useResilientQuery<WorkOrder[]>({
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      
      const { data: woData, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, status, product_type, batch_size, start_date, shipping_date')
        .eq('start_date', today)
        .neq('status', 'cancelled')
        .order('wo_number', { ascending: true });

      if (woError) throw woError;

      if (!woData || woData.length === 0) {
        return [];
      }

      const woIds = woData.map(wo => wo.id);
      const { data: itemsData } = await supabase
        .from('work_order_items')
        .select('id, serial_number, work_order_id')
        .in('work_order_id', woIds);

      return woData.map(wo => ({
        ...wo,
        items: itemsData?.filter(item => item.work_order_id === wo.id) || [],
      }));
    },
    fallbackData: [],
    timeout: 10000,
    retryCount: 3,
  });

  useEffect(() => {
    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel('todays-schedule-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders' },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            refetch();
          }, 500);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [refetch]);

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

  const displayWorkOrders = workOrders || [];

  if (loading) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-sm">{language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-5 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4 py-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-16" />
              <Skeleton className="h-3 w-32 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && displayWorkOrders.length === 0) {
    return (
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <h2 className="font-semibold text-sm">{language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}</h2>
          </div>
        </div>
        <div className="p-4 sm:p-5">
          <div className="flex items-center justify-center py-6 gap-3 text-muted-foreground">
            <AlertCircle className="h-5 w-5" />
            <span className="text-sm">Failed to load</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Section Header */}
      <div className="p-4 sm:p-5 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold text-sm">{language === 'nl' ? 'Planning Vandaag' : "Today's Schedule"}</h2>
            </div>
          </div>
          {isStale && (
            <Button variant="ghost" size="sm" className="h-7" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 sm:p-5">
        {displayWorkOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="p-3 rounded-full bg-muted/50 mb-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">
              {language === 'nl'
                ? 'Geen werkorders gepland voor vandaag'
                : 'No work orders scheduled for today'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayWorkOrders.slice(0, 5).map((wo) => {
              const productBreakdown = wo.items ? getProductBreakdown(wo.items) : [];
              const breakdownText = formatProductBreakdownText(productBreakdown);
              const urgency = getShippingUrgency(wo.shipping_date);

              return (
                <div
                  key={wo.id}
                  className={cn(
                    "group flex items-center gap-3 p-3 cursor-pointer transition-all rounded-lg border",
                    "hover:border-primary/30 hover:shadow-sm",
                    urgency === 'overdue' && "border-destructive/30 bg-destructive/5",
                    urgency === 'urgent' && "border-warning/30 bg-warning/5",
                    !urgency && "border-border bg-background"
                  )}
                  onClick={() => navigate(`/production/${wo.id}`)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{wo.wo_number}</span>
                      <Badge variant={getStatusVariant(wo.status) as any} className="text-[10px]">
                        {formatStatus(wo.status)}
                      </Badge>
                      {urgency === 'overdue' && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                      {urgency === 'urgent' && <Clock className="h-3.5 w-3.5 text-warning" />}
                    </div>
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                      <Package className="h-3 w-3" />
                      <span className="truncate">{breakdownText || formatProductType(wo.product_type)}</span>
                    </div>
                  </div>
                  {wo.shipping_date && (
                    <span className={cn(
                      "text-xs font-mono shrink-0",
                      urgency === 'overdue' && "text-destructive font-medium",
                      urgency === 'urgent' && "text-warning font-medium",
                      !urgency && "text-muted-foreground"
                    )}>
                      → {format(parseISO(wo.shipping_date), 'dd/MM')}
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
                </div>
              );
            })}
          </div>
        )}

        {displayWorkOrders.length > 5 && (
          <p className="text-xs text-muted-foreground text-center mt-3">
            +{displayWorkOrders.length - 5} {language === 'nl' ? 'meer' : 'more'}
          </p>
        )}

        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-4 text-muted-foreground hover:text-foreground justify-between"
          onClick={() => navigate('/calendar')}
        >
          <span className="flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {language === 'nl' ? 'Bekijk kalender' : 'View calendar'}
          </span>
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});
