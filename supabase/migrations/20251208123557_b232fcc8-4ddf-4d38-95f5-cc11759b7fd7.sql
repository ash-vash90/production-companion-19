-- Create work_order_notes table for notes and comments on work orders
CREATE TABLE public.work_order_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  work_order_item_id UUID REFERENCES public.work_order_items(id) ON DELETE CASCADE,
  step_number INTEGER,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.work_order_notes ENABLE ROW LEVEL SECURITY;

-- Everyone can view notes
CREATE POLICY "Users can view all notes"
ON public.work_order_notes
FOR SELECT
USING (true);

-- Users can create notes
CREATE POLICY "Users can create notes"
ON public.work_order_notes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own notes
CREATE POLICY "Users can update own notes"
ON public.work_order_notes
FOR UPDATE
USING (auth.uid() = user_id);

-- Users can delete their own notes, admins can delete any
CREATE POLICY "Users can delete own notes"
ON public.work_order_notes
FOR DELETE
USING (auth.uid() = user_id OR EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'
));

-- Create index for faster lookups
CREATE INDEX idx_work_order_notes_work_order ON public.work_order_notes(work_order_id);
CREATE INDEX idx_work_order_notes_item ON public.work_order_notes(work_order_item_id);

-- Enable realtime for notes
ALTER PUBLICATION supabase_realtime ADD TABLE public.work_order_notes;