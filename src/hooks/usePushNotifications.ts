import { useState, useEffect } from 'react';

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isEnabled, setIsEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
      setIsEnabled(localStorage.getItem('pushNotificationsEnabled') === 'true' && Notification.permission === 'granted');
    }
  }, []);

  const requestPermission = async () => {
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
  };

  const enableNotifications = async () => {
    if (permission === 'granted') {
      setIsEnabled(true);
      localStorage.setItem('pushNotificationsEnabled', 'true');
      return true;
    }
    return await requestPermission();
  };

  const disableNotifications = () => {
    setIsEnabled(false);
    localStorage.setItem('pushNotificationsEnabled', 'false');
  };

  const sendNotification = (title: string, options?: NotificationOptions) => {
    if (isEnabled && permission === 'granted') {
      new Notification(title, {
        icon: '/favicon.ico',
        ...options,
      });
    }
  };

  return {
    permission,
    isEnabled,
    isSupported: 'Notification' in window,
    enableNotifications,
    disableNotifications,
    sendNotification,
  };
}
