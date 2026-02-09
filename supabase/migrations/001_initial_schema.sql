-- ============================================================================
-- Jens Construction Platform — Initial Schema
-- ============================================================================
-- Run this in Supabase Dashboard > SQL Editor
-- ============================================================================

-- 1. tasks
CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','review','done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high','medium','low')),
  assignee TEXT DEFAULT 'Unassigned',
  due_date DATE,
  tags JSONB DEFAULT '[]'::jsonb,
  module TEXT DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. task_comments
CREATE TABLE IF NOT EXISTS task_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. documents
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'Drawing',
  status TEXT NOT NULL DEFAULT 'Draft' CHECK (status IN ('Draft','Review','Approved','Rejected')),
  author TEXT NOT NULL DEFAULT 'Unknown',
  version TEXT DEFAULT '1.0',
  file_size BIGINT DEFAULT 0,
  format TEXT DEFAULT '',
  download_url TEXT DEFAULT '#',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. rfis
CREATE TABLE IF NOT EXISTS rfis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE NOT NULL,
  subject TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Answered','Closed','Overdue')),
  priority TEXT NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low','Medium','High','Critical')),
  due_date DATE,
  assigned_to TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  responses JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. submittals
CREATE TABLE IF NOT EXISTS submittals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  number TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Submitted','Approved','Rejected','Resubmit')),
  spec_section TEXT DEFAULT '',
  due_date DATE,
  submitted_by TEXT DEFAULT '',
  reviewed_by TEXT,
  category TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. conversion_history
CREATE TABLE IF NOT EXISTS conversion_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  input_format TEXT NOT NULL,
  output_format TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  file_size TEXT DEFAULT '',
  duration TEXT DEFAULT '',
  output_files JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. qto_reports
CREATE TABLE IF NOT EXISTS qto_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  group_by TEXT DEFAULT 'type',
  categories JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  total_elements INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. validation_results
CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  overall_score INT DEFAULT 0,
  summary JSONB DEFAULT '{}'::jsonb,
  rule_results JSONB DEFAULT '[]'::jsonb,
  issues JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. cost_estimates
CREATE TABLE IF NOT EXISTS cost_estimates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  item_count INT DEFAULT 0,
  total_cost NUMERIC(15,2) DEFAULT 0,
  language TEXT DEFAULT 'EN',
  items JSONB DEFAULT '[]'::jsonb,
  summary JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. chat_sessions
CREATE TABLE IF NOT EXISTS chat_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT DEFAULT 'New Chat',
  file_name TEXT,
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee ON tasks(assignee);
CREATE INDEX IF NOT EXISTS idx_tasks_tags ON tasks USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_rfis_status ON rfis(status);
CREATE INDEX IF NOT EXISTS idx_rfis_number ON rfis(number);
CREATE INDEX IF NOT EXISTS idx_submittals_status ON submittals(status);
CREATE INDEX IF NOT EXISTS idx_submittals_number ON submittals(number);
CREATE INDEX IF NOT EXISTS idx_conversion_history_status ON conversion_history(status);
CREATE INDEX IF NOT EXISTS idx_qto_reports_file ON qto_reports(file_name);
CREATE INDEX IF NOT EXISTS idx_validation_results_file ON validation_results(file_name);
CREATE INDEX IF NOT EXISTS idx_cost_estimates_name ON cost_estimates(name);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_title ON chat_sessions(title);

-- ============================================================================
-- Auto-update triggers
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON tasks FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_documents_updated_at BEFORE UPDATE ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_rfis_updated_at BEFORE UPDATE ON rfis FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_submittals_updated_at BEFORE UPDATE ON submittals FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- RLS — Enable with open policies (no auth yet)
-- ============================================================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rfis ENABLE ROW LEVEL SECURITY;
ALTER TABLE submittals ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversion_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE qto_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE cost_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

-- Open policies (anon can read/write everything)
CREATE POLICY "anon_all_tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_task_comments" ON task_comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_documents" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_rfis" ON rfis FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_submittals" ON submittals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_conversion_history" ON conversion_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_qto_reports" ON qto_reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_validation_results" ON validation_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_cost_estimates" ON cost_estimates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_chat_sessions" ON chat_sessions FOR ALL USING (true) WITH CHECK (true);
