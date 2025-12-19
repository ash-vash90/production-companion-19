import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { WorkOrderStatusSelect } from './WorkOrderStatusSelect';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Calendar, Truck, UserX, CalendarClock, Eye } from 'lucide-react';
import { parseISO, isBefore, differenceInDays } from 'date-fns';
import { useLongPress, useTouchDevice } from '@/hooks/useTouchDevice';

interface AssignedOperator {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

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
  assigned_to?: string | null;
  assignedOperators?: AssignedOperator[];
}

interface WorkOrderCardProps {
  workOrder: WorkOrderCardData;
  onClick?: () => void;
  onCancel?: () => void;
  onHover?: () => void;
  onStatusChange?: () => void;
  onRequestCancel?: () => void;
  onPlan?: () => void;
  showActions?: boolean;
  showUrgency?: boolean;
  showStatusEdit?: boolean;
  linkTo?: string;
  selectable?: boolean;
  selected?: boolean;
  onSelectionChange?: (selected: boolean) => void;
  onEnableSelectionMode?: () => void;
}

export function WorkOrderCard({
  workOrder,
  onClick,
  onCancel,
  onHover,
  onStatusChange,
  onRequestCancel,
  onPlan,
  showActions = true,
  showUrgency = true,
  showStatusEdit = true,
  linkTo,
  selectable = false,
  selected = false,
  onSelectionChange,
  onEnableSelectionMode,
}: WorkOrderCardProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isTouch = useTouchDevice();

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

  const handleClick = () => {
    navigate(`/production/${workOrder.id}`);
  };

  const handlePlan = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onPlan) {
      onPlan();
    } else {
      navigate(`/planner?workOrder=${workOrder.id}`);
    }
  };

  const handleCheckboxChange = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  // Long press to enable selection mode on mobile
  const longPressHandlers = useLongPress({
    delay: 500,
    onLongPress: () => {
      if (onEnableSelectionMode && !selectable) {
        onEnableSelectionMode();
        setTimeout(() => onSelectionChange?.(true), 50);
      } else if (selectable) {
        onSelectionChange?.(!selected);
      }
    },
    onPress: () => {},
  });

  const isActiveWorkOrder = workOrder.status !== 'completed' && workOrder.status !== 'cancelled';
  const assignedOperators = workOrder.assignedOperators || [];
  const hasAssignedOperators = assignedOperators.length > 0;

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <TooltipProvider>
      <div
        className={`
          group relative rounded-xl border bg-card shadow-sm
          transition-all duration-200
          hover:shadow-md hover:border-border/80
          ${selected ? 'ring-2 ring-primary bg-primary/5' : ''}
          ${!isTouch ? 'cursor-pointer' : ''}
        `}
        onClick={!isTouch ? handleClick : (selectable ? () => onSelectionChange?.(!selected) : undefined)}
        {...(isTouch && !selectable ? longPressHandlers : {})}
        onMouseEnter={onHover}
      >
        {/* Selection checkbox */}
        {selectable && (
          <div 
            className="absolute top-4 left-4 z-10"
            onClick={handleCheckboxChange}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
              className="h-5 w-5 border-2"
            />
          </div>
        )}

        {/* ========== HEADER SECTION ========== */}
        <div className={`px-5 pt-5 pb-4 ${selectable ? 'pl-12' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            {/* Left: WO ID + Meta row */}
            <div className="min-w-0 flex-1">
              {/* Primary title: Work Order ID */}
              <h3 className="font-mono font-medium text-base text-foreground truncate">
                {workOrder.wo_number}
              </h3>
              
              {/* Secondary meta row */}
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {/* Assignment status */}
                {hasAssignedOperators ? (
                  <div className="flex items-center -space-x-1">
                    {assignedOperators.slice(0, 3).map((operator) => (
                      <Tooltip key={operator.id}>
                        <TooltipTrigger asChild>
                          <Avatar className="h-5 w-5 border-2 border-card">
                            <AvatarImage src={operator.avatar_url || undefined} alt={operator.full_name} />
                            <AvatarFallback className="text-[9px] bg-muted text-muted-foreground">
                              {getInitials(operator.full_name)}
                            </AvatarFallback>
                          </Avatar>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {operator.full_name}
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {assignedOperators.length > 3 && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="h-5 w-5 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                            <span className="text-[9px] font-medium text-muted-foreground">
                              +{assignedOperators.length - 3}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">
                          {assignedOperators.slice(3).map(op => op.full_name).join(', ')}
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </div>
                ) : isActiveWorkOrder ? (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 gap-1 text-muted-foreground border-muted-foreground/30">
                    <UserX className="h-3 w-3" />
                    {language === 'nl' ? 'Niet toegewezen' : 'Unassigned'}
                  </Badge>
                ) : null}

                {/* Item chips */}
                <ProductBreakdownBadges
                  breakdown={workOrder.productBreakdown}
                  batchSize={workOrder.batch_size}
                  compact
                />
              </div>
            </div>

            {/* Right: Status pill */}
            <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
              {showStatusEdit ? (
                <WorkOrderStatusSelect
                  workOrderId={workOrder.id}
                  currentStatus={workOrder.status}
                  onStatusChange={onStatusChange}
                  onRequestCancel={onRequestCancel || onCancel}
                  compact
                />
              ) : (
                <StatusIndicator status={workOrder.status as any} showIcon size="sm" />
              )}
            </div>
          </div>
        </div>

        {/* ========== BODY SECTION ========== */}
        <div className="px-5 pb-4 space-y-3">
          {/* Description / Customer name */}
          {workOrder.customer_name && (
            <p className="text-sm text-foreground line-clamp-2">
              {workOrder.customer_name}
            </p>
          )}

          {/* Cancellation reason */}
          {workOrder.status === 'cancelled' && workOrder.cancellation_reason && (
            <div className="text-xs text-destructive/80 italic bg-destructive/5 px-2.5 py-1.5 rounded-md">
              "{workOrder.cancellation_reason}"
            </div>
          )}

          {/* Dates row */}
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {workOrder.start_date && (
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className={startOverdue ? 'text-warning font-medium' : ''}>
                  {formatDate(workOrder.start_date)}
                </span>
              </div>
            )}
            {workOrder.shipping_date && (
              <div className="flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-muted-foreground/70" />
                <span className={shippingOverdue ? 'text-destructive font-medium' : ''}>
                  {formatDate(workOrder.shipping_date)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ========== VALUE SECTION ========== */}
        <div className="px-5 pb-4">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
              {language === 'nl' ? 'Orderwaarde' : 'Order value'}
            </span>
            <span className="text-lg font-semibold text-foreground tabular-nums">
              {workOrder.order_value 
                ? `€${workOrder.order_value.toLocaleString('nl-NL')}`
                : '—'
              }
            </span>
          </div>
        </div>

        {/* ========== PROGRESS SECTION ========== */}
        <div className="px-5 pb-5">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {language === 'nl' ? 'Voortgang' : 'Execution progress'}
              </span>
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {workOrder.progressPercent || 0}%
              </span>
            </div>
            <Progress 
              value={workOrder.progressPercent || 0} 
              status="auto"
              className="h-1.5"
            />
          </div>
        </div>

        {/* ========== FOOTER / ACTIONS SECTION ========== */}
        <div className="flex items-stretch border-t border-border/50">
          {/* View button */}
          <button
            className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            <Eye className="h-4 w-4" />
            {language === 'nl' ? 'Bekijken' : 'View'}
          </button>

          {/* Plan button - only for active work orders */}
          {isActiveWorkOrder && (
            <button
              className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/80 transition-colors rounded-br-xl"
              onClick={handlePlan}
            >
              <CalendarClock className="h-4 w-4" />
              {language === 'nl' ? 'Plannen' : 'Plan'}
            </button>
          )}

          {/* Empty space for completed/cancelled orders */}
          {!isActiveWorkOrder && (
            <div className="flex-1" />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
