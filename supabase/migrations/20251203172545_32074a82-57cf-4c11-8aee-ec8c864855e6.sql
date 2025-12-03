-- Create system_settings table for configurable values
CREATE TABLE public.system_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL DEFAULT '{}',
  description text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view settings
CREATE POLICY "Users can view settings" 
ON public.system_settings 
FOR SELECT 
USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can manage settings" 
ON public.system_settings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles 
  WHERE user_roles.user_id = auth.uid() 
  AND user_roles.role = 'admin'
));

-- Add trigger for updated_at
CREATE TRIGGER update_system_settings_updated_at
BEFORE UPDATE ON public.system_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default settings
INSERT INTO public.system_settings (setting_key, setting_value, description) VALUES
('work_order_format', '{"prefix": "WO", "dateFormat": "YYYYMMDD", "separator": "-"}', 'Format for auto-generated work order numbers'),
('serial_prefixes', '{"SENSOR": "Q", "MLA": "W", "HMI": "X", "TRANSMITTER": "T", "SDM_ECO": "SDM"}', 'Serial number prefixes for each product type'),
('serial_format', '{"padLength": 4, "separator": "-"}', 'Serial number format configuration');