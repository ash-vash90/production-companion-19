import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useResilientQuery } from './useResilientQuery';
import { getProductBreakdown, ProductBreakdown } from '@/lib/utils';

// Global cache for production reports
const reportsCache = new Map<string, { data: any[]; timestamp: number }>();
const CACHE_TTL = 60000; // 60 seconds for reports (less frequently updated)

export interface ProductionReportItem {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  completed_at: string | null;
  customer_name: string | null;
  productBreakdown: ProductBreakdown[];
}

type WorkOrderStatus = 'planned' | 'in_progress' | 'completed' | 'on_hold' | 'cancelled';

interface UseProductionReportsOptions {
  limit?: number;
  statusFilter?: WorkOrderStatus | 'all';
}

/**
 * Optimized hook for fetching production reports with caching and resilience
 */
export function useProductionReports(options: UseProductionReportsOptions = {}) {
  const { limit, statusFilter } = options;
  const cacheKey = `reports_${limit}_${statusFilter}`;

  const fetchReports = useCallback(async (): Promise<ProductionReportItem[]> => {
    // Check cache first
    const cached = reportsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    let query = supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, customer_name')
      .order('created_at', { ascending: false });

    if (statusFilter && statusFilter !== 'all') {
      query = query.eq('status', statusFilter as WorkOrderStatus);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const { data: workOrdersData, error } = await query;
    if (error) throw error;

    const woIds = workOrdersData?.map(wo => wo.id) || [];
    
    let itemsMap: Record<string, Array<{ serial_number: string }>> = {};
    if (woIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('work_order_items')
        .select('work_order_id, serial_number')
        .in('work_order_id', woIds);
      
      for (const item of itemsData || []) {
        if (!itemsMap[item.work_order_id]) {
          itemsMap[item.work_order_id] = [];
        }
        itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
      }
    }

    const enrichedData = (workOrdersData || []).map(wo => ({
      ...wo,
      productBreakdown: getProductBreakdown(itemsMap[wo.id] || [])
    })) as ProductionReportItem[];

    // Update cache
    reportsCache.set(cacheKey, { data: enrichedData, timestamp: Date.now() });
    
    return enrichedData;
  }, [cacheKey, limit, statusFilter]);

  const { data, loading, error, refetch, isStale } = useResilientQuery<ProductionReportItem[]>({
    queryFn: fetchReports,
    fallbackData: [],
    timeout: 15000,
    retryCount: 3,
  });

  return {
    reports: data || [],
    loading,
    error,
    refetch,
    isStale,
  };
}

/**
 * Prefetch production reports data
 */
export async function prefetchProductionReports(): Promise<void> {
  const cacheKey = 'reports_50_undefined';
  
  const cached = reportsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return;
  }

  try {
    const { data: workOrdersData } = await supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, customer_name')
      .order('created_at', { ascending: false })
      .limit(50);

    if (!workOrdersData) return;

    const woIds = workOrdersData.map(wo => wo.id);
    
    let itemsMap: Record<string, Array<{ serial_number: string }>> = {};
    if (woIds.length > 0) {
      const { data: itemsData } = await supabase
        .from('work_order_items')
        .select('work_order_id, serial_number')
        .in('work_order_id', woIds);
      
      for (const item of itemsData || []) {
        if (!itemsMap[item.work_order_id]) itemsMap[item.work_order_id] = [];
        itemsMap[item.work_order_id].push({ serial_number: item.serial_number });
      }
    }

    const enrichedData = workOrdersData.map(wo => ({
      ...wo,
      productBreakdown: getProductBreakdown(itemsMap[wo.id] || [])
    }));

    reportsCache.set(cacheKey, { data: enrichedData, timestamp: Date.now() });
  } catch (error) {
    console.error('Prefetch production reports failed:', error);
  }
}

/**
 * Invalidate reports cache
 */
export function invalidateReportsCache(): void {
  reportsCache.clear();
}
