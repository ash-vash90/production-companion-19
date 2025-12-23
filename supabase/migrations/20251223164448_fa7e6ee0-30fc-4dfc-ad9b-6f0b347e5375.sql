-- Create products table for Exact sync (items that can be built)
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exact_item_id TEXT UNIQUE NOT NULL,
  item_code TEXT NOT NULL,
  name TEXT NOT NULL,
  name_nl TEXT,
  description TEXT,
  product_type TEXT NOT NULL DEFAULT 'SDM_ECO',
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- All users can view products
CREATE POLICY "Users can view all products" ON public.products
FOR SELECT USING (true);

-- Service role can manage products (webhook sync)
CREATE POLICY "Service can manage products" ON public.products
FOR ALL USING (true) WITH CHECK (true);

-- Create index for fast lookup
CREATE INDEX idx_products_exact_item_id ON public.products(exact_item_id);
CREATE INDEX idx_products_item_code ON public.products(item_code);
CREATE INDEX idx_products_active ON public.products(is_active) WHERE is_active = true;

-- Add product_id to work_orders for linking to synced products
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id);

-- Rename columns for clarity (planned dates)
COMMENT ON COLUMN public.work_orders.start_date IS 'Planned Start Date';
COMMENT ON COLUMN public.work_orders.shipping_date IS 'Planned End Date';