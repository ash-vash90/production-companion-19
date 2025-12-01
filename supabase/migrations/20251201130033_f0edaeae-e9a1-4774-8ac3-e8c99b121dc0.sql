-- Remove the unique constraint that's blocking step re-execution
-- This allows multiple execution attempts for the same step (e.g., retries after failures)
ALTER TABLE step_executions 
DROP CONSTRAINT IF EXISTS step_executions_work_order_item_id_production_step_id_key;

-- Create an index for performance since we're removing the unique constraint
CREATE INDEX IF NOT EXISTS idx_step_executions_item_step 
ON step_executions(work_order_item_id, production_step_id);