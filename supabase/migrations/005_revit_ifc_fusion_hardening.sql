-- ============================================================================
-- Migration 005: Revit/IFC/XLSX Fusion Hardening
-- ============================================================================
-- Adds model scoping, run metadata, match reports, and override tables to
-- support robust multi-version matching and quality diagnostics.
-- ============================================================================

-- Extend core enrichment table with model scope metadata.
ALTER TABLE ifc_element_properties
  ADD COLUMN IF NOT EXISTS model_version text,
  ADD COLUMN IF NOT EXISTS source_file text;

UPDATE ifc_element_properties
SET model_version = 'v0'
WHERE model_version IS NULL;

ALTER TABLE ifc_element_properties
  ALTER COLUMN model_version SET DEFAULT 'v0';

ALTER TABLE ifc_element_properties
  ALTER COLUMN model_version SET NOT NULL;

-- Replace old uniqueness (project_id, global_id) with model-aware uniqueness.
ALTER TABLE ifc_element_properties
  DROP CONSTRAINT IF EXISTS uq_project_global_id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ifc_props_project_model_global
  ON ifc_element_properties (project_id, model_version, global_id);

CREATE INDEX IF NOT EXISTS idx_ifc_props_project_model
  ON ifc_element_properties (project_id, model_version);

CREATE INDEX IF NOT EXISTS idx_ifc_props_model_global
  ON ifc_element_properties (model_version, global_id);

CREATE INDEX IF NOT EXISTS idx_ifc_props_model_element_id
  ON ifc_element_properties (model_version, revit_element_id);

CREATE INDEX IF NOT EXISTS idx_ifc_props_model_type_guid
  ON ifc_element_properties (model_version, type_ifc_guid);

-- Stores ingestion runs and source provenance.
CREATE TABLE IF NOT EXISTS model_runs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  model_version text NOT NULL,
  source_mode text NOT NULL,
  source_files jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_model_runs_project_model
  ON model_runs (project_id, model_version, created_at DESC);

-- Stores match summary snapshots.
CREATE TABLE IF NOT EXISTS match_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  model_version text NOT NULL,
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_reports_project_model
  ON match_reports (project_id, model_version, created_at DESC);

-- Stores manual mapping fixes for future quality stabilization.
CREATE TABLE IF NOT EXISTS match_overrides (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id text NOT NULL,
  model_version text NOT NULL,
  ifc_global_id text,
  ifc_express_id integer,
  revit_global_id text,
  revit_element_id integer,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, model_version, ifc_express_id)
);

CREATE INDEX IF NOT EXISTS idx_match_overrides_project_model
  ON match_overrides (project_id, model_version);

CREATE INDEX IF NOT EXISTS idx_match_overrides_ifc_global
  ON match_overrides (ifc_global_id);

CREATE INDEX IF NOT EXISTS idx_match_overrides_revit_global
  ON match_overrides (revit_global_id);
