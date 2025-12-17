-- Create step_assignments table for persisting step-level operator assignments
CREATE TABLE public.step_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  production_step_id uuid NOT NULL REFERENCES public.production_steps(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid REFERENCES public.profiles(id),
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(work_order_id, production_step_id)
);

-- Enable RLS
ALTER TABLE public.step_assignments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view all step assignments"
  ON public.step_assignments FOR SELECT
  USING (true);

CREATE POLICY "Admins and supervisors can manage step assignments"
  ON public.step_assignments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role IN ('admin', 'supervisor')
    )
  );

-- Index for faster queries
CREATE INDEX idx_step_assignments_work_order ON public.step_assignments(work_order_id);
CREATE INDEX idx_step_assignments_operator ON public.step_assignments(operator_id);

-- Enable realtime for step assignments
ALTER PUBLICATION supabase_realtime ADD TABLE public.step_assignments;
