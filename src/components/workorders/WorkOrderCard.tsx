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
import { AlertTriangle, Clock, Calendar, Truck, UserX, CalendarClock, Eye } from 'lucide-react';
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

  let urgencyClass = '';
  if (shippingOverdue) urgencyClass = 'border-l-destructive';
  else if (startOverdue) urgencyClass = 'border-l-warning';
  else if (shippingApproaching) urgencyClass = 'border-l-warning/60';
  else if (startApproaching) urgencyClass = 'border-l-info/60';

  const handleClick = () => {
    // Always navigate directly to production page
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

  // Long press to enable selection mode on mobile (only used in selection mode)
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
    onPress: () => {
      // Do nothing on tap - navigation is handled by buttons on touch devices
    },
  });

  const isActiveWorkOrder = workOrder.status !== 'completed' && workOrder.status !== 'cancelled';
  const assignedOperators = workOrder.assignedOperators || [];
  const hasAssignedOperators = assignedOperators.length > 0;

  // Get initials from full name
  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <TooltipProvider>
      <div
        className={`group relative rounded-xl border border-l-4 bg-card transition-all hover:shadow-lg hover:border-muted-foreground/30 ${urgencyClass} ${selected ? 'ring-2 ring-primary bg-primary/5' : ''} ${!isTouch ? 'cursor-pointer' : ''}`}
        onClick={!isTouch ? handleClick : (selectable ? () => onSelectionChange?.(!selected) : undefined)}
        {...(isTouch && !selectable ? longPressHandlers : {})}
        onMouseEnter={onHover}
      >
        {/* Card content area */}
        <div className="p-4 md:p-5">
      {/* Selection checkbox */}
      {selectable && (
        <div 
          className="absolute top-3 left-3 z-10"
          onClick={handleCheckboxChange}
        >
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectionChange?.(!!checked)}
            className="h-5 w-5 border-2"
          />
        </div>
      )}

      {/* Header: WO Number + Status */}
      <div className={`flex items-start justify-between gap-3 mb-3 ${selectable ? 'pl-8' : ''}`}>
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <span className="font-mono font-bold text-base md:text-lg truncate">{workOrder.wo_number}</span>
          {shippingOverdue && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
          {startOverdue && !shippingOverdue && <Clock className="h-4 w-4 text-warning shrink-0" />}
          
          {/* Assigned operators avatars */}
          {hasAssignedOperators ? (
            <div className="flex items-center -space-x-1.5 shrink-0">
              {assignedOperators.slice(0, 3).map((operator) => (
                <Tooltip key={operator.id}>
                  <TooltipTrigger asChild>
                    <Avatar className="h-6 w-6 border-2 border-card">
                      <AvatarImage src={operator.avatar_url || undefined} alt={operator.full_name} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
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
                    <div className="h-6 w-6 rounded-full border-2 border-card bg-muted flex items-center justify-center">
                      <span className="text-[10px] font-medium text-muted-foreground">
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
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-1 text-warning border-warning/50 shrink-0">
              <UserX className="h-3 w-3" />
              Unassigned
            </Badge>
          ) : null}
        </div>
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
            <StatusIndicator status={workOrder.status as any} showIcon />
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
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
      <div className="flex items-center justify-between gap-4 mt-3">
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
            status="auto"
            className="h-2 flex-1"
          />
          <span className="text-xs font-medium text-muted-foreground w-10 text-right">
            {workOrder.progressPercent || 0}%
          </span>
        </div>
      </div>
      </div>

      {/* Action Buttons - full-width bottom section (touch devices only) */}
      {isTouch && (
        <div className="flex items-stretch border-t border-border/40">
          <button
            className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium text-foreground bg-muted/20 hover:bg-muted/40 active:bg-muted/60 transition-colors border-r border-border/40"
            onClick={(e) => {
              e.stopPropagation();
              handleClick();
            }}
          >
            <Eye className="h-5 w-5" />
            {language === 'nl' ? 'Bekijken' : 'View'}
          </button>
          {isActiveWorkOrder && (
            <button
              className="flex-1 flex items-center justify-center gap-2 py-4 text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 active:bg-primary/80 transition-colors rounded-br-xl"
              onClick={handlePlan}
            >
              <CalendarClock className="h-5 w-5" />
              {language === 'nl' ? 'Plannen' : 'Plan'}
            </button>
          )}
          {!isActiveWorkOrder && (
            <div className="flex-1" /> 
          )}
        </div>
      )}
      
      {/* Desktop: only show Plan button for active work orders (inside card content) */}
      {!isTouch && isActiveWorkOrder && (
        <div className="flex items-center gap-2 px-4 md:px-5 pb-4 md:pb-5">
          <Button
            variant={hasAssignedOperators ? "outline" : "default"}
            size="sm"
            className="h-9 text-xs gap-1.5 min-w-[90px]"
            onClick={handlePlan}
          >
            <CalendarClock className="h-3.5 w-3.5" />
            {language === 'nl' ? 'Plannen' : 'Plan'}
          </Button>
        </div>
      )}
      
      {/* Add bottom padding for cards without buttons */}
      {!isTouch && !isActiveWorkOrder && (
        <div className="pb-4 md:pb-5" />
      )}
      </div>
    </TooltipProvider>
  );
}
