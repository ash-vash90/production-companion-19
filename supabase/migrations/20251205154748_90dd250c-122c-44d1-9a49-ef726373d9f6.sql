-- Add product_type column to work_order_items to support multi-product work orders
ALTER TABLE public.work_order_items 
ADD COLUMN product_type text;

-- Create index for querying items by product type
CREATE INDEX idx_work_order_items_product_type ON public.work_order_items(product_type);