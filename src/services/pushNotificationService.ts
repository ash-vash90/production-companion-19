/**
 * Push Notification Service
 *
 * Handles Web Push notifications for the PWA.
 * Uses VAPID for secure push messaging.
 */

import { supabase } from '@/integrations/supabase/client';

// Get VAPID public key from environment or Supabase config
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export interface PushSubscription {
  id?: string;
  user_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at?: string;
}

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

/**
 * Check if notifications are allowed
 */
export function getNotificationPermission(): NotificationPermission {
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn('Push notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  return permission;
}

/**
 * Convert VAPID key to Uint8Array for subscription
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(userId: string): Promise<PushSubscriptionJSON | null> {
  if (!isPushSupported()) {
    console.warn('Push not supported');
    return null;
  }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') {
    console.warn('Notification permission denied');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;

    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();

    if (!subscription && VAPID_PUBLIC_KEY) {
      // Create new subscription
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });
    }

    if (subscription) {
      // Save subscription to database
      await savePushSubscription(userId, subscription);
      return subscription.toJSON();
    }

    return null;
  } catch (error) {
    console.error('Error subscribing to push:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      await deletePushSubscription(userId, subscription.endpoint);
    }

    return true;
  } catch (error) {
    console.error('Error unsubscribing from push:', error);
    return false;
  }
}

/**
 * Save push subscription to database
 */
async function savePushSubscription(
  userId: string,
  subscription: globalThis.PushSubscription
): Promise<void> {
  const json = subscription.toJSON();
  const keys = json.keys || {};

  const { error } = await (supabase
    .from('push_subscriptions' as any)
    .upsert({
      user_id: userId,
      endpoint: json.endpoint!,
      p256dh: keys.p256dh || '',
      auth: keys.auth || '',
    }, {
      onConflict: 'user_id,endpoint',
    }) as any);

  if (error) {
    console.error('Error saving push subscription:', error);
    throw error;
  }
}

/**
 * Delete push subscription from database
 */
async function deletePushSubscription(userId: string, endpoint: string): Promise<void> {
  const { error } = await (supabase
    .from('push_subscriptions' as any)
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint) as any);

  if (error) {
    console.error('Error deleting push subscription:', error);
  }
}

/**
 * Get current push subscription status
 */
export async function getPushSubscriptionStatus(userId: string): Promise<{
  supported: boolean;
  permission: NotificationPermission;
  subscribed: boolean;
}> {
  const supported = isPushSupported();
  const permission = getNotificationPermission();

  let subscribed = false;
  if (supported && permission === 'granted') {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      subscribed = !!subscription;
    } catch {
      // Service worker not ready
    }
  }

  return { supported, permission, subscribed };
}

/**
 * Send a push notification to a specific user
 * This calls the Edge Function which handles the actual push
 */
export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
    tag?: string;
    actions?: Array<{ action: string; title: string }>;
  }
): Promise<boolean> {
  try {
    const { error } = await supabase.functions.invoke('send-push', {
      body: {
        userId,
        notification: {
          title,
          body,
          icon: options?.icon || '/pwa-192x192.png',
          badge: options?.badge || '/pwa-192x192.png',
          data: options?.data,
          tag: options?.tag,
          actions: options?.actions,
        },
      },
    });

    if (error) {
      console.error('Error sending push:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error invoking send-push function:', error);
    return false;
  }
}

/**
 * Send push notification to multiple users
 */
export async function sendPushToUsers(
  userIds: string[],
  title: string,
  body: string,
  options?: {
    icon?: string;
    badge?: string;
    data?: Record<string, unknown>;
    tag?: string;
  }
): Promise<void> {
  await Promise.all(
    userIds.map(userId => sendPushNotification(userId, title, body, options))
  );
}

/**
 * Show a local notification (for testing or when service worker handles it)
 */
export async function showLocalNotification(
  title: string,
  body: string,
  options?: NotificationOptions
): Promise<void> {
  if (!isPushSupported()) return;

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return;

  const registration = await navigator.serviceWorker.ready;
  await registration.showNotification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    ...options,
  });
}
