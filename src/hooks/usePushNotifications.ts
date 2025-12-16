import { useState, useEffect, useCallback } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setIsEnabled(localStorage.getItem('pushNotificationsEnabled') === 'true' && Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        setIsEnabled(true);
        localStorage.setItem('pushNotificationsEnabled', 'true');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, []);

  const enableNotifications = useCallback(async () => {
    if (permission === 'granted') {
      setIsEnabled(true);
      localStorage.setItem('pushNotificationsEnabled', 'true');
      return true;
    }
    return await requestPermission();
  }, [permission, requestPermission]);

  const disableNotifications = useCallback(() => {
    setIsEnabled(false);
    localStorage.setItem('pushNotificationsEnabled', 'false');
  }, []);

  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (localStorage.getItem('pushNotificationsEnabled') === 'true' && Notification.permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        ...options,
      });
    }
  }, []);

  return {
    permission,
    isEnabled,
    isSupported: 'Notification' in window,
    enableNotifications,
    disableNotifications,
    sendNotification,
  };
}
