-- ============================================================================
-- 006: n8n Integration Tables
-- ============================================================================
-- Shared data layer between Jens Platform and n8n workflows.
-- n8n writes results via callback endpoints; platform reads from same tables.
-- ============================================================================

-- 1. Universal workflow results store
CREATE TABLE IF NOT EXISTS n8n_results (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  execution_id  TEXT,
  workflow_id   TEXT,
  workflow_name TEXT,
  module        TEXT NOT NULL DEFAULT 'general',
  status        TEXT NOT NULL DEFAULT 'completed',
  input_data    JSONB DEFAULT '{}'::jsonb,
  output_data   JSONB DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at    TIMESTAMPTZ,
  finished_at   TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_n8n_results_module ON n8n_results (module);
CREATE INDEX IF NOT EXISTS idx_n8n_results_status ON n8n_results (status);
CREATE INDEX IF NOT EXISTS idx_n8n_results_execution ON n8n_results (execution_id);

-- 2. Cost estimates from Telegram bots / n8n pipelines
CREATE TABLE IF NOT EXISTS n8n_cost_estimates (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source      TEXT NOT NULL DEFAULT 'telegram',
  query_text  TEXT,
  photo_url   TEXT,
  language    TEXT DEFAULT 'EN',
  items       JSONB DEFAULT '[]'::jsonb,
  total_cost  NUMERIC(14,2) DEFAULT 0,
  currency    TEXT DEFAULT 'EUR',
  region      TEXT,
  confidence  NUMERIC(5,2),
  raw_response JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_n8n_cost_estimates_source ON n8n_cost_estimates (source);
CREATE INDEX IF NOT EXISTS idx_n8n_cost_estimates_created ON n8n_cost_estimates (created_at DESC);

-- 3. Field reports (photo reports from site workers)
CREATE TABLE IF NOT EXISTS field_reports (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     UUID REFERENCES tasks(id) ON DELETE SET NULL,
  reporter    TEXT NOT NULL DEFAULT 'Unknown',
  description TEXT,
  photo_urls  JSONB DEFAULT '[]'::jsonb,
  gps_lat     NUMERIC(10,7),
  gps_lon     NUMERIC(10,7),
  address     TEXT,
  report_type TEXT DEFAULT 'progress',
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_field_reports_task ON field_reports (task_id);
CREATE INDEX IF NOT EXISTS idx_field_reports_created ON field_reports (created_at DESC);

-- 4. Worker GPS locations (latest position per worker)
CREATE TABLE IF NOT EXISTS worker_locations (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  worker_name TEXT NOT NULL,
  lat         NUMERIC(10,7) NOT NULL,
  lon         NUMERIC(10,7) NOT NULL,
  accuracy    NUMERIC(8,2),
  recorded_at TIMESTAMPTZ DEFAULT now(),
  metadata    JSONB DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_worker_locations_worker ON worker_locations (worker_name);
CREATE INDEX IF NOT EXISTS idx_worker_locations_recorded ON worker_locations (recorded_at DESC);

-- Enable Realtime for n8n_results (Phase 5 notifications)
ALTER PUBLICATION supabase_realtime ADD TABLE n8n_results;
