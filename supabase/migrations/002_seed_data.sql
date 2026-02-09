-- ============================================================================
-- Jens Construction Platform — Seed Data
-- ============================================================================
-- Values match the MOCK_* arrays in page components so E2E tests pass.
-- ============================================================================

-- Tasks (match ProjectMgmtPage INITIAL_TASKS)
INSERT INTO tasks (title, description, assignee, priority, status, due_date, tags, module) VALUES
  ('Review structural model clash report', 'Analyze the latest clash detection results between structural and MEP models. Identify critical clashes and propose resolutions.', 'Alexei Petrov', 'high', 'todo', '2026-02-15', '["BIM","Structural","Coordination"]', 'viewer'),
  ('Update MEP routing Level 3', 'Reroute HVAC ducts on Level 3 to avoid structural beam conflicts identified in clash detection.', 'Maria Chen', 'high', 'in_progress', '2026-02-12', '["MEP","BIM"]', 'converter'),
  ('Export QTO for tender package', 'Generate quantity takeoff reports for all disciplines and format for tender submission.', 'David Kim', 'medium', 'in_progress', '2026-02-18', '["QTO","Documentation"]', 'qto'),
  ('Validate facade model naming', 'Run naming convention check on the facade elements. Ensure compliance with ISO 19650.', 'Sarah Johnson', 'medium', 'review', '2026-02-10', '["BIM","Architecture"]', 'validation'),
  ('Set up Telegram notifications', 'Configure the Telegram bot to send daily project status updates and deadline reminders to the team channel.', 'Oleg Novak', 'low', 'todo', '2026-02-20', '["Coordination"]', 'general'),
  ('Complete foundation IFC model', 'Finalize the foundation model with all pile caps, grade beams, and footing details.', 'Alexei Petrov', 'high', 'done', '2026-02-08', '["BIM","Structural"]', 'viewer'),
  ('Prepare cost estimation report', 'Generate cost estimation for Phase 2 using the latest QTO data and unit prices.', 'David Kim', 'medium', 'done', '2026-02-09', '["QTO","Documentation"]', 'cost'),
  ('Review architect RFI responses', 'Go through 5 pending RFI responses from the architect and update affected model elements.', 'Lena Vogt', 'medium', 'review', '2026-02-14', '["Architecture","Coordination"]', 'general'),
  ('Update fire safety classification', 'Apply correct fire rating classifications to all walls and doors per updated fire safety plan.', 'Sarah Johnson', 'high', 'todo', '2026-02-11', '["BIM","Architecture","Urgent"]', 'validation'),
  ('Coordinate site logistics model', 'Create 4D sequence for crane placement and material laydown areas.', 'Oleg Novak', 'low', 'in_progress', '2026-02-25', '["Coordination"]', 'general');

-- Documents (match DocumentsPage MOCK_DOCUMENTS)
INSERT INTO documents (name, type, status, author, version, file_size, format, download_url) VALUES
  ('Structural Drawings Rev C', 'Drawing', 'Approved', 'John Eng', '3.0', 45200000, 'dwg', '#'),
  ('MEP Coordination Report', 'Report', 'Review', 'Sarah MEP', '1.2', 12800000, 'pdf', '#'),
  ('Foundation Spec Sheet', 'Specification', 'Draft', 'Mike Arch', '0.3', 3400000, 'pdf', '#'),
  ('Safety Plan Q1 2026', 'Plan', 'Approved', 'Lisa Safety', '2.0', 8700000, 'pdf', '#'),
  ('Facade Material Submittal', 'Submittal', 'Rejected', 'Tom Ext', '1.0', 22100000, 'pdf', '#'),
  ('HVAC Layout Floor 3-5', 'Drawing', 'Review', 'Sarah MEP', '1.1', 38900000, 'dwg', '#');

