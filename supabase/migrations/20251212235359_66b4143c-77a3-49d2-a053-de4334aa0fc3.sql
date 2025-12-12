-- Create certificate_templates table
CREATE TABLE public.certificate_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  product_type TEXT, -- NULL means default/all products
  template_url TEXT NOT NULL,
  field_mappings JSONB NOT NULL DEFAULT '{}',
  detected_fields TEXT[] DEFAULT '{}',
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage certificate templates"
ON public.certificate_templates
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles
  WHERE user_roles.user_id = auth.uid()
  AND user_roles.role = 'admin'
));

CREATE POLICY "Users can view active templates"
ON public.certificate_templates
FOR SELECT
USING (active = true);

-- Create storage bucket for templates
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificate-templates', 'certificate-templates', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certificate-templates bucket
CREATE POLICY "Admins can upload certificate templates"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'certificate-templates' 
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Authenticated users can view certificate templates"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'certificate-templates'
  AND auth.uid() IS NOT NULL
);

CREATE POLICY "Admins can update certificate templates"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'certificate-templates'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

CREATE POLICY "Admins can delete certificate templates"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'certificate-templates'
  AND EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_roles.user_id = auth.uid()
    AND user_roles.role = 'admin'
  )
);

-- Update trigger for updated_at
CREATE TRIGGER update_certificate_templates_updated_at
BEFORE UPDATE ON public.certificate_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();