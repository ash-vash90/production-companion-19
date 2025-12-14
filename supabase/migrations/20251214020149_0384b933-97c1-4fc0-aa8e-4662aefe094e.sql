
-- Clear existing production steps and checklist items
DELETE FROM checklist_responses;
DELETE FROM checklist_items;
DELETE FROM step_executions;
DELETE FROM production_steps;

-- =====================================================
-- SENSOR Production Steps (21 steps)
-- =====================================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type, requires_value_input, value_label_en, value_label_nl, value_unit, validation_rules, requires_barcode_scan, has_checklist, blocks_on_failure, restart_from_step) VALUES
('SENSOR', 1, 1, 'Generate Serial Number', 'Serienummer genereren', 'Generate and print serial number label', 'Genereer en print serienummer label', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 2, 2, 'Prepare Gluing - Epoxy Batch', 'Voorbereiden verlijming - Epoxy batch', 'Scan epoxy batch number and record opening date', 'Scan epoxy batchnummer en noteer openingsdatum', true, 'epoxy', false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 3, 3, 'Glue Piezo', 'Verlijming piëzo', 'Glue piezo element and measure voltage. Must be ≥13V or restart from step 1', 'Verlijm piëzo element en meet spanning. Moet ≥13V zijn of herstart vanaf stap 1', true, 'piezo', true, 'Piezo Voltage', 'Piëzo spanning', 'V', '{"min": 13, "restart_on_fail": 1}', false, false, true, 1),
('SENSOR', 4, 4, 'Glue Material X', 'Verlijming Materiaal X', 'Apply Material X and measure voltage. Must be ≥5.8V or restart from step 4', 'Breng Materiaal X aan en meet spanning. Moet ≥5.8V zijn of herstart vanaf stap 4', false, NULL, true, 'Material X Voltage', 'Materiaal X spanning', 'V', '{"min": 5.8, "restart_on_fail": 4}', false, false, true, 4),
('SENSOR', 5, 5, 'Place Spring in Fixture', 'Plaats veer in hulpstuk', 'Position spring correctly in curing fixture', 'Positioneer veer correct in uithardingshulpstuk', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 6, 6, 'Cure in Oven', 'Uitharden in oven', 'Cure assembly in oven for 5.5 hours', 'Uitharden in oven gedurende 5,5 uur', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 7, 7, 'Remove from Oven', 'Uit oven halen', 'Remove cured assembly from oven', 'Verwijder uitgehard assemblage uit oven', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 8, 8, 'Measure RE/IE Pk-Pk', 'Meet RE/IE Pk-Pk', 'Measure RE/IE peak-to-peak voltage. Must be <3.5V', 'Meet RE/IE piek-piek spanning. Moet <3.5V zijn', false, NULL, true, 'RE/IE Pk-Pk Voltage', 'RE/IE Pk-Pk spanning', 'V', '{"max": 3.5}', false, false, true, NULL),
('SENSOR', 9, 9, 'Measure IE Pk-Pk Voltage', 'Meet IE Pk-Pk spanning', 'Measure IE peak-to-peak voltage. Must be >5.8V', 'Meet IE piek-piek spanning. Moet >5.8V zijn', false, NULL, true, 'IE Pk-Pk Voltage', 'IE Pk-Pk spanning', 'V', '{"min": 5.8}', false, false, true, NULL),
('SENSOR', 10, 10, 'Glue PT100', 'Verlijmen PT100', 'Glue PT100 temperature sensor in place', 'Verlijm PT100 temperatuursensor op zijn plaats', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 11, 11, 'Prepare Sensor PCB', 'Sensor PCB voorbereiden', 'Prepare and position sensor PCB', 'Bereid sensor PCB voor en positioneer', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 12, 12, 'Mount Delay Line Assembly', 'Montage delay line', 'Mount the delay line assembly', 'Monteer de delay line assemblage', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 13, 13, 'Cure Epoxy', 'Uitharden epoxy', 'Allow epoxy to cure', 'Laat epoxy uitharden', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 14, 14, 'Measure RE/IE Pk-Pk (Post-cure)', 'Meet RE/IE Pk-Pk (na uitharding)', 'Measure RE/IE Pk-Pk after curing', 'Meet RE/IE Pk-Pk na uitharding', false, NULL, true, 'RE/IE Pk-Pk (Post-cure)', 'RE/IE Pk-Pk (na uitharding)', 'V', NULL, false, false, false, NULL),
('SENSOR', 15, 15, 'Glue Sensor Tip', 'Sensortip verlijmen', 'Apply Loctite 577 and glue sensor tip', 'Breng Loctite 577 aan en verlijm sensortip', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 16, 16, 'Mount Flange', 'Montage flensdeel', 'Mount flange with Loctite 638/648', 'Monteer flens met Loctite 638/648', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 17, 17, 'Mount Connector', 'Montage connector', 'Mount and secure connector', 'Monteer en bevestig connector', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 18, 18, 'Measure RE/IE Pk-Pk (Final)', 'Meet RE/IE Pk-Pk (eindcontrole)', 'Final RE/IE Pk-Pk measurement', 'Eindcontrole RE/IE Pk-Pk meting', false, NULL, true, 'RE/IE Pk-Pk (Final)', 'RE/IE Pk-Pk (eindcontrole)', 'V', NULL, false, false, false, NULL),
('SENSOR', 19, 19, 'PT100 Resistance Test', 'PT100 weerstandstest', 'Measure PT100 resistance. Must be 108-112Ω', 'Meet PT100 weerstand. Moet 108-112Ω zijn', false, NULL, true, 'PT100 Resistance', 'PT100 weerstand', 'Ω', '{"min": 108, "max": 112}', false, false, true, NULL),
('SENSOR', 20, 20, 'Cure Loctite', 'Uitharden Loctite', 'Allow Loctite to cure for 16 hours', 'Laat Loctite uitharden gedurende 16 uur', false, NULL, false, NULL, NULL, NULL, NULL, false, false, false, NULL),
('SENSOR', 21, 21, 'Pressure Test', 'Druktest', 'Perform final pressure test - PASS/No Pass', 'Voer einddruktest uit - PASS/No Pass', false, NULL, true, 'Pressure Test Result', 'Druktest resultaat', NULL, '{"type": "pass_fail"}', false, false, true, NULL);

