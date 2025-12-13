import React, { useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight, CheckCircle2, XCircle, Clock, Minus } from 'lucide-react';
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
    // Open first 3 by default
    return new Set(serialNumbers.slice(0, 3));
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
      return <Badge variant="success" className="text-xs">{t('passed')}</Badge>;
    }
    if (exec.validation_status === 'failed') {
      return <Badge variant="destructive" className="text-xs">{t('failed')}</Badge>;
    }
    // For completed steps without validation, show "Completed"
    return <Badge variant="secondary" className="text-xs bg-info/20 text-info border-info/30">{t('completed')}</Badge>;
  };

  const getValidationIcon = (exec: StepExecution) => {
    if (exec.validation_status === 'passed') {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    if (exec.validation_status === 'failed') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-info" />;
  };

  const getSummary = (steps: StepExecution[]) => {
    const passed = steps.filter(s => s.validation_status === 'passed').length;
    const failed = steps.filter(s => s.validation_status === 'failed').length;
    const other = steps.length - passed - failed;

    if (failed > 0) {
      return { color: 'text-destructive', label: `${passed} ${t('passed')}, ${failed} ${t('failed')}` };
    }
    if (passed === steps.length) {
      return { color: 'text-success', label: t('allPassed') };
    }
    return { color: 'text-info', label: `${steps.length} ${t('stepsCompleted')}` };
  };

  if (serialNumbers.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        {t('noStepsCompleted')}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
      {serialNumbers.map((serial) => {
        const steps = groupedBySerial[serial];
        const isOpen = openItems.has(serial);
        const summary = getSummary(steps);

        return (
          <Collapsible
            key={serial}
            open={isOpen}
            onOpenChange={() => toggleItem(serial)}
            className="border rounded-lg bg-card overflow-hidden"
          >
            <CollapsibleTrigger className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left">
              <div className="flex items-center gap-3 min-w-0">
                {isOpen ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
                <Badge variant="outline" className="font-mono text-xs flex-shrink-0">
                  {serial}
                </Badge>
                <span className={cn("text-sm font-medium", summary.color)}>
                  {summary.label}
                </span>
              </div>
              <Badge variant="secondary" className="text-xs flex-shrink-0">
                {steps.length} {steps.length === 1 ? t('step') : t('steps')}
              </Badge>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-0">
                {/* Timeline */}
                <div className="relative pl-6 border-l-2 border-border ml-2 space-y-4">
                  {steps.map((exec, index) => (
                    <div key={exec.id} className="relative">
                      {/* Timeline dot */}
                      <div className="absolute -left-[25px] top-1 bg-background">
                        {getValidationIcon(exec)}
                      </div>

                      <div className="pb-2">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="font-medium text-sm">
                            {t('step')} {exec.step_number}: {exec.step_title}
                          </span>
                          {getValidationBadge(exec)}
                        </div>

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

                        {/* Measurements - compact inline display */}
                        {Object.keys(exec.measurement_values).length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            {Object.entries(exec.measurement_values).map(([key, value]) => (
                              <span key={key} className="text-muted-foreground">
                                {key}: <span className="font-mono font-medium text-foreground">{String(value)}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
}
