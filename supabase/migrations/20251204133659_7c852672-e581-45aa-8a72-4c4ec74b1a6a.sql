-- Add customer name, external order number, and value fields to work_orders
ALTER TABLE public.work_orders 
ADD COLUMN customer_name text,
ADD COLUMN external_order_number text,
ADD COLUMN order_value numeric(10,2);