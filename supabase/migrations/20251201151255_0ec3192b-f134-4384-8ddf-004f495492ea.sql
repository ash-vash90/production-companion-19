-- Add scheduled_date column to work_orders table for calendar scheduling
ALTER TABLE work_orders 
ADD COLUMN scheduled_date date;

-- Create index for scheduled_date for better query performance
CREATE INDEX idx_work_orders_scheduled_date ON work_orders(scheduled_date);