-- ============================================================================
-- Migration 007: CWICR Vector Search Engine
-- ============================================================================
-- Enables semantic search over construction items using
-- Gemini text-embedding-004 (768 dims) + pgvector cosine similarity.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS cwicr_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  language TEXT NOT NULL,          -- EN, DE, RU, ES, FR, PT, ZH, AR, HI
  rate_code TEXT NOT NULL,
  rate_name TEXT NOT NULL,
  rate_unit TEXT,
  category TEXT,
  subcategory TEXT,
  resources JSONB DEFAULT '[]',    -- [{resource_code, name, unit, type, quantity, price}]
  cost_summary JSONB DEFAULT '{}', -- {total_cost_position, labor, materials, machines}
  work_steps TEXT,
  hierarchy JSONB DEFAULT '{}',
  embedding vector(768),           -- Gemini text-embedding-004 = 768 dims
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Cosine similarity index for fast vector search
CREATE INDEX IF NOT EXISTS idx_cwicr_items_embedding
  ON cwicr_items USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Language filter index
CREATE INDEX IF NOT EXISTS idx_cwicr_items_language ON cwicr_items (language);

-- Rate code lookup
CREATE INDEX IF NOT EXISTS idx_cwicr_items_rate_code ON cwicr_items (rate_code);

-- Full-text search helper (optional, for hybrid search)
CREATE INDEX IF NOT EXISTS idx_cwicr_items_rate_name_gin
  ON cwicr_items USING gin (to_tsvector('simple', rate_name));

-- Stored estimates from the cost engine
CREATE TABLE IF NOT EXISTS cost_estimates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'web',   -- web, telegram, photo, pdf
  query_text TEXT,
  photo_url TEXT,
  language TEXT NOT NULL DEFAULT 'EN',
  items JSONB DEFAULT '[]',
  total_cost NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'EUR',
  region TEXT,
  confidence NUMERIC,
  labor_total NUMERIC DEFAULT 0,
  materials_total NUMERIC DEFAULT 0,
  machines_total NUMERIC DEFAULT 0,
  labor_hours NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cost_estimates_created ON cost_estimates (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_source ON cost_estimates (source);

-- RPC function for vector similarity search
CREATE OR REPLACE FUNCTION match_cwicr_items(
  query_embedding vector(768),
  match_language TEXT DEFAULT 'EN',
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.3
)
RETURNS TABLE (
  id UUID,
  language TEXT,
  rate_code TEXT,
  rate_name TEXT,
  rate_unit TEXT,
  category TEXT,
  subcategory TEXT,
  resources JSONB,
  cost_summary JSONB,
  work_steps TEXT,
  hierarchy JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ci.id,
    ci.language,
    ci.rate_code,
    ci.rate_name,
    ci.rate_unit,
    ci.category,
    ci.subcategory,
    ci.resources,
    ci.cost_summary,
    ci.work_steps,
    ci.hierarchy,
    1 - (ci.embedding <=> query_embedding) AS similarity
  FROM cwicr_items ci
  WHERE ci.language = match_language
    AND 1 - (ci.embedding <=> query_embedding) > match_threshold
  ORDER BY ci.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
