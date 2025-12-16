/**
 * Hook for monitoring offline/online status
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  initOfflineSync,
  getSyncQueueStats,
  processSyncQueue,
} from '@/services/offlineSyncService';

interface OfflineStatus {
  isOnline: boolean;
  pendingSyncCount: number;
  failedSyncCount: number;
  isSyncing: boolean;
  lastSyncTime: Date | null;
  syncError: string | null;
}

export function useOfflineStatus() {
  const [status, setStatus] = useState<OfflineStatus>({
    isOnline: navigator.onLine,
    pendingSyncCount: 0,
    failedSyncCount: 0,
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
  });
  
  const isMountedRef = useRef(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshStats = useCallback(async () => {
    if (!isMountedRef.current) return;
    try {
      const stats = await getSyncQueueStats();
      if (isMountedRef.current) {
        setStatus(prev => ({
          ...prev,
          pendingSyncCount: stats.pending,
          failedSyncCount: stats.failed,
        }));
      }
    } catch (error) {
      console.error('Error refreshing sync stats:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine || !isMountedRef.current) {
      setStatus(prev => ({
        ...prev,
        syncError: 'Cannot sync while offline',
      }));
      return;
    }

    setStatus(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      const results = await processSyncQueue();
      if (isMountedRef.current) {
        setStatus(prev => ({
          ...prev,
          isSyncing: false,
          lastSyncTime: new Date(),
          pendingSyncCount: results.failed,
          failedSyncCount: results.failed,
          syncError: results.errors.length > 0 ? results.errors[0] : null,
        }));
      }
    } catch (error) {
      if (isMountedRef.current) {
        setStatus(prev => ({
          ...prev,
          isSyncing: false,
          syncError: error instanceof Error ? error.message : 'Sync failed',
        }));
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;

    // Initialize offline sync system
    initOfflineSync().catch(console.error);

    // Online/offline handlers
    const handleOnline = () => {
      if (isMountedRef.current) {
        setStatus(prev => ({ ...prev, isOnline: true }));
        syncNow();
      }
    };

    const handleOffline = () => {
      if (isMountedRef.current) {
        setStatus(prev => ({ ...prev, isOnline: false }));
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial stats refresh
    refreshStats();

    // Refresh stats periodically
    intervalRef.current = setInterval(refreshStats, 30000);

    return () => {
      isMountedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, []); // Empty deps - handlers use refs and callbacks are stable

  return {
    ...status,
    syncNow,
    refreshStats,
  };
}

export default useOfflineStatus;
