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
CREATE INDEX idx_activity_logs_created_at ON public.activity_logs(created_at DESC);