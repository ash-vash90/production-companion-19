-- Migration: Database-level webhook secret protection
--
-- Goal:
-- 1) Provide a safe way to read incoming_webhooks WITHOUT exposing secret_key
-- 2) Keep direct table access admin-only via RLS
--
-- Notes:
-- - This migration creates a SECURITY DEFINER view (default behavior) that returns a masked secret.
-- - The view additionally enforces admin-only visibility via public.has_role(auth.uid(), 'admin').
-- - The underlying table keeps strict admin-only RLS.

BEGIN;

-- 1) Ensure RLS is enabled on the base table
ALTER TABLE public.incoming_webhooks ENABLE ROW LEVEL SECURITY;

-- 2) Replace policy with a recursion-safe role check function
DROP POLICY IF EXISTS "Admins can manage incoming webhooks" ON public.incoming_webhooks;

CREATE POLICY "Admins can manage incoming webhooks"
ON public.incoming_webhooks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 3) Create a safe view that never exposes the full secret_key
--    We intentionally name the masked output column `secret_key` for drop-in compatibility.
CREATE OR REPLACE VIEW public.incoming_webhooks_safe AS
SELECT
  id,
  name,
  description,
  endpoint_key,
  (repeat('*', 8) || right(secret_key, 4)) AS secret_key,
  enabled,
  trigger_count,
  last_triggered_at,
  created_at,
  updated_at,
  created_by
FROM public.incoming_webhooks
WHERE public.has_role(auth.uid(), 'admin'::app_role);

-- 4) Allow authenticated users to query the safe view (non-admins will see zero rows)
GRANT SELECT ON public.incoming_webhooks_safe TO authenticated;

COMMIT;
