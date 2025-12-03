-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum for product types
CREATE TYPE product_type AS ENUM ('SDM_ECO', 'SENSOR', 'MLA', 'HMI', 'TRANSMITTER');

-- Create enum for work order status
CREATE TYPE work_order_status AS ENUM ('planned', 'in_progress', 'on_hold', 'completed', 'cancelled');

-- Create enum for step status
CREATE TYPE step_status AS ENUM ('pending', 'in_progress', 'completed', 'skipped');

-- Create enum for user roles
CREATE TYPE app_role AS ENUM ('admin', 'supervisor', 'operator', 'logistics');

-- Profiles table for user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'operator',
  language TEXT NOT NULL DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- User roles table (CRITICAL: separate table for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES auth.users(id),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all roles" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Work orders table
CREATE TABLE public.work_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wo_number TEXT UNIQUE NOT NULL,
  product_type product_type NOT NULL,
  batch_size INTEGER NOT NULL CHECK (batch_size > 0),
  status work_order_status NOT NULL DEFAULT 'planned',
  parent_wo_id UUID REFERENCES public.work_orders(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  assigned_to UUID REFERENCES auth.users(id),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all work orders" ON public.work_orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create work orders" ON public.work_orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Assigned users can update work orders" ON public.work_orders FOR UPDATE TO authenticated 
  USING (auth.uid() = assigned_to OR auth.uid() = created_by OR 
         EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

-- Work order items (individual units with serial numbers)
CREATE TABLE public.work_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  serial_number TEXT UNIQUE NOT NULL,
  position_in_batch INTEGER NOT NULL,
  current_step INTEGER NOT NULL DEFAULT 1,
  status work_order_status NOT NULL DEFAULT 'planned',
  assigned_to UUID REFERENCES auth.users(id),
  label_printed BOOLEAN NOT NULL DEFAULT false,
  quality_approved BOOLEAN NOT NULL DEFAULT false,
  certificate_generated BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, position_in_batch)
);

ALTER TABLE public.work_order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all work order items" ON public.work_order_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update assigned items" ON public.work_order_items FOR UPDATE TO authenticated 
  USING (auth.uid() = assigned_to OR 
         EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

-- Production steps template
CREATE TABLE public.production_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type product_type NOT NULL,
  step_number INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_nl TEXT NOT NULL,
  description_en TEXT,
  description_nl TEXT,
  requires_barcode_scan BOOLEAN NOT NULL DEFAULT false,
  requires_value_input BOOLEAN NOT NULL DEFAULT false,
  value_label_en TEXT,
  value_label_nl TEXT,
  value_unit TEXT,
  requires_batch_number BOOLEAN NOT NULL DEFAULT false,
  batch_type TEXT,
  has_checklist BOOLEAN NOT NULL DEFAULT false,
  conditional_on_step INTEGER,
  conditional_value TEXT,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_type, step_number)
);

ALTER TABLE public.production_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all production steps" ON public.production_steps FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage production steps" ON public.production_steps FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Checklist items
CREATE TABLE public.checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  production_step_id UUID REFERENCES public.production_steps(id) ON DELETE CASCADE NOT NULL,
  item_text_en TEXT NOT NULL,
  item_text_nl TEXT NOT NULL,
  required BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all checklist items" ON public.checklist_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can manage checklist items" ON public.checklist_items FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Step execution records
CREATE TABLE public.step_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_item_id UUID REFERENCES public.work_order_items(id) ON DELETE CASCADE NOT NULL,
  production_step_id UUID REFERENCES public.production_steps(id) NOT NULL,
  status step_status NOT NULL DEFAULT 'pending',
  executed_by UUID REFERENCES auth.users(id),
  barcode_scanned TEXT,
  value_recorded TEXT,
  batch_number TEXT,
  notes TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_item_id, production_step_id)
);

ALTER TABLE public.step_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all step executions" ON public.step_executions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can create step executions" ON public.step_executions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can update step executions" ON public.step_executions FOR UPDATE TO authenticated USING (true);

