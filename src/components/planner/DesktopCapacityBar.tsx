import React, { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Users, AlertTriangle } from 'lucide-react';
import UpcomingTimeOff from './UpcomingTimeOff';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  daily_capacity_hours: number;
  is_available: boolean;
}

interface OperatorAssignment {
  operator_id: string;
  count: number;
}

interface DesktopCapacityBarProps {
  currentDate: Date;
}

const DesktopCapacityBar: React.FC<DesktopCapacityBarProps> = ({ currentDate }) => {
  const { language } = useLanguage();
  const [operators, setOperators] = useState<Operator[]>([]);
  const [assignments, setAssignments] = useState<OperatorAssignment[]>([]);
  const [unavailable, setUnavailable] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCapacity = async () => {
      setLoading(true);
      try {
        const dateStr = format(currentDate, 'yyyy-MM-dd');

        // Fetch production team operators
        const { data: teamData } = await supabase
          .from('user_teams')
          .select(`
            user_id,
            teams!inner(name)
          `)
          .ilike('teams.name', '%production%');

        const operatorIds = teamData?.map(t => t.user_id) || [];

        if (operatorIds.length === 0) {
          setOperators([]);
          setLoading(false);
          return;
        }

        // Fetch operator profiles
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, daily_capacity_hours, is_available')
          .in('id', operatorIds);

        setOperators(profilesData || []);

        // Fetch availability for the current date
        const { data: availabilityData } = await supabase
          .from('operator_availability')
          .select('user_id')
          .eq('date', dateStr)
          .eq('available_hours', 0);

        setUnavailable(availabilityData?.map(a => a.user_id) || []);

        // Fetch assignment counts for the current date
        const { data: assignmentData } = await supabase
          .from('operator_assignments')
          .select('operator_id')
          .eq('assigned_date', dateStr);

        const counts: Record<string, number> = {};
        assignmentData?.forEach(a => {
          counts[a.operator_id] = (counts[a.operator_id] || 0) + 1;
        });

        setAssignments(
          Object.entries(counts).map(([operator_id, count]) => ({ operator_id, count }))
        );
      } catch (error) {
        console.error('Error fetching capacity:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCapacity();
  }, [currentDate]);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getAssignmentCount = (operatorId: string) => {
    return assignments.find(a => a.operator_id === operatorId)?.count || 0;
  };

  const isUnavailable = (operatorId: string) => {
    return unavailable.includes(operatorId);
  };

  if (loading) {
    return (
      <div className="flex-none border-t bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-32" />
          <div className="flex gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-10 rounded-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (operators.length === 0) {
    return null;
  }

  return (
    <div className="flex-none border-t bg-muted/30">
      <div className="px-4 py-3 space-y-3">
        {/* Team Capacity Row */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground flex-shrink-0">
            <Users className="h-4 w-4" />
            <span>{language === 'nl' ? 'Teamcapaciteit' : 'Team Capacity'}</span>
            <span className="text-xs">({format(currentDate, 'd MMM')})</span>
          </div>

          <ScrollArea className="flex-1">
            <div className="flex items-center gap-3 pb-1">
              {operators.map((operator) => {
                const count = getAssignmentCount(operator.id);
                const unavailableToday = isUnavailable(operator.id);

                return (
                  <div
                    key={operator.id}
                    className={cn(
                      "flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors",
                      unavailableToday 
                        ? "bg-muted/50 border-muted opacity-60" 
                        : count > 0 
                          ? "bg-primary/10 border-primary/30" 
                          : "bg-background border-border hover:bg-muted/50"
                    )}
                  >
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={operator.avatar_url || undefined} />
                      <AvatarFallback className="text-xs">
                        {getInitials(operator.full_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium whitespace-nowrap">
                      {operator.full_name.split(' ')[0]}
                    </span>
                    {unavailableToday ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    ) : (
                      <Badge 
                        variant={count > 0 ? "default" : "secondary"} 
                        className="h-5 px-1.5 text-xs"
                      >
                        {count}
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* Upcoming Time Off Row */}
        <UpcomingTimeOff compact daysAhead={14} />
      </div>
    </div>
  );
};

export default DesktopCapacityBar;
