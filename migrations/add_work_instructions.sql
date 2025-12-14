-- Migration: Add Work Instructions Feature
-- This enables digital work instructions that can be configured per product type
-- and accessed during production steps

-- Work Instructions table - instructions per product type, optionally linked to a specific step
CREATE TABLE public.work_instructions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_type product_type NOT NULL,
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

-- Instruction Steps - individual steps within an instruction with rich content
CREATE TABLE public.instruction_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_instruction_id UUID REFERENCES public.work_instructions(id) ON DELETE CASCADE NOT NULL,
  step_number INTEGER NOT NULL,
  title_en TEXT NOT NULL,
  title_nl TEXT,
  content_en TEXT, -- Rich text / markdown content
  content_nl TEXT,
  warning_text_en TEXT, -- Safety warnings shown prominently
  warning_text_nl TEXT,
  tip_text_en TEXT, -- Helpful tips
  tip_text_nl TEXT,
  estimated_duration_minutes INTEGER, -- How long this step typically takes
  required_tools TEXT[], -- List of tools/equipment needed
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

-- Instruction Media - images, videos, or documents attached to instructions
CREATE TABLE public.instruction_media (
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
CREATE INDEX idx_work_instructions_product_type ON public.work_instructions(product_type);
CREATE INDEX idx_work_instructions_step_id ON public.work_instructions(production_step_id);
CREATE INDEX idx_instruction_steps_instruction_id ON public.instruction_steps(work_instruction_id);
CREATE INDEX idx_instruction_media_step_id ON public.instruction_media(instruction_step_id);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_work_instruction_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER work_instructions_updated_at
  BEFORE UPDATE ON public.work_instructions
  FOR EACH ROW EXECUTE FUNCTION update_work_instruction_timestamp();

CREATE TRIGGER instruction_steps_updated_at
  BEFORE UPDATE ON public.instruction_steps
  FOR EACH ROW EXECUTE FUNCTION update_work_instruction_timestamp();
