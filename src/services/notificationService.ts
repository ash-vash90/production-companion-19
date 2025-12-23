import { supabase } from '@/integrations/supabase/client';

export type NotificationType =
  | 'work_order_completed'
  | 'work_order_cancelled'
  | 'exact_sync_success'
  | 'exact_sync_error'
  | 'user_mentioned'
  | 'materials_issued'
  | 'production_ready'
  | 'production_start_approaching';

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
 * Notify supervisors (Anton/Erwin) when materials are issued and production can begin
 */
export async function notifyMaterialsIssued(
  shopOrderNumber: string,
  workOrderId: string,
  productName?: string
): Promise<void> {
  const supervisors = await getSupervisors();
  
  for (const userId of supervisors) {
    await createNotification({
      userId,
      type: 'materials_issued',
      title: 'Materials Ready for Production',
      message: `Shop Order ${shopOrderNumber}${productName ? ` (${productName})` : ''} has all materials issued. Production can begin.`,
      entityType: 'work_order',
      entityId: workOrderId,
      priority: 'high',
    });
  }
}

/**
 * Notify production team when planned start date is approaching
 */
export async function notifyProductionStartApproaching(
  shopOrderNumber: string,
  workOrderId: string,
  startDate: string,
  daysUntilStart: number,
  productName?: string
): Promise<void> {
  const productionTeam = await getProductionTeam();
  
  const dayText = daysUntilStart === 1 ? 'tomorrow' : `in ${daysUntilStart} days`;
  
  for (const userId of productionTeam) {
    await createNotification({
      userId,
      type: 'production_start_approaching',
      title: 'Production Starting Soon',
      message: `Shop Order ${shopOrderNumber}${productName ? ` (${productName})` : ''} is scheduled to start ${dayText} (${startDate}).`,
      entityType: 'work_order',
      entityId: workOrderId,
      priority: daysUntilStart <= 1 ? 'high' : 'normal',
    });
  }
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

/**
 * Get supervisors (Anton/Erwin) for materials issued notifications
 */
async function getSupervisors(): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .or('role.eq.admin,role.eq.supervisor');
  return data?.map(u => u.id) || [];
}

/**
 * Get production team (operators) for start date notifications
 */
async function getProductionTeam(): Promise<string[]> {
  const { data } = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'operator');
  return data?.map(u => u.id) || [];
}

/**
 * Check for approaching production start dates and send notifications
 * This should be called by a scheduled job (e.g., daily cron)
 */
export async function checkApproachingStartDates(): Promise<void> {
  const today = new Date();
  const threeDaysFromNow = new Date(today);
  threeDaysFromNow.setDate(today.getDate() + 3);
  
  // Find work orders starting in the next 3 days
  const { data: workOrders, error } = await supabase
    .from('work_orders')
    .select(`
      id,
      wo_number,
      exact_shop_order_number,
      start_date,
      product_id,
      products:product_id (name)
    `)
    .gte('start_date', today.toISOString().split('T')[0])
    .lte('start_date', threeDaysFromNow.toISOString().split('T')[0])
    .in('status', ['planned', 'on_hold'])
    .eq('materials_issued_status', 'complete');
  
  if (error) {
    console.error('Failed to check approaching start dates:', error);
    return;
  }
  
  for (const wo of workOrders || []) {
    const startDate = new Date(wo.start_date);
    const daysUntilStart = Math.ceil((startDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    const shopOrderNumber = wo.exact_shop_order_number || wo.wo_number;
    const productName = (wo.products as { name?: string } | null)?.name;
    
    await notifyProductionStartApproaching(
      shopOrderNumber,
      wo.id,
      wo.start_date,
      daysUntilStart,
      productName
    );
  }
}
