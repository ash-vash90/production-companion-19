/**
 * Activity Section Component
 *
 * Displays the activity log / audit trail for a production.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Activity,
  Play,
  CheckCircle,
  Package,
  Printer,
  Award,
  Edit,
  Clock,
  User,
  AlertCircle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { ActivityLogEntry } from '@/types/reports';

interface ActivitySectionProps {
  activities: ActivityLogEntry[];
  compact?: boolean;
  limit?: number;
}

function getActionIcon(action: string) {
  const actionLower = action.toLowerCase();
  if (actionLower.includes('start')) return <Play className="h-3.5 w-3.5 text-info" />;
  if (actionLower.includes('complete')) return <CheckCircle className="h-3.5 w-3.5 text-success" />;
  if (actionLower.includes('material') || actionLower.includes('scan'))
    return <Package className="h-3.5 w-3.5 text-warning" />;
  if (actionLower.includes('print') || actionLower.includes('label'))
    return <Printer className="h-3.5 w-3.5 text-primary" />;
  if (actionLower.includes('certif')) return <Award className="h-3.5 w-3.5 text-success" />;
  if (actionLower.includes('update') || actionLower.includes('edit'))
    return <Edit className="h-3.5 w-3.5 text-muted-foreground" />;
  if (actionLower.includes('error') || actionLower.includes('fail'))
    return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  return <Activity className="h-3.5 w-3.5 text-muted-foreground" />;
}

function formatAction(action: string, language: string): string {
  // Convert snake_case to readable text
  const readable = action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase());

  // Add translations for common actions
  const translations: Record<string, Record<string, string>> = {
    work_order_created: { en: 'Work order created', nl: 'Werkorder aangemaakt' },
    work_order_started: { en: 'Production started', nl: 'Productie gestart' },
    work_order_completed: { en: 'Production completed', nl: 'Productie voltooid' },
    step_completed: { en: 'Step completed', nl: 'Stap voltooid' },
    material_scanned: { en: 'Material scanned', nl: 'Materiaal gescand' },
    label_printed: { en: 'Label printed', nl: 'Label geprint' },
    certificate_generated: { en: 'Certificate generated', nl: 'Certificaat gegenereerd' },
  };

  const key = action.toLowerCase();
  if (translations[key]) {
    return translations[key][language] || translations[key].en;
  }

  return readable;
}

export function ActivitySection({ activities, compact = false, limit }: ActivitySectionProps) {
  const { language } = useLanguage();

  const displayActivities = useMemo(() => {
    const sorted = [...activities].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return limit ? sorted.slice(0, limit) : sorted;
  }, [activities, limit]);

  if (activities.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {language === 'nl' ? 'Activiteit' : 'Activity'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground italic">
            {language === 'nl' ? 'Geen activiteit geregistreerd' : 'No activity recorded'}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {language === 'nl' ? 'Activiteit' : 'Activity'}
            <Badge variant="secondary" className="ml-auto">
              {activities.length}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">
            {language === 'nl' ? 'Laatste activiteit' : 'Last activity'}:{' '}
            {displayActivities[0] && format(parseISO(displayActivities[0].created_at), 'dd MMM, HH:mm')}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" />
            {language === 'nl' ? 'Activiteitenlog' : 'Activity Log'}
          </CardTitle>
          <Badge variant="secondary">
            {activities.length} {language === 'nl' ? 'acties' : 'actions'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

          <div className="space-y-3">
            {displayActivities.map((activity, idx) => (
              <div key={activity.id} className="relative flex gap-3 pl-1">
                {/* Timeline dot */}
                <div className="relative z-10 flex items-center justify-center w-5 h-5 rounded-full bg-background border">
                  {getActionIcon(activity.action)}
                </div>

                <div className="flex-1 min-w-0 pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium">
                      {formatAction(activity.action, language)}
                    </p>
                    <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(activity.created_at), 'HH:mm')}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {activity.user_name && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {activity.user_name}
                      </span>
                    )}
                    <span>{format(parseISO(activity.created_at), 'dd MMM yyyy')}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {limit && activities.length > limit && (
            <div className="mt-2 pt-2 border-t text-center text-xs text-muted-foreground">
              +{activities.length - limit} {language === 'nl' ? 'meer acties' : 'more actions'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default ActivitySection;
