-- Clear existing data that references production steps
DELETE FROM checklist_responses;
DELETE FROM step_executions;
DELETE FROM checklist_items;
DELETE FROM production_steps;

-- ============================================
-- SENSOR PRODUCTION STEPS (21 steps total)
-- ============================================

-- Step 1: Epoxy Preparation
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES ('SENSOR', 1, 1, 'Epoxy Preparation', 'Epoxy Voorbereiding', 'Scan epoxy batch number and record opening date', 'Scan epoxy batchnummer en registreer openingsdatum', true, 'epoxy');

-- Step 2: Piezo Gluing  
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES ('SENSOR', 2, 2, 'Piezo Gluing', 'Piezo Lijmen', 'Scan piezo batch number', 'Scan piezo batchnummer', true, 'piezo');

-- Step 3: Measurement #1 (≥ 13 or restart from 1)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure, restart_from_step)
VALUES ('SENSOR', 3, 3, 'Measurement #1', 'Meting #1', 'Oscilloscope value must be ≥ 13', 'Oscilloscoop waarde moet ≥ 13 zijn', true, '[{"name":"osc_value","label":"Oscilloscope Value","type":"number"}]'::jsonb, '{"min":13,"restart":1}'::jsonb, true, 1);

-- Step 4
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES ('SENSOR', 4, 4, 'Assembly Step 4', 'Assemblage Stap 4', 'Continue assembly', 'Ga door met assemblage');

-- Step 5: Measurement #2 (≥ 5.8V or restart from 4)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure, restart_from_step)
VALUES ('SENSOR', 5, 5, 'Measurement #2', 'Meting #2', 'Oscilloscope ≥ 5.8V', 'Oscilloscoop ≥ 5.8V', true, '[{"name":"osc_voltage","label":"Voltage (V)","type":"number"}]'::jsonb, '{"min":5.8,"restart":4}'::jsonb, true, 4);

-- Steps 6-7
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES 
  ('SENSOR', 6, 6, 'Assembly Step 6', 'Assemblage Stap 6', 'Continue', 'Ga door'),
  ('SENSOR', 7, 7, 'Assembly Step 7', 'Assemblage Stap 7', 'Continue', 'Ga door');

-- Step 8: Measurement #3 (< 3.5V)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 8, 8, 'RE/IE Pk-Pk Test', 'RE/IE Pk-Pk Test', 'Both < 3.5V', 'Beide < 3.5V', true, '[{"name":"re_pk_pk","label":"RE Pk-Pk (V)","type":"number"},{"name":"ie_pk_pk","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb, '{"max":3.5}'::jsonb, true);

-- Step 9: Measurement #4 (> 5.8V)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 9, 9, 'IE Pk-Pk Test', 'IE Pk-Pk Test', 'IE > 5.8V', 'IE > 5.8V', true, '[{"name":"ie_final","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb, '{"min":5.8}'::jsonb, true);

-- Steps 10-13
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES 
  ('SENSOR', 10, 10, 'Assembly Step 10', 'Assemblage Stap 10', 'Continue', 'Ga door'),
  ('SENSOR', 11, 11, 'Assembly Step 11', 'Assemblage Stap 11', 'Continue', 'Ga door'),
  ('SENSOR', 12, 12, 'Assembly Step 12', 'Assemblage Stap 12', 'Continue', 'Ga door'),
  ('SENSOR', 13, 13, 'Assembly Step 13', 'Assemblage Stap 13', 'Continue', 'Ga door');

-- Step 14: Measurement #5
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields)
VALUES ('SENSOR', 14, 14, 'Measurement #5', 'Meting #5', 'Record RE & IE', 'Registreer RE & IE', true, '[{"name":"re_5","label":"RE Pk-Pk (V)","type":"number"},{"name":"ie_5","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb);

-- Steps 15-17
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES 
  ('SENSOR', 15, 15, 'Assembly Step 15', 'Assemblage Stap 15', 'Continue', 'Ga door'),
  ('SENSOR', 16, 16, 'Assembly Step 16', 'Assemblage Stap 16', 'Continue', 'Ga door'),
  ('SENSOR', 17, 17, 'Assembly Step 17', 'Assemblage Stap 17', 'Continue', 'Ga door');

-- Step 18: Measurement #6
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields)
VALUES ('SENSOR', 18, 18, 'Measurement #6', 'Meting #6', 'Record RE & IE', 'Registreer RE & IE', true, '[{"name":"re_6","label":"RE Pk-Pk (V)","type":"number"},{"name":"ie_6","label":"IE Pk-Pk (V)","type":"number"}]'::jsonb);

-- Step 19: PT100 (108-112Ω)
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 19, 19, 'PT100 Test', 'PT100 Test', '108-112Ω required', '108-112Ω vereist', true, '[{"name":"pt100","label":"Resistance (Ω)","type":"number"}]'::jsonb, '{"min":108,"max":112}'::jsonb, true);

-- Step 20
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES ('SENSOR', 20, 20, 'Assembly Step 20', 'Assemblage Stap 20', 'Continue', 'Ga door');

-- Step 21: Pressure Test
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields, validation_rules, blocks_on_failure)
VALUES ('SENSOR', 21, 21, 'Pressure Test', 'Druktest', 'Must PASS', 'Moet SLAGEN', true, '[{"name":"pressure","label":"Result","type":"pass_fail"}]'::jsonb, '{"pass_fail":true}'::jsonb, true);

