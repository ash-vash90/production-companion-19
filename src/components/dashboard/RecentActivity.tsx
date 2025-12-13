import React, { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Activity } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { useResilientQuery } from '@/hooks/useResilientQuery';
import { Skeleton } from '@/components/ui/skeleton';

interface ActivityLog {
  id: string;
  action: string;
  details: Record<string, any> | null;
  created_at: string;
  user_name?: string;
}

export const RecentActivity = memo(function RecentActivity() {
  const { t, language } = useLanguage();

  const { data: activities, loading } = useResilientQuery<ActivityLog[]>({
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activity_logs')
        .select('id, action, details, created_at, user_id')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) throw error;

      const userIds = [...new Set((data || []).map(a => a.user_id).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      
      if (userIds.length) {
        const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
        (profiles || []).forEach(p => { profilesMap[p.id] = p.full_name; });
      }

      return (data || []).map(a => ({
        id: a.id,
        action: a.action,
        details: a.details as Record<string, any> | null,
        created_at: a.created_at,
        user_name: a.user_id ? profilesMap[a.user_id] : undefined,
      }));
    },
    fallbackData: [],
    timeout: 8000,
    retryCount: 2,
  });

  const actionLabel = (action: string) => {
    const map: Record<string, string> = {
      create_work_order: 'Created WO',
      complete_step: 'Step done',
      record_measurement: 'Measured',
      scan_batch: 'Scanned',
      print_label: 'Printed',
    };
    return map[action] || action.replace(/_/g, ' ');
  };

  const actionColor = (action: string) => {
    if (action === 'complete_step') return 'bg-success/10 text-success';
    if (action === 'create_work_order') return 'bg-primary/10 text-primary';
    if (action === 'scan_batch') return 'bg-warning/10 text-warning';
    return 'bg-muted text-muted-foreground';
  };

  const detail = (a: ActivityLog) => {
    const d = a.details;
    if (!d) return null;
    if (a.action === 'complete_step' && d.step_number) return `Step ${d.step_number}`;
    if (d.wo_number) return d.wo_number;
    if (d.serial_number) return d.serial_number;
    return null;
  };

  const list = activities || [];

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-2">
          <Activity className="h-4 w-4" />
          {t('recentActivityTitle')}
        </h2>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 py-1.5">
              <Skeleton className="h-5 w-16 rounded-full" />
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 w-16 ml-auto" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{t('noRecentActivity')}</p>
      ) : (
        <div className="space-y-1">
          {list.map((a) => (
            <div key={a.id} className="flex items-center gap-3 py-1.5">
              <Badge className={`${actionColor(a.action)} text-[10px] shrink-0`}>
                {actionLabel(a.action)}
              </Badge>
              {detail(a) && (
                <span className="text-sm font-mono">{detail(a)}</span>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {a.user_name && <span className="hidden sm:inline">{a.user_name} · </span>}
                {formatDistanceToNow(new Date(a.created_at), {
                  addSuffix: true,
                  locale: language === 'nl' ? nl : enUS,
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});