-- =====================================================
-- TRANSMITTER Production Steps (7 steps)
-- =====================================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type, requires_value_input, requires_barcode_scan, has_checklist) VALUES
('TRANSMITTER', 1, 1, 'Scan PCB Batch Numbers', 'Scan PCB batchnummers', 'Scan batch numbers for 6 PCB components', 'Scan batchnummers voor 6 PCB componenten', true, 'pcb', false, false, false),
('TRANSMITTER', 2, 2, 'Frame Assembly', 'Frame assembleren', 'Assemble frame with USB side and electronics', 'Assembleer frame met USB-zijde en elektronica', false, NULL, false, false, false),
('TRANSMITTER', 3, 3, 'Scan POE Board', 'Scan POE board', 'Scan POE board serial number', 'Scan POE board serienummer', false, NULL, false, true, false),
('TRANSMITTER', 4, 4, 'Place SD Card', 'SD kaart plaatsen', 'Insert and secure SD card', 'Plaats en bevestig SD kaart', false, NULL, false, false, false),
('TRANSMITTER', 5, 5, 'Electronics Test', 'Testen elektronica', 'Complete electronics test with checklist', 'Voltooi elektronicatest met checklist', false, NULL, false, false, true),
('TRANSMITTER', 6, 6, 'Mount Protection Plate', 'Monteer beschermplaat', 'Mount the protection plate', 'Monteer de beschermplaat', false, NULL, false, false, false),
('TRANSMITTER', 7, 7, 'Apply Labels', 'Stickers plaatsen', 'Apply serial number and product labels', 'Plak serienummer en productstickers', false, NULL, false, false, false);

