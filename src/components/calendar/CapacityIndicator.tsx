import { useState, useEffect, useMemo } from 'react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Users, CheckCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';

interface DayCapacity {
  date: Date;
  totalPlanned: number;
  totalCapacity: number;
  utilization: number;
  operatorCount: number;
  overloadedCount: number;
}

interface CapacityIndicatorProps {
  date: Date;
  capacityData: DayCapacity | undefined;
  compact?: boolean;
}

export function CapacityIndicator({ date, capacityData, compact = false }: CapacityIndicatorProps) {
  const { language } = useLanguage();

  if (!capacityData || capacityData.operatorCount === 0) {
    return null;
  }

  const { utilization, overloadedCount, operatorCount, totalPlanned, totalCapacity } = capacityData;

  // Determine status
  let status: 'ok' | 'warning' | 'critical' = 'ok';
  if (overloadedCount > 0) {
    status = 'critical';
  } else if (utilization >= 80) {
    status = 'warning';
  }

  if (status === 'ok' && compact) {
    return null; // Don't show indicator if everything is fine in compact mode
  }

  const getIcon = () => {
    switch (status) {
      case 'critical':
        return <AlertTriangle className="h-3 w-3 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-3 w-3 text-amber-500" />;
      default:
        return <CheckCircle className="h-3 w-3 text-green-500" />;
    }
  };

  const getTooltipContent = () => {
    const lines = [];

    if (overloadedCount > 0) {
      lines.push(
        language === 'nl'
          ? `${overloadedCount} operator(s) overbezet`
          : `${overloadedCount} operator(s) overloaded`
      );
    }

    lines.push(
      language === 'nl'
        ? `Bezetting: ${Math.round(utilization)}%`
        : `Utilization: ${Math.round(utilization)}%`
    );

    lines.push(
      language === 'nl'
        ? `${totalPlanned}h / ${totalCapacity}h gepland`
        : `${totalPlanned}h / ${totalCapacity}h planned`
    );

    return lines;
  };

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="absolute top-0.5 right-0.5 md:top-1 md:right-1">
              {getIcon()}
            </div>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {getTooltipContent().map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 text-xs">
            {getIcon()}
            <span className={`${
              status === 'critical' ? 'text-red-600' :
              status === 'warning' ? 'text-amber-600' : 'text-green-600'
            }`}>
              {Math.round(utilization)}%
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {getTooltipContent().map((line, i) => (
            <div key={i}>{line}</div>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Hook to fetch capacity data for a date range
export function useCapacityData(startDate: Date, endDate: Date, viewMode: 'month' | 'week') {
  const [capacityByDate, setCapacityByDate] = useState<Map<string, DayCapacity>>(new Map());
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadCapacity();
  }, [startDate.toISOString(), endDate.toISOString()]);

  const loadCapacity = async () => {
    try {
      setLoading(true);
      const startStr = format(startDate, 'yyyy-MM-dd');
      const endStr = format(endDate, 'yyyy-MM-dd');

      // Fetch operators with their capacity
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, daily_capacity_hours, is_available')
        .in('role', ['operator', 'supervisor', 'admin'])
        .eq('is_available', true);

      if (profilesError) throw profilesError;

      // Fetch all assignments in the date range
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('operator_assignments')
        .select('operator_id, assigned_date, planned_hours')
        .gte('assigned_date', startStr)
        .lte('assigned_date', endStr);

      if (assignmentsError) throw assignmentsError;

      // Calculate capacity per day
      const days = eachDayOfInterval({ start: startDate, end: endDate });
      const newCapacityMap = new Map<string, DayCapacity>();

      const operatorCount = (profilesData || []).length;
      const totalDailyCapacity = (profilesData || []).reduce(
        (sum, p) => sum + (p.daily_capacity_hours || 8),
        0
      );

      // Create a map of operator id to their capacity
      const operatorCapacity = new Map<string, number>();
      (profilesData || []).forEach(p => {
        operatorCapacity.set(p.id, p.daily_capacity_hours || 8);
      });

      days.forEach(day => {
        const dateStr = format(day, 'yyyy-MM-dd');

        // Get assignments for this day
        const dayAssignments = (assignmentsData || []).filter(
          a => a.assigned_date === dateStr
        );

        // Calculate total planned hours
        const totalPlanned = dayAssignments.reduce(
          (sum, a) => sum + a.planned_hours,
          0
        );

        // Calculate per-operator utilization to find overloaded operators
        const operatorHours = new Map<string, number>();
        dayAssignments.forEach(a => {
          const current = operatorHours.get(a.operator_id) || 0;
          operatorHours.set(a.operator_id, current + a.planned_hours);
        });

        let overloadedCount = 0;
        operatorHours.forEach((hours, opId) => {
          const capacity = operatorCapacity.get(opId) || 8;
          if (hours > capacity) {
            overloadedCount++;
          }
        });

        const utilization = totalDailyCapacity > 0
          ? (totalPlanned / totalDailyCapacity) * 100
          : 0;

        newCapacityMap.set(dateStr, {
          date: day,
          totalPlanned,
          totalCapacity: totalDailyCapacity,
          utilization,
          operatorCount,
          overloadedCount,
        });
      });

      setCapacityByDate(newCapacityMap);
    } catch (error) {
      console.error('Failed to load capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCapacityForDate = (date: Date): DayCapacity | undefined => {
    return capacityByDate.get(format(date, 'yyyy-MM-dd'));
  };

  return { capacityByDate, getCapacityForDate, loading, refetch: loadCapacity };
}

export default CapacityIndicator;
