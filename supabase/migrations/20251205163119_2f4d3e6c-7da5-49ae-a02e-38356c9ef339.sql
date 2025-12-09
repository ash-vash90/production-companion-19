-- Fix 1: Prevent users from modifying their own profile role column (privilege escalation fix)
-- Create a trigger function to prevent role column modifications by non-admins
CREATE OR REPLACE FUNCTION public.prevent_role_self_modification()
RETURNS TRIGGER AS $$
BEGIN
  -- If role is being changed
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    -- Check if the current user is an admin in user_roles table
    IF NOT EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() 
      AND role = 'admin'
    ) THEN
      -- Non-admin trying to change role - reject
      RAISE EXCEPTION 'Only administrators can modify user roles';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create the trigger on profiles table
DROP TRIGGER IF EXISTS prevent_role_modification ON public.profiles;
CREATE TRIGGER prevent_role_modification
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_role_self_modification();

-- Fix 2: Tighten RLS policies on batch_materials
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can insert batch materials" ON public.batch_materials;
DROP POLICY IF EXISTS "Users can update batch materials" ON public.batch_materials;

-- Create more restrictive INSERT policy
-- Users can insert batch materials if they scanned it OR are admin/supervisor
CREATE POLICY "Users can insert batch materials"
ON public.batch_materials
FOR INSERT
WITH CHECK (
  auth.uid() = scanned_by 
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
);

-- Create more restrictive UPDATE policy
-- Only the user who scanned or admins/supervisors can update
CREATE POLICY "Users can update batch materials"
ON public.batch_materials
FOR UPDATE
USING (
  auth.uid() = scanned_by 
  OR EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role IN ('admin', 'supervisor')
  )
);