-- ============================================
-- TRANSMITTER (5 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES 
  ('TRANSMITTER', 1, 1, 'Scan PCB Batches', 'Scan PCB Batches', 'Scan 6 PCB batches', 'Scan 6 PCB batches', true, 'pcb'),
  ('TRANSMITTER', 2, 2, 'Scan POE Board', 'Scan POE Board', 'POE board serial', 'POE board serie', true, 'poe'),
  ('TRANSMITTER', 3, 3, 'SD Card (Optional)', 'SD Kaart (Optioneel)', 'SD card batch', 'SD kaart batch', false, null),
  ('TRANSMITTER', 4, 4, 'Assembly', 'Assemblage', 'Complete assembly', 'Voltooiing assemblage', false, null);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, has_checklist)
VALUES ('TRANSMITTER', 5, 5, 'Electronics Test', 'Elektronica Test', 'Complete checklist', 'Voltooi checklist', true);

-- Transmitter checklist
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Power supply test', 'Voeding test', 1, true FROM production_steps WHERE product_type='TRANSMITTER' AND step_number=5;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Communication test', 'Communicatie test', 2, true FROM production_steps WHERE product_type='TRANSMITTER' AND step_number=5;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'LED indicators', 'LED indicatoren', 3, true FROM production_steps WHERE product_type='TRANSMITTER' AND step_number=5;

-- ============================================
-- MLA (7 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES 
  ('MLA', 1, 1, 'Carrier Boards', 'Dragerkaarten', 'Scan batch', 'Scan batch', true, 'carrier'),
  ('MLA', 2, 2, 'SOMs', 'SOMs', 'Scan batch', 'Scan batch', true, 'som'),
  ('MLA', 3, 3, 'I/O Boards', 'I/O Boards', 'Scan batch', 'Scan batch', true, 'io'),
  ('MLA', 4, 4, 'Switch Boards', 'Switch Boards', 'Scan batch', 'Scan batch', true, 'switch'),
  ('MLA', 5, 5, 'Assembly', 'Assemblage', 'Complete', 'Voltooiing', false, null),
  ('MLA', 6, 6, 'Pre-Test', 'Voor-Test', 'Check', 'Controle', false, null);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, has_checklist)
VALUES ('MLA', 7, 7, 'Production Test', 'Productie Test', 'Mandatory checklist', 'Verplichte checklist', true);

-- MLA checklist
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'All LEDs functional', 'Alle LEDs functioneel', 1, true FROM production_steps WHERE product_type='MLA' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Network connectivity', 'Netwerkverbinding', 2, true FROM production_steps WHERE product_type='MLA' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'I/O ports tested', 'I/O poorten getest', 3, true FROM production_steps WHERE product_type='MLA' AND step_number=7;

-- ============================================
-- HMI (7 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type)
VALUES 
  ('HMI', 1, 1, 'Scan Display', 'Scan Display', 'Display batch', 'Display batch', true, 'display'),
  ('HMI', 2, 2, 'Display Assembly', 'Display Assemblage', 'Assemble', 'Monteer', false, null),
  ('HMI', 3, 3, 'Electronics', 'Elektronica', 'Assembly', 'Assemblage', false, null),
  ('HMI', 4, 4, 'Housing', 'Behuizing', 'Assembly', 'Assemblage', false, null),
  ('HMI', 5, 5, 'Pre-Test', 'Voor-Test', 'Checks', 'Controles', false, null),
  ('HMI', 6, 6, 'Water Test', 'Watertest', 'Perform test', 'Uitvoeren test', false, null);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, has_checklist, requires_value_input, measurement_fields)
VALUES ('HMI', 7, 7, 'Final Check', 'Definitieve Check', 'Checklist + water result', 'Checklist + waterresultaat', true, true, '[{"name":"water_test","label":"Water Test","type":"pass_fail"}]'::jsonb);

-- HMI checklist
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Display functional', 'Display functioneel', 1, true FROM production_steps WHERE product_type='HMI' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Touch response OK', 'Touch reactie OK', 2, true FROM production_steps WHERE product_type='HMI' AND step_number=7;
INSERT INTO checklist_items (production_step_id, item_text_en, item_text_nl, sort_order, required)
SELECT id, 'Water test passed', 'Watertest geslaagd', 3, true FROM production_steps WHERE product_type='HMI' AND step_number=7;

-- ============================================
-- SDM-ECO (7 steps)
-- ============================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_barcode_scan)
VALUES 
  ('SDM_ECO', 1, 1, 'Link Sensor', 'Koppel Sensor', 'Scan Sensor S/N', 'Scan Sensor S/N', true),
  ('SDM_ECO', 2, 2, 'Link MLA', 'Koppel MLA', 'Scan MLA S/N', 'Scan MLA S/N', true),
  ('SDM_ECO', 3, 3, 'Link HMI', 'Koppel HMI', 'Scan HMI S/N', 'Scan HMI S/N', true),
  ('SDM_ECO', 4, 4, 'Link Transmitter', 'Koppel Transmitter', 'Scan Transmitter S/N', 'Scan Transmitter S/N', true),
  ('SDM_ECO', 5, 5, 'Final Assembly', 'Eindassemblage', 'Complete', 'Voltooiing', false);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_value_input, measurement_fields)
VALUES ('SDM_ECO', 6, 6, 'Calibration', 'Kalibratie', 'Enter calibration data', 'Voer kalibratiegegevens in', true, '[{"name":"offset","label":"Offset","type":"number"},{"name":"gain","label":"Gain","type":"number"}]'::jsonb);

INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl)
VALUES ('SDM_ECO', 7, 7, 'Quality Certificate', 'Kwaliteitscertificaat', 'Generate certificate', 'Genereer certificaat');