/**
 * Offline Sync Service
 *
 * Provides IndexedDB-based offline data storage and sync queue
 * for the PWA to work offline and sync when back online.
 */

import { supabase } from '@/integrations/supabase/client';

const DB_NAME = 'rhosonics-pms-offline';
const DB_VERSION = 1;

// Store names
const STORES = {
  SYNC_QUEUE: 'sync_queue',
  CACHED_DATA: 'cached_data',
  PENDING_ACTIONS: 'pending_actions',
} as const;

export type SyncStatus = 'pending' | 'syncing' | 'failed' | 'completed';

export interface SyncQueueItem {
  id?: number;
  table: string;
  operation: 'insert' | 'update' | 'delete';
  data: Record<string, unknown>;
  primaryKey?: string;
  created_at: string;
  status: SyncStatus;
  retries: number;
  last_error?: string;
}

export interface CachedData {
  key: string;
  data: unknown;
  cached_at: string;
  expires_at?: string;
}

let db: IDBDatabase | null = null;

/**
 * Initialize the IndexedDB database
 */
export async function initOfflineDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Error opening IndexedDB:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Create sync queue store
      if (!database.objectStoreNames.contains(STORES.SYNC_QUEUE)) {
        const syncStore = database.createObjectStore(STORES.SYNC_QUEUE, {
          keyPath: 'id',
          autoIncrement: true,
        });
        syncStore.createIndex('status', 'status', { unique: false });
        syncStore.createIndex('table', 'table', { unique: false });
        syncStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // Create cached data store
      if (!database.objectStoreNames.contains(STORES.CACHED_DATA)) {
        const cacheStore = database.createObjectStore(STORES.CACHED_DATA, {
          keyPath: 'key',
        });
        cacheStore.createIndex('expires_at', 'expires_at', { unique: false });
      }

      // Create pending actions store
      if (!database.objectStoreNames.contains(STORES.PENDING_ACTIONS)) {
        const actionsStore = database.createObjectStore(STORES.PENDING_ACTIONS, {
          keyPath: 'id',
          autoIncrement: true,
        });
        actionsStore.createIndex('type', 'type', { unique: false });
      }
    };
  });
}

/**
 * Add an item to the sync queue
 */
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'status' | 'retries' | 'created_at'>): Promise<number> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);

    const queueItem: Omit<SyncQueueItem, 'id'> = {
      ...item,
      created_at: new Date().toISOString(),
      status: 'pending',
      retries: 0,
    };

    const request = store.add(queueItem);

    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get all pending items in the sync queue
 */
export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('status');
    const request = index.getAll('pending');

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update sync queue item status
 */
export async function updateSyncItemStatus(
  id: number,
  status: SyncStatus,
  error?: string
): Promise<void> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const item = getRequest.result as SyncQueueItem;
      if (item) {
        item.status = status;
        if (error) item.last_error = error;
        if (status === 'failed') item.retries++;
        store.put(item);
      }
      resolve();
    };

    getRequest.onerror = () => reject(getRequest.error);
  });
}

/**
 * Remove completed items from sync queue
 */
export async function cleanupSyncQueue(): Promise<void> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readwrite');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const index = store.index('status');
    const request = index.openCursor('completed');

    request.onsuccess = () => {
      const cursor = request.result;
      if (cursor) {
        store.delete(cursor.primaryKey);
        cursor.continue();
      } else {
        resolve();
      }
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Cache data for offline access
 */
export async function cacheData(
  key: string,
  data: unknown,
  expiresInMinutes?: number
): Promise<void> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CACHED_DATA, 'readwrite');
    const store = transaction.objectStore(STORES.CACHED_DATA);

    const cachedItem: CachedData = {
      key,
      data,
      cached_at: new Date().toISOString(),
      expires_at: expiresInMinutes
        ? new Date(Date.now() + expiresInMinutes * 60000).toISOString()
        : undefined,
    };

    const request = store.put(cachedItem);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get cached data
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CACHED_DATA, 'readonly');
    const store = transaction.objectStore(STORES.CACHED_DATA);
    const request = store.get(key);

    request.onsuccess = () => {
      const item = request.result as CachedData | undefined;
      if (!item) {
        resolve(null);
        return;
      }

      // Check if expired
      if (item.expires_at && new Date(item.expires_at) < new Date()) {
        // Remove expired item
        const deleteTransaction = database.transaction(STORES.CACHED_DATA, 'readwrite');
        deleteTransaction.objectStore(STORES.CACHED_DATA).delete(key);
        resolve(null);
        return;
      }

      resolve(item.data as T);
    };

    request.onerror = () => reject(request.error);
  });
}

