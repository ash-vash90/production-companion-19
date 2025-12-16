-- Add RLS policies for storage buckets
-- This fixes "new row violates row-level security policy" errors

-- =====================================================
-- AVATARS BUCKET POLICIES
-- =====================================================

-- Users can upload their own avatar (path must start with their user ID)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Anyone can view avatars (public bucket)
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'avatars' AND 
  (storage.foldername(name))[1] = auth.uid()::text
);

-- =====================================================
-- CERTIFICATE TEMPLATES BUCKET POLICIES
-- =====================================================

-- Only admins can upload certificate templates
CREATE POLICY "Admins can upload certificate templates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'certificate-templates' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Authenticated users can view certificate templates
CREATE POLICY "Authenticated users can view certificate templates"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'certificate-templates');

-- Admins can update certificate templates
CREATE POLICY "Admins can update certificate templates"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'certificate-templates' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Admins can delete certificate templates
CREATE POLICY "Admins can delete certificate templates"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'certificate-templates' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- =====================================================
-- INSTRUCTION MEDIA BUCKET POLICIES
-- =====================================================

-- Admins and supervisors can upload instruction media
CREATE POLICY "Admins and supervisors can upload instruction media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'instruction-media' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
);

-- Anyone can view instruction media (public bucket)
CREATE POLICY "Anyone can view instruction media"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'instruction-media');

-- Admins and supervisors can update instruction media
CREATE POLICY "Admins and supervisors can update instruction media"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'instruction-media' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
);

-- Admins and supervisors can delete instruction media
CREATE POLICY "Admins and supervisors can delete instruction media"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'instruction-media' AND
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'supervisor'))
);
