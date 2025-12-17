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
import { showSuccessToast, showErrorToast } from '@/lib/toast-utils';
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

  const getAvailableStatuses = () => {
    const statuses = new Set(selectedWorkOrders.map(wo => wo.status));
    const availableStatuses = [
      { value: 'planned', label: t('planned'), icon: Play },
      { value: 'in_progress', label: t('in_progress'), icon: Play },
      { value: 'on_hold', label: t('on_hold'), icon: Pause },
      { value: 'completed', label: t('completed'), icon: CheckCircle2 },
      { value: 'cancelled', label: t('cancelled'), icon: XCircle },
    ];

    return availableStatuses.filter(s => !statuses.has(s.value) || statuses.size > 1);
  };

  if (selectedIds.length === 0) return null;

  // Inline version - renders as flex items in toolbar
  return (
    <div className="flex items-center gap-2 pl-2 border-l border-border">
      <Badge variant="secondary" className="font-mono text-xs">
        {selectedIds.length} {t('selected')}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={isUpdating} className="h-8 text-xs">
            {t('changeStatus')}
            <ChevronDown className="ml-1 h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
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
        className="h-8 text-xs text-muted-foreground"
      >
        <X className="h-3.5 w-3.5 mr-1" />
        {t('clear')}
      </Button>
    </div>
  );
}