-- RFIs (match DocumentsPage MOCK_RFIS)
INSERT INTO rfis (number, subject, description, status, priority, due_date, assigned_to, created_by, responses) VALUES
  ('RFI-001', 'Column grid alignment at Level 3', 'Drawing S-201 shows 1.5m foundation depth but geotechnical report recommends 2.0m at Grid C-7. Please clarify.', 'Open', 'High', '2026-02-10', 'John Eng', 'Mike Arch', '[]'),
  ('RFI-002', 'Waterproofing specification for basement', 'HVAC main duct on Level 3 conflicts with structural beam at Grid B-4. Need revised routing.', 'Answered', 'Medium', '2026-02-05', 'Sarah MEP', 'Tom Ext', '[]'),
  ('RFI-003', 'Fire rating requirement for stairwell doors', 'Specification section 07 42 13 references two different cladding systems. Please confirm which system applies to the east elevation.', 'Open', 'Critical', '2026-02-08', 'Lisa Safety', 'Mike Arch', '[]'),
  ('RFI-004', 'Electrical conduit routing through beam', '', 'Overdue', 'High', '2026-01-30', 'John Eng', 'Sarah MEP', '[]'),
  ('RFI-005', 'Concrete mix design for exposed aggregate', '', 'Closed', 'Low', '2026-02-15', 'Tom Ext', 'John Eng', '[]');

-- Submittals (match DocumentsPage MOCK_SUBMITTALS)
INSERT INTO submittals (number, title, description, status, spec_section, due_date, submitted_by, category) VALUES
  ('SUB-001', 'Reinforcing Steel Shop Drawings', 'Concrete mix design for all structural elements per specification section 03 30 00.', 'Approved', '03 21 00', '2026-01-20', 'SteelWorks Inc.', 'shop-drawings'),
  ('SUB-002', 'Curtain Wall System Samples', 'Shop drawings for structural steel framing at Levels 1-3, including connection details.', 'Submitted', '08 44 13', '2026-02-15', 'GlassFab Ltd.', 'materials'),
  ('SUB-003', 'HVAC Equipment Cut Sheets', 'Product data sheets for addressable fire alarm control panel and devices.', 'Pending', '23 05 00', '2026-02-20', 'AirFlow Corp.', 'product-data'),
  ('SUB-004', 'Elevator Cab Finishes', '', 'Resubmit', '14 21 00', '2026-02-10', 'Vertical Transit Co.', 'materials'),
  ('SUB-005', 'Waterproofing Membrane Data', '', 'Rejected', '07 10 00', '2026-02-08', 'SealTight LLC', 'product-data');

-- Conversion History (match ConverterPage MOCK_HISTORY)
INSERT INTO conversion_history (file_name, input_format, output_format, status, file_size, duration) VALUES
  ('Hospital_Phase2.rvt', 'RVT', 'excel', 'completed', '45.2 MB', '2m 14s'),
  ('Bridge_Design.ifc', 'IFC', 'dae', 'completed', '28.7 MB', '1m 42s'),
  ('Office_MEP.dwg', 'DWG', 'pdf', 'completed', '12.1 MB', '0m 38s'),
  ('Parking_Structure.dgn', 'DGN', 'excel', 'failed', '67.3 MB', '—'),
  ('Residential_Block_A.rvt', 'RVT', 'dae', 'completed', '89.4 MB', '3m 05s'),
  ('HVAC_Layout.ifc', 'IFC', 'excel', 'completed', '19.6 MB', '1m 18s');

-- Cost Estimates (match CostEstimatePage MOCK_RECENT_ESTIMATES)
INSERT INTO cost_estimates (name, item_count, total_cost, language) VALUES
  ('Hospital Phase 2 - Structure', 142, 2847500, 'EN'),
  ('Office Tower MEP', 89, 1254800, 'DE'),
  ('Residential Block A', 234, 4125000, 'EN'),
  ('Parking Structure', 67, 987600, 'RU'),
  ('School Extension', 178, 3256400, 'ES');

-- QTO Reports (match QTOReportsPage MOCK_HISTORY)
INSERT INTO qto_reports (file_name, group_by, total_elements, summary) VALUES
  ('Building_Model_Rev3.ifc', 'type', 492, '{"totalElements":492,"totalCategories":6,"totalFloors":4,"estimatedCost":2210700,"currency":"USD"}'),
  ('Residential_Block_A.ifc', 'floor', 318, '{"totalElements":318,"totalCategories":4,"totalFloors":3,"estimatedCost":1450000,"currency":"USD"}'),
  ('Office_Tower_Phase1.xlsx', 'phase', 756, '{"totalElements":756,"totalCategories":8,"totalFloors":6,"estimatedCost":5320000,"currency":"USD"}'),
  ('Warehouse_Extension.ifc', 'detailed', 189, '{"totalElements":189,"totalCategories":3,"totalFloors":2,"estimatedCost":780000,"currency":"USD"}');
