-- Create customers table for Exact sync
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exact_customer_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  name_nl TEXT,
  email TEXT,
  phone TEXT,
  address JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view customers
CREATE POLICY "Users can view all customers" ON public.customers FOR SELECT USING (true);

-- Service role (webhooks) can manage customers
CREATE POLICY "Service can manage customers" ON public.customers FOR ALL USING (true) WITH CHECK (true);

-- Add customer_id foreign key to work_orders
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES public.customers(id);

-- Add index for customer lookups
CREATE INDEX IF NOT EXISTS idx_work_orders_customer_id ON public.work_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_exact_customer_id ON public.customers(exact_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers(name);

-- Add realtime for customers
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;