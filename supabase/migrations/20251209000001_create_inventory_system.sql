-- Inventory Management System Migration
-- Creates tables for materials catalog, stock tracking, and transactions

-- 1. MATERIALS MASTER TABLE
-- Catalog of all materials/components that can be stocked
CREATE TABLE IF NOT EXISTS public.materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  name_nl VARCHAR(255),
  description TEXT,
  category VARCHAR(50) NOT NULL DEFAULT 'component', -- component, consumable, packaging
  material_type VARCHAR(50) NOT NULL, -- Maps to existing: epoxy, piezo, pcb, etc.
  unit_of_measure VARCHAR(20) DEFAULT 'pcs', -- pcs, kg, liters, meters

  -- Tracking settings
  track_batches BOOLEAN DEFAULT true,
  track_expiry BOOLEAN DEFAULT false,
  shelf_life_days INTEGER,

  -- Supplier info (simplified)
  supplier_name VARCHAR(255),
  supplier_sku VARCHAR(100),
  lead_time_days INTEGER DEFAULT 14,

  -- Reorder settings
  reorder_point INTEGER DEFAULT 0,
  reorder_quantity INTEGER,
  min_order_quantity INTEGER DEFAULT 1,

  -- Metadata
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. INVENTORY STOCK TABLE
-- Current stock levels by material and batch
CREATE TABLE IF NOT EXISTS public.inventory_stock (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE CASCADE,
  batch_number VARCHAR(100),

  -- Quantities
  quantity_on_hand DECIMAL(10,3) NOT NULL DEFAULT 0,
  quantity_reserved DECIMAL(10,3) NOT NULL DEFAULT 0,

  -- Batch info
  received_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  opening_date DATE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Unique constraint: one record per material/batch combo
  UNIQUE(material_id, batch_number)
);

-- Create computed column for available quantity
CREATE OR REPLACE FUNCTION get_quantity_available(stock inventory_stock)
RETURNS DECIMAL(10,3) AS $$
  SELECT stock.quantity_on_hand - stock.quantity_reserved;
$$ LANGUAGE SQL STABLE;

-- 3. INVENTORY TRANSACTIONS TABLE
-- Full audit trail of all stock movements
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_type VARCHAR(50) NOT NULL, -- receive, consume, adjust, reserve, unreserve

  material_id UUID NOT NULL REFERENCES public.materials(id),
  inventory_stock_id UUID REFERENCES public.inventory_stock(id),
  batch_number VARCHAR(100),

  quantity DECIMAL(10,3) NOT NULL,
  quantity_before DECIMAL(10,3),
  quantity_after DECIMAL(10,3),

  -- Reference to source document
  reference_type VARCHAR(50), -- work_order, adjustment, receipt
  reference_id UUID,
  work_order_id UUID REFERENCES public.work_orders(id),
  work_order_item_id UUID REFERENCES public.work_order_items(id),
  production_step_id UUID,

  -- Audit
  notes TEXT,
  performed_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. MATERIAL REQUIREMENTS TABLE
-- What materials are needed for each product type / production step
CREATE TABLE IF NOT EXISTS public.material_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type VARCHAR(50) NOT NULL, -- SDM_ECO, SENSOR, MLA, HMI, TRANSMITTER
  production_step_id UUID REFERENCES public.production_steps(id),
  material_id UUID NOT NULL REFERENCES public.materials(id),
  quantity_per_unit DECIMAL(10,3) NOT NULL DEFAULT 1,
  is_optional BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),

  UNIQUE(product_type, production_step_id, material_id)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_materials_material_type ON public.materials(material_type);
