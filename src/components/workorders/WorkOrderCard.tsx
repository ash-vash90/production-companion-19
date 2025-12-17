import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import { WorkOrderStatusSelect } from './WorkOrderStatusSelect';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, Clock, ChevronRight, X, Calendar, Truck } from 'lucide-react';
import { parseISO, isBefore, differenceInDays } from 'date-fns';

export interface WorkOrderCardData {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  customer_name?: string | null;
  shipping_date?: string | null;
  start_date?: string | null;
  order_value?: number | null;
  cancellation_reason?: string | null;
  productBreakdown: ProductBreakdown[];
  progressPercent?: number;
  completedItems?: number;
  totalItems?: number;
}

interface WorkOrderCardProps {
  workOrder: WorkOrderCardData;
  onClick?: () => void;
  onCancel?: () => void;
  onHover?: () => void;
  onStatusChange?: () => void;
  showActions?: boolean;
  showUrgency?: boolean;
  showStatusEdit?: boolean;
  linkTo?: string;
}

export function WorkOrderCard({
  workOrder,
  onClick,
  onCancel,
  onHover,
  onStatusChange,
  showActions = true,
  showUrgency = true,
  showStatusEdit = true,
  linkTo,
}: WorkOrderCardProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  // Urgency calculations
  const isShippingOverdue = (): boolean => {
    if (!workOrder.shipping_date || workOrder.status === 'completed') return false;
    return isBefore(parseISO(workOrder.shipping_date), new Date());
  };

  const isShippingApproaching = (): boolean => {
    if (!workOrder.shipping_date || workOrder.status === 'completed') return false;
    const daysUntil = differenceInDays(parseISO(workOrder.shipping_date), new Date());
    return daysUntil >= 0 && daysUntil <= 3;
  };

  const isStartOverdue = (): boolean => {
    if (!workOrder.start_date || workOrder.status !== 'planned') return false;
    return isBefore(parseISO(workOrder.start_date), new Date());
  };

  const isStartApproaching = (): boolean => {
    if (!workOrder.start_date || workOrder.status !== 'planned') return false;
    const daysUntil = differenceInDays(parseISO(workOrder.start_date), new Date());
    return daysUntil >= 0 && daysUntil <= 2;
  };

  const shippingOverdue = showUrgency && isShippingOverdue();
  const shippingApproaching = showUrgency && isShippingApproaching();
  const startOverdue = showUrgency && isStartOverdue();
  const startApproaching = showUrgency && isStartApproaching();

  let urgencyClass = '';
  if (shippingOverdue) urgencyClass = 'border-l-destructive bg-destructive/5';
  else if (startOverdue) urgencyClass = 'border-l-warning bg-warning/5';
  else if (shippingApproaching) urgencyClass = 'border-l-warning/50';
  else if (startApproaching) urgencyClass = 'border-l-info/50';

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (linkTo) {
      navigate(linkTo);
    }
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCancel?.();
  };

  // Progress color based on percentage
  const getProgressColor = () => {
    const percent = workOrder.progressPercent || 0;
    if (percent === 100) return 'bg-emerald-500';
    if (percent >= 50) return 'bg-blue-500';
    return 'bg-muted-foreground/30';
  };

  return (
    <div
      className={`group relative rounded-xl border border-l-4 bg-card p-4 md:p-5 transition-all cursor-pointer hover:shadow-lg hover:border-muted-foreground/30 ${urgencyClass}`}
      onClick={handleClick}
      onMouseEnter={onHover}
    >
      {/* Cancel button */}
      {showActions && onCancel && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
        <button
          onClick={handleCancelClick}
          className="absolute top-3 right-3 p-1.5 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors z-10"
          title={t('cancel')}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Header: WO Number + Status */}
      <div className="flex items-start justify-between gap-3 mb-3 pr-8">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-bold text-base md:text-lg truncate">{workOrder.wo_number}</span>
          {shippingOverdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
          {startOverdue && !shippingOverdue && <Clock className="h-4 w-4 text-warning shrink-0" />}
        </div>
        <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
          {showStatusEdit ? (
            <WorkOrderStatusSelect
              workOrderId={workOrder.id}
              currentStatus={workOrder.status}
              onStatusChange={onStatusChange}
              compact
            />
          ) : (
            <WorkOrderStatusBadge status={workOrder.status} />
          )}
        </div>
      </div>

      {/* Product badges */}
      <div className="mb-3">
        <ProductBreakdownBadges
          breakdown={workOrder.productBreakdown}
          batchSize={workOrder.batch_size}
          compact
        />
      </div>

      {/* Customer name - prominent */}
      {workOrder.customer_name && (
        <div className="mb-3">
          <span className="text-sm font-medium text-foreground">{workOrder.customer_name}</span>
        </div>
      )}

      {/* Cancellation reason */}
      {workOrder.status === 'cancelled' && workOrder.cancellation_reason && (
        <div className="mb-3 text-xs text-destructive/80 italic bg-destructive/5 px-2 py-1 rounded">
          "{workOrder.cancellation_reason}"
        </div>
      )}

      {/* Dates row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs text-muted-foreground">
        {workOrder.start_date && (
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span className={startOverdue ? 'text-warning font-medium' : ''}>
              {language === 'nl' ? 'Start' : 'Start'}: {formatDate(workOrder.start_date)}
            </span>
          </div>
        )}
        {workOrder.shipping_date && (
          <div className="flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5" />
            <span className={shippingOverdue ? 'text-destructive font-medium' : ''}>
              {language === 'nl' ? 'Verzending' : 'Ship'}: {formatDate(workOrder.shipping_date)}
            </span>
          </div>
        )}
      </div>

      {/* Bottom row: Price + Progress */}
      <div className="flex items-center justify-between gap-4">
        {/* Order value */}
        <div className="shrink-0">
          {workOrder.order_value ? (
            <span className="text-sm font-semibold text-foreground">
              €{workOrder.order_value.toLocaleString('nl-NL')}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">-</span>
          )}
        </div>

        {/* Progress bar + percentage */}
        <div className="flex-1 max-w-[180px] flex items-center gap-2">
          <Progress 
            value={workOrder.progressPercent || 0} 
            className="h-2 flex-1"
          />
          <span className="text-xs font-medium text-muted-foreground w-10 text-right">
            {workOrder.progressPercent || 0}%
          </span>
        </div>

        {/* Arrow indicator */}
        <ChevronRight className="h-5 w-5 text-muted-foreground/40 group-hover:text-primary transition-colors shrink-0" />
      </div>

      {/* Fallback status badge when user can't change status */}
      <div className="absolute top-3 right-10">
        {workOrder.status !== 'cancelled' && workOrder.status !== 'completed' && (
          <WorkOrderStatusBadge status={workOrder.status} className="hidden" />
        )}
      </div>
    </div>
  );
}
