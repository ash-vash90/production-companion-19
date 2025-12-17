import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
  verticalListSortingStrategy,
  arrayMove 
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

type KanbanStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

interface WorkOrderKanbanViewProps {
  workOrders: WorkOrderData[];
  onStatusChange?: () => void;
  onCancel?: (workOrder: { id: string; wo_number: string }) => void;
}

const ALL_STATUS_COLUMNS: { status: KanbanStatus; labelKey: string }[] = [
  { status: 'planned', labelKey: 'planned' },
  { status: 'in_progress', labelKey: 'inProgress' },
  { status: 'on_hold', labelKey: 'onHold' },
  { status: 'completed', labelKey: 'completed' },
  { status: 'cancelled', labelKey: 'cancelled' },
];

// Full-color header styles for each status (matching badge colors)
const STATUS_HEADER_STYLES: Record<KanbanStatus, { bg: string; text: string; border: string }> = {
  planned: { 
    bg: 'bg-sky-500/20 dark:bg-sky-500/30', 
    text: 'text-sky-800 dark:text-sky-200',
    border: 'border-sky-500/30'
  },
  in_progress: { 
    bg: 'bg-amber-500/20 dark:bg-amber-500/30', 
    text: 'text-amber-800 dark:text-amber-200',
    border: 'border-amber-500/30'
  },
  on_hold: { 
    bg: 'bg-secondary', 
    text: 'text-secondary-foreground',
    border: 'border-secondary'
  },
  completed: { 
    bg: 'bg-emerald-500/20 dark:bg-emerald-500/30', 
    text: 'text-emerald-800 dark:text-emerald-200',
    border: 'border-emerald-500/30'
  },
  cancelled: { 
    bg: 'bg-destructive/20 dark:bg-destructive/30', 
    text: 'text-destructive dark:text-red-300',
    border: 'border-destructive/30'
  },
};

const VISIBILITY_STORAGE_KEY = 'kanban_column_visibility';

interface KanbanCardProps {
  workOrder: WorkOrderData;
  onCancel?: () => void;
}

