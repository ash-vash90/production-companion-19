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
} from '@/components/ui/select';
import { StatusIndicator, statusIndicatorVariants } from '@/components/ui/status-indicator';
import { Loader2, ChevronDown, CheckCircle2, Clock, Pause, XCircle, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

type WorkOrderStatus = 'planned' | 'in_progress' | 'on_hold' | 'completed' | 'cancelled';

interface WorkOrderStatusSelectProps {
  workOrderId: string;
  currentStatus: string;
  onStatusChange?: (newStatus: string) => void;
  onRequestCancel?: () => void;
  compact?: boolean;
}

const STATUS_OPTIONS: { value: WorkOrderStatus; labelKey: string; icon: React.ElementType }[] = [
  { value: 'planned', labelKey: 'planned', icon: Calendar },
  { value: 'in_progress', labelKey: 'inProgress', icon: Clock },
  { value: 'on_hold', labelKey: 'onHold', icon: Pause },
  { value: 'completed', labelKey: 'completed', icon: CheckCircle2 },
  { value: 'cancelled', labelKey: 'cancelled', icon: XCircle },
];

export function WorkOrderStatusSelect({
  workOrderId,
  currentStatus,
  onStatusChange,
  onRequestCancel,
  compact = false,
}: WorkOrderStatusSelectProps) {
  const { t, language } = useLanguage();
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
  const CurrentIcon = currentOption?.icon || Calendar;

  return (
    <Select
      value={currentStatus}
      onValueChange={handleStatusChange}
      disabled={updating}
    >
      <SelectTrigger
        className={cn(
          statusIndicatorVariants({ status: currentStatus as any, size: compact ? 'sm' : 'default' }),
          "w-auto cursor-pointer hover:opacity-90 transition-opacity",
          "[&>svg]:hidden" // Hide default chevron
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {updating ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <div className="flex items-center gap-1.5">
            <CurrentIcon className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
            <span className="whitespace-nowrap leading-none">
              {t((currentOption?.labelKey ?? currentStatus) as any)}
            </span>
            <ChevronDown className={cn(compact ? "h-3 w-3" : "h-3.5 w-3.5", "opacity-70 ml-0.5")} />
          </div>
        )}
      </SelectTrigger>
      <SelectContent 
        onClick={(e) => e.stopPropagation()}
        className="bg-popover border border-border shadow-lg z-50"
      >
        {STATUS_OPTIONS.map((option) => {
          const Icon = option.icon;
          return (
            <SelectItem 
              key={option.value} 
              value={option.value}
              className="cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <StatusIndicator 
                  status={option.value} 
                  size="sm" 
                  showIcon
                  language={language as 'en' | 'nl'}
                />
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
