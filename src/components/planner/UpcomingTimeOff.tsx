import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format, addDays, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { nl } from 'date-fns/locale';
import { CalendarOff, Palmtree, Stethoscope, GraduationCap, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TimeOffEntry {
  id: string;
  user_id: string;
  date: string;
  reason_type: string;
  reason: string | null;
  available_hours: number;
  profile: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface UpcomingTimeOffProps {
  daysAhead?: number;
  compact?: boolean;
}

const reasonTypeConfig: Record<string, { icon: React.ElementType; color: string; labelEn: string; labelNl: string }> = {
  holiday: { icon: Palmtree, color: 'text-emerald-500', labelEn: 'Holiday', labelNl: 'Vakantie' },
  sick: { icon: Stethoscope, color: 'text-red-500', labelEn: 'Sick', labelNl: 'Ziek' },
  training: { icon: GraduationCap, color: 'text-blue-500', labelEn: 'Training', labelNl: 'Training' },
  other: { icon: Clock, color: 'text-muted-foreground', labelEn: 'Other', labelNl: 'Anders' },
};

const UpcomingTimeOff: React.FC<UpcomingTimeOffProps> = ({ daysAhead = 14, compact = false }) => {
  const { language } = useLanguage();
  const [timeOff, setTimeOff] = useState<TimeOffEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTimeOff = async () => {
      setLoading(true);
      try {
        const today = startOfDay(new Date());
        const endDate = endOfDay(addDays(today, daysAhead));

        const { data, error } = await supabase
          .from('operator_availability')
          .select(`
            id,
            user_id,
            date,
            reason_type,
            reason,
            available_hours,
            profile:profiles!operator_availability_user_id_fkey(full_name, avatar_url)
          `)
          .gte('date', format(today, 'yyyy-MM-dd'))
          .lte('date', format(endDate, 'yyyy-MM-dd'))
          .eq('available_hours', 0)
          .order('date', { ascending: true });

        if (error) throw error;

        // Transform the data to handle the profile relation
        const transformed = (data || []).map(entry => ({
          ...entry,
          profile: Array.isArray(entry.profile) ? entry.profile[0] : entry.profile
        })).filter(entry => entry.profile);

        setTimeOff(transformed as TimeOffEntry[]);
      } catch (error) {
        console.error('Error fetching time off:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeOff();
  }, [daysAhead]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDate = (dateStr: string) => {
    const date = parseISO(dateStr);
    const today = startOfDay(new Date());
    const tomorrow = addDays(today, 1);

    if (isWithinInterval(date, { start: today, end: endOfDay(today) })) {
      return language === 'nl' ? 'Vandaag' : 'Today';
    }
    if (isWithinInterval(date, { start: tomorrow, end: endOfDay(tomorrow) })) {
      return language === 'nl' ? 'Morgen' : 'Tomorrow';
    }
    return format(date, 'd MMM', { locale: language === 'nl' ? nl : undefined });
  };

  // Group consecutive days for same person
  const groupedTimeOff = timeOff.reduce<{ user_id: string; profile: TimeOffEntry['profile']; reason_type: string; reason: string | null; dates: string[] }[]>((acc, entry) => {
    const existing = acc.find(
      g => g.user_id === entry.user_id && g.reason_type === entry.reason_type
    );
    if (existing) {
      existing.dates.push(entry.date);
    } else {
      acc.push({
        user_id: entry.user_id,
        profile: entry.profile,
        reason_type: entry.reason_type,
        reason: entry.reason,
        dates: [entry.date],
      });
    }
    return acc;
  }, []);

  if (loading) {
    return (
      <div className={cn("space-y-2", compact && "flex items-center gap-2")}>
        {compact ? (
          <>
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-8 w-8 rounded-full" />
          </>
        ) : (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        )}
      </div>
    );
  }

  if (groupedTimeOff.length === 0) {
    return null;
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <CalendarOff className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <span className="text-sm text-muted-foreground">
          {language === 'nl' ? 'Afwezig:' : 'Time off:'}
        </span>
        <ScrollArea className="flex-1">
          <div className="flex items-center gap-2 pb-1">
            {groupedTimeOff.slice(0, 5).map((group, idx) => {
              const config = reasonTypeConfig[group.reason_type] || reasonTypeConfig.other;
              const Icon = config.icon;
              const startDate = formatDate(group.dates[0]);
              const endDate = group.dates.length > 1 ? formatDate(group.dates[group.dates.length - 1]) : null;

              return (
                <div
                  key={`${group.user_id}-${idx}`}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 border border-border text-xs whitespace-nowrap"
                  title={`${group.profile.full_name} - ${config.labelEn}${group.reason ? `: ${group.reason}` : ''}`}
                >
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={group.profile.avatar_url || undefined} />
                    <AvatarFallback className="text-[10px]">
                      {getInitials(group.profile.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <Icon className={cn("h-3 w-3", config.color)} />
                  <span className="font-medium">{group.profile.full_name.split(' ')[0]}</span>
                  <span className="text-muted-foreground">
                    {endDate ? `${startDate} - ${endDate}` : startDate}
                  </span>
                </div>
              );
            })}
            {groupedTimeOff.length > 5 && (
              <Badge variant="secondary" className="text-xs">
                +{groupedTimeOff.length - 5}
              </Badge>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <CalendarOff className="h-4 w-4" />
        <span>{language === 'nl' ? 'Geplande afwezigheid' : 'Upcoming Time Off'}</span>
        <Badge variant="secondary" className="text-xs">
          {groupedTimeOff.length}
        </Badge>
      </div>
      <div className="space-y-2">
        {groupedTimeOff.map((group, idx) => {
          const config = reasonTypeConfig[group.reason_type] || reasonTypeConfig.other;
          const Icon = config.icon;
          const startDate = formatDate(group.dates[0]);
          const endDate = group.dates.length > 1 ? formatDate(group.dates[group.dates.length - 1]) : null;

          return (
            <Card key={`${group.user_id}-${idx}`} className="p-3">
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={group.profile.avatar_url || undefined} />
                  <AvatarFallback className="text-sm">
                    {getInitials(group.profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{group.profile.full_name}</span>
                    <Badge variant="outline" className="flex items-center gap-1 text-xs">
                      <Icon className={cn("h-3 w-3", config.color)} />
                      {language === 'nl' ? config.labelNl : config.labelEn}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {endDate ? (
                      <span>{startDate} – {endDate} ({group.dates.length} {language === 'nl' ? 'dagen' : 'days'})</span>
                    ) : (
                      <span>{startDate}</span>
                    )}
                    {group.reason && (
                      <span className="ml-2 italic">"{group.reason}"</span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default UpcomingTimeOff;
