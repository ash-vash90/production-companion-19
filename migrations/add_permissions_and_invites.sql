-- =============================================
-- PERMISSIONS AND USER INVITES SYSTEM
-- =============================================

-- 1. Create permissions table for granular permission configuration
CREATE TABLE IF NOT EXISTS public.permissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general'
);

-- Enable RLS
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can view permissions
CREATE POLICY "Users can view all permissions" ON public.permissions
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage permissions
CREATE POLICY "Admins can manage permissions" ON public.permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Create role_permissions table for role-to-permission mappings
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id TEXT NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  granted BOOLEAN NOT NULL DEFAULT true,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(role, permission_id)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Everyone can view role permissions
CREATE POLICY "Users can view all role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Only admins can manage role permissions
CREATE POLICY "Admins can manage role permissions" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Create user_invites table for inviting new users
CREATE TABLE IF NOT EXISTS public.user_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'operator',
  invited_by UUID REFERENCES auth.users(id),
  invite_token TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_invites ENABLE ROW LEVEL SECURITY;

-- Admins can view and manage invites
CREATE POLICY "Admins can manage user invites" ON public.user_invites
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow unauthenticated access to check invite tokens (for signup flow)
CREATE POLICY "Anyone can check invite tokens" ON public.user_invites
  FOR SELECT TO anon
  USING (used_at IS NULL AND expires_at > now());

-- 4. Seed default permissions
INSERT INTO public.permissions (id, name, description, category) VALUES
  ('view_dashboard', 'View Dashboard', 'Access the main dashboard', 'general'),
  ('view_work_orders', 'View Work Orders', 'See list of work orders', 'production'),
  ('create_work_orders', 'Create Work Orders', 'Create new work orders', 'production'),
  ('cancel_work_orders', 'Cancel Work Orders', 'Cancel existing work orders', 'production'),
  ('view_reports', 'View Reports', 'Access production reports', 'reports'),
  ('export_reports', 'Export Reports', 'Export reports to PDF', 'reports'),
  ('manage_inventory', 'Manage Inventory', 'Add/edit inventory items', 'inventory'),
  ('view_inventory', 'View Inventory', 'See inventory levels', 'inventory'),
  ('manage_users', 'Manage Users', 'Add/edit user roles', 'settings'),
  ('manage_settings', 'Manage Settings', 'Configure system settings', 'settings'),
  ('view_calendar', 'View Calendar', 'Access production calendar', 'production'),
  ('assign_operators', 'Assign Operators', 'Assign operators to work orders', 'production'),
  ('view_analytics', 'View Analytics', 'Access analytics dashboard', 'reports'),
  ('manage_work_instructions', 'Manage Work Instructions', 'Create/edit work instructions', 'settings'),
  ('view_certificates', 'View Certificates', 'Access quality certificates', 'quality'),
  ('generate_certificates', 'Generate Certificates', 'Generate quality certificates', 'quality'),
  ('view_genealogy', 'View Genealogy', 'Access product genealogy', 'production'),
  ('execute_steps', 'Execute Steps', 'Execute production steps', 'production')
ON CONFLICT (id) DO NOTHING;

-- 5. Seed default role permissions (matching current hard-coded behavior)
-- Admin gets all permissions
INSERT INTO public.role_permissions (role, permission_id, granted)
SELECT 'admin'::app_role, id, true FROM public.permissions
ON CONFLICT (role, permission_id) DO NOTHING;

-- Supervisor gets most except manage_users
INSERT INTO public.role_permissions (role, permission_id, granted) VALUES
  ('supervisor', 'view_dashboard', true),
  ('supervisor', 'view_work_orders', true),
  ('supervisor', 'create_work_orders', true),
  ('supervisor', 'cancel_work_orders', true),
  ('supervisor', 'view_reports', true),
  ('supervisor', 'export_reports', true),
  ('supervisor', 'manage_inventory', true),
  ('supervisor', 'view_inventory', true),
  ('supervisor', 'view_calendar', true),
  ('supervisor', 'assign_operators', true),
  ('supervisor', 'view_analytics', true),
  ('supervisor', 'manage_work_instructions', true),
  ('supervisor', 'view_certificates', true),
  ('supervisor', 'generate_certificates', true),
  ('supervisor', 'view_genealogy', true),
  ('supervisor', 'execute_steps', true)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Operator gets basic production permissions
INSERT INTO public.role_permissions (role, permission_id, granted) VALUES
  ('operator', 'view_dashboard', true),
  ('operator', 'view_work_orders', true),
  ('operator', 'view_reports', true),
  ('operator', 'view_inventory', true),
  ('operator', 'view_certificates', true),
  ('operator', 'view_genealogy', true),
  ('operator', 'execute_steps', true),
  ('operator', 'view_calendar', true)
ON CONFLICT (role, permission_id) DO NOTHING;

-- Logistics gets inventory and shipping permissions
INSERT INTO public.role_permissions (role, permission_id, granted) VALUES
  ('logistics', 'view_dashboard', true),
  ('logistics', 'view_work_orders', true),
  ('logistics', 'manage_inventory', true),
  ('logistics', 'view_inventory', true),
  ('logistics', 'view_certificates', true),
  ('logistics', 'view_calendar', true)
ON CONFLICT (role, permission_id) DO NOTHING;

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON public.role_permissions(permission_id);
CREATE INDEX IF NOT EXISTS idx_user_invites_token ON public.user_invites(invite_token);
CREATE INDEX IF NOT EXISTS idx_user_invites_email ON public.user_invites(email);

-- 7. Trigger to update updated_at
CREATE OR REPLACE FUNCTION public.update_role_permissions_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_role_permissions_timestamp ON public.role_permissions;
CREATE TRIGGER update_role_permissions_timestamp
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_role_permissions_timestamp();
