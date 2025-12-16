import { prefetchWorkOrders, invalidateWorkOrdersCache } from '@/hooks/useWorkOrders';
import { prefetchProductionReports, invalidateReportsCache } from '@/hooks/useProductionReports';
import { prefetchProduction, invalidateProductionCache } from '@/hooks/useProduction';

let prefetchInitialized = false;
let cacheCleanupInterval: ReturnType<typeof setInterval> | null = null;

// Cleanup interval - clear all caches every 5 minutes to prevent memory buildup
const CACHE_CLEANUP_INTERVAL = 5 * 60 * 1000;

/**
 * Initialize data prefetching on app load
 * This preloads critical data for faster page loads
 */
export async function initializePrefetch(): Promise<void> {
  if (prefetchInitialized) return;
  prefetchInitialized = true;

  // Prefetch in background, don't block app initialization
  Promise.all([
    prefetchWorkOrders(),
    prefetchProductionReports(),
  ]).catch(err => {
    console.warn('Prefetch initialization warning:', err);
  });

  // Set up periodic cache cleanup to prevent memory buildup
  if (!cacheCleanupInterval) {
    cacheCleanupInterval = setInterval(() => {
      // Clear all caches periodically
      invalidateWorkOrdersCache();
      invalidateReportsCache();
      invalidateProductionCache();
    }, CACHE_CLEANUP_INTERVAL);
  }
}

/**
 * Cleanup prefetch resources (call on app unmount)
 */
export function cleanupPrefetch(): void {
  if (cacheCleanupInterval) {
    clearInterval(cacheCleanupInterval);
    cacheCleanupInterval = null;
  }
  invalidateWorkOrdersCache();
  invalidateReportsCache();
  invalidateProductionCache();
  prefetchInitialized = false;
}

/**
 * Prefetch data when navigating to a page
 * Call this from route change handlers or link hover
 */
export async function prefetchForRoute(route: string, params?: Record<string, string>): Promise<void> {
  try {
    if (route === '/work-orders' || route === '/') {
      await prefetchWorkOrders();
    } else if (route === '/production-reports') {
      await prefetchProductionReports();
    } else if (route.startsWith('/production/') && params?.workOrderId) {
      await prefetchProduction(params.workOrderId);
    }
  } catch (err) {
    console.warn('Route prefetch warning:', err);
  }
}

/**
 * Prefetch production data for a work order (e.g., on hover)
 * Returns a cleanup function to cancel prefetch
 */
export function prefetchProductionOnHover(workOrderId: string): () => void {
  // Delay slightly to avoid prefetching on quick mouse movements
  const timeoutId = setTimeout(() => {
    prefetchProduction(workOrderId);
  }, 150);
  
  // Return cleanup function for mouseout
  return () => clearTimeout(timeoutId);
}
