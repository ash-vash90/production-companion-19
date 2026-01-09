import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { StatusIndicator } from '@/components/ui/status-indicator';
import { WorkOrderStatusSelect } from './WorkOrderStatusSelect';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';
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
  variant?: 'default' | 'compact';
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
  variant = 'default',
}: WorkOrderCardProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const isTouch = useTouchDevice();
  const isCompact = variant === 'compact';

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
  const startOverdue = showUrgency && isStartOverdue();

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

  // Compact variant
  if (isCompact) {
    return (
      <TooltipProvider>
        <div
          className={`
            group relative rounded-lg border bg-card shadow-sm
            transition-all duration-200 ease-out
            hover:shadow-md hover:border-border/80 hover:-translate-y-0.5
            ${selected ? 'ring-2 ring-primary bg-primary/5' : ''}
            cursor-pointer
          `}
          onClick={handleClick}
          onMouseEnter={onHover}
        >
          <div className="p-3">
            {/* Header row */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-semibold text-sm text-foreground truncate">
                {workOrder.wo_number}
              </span>
              <StatusIndicator status={workOrder.status as any} size="sm" />
            </div>

            {/* Customer */}
            {workOrder.customer_name && (
              <p className="text-xs text-muted-foreground truncate mb-2">
                {workOrder.customer_name}
              </p>
            )}

            {/* Progress */}
            <div className="flex items-center gap-2">
              <Progress 
                value={workOrder.progressPercent || 0} 
                status="auto"
                className="h-1 flex-1"
              />
              <span className="text-[10px] font-medium text-muted-foreground tabular-nums w-8 text-right">
                {workOrder.progressPercent || 0}%
              </span>
            </div>
          </div>
        </div>
      </TooltipProvider>
    );
  }

  // Default variant
  return (
    <TooltipProvider>
      <div
        className={`
          group relative rounded-xl border bg-card shadow-sm
          flex flex-col h-full
          transition-all duration-200 ease-out
          hover:shadow-lg hover:border-border/80 hover:-translate-y-0.5
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

        {/* ========== CONTENT WRAPPER - grows to fill space ========== */}
        <div className="flex-1 flex flex-col">
          {/* ========== HEADER SECTION ========== */}
          <div className={`px-5 pt-4 pb-3 ${selectable ? 'pl-12' : ''}`}>
            <div className="flex items-start justify-between gap-3">
              {/* Left: WO ID + Meta row */}
              <div className="min-w-0 flex-1">
                {/* Primary title: Work Order ID */}
                <h3 className="font-semibold text-base text-foreground truncate">
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

              {/* Right: Status pill - reduced padding */}
              <div className="shrink-0 [&_.status-indicator]:py-0.5 [&_.status-indicator]:px-2" onClick={(e) => e.stopPropagation()}>
                {showStatusEdit ? (
                  <WorkOrderStatusSelect
                    workOrderId={workOrder.id}
                    currentStatus={workOrder.status}
                    onStatusChange={onStatusChange}
                    onRequestCancel={onRequestCancel || onCancel}
                    compact
                  />
                ) : (
                  <StatusIndicator status={workOrder.status as any} showIcon size="sm" className="status-indicator" />
                )}
              </div>
            </div>
          </div>

          {/* ========== BODY SECTION ========== */}
          <div className="px-5 pb-3 space-y-2 flex-1">
            {/* Description / Customer name */}
            {workOrder.customer_name && (
              <p className="text-sm text-foreground line-clamp-1">
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

          {/* ========== ITEMS COUNT SECTION ========== */}
          <div className="px-5 pb-3">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground mb-0.5">
                {language === 'nl' ? 'Items' : 'Items'}
              </span>
              <span className="text-lg font-semibold text-foreground tabular-nums">
                {workOrder.completedItems !== undefined && workOrder.totalItems !== undefined
                  ? `${workOrder.completedItems}/${workOrder.totalItems}`
                  : workOrder.batch_size
                }
              </span>
            </div>
          </div>

          {/* ========== PROGRESS SECTION ========== */}
          <div className="px-5 pb-4">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  {language === 'nl' ? 'Voortgang' : 'Progress'}
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
        </div>

        {/* ========== FOOTER / ACTIONS SECTION - Always at bottom ========== */}
        <div className="flex items-stretch border-t border-border/50 mt-auto">
          {/* View button */}
          <button
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted transition-colors rounded-bl-xl"
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
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/80 transition-colors rounded-br-xl"
              onClick={handlePlan}
            >
              <CalendarClock className="h-4 w-4" />
              {language === 'nl' ? 'Plannen' : 'Plan'}
            </button>
          )}

          {/* Empty space for completed/cancelled orders */}
          {!isActiveWorkOrder && (
            <div className="flex-1 rounded-br-xl" />
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

// ========== SKELETON LOADING STATE ==========
export function WorkOrderCardSkeleton({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  if (variant === 'compact') {
    return (
      <div className="rounded-lg border bg-card shadow-sm p-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-32 mb-2" />
        <Skeleton className="h-1 w-full" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card shadow-sm flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <Skeleton className="h-5 w-32 mb-2" />
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-4 w-16 rounded" />
            </div>
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>

      {/* Body */}
      <div className="px-5 pb-3 flex-1">
        <Skeleton className="h-4 w-40 mb-2" />
        <div className="flex gap-4">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Value */}
      <div className="px-5 pb-3">
        <Skeleton className="h-3 w-16 mb-1" />
        <Skeleton className="h-6 w-24" />
      </div>

      {/* Progress */}
      <div className="px-5 pb-4">
        <div className="flex justify-between mb-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-1.5 w-full" />
      </div>

      {/* Footer */}
      <div className="flex items-stretch border-t border-border/50 mt-auto">
        <div className="flex-1 py-2.5 flex justify-center">
          <Skeleton className="h-5 w-16" />
        </div>
        <div className="flex-1 py-2.5 flex justify-center bg-muted/30 rounded-br-xl">
          <Skeleton className="h-5 w-14" />
        </div>
      </div>
    </div>
  );
}
