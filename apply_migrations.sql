-- =====================================================
-- PRODUCTION COMPANION - DATABASE MIGRATIONS
-- Apply these migrations to your Supabase project
-- =====================================================
-- Instructions:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to apply all migrations
-- =====================================================

-- Migration 1: Add webhook secret key and tracking columns
-- =====================================================
ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS secret_key TEXT;

ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS last_triggered_at TIMESTAMPTZ;

ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS last_error TEXT;

ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS success_count INTEGER DEFAULT 0;

ALTER TABLE public.zapier_webhooks
ADD COLUMN IF NOT EXISTS failure_count INTEGER DEFAULT 0;

-- Generate secret keys for existing webhooks
UPDATE public.zapier_webhooks
SET secret_key = encode(gen_random_bytes(32), 'hex')
WHERE secret_key IS NULL;

-- Migration 2: Create certificates storage bucket
-- =====================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('certificates', 'certificates', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for certificates bucket
CREATE POLICY IF NOT EXISTS "Authenticated users can upload certificates"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'certificates');

CREATE POLICY IF NOT EXISTS "Public can view certificates"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'certificates');

CREATE POLICY IF NOT EXISTS "Authenticated users can update certificates"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'certificates');

CREATE POLICY IF NOT EXISTS "Authenticated users can delete certificates"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'certificates');

-- Migration 3: Create serial number sequences and functions
-- =====================================================

-- Create sequences for each product type
CREATE SEQUENCE IF NOT EXISTS serial_sensor_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_mla_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_hmi_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_transmitter_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_sdm_eco_seq START 1;

-- Function to generate a single serial number
CREATE OR REPLACE FUNCTION generate_serial_number(p_product_type product_type)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_prefix TEXT;
  v_sequence_name TEXT;
  v_next_number INTEGER;
BEGIN
  -- Determine prefix and sequence based on product type
  CASE p_product_type
    WHEN 'SENSOR' THEN
      v_prefix := 'Q';
      v_sequence_name := 'serial_sensor_seq';
    WHEN 'MLA' THEN
      v_prefix := 'W';
      v_sequence_name := 'serial_mla_seq';
    WHEN 'HMI' THEN
      v_prefix := 'X';
      v_sequence_name := 'serial_hmi_seq';
    WHEN 'TRANSMITTER' THEN
      v_prefix := 'T';
      v_sequence_name := 'serial_transmitter_seq';
    WHEN 'SDM_ECO' THEN
      v_prefix := 'S';
      v_sequence_name := 'serial_sdm_eco_seq';
    ELSE
      RAISE EXCEPTION 'Unknown product type: %', p_product_type;
  END CASE;

  -- Get next sequence value
  EXECUTE format('SELECT nextval(%L)', v_sequence_name) INTO v_next_number;

  -- Return formatted serial number (e.g., Q-0001)
  RETURN v_prefix || '-' || LPAD(v_next_number::TEXT, 4, '0');
END;
$$;

-- Function to generate multiple serial numbers
CREATE OR REPLACE FUNCTION generate_serial_numbers(
  p_product_type product_type,
  p_count INTEGER
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_serials TEXT[] := ARRAY[]::TEXT[];
  v_serial TEXT;
  i INTEGER;
BEGIN
  FOR i IN 1..p_count LOOP
    v_serial := generate_serial_number(p_product_type);
    v_serials := array_append(v_serials, v_serial);
  END LOOP;

  RETURN v_serials;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION generate_serial_number(product_type) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_serial_numbers(product_type, INTEGER) TO authenticated;

-- Initialize sequences from existing data (prevents duplicates)
DO $$
DECLARE
  v_max_sensor INTEGER;
  v_max_mla INTEGER;
  v_max_hmi INTEGER;
  v_max_transmitter INTEGER;
  v_max_sdm_eco INTEGER;
BEGIN
  -- Get max serial numbers for each product type
  SELECT COALESCE(MAX(CAST(SUBSTRING(serial_number FROM 3) AS INTEGER)), 0)
  INTO v_max_sensor
  FROM work_order_items
  WHERE serial_number LIKE 'Q-%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(serial_number FROM 3) AS INTEGER)), 0)
  INTO v_max_mla
  FROM work_order_items
  WHERE serial_number LIKE 'W-%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(serial_number FROM 3) AS INTEGER)), 0)
  INTO v_max_hmi
  FROM work_order_items
  WHERE serial_number LIKE 'X-%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(serial_number FROM 3) AS INTEGER)), 0)
  INTO v_max_transmitter
  FROM work_order_items
  WHERE serial_number LIKE 'T-%';

  SELECT COALESCE(MAX(CAST(SUBSTRING(serial_number FROM 3) AS INTEGER)), 0)
  INTO v_max_sdm_eco
  FROM work_order_items
  WHERE serial_number LIKE 'S-%';

  -- Set sequences to start after existing max values
  PERFORM setval('serial_sensor_seq', v_max_sensor + 1, false);
  PERFORM setval('serial_mla_seq', v_max_mla + 1, false);
  PERFORM setval('serial_hmi_seq', v_max_hmi + 1, false);
  PERFORM setval('serial_transmitter_seq', v_max_transmitter + 1, false);
  PERFORM setval('serial_sdm_eco_seq', v_max_sdm_eco + 1, false);
END;
$$;

-- =====================================================
-- MIGRATIONS COMPLETE
-- =====================================================
-- You can now:
-- 1. Create work orders with auto-generated WO numbers
-- 2. Generate serial numbers (Q-0001, W-0001, etc.)
-- 3. Generate quality certificates with PDF storage
-- 4. Use webhook signatures for security
-- =====================================================
