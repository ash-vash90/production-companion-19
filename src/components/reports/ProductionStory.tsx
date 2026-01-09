/**
 * Production Story Component
 *
 * Tells the story of a production in chronological order,
 * combining all entities into a cohesive narrative.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  Play,
  CheckCircle,
  Package,
  Printer,
  Award,
  Flag,
  Clock,
  Users,
  Truck,
  AlertTriangle,
  BarChart3,
} from 'lucide-react';
import { format, parseISO, differenceInDays, differenceInHours } from 'date-fns';
import type { ProductionReportData, TimelineEvent, ProductionStats } from '@/types/reports';
import { calculateStats } from '@/types/reports';
import { buildTimelineEvents } from '@/services/reportDataService';
import { cn } from '@/lib/utils';

interface ProductionStoryProps {
  data: ProductionReportData;
  showStats?: boolean;
  showTeam?: boolean;
  maxEvents?: number;
}

function getEventIcon(type: TimelineEvent['type']) {
  switch (type) {
    case 'created':
      return <Play className="h-4 w-4" />;
    case 'started':
      return <Play className="h-4 w-4 text-info" />;
    case 'step_completed':
      return <CheckCircle className="h-4 w-4 text-success" />;
    case 'material_scanned':
      return <Package className="h-4 w-4 text-warning" />;
    case 'certificate_generated':
      return <Award className="h-4 w-4 text-success" />;
    case 'label_printed':
      return <Printer className="h-4 w-4 text-primary" />;
    case 'completed':
      return <Flag className="h-4 w-4 text-success" />;
    case 'shipped':
      return <Truck className="h-4 w-4 text-info" />;
    default:
      return <Clock className="h-4 w-4" />;
  }
}

function getEventColor(type: TimelineEvent['type']) {
  switch (type) {
    case 'started':
      return 'border-info bg-info/10';
    case 'step_completed':
      return 'border-success bg-success/10';
    case 'material_scanned':
      return 'border-warning bg-warning/10';
    case 'certificate_generated':
      return 'border-success bg-success/10';
    case 'label_printed':
      return 'border-primary bg-primary/10';
    case 'completed':
      return 'border-success bg-success/10';
    case 'shipped':
      return 'border-info bg-info/10';
    default:
      return 'border-muted bg-muted/30';
  }
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function ProductionStory({
  data,
  showStats = true,
  showTeam = true,
  maxEvents,
}: ProductionStoryProps) {
  const { language } = useLanguage();

  const events = useMemo(() => buildTimelineEvents(data), [data]);
  const stats = useMemo(() => calculateStats(data), [data]);

  const displayEvents = maxEvents ? events.slice(0, maxEvents) : events;
  const hasMore = maxEvents && events.length > maxEvents;

  // Calculate production duration
  const duration = useMemo(() => {
    if (!data.workOrder.start_date || !data.workOrder.completed_at) return null;
    const start = parseISO(data.workOrder.start_date);
    const end = parseISO(data.workOrder.completed_at);
    const days = differenceInDays(end, start);
    const hours = differenceInHours(end, start) % 24;
    if (days > 0) {
      return `${days}d ${hours}h`;
    }
    return `${hours}h`;
  }, [data.workOrder]);

  return (
    <div className="space-y-6">
      {/* Story Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg">{data.workOrder.wo_number}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {data.workOrder.product_type.replace(/_/g, ' ')} • {data.workOrder.batch_size}{' '}
                {language === 'nl' ? 'stuks' : 'units'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge
                variant={data.workOrder.status === 'completed' ? 'default' : 'secondary'}
                className={cn(
                  data.workOrder.status === 'completed' && 'bg-success text-success-foreground'
                )}
              >
                {data.workOrder.status === 'completed'
                  ? language === 'nl'
                    ? 'Voltooid'
                    : 'Completed'
                  : data.workOrder.status}
              </Badge>
              {duration && (
                <Badge variant="outline" className="gap-1">
                  <Clock className="h-3 w-3" />
                  {duration}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        {(showStats || showTeam) && (
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-4">
              {showStats && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4 text-success" />
                    <span>
                      {stats.completedItems}/{stats.totalItems}
                    </span>
                  </div>
                  {stats.passedValidations > 0 && (
                    <div className="flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4 text-info" />
                      <span>{stats.passedValidations} {language === 'nl' ? 'validaties' : 'validations'}</span>
                    </div>
                  )}
                  {stats.certificatesIssued > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Award className="h-4 w-4 text-success" />
                      <span>{stats.certificatesIssued} {language === 'nl' ? 'certificaten' : 'certificates'}</span>
                    </div>
                  )}
                </div>
              )}
              {showTeam && data.operators.length > 0 && (
                <div className="flex items-center gap-2 ml-auto">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex -space-x-2">
                    {data.operators.slice(0, 4).map(op => (
                      <Avatar key={op.id} className="h-6 w-6 border-2 border-background">
                        <AvatarImage src={op.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(op.full_name)}
                        </AvatarFallback>
                      </Avatar>
                    ))}
                    {data.operators.length > 4 && (
                      <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium">
                        +{data.operators.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {language === 'nl' ? 'Productie Verhaal' : 'Production Story'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-4 top-2 bottom-2 w-px bg-border" />

            <div className="space-y-4">
              {displayEvents.map((event, idx) => (
                <div key={event.id} className="relative flex gap-4 pl-2">
                  {/* Event marker */}
                  <div
                    className={cn(
                      'relative z-10 flex items-center justify-center w-8 h-8 rounded-full border-2',
                      getEventColor(event.type)
                    )}
                  >
                    {getEventIcon(event.type)}
                  </div>

                  {/* Event content */}
                  <div className="flex-1 min-w-0 pb-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">{event.title}</p>
                        {event.description && (
                          <p className="text-sm text-muted-foreground">{event.description}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(parseISO(event.timestamp), 'HH:mm')}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {event.actor && (
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-4 w-4">
                            <AvatarImage src={event.actorAvatar || undefined} />
                            <AvatarFallback className="text-[8px]">
                              {getInitials(event.actor)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{event.actor}</span>
                        </div>
                      )}
                      {event.serialNumber && (
                        <Badge variant="outline" className="text-xs h-5">
                          {event.serialNumber}
                        </Badge>
                      )}
                      {event.metadata?.validation_status && (
                        <Badge
                          variant={
                            event.metadata.validation_status === 'passed' ? 'default' : 'destructive'
                          }
                          className={cn(
                            'text-xs h-5',
                            event.metadata.validation_status === 'passed' &&
                              'bg-success text-success-foreground'
                          )}
                        >
                          {event.metadata.validation_status === 'passed' ? (
                            <CheckCircle className="h-3 w-3 mr-1" />
                          ) : (
                            <AlertTriangle className="h-3 w-3 mr-1" />
                          )}
                          {String(event.metadata.validation_status)}
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(event.timestamp), 'dd MMM yyyy')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMore && (
              <div className="mt-2 pt-2 border-t text-center text-xs text-muted-foreground">
                +{events.length - maxEvents!} {language === 'nl' ? 'meer gebeurtenissen' : 'more events'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default ProductionStory;