-- Checklist responses
CREATE TABLE public.checklist_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_execution_id UUID REFERENCES public.step_executions(id) ON DELETE CASCADE NOT NULL,
  checklist_item_id UUID REFERENCES public.checklist_items(id) NOT NULL,
  checked BOOLEAN NOT NULL DEFAULT false,
  checked_by UUID REFERENCES auth.users(id),
  checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (step_execution_id, checklist_item_id)
);

ALTER TABLE public.checklist_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all checklist responses" ON public.checklist_responses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage checklist responses" ON public.checklist_responses FOR ALL TO authenticated USING (true);

-- Sub-assembly links
CREATE TABLE public.sub_assemblies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_item_id UUID REFERENCES public.work_order_items(id) ON DELETE CASCADE NOT NULL,
  child_item_id UUID REFERENCES public.work_order_items(id) ON DELETE CASCADE NOT NULL,
  component_type product_type NOT NULL,
  linked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  linked_by UUID REFERENCES auth.users(id),
  UNIQUE (parent_item_id, child_item_id)
);

ALTER TABLE public.sub_assemblies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all sub-assemblies" ON public.sub_assemblies FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage sub-assemblies" ON public.sub_assemblies FOR ALL TO authenticated USING (true);

-- Activity logs
CREATE TABLE public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own activity logs" ON public.activity_logs FOR SELECT TO authenticated 
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));
CREATE POLICY "System can insert activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Zapier webhooks configuration
CREATE TABLE public.zapier_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  webhook_url TEXT NOT NULL,
  event_type TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.zapier_webhooks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view webhooks" ON public.zapier_webhooks FOR SELECT TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage webhooks" ON public.zapier_webhooks FOR ALL TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_orders_updated_at BEFORE UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_work_order_items_updated_at BEFORE UPDATE ON public.work_order_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_zapier_webhooks_updated_at BEFORE UPDATE ON public.zapier_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role, language)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New User'),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'operator'),
    COALESCE(NEW.raw_user_meta_data->>'language', 'en')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create indexes for performance
CREATE INDEX idx_work_orders_status ON public.work_orders(status);
CREATE INDEX idx_work_orders_created_by ON public.work_orders(created_by);
CREATE INDEX idx_work_orders_assigned_to ON public.work_orders(assigned_to);
CREATE INDEX idx_work_order_items_wo_id ON public.work_order_items(work_order_id);
CREATE INDEX idx_work_order_items_serial ON public.work_order_items(serial_number);
CREATE INDEX idx_step_executions_item_id ON public.step_executions(work_order_item_id);
CREATE INDEX idx_activity_logs_user_id ON public.activity_logs(user_id);
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);-- Fix security warning: Update function with proper search_path
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;-- Add operator initials enum
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
WHERE product_type = 'SENSOR' AND step_number = 21;-- Fix infinite recursion in user_roles by dropping the problematic policy
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;

-- Create simpler admin check policies without recursion
CREATE POLICY "Admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Add missing INSERT policy for work_order_items
DROP POLICY IF EXISTS "Users can insert work order items" ON public.work_order_items;
CREATE POLICY "Users can insert work order items"
ON public.work_order_items
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.work_orders
    WHERE work_orders.id = work_order_items.work_order_id
    AND (work_orders.created_by = auth.uid() OR work_orders.assigned_to = auth.uid())
  )
  OR EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role IN ('admin', 'supervisor')
  )
);-- Clear existing data that references production steps
DELETE FROM checklist_responses;
DELETE FROM step_executions;
DELETE FROM checklist_items;
DELETE FROM production_steps;

-- ============================================
-- SENSOR PRODUCTION STEPS (21 steps total)
-- ============================================

-- Step 1: Epoxy Preparation
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES ('SENSOR', 1, 1, 'Epoxy Preparation', 'Epoxy Voorbereiding', 'Scan epoxy batch number and record opening date', 'Scan epoxy batchnummer en registreer openingsdatum', true, 'epoxy');

-- Step 2: Piezo Gluing  
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES ('SENSOR', 2, 2, 'Piezo Gluing', 'Piezo Lijmen', 'Scan piezo batch number', 'Scan piezo batchnummer', true, 'piezo');

