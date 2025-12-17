import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { BarChart3, Calendar, AlertTriangle } from 'lucide-react';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface OperatorCapacity {
  id: string;
  full_name: string;
  avatar_url: string | null;
  daily_capacity_hours: number;
  scheduled_hours: number;
  availability_hours: number | null;
  is_unavailable: boolean;
}

interface CapacityUtilizationChartProps {
  selectedDate?: Date;
  workOrderId?: string;
}

const CapacityUtilizationChart: React.FC<CapacityUtilizationChartProps> = ({
  selectedDate = new Date(),
  workOrderId,
}) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [operatorCapacities, setOperatorCapacities] = useState<OperatorCapacity[]>([]);
  
  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const locale = language === 'nl' ? nl : enUS;

  useEffect(() => {
    fetchCapacityData();
  }, [dateString, workOrderId]);

  const fetchCapacityData = async () => {
    setLoading(true);
    try {
      // Get production team members
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);
      
      if (userIds.length === 0) {
        setOperatorCapacities([]);
        setLoading(false);
        return;
      }

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, daily_capacity_hours')
        .in('id', userIds);

      // Fetch availability for the date
      const { data: availabilityData } = await supabase
        .from('operator_availability')
        .select('user_id, available_hours')
        .eq('date', dateString)
        .in('user_id', userIds);

      const availabilityMap = new Map<string, number>();
      (availabilityData || []).forEach((a: any) => {
        availabilityMap.set(a.user_id, a.available_hours);
      });

      // Fetch operator assignments for the date
      const { data: assignmentsData } = await supabase
        .from('operator_assignments')
        .select('operator_id, planned_hours')
        .eq('assigned_date', dateString)
        .in('operator_id', userIds);

      const workloadMap = new Map<string, number>();
      (assignmentsData || []).forEach((a: any) => {
        const current = workloadMap.get(a.operator_id) || 0;
        workloadMap.set(a.operator_id, current + Number(a.planned_hours));
      });

      // Build capacity data
      const capacities: OperatorCapacity[] = (profilesData || []).map((profile: any) => {
        const availHours = availabilityMap.get(profile.id);
        const scheduledHours = workloadMap.get(profile.id) || 0;
        
        return {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          daily_capacity_hours: profile.daily_capacity_hours,
          scheduled_hours: scheduledHours,
          availability_hours: availHours !== undefined ? availHours : null,
          is_unavailable: availHours === 0,
        };
      });

      // Sort by utilization percentage (descending)
      capacities.sort((a, b) => {
        const aCapacity = a.availability_hours ?? a.daily_capacity_hours;
        const bCapacity = b.availability_hours ?? b.daily_capacity_hours;
        const aUtil = aCapacity > 0 ? a.scheduled_hours / aCapacity : 0;
        const bUtil = bCapacity > 0 ? b.scheduled_hours / bCapacity : 0;
        return bUtil - aUtil;
      });

      setOperatorCapacities(capacities);
    } catch (error) {
      console.error('Error fetching capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getUtilizationColor = (scheduled: number, capacity: number) => {
    if (capacity === 0) return 'bg-muted-foreground';
    const util = scheduled / capacity;
    if (util > 1) return 'bg-destructive';
    if (util > 0.8) return 'bg-warning';
    if (util > 0.5) return 'bg-primary';
    return 'bg-emerald-500';
  };

  const getUtilizationStatus = (scheduled: number, capacity: number) => {
    if (capacity === 0) return { label: language === 'nl' ? 'N/A' : 'N/A', color: 'secondary' as const };
    const util = scheduled / capacity;
    if (util > 1) return { label: language === 'nl' ? 'Overbelast' : 'Overloaded', color: 'destructive' as const };
    if (util > 0.8) return { label: language === 'nl' ? 'Bijna vol' : 'Near Full', color: 'warning' as const };
    if (util > 0.5) return { label: language === 'nl' ? 'Bezig' : 'Busy', color: 'default' as const };
    return { label: language === 'nl' ? 'Beschikbaar' : 'Available', color: 'secondary' as const };
  };

  // Calculate totals
  const totals = useMemo(() => {
    const available = operatorCapacities.filter(op => !op.is_unavailable);
    const totalCapacity = available.reduce((sum, op) => 
      sum + (op.availability_hours ?? op.daily_capacity_hours), 0);
    const totalScheduled = available.reduce((sum, op) => sum + op.scheduled_hours, 0);
    const utilization = totalCapacity > 0 ? Math.round((totalScheduled / totalCapacity) * 100) : 0;
    
    return { totalCapacity, totalScheduled, utilization, activeOperators: available.length };
  }, [operatorCapacities]);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-2 w-full" />
                </div>
              </div>
            ))}
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
            <BarChart3 className="h-4 w-4" />
            {language === 'nl' ? 'Capaciteitsoverzicht' : 'Capacity Overview'}
          </CardTitle>
          <Badge variant="outline" className="gap-1.5 font-mono">
            <Calendar className="h-3 w-3" />
            {format(selectedDate, 'd MMM', { locale })}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {language === 'nl' 
            ? `${totals.activeOperators} operators · ${totals.utilization}% bezetting`
            : `${totals.activeOperators} operators · ${totals.utilization}% utilization`}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Overall Progress */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {language === 'nl' ? 'Totale bezetting' : 'Total Utilization'}
            </span>
            <span className="font-mono">
              {totals.totalScheduled}h / {totals.totalCapacity}h
            </span>
          </div>
          <Progress 
            value={totals.utilization} 
            className="h-2"
          />
        </div>

        {/* Per-Operator Breakdown */}
        <div className="space-y-3 pt-2">
          {operatorCapacities.map((operator) => {
            const capacity = operator.availability_hours ?? operator.daily_capacity_hours;
            const utilPercent = capacity > 0 
              ? Math.min(100, Math.round((operator.scheduled_hours / capacity) * 100))
              : 0;
            const status = getUtilizationStatus(operator.scheduled_hours, capacity);

            return (
              <div key={operator.id} className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    {operator.avatar_url && <AvatarImage src={operator.avatar_url} />}
                    <AvatarFallback className="text-[9px]">
                      {getInitials(operator.full_name)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium flex-1 truncate">
                    {operator.full_name.split(' ')[0]}
                  </span>
                  
                  {operator.is_unavailable ? (
                    <Badge variant="destructive" className="text-[9px] gap-1">
                      <AlertTriangle className="h-2.5 w-2.5" />
                      {language === 'nl' ? 'Afwezig' : 'Away'}
                    </Badge>
                  ) : (
                    <>
                      <span className="text-xs text-muted-foreground font-mono">
                        {operator.scheduled_hours}h / {capacity}h
                      </span>
                      <Badge 
                        variant={status.color === 'warning' ? 'outline' : status.color}
                        className={`text-[9px] ${status.color === 'warning' ? 'border-warning text-warning' : ''}`}
                      >
                        {status.label}
                      </Badge>
                    </>
                  )}
                </div>
                
                {!operator.is_unavailable && (
                  <div className="ml-8">
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all ${getUtilizationColor(operator.scheduled_hours, capacity)}`}
                        style={{ width: `${utilPercent}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {operatorCapacities.length === 0 && (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {language === 'nl' ? 'Geen operators gevonden' : 'No operators found'}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default CapacityUtilizationChart;
