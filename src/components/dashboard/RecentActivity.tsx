import React, { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Activity, User, AlertCircle, RefreshCw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityDetails {
  step_number?: number;
  serial_number?: string;
  wo_number?: string;
  product_type?: string;
}

interface ActivityLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
  user_name?: string;
}

export const RecentActivity = memo(function RecentActivity() {
  const { t, language } = useLanguage();

  const { data: activities, loading, error, refetch, isStale } = useResilientQuery<ActivityLog[]>({
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(8);

      if (error) throw error;
      
      const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))];
      
      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name;
          return acc;
        }, {} as Record<string, string>);
      }

      return (data || []).map(activity => ({
        id: activity.id,
        action: activity.action,
        entity_type: activity.entity_type,
        entity_id: activity.entity_id,
        details: activity.details as Record<string, unknown> | null,
        user_id: activity.user_id,
        created_at: activity.created_at,
        user_name: activity.user_id ? profilesMap[activity.user_id] : undefined
      }));
    },
    fallbackData: [],
    timeout: 10000,
    retryCount: 3,
  });

  const getActionLabel = (action: string) => {
    const labels: Record<string, string> = {
      create_work_order: t('workOrderCreatedAction'),
      complete_step: t('stepCompletedAction'),
      record_measurement: t('measurementRecordedAction'),
      scan_batch: t('batchScannedAction'),
      print_label: t('labelPrintedAction'),
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create_work_order: 'bg-primary/10 text-primary',
      complete_step: 'bg-success/10 text-success',
      record_measurement: 'bg-info/10 text-info',
      scan_batch: 'bg-warning/10 text-warning',
      print_label: 'bg-secondary text-secondary-foreground',
    };
    return colors[action] || 'bg-muted text-muted-foreground';
  };

  const formatActivityDetails = (activity: ActivityLog): string | null => {
    const details = activity.details as ActivityDetails | null;
    if (!details || typeof details !== 'object') return null;

    if (activity.action === 'complete_step' && details.step_number && details.serial_number) {
      return `Step ${details.step_number} • ${details.serial_number}`;
    }
    
    if (activity.action === 'create_work_order' && details.wo_number) {
      return details.wo_number;
    }

    if (activity.action === 'print_label' && details.serial_number) {
      return details.serial_number;
    }

    if (details.serial_number) {
      return details.serial_number;
    }

    return null;
  };

  const displayActivities = activities || [];

  if (loading) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t('recentActivityTitle')}</h2>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 py-2">
              <Skeleton className="h-5 w-20 rounded-full" />
              <div className="space-y-1.5 flex-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (error && displayActivities.length === 0) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t('recentActivityTitle')}</h2>
        </div>
        <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">Failed to load activity</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-muted-foreground" />
          <h2 className="font-semibold">{t('recentActivityTitle')}</h2>
        </div>
        {isStale && (
          <Button variant="ghost" size="sm" className="h-7" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
        )}
      </div>

      {displayActivities.length > 0 ? (
        <div className="space-y-1">
          {displayActivities.map((activity) => {
            const detailsText = formatActivityDetails(activity);
            
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 py-2.5 px-2 -mx-2 rounded-lg hover:bg-muted/30 transition-colors"
              >
                <Badge className={`${getActionColor(activity.action)} text-[10px] shrink-0 mt-0.5`}>
                  {getActionLabel(activity.action)}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {detailsText && (
                      <span className="text-sm font-mono font-medium">
                        {detailsText}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    {activity.user_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {activity.user_name}
                      </span>
                    )}
                    <span>
                      {formatDistanceToNow(new Date(activity.created_at), { 
                        addSuffix: true,
                        locale: language === 'nl' ? nl : enUS
                      })}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="py-12 text-center text-sm text-muted-foreground">
          {t('noRecentActivity')}
        </div>
      )}
    </section>
  );
});
