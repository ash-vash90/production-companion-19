-- Add items_group column to products table
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS items_group text;

-- Create index for faster filtering by group
CREATE INDEX IF NOT EXISTS idx_products_items_group ON public.products(items_group);

-- Create sync_configurations table for webhook scheduling
CREATE TABLE IF NOT EXISTS public.sync_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type text NOT NULL UNIQUE,
  webhook_url text,
  frequency text NOT NULL DEFAULT 'hourly',
  scheduled_time time,
  timezone text NOT NULL DEFAULT 'Europe/Amsterdam',
  enabled boolean NOT NULL DEFAULT false,
  last_synced_at timestamptz,
  next_sync_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sync_configurations ENABLE ROW LEVEL SECURITY;

-- Only admins can manage sync configurations
CREATE POLICY "Admins can manage sync configurations"
ON public.sync_configurations FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Users can view sync configurations
CREATE POLICY "Users can view sync configurations"
ON public.sync_configurations FOR SELECT
USING (true);

-- Insert default items sync configuration
INSERT INTO public.sync_configurations (sync_type, frequency, enabled)
VALUES ('items', 'hourly', false)
ON CONFLICT (sync_type) DO NOTHING;