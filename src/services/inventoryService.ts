import { supabase } from '@/integrations/supabase/client';
import { checkAndNotifyLowStock } from '@/services/notificationService';
import { triggerWebhook } from '@/lib/webhooks';

// Types
export interface Material {
  id: string;
  sku: string;
  name: string;
  name_nl: string | null;
  description: string | null;
  category: string;
  material_type: string;
  unit_of_measure: string;
  track_batches: boolean;
  track_expiry: boolean;
  shelf_life_days: number | null;
  supplier_name: string | null;
  supplier_sku: string | null;
  lead_time_days: number | null;
  reorder_point: number;
  reorder_quantity: number | null;
  min_order_quantity: number;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryStock {
  id: string;
  material_id: string;
  batch_number: string | null;
  quantity_on_hand: number;
  quantity_reserved: number;
  received_date: string | null;
  expiry_date: string | null;
  opening_date: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  material?: Material;
}

export interface InventoryTransaction {
  id: string;
  transaction_type: 'receive' | 'consume' | 'adjust' | 'reserve' | 'unreserve';
  material_id: string;
  inventory_stock_id: string | null;
  batch_number: string | null;
  quantity: number;
  quantity_before: number | null;
  quantity_after: number | null;
  reference_type: string | null;
  reference_id: string | null;
  work_order_id: string | null;
  work_order_item_id: string | null;
  production_step_id: string | null;
  notes: string | null;
  performed_by: string | null;
  created_at: string;
}

export interface StockCheckResult {
  found: boolean;
  stock: InventoryStock | null;
  material: Material | null;
  availableQuantity: number;
  message: string;
}

export interface LowStockItem {
  material: Material;
  totalOnHand: number;
  totalReserved: number;
  totalAvailable: number;
  reorderPoint: number;
}

// ============================================
// MATERIAL FUNCTIONS
// ============================================

/**
 * Get all active materials
 */
export async function getMaterials(): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('active', true)
    .order('name');

