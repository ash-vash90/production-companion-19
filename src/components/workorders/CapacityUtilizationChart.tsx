import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { Users, Calendar, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';

interface OperatorDailyLoad {
  id: string;
  full_name: string;
  avatar_url: string | null;
  assignment_count: number;
  is_unavailable: boolean;
}

interface CapacityUtilizationChartProps {
  selectedDate?: Date;
  workOrderId?: string;
}

const CapacityUtilizationChart: React.FC<CapacityUtilizationChartProps> = ({
  selectedDate = new Date(),
}) => {
  const { language } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [operatorLoads, setOperatorLoads] = useState<OperatorDailyLoad[]>([]);

  const dateString = format(selectedDate, 'yyyy-MM-dd');
  const locale = language === 'nl' ? nl : enUS;

  useEffect(() => {
    fetchCapacityData();
  }, [dateString]);

  const fetchCapacityData = async () => {
    setLoading(true);
    try {
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);
      if (userIds.length === 0) {
        setOperatorLoads([]);
        return;
      }

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      const { data: availabilityData } = await supabase
        .from('operator_availability')
        .select('user_id, available_hours')
        .eq('date', dateString)
        .in('user_id', userIds);

      const unavailable = new Set<string>();
      (availabilityData || []).forEach((a: any) => {
        if (a.available_hours === 0) unavailable.add(a.user_id);
      });

      const { data: assignmentsData } = await supabase
        .from('operator_assignments')
        .select('operator_id')
        .eq('assigned_date', dateString)
        .in('operator_id', userIds);

      const countMap = new Map<string, number>();
      (assignmentsData || []).forEach((a: any) => {
        const current = countMap.get(a.operator_id) || 0;
        countMap.set(a.operator_id, current + 1);
      });

      const loads: OperatorDailyLoad[] = (profilesData || []).map((p: any) => ({
        id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        assignment_count: countMap.get(p.id) || 0,
        is_unavailable: unavailable.has(p.id),
      }));

      loads.sort((a, b) => b.assignment_count - a.assignment_count);
      setOperatorLoads(loads);
    } catch (error) {
      console.error('Error fetching capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = useMemo(() => {
    const activeOperators = operatorLoads.filter((o) => !o.is_unavailable);
    return {
      activeOperators: activeOperators.length,
      totalAssignments: activeOperators.reduce((sum, o) => sum + o.assignment_count, 0),
    };
  }, [operatorLoads]);

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-24 mb-1" />
                  <Skeleton className="h-3 w-16" />
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
            <Users className="h-4 w-4" />
            {language === 'nl' ? 'Dagoverzicht' : 'Daily Overview'}
          </CardTitle>
          <Badge variant="outline" className="gap-1.5 font-medium tracking-wide">
            <Calendar className="h-3 w-3" />
            {format(selectedDate, 'd MMM', { locale })}
          </Badge>
        </div>
        <CardDescription className="text-xs">
          {language === 'nl'
            ? `${totals.activeOperators} operators · ${totals.totalAssignments} werkorders toegewezen`
            : `${totals.activeOperators} operators · ${totals.totalAssignments} work orders assigned`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        {operatorLoads.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-sm">
            {language === 'nl' ? 'Geen operators gevonden' : 'No operators found'}
          </div>
        ) : (
          operatorLoads.map((op) => (
            <div key={op.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card">
              <Avatar className="h-9 w-9">
                {op.avatar_url && <AvatarImage src={op.avatar_url} />}
                <AvatarFallback className="text-xs">{getInitials(op.full_name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">{op.full_name}</p>
                {op.is_unavailable ? (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 text-warning" />
                    {language === 'nl' ? 'Afwezig' : 'Away'}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {language === 'nl' ? 'Beschikbaar' : 'Available'}
                  </p>
                )}
              </div>
              {op.is_unavailable ? (
                <Badge variant="destructive" className="text-[10px]">
                  {language === 'nl' ? 'Afwezig' : 'Away'}
                </Badge>
              ) : (
                <Badge variant={op.assignment_count > 0 ? 'secondary' : 'outline'} className="font-semibold tabular-nums tracking-wide">
                  {op.assignment_count}
                </Badge>
              )}
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default CapacityUtilizationChart;

