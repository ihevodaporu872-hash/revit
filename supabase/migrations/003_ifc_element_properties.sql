-- ============================================================================
-- Migration 003: IFC Element Properties (Revit Parameter Enrichment)
-- ============================================================================
-- Stores Revit parameters imported via XLSX, linked to IFC elements by GlobalId.
-- Execute this SQL in the Supabase Dashboard SQL Editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS ifc_element_properties (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id    text NOT NULL DEFAULT 'default',
  global_id     text NOT NULL,

  -- Identity
  element_name  text,
  element_type  text,
  category      text,
  family        text,
  family_type   text,

  -- Location / Phasing
  level             text,
  phase_created     text,
  phase_demolished  text,

  -- Dimensions
  area        double precision,
  volume      double precision,
  length      double precision,
  width       double precision,
  height      double precision,
  perimeter   double precision,

  -- Materials
  material        text,
  material_area   double precision,
  material_volume double precision,

  -- Classification
  structural_usage text,
  classification   text,
  assembly_code    text,
  mark             text,
  comments         text,

  -- Custom / Shared Parameters (JSONB for flexibility)
  custom_params jsonb DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Unique constraint for upsert
  CONSTRAINT uq_project_global_id UNIQUE (project_id, global_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ifc_props_global_id   ON ifc_element_properties (global_id);
CREATE INDEX IF NOT EXISTS idx_ifc_props_project_id  ON ifc_element_properties (project_id);
CREATE INDEX IF NOT EXISTS idx_ifc_props_category    ON ifc_element_properties (category);
CREATE INDEX IF NOT EXISTS idx_ifc_props_level       ON ifc_element_properties (level);
CREATE INDEX IF NOT EXISTS idx_ifc_props_custom      ON ifc_element_properties USING GIN (custom_params);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_ifc_props_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_ifc_props_updated_at ON ifc_element_properties;
CREATE TRIGGER trg_ifc_props_updated_at
  BEFORE UPDATE ON ifc_element_properties
  FOR EACH ROW EXECUTE FUNCTION update_ifc_props_updated_at();

-- Enable RLS (public read, authenticated write)
ALTER TABLE ifc_element_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON ifc_element_properties
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON ifc_element_properties
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON ifc_element_properties
  FOR UPDATE USING (true);
