import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { TableRow, TableCell } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { WorkOrderStatusBadge } from './WorkOrderStatusBadge';
import { WorkOrderStatusSelect } from './WorkOrderStatusSelect';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { AlertTriangle, Clock, Calendar, Truck, Eye, X } from 'lucide-react';
import { parseISO, isBefore } from 'date-fns';

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
  onStatusChange?: () => void;
  onRequestCancel?: () => void;
  showUrgency?: boolean;
  linkTo?: string;
  showCompletedDate?: boolean;
  actionLabel?: string;
  /** Show editable status dropdown instead of badge */
  editableStatus?: boolean;
  /** Show progress bar column */
  showProgress?: boolean;
  /** Show price column */
  showPrice?: boolean;
}

export function WorkOrderTableRow({
  workOrder,
  onClick,
  onCancel,
  onStatusChange,
  onRequestCancel,
  showUrgency = true,
  linkTo,
  showCompletedDate = false,
  actionLabel,
  editableStatus = false,
  showProgress = false,
  showPrice = false,
}: WorkOrderTableRowProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

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
      {/* WO Number + Urgency icons */}
      <TableCell className="font-mono font-semibold whitespace-nowrap">
        <div className="flex items-center gap-2">
          {workOrder.wo_number}
          {shippingOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
          {startOverdue && !shippingOverdue && <Clock className="h-3.5 w-3.5 text-warning" />}
        </div>
      </TableCell>

      {/* Product breakdown */}
      <TableCell>
        <ProductBreakdownBadges
          breakdown={workOrder.productBreakdown}
          batchSize={workOrder.batch_size}
          compact
          maxVisible={2}
        />
      </TableCell>

      {/* Customer */}
      <TableCell className="text-sm text-muted-foreground whitespace-nowrap hidden md:table-cell">
        {workOrder.customer_name || '-'}
      </TableCell>

      {/* Status - editable or badge */}
      <TableCell onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col gap-0.5">
          {editableStatus ? (
            <WorkOrderStatusSelect
              workOrderId={workOrder.id}
              currentStatus={workOrder.status}
              onStatusChange={onStatusChange}
              onRequestCancel={onRequestCancel || onCancel}
              compact
            />
          ) : (
            <WorkOrderStatusBadge status={workOrder.status} />
          )}
          {workOrder.status === 'cancelled' && workOrder.cancellation_reason && (
            <span className="text-xs text-destructive/80 italic truncate max-w-[150px]" title={workOrder.cancellation_reason}>
              "{workOrder.cancellation_reason}"
            </span>
          )}
        </div>
      </TableCell>

      {/* Dates - Start & Ship */}
      <TableCell className="text-xs whitespace-nowrap hidden lg:table-cell">
        <div className="flex flex-col gap-0.5">
          {workOrder.start_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3 text-muted-foreground" />
              <span className={startOverdue ? 'text-warning font-medium' : 'text-muted-foreground'}>
                {formatDate(workOrder.start_date)}
              </span>
            </div>
          )}
          {workOrder.shipping_date && (
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3 text-muted-foreground" />
              <span className={shippingOverdue ? 'text-destructive font-medium' : 'text-muted-foreground'}>
                {formatDate(workOrder.shipping_date)}
              </span>
            </div>
          )}
          {!workOrder.start_date && !workOrder.shipping_date && '-'}
        </div>
      </TableCell>

      {/* Price */}
      {showPrice && (
        <TableCell className="text-sm whitespace-nowrap hidden xl:table-cell">
          {workOrder.order_value ? (
            <span className="font-medium">€{workOrder.order_value.toLocaleString('nl-NL')}</span>
          ) : '-'}
        </TableCell>
      )}

      {/* Progress */}
      {showProgress && (
        <TableCell className="hidden sm:table-cell">
          <div className="flex items-center gap-2 min-w-[100px]">
            <Progress value={workOrder.progressPercent || 0} className="h-2 flex-1" />
            <span className="text-xs font-medium text-muted-foreground w-8 text-right">
              {workOrder.progressPercent || 0}%
            </span>
          </div>
        </TableCell>
      )}

      {/* Completed date (for reports) */}
      {showCompletedDate && (
        <TableCell className="text-sm whitespace-nowrap">
          {workOrder.completed_at ? formatDate(workOrder.completed_at) : '-'}
        </TableCell>
      )}

      {/* Actions */}
      <TableCell className="text-right whitespace-nowrap">
        <div className="flex justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
            title={actionLabel || t('view')}
          >
            <Eye className="h-4 w-4" />
          </Button>
          {onCancel && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onCancel();
              }}
              title={t('cancel')}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </TableCell>
    </TableRow>
  );
}