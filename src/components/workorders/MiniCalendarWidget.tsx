import React, { useMemo } from 'react';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useLanguage } from '@/contexts/LanguageContext';
import { CalendarDays, ChevronDown, ChevronUp, X } from 'lucide-react';
import { format, isSameDay, parseISO, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

interface WorkOrderDate {
  id: string;
  start_date: string | null;
  status: string;
}

interface MiniCalendarWidgetProps {
  workOrders: WorkOrderDate[];
  selectedDate: Date | null;
  onSelectDate: (date: Date | null) => void;
  className?: string;
}

export const MiniCalendarWidget: React.FC<MiniCalendarWidgetProps> = ({
  workOrders,
  selectedDate,
  onSelectDate,
  className,
}) => {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = React.useState(true);

  // Count work orders per day
  const workOrdersByDate = useMemo(() => {
    const map = new Map<string, { count: number; statuses: Set<string> }>();
    workOrders.forEach((wo) => {
      if (wo.start_date) {
        const dateKey = format(parseISO(wo.start_date), 'yyyy-MM-dd');
        const existing = map.get(dateKey) || { count: 0, statuses: new Set() };
        existing.count++;
        existing.statuses.add(wo.status);
        map.set(dateKey, existing);
      }
    });
    return map;
  }, [workOrders]);

  // Get count for selected date
  const selectedDateCount = useMemo(() => {
    if (!selectedDate) return 0;
    const dateKey = format(selectedDate, 'yyyy-MM-dd');
    return workOrdersByDate.get(dateKey)?.count || 0;
  }, [selectedDate, workOrdersByDate]);

  // Custom day content to show work order indicators
  const modifiers = useMemo(() => {
    const hasWorkOrders: Date[] = [];
    const hasPlanned: Date[] = [];
    const hasInProgress: Date[] = [];
    
    workOrdersByDate.forEach((data, dateKey) => {
      const date = parseISO(dateKey);
      hasWorkOrders.push(date);
      if (data.statuses.has('planned')) hasPlanned.push(date);
      if (data.statuses.has('in_progress')) hasInProgress.push(date);
    });

    return { hasWorkOrders, hasPlanned, hasInProgress };
  }, [workOrdersByDate]);

  const modifiersStyles = {
    hasWorkOrders: {
      position: 'relative' as const,
    },
  };

  const handleSelect = (date: Date | undefined) => {
    if (date && selectedDate && isSameDay(date, selectedDate)) {
      // Clicking same date clears selection
      onSelectDate(null);
    } else {
      onSelectDate(date || null);
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className={cn("shadow-sm", className)}>
        <CollapsibleTrigger asChild>
          <CardHeader className="py-2 px-3 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-xs font-medium">
                  {language === 'nl' ? 'Kalender' : 'Calendar'}
                </CardTitle>
              </div>
              <div className="flex items-center gap-2">
                {selectedDate && (
                  <Badge variant="secondary" className="text-[10px]">
                    {format(selectedDate, 'd MMM')} ({selectedDateCount})
                  </Badge>
                )}
                {isOpen ? (
                  <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-2 px-2">
            <Calendar
              mode="single"
              selected={selectedDate || undefined}
              onSelect={handleSelect}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              className="p-0"
              classNames={{
                months: "flex flex-col",
                month: "space-y-2",
                caption: "flex justify-center pt-1 relative items-center h-8",
                caption_label: "text-xs font-semibold",
                nav: "space-x-1 flex items-center",
                nav_button: "h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100",
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-md w-8 font-medium text-[10px] uppercase",
                row: "flex w-full mt-0.5",
                cell: cn(
                  "relative h-8 w-8 text-center text-xs p-0",
                  "focus-within:relative focus-within:z-20",
                  "[&:has([aria-selected])]:bg-primary/10 [&:has([aria-selected])]:rounded-md"
                ),
                day: "h-8 w-8 p-0 font-normal aria-selected:opacity-100 hover:bg-accent hover:text-accent-foreground transition-colors rounded-md text-xs",
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground rounded-md font-medium",
                day_today: "bg-accent text-accent-foreground font-semibold",
                day_outside: "text-muted-foreground opacity-50",
                day_disabled: "text-muted-foreground opacity-50",
                day_hidden: "invisible",
              }}
              components={{
                DayContent: ({ date }) => {
                  const dateKey = format(date, 'yyyy-MM-dd');
                  const data = workOrdersByDate.get(dateKey);
                  const hasOrders = data && data.count > 0;
                  
                  return (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <span>{date.getDate()}</span>
                      {hasOrders && (
                        <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex gap-0.5">
                          {data.statuses.has('in_progress') && (
                            <span className="w-1 h-1 rounded-full bg-warning" />
                          )}
                          {data.statuses.has('planned') && (
                            <span className="w-1 h-1 rounded-full bg-info" />
                          )}
                          {!data.statuses.has('in_progress') && !data.statuses.has('planned') && (
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50" />
                          )}
                        </span>
                      )}
                    </div>
                  );
                },
              }}
            />
            
            {/* Clear filter button */}
            {selectedDate && (
              <div className="mt-2 flex justify-center">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] text-muted-foreground"
                  onClick={() => onSelectDate(null)}
                >
                  <X className="h-3 w-3 mr-1" />
                  {language === 'nl' ? 'Filter wissen' : 'Clear filter'}
                </Button>
              </div>
            )}
            
            {/* Legend */}
            <div className="mt-2 pt-2 border-t flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-info" />
                <span>{t('planned')}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                <span>{t('in_progress')}</span>
              </div>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
};
