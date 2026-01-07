-- Add barcode and stock columns to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS barcode TEXT,
ADD COLUMN IF NOT EXISTS stock NUMERIC DEFAULT 0;

-- Add index on barcode for faster lookups
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode) WHERE barcode IS NOT NULL;