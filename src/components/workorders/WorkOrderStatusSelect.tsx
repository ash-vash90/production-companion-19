import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/contexts/LanguageContext';
import { useUserProfile } from '@/contexts/UserProfileContext';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type WorkOrderStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

interface WorkOrderStatusSelectProps {
  workOrderId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  onRequestCancel?: () => void;
  compact?: boolean;
}

const STATUS_OPTIONS: { value: WorkOrderStatus; labelKey: string; bgClass: string; textClass: string; borderClass: string }[] = [
  { value: 'planned', labelKey: 'planned', bgClass: 'bg-sky-500/15 dark:bg-sky-500/25', textClass: 'text-sky-700 dark:text-sky-300', borderClass: 'border-sky-500/40 dark:border-sky-400/50' },
  { value: 'in_progress', labelKey: 'inProgress', bgClass: 'bg-amber-500/15 dark:bg-amber-500/25', textClass: 'text-amber-700 dark:text-amber-300', borderClass: 'border-amber-500/40 dark:border-amber-400/50' },
  { value: 'on_hold', labelKey: 'onHold', bgClass: 'bg-secondary', textClass: 'text-secondary-foreground', borderClass: 'border-border' },
  { value: 'completed', labelKey: 'completed', bgClass: 'bg-emerald-500/15 dark:bg-emerald-500/25', textClass: 'text-emerald-700 dark:text-emerald-300', borderClass: 'border-emerald-500/40 dark:border-emerald-400/50' },
  { value: 'cancelled', labelKey: 'cancelled', bgClass: 'bg-destructive/15 dark:bg-destructive/25', textClass: 'text-destructive dark:text-red-300', borderClass: 'border-destructive/40 dark:border-red-400/50' },
];

export function WorkOrderStatusSelect({
  workOrderId,
  currentStatus,
  onStatusChange,
  onRequestCancel,
  compact = false,
}: WorkOrderStatusSelectProps) {
  const { t } = useLanguage();
  const { hasPermission } = useUserProfile();
  const [updating, setUpdating] = useState(false);

  const canChangeStatus = hasPermission('change_work_order_status');

  if (!canChangeStatus) {
    return null;
  }

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus) return;
    
    // Intercept cancellation to show dialog
    if (newStatus === 'cancelled' && onRequestCancel) {
      onRequestCancel();
      return;
    }

    const previousStatus = currentStatus;

    setUpdating(true);
    try {
      const updates: Record<string, any> = { status: newStatus };
      
      // Set timestamps based on status transition
      if (newStatus === 'in_progress' && currentStatus === 'planned') {
        updates.started_at = new Date().toISOString();
      } else if (newStatus === 'completed') {
        updates.completed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updates)
        .eq('id', workOrderId);

      if (error) throw error;

      // Create undo function
      const undoStatusChange = async () => {
        try {
          const { error: undoError } = await supabase
            .from('work_orders')
            .update({ status: previousStatus as WorkOrderStatus })
            .eq('id', workOrderId);

          if (undoError) throw undoError;
          
          toast.success('Status reverted', { 
            description: `Changed back to ${previousStatus.replace('_', ' ')}` 
          });
          onStatusChange?.(previousStatus);
        } catch (err) {
          toast.error('Failed to undo', { description: 'Could not revert status change' });
        }
      };

      toast.success('Status updated', { 
        description: `Changed to ${newStatus.replace('_', ' ')}`,
        action: {
          label: 'Undo',
          onClick: undoStatusChange,
        },
        duration: 5000,
      });
      onStatusChange?.(newStatus);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status', { description: error.message });
    } finally {
      setUpdating(false);
    }
  };

  const currentOption = STATUS_OPTIONS.find(s => s.value === currentStatus);

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={updating}
    >
      <SelectTrigger
        className={cn(
          "border-2 shadow-sm hover:shadow-md font-mono font-medium uppercase tracking-wide transition-colors shrink-0",
          compact ? "h-7 text-[10px] px-2.5 py-0" : "h-8 text-xs px-3 py-0",
          "w-auto rounded-full",
          currentOption?.bgClass,
          currentOption?.textClass,
          currentOption?.borderClass,
          "hover:opacity-90",
          "[&>svg]:hidden"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {updating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <div className="flex items-center gap-2">
            <span className="whitespace-nowrap leading-none">
              {t((currentOption?.labelKey ?? currentStatus) as any)}
            </span>
            <ChevronDown className={cn("h-5 w-5 shrink-0 opacity-90", currentOption?.textClass)} />
          </div>
        )}
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={cn("text-xs font-mono font-medium uppercase tracking-wide", option.textClass)}
          >
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
