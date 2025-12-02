-- Create enum for automation action types
CREATE TYPE public.automation_action_type AS ENUM (
  'create_work_order',
  'update_work_order_status',
  'update_item_status',
  'log_activity',
  'trigger_outgoing_webhook'
);

-- Table for incoming webhook endpoints
CREATE TABLE public.incoming_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  endpoint_key TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  secret_key TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  trigger_count INTEGER NOT NULL DEFAULT 0
);

-- Table for automation rules tied to webhooks
CREATE TABLE public.automation_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incoming_webhook_id UUID NOT NULL REFERENCES public.incoming_webhooks(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  action_type automation_action_type NOT NULL,
  field_mappings JSONB NOT NULL DEFAULT '{}',
  conditions JSONB DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for webhook execution logs
CREATE TABLE public.webhook_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  incoming_webhook_id UUID NOT NULL REFERENCES public.incoming_webhooks(id) ON DELETE CASCADE,
  request_body JSONB,
  request_headers JSONB,
  response_status INTEGER,
  response_body JSONB,
  error_message TEXT,
  executed_rules JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.incoming_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for incoming_webhooks (admin only)
CREATE POLICY "Admins can manage incoming webhooks"
ON public.incoming_webhooks
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
));

-- RLS Policies for automation_rules (admin only)
CREATE POLICY "Admins can manage automation rules"
ON public.automation_rules
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
));

-- RLS Policies for webhook_logs (admin only to view)
CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
));

-- Service role can insert logs (from edge function)
CREATE POLICY "Service can insert webhook logs"
ON public.webhook_logs
FOR INSERT
WITH CHECK (true);

-- Triggers for updated_at
CREATE TRIGGER update_incoming_webhooks_updated_at
  BEFORE UPDATE ON public.incoming_webhooks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_automation_rules_updated_at
  BEFORE UPDATE ON public.automation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();