CREATE INDEX IF NOT EXISTS idx_materials_active ON public.materials(active);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_material ON public.inventory_stock(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_stock_batch ON public.inventory_stock(batch_number);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_material ON public.inventory_transactions(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_type ON public.inventory_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_work_order ON public.inventory_transactions(work_order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_transactions_created ON public.inventory_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_material_requirements_product ON public.material_requirements(product_type);

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_materials_updated_at BEFORE UPDATE ON public.materials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_stock_updated_at BEFORE UPDATE ON public.inventory_stock
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================

-- Enable RLS on all inventory tables
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.material_requirements ENABLE ROW LEVEL SECURITY;

-- Helper function to check if user is admin or supervisor
CREATE OR REPLACE FUNCTION is_inventory_manager()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'supervisor')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- MATERIALS POLICIES
-- Everyone can read active materials
CREATE POLICY "Anyone can view active materials" ON public.materials
  FOR SELECT USING (active = true OR is_inventory_manager());

-- Only admins/supervisors can insert/update/delete
CREATE POLICY "Inventory managers can insert materials" ON public.materials
  FOR INSERT WITH CHECK (is_inventory_manager());

CREATE POLICY "Inventory managers can update materials" ON public.materials
  FOR UPDATE USING (is_inventory_manager());

CREATE POLICY "Inventory managers can delete materials" ON public.materials
  FOR DELETE USING (is_inventory_manager());

-- INVENTORY STOCK POLICIES
-- Everyone can read stock levels
CREATE POLICY "Anyone can view inventory stock" ON public.inventory_stock
  FOR SELECT USING (true);

-- Only admins/supervisors can manually adjust stock
CREATE POLICY "Inventory managers can insert stock" ON public.inventory_stock
  FOR INSERT WITH CHECK (is_inventory_manager());

CREATE POLICY "Inventory managers can update stock" ON public.inventory_stock
  FOR UPDATE USING (is_inventory_manager());

CREATE POLICY "Inventory managers can delete stock" ON public.inventory_stock
  FOR DELETE USING (is_inventory_manager());

-- INVENTORY TRANSACTIONS POLICIES
-- Everyone can view transactions
CREATE POLICY "Anyone can view inventory transactions" ON public.inventory_transactions
  FOR SELECT USING (true);

-- Anyone can insert transactions (for consumption during production)
-- But the service layer will validate the transaction type
CREATE POLICY "Authenticated users can insert transactions" ON public.inventory_transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Only admins can update/delete transactions (corrections)
CREATE POLICY "Admins can update transactions" ON public.inventory_transactions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete transactions" ON public.inventory_transactions
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
      AND role = 'admin'
    )
  );

-- MATERIAL REQUIREMENTS POLICIES
-- Everyone can read requirements
CREATE POLICY "Anyone can view material requirements" ON public.material_requirements
  FOR SELECT USING (true);

-- Only admins/supervisors can manage requirements
CREATE POLICY "Inventory managers can insert requirements" ON public.material_requirements
  FOR INSERT WITH CHECK (is_inventory_manager());

CREATE POLICY "Inventory managers can update requirements" ON public.material_requirements
  FOR UPDATE USING (is_inventory_manager());

CREATE POLICY "Inventory managers can delete requirements" ON public.material_requirements
  FOR DELETE USING (is_inventory_manager());

-- ============================================
-- SEED DATA: Create materials from existing material types
-- ============================================
INSERT INTO public.materials (sku, name, name_nl, material_type, category, track_batches, track_expiry, shelf_life_days, reorder_point)
VALUES
  ('MAT-EPOXY-001', 'Epoxy Adhesive', 'Epoxy Lijm', 'epoxy', 'consumable', true, true, 180, 5),
  ('MAT-PIEZO-001', 'Piezo Element', 'Piezo Element', 'piezo', 'component', true, false, NULL, 10),
  ('MAT-PCB-001', 'Electronics PCB', 'Elektronica PCB', 'pcb', 'component', true, false, NULL, 10),
  ('MAT-DISP-001', 'Display Module', 'Display Module', 'display', 'component', true, false, NULL, 5),
  ('MAT-CARRIER-001', 'Carrier Board', 'Carrier Board', 'carrier_board', 'component', true, false, NULL, 10),
  ('MAT-SOM-001', 'System on Module', 'System on Module', 'som', 'component', true, false, NULL, 5),
  ('MAT-IO-001', 'I/O Board', 'I/O Board', 'io_board', 'component', true, false, NULL, 10),
  ('MAT-SWITCH-001', 'Switch Board', 'Switch Board', 'switch_board', 'component', true, false, NULL, 10),
  ('MAT-POE-001', 'POE Board', 'POE Board', 'poe_board', 'component', true, false, NULL, 10),
  ('MAT-SD-001', 'SD Card', 'SD Kaart', 'sd_card', 'component', true, false, NULL, 20)
ON CONFLICT (sku) DO NOTHING;
