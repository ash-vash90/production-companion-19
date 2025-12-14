import { useRef, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useResilientQuery } from './useResilientQuery';
import { getProductBreakdown, ProductBreakdown } from '@/lib/utils';

// Global cache for work orders data
const workOrdersCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds

export interface WorkOrderListItem {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  start_date: string | null;
  completed_at: string | null;
  shipping_date: string | null;
  customer_name: string | null;
  external_order_number: string | null;
  order_value: number | null;
  profiles: { full_name: string; avatar_url: string | null } | null;
  productBreakdown: ProductBreakdown[];
  isMainAssembly: boolean;
  hasSubassemblies: boolean;
}

type WorkOrderStatus = 'planned' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

interface UseWorkOrdersOptions {
  excludeCancelled?: boolean;
  limit?: number;
  statusFilter?: WorkOrderStatus[];
  enableRealtime?: boolean;
}

/**
 * Optimized hook for fetching work orders with caching, pagination, and resilience
 */
export function useWorkOrders(options: UseWorkOrdersOptions = {}) {
  const { 
    excludeCancelled = true, 
    limit, 
    statusFilter,
    enableRealtime = true 
  } = options;
  
  const cacheKey = `workorders_${excludeCancelled}_${limit}_${statusFilter?.join(',')}`;
  const realtimeChannelRef = useRef<any>(null);

  const fetchWorkOrders = useCallback(async (): Promise<WorkOrderListItem[]> => {
    // Check cache first
    const cached = workOrdersCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    let query = supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, created_by, customer_name, external_order_number, order_value, start_date, completed_at, shipping_date')
      .order('created_at', { ascending: false });

    if (excludeCancelled) {
      query = query.neq('status', 'cancelled');
    }

    if (statusFilter && statusFilter.length > 0) {
      query = query.in('status', statusFilter as WorkOrderStatus[]);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: workOrdersData, error: woError } = await query;
    if (woError) throw woError;

    const woIds = workOrdersData?.map(wo => wo.id) || [];
    
    // Parallel fetch items and profiles
    const [itemsResult, profilesResult] = await Promise.all([
      woIds.length > 0 
        ? supabase
            .from('work_order_items')
            .select('work_order_id, serial_number')
            .in('work_order_id', woIds)
        : { data: [] },
      (async () => {
        const creatorIds = [...new Set(workOrdersData?.map(wo => wo.created_by).filter(Boolean) || [])];
        if (creatorIds.length === 0) return { data: [] };
        return supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', creatorIds);
      })()
    ]);

    // Build lookup maps
    const itemsMap: Record<string, Array<{ serial_number: string }>> = {};
    for (const item of itemsResult.data || []) {
      if (!itemsMap[item.work_order_id]) {
        itemsMap[item.work_order_id] = [];
      }
      itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
    }

    const profilesMap = (profilesResult.data || []).reduce((acc, p) => {
      acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      return acc;
    }, {} as Record<string, { full_name: string; avatar_url: string | null }>);

    // Enrich data
    const enrichedData = (workOrdersData || []).map(wo => {
      const breakdown = getProductBreakdown(itemsMap[wo.id] || []);
      const hasSDM_ECO = breakdown.some(b => b.type === 'SDM_ECO');
      const hasSubassemblies = breakdown.some(b => ['SENSOR', 'MLA', 'HMI', 'TRANSMITTER'].includes(b.type));
      
      return {
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] 
          ? profilesMap[wo.created_by] 
          : null,
        productBreakdown: breakdown,
        isMainAssembly: hasSDM_ECO,
        hasSubassemblies: hasSubassemblies
      };
    }) as WorkOrderListItem[];

    // Update cache
    workOrdersCache.set(cacheKey, { data: enrichedData, timestamp: Date.now() });
    
    return enrichedData;
  }, [cacheKey, excludeCancelled, limit, statusFilter]);

  const { data, loading, error, refetch, isStale } = useResilientQuery<WorkOrderListItem[]>({
    queryFn: fetchWorkOrders,
    fallbackData: [],
    timeout: 15000,
    retryCount: 3,
  });

  // Set up realtime subscription for updates
  const setupRealtime = useCallback(() => {
    if (!enableRealtime || realtimeChannelRef.current) return;

    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel(`workorders-list-${cacheKey}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_orders' },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            // Invalidate cache and refetch
            workOrdersCache.delete(cacheKey);
            refetch();
          }, 500);
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      clearTimeout(debounceTimer);
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [enableRealtime, cacheKey, refetch]);

  return {
    workOrders: data || [],
    loading,
    error,
    refetch,
    isStale,
    setupRealtime,
  };
}

/**
 * Prefetch work orders data for faster page loads
 * Call this on app initialization or when navigating
 */
export async function prefetchWorkOrders(): Promise<void> {
  const cacheKey = 'workorders_true_undefined_undefined';
  
  // Skip if recently cached
  const cached = workOrdersCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return;
  }

  try {
    const { data: workOrdersData } = await supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, created_by, customer_name, external_order_number, order_value, start_date, shipping_date')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!workOrdersData) return;

    const woIds = workOrdersData.map(wo => wo.id);
    
    const [itemsResult, profilesResult] = await Promise.all([
      woIds.length > 0 
        ? supabase.from('work_order_items').select('work_order_id, serial_number').in('work_order_id', woIds)
        : { data: [] },
      (async () => {
        const creatorIds = [...new Set(workOrdersData.map(wo => wo.created_by).filter(Boolean))];
        if (creatorIds.length === 0) return { data: [] };
        return supabase.from('profiles').select('id, full_name, avatar_url').in('id', creatorIds);
      })()
    ]);

    const itemsMap: Record<string, Array<{ serial_number: string }>> = {};
    for (const item of itemsResult.data || []) {
      if (!itemsMap[item.work_order_id]) itemsMap[item.work_order_id] = [];
      itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
    }

    const profilesMap = (profilesResult.data || []).reduce((acc, p) => {
      acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      return acc;
    }, {} as Record<string, { full_name: string; avatar_url: string | null }>);

    const enrichedData = workOrdersData.map(wo => {
      const breakdown = getProductBreakdown(itemsMap[wo.id] || []);
      return {
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] ? profilesMap[wo.created_by] : null,
        productBreakdown: breakdown,
        isMainAssembly: breakdown.some(b => b.type === 'SDM_ECO'),
        hasSubassemblies: breakdown.some(b => ['SENSOR', 'MLA', 'HMI', 'TRANSMITTER'].includes(b.type))
      };
    });

    workOrdersCache.set(cacheKey, { data: enrichedData, timestamp: Date.now() });
  } catch (error) {
    console.error('Prefetch work orders failed:', error);
  }
}

/**
 * Invalidate work orders cache - call after mutations
 */
export function invalidateWorkOrdersCache(): void {
  workOrdersCache.clear();
}

/**
 * Hook for paginated work orders - handles large datasets
 */
export function usePaginatedWorkOrders(pageSize = 25) {
  const pageRef = useRef(0);
  const hasMoreRef = useRef(true);
  const allDataRef = useRef<WorkOrderListItem[]>([]);

  const loadPage = useCallback(async (page: number): Promise<WorkOrderListItem[]> => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data: workOrdersData, error } = await supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, created_by, customer_name, external_order_number, order_value, start_date, shipping_date, completed_at')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) throw error;

    if (!workOrdersData || workOrdersData.length < pageSize) {
      hasMoreRef.current = false;
    }

    if (!workOrdersData || workOrdersData.length === 0) {
      return [];
    }

    const woIds = workOrdersData.map(wo => wo.id);
    
    const [itemsResult, profilesResult] = await Promise.all([
      supabase.from('work_order_items').select('work_order_id, serial_number').in('work_order_id', woIds),
      (async () => {
        const creatorIds = [...new Set(workOrdersData.map(wo => wo.created_by).filter(Boolean))];
        if (creatorIds.length === 0) return { data: [] };
        return supabase.from('profiles').select('id, full_name, avatar_url').in('id', creatorIds);
      })()
    ]);

    const itemsMap: Record<string, Array<{ serial_number: string }>> = {};
    for (const item of itemsResult.data || []) {
      if (!itemsMap[item.work_order_id]) itemsMap[item.work_order_id] = [];
      itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
    }

    const profilesMap = (profilesResult.data || []).reduce((acc, p) => {
      acc[p.id] = { full_name: p.full_name, avatar_url: p.avatar_url };
      return acc;
    }, {} as Record<string, { full_name: string; avatar_url: string | null }>);

    return workOrdersData.map(wo => {
      const breakdown = getProductBreakdown(itemsMap[wo.id] || []);
      return {
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] ? profilesMap[wo.created_by] : null,
        productBreakdown: breakdown,
        isMainAssembly: breakdown.some(b => b.type === 'SDM_ECO'),
        hasSubassemblies: breakdown.some(b => ['SENSOR', 'MLA', 'HMI', 'TRANSMITTER'].includes(b.type))
      };
    }) as WorkOrderListItem[];
  }, [pageSize]);

  const { data: initialData, loading, error, refetch } = useResilientQuery<WorkOrderListItem[]>({
    queryFn: () => loadPage(0),
    fallbackData: [],
    timeout: 15000,
    retryCount: 3,
  });

  const loadMore = useCallback(async () => {
    if (!hasMoreRef.current) return;
    
    pageRef.current += 1;
    const newData = await loadPage(pageRef.current);
    allDataRef.current = [...allDataRef.current, ...newData];
  }, [loadPage]);

  const reset = useCallback(() => {
    pageRef.current = 0;
    hasMoreRef.current = true;
    allDataRef.current = [];
    refetch();
  }, [refetch]);

  // Merge initial data with loaded pages
  const allWorkOrders = useMemo(() => {
    if (allDataRef.current.length > 0) {
      return [...(initialData || []), ...allDataRef.current];
    }
    return initialData || [];
  }, [initialData]);

  return {
    workOrders: allWorkOrders,
    loading,
    error,
    loadMore,
    hasMore: hasMoreRef.current,
    reset,
  };
}
