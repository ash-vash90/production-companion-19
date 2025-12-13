import { Badge } from '@/components/ui/badge';
import { useLanguage } from '@/contexts/LanguageContext';

export type WorkOrderStatusType = 'planned' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

const STATUS_VARIANTS: Record<WorkOrderStatusType, 'success' | 'warning' | 'info' | 'secondary' | 'destructive'> = {
  planned: 'info',
  in_progress: 'warning',
  completed: 'success',
  on_hold: 'secondary',
  cancelled: 'destructive',
};

interface WorkOrderStatusBadgeProps {
  status: string;
  className?: string;
}

export function WorkOrderStatusBadge({ status, className }: WorkOrderStatusBadgeProps) {
  const { t } = useLanguage();
  const variant = STATUS_VARIANTS[status as WorkOrderStatusType] || 'secondary';
  
  return (
    <Badge variant={variant} className={className}>
      {t(status as any)}
    </Badge>
  );
}
