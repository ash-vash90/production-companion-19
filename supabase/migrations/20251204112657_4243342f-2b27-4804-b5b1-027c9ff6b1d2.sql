-- Enable realtime for work_orders table
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders;

-- Enable realtime for work_order_items table  
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_items;

-- Enable realtime for notifications table (should already be enabled but just in case)
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;