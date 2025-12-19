import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'work_order_completed'
  | 'work_order_cancelled'
  | 'exact_sync_success'
  | 'exact_sync_error'
  | 'user_mentioned';

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
  priority?: NotificationPriority;
  sendPush?: boolean;
  emailData?: Record<string, unknown>;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .insert({
      user_id: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      entity_type: params.entityType,
      entity_id: params.entityId,
    });

  if (error) {
    console.error('Failed to create notification:', error);
  }

  // Send email notification if email data is provided
  if (params.emailData) {
    try {
      await sendEmailNotification(params.userId, params.type, params.emailData);
    } catch (emailError) {
      console.error('Failed to send email notification:', emailError);
    }
  }
}

/**
 * Send email notification via edge function
 */
async function sendEmailNotification(
  userId: string,
  type: NotificationType,
  data: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.functions.invoke('send-email', {
    body: { userId, type, data },
  });

  if (error) {
    console.error('Email notification failed:', error);
  }
}

export async function notifyWorkOrderCompleted(
  userId: string,
  woNumber: string,
  workOrderId: string
): Promise<void> {
  await createNotification({
    userId,
    type: 'work_order_completed',
    title: 'Work Order Completed',
    message: `Work order ${woNumber} has been completed.`,
    entityType: 'work_order',
    entityId: workOrderId,
  });
}

export async function notifyWorkOrderCancelled(
  userId: string,
  woNumber: string,
  workOrderId: string
): Promise<void> {
  await createNotification({
    userId,
    type: 'work_order_cancelled',
    title: 'Work Order Cancelled',
    message: `Work order ${woNumber} has been cancelled.`,
    entityType: 'work_order',
    entityId: workOrderId,
  });
}

export async function notifyExactSyncSuccess(
  userId: string,
  woNumber: string,
  workOrderId: string
): Promise<void> {
  await createNotification({
    userId,
    type: 'exact_sync_success',
    title: 'Exact Sync Successful',
    message: `Work order ${woNumber} has been synced with Exact.`,
    entityType: 'work_order',
    entityId: workOrderId,
  });
}

export async function notifyExactSyncError(
  userId: string,
  woNumber: string,
  workOrderId: string,
  errorMessage?: string
): Promise<void> {
  await createNotification({
    userId,
    type: 'exact_sync_error',
    title: 'Exact Sync Failed',
    message: `Failed to sync work order ${woNumber} with Exact.${errorMessage ? ` Error: ${errorMessage}` : ''}`,
    entityType: 'work_order',
    entityId: workOrderId,
  });
}

/**
 * Get all users subscribed to a notification type
 */
export async function getNotificationSubscribers(
  notificationType: NotificationType
): Promise<string[]> {
  // For now, return all admin/supervisor users for work order notifications
  // In the future, this could be based on user preferences
  if (['work_order_completed', 'work_order_cancelled'].includes(notificationType)) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or('role.eq.admin,role.eq.supervisor');
    return data?.map(u => u.id) || [];
  }

  return [];
}
