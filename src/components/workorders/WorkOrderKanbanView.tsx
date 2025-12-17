import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { WorkOrderStatusBadge, WorkOrderStatusType } from './WorkOrderStatusBadge';
import { ProductBreakdownBadges } from './ProductBreakdownBadges';
import { formatDate, ProductBreakdown } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { 
  DndContext, 
  DragEndEvent, 
  DragOverlay, 
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
} from '@dnd-kit/core';
import { 
  SortableContext, 
  useSortable, 
  verticalListSortingStrategy 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, Truck, X } from 'lucide-react';

interface WorkOrderData {
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
  progressPercent?: number;
}

interface WorkOrderKanbanViewProps {
  workOrders: WorkOrderData[];
  onStatusChange?: () => void;
  onCancel?: (workOrder: { id: string; wo_number: string }) => void;
}

const STATUS_COLUMNS: { status: WorkOrderStatusType; labelKey: string }[] = [
  { status: 'planned', labelKey: 'planned' },
  { status: 'in_progress', labelKey: 'inProgress' },
  { status: 'on_hold', labelKey: 'onHold' },
  { status: 'completed', labelKey: 'completed' },
];

interface KanbanCardProps {
  workOrder: WorkOrderData;
  onCancel?: () => void;
}

function KanbanCard({ workOrder, onCancel }: KanbanCardProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const { hasPermission } = useUserProfile();
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: workOrder.id,
    disabled: !hasPermission('change_work_order_status'),
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group bg-card border rounded-lg p-3 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/production/${workOrder.id}`)}
    >
      {/* Drag handle */}
      {hasPermission('change_work_order_status') && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-1 top-1/2 -translate-y-1/2 p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
      )}

      {/* Cancel button */}
      {onCancel && workOrder.status !== 'completed' && workOrder.status !== 'cancelled' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCancel();
          }}
          className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100 z-10"
          title={t('cancel')}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}

      <div className="pl-4">
        {/* WO Number */}
        <div className="font-mono font-semibold text-sm mb-2">{workOrder.wo_number}</div>

        {/* Product badges */}
        <div className="mb-2">
          <ProductBreakdownBadges
            breakdown={workOrder.productBreakdown}
            batchSize={workOrder.batch_size}
            compact
            maxVisible={2}
          />
        </div>

        {/* Customer */}
        {workOrder.customer_name && (
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {workOrder.customer_name}
          </div>
        )}

        {/* Dates */}
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2">
          {workOrder.start_date && (
            <div className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(workOrder.start_date)}</span>
            </div>
          )}
          {workOrder.shipping_date && (
            <div className="flex items-center gap-1">
              <Truck className="h-3 w-3" />
              <span>{formatDate(workOrder.shipping_date)}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <Progress value={workOrder.progressPercent || 0} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground">{workOrder.progressPercent || 0}%</span>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ 
  status, 
  label, 
  workOrders, 
  onCancel 
}: { 
  status: WorkOrderStatusType; 
  label: string; 
  workOrders: WorkOrderData[];
  onCancel?: (workOrder: { id: string; wo_number: string }) => void;
}) {
  return (
    <div className="flex flex-col min-w-[280px] max-w-[320px] bg-muted/30 rounded-lg">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2">
          <WorkOrderStatusBadge status={status} />
          <Badge variant="secondary" className="text-xs">{workOrders.length}</Badge>
        </div>
      </div>
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={workOrders.map(wo => wo.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 min-h-[200px]">
            {workOrders.map((wo) => (
              <KanbanCard 
                key={wo.id} 
                workOrder={wo} 
                onCancel={onCancel ? () => onCancel({ id: wo.id, wo_number: wo.wo_number }) : undefined}
              />
            ))}
          </div>
        </SortableContext>
      </ScrollArea>
    </div>
  );
}

export function WorkOrderKanbanView({ workOrders, onStatusChange, onCancel }: WorkOrderKanbanViewProps) {
  const { t } = useLanguage();
  const { hasPermission } = useUserProfile();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Group work orders by status
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, WorkOrderData[]> = {};
    STATUS_COLUMNS.forEach(col => {
      groups[col.status] = workOrders.filter(wo => wo.status === col.status);
    });
    return groups;
  }, [workOrders]);

  const activeWorkOrder = activeId ? workOrders.find(wo => wo.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !hasPermission('change_work_order_status')) return;

    const activeWO = workOrders.find(wo => wo.id === active.id);
    if (!activeWO) return;

    // Find which column we dropped into
    let newStatus: string | null = null;
    
    // Check if dropped on another card
    const overWO = workOrders.find(wo => wo.id === over.id);
    if (overWO) {
      newStatus = overWO.status;
    } else {
      // Dropped on column itself
      newStatus = over.id as string;
    }

    if (!newStatus || newStatus === activeWO.status) return;

    // Update status in database
    setIsUpdating(true);
    try {
      const updates: Record<string, any> = { status: newStatus };
      
      if (newStatus === 'in_progress' && activeWO.status === 'planned') {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('id', activeWO.id);

      if (error) throw error;

      toast.success(t('statusUpdated') || 'Status updated');
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(t('error'), { description: error.message });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="overflow-x-auto pb-4">
        <div className="flex gap-4 min-w-max">
          {STATUS_COLUMNS.map(({ status, labelKey }) => (
            <KanbanColumn
              key={status}
              status={status}
              label={t(labelKey as any)}
              workOrders={ordersByStatus[status] || []}
              onCancel={onCancel}
            />
          ))}
        </div>
      </div>

      <DragOverlay>
        {activeWorkOrder && (
          <div className="bg-card border rounded-lg p-3 shadow-lg opacity-90 w-[280px]">
            <div className="font-mono font-semibold text-sm mb-2">{activeWorkOrder.wo_number}</div>
            <ProductBreakdownBadges
              breakdown={activeWorkOrder.productBreakdown}
              batchSize={activeWorkOrder.batch_size}
              compact
              maxVisible={2}
            />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
