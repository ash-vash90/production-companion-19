import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { Eye, AlertTriangle, Clock } from 'lucide-react';
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
  showActions?: boolean;
  showUrgency?: boolean;
  linkTo?: string;
}

export function WorkOrderCard({
  workOrder,
  onClick,
  onCancel,
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

  return (
    <div
      className={`group relative rounded-lg border border-l-4 bg-card p-3 md:p-4 transition-all cursor-pointer hover:shadow-md hover:border-primary/30 ${urgencyClass}`}
      onClick={handleClick}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-2 mb-2">
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
      <div className="space-y-0.5 text-xs text-muted-foreground">
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

      {/* Hover actions */}
      {showActions && (
        <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <Button
            variant="secondary"
            size="sm"
            className="h-7 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              if (linkTo) navigate(linkTo);
            }}
          >
            <Eye className="h-3 w-3 mr-1" />
            {t('view')}
          </Button>
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              {t('cancel')}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
