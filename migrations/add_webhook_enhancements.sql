-- Migration: Enhanced webhook testing and logging
-- Adds outgoing webhook logs, payload configuration, and test flags

BEGIN;

-- 1) Create outgoing_webhook_logs table for tracking system-sent webhooks
CREATE TABLE IF NOT EXISTS public.outgoing_webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES public.zapier_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  response_status INTEGER,
  response_body JSONB,
  response_time_ms INTEGER,
  error_message TEXT,
  delivery_id TEXT,
  attempts INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on outgoing_webhook_logs
ALTER TABLE public.outgoing_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view outgoing webhook logs
CREATE POLICY "Admins can view outgoing webhook logs"
ON public.outgoing_webhook_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'::app_role
  )
);

-- Service can insert outgoing webhook logs
CREATE POLICY "Service can insert outgoing webhook logs"
ON public.outgoing_webhook_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 2) Add payload_config column to automation_rules for field selection
ALTER TABLE public.automation_rules 
ADD COLUMN IF NOT EXISTS payload_config JSONB DEFAULT '{"includeAll": true, "fields": [], "transforms": []}'::jsonb;

-- 3) Add is_test flag to webhook_logs to differentiate test calls
ALTER TABLE public.webhook_logs 
ADD COLUMN IF NOT EXISTS is_test BOOLEAN DEFAULT false;

-- 4) Add response_time_ms to webhook_logs for performance tracking
ALTER TABLE public.webhook_logs 
ADD COLUMN IF NOT EXISTS response_time_ms INTEGER;

-- 5) Create index for faster log queries
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(incoming_webhook_id);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_logs_created_at ON public.outgoing_webhook_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outgoing_webhook_logs_webhook_id ON public.outgoing_webhook_logs(webhook_id);

COMMIT;
