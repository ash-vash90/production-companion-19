-- Add notification preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_prefs jsonb DEFAULT '{"in_app": true, "push": false, "email": false, "mentions": true, "work_order_updates": true, "step_completions": false}'::jsonb;

-- Add reply_to_id for threaded comments
ALTER TABLE public.work_order_notes
ADD COLUMN IF NOT EXISTS reply_to_id uuid REFERENCES public.work_order_notes(id) ON DELETE SET NULL;

-- Add mentions array to track tagged users
ALTER TABLE public.work_order_notes
ADD COLUMN IF NOT EXISTS mentions uuid[] DEFAULT '{}';

-- Create index for faster mention lookups
CREATE INDEX IF NOT EXISTS idx_work_order_notes_mentions ON public.work_order_notes USING GIN(mentions);

-- Create index for reply threads
CREATE INDEX IF NOT EXISTS idx_work_order_notes_reply_to ON public.work_order_notes(reply_to_id);