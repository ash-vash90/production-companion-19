import React, { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
        .limit(10);

      if (error) throw error;
      
      // Get unique user IDs
      const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))];
      
      // Fetch user profiles
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

      // Enrich activities with user names
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
      create_work_order: 'bg-primary text-primary-foreground',
      complete_step: 'bg-success text-success-foreground',
      record_measurement: 'bg-info text-info-foreground',
      scan_batch: 'bg-warning text-warning-foreground',
      print_label: 'bg-secondary text-secondary-foreground',
    };
    return colors[action] || 'bg-secondary text-secondary-foreground';
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

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('recentActivityTitle')}</CardTitle>
          <CardDescription className="text-sm">{t('latestProductionEvents')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-3 rounded-lg border bg-card p-2.5">
                <Skeleton className="h-4 w-4 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && (!activities || activities.length === 0)) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">{t('recentActivityTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center justify-center py-6 gap-3">
          <AlertCircle className="h-6 w-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Failed to load activity</p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const displayActivities = activities || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{t('recentActivityTitle')}</CardTitle>
            <CardDescription className="text-sm">{t('latestProductionEvents')}</CardDescription>
          </div>
          {isStale && (
            <Button variant="ghost" size="sm" className="h-7" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Refresh
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {displayActivities.length > 0 ? (
          <div className="space-y-2">
            {displayActivities.map((activity) => {
              const detailsText = formatActivityDetails(activity);
              
              return (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 rounded-lg border bg-card p-2.5 hover:bg-muted/30 transition-colors"
                >
                  <Activity className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${getActionColor(activity.action)} text-xs h-5 px-2`}>
                        {getActionLabel(activity.action)}
                      </Badge>
                      {detailsText && (
                        <span className="text-xs font-mono font-medium text-foreground">
                          {detailsText}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
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
          <div className="py-6 text-center text-sm text-muted-foreground">
            {t('noRecentActivity')}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