function KanbanCard({ workOrder, onCancel }: KanbanCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();
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
      className="relative group bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow"
      onClick={() => navigate(`/production/${workOrder.id}`)}
    >
      {/* Drag handle */}
      {hasPermission('change_work_order_status') && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity"
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

      <div className="pl-5">
        {/* WO Number */}
        <div className="font-mono font-semibold text-sm mb-3">{workOrder.wo_number}</div>

        {/* Product badges */}
        <div className="mb-3">
          <ProductBreakdownBadges
            breakdown={workOrder.productBreakdown}
            batchSize={workOrder.batch_size}
            compact
            maxVisible={2}
          />
        </div>

        {/* Customer */}
        {workOrder.customer_name && (
          <div className="text-sm text-foreground font-medium mb-3 truncate">
            {workOrder.customer_name}
          </div>
        )}

        {/* Dates */}
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
          {workOrder.start_date && (
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(workOrder.start_date)}</span>
            </div>
          )}
          {workOrder.shipping_date && (
            <div className="flex items-center gap-1.5">
              <Truck className="h-3 w-3" />
              <span>{formatDate(workOrder.shipping_date)}</span>
            </div>
          )}
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2">
          <Progress value={workOrder.progressPercent || 0} className="h-1.5 flex-1" />
          <span className="text-xs text-muted-foreground font-medium">{workOrder.progressPercent || 0}%</span>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ 
  status, 
  workOrders, 
  onCancel,
  columnOrders,
  onReorder,
}: { 
  status: KanbanStatus; 
  workOrders: WorkOrderData[];
  onCancel?: (workOrder: { id: string; wo_number: string }) => void;
  columnOrders: Record<string, string[]>;
  onReorder: (status: string, newOrder: string[]) => void;
}) {
  const { t } = useLanguage();
  const headerStyles = STATUS_HEADER_STYLES[status];

  // Apply custom ordering if exists
  const orderedWorkOrders = useMemo(() => {
    const customOrder = columnOrders[status];
    if (!customOrder || customOrder.length === 0) return workOrders;
    
    const orderMap = new Map(customOrder.map((id, index) => [id, index]));
    return [...workOrders].sort((a, b) => {
      const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER;
      const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER;
      return aIndex - bIndex;
    });
  }, [workOrders, columnOrders, status]);

  return (
    <div className="flex flex-col flex-1 min-w-[200px] bg-muted/30 rounded-lg overflow-hidden">
      {/* Fully colored header */}
      <div className={`flex items-center justify-between px-3 py-2.5 ${headerStyles.bg} ${headerStyles.border} border-b`}>
        <span className={`font-mono font-semibold text-sm ${headerStyles.text}`}>
          {t(status === 'in_progress' ? 'inProgress' : status)}
        </span>
        <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${headerStyles.bg} ${headerStyles.text} border ${headerStyles.border}`}>
          {workOrders.length}
        </span>
      </div>
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={orderedWorkOrders.map(wo => wo.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-3 min-h-[200px]">
            {orderedWorkOrders.map((wo) => (
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
  
  // Column visibility state with localStorage persistence
  const [showCompleted, setShowCompleted] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.showCompleted ?? true;
      }
    } catch {}
    return true;
  });
  
  const [showCancelled, setShowCancelled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(VISIBILITY_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return parsed.showCancelled ?? false;
      }
    } catch {}
    return false;
  });

  // Column reordering state (session-local)
  const [columnOrders, setColumnOrders] = useState<Record<string, string[]>>({});

  // Persist visibility preferences
  useEffect(() => {
    localStorage.setItem(VISIBILITY_STORAGE_KEY, JSON.stringify({ showCompleted, showCancelled }));
  }, [showCompleted, showCancelled]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  // Filter visible columns based on toggles
  const visibleColumns = useMemo(() => {
    return ALL_STATUS_COLUMNS.filter(col => {
      if (col.status === 'completed' && !showCompleted) return false;
      if (col.status === 'cancelled' && !showCancelled) return false;
      return true;
    });
  }, [showCompleted, showCancelled]);

  // Group work orders by status
  const ordersByStatus = useMemo(() => {
    const groups: Record<string, WorkOrderData[]> = {};
    ALL_STATUS_COLUMNS.forEach(col => {
      groups[col.status] = workOrders.filter(wo => wo.status === col.status);
    });
    return groups;
  }, [workOrders]);

  const activeWorkOrder = activeId ? workOrders.find(wo => wo.id === activeId) : null;

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleReorder = (status: string, newOrder: string[]) => {
    setColumnOrders(prev => ({
      ...prev,
      [status]: newOrder
    }));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !hasPermission('change_work_order_status')) return;

    const activeWO = workOrders.find(wo => wo.id === active.id);
    if (!activeWO) return;

    // Find which column we dropped into
    let newStatus: string | null = null;
    let overWO: WorkOrderData | undefined;
    
    // Check if dropped on another card
    overWO = workOrders.find(wo => wo.id === over.id);
    if (overWO) {
      newStatus = overWO.status;
    } else {
      // Dropped on column itself
      newStatus = over.id as string;
    }

    if (!newStatus) return;

    // Same column - reorder
    if (newStatus === activeWO.status) {
      const currentOrders = ordersByStatus[activeWO.status] || [];
      const customOrder = columnOrders[activeWO.status] || currentOrders.map(wo => wo.id);
      
      const oldIndex = customOrder.indexOf(active.id as string);
      const newIndex = overWO ? customOrder.indexOf(overWO.id) : customOrder.length;
      
      if (oldIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(customOrder, oldIndex, newIndex);
        handleReorder(activeWO.status, reordered);
      }
      return;
    }

    // Different column - change status
    // Intercept cancellation to show dialog
    if (newStatus === 'cancelled') {
      if (onCancel) {
        onCancel({ id: activeWO.id, wo_number: activeWO.wo_number });
      }
      return;
    }

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
    <div className="space-y-3">
      {/* Visibility toggles */}
      <div className="flex items-center gap-6 text-sm">
        <div className="flex items-center gap-2">
          <Switch
            id="show-completed"
            checked={showCompleted}
            onCheckedChange={setShowCompleted}
          />
          <Label htmlFor="show-completed" className="text-sm font-normal cursor-pointer">
            {t('showCompleted') || 'Show Completed'}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            id="show-cancelled"
            checked={showCancelled}
            onCheckedChange={setShowCancelled}
          />
          <Label htmlFor="show-cancelled" className="text-sm font-normal cursor-pointer">
            {t('showCancelled') || 'Show Cancelled'}
          </Label>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 w-full">
            {visibleColumns.map(({ status }) => (
              <KanbanColumn
                key={status}
                status={status}
                workOrders={ordersByStatus[status] || []}
                onCancel={onCancel}
                columnOrders={columnOrders}
                onReorder={handleReorder}
              />
            ))}
          </div>
        </div>

        <DragOverlay>
          {activeWorkOrder && (
            <div className="bg-card border rounded-lg p-4 shadow-lg opacity-90 w-[220px]">
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
    </div>
  );
}
