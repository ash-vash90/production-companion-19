import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
import {
  Users,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Clock,
  CalendarDays,
  Loader2,
  UserCheck,
  UserX
} from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, parseISO, isSameDay } from 'date-fns';

interface OperatorWorkload {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  daily_capacity_hours: number;
  is_available: boolean;
  assignments: {
    date: string;
    work_order_id: string;
    wo_number: string;
    planned_hours: number;
    product_type: string;
  }[];
  totalHours: number;
  utilizationPercent: number;
}

interface OperatorCapacityPanelProps {
  selectedDate: Date;
  onAssignOperator?: (operatorId: string, date: Date) => void;
}

export function OperatorCapacityPanel({ selectedDate, onAssignOperator }: OperatorCapacityPanelProps) {
  const { t, language } = useLanguage();
  const [operators, setOperators] = useState<OperatorWorkload[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOperators, setExpandedOperators] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    loadOperatorCapacity();
  }, [selectedDate, viewMode]);

  const loadOperatorCapacity = async () => {
    try {
      setLoading(true);

      // Get date range based on view mode
      const startDate = viewMode === 'week' ? format(weekStart, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd');
      const endDate = viewMode === 'week' ? format(weekEnd, 'yyyy-MM-dd') : format(selectedDate, 'yyyy-MM-dd');

      // Fetch operators (only those with operator or supervisor roles)
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, daily_capacity_hours, is_available')
        .in('role', ['operator', 'supervisor', 'admin']) as { data: { id: string; full_name: string; avatar_url: string | null; role: string; daily_capacity_hours: number; is_available: boolean }[] | null; error: any };

      if (profilesError) throw profilesError;

      // Fetch assignments for the date range
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('operator_assignments' as any)
        .select(`
          id,
          operator_id,
          assigned_date,
          planned_hours,
          work_order_id,
          work_orders (
            wo_number,
            product_type
          )
        `)
        .gte('assigned_date', startDate)
        .lte('assigned_date', endDate) as { data: { id: string; operator_id: string; assigned_date: string; planned_hours: number; work_order_id: string; work_orders: { wo_number: string; product_type: string } }[] | null; error: any };

      if (assignmentsError) throw assignmentsError;

      // Calculate capacity for each operator
      const operatorsWithCapacity: OperatorWorkload[] = (profilesData || []).map(profile => {
        const operatorAssignments = (assignmentsData || [])
          .filter(a => a.operator_id === profile.id)
          .map(a => ({
            date: a.assigned_date,
            work_order_id: a.work_order_id,
            wo_number: (a.work_orders as any)?.wo_number || 'Unknown',
            planned_hours: a.planned_hours,
            product_type: (a.work_orders as any)?.product_type || 'Unknown',
          }));

        const totalHours = operatorAssignments.reduce((sum, a) => sum + a.planned_hours, 0);
        const capacityHours = (profile.daily_capacity_hours || 8) * (viewMode === 'week' ? 5 : 1);
        const utilizationPercent = capacityHours > 0 ? Math.round((totalHours / capacityHours) * 100) : 0;

        return {
          id: profile.id,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: profile.role,
          daily_capacity_hours: profile.daily_capacity_hours || 8,
          is_available: profile.is_available !== false,
          assignments: operatorAssignments,
          totalHours,
          utilizationPercent,
        };
      });

      // Sort by utilization (highest first for visibility)
      operatorsWithCapacity.sort((a, b) => b.utilizationPercent - a.utilizationPercent);

      setOperators(operatorsWithCapacity);
    } catch (error) {
      console.error('Failed to load operator capacity:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (operatorId: string) => {
    setExpandedOperators(prev => {
      const newSet = new Set(prev);
      if (newSet.has(operatorId)) {
        newSet.delete(operatorId);
      } else {
        newSet.add(operatorId);
      }
      return newSet;
    });
  };

  const getUtilizationColor = (percent: number) => {
    if (percent >= 100) return 'text-red-600 dark:text-red-400';
    if (percent >= 80) return 'text-amber-600 dark:text-amber-400';
    return 'text-green-600 dark:text-green-400';
  };

  const getProgressColor = (percent: number) => {
    if (percent >= 100) return 'bg-red-500';
    if (percent >= 80) return 'bg-amber-500';
    return 'bg-green-500';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const availableOperators = operators.filter(o => o.is_available);
  const unavailableOperators = operators.filter(o => !o.is_available);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              {language === 'nl' ? 'Team Capaciteit' : 'Team Capacity'}
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              {viewMode === 'week'
                ? `${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d')}`
                : format(selectedDate, 'EEEE, MMM d')}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'day' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setViewMode('day')}
            >
              {language === 'nl' ? 'Dag' : 'Day'}
            </Button>
            <Button
              variant={viewMode === 'week' ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs px-2"
              onClick={() => setViewMode('week')}
            >
              {language === 'nl' ? 'Week' : 'Week'}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : operators.length === 0 ? (
          <div className="text-center py-8 px-4">
            <Users className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {language === 'nl' ? 'Geen operators gevonden' : 'No operators found'}
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="p-3 space-y-2">
              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-semibold">{availableOperators.length}</div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'nl' ? 'Beschikbaar' : 'Available'}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-semibold">
                    {operators.filter(o => o.utilizationPercent >= 80).length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'nl' ? 'Bijna vol' : 'Near Full'}
                  </div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2 text-center">
                  <div className="text-lg font-semibold">
                    {operators.filter(o => o.utilizationPercent >= 100).length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {language === 'nl' ? 'Overbezet' : 'Over'}
                  </div>
                </div>
              </div>

              {/* Available operators */}
              {availableOperators.map(operator => (
                <Collapsible
                  key={operator.id}
                  open={expandedOperators.has(operator.id)}
                  onOpenChange={() => toggleExpanded(operator.id)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <button className="w-full p-3 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left">
                        <Avatar className="h-8 w-8">
                          <AvatarImage src={operator.avatar_url || undefined} />
                          <AvatarFallback className="text-xs">
                            {getInitials(operator.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {operator.full_name}
                            </span>
                            {operator.utilizationPercent >= 100 && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    {language === 'nl' ? 'Overbezet' : 'Over capacity'}
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Progress
                              value={Math.min(operator.utilizationPercent, 100)}
                              className="h-1.5 flex-1"
                            />
                            <span className={`text-xs font-medium ${getUtilizationColor(operator.utilizationPercent)}`}>
                              {operator.utilizationPercent}%
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-muted-foreground">
                            {operator.totalHours}h / {operator.daily_capacity_hours * (viewMode === 'week' ? 5 : 1)}h
                          </div>
                          {expandedOperators.has(operator.id) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground mt-1" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground mt-1" />
                          )}
                        </div>
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="px-3 pb-3 pt-1 border-t bg-muted/20">
                        {operator.assignments.length === 0 ? (
                          <p className="text-xs text-muted-foreground py-2 text-center">
                            {language === 'nl' ? 'Geen toewijzingen' : 'No assignments'}
                          </p>
                        ) : (
                          <div className="space-y-1.5 mt-2">
                            {operator.assignments.map((assignment, idx) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs bg-background rounded px-2 py-1.5"
                              >
                                <div className="flex items-center gap-2">
                                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                    {assignment.product_type}
                                  </Badge>
                                  <span className="font-medium">{assignment.wo_number}</span>
                                </div>
                                <div className="flex items-center gap-2 text-muted-foreground">
                                  {viewMode === 'week' && (
                                    <span>{format(parseISO(assignment.date), 'EEE')}</span>
                                  )}
                                  <span className="flex items-center gap-0.5">
                                    <Clock className="h-3 w-3" />
                                    {assignment.planned_hours}h
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                        {onAssignOperator && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full mt-2 h-7 text-xs"
                            onClick={() => onAssignOperator(operator.id, selectedDate)}
                          >
                            {language === 'nl' ? 'Werk Toewijzen' : 'Assign Work'}
                          </Button>
                        )}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))}

              {/* Unavailable operators */}
              {unavailableOperators.length > 0 && (
                <div className="mt-4">
                  <div className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                    <UserX className="h-3.5 w-3.5" />
                    {language === 'nl' ? 'Niet beschikbaar' : 'Unavailable'}
                  </div>
                  {unavailableOperators.map(operator => (
                    <div
                      key={operator.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 opacity-60"
                    >
                      <Avatar className="h-6 w-6">
                        <AvatarImage src={operator.avatar_url || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {getInitials(operator.full_name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-sm text-muted-foreground">{operator.full_name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default OperatorCapacityPanel;
