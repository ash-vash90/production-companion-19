/**
 * Hook for monitoring offline/online status
 */

import { useState, useEffect, useCallback } from 'react';
import {
  initOfflineSync,
  getSyncQueueStats,
  processSyncQueue,
  registerOfflineListeners,
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

  const refreshStats = useCallback(async () => {
    try {
      const stats = await getSyncQueueStats();
      setStatus(prev => ({
        ...prev,
        pendingSyncCount: stats.pending,
        failedSyncCount: stats.failed,
      }));
    } catch (error) {
      console.error('Error refreshing sync stats:', error);
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!navigator.onLine) {
      setStatus(prev => ({
        ...prev,
        syncError: 'Cannot sync while offline',
      }));
      return;
    }

    setStatus(prev => ({ ...prev, isSyncing: true, syncError: null }));

    try {
      const results = await processSyncQueue();
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        lastSyncTime: new Date(),
        pendingSyncCount: results.failed,
        failedSyncCount: results.failed,
        syncError: results.errors.length > 0 ? results.errors[0] : null,
      }));
    } catch (error) {
      setStatus(prev => ({
        ...prev,
        isSyncing: false,
        syncError: error instanceof Error ? error.message : 'Sync failed',
      }));
    }
  }, []);

  useEffect(() => {
    // Initialize offline sync system
    initOfflineSync().catch(console.error);

    // Register online/offline listeners
    const cleanup = registerOfflineListeners(
      () => {
        setStatus(prev => ({ ...prev, isOnline: true }));
        // Auto-sync when coming back online
        syncNow();
      },
      () => {
        setStatus(prev => ({ ...prev, isOnline: false }));
      }
    );

    // Initial stats refresh
    refreshStats();

    // Refresh stats periodically
    const interval = setInterval(refreshStats, 30000);

    return () => {
      cleanup();
      clearInterval(interval);
    };
  }, [refreshStats, syncNow]);

  return {
    ...status,
    syncNow,
    refreshStats,
  };
}

export default useOfflineStatus;
