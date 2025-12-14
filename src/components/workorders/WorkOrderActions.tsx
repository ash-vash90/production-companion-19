import React from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { CheckCircle2, Pause, Play, Printer } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WorkOrderActionsProps {
  status: string;
  canManage: boolean;
  onStart?: () => void;
  onPause?: () => void;
  onComplete?: () => void;
  onPrint?: () => void;
  className?: string;
}

export function WorkOrderActions({
  status,
  canManage,
  onStart,
  onPause,
  onComplete,
  onPrint,
  className,
}: WorkOrderActionsProps) {
  const { t } = useLanguage();

  const isCompleted = status === 'completed';
  const isInProgress = status === 'in_progress';
  const isOnHold = status === 'on_hold';
  const isPlanned = status === 'planned';
  const disableManage = !canManage || isCompleted;

  const handleAction = (event: React.MouseEvent, action?: () => void) => {
    event.stopPropagation();
    action?.();
  };

  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-1.5', className)}>
      <Button
        variant="outline"
        size="sm"
        disabled={disableManage || isInProgress}
        onClick={(e) => handleAction(e, onStart)}
      >
        <Play className="h-3.5 w-3.5 mr-1" />
        {isOnHold ? t('resume') || t('start') : t('start')}
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disableManage || (!isInProgress && !isOnHold)}
        onClick={(e) => handleAction(e, onPause)}
      >
        <Pause className="h-3.5 w-3.5 mr-1" />
        {t('pause')}
      </Button>
      <Button
        variant="secondary"
        size="sm"
        disabled={disableManage || isCompleted || isPlanned}
        onClick={(e) => handleAction(e, onComplete)}
      >
        <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
        {t('complete')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={(e) => handleAction(e, onPrint)}
      >
        <Printer className="h-3.5 w-3.5 mr-1" />
        {t('print')}
      </Button>
    </div>
  );
}

