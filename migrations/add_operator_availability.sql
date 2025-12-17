-- Migration: Add operator availability table for capacity planning
-- Allows tracking holidays, sick days, training, and other unavailability

BEGIN;

-- 1) Create operator_availability table
CREATE TABLE IF NOT EXISTS public.operator_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  available_hours NUMERIC NOT NULL DEFAULT 0,
  reason TEXT,
  reason_type TEXT NOT NULL DEFAULT 'holiday', -- holiday, sick, training, other
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, date)
);

-- 2) Enable RLS on operator_availability
ALTER TABLE public.operator_availability ENABLE ROW LEVEL SECURITY;

-- 3) Users can view their own availability
CREATE POLICY "Users can view own availability"
ON public.operator_availability
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role IN ('admin', 'supervisor')
  )
);

-- 4) Users can manage their own availability
CREATE POLICY "Users can manage own availability"
ON public.operator_availability
FOR ALL
TO authenticated
USING (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
)
WITH CHECK (
  user_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- 5) Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_operator_availability_user_date 
ON public.operator_availability(user_id, date);

CREATE INDEX IF NOT EXISTS idx_operator_availability_date 
ON public.operator_availability(date);

COMMIT;
