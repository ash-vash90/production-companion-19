import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { AlertTriangle, Clock, ChevronRight, X } from 'lucide-react';
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
  productBreakdown: ProductBreakdown[];
  isMainAssembly?: boolean;
  hasSubassemblies?: boolean;
}

interface WorkOrderCardProps {
  workOrder: WorkOrderCardData;
  onClick?: () => void;
  onCancel?: () => void;
  onHover?: () => void;
  showActions?: boolean;
  showUrgency?: boolean;
  linkTo?: string;
}

export function WorkOrderCard({
  workOrder,
  onClick,
  onCancel,
  onHover,
  showActions = true,
  showUrgency = true,
  linkTo,
}: WorkOrderCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

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

  return (
    <div
      className={`group relative rounded-lg border border-l-4 bg-card p-3 md:p-4 transition-all cursor-pointer hover:shadow-md hover:border-primary/30 ${urgencyClass}`}
      onClick={handleClick}
      onMouseEnter={onHover}
    >
      {/* Cancel button - always visible when onCancel provided */}
      {showActions && onCancel && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
        <button
          onClick={handleCancelClick}
          className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors z-10"
          title={t('cancel')}
        >
          <X className="h-4 w-4" />
        </button>
      )}

      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2 pr-6">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-mono font-semibold text-sm truncate">{workOrder.wo_number}</span>
          {shippingOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
          {startOverdue && !shippingOverdue && <Clock className="h-3.5 w-3.5 text-warning shrink-0" />}
        </div>
        <WorkOrderStatusBadge status={workOrder.status} className="shrink-0" />
      </div>

      {/* Product badges */}
      <div className="mb-2">
        <ProductBreakdownBadges
          breakdown={workOrder.productBreakdown}
          batchSize={workOrder.batch_size}
          isMainAssembly={workOrder.isMainAssembly}
          hasSubassemblies={workOrder.hasSubassemblies}
          compact
        />
      </div>

      {/* Details - compact list */}
      <div className="flex items-end justify-between gap-2">
        <div className="space-y-0.5 text-xs text-muted-foreground flex-1 min-w-0">
          {workOrder.customer_name && (
            <div className="truncate">{workOrder.customer_name}</div>
          )}
          <div className="flex items-center gap-3">
            {workOrder.shipping_date && (
              <span className={shippingOverdue ? 'text-destructive font-medium' : ''}>
                {t('ship')}: {formatDate(workOrder.shipping_date)}
              </span>
            )}
            {workOrder.order_value && (
              <span className="font-medium text-foreground">€{workOrder.order_value.toLocaleString('nl-NL')}</span>
            )}
          </div>
        </div>

        {/* Arrow indicator - always visible */}
        <ChevronRight className="h-5 w-5 text-muted-foreground/50 group-hover:text-primary transition-colors shrink-0" />
      </div>
    </div>
  );
}