-- Step 3: Measurement #1 (≥ 13 or restart from 1)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure, restart_from_step)
VALUES ('SENSOR', 3, 3, 'Measurement #1', 'Meting #1', 'Oscilloscope value must be ≥ 13', 'Oscilloscoop waarde moet ≥ 13 zijn', true, '[{"name":"osc_value","label":"Oscilloscope Value","type":"number"}]'::jsonb, '{"min":13,"restart":1}'::jsonb, true, 1);

-- Step 4
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES ('SENSOR', 4, 4, 'Assembly Step 4', 'Assemblage Stap 4', 'Continue assembly', 'Ga door met assemblage');

-- Step 5: Measurement #2 (≥ 5.8V or restart from 4)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure, restart_from_step)
VALUES ('SENSOR', 5, 5, 'Measurement #2', 'Meting #2', 'Oscilloscope ≥ 5.8V', 'Oscilloscoop ≥ 5.8V', true, '[{"name":"osc_voltage","label":"Voltage (V)","type":"number"}]'::jsonb, '{"min":5.8,"restart":4}'::jsonb, true, 4);

-- Steps 6-7
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES 
  ('SENSOR', 6, 6, 'Assembly Step 6', 'Assemblage Stap 6', 'Continue', 'Ga door'),
  ('SENSOR', 7, 7, 'Assembly Step 7', 'Assemblage Stap 7', 'Continue', 'Ga door');

-- Step 8: Measurement #3 (< 3.5V)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 8, 8, 'RE/IE Pk-Pk Test', 'RE/IE Pk-Pk Test', 'Both < 3.5V', 'Beide < 3.5V', true, '[{"name":"re_pk_pk","label":"RE Pk-Pk (V)","type":"number"},{"name":"ie_pk_pk","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb, '{"max":3.5}'::jsonb, true);

-- Step 9: Measurement #4 (> 5.8V)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 9, 9, 'IE Pk-Pk Test', 'IE Pk-Pk Test', 'IE > 5.8V', 'IE > 5.8V', true, '[{"name":"ie_final","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb, '{"min":5.8}'::jsonb, true);

-- Steps 10-13
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES 
  ('SENSOR', 10, 10, 'Assembly Step 10', 'Assemblage Stap 10', 'Continue', 'Ga door'),
  ('SENSOR', 11, 11, 'Assembly Step 11', 'Assemblage Stap 11', 'Continue', 'Ga door'),
  ('SENSOR', 12, 12, 'Assembly Step 12', 'Assemblage Stap 12', 'Continue', 'Ga door'),
  ('SENSOR', 13, 13, 'Assembly Step 13', 'Assemblage Stap 13', 'Continue', 'Ga door');

-- Step 14: Measurement #5
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields)
VALUES ('SENSOR', 14, 14, 'Measurement #5', 'Meting #5', 'Record RE & IE', 'Registreer RE & IE', true, '[{"name":"re_5","label":"RE Pk-Pk (V)","type":"number"},{"name":"ie_5","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb);

-- Steps 15-17
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES 
  ('SENSOR', 15, 15, 'Assembly Step 15', 'Assemblage Stap 15', 'Continue', 'Ga door'),
  ('SENSOR', 16, 16, 'Assembly Step 16', 'Assemblage Stap 16', 'Continue', 'Ga door'),
  ('SENSOR', 17, 17, 'Assembly Step 17', 'Assemblage Stap 17', 'Continue', 'Ga door');

-- Step 18: Measurement #6
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields)
VALUES ('SENSOR', 18, 18, 'Measurement #6', 'Meting #6', 'Record RE & IE', 'Registreer RE & IE', true, '[{"name":"re_6","label":"RE Pk-Pk (V)","type":"number"},{"name":"ie_6","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb);

-- Step 19: PT100 (108-112Ω)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 19, 19, 'PT100 Test', 'PT100 Test', '108-112Ω required', '108-112Ω vereist', true, '[{"name":"pt100","label":"Resistance (Ω)","type":"number"}]'::jsonb, '{"min":108,"max":112}'::jsonb, true);

-- Step 20
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES ('SENSOR', 20, 20, 'Assembly Step 20', 'Assemblage Stap 20', 'Continue', 'Ga door');

-- Step 21: Pressure Test
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 21, 21, 'Pressure Test', 'Druktest', 'Must PASS', 'Moet SLAGEN', true, '[{"name":"pressure","label":"Result","type":"pass_fail"}]'::jsonb, '{"pass_fail":true}'::jsonb, true);

