import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Activity, User, Package } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

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

export function RecentActivity() {
  const { t, language } = useLanguage();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, []);

  const fetchActivities = async () => {
    try {
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
      const enrichedActivities: ActivityLog[] = (data || []).map(activity => ({
        id: activity.id,
        action: activity.action,
        entity_type: activity.entity_type,
        entity_id: activity.entity_id,
        details: activity.details as Record<string, unknown> | null,
        user_id: activity.user_id,
        created_at: activity.created_at,
        user_name: activity.user_id ? profilesMap[activity.user_id] : undefined
      }));

      setActivities(enrichedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  };

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
    return variants[action] || 'secondary';
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
          <div className="flex justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{t('recentActivityTitle')}</CardTitle>
        <CardDescription className="text-sm">{t('latestProductionEvents')}</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-2">
            {activities.map((activity) => {
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
}
