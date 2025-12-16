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
import { Loader2 } from 'lucide-react';

type WorkOrderStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

interface WorkOrderStatusSelectProps {
  workOrderId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  compact?: boolean;
}

const STATUS_OPTIONS: { value: WorkOrderStatus; labelKey: string; color: string }[] = [
  { value: 'planned', labelKey: 'planned', color: 'text-muted-foreground' },
  { value: 'in_progress', labelKey: 'inProgress', color: 'text-blue-600' },
  { value: 'on_hold', labelKey: 'onHold', color: 'text-amber-600' },
  { value: 'completed', labelKey: 'completed', color: 'text-emerald-600' },
  { value: 'cancelled', labelKey: 'cancelled', color: 'text-destructive' },
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
        className={`${compact ? 'h-7 text-xs px-2 w-auto min-w-[100px]' : 'h-8 text-sm w-[140px]'} ${currentOption?.color || ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {updating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <SelectValue />
        )}
      </SelectTrigger>
      <SelectContent onClick={(e) => e.stopPropagation()}>
        {STATUS_OPTIONS.map((option) => (
          <SelectItem 
            key={option.value} 
            value={option.value}
            className={option.color}
          >
            {t(option.labelKey)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
