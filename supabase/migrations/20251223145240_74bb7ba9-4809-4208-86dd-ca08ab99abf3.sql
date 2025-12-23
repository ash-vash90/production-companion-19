-- Add Exact sync fields to work_orders table
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS exact_shop_order_number TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS exact_shop_order_link TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'not_sent';
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS last_sync_error TEXT;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS sync_retry_count INTEGER DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS production_ready_date DATE;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS materials_summary JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS materials_issued_status TEXT DEFAULT 'not_issued';

-- Add batch assignment fields to work_order_items table
ALTER TABLE public.work_order_items ADD COLUMN IF NOT EXISTS batch_number TEXT;
ALTER TABLE public.work_order_items ADD COLUMN IF NOT EXISTS batch_assigned_at TIMESTAMPTZ;

-- Add index for sync status queries
CREATE INDEX IF NOT EXISTS idx_work_orders_sync_status ON public.work_orders(sync_status);
CREATE INDEX IF NOT EXISTS idx_work_orders_exact_shop_order ON public.work_orders(exact_shop_order_number);

-- Add comment for documentation
COMMENT ON COLUMN public.work_orders.sync_status IS 'Sync state: not_sent, waiting_for_exact, synced, sync_failed, out_of_sync';
COMMENT ON COLUMN public.work_orders.materials_issued_status IS 'Materials issue state: not_issued, partial, complete';
COMMENT ON COLUMN public.work_orders.materials_summary IS 'JSON containing projected stock, in stock, shortages from Exact';