  if (error) {
    console.error('Error fetching materials:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get material by type (for mapping from existing material_type values)
 */
export async function getMaterialByType(materialType: string): Promise<Material | null> {
  const { data, error } = await supabase
    .from('materials')
    .select('*')
    .eq('material_type', materialType)
    .eq('active', true)
    .maybeSingle();

  if (error) {
    console.error('Error fetching material by type:', error);
    return null;
  }

  return data;
}

/**
 * Create a new material
 */
export async function createMaterial(
  material: Omit<Material, 'id' | 'created_at' | 'updated_at'>
): Promise<Material> {
  const { data, error } = await supabase
    .from('materials')
    .insert(material)
    .select()
    .single();

  if (error) {
    console.error('Error creating material:', error);
    throw error;
  }

  return data;
}

/**
 * Update a material
 */
export async function updateMaterial(
  id: string,
  updates: Partial<Material>
): Promise<Material> {
  const { data, error } = await supabase
    .from('materials')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error updating material:', error);
    throw error;
  }

  return data;
}

// ============================================
// STOCK FUNCTIONS
// ============================================

/**
 * Get all stock levels with material info
 */
export async function getStockLevels(): Promise<InventoryStock[]> {
  const { data, error } = await supabase
    .from('inventory_stock')
    .select(`
      *,
      material:materials(*)
    `)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching stock levels:', error);
    throw error;
  }

  return data || [];
}

/**
 * Get stock for a specific material
 */
export async function getStockByMaterial(materialId: string): Promise<InventoryStock[]> {
  const { data, error } = await supabase
    .from('inventory_stock')
    .select('*')
    .eq('material_id', materialId)
    .gt('quantity_on_hand', 0)
    .order('received_date', { ascending: true }); // FIFO

  if (error) {
    console.error('Error fetching stock by material:', error);
    throw error;
  }

  return data || [];
}

/**
 * Check if a batch number exists in inventory
 */
export async function checkBatchInInventory(
  batchNumber: string,
  materialType: string
): Promise<StockCheckResult> {
  // First, find the material by type
  const material = await getMaterialByType(materialType);

  if (!material) {
    return {
      found: false,
      stock: null,
      material: null,
      availableQuantity: 0,
      message: `Material type "${materialType}" not found in system`,
    };
  }

  // Then check if batch exists in stock
  const { data: stock, error } = await supabase
    .from('inventory_stock')
    .select('*')
    .eq('material_id', material.id)
    .eq('batch_number', batchNumber)
    .maybeSingle();

  if (error) {
    console.error('Error checking batch in inventory:', error);
    return {
      found: false,
      stock: null,
      material,
      availableQuantity: 0,
      message: 'Error checking inventory',
    };
  }

  if (!stock) {
    return {
      found: false,
      stock: null,
      material,
      availableQuantity: 0,
      message: `Batch "${batchNumber}" not found in inventory`,
    };
  }

  const available = stock.quantity_on_hand - stock.quantity_reserved;

  if (available <= 0) {
    return {
      found: true,
      stock,
      material,
      availableQuantity: 0,
      message: `Batch "${batchNumber}" has no available stock (all reserved)`,
    };
  }

  return {
    found: true,
    stock,
    material,
    availableQuantity: available,
    message: `Found ${available} ${material.unit_of_measure} available`,
  };
}

/**
 * Receive stock into inventory
 */
export async function receiveStock(params: {
  materialId: string;
  batchNumber: string | null;
  quantity: number;
  expiryDate?: string;
  notes?: string;
  userId: string;
}): Promise<InventoryStock> {
  const { materialId, batchNumber, quantity, expiryDate, notes, userId } = params;

  // Check if stock record already exists for this material/batch
  const { data: existing } = await supabase
    .from('inventory_stock')
    .select('*')
    .eq('material_id', materialId)
    .eq('batch_number', batchNumber || '')
    .maybeSingle();

  let stock: InventoryStock;

  if (existing) {
    // Update existing stock
    const newQuantity = existing.quantity_on_hand + quantity;
    const { data, error } = await supabase
      .from('inventory_stock')
      .update({
        quantity_on_hand: newQuantity,
        expiry_date: expiryDate || existing.expiry_date,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    stock = data;

    // Log transaction
    await logTransaction({
      transactionType: 'receive',
      materialId,
      inventoryStockId: existing.id,
      batchNumber,
      quantity,
      quantityBefore: existing.quantity_on_hand,
      quantityAfter: newQuantity,
      notes,
      userId,
    });
  } else {
    // Create new stock record
    const { data, error } = await supabase
      .from('inventory_stock')
      .insert({
        material_id: materialId,
        batch_number: batchNumber,
        quantity_on_hand: quantity,
        quantity_reserved: 0,
        received_date: new Date().toISOString().split('T')[0],
        expiry_date: expiryDate,
      })
      .select()
      .single();

    if (error) throw error;
    stock = data;

    // Log transaction
    await logTransaction({
      transactionType: 'receive',
      materialId,
      inventoryStockId: stock.id,
      batchNumber,
      quantity,
      quantityBefore: 0,
      quantityAfter: quantity,
      notes,
      userId,
    });
  }

  return stock;
}

/**
 * Consume stock from inventory (when batch is scanned during production)
 */
export async function consumeStock(params: {
  materialId: string;
  batchNumber: string;
  quantity: number;
  workOrderId?: string;
  workOrderItemId?: string;
  productionStepId?: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  const {
    materialId,
    batchNumber,
    quantity,
    workOrderId,
    workOrderItemId,
    productionStepId,
    userId,
  } = params;

  // Find the stock record
  const { data: stock, error: fetchError } = await supabase
    .from('inventory_stock')
    .select('*')
    .eq('material_id', materialId)
    .eq('batch_number', batchNumber)
    .maybeSingle();

  if (fetchError) {
    console.error('Error fetching stock for consumption:', fetchError);
    return { success: false, error: 'Failed to fetch stock record' };
  }

  if (!stock) {
    return { success: false, error: `Batch "${batchNumber}" not found in inventory` };
  }

  const available = stock.quantity_on_hand - stock.quantity_reserved;
  if (available < quantity) {
    return {
      success: false,
      error: `Insufficient stock. Available: ${available}, Requested: ${quantity}`,
    };
  }

  // Update stock
  const newQuantity = stock.quantity_on_hand - quantity;
  const { error: updateError } = await supabase
    .from('inventory_stock')
    .update({ quantity_on_hand: newQuantity })
    .eq('id', stock.id);

  if (updateError) {
    console.error('Error updating stock:', updateError);
    return { success: false, error: 'Failed to update stock' };
  }

  // Log transaction
  await logTransaction({
    transactionType: 'consume',
    materialId,
    inventoryStockId: stock.id,
    batchNumber,
    quantity: -quantity, // Negative for consumption
    quantityBefore: stock.quantity_on_hand,
    quantityAfter: newQuantity,
    workOrderId,
    workOrderItemId,
    productionStepId,
    userId,
  });

  // Check for low stock and trigger notifications/webhooks
  await checkLowStockAfterConsumption(materialId, newQuantity);

  return { success: true };
}

/**
 * Check stock levels after consumption and trigger alerts if needed
 */
async function checkLowStockAfterConsumption(
  materialId: string,
  newQuantity: number
): Promise<void> {
  try {
    // Get material details
    const { data: material, error } = await supabase
      .from('materials')
      .select('id, name, reorder_point')
      .eq('id', materialId)
      .single();

    if (error || !material) return;

    // Get total stock for this material across all batches
    const { data: allStock } = await supabase
      .from('inventory_stock')
      .select('quantity_on_hand, quantity_reserved')
      .eq('material_id', materialId);

    const totalOnHand = (allStock || []).reduce((sum, s) => sum + Number(s.quantity_on_hand), 0);
    const totalReserved = (allStock || []).reduce((sum, s) => sum + Number(s.quantity_reserved), 0);
    const totalAvailable = totalOnHand - totalReserved;

    // Check if below reorder point
    if (totalAvailable <= material.reorder_point) {
      // Trigger in-app notifications
      await checkAndNotifyLowStock(
        materialId,
        material.name,
        totalAvailable,
        material.reorder_point
      );

      // Trigger webhook for low stock
      await triggerWebhook('low_stock_alert', {
        material_id: materialId,
        material_name: material.name,
        current_quantity: totalAvailable,
        reorder_point: material.reorder_point,
        is_out_of_stock: totalAvailable <= 0,
      });
    }
  } catch (err) {
    console.error('Error checking low stock after consumption:', err);
  }
}

/**
 * Adjust stock (for corrections, damaged items, etc.)
 */
export async function adjustStock(params: {
  stockId: string;
  newQuantity: number;
  reason: string;
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  const { stockId, newQuantity, reason, userId } = params;

  const { data: stock, error: fetchError } = await supabase
    .from('inventory_stock')
    .select('*')
    .eq('id', stockId)
    .single();

  if (fetchError || !stock) {
    return { success: false, error: 'Stock record not found' };
  }

  const { error: updateError } = await supabase
    .from('inventory_stock')
    .update({ quantity_on_hand: newQuantity })
    .eq('id', stockId);

  if (updateError) {
    return { success: false, error: 'Failed to update stock' };
  }

  // Log adjustment
  await logTransaction({
    transactionType: 'adjust',
    materialId: stock.material_id,
    inventoryStockId: stockId,
    batchNumber: stock.batch_number,
    quantity: newQuantity - stock.quantity_on_hand,
    quantityBefore: stock.quantity_on_hand,
    quantityAfter: newQuantity,
    notes: reason,
    userId,
  });

  return { success: true };
}

// ============================================
// LOW STOCK ALERTS
// ============================================

/**
 * Get materials that are below their reorder point
 */
export async function getLowStockItems(): Promise<LowStockItem[]> {
  // Get all materials with reorder points
  const { data: materials, error: matError } = await supabase
    .from('materials')
    .select('*')
    .eq('active', true)
    .gt('reorder_point', 0);

  if (matError || !materials) {
    console.error('Error fetching materials for low stock check:', matError);
    return [];
  }

  // Get stock totals by material
  const { data: stockData, error: stockError } = await supabase
    .from('inventory_stock')
    .select('material_id, quantity_on_hand, quantity_reserved');

  if (stockError) {
    console.error('Error fetching stock for low stock check:', stockError);
    return [];
  }

  // Aggregate stock by material
  const stockByMaterial: Record<string, { onHand: number; reserved: number }> = {};
  for (const stock of stockData || []) {
    if (!stockByMaterial[stock.material_id]) {
      stockByMaterial[stock.material_id] = { onHand: 0, reserved: 0 };
    }
    stockByMaterial[stock.material_id].onHand += Number(stock.quantity_on_hand);
    stockByMaterial[stock.material_id].reserved += Number(stock.quantity_reserved);
  }

  // Find low stock items
  const lowStockItems: LowStockItem[] = [];
  for (const material of materials) {
    const stock = stockByMaterial[material.id] || { onHand: 0, reserved: 0 };
    const available = stock.onHand - stock.reserved;

    if (available < material.reorder_point) {
      lowStockItems.push({
        material,
        totalOnHand: stock.onHand,
        totalReserved: stock.reserved,
        totalAvailable: available,
        reorderPoint: material.reorder_point,
      });
    }
  }

  return lowStockItems;
}

// ============================================
// TRANSACTION LOGGING
// ============================================

async function logTransaction(params: {
  transactionType: InventoryTransaction['transaction_type'];
  materialId: string;
  inventoryStockId?: string | null;
  batchNumber?: string | null;
  quantity: number;
  quantityBefore?: number | null;
  quantityAfter?: number | null;
  referenceType?: string;
  referenceId?: string;
  workOrderId?: string;
  workOrderItemId?: string;
  productionStepId?: string;
  notes?: string;
  userId: string;
}): Promise<void> {
  const { error } = await supabase.from('inventory_transactions').insert({
    transaction_type: params.transactionType,
    material_id: params.materialId,
    inventory_stock_id: params.inventoryStockId,
    batch_number: params.batchNumber,
    quantity: params.quantity,
    quantity_before: params.quantityBefore,
    quantity_after: params.quantityAfter,
    reference_type: params.referenceType,
    reference_id: params.referenceId,
    work_order_id: params.workOrderId,
    work_order_item_id: params.workOrderItemId,
    production_step_id: params.productionStepId,
    notes: params.notes,
    performed_by: params.userId,
  });

  if (error) {
    console.error('Error logging inventory transaction:', error);
  }
}

/**
 * Get recent transactions
 */
export async function getRecentTransactions(limit = 20): Promise<InventoryTransaction[]> {
  const { data, error } = await supabase
    .from('inventory_transactions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching transactions:', error);
    return [];
  }

  return (data || []) as InventoryTransaction[];
}
