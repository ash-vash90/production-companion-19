-- Add start_date and shipping_date columns to work_orders table
ALTER TABLE public.work_orders
ADD COLUMN start_date date,
ADD COLUMN shipping_date date;

-- Migrate existing scheduled_date data to start_date
UPDATE public.work_orders
SET start_date = scheduled_date
WHERE scheduled_date IS NOT NULL;

-- Comment for clarity
COMMENT ON COLUMN public.work_orders.start_date IS 'The date when production should start';
COMMENT ON COLUMN public.work_orders.shipping_date IS 'The date when the order should be shipped';