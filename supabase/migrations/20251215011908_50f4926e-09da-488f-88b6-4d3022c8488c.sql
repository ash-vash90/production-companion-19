-- Migration: Add Capacity Planning and Work Instructions Features

-- 1. Add operator capacity columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS daily_capacity_hours numeric NOT NULL DEFAULT 8,
ADD COLUMN IF NOT EXISTS is_available boolean NOT NULL DEFAULT true;

-- 2. Create operator_assignments table for capacity planning
CREATE TABLE IF NOT EXISTS public.operator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  assigned_date DATE NOT NULL,
  planned_hours NUMERIC NOT NULL DEFAULT 8,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(operator_id, work_order_id, assigned_date)
);

ALTER TABLE public.operator_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all operator assignments" ON public.operator_assignments
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and supervisors can manage operator assignments" ON public.operator_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

CREATE INDEX IF NOT EXISTS idx_operator_assignments_operator_id ON public.operator_assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_assignments_work_order_id ON public.operator_assignments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_operator_assignments_assigned_date ON public.operator_assignments(assigned_date);

-- 3. Create work_instructions table
CREATE TABLE IF NOT EXISTS public.work_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type public.product_type NOT NULL,
  production_step_id UUID REFERENCES public.production_steps(id) ON DELETE SET NULL,
  title_en TEXT NOT NULL,
  title_nl TEXT,
  description_en TEXT,
  description_nl TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_instructions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all work instructions" ON public.work_instructions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and supervisors can manage work instructions" ON public.work_instructions
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

-- 4. Create instruction_steps table
CREATE TABLE IF NOT EXISTS public.instruction_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_instruction_id UUID REFERENCES public.work_instructions(id) ON DELETE CASCADE NOT NULL,
  step_number INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_nl TEXT,
  content_en TEXT,
  content_nl TEXT,
  warning_text_en TEXT,
  warning_text_nl TEXT,
  tip_text_en TEXT,
  tip_text_nl TEXT,
  estimated_duration_minutes INTEGER,
  required_tools TEXT[],
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_instruction_id, step_number)
);

ALTER TABLE public.instruction_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all instruction steps" ON public.instruction_steps
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and supervisors can manage instruction steps" ON public.instruction_steps
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

-- 5. Create instruction_media table
CREATE TABLE IF NOT EXISTS public.instruction_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_step_id UUID REFERENCES public.instruction_steps(id) ON DELETE CASCADE NOT NULL,
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'document', 'link')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  title_en TEXT,
  title_nl TEXT,
  alt_text_en TEXT,
  alt_text_nl TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.instruction_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all instruction media" ON public.instruction_media
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and supervisors can manage instruction media" ON public.instruction_media
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_work_instructions_product_type ON public.work_instructions(product_type);
CREATE INDEX IF NOT EXISTS idx_work_instructions_step_id ON public.work_instructions(production_step_id);
CREATE INDEX IF NOT EXISTS idx_instruction_steps_instruction_id ON public.instruction_steps(work_instruction_id);
CREATE INDEX IF NOT EXISTS idx_instruction_media_step_id ON public.instruction_media(instruction_step_id);

-- Trigger to update updated_at timestamp for work_instructions
CREATE OR REPLACE FUNCTION update_work_instruction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS work_instructions_updated_at ON public.work_instructions;
CREATE TRIGGER work_instructions_updated_at
  BEFORE UPDATE ON public.work_instructions
  FOR EACH ROW EXECUTE FUNCTION update_work_instruction_timestamp();

DROP TRIGGER IF EXISTS instruction_steps_updated_at ON public.instruction_steps;
CREATE TRIGGER instruction_steps_updated_at
  BEFORE UPDATE ON public.instruction_steps
  FOR EACH ROW EXECUTE FUNCTION update_work_instruction_timestamp();

-- Trigger for operator_assignments updated_at
DROP TRIGGER IF EXISTS operator_assignments_updated_at ON public.operator_assignments;
CREATE TRIGGER operator_assignments_updated_at
  BEFORE UPDATE ON public.operator_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();