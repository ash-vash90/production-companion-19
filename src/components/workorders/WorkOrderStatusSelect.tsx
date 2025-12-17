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
  compact?: boolean;
}

const STATUS_OPTIONS: { value: WorkOrderStatus; labelKey: string; bgClass: string; textClass: string }[] = [
  { value: 'planned', labelKey: 'planned', bgClass: 'bg-sky-500/15 dark:bg-sky-500/20', textClass: 'text-sky-700 dark:text-sky-300' },
  { value: 'in_progress', labelKey: 'inProgress', bgClass: 'bg-amber-500/15 dark:bg-amber-500/20', textClass: 'text-amber-700 dark:text-amber-300' },
  { value: 'on_hold', labelKey: 'onHold', bgClass: 'bg-secondary', textClass: 'text-secondary-foreground' },
  { value: 'completed', labelKey: 'completed', bgClass: 'bg-emerald-500/15 dark:bg-emerald-500/20', textClass: 'text-emerald-700 dark:text-emerald-300' },
  { value: 'cancelled', labelKey: 'cancelled', bgClass: 'bg-destructive/15 dark:bg-destructive/20', textClass: 'text-destructive dark:text-red-300' },
];

export function WorkOrderStatusSelect({
  workOrderId,
  currentStatus,
  onStatusChange,
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

      toast.success(t('statusUpdated') || 'Status updated');
      onStatusChange?.(newStatus);
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error(t('error'), { description: error.message });
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
          "border-0 font-medium transition-colors",
          compact ? "h-6 text-xs px-2 py-0 w-auto min-w-[90px]" : "h-7 text-xs px-2.5 py-0 w-auto min-w-[100px]",
          "rounded-full",
          currentOption?.bgClass,
          currentOption?.textClass,
          "hover:opacity-80",
          "[&>svg]:hidden" // Hide default chevron
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {updating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <span className="flex items-center gap-1">
            <SelectValue />
            <ChevronDown className="h-3 w-3 opacity-60" />
          </span>
        )}
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={cn("text-xs", option.textClass)}
          >
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
