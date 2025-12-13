-- Add cancellation_reason column to work_orders table
ALTER TABLE public.work_orders ADD COLUMN cancellation_reason TEXT NULL;