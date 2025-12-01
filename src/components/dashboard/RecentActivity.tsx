import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export function RecentActivity() {
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
      create_work_order: 'Work Order Created',
      complete_step: 'Step Completed',
      record_measurement: 'Measurement Recorded',
      scan_batch: 'Batch Scanned',
      print_label: 'Label Printed',
    };
    return labels[action] || action.replace(/_/g, ' ');
  };

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      create_work_order: 'bg-primary text-primary-foreground',
      complete_step: 'bg-accent text-accent-foreground',
      record_measurement: 'bg-secondary text-secondary-foreground',
      scan_batch: 'bg-muted text-muted-foreground',
    };
    return colors[action] || 'bg-muted text-muted-foreground';
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest production events</CardDescription>
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
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest production events</CardDescription>
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
                    <Badge className={`${getActionColor(activity.action)} text-xs`}>
                      {getActionLabel(activity.action)}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No recent activity
          </div>
        )}
      </CardContent>
    </Card>
  );
}
