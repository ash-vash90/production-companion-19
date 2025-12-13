import { useEffect, useCallback, memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Package, AlertTriangle, Clock, ChevronRight, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatStatus, getProductBreakdown, formatProductBreakdownText } from '@/lib/utils';
import { format, parseISO, differenceInDays, isAfter } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';

interface WorkOrder {
  id: string;
  wo_number: string;
  status: string;
  product_type: string;
  batch_size: number;
  shipping_date: string | null;
  items?: { serial_number: string }[];
}

export const TodaysSchedule = memo(function TodaysSchedule() {
  const { language } = useLanguage();
  const navigate = useNavigate();

  const { data: workOrders, loading, refetch } = useResilientQuery<WorkOrder[]>({
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: woData, error } = await supabase
        .from('work_orders')
        .select('id, wo_number, status, product_type, batch_size, shipping_date')
        .eq('start_date', today)
        .neq('status', 'cancelled')
        .order('wo_number');

      if (error) throw error;
      if (!woData?.length) return [];

      const { data: items } = await supabase
        .from('work_order_items')
        .select('work_order_id, serial_number')
        .in('work_order_id', woData.map(w => w.id));

      return woData.map(wo => ({
        ...wo,
        items: items?.filter(i => i.work_order_id === wo.id) || [],
      }));
    },
    fallbackData: [],
    timeout: 8000,
    retryCount: 2,
  });

  useEffect(() => {
    let timer: NodeJS.Timeout;
    const channel = supabase
      .channel('schedule')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => {
        clearTimeout(timer);
        timer = setTimeout(refetch, 500);
      })
      .subscribe();
    return () => { clearTimeout(timer); supabase.removeChannel(channel); };
  }, [refetch]);

  const getUrgency = (date: string | null) => {
    if (!date) return null;
    const days = differenceInDays(parseISO(date), new Date());
    if (isAfter(new Date(), parseISO(date))) return 'overdue';
    if (days <= 2) return 'soon';
    return null;
  };

  const list = workOrders || [];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          {language === 'nl' ? 'Vandaag' : "Today's Schedule"}
        </h2>
        {list.length > 0 && (
          <span className="text-xs text-muted-foreground">{list.length} orders</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-12" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          {language === 'nl' ? 'Geen orders vandaag' : 'No orders scheduled for today'}
        </p>
      ) : (
        <div className="space-y-1">
          {list.slice(0, 6).map((wo) => {
            const urgency = getUrgency(wo.shipping_date);
            const breakdown = formatProductBreakdownText(getProductBreakdown(wo.items || []));
            
            return (
              <button
                key={wo.id}
                onClick={() => navigate(`/production/${wo.id}`)}
                className={cn(
                  "w-full flex items-center gap-3 py-2 px-2 -mx-2 rounded-md text-left transition-colors",
                  "hover:bg-muted/50 group",
                  urgency === 'overdue' && "text-destructive",
                  urgency === 'soon' && "text-warning"
                )}
              >
                <span className="font-mono text-sm font-medium">{wo.wo_number}</span>
                <Badge variant={wo.status === 'in_progress' ? 'warning' : 'secondary'} className="text-[10px]">
                  {formatStatus(wo.status)}
                </Badge>
                {urgency === 'overdue' && <AlertTriangle className="h-3 w-3" />}
                {urgency === 'soon' && <Clock className="h-3 w-3" />}
                <span className="text-xs text-muted-foreground truncate ml-auto hidden sm:block">
                  {breakdown || `${wo.batch_size} items`}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}

      {list.length > 6 && (
        <p className="text-xs text-muted-foreground mt-2">+{list.length - 6} more</p>
      )}

      <Button
        variant="link"
        size="sm"
        className="px-0 mt-3 text-muted-foreground hover:text-foreground"
        onClick={() => navigate('/calendar')}
      >
        View full calendar →
      </Button>
    </div>
  );
});
