-- Add type column to work_order_notes with default 'note'
ALTER TABLE public.work_order_notes 
ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'note';

-- Migrate existing data: entries with replies or mentions become 'comment'
UPDATE public.work_order_notes 
SET type = 'comment' 
WHERE reply_to_id IS NOT NULL 
   OR (mentions IS NOT NULL AND array_length(mentions, 1) > 0);