-- ============================================
-- TRANSMITTER (5 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES 
  ('TRANSMITTER', 1, 1, 'Scan PCB Batches', 'Scan PCB Batches', 'Scan 6 PCB batches', 'Scan 6 PCB batches', true, 'pcb'),
  ('TRANSMITTER', 2, 2, 'Scan POE Board', 'Scan POE Board', 'POE board serial', 'POE board serie', true, 'poe'),
  ('TRANSMITTER', 3, 3, 'SD Card (Optional)', 'SD Kaart (Optioneel)', 'SD card batch', 'SD kaart batch', false, null),
  ('TRANSMITTER', 4, 4, 'Assembly', 'Assemblage', 'Complete assembly', 'Voltooiing assemblage', false, null);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, has_checklist)
VALUES ('TRANSMITTER', 5, 5, 'Electronics Test', 'Elektronica Test', 'Complete checklist', 'Voltooi checklist', true);

-- Transmitter checklist
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Power supply test', 'Voeding test', 1, true FROM production_steps WHERE product_type='TRANSMITTER' AND step_number=5;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Communication test', 'Communicatie test', 2, true FROM production_steps WHERE product_type='TRANSMITTER' AND step_number=5;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'LED indicators', 'LED indicatoren', 3, true FROM production_steps WHERE product_type='TRANSMITTER' AND step_number=5;

-- ============================================
-- MLA (7 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES 
  ('MLA', 1, 1, 'Carrier Boards', 'Dragerkaarten', 'Scan batch', 'Scan batch', true, 'carrier'),
  ('MLA', 2, 2, 'SOMs', 'SOMs', 'Scan batch', 'Scan batch', true, 'som'),
  ('MLA', 3, 3, 'I/O Boards', 'I/O Boards', 'Scan batch', 'Scan batch', true, 'io'),
  ('MLA', 4, 4, 'Switch Boards', 'Switch Boards', 'Scan batch', 'Scan batch', true, 'switch'),
  ('MLA', 5, 5, 'Assembly', 'Assemblage', 'Complete', 'Voltooiing', false, null),
  ('MLA', 6, 6, 'Pre-Test', 'Voor-Test', 'Check', 'Controle', false, null);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, has_checklist)
VALUES ('MLA', 7, 7, 'Production Test', 'Productie Test', 'Mandatory checklist', 'Verplichte checklist', true);

-- MLA checklist
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'All LEDs functional', 'Alle LEDs functioneel', 1, true FROM production_steps WHERE product_type='MLA' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Network connectivity', 'Netwerkverbinding', 2, true FROM production_steps WHERE product_type='MLA' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'I/O ports tested', 'I/O poorten getest', 3, true FROM production_steps WHERE product_type='MLA' AND step_number=7;

-- ============================================
-- HMI (7 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES 
  ('HMI', 1, 1, 'Scan Display', 'Scan Display', 'Display batch', 'Display batch', true, 'display'),
  ('HMI', 2, 2, 'Display Assembly', 'Display Assemblage', 'Assemble', 'Monteer', false, null),
  ('HMI', 3, 3, 'Electronics', 'Elektronica', 'Assembly', 'Assemblage', false, null),
  ('HMI', 4, 4, 'Housing', 'Behuizing', 'Assembly', 'Assemblage', false, null),
  ('HMI', 5, 5, 'Pre-Test', 'Voor-Test', 'Checks', 'Controles', false, null),
  ('HMI', 6, 6, 'Water Test', 'Watertest', 'Perform test', 'Uitvoeren test', false, null);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, has_checklist, requires_value_input, measurement_fields)
VALUES ('HMI', 7, 7, 'Final Check', 'Definitieve Check', 'Checklist + water result', 'Checklist + waterresultaat', true, true, '[{"name":"water_test","label":"Water Test","type":"pass_fail"}]'::jsonb);

-- HMI checklist
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Display functional', 'Display functioneel', 1, true FROM production_steps WHERE product_type='HMI' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Touch response OK', 'Touch reactie OK', 2, true FROM production_steps WHERE product_type='HMI' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Water test passed', 'Watertest geslaagd', 3, true FROM production_steps WHERE product_type='HMI' AND step_number=7;

