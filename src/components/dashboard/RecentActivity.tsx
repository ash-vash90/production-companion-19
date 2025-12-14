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
import { Card } from '@/components/ui/card';
import { CardSectionHeader } from '@/components/CardSectionHeader';

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

  const { data: activities, loading, error, refetch, isStale } =
    useResilientQuery<ActivityLog[]>({
      queryFn: async () => {
        const { data, error } = await supabase
          .from('activity_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(8);

        if (error) throw error;

        const userIds = [...new Set((data || []).map((a) => a.user_id).filter(Boolean))];

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

        return (data || []).map((activity) => ({
          id: activity.id,
          action: activity.action,
          entity_type: activity.entity_type,
          entity_id: activity.entity_id,
          details: activity.details as Record<string, unknown> | null,
          user_id: activity.user_id,
          created_at: activity.created_at,
          user_name: activity.user_id ? profilesMap[activity.user_id] : undefined,
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
      return `${t('step')} ${details.step_number} • ${details.serial_number}`;
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
        <CardSectionHeader
          icon={<Activity className="h-5 w-5 text-muted-foreground" />}
          title={t('recentActivityTitle')}
        />
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-card">
              <div className="flex items-start gap-3 p-3 sm:p-4">
                <Skeleton className="h-5 w-20 rounded-full" />
                <div className="space-y-1.5 flex-1">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      </section>
    );
  }

  if (error && displayActivities.length === 0) {
    return (
      <section>
        <CardSectionHeader
          icon={<Activity className="h-5 w-5 text-muted-foreground" />}
          title={t('recentActivityTitle')}
        />
        <div className="flex items-center justify-center py-8 gap-3 text-muted-foreground">
          <AlertCircle className="h-5 w-5" />
          <span className="text-sm">{t('failedLoadActivity')}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section>
      <CardSectionHeader
        icon={<Activity className="h-5 w-5 text-muted-foreground" />}
        title={t('recentActivityTitle')}
        actions={
          isStale ? (
            <Button variant="outline" size="sm" className="h-7" onClick={() => refetch()}>
              <RefreshCw className="h-3 w-3 mr-1" />
              {t('refresh')}
            </Button>
          ) : undefined
        }
      />

      {displayActivities.length > 0 ? (
        <div className="space-y-3">
          {displayActivities.map((activity) => {
            const detailsText = formatActivityDetails(activity);

            return (
              <Card key={activity.id} className="shadow-card">
                <div className="flex items-center gap-3 p-3 sm:p-4">
                  <Badge
                    className={`${getActionColor(activity.action)} text-[10px] shrink-0 whitespace-nowrap`}
                  >
                    {getActionLabel(activity.action)}
                  </Badge>
                  <div className="flex-1 min-w-0">
                    {detailsText && (
                      <p className="text-sm font-medium truncate">{detailsText}</p>
                    )}
                    {activity.user_name && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <User className="h-3 w-3 shrink-0" />
                        <span className="truncate">{activity.user_name}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                    {formatDistanceToNow(new Date(activity.created_at), {
                      addSuffix: true,
                      locale: language === 'nl' ? nl : enUS,
                    })}
                  </span>
                </div>
              </Card>
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
