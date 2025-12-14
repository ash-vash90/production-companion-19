import { useRef, useCallback, useMemo, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useResilientQuery } from './useResilientQuery';
import { getProductBreakdown, ProductBreakdown } from '@/lib/utils';
import { endOfMonth, startOfDay, startOfMonth, subDays } from 'date-fns';

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

export interface WorkOrderQueryFilters {
  statusFilter?: WorkOrderStatus;
  productFilter?: string;
  customerFilter?: string;
  searchTerm?: string;
  ageFilter?: 'today' | 'week' | 'month' | 'older';
  deliveryMonthFilter?: string;
  createdMonthFilter?: string;
  batchSizeFilter?: 'small' | 'medium' | 'large';
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
export interface UsePaginatedWorkOrdersOptions {
  pageSize?: number;
  filters?: WorkOrderQueryFilters;
  excludeCancelled?: boolean;
}

export function usePaginatedWorkOrders({ pageSize = 25, filters, excludeCancelled = true }: UsePaginatedWorkOrdersOptions = {}) {
  const pageRef = useRef(0);
  const [hasMore, setHasMore] = useState(true);
  const [additionalPages, setAdditionalPages] = useState<WorkOrderListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const filtersKey = useMemo(() => JSON.stringify(filters || {}), [filters]);

  const applyFilters = useCallback((query: any) => {
    if (excludeCancelled) {
      query = query.neq('status', 'cancelled');
    }

    if (filters?.statusFilter) {
      query = query.eq('status', filters.statusFilter);
    }

    if (filters?.productFilter) {
      query = query.eq('product_type', filters.productFilter);
    }

    if (filters?.customerFilter) {
      query = query.eq('customer_name', filters.customerFilter);
    }

    if (filters?.deliveryMonthFilter) {
      const monthStart = startOfMonth(new Date(`${filters.deliveryMonthFilter}-01`));
      const monthEnd = endOfMonth(monthStart);
      query = query.gte('shipping_date', monthStart.toISOString()).lte('shipping_date', monthEnd.toISOString());
    }

    if (filters?.createdMonthFilter) {
      const monthStart = startOfMonth(new Date(`${filters.createdMonthFilter}-01`));
      const monthEnd = endOfMonth(monthStart);
      query = query.gte('created_at', monthStart.toISOString()).lte('created_at', monthEnd.toISOString());
    }

    if (filters?.ageFilter) {
      const now = new Date();
      switch (filters.ageFilter) {
        case 'today': {
          const start = startOfDay(now).toISOString();
          query = query.gte('created_at', start);
          break;
        }
        case 'week': {
          const start = subDays(startOfDay(now), 7).toISOString();
          query = query.gte('created_at', start);
          break;
        }
        case 'month': {
          const start = subDays(startOfDay(now), 30).toISOString();
          query = query.gte('created_at', start);
          break;
        }
        case 'older': {
          const cutoff = subDays(startOfDay(now), 30).toISOString();
          query = query.lt('created_at', cutoff);
          break;
        }
        default:
          break;
      }
    }

    if (filters?.batchSizeFilter) {
      if (filters.batchSizeFilter === 'small') {
        query = query.lte('batch_size', 5);
      } else if (filters.batchSizeFilter === 'medium') {
        query = query.gt('batch_size', 5).lte('batch_size', 20);
      } else if (filters.batchSizeFilter === 'large') {
        query = query.gt('batch_size', 20);
      }
    }

    if (filters?.searchTerm) {
      const term = `%${filters.searchTerm}%`;
      query = query.or(`wo_number.ilike.${term},product_type.ilike.${term},customer_name.ilike.${term}`);
    }

    return query;
  }, [excludeCancelled, filters]);

  const loadPage = useCallback(async (page: number): Promise<{ data: WorkOrderListItem[]; total: number | null }> => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    let query = supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, created_by, customer_name, external_order_number, order_value, start_date, shipping_date, completed_at', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    query = applyFilters(query);

    const { data: workOrdersData, error, count } = await query;

    if (error) throw error;

    if (!workOrdersData || workOrdersData.length === 0) {
      return { data: [], total: count ?? null };
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

    const enrichedData = workOrdersData.map(wo => {
      const breakdown = getProductBreakdown(itemsMap[wo.id] || []);
      return {
        ...wo,
        profiles: wo.created_by && profilesMap[wo.created_by] ? profilesMap[wo.created_by] : null,
        productBreakdown: breakdown,
        isMainAssembly: breakdown.some(b => b.type === 'SDM_ECO'),
        hasSubassemblies: breakdown.some(b => ['SENSOR', 'MLA', 'HMI', 'TRANSMITTER'].includes(b.type))
      };
    }) as WorkOrderListItem[];

    return { data: enrichedData, total: count ?? null };
  }, [pageSize, applyFilters]);

  const { data: initialData, loading, error, refetch } = useResilientQuery<WorkOrderListItem[]>({
    queryFn: async () => {
      const { data, total } = await loadPage(0);
      setTotalCount(total);
      setHasMore(total !== null ? data.length < total : data.length === pageSize);
      return data;
    },
    fallbackData: [],
    timeout: 15000,
    retryCount: 3,
  });

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const { data } = await loadPage(nextPage);
      pageRef.current = nextPage;

      setAdditionalPages(prev => [...prev, ...data]);
      setHasMore(prevHasMore => {
        if (!prevHasMore) return prevHasMore;
        if (totalCount !== null) {
          const loadedCount = (initialData?.length || 0) + [...additionalPages, ...data].length;
          return loadedCount < totalCount;
        }
        return data.length === pageSize;
      });
    } finally {
      setIsLoadingMore(false);
    }
  }, [additionalPages, hasMore, initialData?.length, isLoadingMore, loadPage, pageSize, totalCount]);

  const reset = useCallback(() => {
    pageRef.current = 0;
    setHasMore(true);
    setAdditionalPages([]);
    setTotalCount(null);
    refetch();
  }, [refetch]);

  useEffect(() => {
    pageRef.current = 0;
    setAdditionalPages([]);
    setTotalCount(null);
    setHasMore(true);
    refetch();
  }, [filtersKey, refetch]);

  const allWorkOrders = useMemo(() => {
    const base = initialData || [];
    if (additionalPages.length > 0) {
      return [...base, ...additionalPages];
    }
    return base;
  }, [additionalPages, initialData]);

  return {
    workOrders: allWorkOrders,
    loading,
    error,
    loadMore,
    hasMore,
    reset,
    totalCount,
    isLoadingMore,
  };
}
