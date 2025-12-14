-- Create the missing trigger to handle new user signups
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert missing profile for existing user
INSERT INTO public.profiles (id, full_name, role, language)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'full_name', 'New User'),
  COALESCE((raw_user_meta_data->>'role')::app_role, 'operator'),
  COALESCE(raw_user_meta_data->>'language', 'en')
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;