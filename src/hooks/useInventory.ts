import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getStockLevels,
  getStockByMaterial,
  checkBatchInInventory,
  receiveStock,
  consumeStock,
  adjustStock,
  getLowStockItems,
  getRecentTransactions,
  InventoryStock,
  StockCheckResult,
  LowStockItem,
  InventoryTransaction,
} from '@/services/inventoryService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useLanguage } from '@/contexts/LanguageContext';

const QUERY_KEYS = {
  stockLevels: ['inventory', 'stock'],
  stockByMaterial: (materialId: string) => ['inventory', 'stock', materialId],
  lowStock: ['inventory', 'low-stock'],
  transactions: ['inventory', 'transactions'],
};

/**
 * Hook for fetching all stock levels
 */
export function useStockLevels() {
  return useQuery<InventoryStock[]>({
    queryKey: QUERY_KEYS.stockLevels,
    queryFn: getStockLevels,
  });
}

/**
 * Hook for fetching stock for a specific material
 */
export function useStockByMaterial(materialId: string | null) {
  return useQuery<InventoryStock[]>({
    queryKey: QUERY_KEYS.stockByMaterial(materialId || ''),
    queryFn: () => (materialId ? getStockByMaterial(materialId) : Promise.resolve([])),
    enabled: !!materialId,
  });
}

/**
 * Hook for checking if a batch exists in inventory
 */
export function useBatchCheck() {
  const checkBatch = async (
    batchNumber: string,
    materialType: string
  ): Promise<StockCheckResult> => {
    return checkBatchInInventory(batchNumber, materialType);
  };

  return { checkBatch };
}

/**
 * Hook for low stock alerts
 */
export function useLowStock() {
  return useQuery<LowStockItem[]>({
    queryKey: QUERY_KEYS.lowStock,
    queryFn: getLowStockItems,
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchIntervalInBackground: false, // Stop refetching when tab is inactive
  });
}

/**
 * Hook for recent transactions
 */
export function useRecentTransactions(limit = 20) {
  return useQuery<InventoryTransaction[]>({
    queryKey: [...QUERY_KEYS.transactions, limit],
    queryFn: () => getRecentTransactions(limit),
  });
}

/**
 * Hook for receiving stock
 */
export function useReceiveStock() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      materialId: string;
      batchNumber: string | null;
      quantity: number;
      expiryDate?: string;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      return receiveStock({ ...params, userId: user.id });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockLevels });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lowStock });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      toast.success(
        language === 'nl' ? 'Voorraad ontvangen' : 'Stock received'
      );
    },
    onError: (error) => {
      console.error('Error receiving stock:', error);
      toast.error(
        language === 'nl' ? 'Fout bij ontvangen voorraad' : 'Error receiving stock'
      );
    },
  });
}

/**
 * Hook for consuming stock (during production)
 */
export function useConsumeStock() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      materialId: string;
      batchNumber: string;
      quantity: number;
      workOrderId?: string;
      workOrderItemId?: string;
      productionStepId?: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await consumeStock({ ...params, userId: user.id });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockLevels });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lowStock });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
    },
    onError: (error) => {
      console.error('Error consuming stock:', error);
      toast.error(
        language === 'nl'
          ? `Fout bij verbruiken voorraad: ${error.message}`
          : `Error consuming stock: ${error.message}`
      );
    },
  });
}

/**
 * Hook for adjusting stock
 */
export function useAdjustStock() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      stockId: string;
      newQuantity: number;
      reason: string;
    }) => {
      if (!user?.id) throw new Error('Not authenticated');
      const result = await adjustStock({ ...params, userId: user.id });
      if (!result.success) {
        throw new Error(result.error);
      }
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.stockLevels });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lowStock });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.transactions });
      toast.success(
        language === 'nl' ? 'Voorraad aangepast' : 'Stock adjusted'
      );
    },
    onError: (error) => {
      console.error('Error adjusting stock:', error);
      toast.error(
        language === 'nl' ? 'Fout bij aanpassen voorraad' : 'Error adjusting stock'
      );
    },
  });
}
