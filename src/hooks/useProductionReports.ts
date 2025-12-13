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
  shipping_date: string | null;
  start_date: string | null;
  order_value: number | null;
  cancellation_reason: string | null;
  productBreakdown: ProductBreakdown[];
  isMainAssembly: boolean;
  hasSubassemblies: boolean;
}

interface UseProductionReportsOptions {
  limit?: number;
}

/**
 * Optimized hook for fetching production reports (completed/cancelled orders only)
 * with caching and resilience
 */
export function useProductionReports(options: UseProductionReportsOptions = {}) {
  const { limit } = options;
  const cacheKey = `reports_${limit}`;

  const fetchReports = useCallback(async (): Promise<ProductionReportItem[]> => {
    // Check cache first
    const cached = reportsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    // Only fetch completed and cancelled orders for production reports
    let query = supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, customer_name, shipping_date, start_date, order_value, cancellation_reason')
      .in('status', ['completed', 'cancelled'])
      .order('completed_at', { ascending: false, nullsFirst: false });

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

    const enrichedData = (workOrdersData || []).map(wo => {
      const breakdown = getProductBreakdown(itemsMap[wo.id] || []);
      const hasSDM_ECO = breakdown.some(b => b.type === 'SDM_ECO');
      const hasSubassemblies = breakdown.some(b => ['SENSOR', 'MLA', 'HMI', 'TRANSMITTER'].includes(b.type));
      
      return {
        ...wo,
        productBreakdown: breakdown,
        isMainAssembly: hasSDM_ECO,
        hasSubassemblies: hasSubassemblies,
      };
    }) as ProductionReportItem[];

    // Update cache
    reportsCache.set(cacheKey, { data: enrichedData, timestamp: Date.now() });
    
    return enrichedData;
  }, [cacheKey, limit]);

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
  const cacheKey = 'reports_50';
  
  const cached = reportsCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return;
  }

  try {
    const { data: workOrdersData } = await supabase
      .from('work_orders')
      .select('id, wo_number, product_type, batch_size, status, created_at, completed_at, customer_name, shipping_date, start_date, order_value, cancellation_reason')
      .in('status', ['completed', 'cancelled'])
      .order('completed_at', { ascending: false, nullsFirst: false })
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

    const enrichedData = workOrdersData.map(wo => {
      const breakdown = getProductBreakdown(itemsMap[wo.id] || []);
      return {
        ...wo,
        productBreakdown: breakdown,
        isMainAssembly: breakdown.some(b => b.type === 'SDM_ECO'),
        hasSubassemblies: breakdown.some(b => ['SENSOR', 'MLA', 'HMI', 'TRANSMITTER'].includes(b.type)),
      };
    });

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
