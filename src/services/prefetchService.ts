import { prefetchWorkOrders } from '@/hooks/useWorkOrders';
import { prefetchProductionReports } from '@/hooks/useProductionReports';
import { prefetchProduction } from '@/hooks/useProduction';

let prefetchInitialized = false;

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
