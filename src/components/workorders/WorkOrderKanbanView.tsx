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
  DragOverEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from '@dnd-kit/core';
import { 
  SortableContext, 
  useSortable, 
  verticalListSortingStrategy,
  arrayMove 
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, Truck } from 'lucide-react';

// Haptic feedback utility
const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
  if ('vibrate' in navigator) {
    const patterns = { light: 10, medium: 20, heavy: 40 };
    navigator.vibrate(patterns[type]);
  }
};

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
}

function KanbanCard({ workOrder }: KanbanCardProps) {
  const navigate = useNavigate();
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
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1), opacity 200ms ease',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative group bg-card border rounded-lg p-4 cursor-pointer hover:shadow-md transition-all duration-200 ${
        isDragging ? 'shadow-lg scale-[1.02] z-50' : ''
      }`}
      onClick={() => navigate(`/production/${workOrder.id}`)}
    >
      {/* Drag handle */}
      {hasPermission('change_work_order_status') && (
        <div
          {...attributes}
          {...listeners}
          className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity touch:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
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

        {/* Price + Progress */}
        <div className="flex items-center justify-between gap-4">
          <div className="shrink-0">
            {workOrder.order_value ? (
              <span className="text-sm font-semibold text-foreground">
                €{workOrder.order_value.toLocaleString('nl-NL')}
              </span>
            ) : (
              <span className="text-sm text-muted-foreground">-</span>
            )}
          </div>
          <div className="flex-1 flex items-center gap-2">
            <Progress value={workOrder.progressPercent || 0} className="h-1.5 flex-1" />
            <span className="text-xs text-muted-foreground font-medium">{workOrder.progressPercent || 0}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function KanbanColumn({ 
  status, 
  workOrders, 
  columnOrders,
  onReorder,
  isOver,
  isDragging,
}: { 
  status: KanbanStatus; 
  workOrders: WorkOrderData[];
  columnOrders: Record<string, string[]>;
  onReorder: (status: string, newOrder: string[]) => void;
  isOver?: boolean;
  isDragging?: boolean;
}) {
  const { t } = useLanguage();
  const headerStyles = STATUS_HEADER_STYLES[status];
  
  // Make column a drop target
  const { setNodeRef } = useDroppable({
    id: status,
  });

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
    <div 
      ref={setNodeRef}
      className={`flex flex-col flex-1 min-w-[200px] rounded-lg overflow-hidden transition-all duration-200 ${
        isOver 
          ? 'bg-primary/10 ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.02]' 
          : isDragging 
            ? 'bg-muted/50' 
            : 'bg-muted/30'
      }`}
    >
      {/* Fully colored header */}
      <div className={`flex items-center justify-between px-3 py-2.5 ${headerStyles.bg} ${headerStyles.border} border-b transition-all duration-200 ${
        isOver ? 'opacity-100' : ''
      }`}>
        <span className={`font-mono font-semibold text-sm ${headerStyles.text}`}>
          {t(status === 'in_progress' ? 'inProgress' : status)}
        </span>
        <span className={`font-mono text-xs px-2 py-0.5 rounded-full ${headerStyles.bg} ${headerStyles.text} border ${headerStyles.border}`}>
          {workOrders.length}
        </span>
      </div>
      <ScrollArea className="flex-1 p-2">
        <SortableContext items={orderedWorkOrders.map(wo => wo.id)} strategy={verticalListSortingStrategy}>
          <div className={`space-y-3 min-h-[200px] transition-all duration-200 ${
            isOver ? 'opacity-90' : ''
          }`}>
            {orderedWorkOrders.map((wo) => (
              <KanbanCard 
                key={wo.id} 
                workOrder={wo} 
              />
            ))}
            {/* Drop indicator when hovering empty area */}
            {isOver && orderedWorkOrders.length === 0 && (
              <div className="h-20 border-2 border-dashed border-primary/50 rounded-lg bg-primary/5 flex items-center justify-center">
                <span className="text-sm text-primary/70 font-medium">{t('dropHere') || 'Drop here'}</span>
              </div>
            )}
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
  const [overId, setOverId] = useState<string | null>(null);
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

  // Determine which column is being hovered
  const getHoveredColumn = (overId: string | null): string | null => {
    if (!overId) return null;
    // Check if it's a column ID
    if (ALL_STATUS_COLUMNS.some(col => col.status === overId)) {
      return overId;
    }
    // Check if it's a card ID - find which column it belongs to
    const overWO = workOrders.find(wo => wo.id === overId);
    return overWO?.status || null;
  };

  const hoveredColumn = getHoveredColumn(overId);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    triggerHaptic('light');
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
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
    setOverId(null);
    triggerHaptic('medium');

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

    const previousStatus = activeWO.status;

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

      // Create undo function
      const undoStatusChange = async () => {
        try {
          const { error: undoError } = await supabase
            .from('work_orders')
            .update({ status: previousStatus as 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled' })
            .eq('id', activeWO.id);

          if (undoError) throw undoError;
          
          toast.success('Status reverted', { 
            description: `${activeWO.wo_number} back to ${previousStatus.replace('_', ' ')}` 
          });
          onStatusChange?.();
        } catch (err) {
          toast.error('Failed to undo', { description: 'Could not revert status change' });
        }
      };

      toast.success(`${activeWO.wo_number} updated`, { 
        description: `Status changed to ${newStatus.replace('_', ' ')}`,
        action: {
          label: 'Undo',
          onClick: undoStatusChange,
        },
        duration: 5000,
      });
      onStatusChange?.();
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status', { description: error.message });
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
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 w-full">
            {visibleColumns.map(({ status }) => (
              <KanbanColumn
                key={status}
                status={status}
                workOrders={ordersByStatus[status] || []}
                columnOrders={columnOrders}
                onReorder={handleReorder}
                isOver={hoveredColumn === status}
                isDragging={!!activeId}
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