-- =====================================================
-- MLA Production Steps (7 steps)
-- =====================================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type, requires_barcode_scan, has_checklist) VALUES
('MLA', 1, 1, 'Scan Carrier + SOM Boards', 'Scan carrier + SOM boards', 'Scan carrier and SOM board batch numbers and mount', 'Scan carrier en SOM board batchnummers en monteer', true, 'carrier_som', false, false),
('MLA', 2, 2, 'Mount Heat Management', 'Monteer koeling', 'Install heatsink, fuse holder, and standoffs', 'Installeer koellichaam, zekeringhouder en afstandhouders', false, NULL, false, false),
('MLA', 3, 3, 'Scan I/O + Switch Boards', 'Scan I/O + switch boards', 'Scan I/O and switch board batch numbers, mount with cables', 'Scan I/O en switch board batchnummers, monteer met kabels', true, 'io_switch', false, false),
('MLA', 4, 4, 'Mount Push Button Cables', 'Monteer drukknoppen kabels', 'Connect push button cables', 'Sluit drukknop kabels aan', false, NULL, false, false),
('MLA', 5, 5, 'Mount MLA Cover', 'Monteer MLA deksel', 'Install the MLA cover', 'Installeer het MLA deksel', false, NULL, false, false),
('MLA', 6, 6, 'Apply Serial Number Label', 'Serienummer sticker plakken', 'Apply the serial number label', 'Plak de serienummer sticker', false, NULL, false, false),
('MLA', 7, 7, 'Electronics Test', 'Testen elektronica', 'Complete electronics test with checklist', 'Voltooi elektronicatest met checklist', false, NULL, false, true);

-- =====================================================
-- HMI Production Steps (6 steps)
-- =====================================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_batch_number, batch_type, requires_barcode_scan, has_checklist, requires_value_input, value_label_en, value_label_nl) VALUES
('HMI', 1, 1, 'Scan Display Batch', 'Scan display batch', 'Scan display batch number', 'Scan display batchnummer', true, 'display', false, false, false, NULL, NULL),
('HMI', 2, 2, 'Mount Display', 'Monteer display', 'Mount display in HMI cover', 'Monteer display in HMI cover', false, NULL, false, false, false, NULL, NULL),
('HMI', 3, 3, 'Mount Housing Components', 'Monteer behuizing componenten', 'Install gasket, buttons, lock, hinges, and other components', 'Installeer pakking, knoppen, slot, scharnieren en andere componenten', false, NULL, false, false, false, NULL, NULL),
('HMI', 4, 4, 'Mount MLA', 'Monteer MLA', 'Install the MLA unit', 'Installeer de MLA unit', false, NULL, false, false, false, NULL, NULL),
('HMI', 5, 5, 'Apply Serial Number Label', 'Serienummer sticker plakken', 'Apply the serial number label', 'Plak de serienummer sticker', false, NULL, false, false, false, NULL, NULL),
('HMI', 6, 6, 'Water Test', 'Watertest', 'Perform water resistance test with checklist', 'Voer waterdichtheidstest uit met checklist', false, NULL, false, true, true, 'Water Test Result', 'Watertest resultaat');