-- ============================================
-- SDM-ECO (7 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_barcode_scan)
VALUES 
  ('SDM_ECO', 1, 1, 'Link Sensor', 'Koppel Sensor', 'Scan Sensor S/N', 'Scan Sensor S/N', true),
  ('SDM_ECO', 2, 2, 'Link MLA', 'Koppel MLA', 'Scan MLA S/N', 'Scan MLA S/N', true),
  ('SDM_ECO', 3, 3, 'Link HMI', 'Koppel HMI', 'Scan HMI S/N', 'Scan HMI S/N', true),
  ('SDM_ECO', 4, 4, 'Link Transmitter', 'Koppel Transmitter', 'Scan Transmitter S/N', 'Scan Transmitter S/N', true),
  ('SDM_ECO', 5, 5, 'Final Assembly', 'Eindassemblage', 'Complete', 'Voltooiing', false);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields)
VALUES ('SDM_ECO', 6, 6, 'Calibration', 'Kalibratie', 'Enter calibration data', 'Voer kalibratiegegevens in', true, '[{"name":"offset","label":"Offset","type":"number"},{"name":"gain","label":"Gain","type":"number"}]'::jsonb);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES ('SDM_ECO', 7, 7, 'Quality Certificate', 'Kwaliteitscertificaat', 'Generate certificate', 'Genereer certificaat');-- Remove the unique constraint that's blocking step re-execution
-- This allows multiple execution attempts for the same step (e.g., retries after failures)
ALTER TABLE step_executions 
DROP CONSTRAINT IF EXISTS step_executions_work_order_item_id_production_step_id_key;

-- Create an index for performance since we're removing the unique constraint
CREATE INDEX IF NOT EXISTS idx_step_executions_item_step 
ON step_executions(work_order_item_id, production_step_id);-- Add scheduled_date column to work_orders table for calendar scheduling
ALTER TABLE work_orders 
ADD COLUMN scheduled_date date;

-- Create index for scheduled_date for better query performance
CREATE INDEX idx_work_orders_scheduled_date ON work_orders(scheduled_date);-- Create enum for automation action types
CREATE TYPE public.automation_action_type AS ENUM (
  'create_work_order',
  'update_work_order_status',
  'update_item_status',
  'log_activity',
  'trigger_outgoing_webhook'
);

-- Table for incoming webhook endpoints
CREATE TABLE public.incoming_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  endpoint_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  secret_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER NOT NULL DEFAULT 0
);

-- Table for automation rules tied to webhooks
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incoming_webhook_id UUID NOT NULL REFERENCES public.incoming_webhooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  action_type automation_action_type NOT NULL,
  field_mappings JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for webhook execution logs
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incoming_webhook_id UUID NOT NULL REFERENCES public.incoming_webhooks(id) ON DELETE CASCADE,
  request_body JSONB,
  request_headers JSONB,
  response_status INTEGER,
  response_body JSONB,
  error_message TEXT,
  executed_rules JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incoming_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for incoming_webhooks (admin only)
CREATE POLICY "Admins can manage incoming webhooks"
ON public.incoming_webhooks
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
));

-- RLS Policies for automation_rules (admin only)
CREATE POLICY "Admins can manage automation rules"
ON public.automation_rules
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
));

-- RLS Policies for webhook_logs (admin only to view)
CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
));

-- Service role can insert logs (from edge function)
CREATE POLICY "Service can insert webhook logs"
ON public.webhook_logs
FOR INSERT
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_incoming_webhooks_updated_at
  BEFORE UPDATE ON public.incoming_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();-- Add secret_key field to zapier_webhooks for HMAC signing
-- This allows webhook receivers to verify the authenticity of requests

ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS secret_key TEXT;

-- Generate a secret key for existing webhooks (if any)
UPDATE public.zapier_webhooks
SET secret_key = encode(gen_random_bytes(32), 'hex')
WHERE secret_key IS NULL;

-- Make secret_key required for new webhooks
ALTER TABLE public.zapier_webhooks
ALTER COLUMN secret_key SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- Add column for tracking webhook success/failure
ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
-- Create storage bucket for quality certificates
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload certificates
CREATE POLICY "Authenticated users can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

