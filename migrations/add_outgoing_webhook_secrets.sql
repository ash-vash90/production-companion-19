-- Migration: Add HMAC secrets to outgoing webhooks
-- Adds secret_key column for webhook signing support

BEGIN;

-- Add secret_key column to zapier_webhooks table
ALTER TABLE public.zapier_webhooks 
ADD COLUMN IF NOT EXISTS secret_key TEXT DEFAULT encode(extensions.gen_random_bytes(32), 'hex');

-- Create a safe view that masks the secret
CREATE OR REPLACE VIEW public.zapier_webhooks_safe AS
SELECT 
  id,
  name,
  webhook_url,
  event_type,
  enabled,
  created_by,
  created_at,
  updated_at,
  CASE 
    WHEN secret_key IS NOT NULL THEN '********' || RIGHT(secret_key, 4)
    ELSE NULL
  END AS secret_key
FROM public.zapier_webhooks;

-- Grant access to the safe view
GRANT SELECT ON public.zapier_webhooks_safe TO authenticated;

COMMIT;
