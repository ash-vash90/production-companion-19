import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { getProductBreakdown, formatProductBreakdownText, ProductBreakdown } from '@/lib/utils';
import { ExternalLink, Loader2, Plus, Eye } from 'lucide-react';
import { CreateWorkOrderDialog } from '@/components/CreateWorkOrderDialog';

interface WorkOrderWithItems {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
  productBreakdown: ProductBreakdown[];
}

export function ProductionOverview() {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const [workOrders, setWorkOrders] = useState<WorkOrderWithItems[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    fetchWorkOrders();

    // Real-time subscription for work order changes
    const channel = supabase
      .channel('production-overview-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_orders',
        },
        () => {
          fetchWorkOrders();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchWorkOrders = async () => {
    try {
      // Fetch work orders - in_progress only by default, but fetch planned too for "view all"
      const { data: workOrdersData, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, created_by')
        .in('status', ['planned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(10);

      if (woError) throw woError;

      const woIds = workOrdersData?.map(wo => wo.id) || [];
      
      // Fetch items for all work orders to get product breakdown
      let itemsMap: Record<string, Array<{ serial_number: string }>> = {};
      if (woIds.length > 0) {
        const { data: itemsData } = await supabase
          .from('work_order_items')
          .select('work_order_id, serial_number')
          .in('work_order_id', woIds);
        
        for (const item of itemsData || []) {
          if (!itemsMap[item.work_order_id]) {
            itemsMap[item.work_order_id] = [];
          }
          itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
        }
      }

      // Fetch profiles for creators
      const creatorIds = [...new Set(workOrdersData?.map(wo => wo.created_by).filter(Boolean) || [])];
      let profilesMap: Record<string, string> = {};
      
      if (creatorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', creatorIds);
        
        profilesMap = (profilesData || []).reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      // Merge data with product breakdown
      const enrichedData = (workOrdersData || []).map(wo => ({
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] 
          ? { full_name: profilesMap[wo.created_by] } 
          : null,
        productBreakdown: getProductBreakdown(itemsMap[wo.id] || [])
      }));

      setWorkOrders(enrichedData as WorkOrderWithItems[]);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
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

  const getStatusLabel = (status: string) => {
    if (status === 'in_progress') return t('inProgressStatus');
    if (status === 'planned') return t('planned');
    if (status === 'completed') return t('completed');
    if (status === 'on_hold') return t('onHold');
    if (status === 'cancelled') return t('cancelled');
    return status;
  };

  // Filter to show only in_progress unless "View All" is clicked
  const displayedOrders = showAll 
    ? workOrders 
    : workOrders.filter(wo => wo.status === 'in_progress');

  const inProgressCount = workOrders.filter(wo => wo.status === 'in_progress').length;
  const plannedCount = workOrders.filter(wo => wo.status === 'planned').length;

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">{t('activeWorkOrdersTitle')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{t('activeWorkOrdersTitle')}</CardTitle>
            <Badge variant="warning">{inProgressCount}</Badge>
            {plannedCount > 0 && !showAll && (
              <span className="text-sm text-muted-foreground">
                +{plannedCount} {language === 'nl' ? 'gepland' : 'planned'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {(plannedCount > 0 || showAll) && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => setShowAll(!showAll)}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                {showAll ? (language === 'nl' ? 'Actief' : 'Active') : (language === 'nl' ? 'Alles' : 'All')}
              </Button>
            )}
            <Button variant="default" size="sm" onClick={() => setDialogOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              {t('createWorkOrder')}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {displayedOrders.length > 0 ? (
            <div className="space-y-2">
              {displayedOrders.map((wo) => (
                <div
                  key={wo.id}
                  onClick={() => navigate(`/production/${wo.id}`)}
                  className="flex items-center justify-between rounded-lg border bg-card p-3 transition-all cursor-pointer hover:bg-accent/50 hover:border-primary/50"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{wo.wo_number}</span>
                      <Badge variant={getStatusBadgeVariant(wo.status)}>
                        {getStatusLabel(wo.status)}
                      </Badge>
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground truncate">
                      {wo.productBreakdown.length > 0 
                        ? formatProductBreakdownText(wo.productBreakdown)
                        : `${wo.batch_size} items`
                      }
                      {wo.profiles?.full_name && (
                        <span className="ml-2 opacity-70">• {wo.profiles.full_name}</span>
                      )}
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0 ml-3" />
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-sm text-muted-foreground">
              {showAll ? t('noActiveWorkOrders') : (language === 'nl' ? 'Geen actieve werkorders' : 'No work orders in progress')}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateWorkOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={() => {
          fetchWorkOrders();
        }}
      />
    </>
  );
}