-- =====================================================
-- SDM_ECO Production Steps (7 steps) - With Sub-Assembly Linking
-- =====================================================
INSERT INTO production_steps (product_type, step_number, sort_order, title_en, title_nl, description_en, description_nl, requires_barcode_scan, batch_type, has_checklist, requires_value_input, measurement_fields) VALUES
('SDM_ECO', 1, 1, 'Link Sensor', 'Koppel Sensor', 'Scan or select completed Sensor serial number to link', 'Scan of selecteer voltooid Sensor serienummer om te koppelen', true, 'SENSOR', false, false, NULL),
('SDM_ECO', 2, 2, 'Link MLA', 'Koppel MLA', 'Scan or select completed MLA serial number to link', 'Scan of selecteer voltooid MLA serienummer om te koppelen', true, 'MLA', false, false, NULL),
('SDM_ECO', 3, 3, 'Link HMI', 'Koppel HMI', 'Scan or select completed HMI serial number to link', 'Scan of selecteer voltooid HMI serienummer om te koppelen', true, 'HMI', false, false, NULL),
('SDM_ECO', 4, 4, 'Link Transmitter', 'Koppel Transmitter', 'Scan or select completed Transmitter serial number to link', 'Scan of selecteer voltooid Transmitter serienummer om te koppelen', true, 'TRANSMITTER', false, false, NULL),
('SDM_ECO', 5, 5, 'Final Assembly', 'Eindmontage', 'Complete final assembly of SDM-ECO unit', 'Voltooi eindmontage van SDM-ECO unit', false, NULL, true, false, NULL),
('SDM_ECO', 6, 6, 'Calibration', 'Kalibratie', 'Perform calibration and log values', 'Voer kalibratie uit en log waarden', false, NULL, false, true, '{"fields": [{"name": "zero_offset", "label_en": "Zero Offset", "label_nl": "Nul Offset", "unit": "", "type": "number"}, {"name": "span_factor", "label_en": "Span Factor", "label_nl": "Span Factor", "unit": "", "type": "number"}, {"name": "temperature_coefficient", "label_en": "Temperature Coefficient", "label_nl": "Temperatuur Coëfficiënt", "unit": "", "type": "number"}]}'),
('SDM_ECO', 7, 7, 'Generate Quality Certificate', 'Genereer Kwaliteitscertificaat', 'Generate and save quality certificate PDF', 'Genereer en bewaar kwaliteitscertificaat PDF', false, NULL, false, false, NULL);

-- =====================================================
-- Checklist Items for TRANSMITTER Step 5
-- =====================================================
INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 1, 'Power LED illuminates correctly', 'Power LED brandt correct', true
FROM production_steps WHERE product_type = 'TRANSMITTER' AND step_number = 5;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 2, 'Communication test passed', 'Communicatietest geslaagd', true
FROM production_steps WHERE product_type = 'TRANSMITTER' AND step_number = 5;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 3, 'All connections secure', 'Alle verbindingen vast', true
FROM production_steps WHERE product_type = 'TRANSMITTER' AND step_number = 5;

-- =====================================================
-- Checklist Items for MLA Step 7
-- =====================================================
INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 1, 'Boot sequence completes successfully', 'Opstartsequentie voltooid', true
FROM production_steps WHERE product_type = 'MLA' AND step_number = 7;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 2, 'Display output verified', 'Displayuitvoer geverifieerd', true
FROM production_steps WHERE product_type = 'MLA' AND step_number = 7;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 3, 'All I/O ports functional', 'Alle I/O poorten functioneel', true
FROM production_steps WHERE product_type = 'MLA' AND step_number = 7;

-- =====================================================
-- Checklist Items for HMI Step 6 (Water Test)
-- =====================================================
INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 1, 'Gasket properly seated', 'Pakking correct geplaatst', true
FROM production_steps WHERE product_type = 'HMI' AND step_number = 6;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 2, 'No water ingress after test', 'Geen waterindringing na test', true
FROM production_steps WHERE product_type = 'HMI' AND step_number = 6;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 3, 'All buttons function after test', 'Alle knoppen werken na test', true
FROM production_steps WHERE product_type = 'HMI' AND step_number = 6;

-- =====================================================
-- Checklist Items for SDM_ECO Step 5 (Final Assembly)
-- =====================================================
INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 1, 'All sub-assemblies correctly linked', 'Alle subassemblages correct gekoppeld', true
FROM production_steps WHERE product_type = 'SDM_ECO' AND step_number = 5;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 2, 'Cable connections verified', 'Kabelverbindingen geverifieerd', true
FROM production_steps WHERE product_type = 'SDM_ECO' AND step_number = 5;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 3, 'Visual inspection passed', 'Visuele inspectie geslaagd', true
FROM production_steps WHERE product_type = 'SDM_ECO' AND step_number = 5;

INSERT INTO checklist_items (production_step_id, sort_order, item_text_en, item_text_nl, required)
SELECT id, 4, 'Final torque check completed', 'Eindcontrole aanhaalmoment voltooid', true
FROM production_steps WHERE product_type = 'SDM_ECO' AND step_number = 5;
