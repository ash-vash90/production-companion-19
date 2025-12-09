import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Loader2, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

export function RecentActivity() {
  const { t, language } = useLanguage();
  const [activities, setActivities] = useState<any[]>([]);
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
      setActivities(data || []);
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

  const getActionVariant = (action: string): 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline' => {
    const variants: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'info' | 'destructive' | 'outline'> = {
      create_work_order: 'default',
      complete_step: 'success',
      record_measurement: 'info',
      scan_batch: 'secondary',
    };
    return variants[action] || 'secondary';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('recentActivityTitle')}</CardTitle>
          <CardDescription>{t('latestProductionEvents')}</CardDescription>
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
        <CardTitle>{t('recentActivityTitle')}</CardTitle>
        <CardDescription>{t('latestProductionEvents')}</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length > 0 ? (
          <div className="space-y-3">
            {activities.map((activity) => (
              <div
                key={activity.id}
                className="flex items-start gap-3 rounded-lg border-2 bg-card p-3"
              >
                <Activity className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant={getActionVariant(activity.action)} className="text-xs">
                      {getActionLabel(activity.action)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.created_at), { 
                      addSuffix: true,
                      locale: language === 'nl' ? nl : enUS
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t('noRecentActivity')}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
