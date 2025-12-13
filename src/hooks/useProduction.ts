import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useResilientQuery } from './useResilientQuery';

// Global cache for production data
const productionCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 15000; // 15 seconds for production (needs fresher data)

export interface ProductionWorkOrder {
  id: string;
  wo_number: string;
  product_type: string;
  batch_size: number;
  status: string;
  created_at: string;
  start_date: string | null;
  shipping_date: string | null;
  customer_name: string | null;
  external_order_number: string | null;
  order_value: number | null;
}

export interface ProductionItem {
  id: string;
  serial_number: string;
  status: string;
  current_step: number;
  position_in_batch: number;
  product_type: string | null;
  assigned_to: string | null;
  quality_approved: boolean;
  certificate_generated: boolean;
  label_printed: boolean;
  operator_initials: string | null;
  completed_at: string | null;
}

interface ProductionData {
  workOrder: ProductionWorkOrder | null;
  items: ProductionItem[];
}

/**
 * Optimized hook for fetching production data with caching and resilience
 */
export function useProduction(workOrderId: string | undefined) {
  const cacheKey = `production_${workOrderId}`;
  const realtimeChannelRef = useRef<any>(null);

  const fetchProductionData = useCallback(async (): Promise<ProductionData> => {
    if (!workOrderId) {
      return { workOrder: null, items: [] };
    }

    // Check cache first
    const cached = productionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.data;
    }

    const [woResult, itemsResult] = await Promise.all([
      supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, start_date, shipping_date, customer_name, external_order_number, order_value')
        .eq('id', workOrderId)
        .single(),
      supabase
        .from('work_order_items')
        .select('id, serial_number, status, current_step, position_in_batch, product_type, assigned_to, quality_approved, certificate_generated, label_printed, operator_initials, completed_at')
        .eq('work_order_id', workOrderId)
        .order('position_in_batch', { ascending: true })
    ]);

    if (woResult.error) throw woResult.error;
    if (itemsResult.error) throw itemsResult.error;

    const result = {
      workOrder: woResult.data as ProductionWorkOrder,
      items: (itemsResult.data || []) as ProductionItem[]
    };

    // Update cache
    productionCache.set(cacheKey, { data: result, timestamp: Date.now() });
    
    return result;
  }, [workOrderId, cacheKey]);

  const { data, loading, error, refetch, isStale } = useResilientQuery<ProductionData>({
    queryFn: fetchProductionData,
    fallbackData: { workOrder: null, items: [] },
    timeout: 12000,
    retryCount: 3,
    enabled: !!workOrderId,
  });

  // Set up realtime subscription
  const setupRealtime = useCallback(() => {
    if (!workOrderId || realtimeChannelRef.current) return;

    let debounceTimer: NodeJS.Timeout;
    const channel = supabase
      .channel(`production-${workOrderId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'work_order_items', filter: `work_order_id=eq.${workOrderId}` },
        () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            productionCache.delete(cacheKey);
            refetch();
          }, 300);
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
  }, [workOrderId, cacheKey, refetch]);

  return {
    workOrder: data?.workOrder || null,
    items: data?.items || [],
    loading,
    error,
    refetch,
    isStale,
    setupRealtime,
  };
}

/**
 * Prefetch production data for a specific work order
 */
export async function prefetchProduction(workOrderId: string): Promise<void> {
  const cacheKey = `production_${workOrderId}`;
  
  const cached = productionCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return;
  }

  try {
    const [woResult, itemsResult] = await Promise.all([
      supabase
        .from('work_orders')
        .select('id, wo_number, product_type, batch_size, status, created_at, start_date, shipping_date, customer_name, external_order_number, order_value')
        .eq('id', workOrderId)
        .single(),
      supabase
        .from('work_order_items')
        .select('id, serial_number, status, current_step, position_in_batch, product_type, assigned_to, quality_approved, certificate_generated, label_printed, operator_initials, completed_at')
        .eq('work_order_id', workOrderId)
        .order('position_in_batch', { ascending: true })
    ]);

    if (woResult.data) {
      productionCache.set(cacheKey, {
        data: {
          workOrder: woResult.data,
          items: itemsResult.data || []
        },
        timestamp: Date.now()
      });
    }
  } catch (error) {
    console.error('Prefetch production failed:', error);
  }
}

/**
 * Invalidate production cache for a specific work order
 */
export function invalidateProductionCache(workOrderId?: string): void {
  if (workOrderId) {
    productionCache.delete(`production_${workOrderId}`);
  } else {
    productionCache.clear();
  }
}
