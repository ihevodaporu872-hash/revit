-- ============================================================================
-- Migration 004: Add Revit ElementId columns for dual-key matching
-- ============================================================================
-- Adds revit_element_id, revit_unique_id, and type_ifc_guid columns
-- to support matching IFC elements via Tag (ElementId) in addition to GlobalId.
-- Execute this SQL in the Supabase Dashboard SQL Editor.
-- ============================================================================

ALTER TABLE ifc_element_properties ADD COLUMN IF NOT EXISTS revit_element_id integer;
ALTER TABLE ifc_element_properties ADD COLUMN IF NOT EXISTS revit_unique_id text;
ALTER TABLE ifc_element_properties ADD COLUMN IF NOT EXISTS type_ifc_guid text;

CREATE INDEX IF NOT EXISTS idx_ifc_props_element_id ON ifc_element_properties (revit_element_id);
CREATE INDEX IF NOT EXISTS idx_ifc_props_unique_id ON ifc_element_properties (revit_unique_id);
