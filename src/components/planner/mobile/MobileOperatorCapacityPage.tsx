import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { formatProductType, cn } from '@/lib/utils';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { 
  ChevronLeft, 
  ChevronRight,
  ChevronDown,
  Calendar as CalendarIcon,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  CalendarOff
} from 'lucide-react';
import UpcomingTimeOff from '../UpcomingTimeOff';

interface Operator {
  id: string;
  full_name: string;
  avatar_url: string | null;
  is_available: boolean;
}

interface OperatorAvailability {
  user_id: string;
  date: string;
  available_hours: number;
  reason_type: string;
  reason: string | null;
}

interface OperatorAssignment {
  operator_id: string;
  assigned_date: string;
  work_order: {
    id: string;
    wo_number: string;
    product_type: string;
    customer_name: string | null;
  };
}

interface MobileOperatorCapacityPageProps {
  currentDate: Date;
  onBack: () => void;
  onSelectWorkOrder: (id: string) => void;
}

const MobileOperatorCapacityPage: React.FC<MobileOperatorCapacityPageProps> = ({
  currentDate,
  onBack,
  onSelectWorkOrder,
}) => {
  const { language } = useLanguage();
  const [viewMode, setViewMode] = useState<'today' | 'week'>('today');
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [availability, setAvailability] = useState<OperatorAvailability[]>([]);
  const [assignments, setAssignments] = useState<OperatorAssignment[]>([]);
  const [loading, setLoading] = useState(true);

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 1 });
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd });

  useEffect(() => {
    fetchData();
  }, [selectedDate, viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch operators (Production team)
      const { data: teamMembers } = await supabase
        .from('user_teams')
        .select('user_id, team:teams(name)')
        .eq('team.name', 'Production');

      const userIds = (teamMembers || []).map((tm: any) => tm.user_id);

      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, is_available')
        .in('id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .order('full_name');

      setOperators(profilesData || []);

      // Date range for queries
      const startDate = viewMode === 'today' 
        ? format(selectedDate, 'yyyy-MM-dd')
        : format(weekStart, 'yyyy-MM-dd');
      const endDate = viewMode === 'today'
        ? format(selectedDate, 'yyyy-MM-dd')
        : format(weekEnd, 'yyyy-MM-dd');

      // Fetch availability
      const { data: availabilityData } = await supabase
        .from('operator_availability')
        .select('user_id, date, available_hours, reason_type, reason')
        .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('date', startDate)
        .lte('date', endDate);

      setAvailability(availabilityData || []);

      // Fetch assignments with work order details
      const { data: assignmentsData } = await supabase
        .from('operator_assignments')
        .select(`
          operator_id,
          assigned_date,
          work_order:work_orders(id, wo_number, product_type, customer_name)
        `)
        .in('operator_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
        .gte('assigned_date', startDate)
        .lte('assigned_date', endDate);

      setAssignments((assignmentsData || []).map((a: any) => ({
        operator_id: a.operator_id,
        assigned_date: a.assigned_date,
        work_order: a.work_order,
      })));
    } catch (error) {
      console.error('Error fetching capacity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const getOperatorStatus = (operatorId: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const avail = availability.find(a => a.user_id === operatorId && a.date === dateStr);
    const dayAssignments = assignments.filter(a => 
      a.operator_id === operatorId && a.assigned_date === dateStr
    );

    return {
      isUnavailable: avail?.available_hours === 0,
      reason: avail?.reason || avail?.reason_type,
      assignmentCount: dayAssignments.length,
      assignments: dayAssignments,
    };
  };

  const goToPrevDay = () => setSelectedDate(addDays(selectedDate, -1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));
  const goToPrevWeek = () => setSelectedDate(addDays(selectedDate, -7));
  const goToNextWeek = () => setSelectedDate(addDays(selectedDate, 7));

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-none p-4 border-b">
          <Skeleton className="h-8 w-32" />
        </div>
        <div className="flex-1 p-4 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-none p-4 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 mb-3">
          <Button variant="ghost" size="icon" onClick={onBack} className="h-10 w-10 -ml-2">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold">
              {language === 'nl' ? 'Team capaciteit' : 'Team Capacity'}
            </h1>
            <p className="text-sm text-muted-foreground">
              {operators.length} {language === 'nl' ? 'operators' : 'operators'}
            </p>
          </div>
        </div>

        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'today' | 'week')}>
          <TabsList className="grid w-full grid-cols-2 h-11">
            <TabsTrigger value="today" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {language === 'nl' ? 'Dag' : 'Day'}
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-2">
              <CalendarIcon className="h-4 w-4" />
              {language === 'nl' ? 'Week' : 'Week'}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Date Navigation */}
      <div className="flex-none p-3 border-b bg-muted/30">
        <div className="flex items-center justify-between">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={viewMode === 'today' ? goToPrevDay : goToPrevWeek}
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="text-center">
            {viewMode === 'today' ? (
              <>
                <div className="font-medium">{format(selectedDate, 'EEEE')}</div>
                <div className="text-sm text-muted-foreground">{format(selectedDate, 'd MMMM yyyy')}</div>
              </>
            ) : (
              <>
                <div className="font-medium">{language === 'nl' ? 'Week' : 'Week'} {format(selectedDate, 'w')}</div>
                <div className="text-sm text-muted-foreground">
                  {format(weekStart, 'd MMM')} - {format(weekEnd, 'd MMM yyyy')}
                </div>
              </>
            )}
          </div>
          
          <Button 
            variant="outline" 
            size="icon" 
            onClick={viewMode === 'today' ? goToNextDay : goToNextWeek}
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* Upcoming Time Off Section */}
          <Collapsible defaultOpen>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between h-auto py-2 px-3 -mx-1">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <CalendarOff className="h-4 w-4 text-muted-foreground" />
                  {language === 'nl' ? 'Geplande afwezigheid' : 'Upcoming Time Off'}
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <UpcomingTimeOff daysAhead={14} />
            </CollapsibleContent>
          </Collapsible>

          {/* Operators List */}
          {operators.map((operator) => {
            const status = getOperatorStatus(operator.id, selectedDate);
            
            return (
              <Card key={operator.id}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-12 w-12">
                      {operator.avatar_url && <AvatarImage src={operator.avatar_url} />}
                      <AvatarFallback>{getInitials(operator.full_name)}</AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium">{operator.full_name}</span>
                        {viewMode === 'today' && (
                          status.isUnavailable ? (
                            <Badge variant="destructive" className="text-xs">
                              <XCircle className="h-3 w-3 mr-1" />
                              {status.reason || (language === 'nl' ? 'Afwezig' : 'Away')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1 text-success" />
                              {language === 'nl' ? 'Beschikbaar' : 'Available'}
                            </Badge>
                          )
                        )}
                      </div>
                      
                      {viewMode === 'today' ? (
                        <div className="space-y-2">
                          {status.assignmentCount > 0 ? (
                            <div className="text-sm text-muted-foreground mb-2">
                              {status.assignmentCount} {language === 'nl' ? 'werkorders' : 'work orders'}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">
                              {language === 'nl' ? 'Geen toewijzingen' : 'No assignments'}
                            </div>
                          )}
                          
                          {status.assignments.map((assignment) => (
                            <button
                              key={`${assignment.operator_id}-${assignment.work_order.id}`}
                              onClick={() => onSelectWorkOrder(assignment.work_order.id)}
                              className="w-full text-left p-2 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-medium">
                                  {assignment.work_order.wo_number}
                                </span>
                                <Badge variant="outline" className="text-[10px]">
                                  {formatProductType(assignment.work_order.product_type)}
                                </Badge>
                              </div>
                              {assignment.work_order.customer_name && (
                                <p className="text-xs text-muted-foreground truncate mt-1">
                                  {assignment.work_order.customer_name}
                                </p>
                              )}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="flex gap-1 mt-2">
                          {weekDays.map((day) => {
                            const dayStatus = getOperatorStatus(operator.id, day);
                            const isToday = isSameDay(day, new Date());
                            
                            return (
                              <div
                                key={day.toISOString()}
                                className={cn(
                                  'flex-1 text-center p-1 rounded text-xs',
                                  dayStatus.isUnavailable && 'bg-destructive/10',
                                  isToday && 'ring-1 ring-primary'
                                )}
                              >
                                <div className="text-[10px] text-muted-foreground">
                                  {format(day, 'EEE')}
                                </div>
                                {dayStatus.isUnavailable ? (
                                  <XCircle className="h-4 w-4 mx-auto text-destructive" />
                                ) : dayStatus.assignmentCount > 0 ? (
                                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                    {dayStatus.assignmentCount}
                                  </Badge>
                                ) : (
                                  <div className="h-5 flex items-center justify-center text-muted-foreground">
                                    -
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {operators.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertTriangle className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">
                  {language === 'nl' 
                    ? 'Geen operators in Production team' 
                    : 'No operators in Production team'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default MobileOperatorCapacityPage;
