import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

export type WorkOrderStatusType = 'planned' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

const STATUS_CONFIG: Record<WorkOrderStatusType, { labelKey: string; bgClass: string; textClass: string; borderClass: string }> = {
  planned: { labelKey: 'planned', bgClass: 'bg-status-planned-bg', textClass: 'text-status-planned-foreground', borderClass: 'border-status-planned-border' },
  in_progress: { labelKey: 'inProgress', bgClass: 'bg-status-in-progress-bg', textClass: 'text-status-in-progress-foreground', borderClass: 'border-status-in-progress-border' },
  on_hold: { labelKey: 'onHold', bgClass: 'bg-status-on-hold-bg', textClass: 'text-status-on-hold-foreground', borderClass: 'border-status-on-hold-border' },
  completed: { labelKey: 'completed', bgClass: 'bg-status-completed-bg', textClass: 'text-status-completed-foreground', borderClass: 'border-status-completed-border' },
  cancelled: { labelKey: 'cancelled', bgClass: 'bg-status-cancelled-bg', textClass: 'text-status-cancelled-foreground', borderClass: 'border-status-cancelled-border' },
};

interface WorkOrderStatusBadgeProps {
  status: string;
  className?: string;
  compact?: boolean;
}

export function WorkOrderStatusBadge({ status, className, compact = false }: WorkOrderStatusBadgeProps) {
  const { t } = useLanguage();
  const config = STATUS_CONFIG[status as WorkOrderStatusType] || STATUS_CONFIG.on_hold;
  
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center font-mono font-medium uppercase tracking-wide rounded-full border-2 shadow-sm whitespace-nowrap",
        compact ? "h-7 text-[10px] px-2.5" : "h-8 text-xs px-3",
        config.bgClass,
        config.textClass,
        config.borderClass,
        className
      )}
    >
      {t(config.labelKey as any)}
    </span>
  );
}
