import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'work_order_completed'
  | 'work_order_cancelled'
  | 'exact_sync_success'
  | 'exact_sync_error'
  | 'user_mentioned';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  entityType?: string;
  entityId?: string;
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
