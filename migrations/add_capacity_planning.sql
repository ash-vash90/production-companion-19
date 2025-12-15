-- Migration: Add Capacity Planning Feature
-- Enables operator workload tracking and assignment for production scheduling

-- Add capacity settings to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS daily_capacity_hours DECIMAL(4,2) DEFAULT 8.0,
ADD COLUMN IF NOT EXISTS is_available BOOLEAN DEFAULT true;

COMMENT ON COLUMN public.profiles.daily_capacity_hours IS 'Default daily working hours for this operator';
COMMENT ON COLUMN public.profiles.is_available IS 'Whether operator is available for scheduling';

-- Add estimated hours to work orders for capacity planning
ALTER TABLE public.work_orders
ADD COLUMN IF NOT EXISTS estimated_hours DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0;

COMMENT ON COLUMN public.work_orders.estimated_hours IS 'Estimated hours to complete all items in this work order';
COMMENT ON COLUMN public.work_orders.priority IS 'Scheduling priority (higher = more urgent)';

-- Operator assignments table - assigns operators to work orders for specific dates
CREATE TABLE IF NOT EXISTS public.operator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  work_order_id UUID REFERENCES public.work_orders(id) ON DELETE CASCADE NOT NULL,
  operator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_date DATE NOT NULL,
  planned_hours DECIMAL(4,2) NOT NULL DEFAULT 8.0,
  actual_hours DECIMAL(4,2),
  notes TEXT,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (work_order_id, operator_id, assigned_date)
);

ALTER TABLE public.operator_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all operator assignments" ON public.operator_assignments
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and supervisors can manage assignments" ON public.operator_assignments
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

-- Operator availability overrides (vacations, sick days, etc.)
CREATE TABLE IF NOT EXISTS public.operator_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  date DATE NOT NULL,
  available_hours DECIMAL(4,2) NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (operator_id, date)
);

ALTER TABLE public.operator_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all availability" ON public.operator_availability
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and supervisors can manage availability" ON public.operator_availability
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor')));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_operator_assignments_date ON public.operator_assignments(assigned_date);
CREATE INDEX IF NOT EXISTS idx_operator_assignments_operator ON public.operator_assignments(operator_id);
CREATE INDEX IF NOT EXISTS idx_operator_assignments_wo ON public.operator_assignments(work_order_id);
CREATE INDEX IF NOT EXISTS idx_operator_availability_date ON public.operator_availability(date);
CREATE INDEX IF NOT EXISTS idx_operator_availability_operator ON public.operator_availability(operator_id);

-- Update timestamp trigger for operator_assignments
CREATE OR REPLACE FUNCTION update_operator_assignment_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER operator_assignments_updated_at
  BEFORE UPDATE ON public.operator_assignments
  FOR EACH ROW EXECUTE FUNCTION update_operator_assignment_timestamp();

-- Function to calculate operator workload for a date range
CREATE OR REPLACE FUNCTION get_operator_workload(
  p_operator_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  work_date DATE,
  planned_hours DECIMAL,
  capacity_hours DECIMAL,
  utilization_pct DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  WITH date_series AS (
    SELECT generate_series(p_start_date, p_end_date, '1 day'::interval)::date AS work_date
  ),
  daily_assignments AS (
    SELECT
      oa.assigned_date,
      SUM(oa.planned_hours) as total_planned
    FROM public.operator_assignments oa
    WHERE oa.operator_id = p_operator_id
      AND oa.assigned_date BETWEEN p_start_date AND p_end_date
    GROUP BY oa.assigned_date
  ),
  daily_capacity AS (
    SELECT
      ds.work_date,
      COALESCE(av.available_hours, p.daily_capacity_hours, 8.0) as capacity
    FROM date_series ds
    CROSS JOIN (SELECT daily_capacity_hours FROM public.profiles WHERE id = p_operator_id) p
    LEFT JOIN public.operator_availability av
      ON av.operator_id = p_operator_id AND av.date = ds.work_date
  )
  SELECT
    dc.work_date,
    COALESCE(da.total_planned, 0)::DECIMAL as planned_hours,
    dc.capacity::DECIMAL as capacity_hours,
    CASE
      WHEN dc.capacity > 0 THEN ROUND((COALESCE(da.total_planned, 0) / dc.capacity) * 100, 1)
      ELSE 0
    END::DECIMAL as utilization_pct
  FROM daily_capacity dc
  LEFT JOIN daily_assignments da ON da.assigned_date = dc.work_date
  ORDER BY dc.work_date;
END;
$$ LANGUAGE plpgsql;