-- Allow anyone to download certificates (public bucket)
CREATE POLICY "Anyone can view certificates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'certificates');

-- Allow authenticated users to delete their own certificates (optional)
CREATE POLICY "Authenticated users can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'certificates');
-- Create sequences for each product type
-- These ensure unique, incrementing serial numbers
CREATE SEQUENCE IF NOT EXISTS serial_sensor_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_mla_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_hmi_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_transmitter_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_sdm_eco_seq START 1;

-- Function to generate next serial number for a product type
-- Returns format: Q-0001, W-0001, X-0001, T-0001, SDM-0001
CREATE OR REPLACE FUNCTION generate_serial_number(p_product_type product_type)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_sequence_name TEXT;
  v_next_number INTEGER;
  v_prefix TEXT;
  v_serial TEXT;
BEGIN
  -- Determine prefix and sequence based on product type
  CASE p_product_type
    WHEN 'SENSOR' THEN
      v_prefix := 'Q';
      v_sequence_name := 'serial_sensor_seq';
    WHEN 'MLA' THEN
      v_prefix := 'W';
      v_sequence_name := 'serial_mla_seq';
    WHEN 'HMI' THEN
      v_prefix := 'X';
      v_sequence_name := 'serial_hmi_seq';
    WHEN 'TRANSMITTER' THEN
      v_prefix := 'T';
      v_sequence_name := 'serial_transmitter_seq';
    WHEN 'SDM_ECO' THEN
      v_prefix := 'SDM';
      v_sequence_name := 'serial_sdm_eco_seq';
    ELSE
      RAISE EXCEPTION 'Unknown product type: %', p_product_type;
  END CASE;

  -- Get next sequence value
  EXECUTE format('SELECT nextval(%L)', v_sequence_name) INTO v_next_number;

  -- Format as prefix-0001 (4-digit padded)
  v_serial := v_prefix || '-' || LPAD(v_next_number::TEXT, 4, '0');

  RETURN v_serial;
END;
$$;

-- Function to generate multiple serial numbers (for batch creation)
CREATE OR REPLACE FUNCTION generate_serial_numbers(
  p_product_type product_type,
  p_count INTEGER
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_serials TEXT[] := '{}';
  v_serial TEXT;
  i INTEGER;
BEGIN
  FOR i IN 1..p_count LOOP
    v_serial := generate_serial_number(p_product_type);
    v_serials := array_append(v_serials, v_serial);
  END LOOP;

  RETURN v_serials;
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION generate_serial_number(product_type) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_serial_numbers(product_type, INTEGER) TO authenticated;

-- Initialize sequences from existing data (prevent conflicts)
DO $$
DECLARE
  v_max_sensor INTEGER;
  v_max_mla INTEGER;
  v_max_hmi INTEGER;
  v_max_transmitter INTEGER;
  v_max_sdm INTEGER;
BEGIN
  -- Extract max number from existing serials (if any)
  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^Q-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_sensor
  FROM work_order_items
  WHERE serial_number LIKE 'Q-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^W-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_mla
  FROM work_order_items
  WHERE serial_number LIKE 'W-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^X-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_hmi
  FROM work_order_items
  WHERE serial_number LIKE 'X-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^T-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_transmitter
  FROM work_order_items
  WHERE serial_number LIKE 'T-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^SDM-\d+$'
      THEN SUBSTRING(serial_number FROM 5)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_sdm
  FROM work_order_items
  WHERE serial_number LIKE 'SDM-%';

  -- Set sequences to max + 1 (or 1 if no existing data)
  PERFORM setval('serial_sensor_seq', GREATEST(v_max_sensor + 1, 1), false);
  PERFORM setval('serial_mla_seq', GREATEST(v_max_mla + 1, 1), false);
  PERFORM setval('serial_hmi_seq', GREATEST(v_max_hmi + 1, 1), false);
  PERFORM setval('serial_transmitter_seq', GREATEST(v_max_transmitter + 1, 1), false);
  PERFORM setval('serial_sdm_eco_seq', GREATEST(v_max_sdm + 1, 1), false);
END;
$$;
