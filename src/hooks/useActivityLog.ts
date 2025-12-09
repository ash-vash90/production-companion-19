import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

type EntityType = 'work_order' | 'work_order_item' | 'batch_material' | 'production_step' | 'quality_certificate';

interface LogActivityParams {
  action: string;
  entityType: EntityType;
  entityId?: string;
  details?: Record<string, unknown>;
}

/**
 * Hook for logging user activities to the activity_logs table.
 * Handles user context and error logging automatically.
 */
export function useActivityLog() {
  const { user } = useAuth();

  const logActivity = useCallback(
    async ({ action, entityType, entityId, details }: LogActivityParams) => {
      if (!user?.id) {
        console.warn('Cannot log activity: no user logged in');
        return;
      }

      try {
        const { error } = await supabase.from('activity_logs').insert([{
          user_id: user.id,
          action,
          entity_type: entityType,
          entity_id: entityId,
          details: (details || {}) as any,
        }]);

        if (error) {
          console.error('Failed to log activity:', error);
        }
      } catch (err) {
        console.error('Error logging activity:', err);
      }
    },
    [user?.id]
  );

  /**
   * Log activity without awaiting - fire and forget.
   * Use this when you don't want to block the main operation.
   */
  const logActivityAsync = useCallback(
    (params: LogActivityParams) => {
      logActivity(params);
    },
    [logActivity]
  );

  return {
    logActivity,
    logActivityAsync,
  };
}
