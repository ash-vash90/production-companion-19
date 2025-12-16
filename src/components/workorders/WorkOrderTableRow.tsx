import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { TableRow, TableCell } from '@/components/ui/table';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { AlertTriangle, Clock } from 'lucide-react';
import { parseISO, isBefore, differenceInDays } from 'date-fns';

export interface WorkOrderRowData {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  completed_at?: string | null;
  customer_name?: string | null;
  shipping_date?: string | null;
  start_date?: string | null;
  order_value?: number | null;
  cancellation_reason?: string | null;
  productBreakdown: ProductBreakdown[];
  progressPercent?: number;
}

interface WorkOrderTableRowProps {
  workOrder: WorkOrderRowData;
  onClick?: () => void;
  onCancel?: () => void;
  showUrgency?: boolean;
  linkTo?: string;
  showCompletedDate?: boolean;
  actionLabel?: string;
}

export function WorkOrderTableRow({
  workOrder,
  onClick,
  onCancel,
  showUrgency = true,
  linkTo,
  showCompletedDate = false,
  actionLabel,
}: WorkOrderTableRowProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Urgency calculations
  const isShippingOverdue = (): boolean => {
    if (!workOrder.shipping_date || workOrder.status === 'completed') return false;
    return isBefore(parseISO(workOrder.shipping_date), new Date());
  };

  const isStartOverdue = (): boolean => {
    if (!workOrder.start_date || workOrder.status !== 'planned') return false;
    return isBefore(parseISO(workOrder.start_date), new Date());
  };

  const shippingOverdue = showUrgency && isShippingOverdue();
  const startOverdue = showUrgency && isStartOverdue();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (linkTo) {
      navigate(linkTo);
    }
  };

  return (
    <TableRow 
      className="cursor-pointer hover:bg-muted/50" 
      onClick={handleClick}
    >
      <TableCell className="font-mono font-semibold whitespace-nowrap">
        <div className="flex items-center gap-2">
          {workOrder.wo_number}
          {shippingOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
          {startOverdue && !shippingOverdue && <Clock className="h-3.5 w-3.5 text-warning" />}
        </div>
      </TableCell>
      <TableCell>
        <ProductBreakdownBadges
          breakdown={workOrder.productBreakdown}
          batchSize={workOrder.batch_size}
          compact
          maxVisible={2}
        />
      </TableCell>
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap hidden md:table-cell">
        {workOrder.customer_name || '-'}
      </TableCell>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <WorkOrderStatusBadge status={workOrder.status} />
          {workOrder.status === 'cancelled' && workOrder.cancellation_reason && (
            <span className="text-xs text-destructive/80 italic truncate max-w-[150px]" title={workOrder.cancellation_reason}>
              "{workOrder.cancellation_reason}"
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm whitespace-nowrap hidden lg:table-cell">
        {workOrder.shipping_date ? (
          <span className={shippingOverdue ? 'text-destructive font-medium' : ''}>
            {formatDate(workOrder.shipping_date)}
          </span>
        ) : '-'}
      </TableCell>
      {showCompletedDate && (
        <TableCell className="text-sm whitespace-nowrap">
          {workOrder.completed_at ? formatDate(workOrder.completed_at) : '-'}
        </TableCell>
      )}
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex justify-end gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            {actionLabel || t('view')}
          </Button>
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
            >
              {t('cancel')}
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}
