-- Materials master table for all trackable components and consumables
CREATE TABLE public.materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  name_nl TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'component',
  material_type TEXT NOT NULL,
  unit_of_measure TEXT NOT NULL DEFAULT 'pcs',
  track_batches BOOLEAN NOT NULL DEFAULT true,
  track_expiry BOOLEAN NOT NULL DEFAULT false,
  shelf_life_days INTEGER,
  supplier_name TEXT,
  supplier_sku TEXT,
  lead_time_days INTEGER,
  reorder_point INTEGER NOT NULL DEFAULT 0,
  reorder_quantity INTEGER,
  min_order_quantity INTEGER NOT NULL DEFAULT 1,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Inventory stock levels per batch
CREATE TABLE public.inventory_stock (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  batch_number TEXT,
  quantity_on_hand INTEGER NOT NULL DEFAULT 0,
  quantity_reserved INTEGER NOT NULL DEFAULT 0,
  received_date DATE,
  expiry_date DATE,
  opening_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(material_id, batch_number)
);

-- Inventory transactions for audit trail
CREATE TABLE public.inventory_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('receive', 'consume', 'adjust', 'reserve', 'unreserve')),
  material_id UUID NOT NULL REFERENCES public.materials(id) ON DELETE RESTRICT,
  inventory_stock_id UUID REFERENCES public.inventory_stock(id) ON DELETE SET NULL,
  batch_number TEXT,
  quantity INTEGER NOT NULL,
  quantity_before INTEGER,
  quantity_after INTEGER,
  reference_type TEXT,
  reference_id UUID,
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  work_order_item_id UUID REFERENCES public.work_order_items(id) ON DELETE SET NULL,
  production_step_id UUID REFERENCES public.production_steps(id) ON DELETE SET NULL,
  notes TEXT,
  performed_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for materials (viewable by all, manageable by admins/supervisors/logistics)
CREATE POLICY "Users can view all materials" ON public.materials FOR SELECT USING (true);

CREATE POLICY "Admins and logistics can manage materials" ON public.materials FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'supervisor', 'logistics')
  )
);

-- RLS policies for inventory_stock
CREATE POLICY "Users can view all stock" ON public.inventory_stock FOR SELECT USING (true);

CREATE POLICY "Admins and logistics can manage stock" ON public.inventory_stock FOR ALL USING (
  EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'supervisor', 'logistics')
  )
);

-- RLS policies for inventory_transactions
CREATE POLICY "Users can view all transactions" ON public.inventory_transactions FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert transactions" ON public.inventory_transactions FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Create indexes for performance
CREATE INDEX idx_materials_material_type ON public.materials(material_type);
CREATE INDEX idx_materials_active ON public.materials(active);
CREATE INDEX idx_inventory_stock_material_id ON public.inventory_stock(material_id);
CREATE INDEX idx_inventory_stock_batch_number ON public.inventory_stock(batch_number);
CREATE INDEX idx_inventory_transactions_material_id ON public.inventory_transactions(material_id);
CREATE INDEX idx_inventory_transactions_created_at ON public.inventory_transactions(created_at);

-- Updated_at trigger for materials
CREATE TRIGGER update_materials_updated_at
  BEFORE UPDATE ON public.materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Updated_at trigger for inventory_stock
CREATE TRIGGER update_inventory_stock_updated_at
  BEFORE UPDATE ON public.inventory_stock
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Seed some common materials
INSERT INTO public.materials (sku, name, name_nl, material_type, category, unit_of_measure, track_batches, track_expiry, reorder_point) VALUES
('MAT-EPOXY-001', 'Epoxy Resin', 'Epoxy Hars', 'EPOXY', 'consumable', 'ml', true, true, 100),
('MAT-PIEZO-001', 'Piezo Element', 'Piezo Element', 'PIEZO', 'component', 'pcs', true, false, 20),
('MAT-PCB-ELEC-001', 'Electronics PCB', 'Elektronica PCB', 'ELECTRONICS_PCB', 'component', 'pcs', true, false, 10),
('MAT-DISPLAY-001', 'LCD Display', 'LCD Scherm', 'DISPLAY', 'component', 'pcs', true, false, 10),
('MAT-CARRIER-001', 'Carrier Board', 'Draagbord', 'CARRIER_BOARD', 'component', 'pcs', true, false, 10),
('MAT-SOM-001', 'System on Module', 'System on Module', 'SOM', 'component', 'pcs', true, false, 5),
('MAT-IO-001', 'I/O Board', 'I/O Bord', 'IO_BOARD', 'component', 'pcs', true, false, 10),
('MAT-SWITCH-001', 'Switch Board', 'Schakelbord', 'SWITCH_BOARD', 'component', 'pcs', true, false, 10),
('MAT-POE-001', 'POE Board', 'POE Bord', 'POE_BOARD', 'component', 'pcs', true, false, 10);