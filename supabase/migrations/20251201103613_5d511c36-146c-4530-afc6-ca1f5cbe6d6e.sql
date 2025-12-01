-- Add operator initials enum
CREATE TYPE operator_initials AS ENUM ('MB', 'HL', 'AB', 'EV');

-- Update work_order_items to track operator and additional fields
ALTER TABLE work_order_items
ADD COLUMN operator_initials operator_initials,
ADD COLUMN label_printed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN label_printed_by UUID;

-- Update step_executions to include operator and more detailed tracking
ALTER TABLE step_executions
ADD COLUMN operator_initials operator_initials,
ADD COLUMN validation_status TEXT DEFAULT 'pending', -- pending, passed, failed
ADD COLUMN validation_message TEXT,
ADD COLUMN measurement_values JSONB DEFAULT '{}',
ADD COLUMN retry_count INTEGER DEFAULT 0;

-- Add batch_materials table for tracking all scanned materials
CREATE TABLE batch_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_item_id UUID REFERENCES work_order_items(id) ON DELETE CASCADE NOT NULL,
  material_type TEXT NOT NULL, -- epoxy, piezo, pcb, display, carrier_board, som, io_board, switch_board, poe_board, sd_card
  batch_number TEXT NOT NULL,
  scanned_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  scanned_by UUID,
  production_step_id UUID REFERENCES production_steps(id),
  opening_date DATE, -- for materials like epoxy that need opening date tracked
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE batch_materials ENABLE ROW LEVEL SECURITY;

-- Create policies for batch_materials
CREATE POLICY "Users can view all batch materials"
ON batch_materials FOR SELECT
USING (true);

CREATE POLICY "Users can insert batch materials"
ON batch_materials FOR INSERT
WITH CHECK (true);

CREATE POLICY "Users can update batch materials"
ON batch_materials FOR UPDATE
USING (true);

-- Add quality_certificates table
CREATE TABLE quality_certificates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_item_id UUID REFERENCES work_order_items(id) ON DELETE CASCADE NOT NULL,
  certificate_data JSONB NOT NULL, -- stores all measurement values, batch numbers, etc.
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  generated_by UUID,
  pdf_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE quality_certificates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all certificates"
ON quality_certificates FOR SELECT
USING (true);

CREATE POLICY "Users can create certificates"
ON quality_certificates FOR INSERT
WITH CHECK (true);

-- Update production_steps to include validation rules
ALTER TABLE production_steps
ADD COLUMN validation_rules JSONB, -- stores min/max values, pass/fail criteria
ADD COLUMN measurement_fields JSONB, -- defines what measurements to capture
ADD COLUMN restart_from_step INTEGER, -- which step to restart from on failure
ADD COLUMN blocks_on_failure BOOLEAN DEFAULT false;

-- Create indexes for performance
CREATE INDEX idx_batch_materials_work_order_item ON batch_materials(work_order_item_id);
CREATE INDEX idx_batch_materials_material_type ON batch_materials(material_type);
CREATE INDEX idx_step_executions_status ON step_executions(status);
CREATE INDEX idx_step_executions_validation ON step_executions(validation_status);
CREATE INDEX idx_quality_certificates_work_order_item ON quality_certificates(work_order_item_id);

-- Update existing production steps with validation rules for Sensor
UPDATE production_steps
SET 
  validation_rules = '{"min_value": 13, "operator": ">=", "fail_action": "restart_from_step_1"}'::jsonb,
  measurement_fields = '{"oscilloscope_value": {"label": "Oscilloscope Value", "unit": "V", "type": "number"}}'::jsonb,
  restart_from_step = 1,
  blocks_on_failure = true
WHERE product_type = 'SENSOR' AND step_number = 3;

UPDATE production_steps
SET 
  validation_rules = '{"min_value": 5.8, "operator": ">=", "fail_action": "restart_from_step_4"}'::jsonb,
  measurement_fields = '{"oscilloscope_value": {"label": "Oscilloscope Value", "unit": "V", "type": "number"}}'::jsonb,
  restart_from_step = 4,
  blocks_on_failure = true
WHERE product_type = 'SENSOR' AND step_number = 5;

UPDATE production_steps
SET 
  validation_rules = '{"max_value": 3.5, "operator": "<", "fail_action": "reject"}'::jsonb,
  measurement_fields = '{"re_pk_pk": {"label": "RE Pk-Pk", "unit": "V", "type": "number"}, "ie_pk_pk": {"label": "IE Pk-Pk", "unit": "V", "type": "number"}}'::jsonb,
  blocks_on_failure = true
WHERE product_type = 'SENSOR' AND step_number = 8;

UPDATE production_steps
SET 
  validation_rules = '{"min_value": 5.8, "operator": ">", "fail_action": "reject"}'::jsonb,
  measurement_fields = '{"ie_pk_pk": {"label": "IE Pk-Pk", "unit": "V", "type": "number"}}'::jsonb,
  blocks_on_failure = true
WHERE product_type = 'SENSOR' AND step_number = 9;

UPDATE production_steps
SET 
  measurement_fields = '{"re_pk_pk": {"label": "RE Pk-Pk", "unit": "V", "type": "number"}, "ie_pk_pk": {"label": "IE Pk-Pk", "unit": "V", "type": "number"}}'::jsonb
WHERE product_type = 'SENSOR' AND step_number IN (14, 18);

UPDATE production_steps
SET 
  validation_rules = '{"min_value": 108, "max_value": 112, "unit": "Ω", "fail_action": "mark_nok"}'::jsonb,
  measurement_fields = '{"pt100_resistance": {"label": "PT100 Resistance", "unit": "Ω", "type": "number"}}'::jsonb,
  blocks_on_failure = false
WHERE product_type = 'SENSOR' AND step_number = 19;

UPDATE production_steps
SET 
  validation_rules = '{"type": "pass_fail"}'::jsonb,
  measurement_fields = '{"pressure_test": {"label": "Pressure Test", "type": "boolean"}}'::jsonb,
  blocks_on_failure = true
WHERE product_type = 'SENSOR' AND step_number = 21;