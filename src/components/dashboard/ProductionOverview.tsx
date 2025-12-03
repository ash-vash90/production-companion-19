import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatProductType } from '@/lib/utils';
import { ExternalLink, Loader2 } from 'lucide-react';

interface WorkOrderWithProfile {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  profiles: { full_name: string } | null;
}

export function ProductionOverview() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [workOrders, setWorkOrders] = useState<WorkOrderWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWorkOrders();
  }, []);

  const fetchWorkOrders = async () => {
    try {
      // Fetch work orders
      const { data: workOrdersData, error: woError } = await supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, created_by')
        .in('status', ['planned', 'in_progress'])
        .order('created_at', { ascending: false })
        .limit(5);

      if (woError) throw woError;

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

      // Merge data
      const enrichedData = (workOrdersData || []).map(wo => ({
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] 
          ? { full_name: profilesMap[wo.created_by] } 
          : null
      }));

      setWorkOrders(enrichedData as any);
    } catch (error) {
      console.error('Error fetching work orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    if (status === 'in_progress') return 'warning';
    if (status === 'planned') return 'info';
    if (status === 'completed') return 'success';
    if (status === 'cancelled') return 'destructive';
    return 'secondary';
  };

  const getStatusLabel = (status: string) => {
    if (status === 'in_progress') return t('inProgressStatus');
    if (status === 'planned') return t('planned');
    if (status === 'completed') return t('completed');
    if (status === 'on_hold') return t('onHold');
    if (status === 'cancelled') return t('cancelled');
    return status;
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('activeWorkOrdersTitle')}</CardTitle>
          <CardDescription>{t('currentProductionQueue')}</CardDescription>
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
    <Card>
      <CardHeader>
        <CardTitle>{t('activeWorkOrdersTitle')}</CardTitle>
        <CardDescription>{t('currentProductionQueue')}</CardDescription>
      </CardHeader>
      <CardContent>
        {workOrders.length > 0 ? (
          <div className="space-y-3">
            {workOrders.map((wo) => (
              <div
                key={wo.id}
                onClick={() => navigate(`/production/${wo.id}`)}
                className="flex items-center justify-between rounded-lg border-2 bg-card p-3 transition-all cursor-pointer hover:bg-accent/50 hover:border-primary"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold">{wo.wo_number}</span>
                    <Badge variant={getStatusBadgeVariant(wo.status)}>
                      {getStatusLabel(wo.status)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatProductType(wo.product_type)} • {t('batch')}: {wo.batch_size}
                  </div>
                  {wo.profiles?.full_name && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {t('createdBy')}: {wo.profiles.full_name}
                    </div>
                  )}
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('noActiveWorkOrders')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
