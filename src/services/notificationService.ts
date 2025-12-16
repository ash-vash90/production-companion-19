import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'work_order_completed'
  | 'work_order_cancelled'
  | 'exact_sync_success'
  | 'exact_sync_error'
  | 'user_mentioned'
  | 'low_stock_alert'
  | 'stock_consumed'
  | 'material_out_of_stock';

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
 * Notify about low stock level
 */
export async function notifyLowStock(
  userId: string,
  materialName: string,
  materialId: string,
  currentQuantity: number,
  reorderPoint: number
): Promise<void> {
  await createNotification({
    userId,
    type: 'low_stock_alert',
    title: 'Low Stock Alert',
    message: `${materialName} is running low. Current: ${currentQuantity}, Reorder point: ${reorderPoint}`,
    entityType: 'material',
    entityId: materialId,
    priority: 'high',
    sendPush: true,
  });
}

/**
 * Notify about material out of stock
 */
export async function notifyOutOfStock(
  userId: string,
  materialName: string,
  materialId: string
): Promise<void> {
  await createNotification({
    userId,
    type: 'material_out_of_stock',
    title: 'Out of Stock!',
    message: `${materialName} is now out of stock. Reorder immediately.`,
    entityType: 'material',
    entityId: materialId,
    priority: 'urgent',
    sendPush: true,
  });
}

/**
 * Check inventory levels and send low stock notifications
 * Called after stock consumption
 */
export async function checkAndNotifyLowStock(
  materialId: string,
  materialName: string,
  currentQuantity: number,
  reorderPoint: number
): Promise<void> {
  // Get users with inventory_manager or admin role to notify
  const { data: adminUsers, error } = await supabase
    .from('profiles')
    .select('id')
    .or('role.eq.admin,role.eq.supervisor');

  if (error || !adminUsers?.length) {
    console.warn('No admin users found for low stock notification');
    return;
  }

  // Determine notification type based on stock level
  const isOutOfStock = currentQuantity <= 0;
  const isLowStock = currentQuantity > 0 && currentQuantity <= reorderPoint;

  if (isOutOfStock) {
    // Send out of stock notifications to all admins
    await Promise.all(
      adminUsers.map(user =>
        notifyOutOfStock(user.id, materialName, materialId)
      )
    );
  } else if (isLowStock) {
    // Send low stock notifications to all admins
    await Promise.all(
      adminUsers.map(user =>
        notifyLowStock(user.id, materialName, materialId, currentQuantity, reorderPoint)
      )
    );
  }
}

/**
 * Get all users subscribed to a notification type
 */
export async function getNotificationSubscribers(
  notificationType: NotificationType
): Promise<string[]> {
  // For now, return all admin/supervisor users for stock notifications
  // In the future, this could be based on user preferences
  if (['low_stock_alert', 'material_out_of_stock', 'stock_consumed'].includes(notificationType)) {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .or('role.eq.admin,role.eq.supervisor');
    return data?.map(u => u.id) || [];
  }

  return [];
}
