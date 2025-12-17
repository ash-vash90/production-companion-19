import { useState } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { X, ChevronDown, Play, Pause, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { showSuccessToast, showErrorToast, showWarningToast } from '@/lib/toast-utils';
import { invalidateWorkOrdersCache } from '@/hooks/useWorkOrders';

interface BulkActionsToolbarProps {
  selectedIds: string[];
  selectedWorkOrders: Array<{ id: string; wo_number: string; status: string }>;
  onClearSelection: () => void;
  onRefresh: () => void;
  onRequestCancel?: (workOrders: Array<{ id: string; wo_number: string }>) => void;
}

export function BulkActionsToolbar({
  selectedIds,
  selectedWorkOrders,
  onClearSelection,
  onRefresh,
  onRequestCancel,
}: BulkActionsToolbarProps) {
  const { t } = useLanguage();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleBulkStatusChange = async (newStatus: string) => {
    if (newStatus === 'cancelled' && onRequestCancel) {
      // For cancellation, use the dialog
      onRequestCancel(selectedWorkOrders.map(wo => ({ id: wo.id, wo_number: wo.wo_number })));
      return;
    }

    setIsUpdating(true);
    const previousStatuses = selectedWorkOrders.map(wo => ({ id: wo.id, status: wo.status }));

    try {
      const { error } = await supabase
        .from('work_orders')
        .update({ status: newStatus as any })
        .in('id', selectedIds);

      if (error) throw error;

      invalidateWorkOrdersCache();
      
      showSuccessToast({
        title: `${selectedIds.length} work orders updated`,
        description: `Status changed to ${t(newStatus as any)}`,
        action: {
          label: 'Undo',
          onClick: async () => {
            // Revert each work order to its previous status
            for (const prev of previousStatuses) {
              await supabase
                .from('work_orders')
                .update({ status: prev.status as any })
                .eq('id', prev.id);
            }
            invalidateWorkOrdersCache();
            onRefresh();
            showSuccessToast({
              title: 'Changes reverted',
              description: `${selectedIds.length} work orders restored`,
            });
          },
        },
      });

      onClearSelection();
      onRefresh();
    } catch (error: any) {
      showErrorToast({
        title: 'Failed to update',
        description: error.message,
      });
    } finally {
      setIsUpdating(false);
    }
  };

  // Get available status transitions based on selected work orders
  const getAvailableStatuses = () => {
    const statuses = new Set(selectedWorkOrders.map(wo => wo.status));
    const availableStatuses = [
      { value: 'planned', label: t('planned'), icon: Play },
      { value: 'in_progress', label: t('in_progress'), icon: Play },
      { value: 'on_hold', label: t('on_hold'), icon: Pause },
      { value: 'completed', label: t('completed'), icon: CheckCircle2 },
      { value: 'cancelled', label: t('cancelled'), icon: XCircle },
    ];

    // Filter out statuses that all selected items already have
    return availableStatuses.filter(s => !statuses.has(s.value) || statuses.size > 1);
  };

  if (selectedIds.length === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 duration-200">
      <div className="flex items-center gap-3 bg-card border rounded-xl shadow-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-mono">
            {selectedIds.length}
          </Badge>
          <span className="text-sm text-muted-foreground">
            {t('selected')}
          </span>
        </div>

        <div className="h-6 w-px bg-border" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={isUpdating}>
              {t('changeStatus')}
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="center">
            {getAvailableStatuses().map((status) => (
              <DropdownMenuItem
                key={status.value}
                onClick={() => handleBulkStatusChange(status.value)}
                className="gap-2"
              >
                <status.icon className="h-4 w-4" />
                {status.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="sm"
          onClick={onClearSelection}
          className="text-muted-foreground"
        >
          <X className="h-4 w-4 mr-1" />
          {t('clear')}
        </Button>
      </div>
    </div>
  );
}