/**
 * Clear all cached data
 */
export async function clearCache(): Promise<void> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.CACHED_DATA, 'readwrite');
    const store = transaction.objectStore(STORES.CACHED_DATA);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Process the sync queue - sync all pending items with Supabase
 */
export async function processSyncQueue(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const pendingItems = await getPendingSyncItems();
  const results = { synced: 0, failed: 0, errors: [] as string[] };

  for (const item of pendingItems) {
    try {
      await updateSyncItemStatus(item.id!, 'syncing');

      let error: Error | null = null;

      switch (item.operation) {
        case 'insert': {
          const { error: insertError } = await (supabase
            .from(item.table as any)
            .insert(item.data as any));
          error = insertError;
          break;
        }
        case 'update': {
          if (!item.primaryKey) {
            throw new Error('Primary key required for update');
          }
          const { error: updateError } = await (supabase
            .from(item.table as any)
            .update(item.data as any)
            .eq('id', item.primaryKey));
          error = updateError;
          break;
        }
        case 'delete': {
          if (!item.primaryKey) {
            throw new Error('Primary key required for delete');
          }
          const { error: deleteError } = await (supabase
            .from(item.table as any)
            .delete()
            .eq('id', item.primaryKey));
          error = deleteError;
          break;
        }
      }

      if (error) {
        throw error;
      }

      await updateSyncItemStatus(item.id!, 'completed');
      results.synced++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      await updateSyncItemStatus(item.id!, 'failed', errorMessage);
      results.failed++;
      results.errors.push(`${item.table}/${item.operation}: ${errorMessage}`);
    }
  }

  // Clean up completed items
  await cleanupSyncQueue();

  return results;
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return navigator.onLine;
}

/**
 * Get sync queue statistics
 */
export async function getSyncQueueStats(): Promise<{
  pending: number;
  failed: number;
  total: number;
}> {
  const database = await initOfflineDB();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORES.SYNC_QUEUE, 'readonly');
    const store = transaction.objectStore(STORES.SYNC_QUEUE);
    const statusIndex = store.index('status');

    const stats = { pending: 0, failed: 0, total: 0 };

    const pendingRequest = statusIndex.count('pending');
    const failedRequest = statusIndex.count('failed');
    const totalRequest = store.count();

    transaction.oncomplete = () => {
      resolve(stats);
    };

    pendingRequest.onsuccess = () => {
      stats.pending = pendingRequest.result;
    };

    failedRequest.onsuccess = () => {
      stats.failed = failedRequest.result;
    };

    totalRequest.onsuccess = () => {
      stats.total = totalRequest.result;
    };

    transaction.onerror = () => reject(transaction.error);
  });
}

/**
 * Offline-aware wrapper for Supabase operations
 * Queues operations when offline, executes directly when online
 */
export async function offlineAwareOperation<T>(
  operation: () => Promise<{ data: T | null; error: Error | null }>,
  queueItem: Omit<SyncQueueItem, 'id' | 'status' | 'retries' | 'created_at'>
): Promise<{ data: T | null; error: Error | null; queued: boolean }> {
  if (isOnline()) {
    const result = await operation();
    return { ...result, queued: false };
  }

  // Offline - add to queue
  await addToSyncQueue(queueItem);
  return {
    data: null,
    error: null,
    queued: true,
  };
}

/**
 * Register online/offline event listeners
 */
export function registerOfflineListeners(
  onOnline?: () => void,
  onOffline?: () => void
): () => void {
  const handleOnline = async () => {
    console.log('Back online - processing sync queue');
    await processSyncQueue();
    onOnline?.();
  };

  const handleOffline = () => {
    console.log('Gone offline - queuing operations');
    onOffline?.();
  };

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Return cleanup function
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}

/**
 * Initialize offline sync system
 */
export async function initOfflineSync(): Promise<void> {
  await initOfflineDB();

  // Process any pending items if we're online
  if (isOnline()) {
    const stats = await getSyncQueueStats();
    if (stats.pending > 0) {
      console.log(`Processing ${stats.pending} pending sync items`);
      await processSyncQueue();
    }
  }
}
