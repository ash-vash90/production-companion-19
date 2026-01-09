import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, CheckCircle2, XCircle, Clock, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { nl, enUS } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface StepExecution {
  id: string;
  step_number: number;
  step_title: string;
  status: string;
  operator_name: string;
  operator_avatar: string | null;
  operator_initials: string | null;
  completed_at: string | null;
  measurement_values: Record<string, unknown>;
  validation_status: string | null;
  serial_number: string;
}

interface StepTimelineProps {
  stepExecutions: StepExecution[];
}

export function StepTimeline({ stepExecutions }: StepTimelineProps) {
  const { t, language } = useLanguage();
  const dateLocale = language === 'nl' ? nl : enUS;

  // Group steps by serial number
  const groupedBySerial = useMemo(() => {
    const groups: Record<string, StepExecution[]> = {};
    for (const exec of stepExecutions) {
      if (!groups[exec.serial_number]) {
        groups[exec.serial_number] = [];
      }
      groups[exec.serial_number].push(exec);
    }
    // Sort each group by step_number
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => a.step_number - b.step_number);
    }
    return groups;
  }, [stepExecutions]);

  const serialNumbers = Object.keys(groupedBySerial).sort();
  const [openItems, setOpenItems] = useState<Set<string>>(() => {
    // Open first 2 by default
    return new Set(serialNumbers.slice(0, 2));
  });

  const toggleItem = (serial: string) => {
    setOpenItems(prev => {
      const next = new Set(prev);
      if (next.has(serial)) {
        next.delete(serial);
      } else {
        next.add(serial);
      }
      return next;
    });
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const getValidationBadge = (exec: StepExecution) => {
    if (exec.validation_status === 'passed') {
      return <Badge variant="success" className="text-[10px] h-5">{t('passed')}</Badge>;
    }
    if (exec.validation_status === 'failed') {
      return <Badge variant="destructive" className="text-[10px] h-5">{t('failed')}</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] h-5 bg-info/20 text-info border-info/30">{t('completed')}</Badge>;
  };

  const getValidationIcon = (exec: StepExecution) => {
    if (exec.validation_status === 'passed') {
      return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
    }
    if (exec.validation_status === 'failed') {
      return <XCircle className="h-3.5 w-3.5 text-destructive" />;
    }
    return <CheckCircle2 className="h-3.5 w-3.5 text-info" />;
  };

  const getSummary = (steps: StepExecution[]) => {
    const passed = steps.filter(s => s.validation_status === 'passed').length;
    const failed = steps.filter(s => s.validation_status === 'failed').length;

    if (failed > 0) {
      return { color: 'text-destructive', label: `${passed} ${t('passed')}, ${failed} ${t('failed')}` };
    }
    if (passed === steps.length) {
      return { color: 'text-success', label: t('allPassed') };
    }
    return { color: 'text-muted-foreground', label: `${steps.length} ${t('stepsCompleted')}` };
  };

  if (serialNumbers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('noStepsCompleted')}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {serialNumbers.map((serial) => {
        const steps = groupedBySerial[serial];
        const isOpen = openItems.has(serial);
        const summary = getSummary(steps);

        return (
          <Collapsible
            key={serial}
            open={isOpen}
            onOpenChange={() => toggleItem(serial)}
            className="border-b border-border/50"
          >
            <CollapsibleTrigger className="w-full flex items-center justify-between py-2.5 hover:bg-muted/30 transition-colors -mx-1 px-1 rounded text-left">
              <div className="flex items-center gap-2 min-w-0">
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform flex-shrink-0",
                  isOpen && "rotate-180"
                )} />
                <Badge variant="outline" className="text-xs font-semibold">
                  {serial}
                </Badge>
                <span className={cn("text-sm", summary.color)}>
                  {summary.label}
                </span>
              </div>
              <Badge variant="secondary" className="text-[10px] h-5 flex-shrink-0">
                {steps.length}
              </Badge>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="pl-6 pb-3 space-y-2">
                {steps.map((exec) => (
                  <div key={exec.id} className="flex items-start gap-2 py-1.5">
                    <div className="mt-0.5">
                      {getValidationIcon(exec)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {exec.step_number}. {exec.step_title}
                        </span>
                        {getValidationBadge(exec)}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <Avatar className="h-4 w-4">
                          <AvatarImage src={exec.operator_avatar || undefined} />
                          <AvatarFallback className="text-[8px]">
                            {exec.operator_initials || getInitials(exec.operator_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{exec.operator_name}</span>
                        {exec.completed_at && (
                          <>
                            <Minus className="h-3 w-3" />
                            <Clock className="h-3 w-3" />
                            <span>{format(new Date(exec.completed_at), 'MMM d, HH:mm', { locale: dateLocale })}</span>
                          </>
                        )}
                      </div>

                      {/* Measurements - compact inline */}
                      {Object.keys(exec.measurement_values).length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
                          {Object.entries(exec.measurement_values).map(([key, value]) => (
                            <span key={key} className="text-muted-foreground">
                              {key}: <span className="font-semibold text-foreground">{String(value)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
