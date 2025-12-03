-- Create sequences for each product type
-- These ensure unique, incrementing serial numbers
CREATE SEQUENCE IF NOT EXISTS serial_sensor_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_mla_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_hmi_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_transmitter_seq START 1;
CREATE SEQUENCE IF NOT EXISTS serial_sdm_eco_seq START 1;

-- Function to generate next serial number for a product type
-- Returns format: Q-0001, W-0001, X-0001, T-0001, SDM-0001
CREATE OR REPLACE FUNCTION generate_serial_number(p_product_type product_type)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_sequence_name TEXT;
  v_next_number INTEGER;
  v_prefix TEXT;
  v_serial TEXT;
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
      v_prefix := 'SDM';
      v_sequence_name := 'serial_sdm_eco_seq';
    ELSE
      RAISE EXCEPTION 'Unknown product type: %', p_product_type;
  END CASE;

  -- Get next sequence value
  EXECUTE format('SELECT nextval(%L)', v_sequence_name) INTO v_next_number;

  -- Format as prefix-0001 (4-digit padded)
  v_serial := v_prefix || '-' || LPAD(v_next_number::TEXT, 4, '0');

  RETURN v_serial;
END;
$$;

-- Function to generate multiple serial numbers (for batch creation)
CREATE OR REPLACE FUNCTION generate_serial_numbers(
  p_product_type product_type,
  p_count INTEGER
)
RETURNS TEXT[]
LANGUAGE plpgsql
AS $$
DECLARE
  v_serials TEXT[] := '{}';
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

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION generate_serial_number(product_type) TO authenticated;
GRANT EXECUTE ON FUNCTION generate_serial_numbers(product_type, INTEGER) TO authenticated;

-- Initialize sequences from existing data (prevent conflicts)
DO $$
DECLARE
  v_max_sensor INTEGER;
  v_max_mla INTEGER;
  v_max_hmi INTEGER;
  v_max_transmitter INTEGER;
  v_max_sdm INTEGER;
BEGIN
  -- Extract max number from existing serials (if any)
  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^Q-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_sensor
  FROM work_order_items
  WHERE serial_number LIKE 'Q-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^W-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_mla
  FROM work_order_items
  WHERE serial_number LIKE 'W-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^X-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_hmi
  FROM work_order_items
  WHERE serial_number LIKE 'X-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^T-\d+$'
      THEN SUBSTRING(serial_number FROM 3)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_transmitter
  FROM work_order_items
  WHERE serial_number LIKE 'T-%';

  SELECT COALESCE(MAX(
    CASE
      WHEN serial_number ~ '^SDM-\d+$'
      THEN SUBSTRING(serial_number FROM 5)::INTEGER
      ELSE 0
    END
  ), 0) INTO v_max_sdm
  FROM work_order_items
  WHERE serial_number LIKE 'SDM-%';

  -- Set sequences to max + 1 (or 1 if no existing data)
  PERFORM setval('serial_sensor_seq', GREATEST(v_max_sensor + 1, 1), false);
  PERFORM setval('serial_mla_seq', GREATEST(v_max_mla + 1, 1), false);
  PERFORM setval('serial_hmi_seq', GREATEST(v_max_hmi + 1, 1), false);
  PERFORM setval('serial_transmitter_seq', GREATEST(v_max_transmitter + 1, 1), false);
  PERFORM setval('serial_sdm_eco_seq', GREATEST(v_max_sdm + 1, 1), false);
END;
$$;
