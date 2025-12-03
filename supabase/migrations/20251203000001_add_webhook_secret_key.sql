-- Add secret_key field to zapier_webhooks for HMAC signing
-- This allows webhook receivers to verify the authenticity of requests

ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS secret_key TEXT;

-- Generate a secret key for existing webhooks (if any)
UPDATE public.zapier_webhooks
SET secret_key = encode(gen_random_bytes(32), 'hex')
WHERE secret_key IS NULL;

-- Make secret_key required for new webhooks
ALTER TABLE public.zapier_webhooks
ALTER COLUMN secret_key SET DEFAULT encode(gen_random_bytes(32), 'hex');

-- Add column for tracking webhook success/failure
ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_error TEXT,
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;
