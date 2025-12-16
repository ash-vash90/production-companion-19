-- Add new permissions for work order editing controls
INSERT INTO permissions (id, name, description, category) VALUES
  ('edit_work_orders', 'Edit Work Orders', 'Edit work order details like customer, dates, notes', 'production'),
  ('edit_work_order_pricing', 'Edit Pricing', 'Edit order value and financial details', 'production'),
  ('change_work_order_status', 'Change Status', 'Change work order status (planned, in progress, etc.)', 'production')
ON CONFLICT (id) DO NOTHING;

-- Grant permissions to admin role
INSERT INTO role_permissions (role, permission_id, granted) VALUES
  ('admin', 'edit_work_orders', true),
  ('admin', 'edit_work_order_pricing', true),
  ('admin', 'change_work_order_status', true)
ON CONFLICT ON CONSTRAINT role_permissions_role_permission_id_key DO NOTHING;

-- Grant edit and status change to supervisors (not pricing)
INSERT INTO role_permissions (role, permission_id, granted) VALUES
  ('supervisor', 'edit_work_orders', true),
  ('supervisor', 'change_work_order_status', true)
ON CONFLICT ON CONSTRAINT role_permissions_role_permission_id_key DO NOTHING;
