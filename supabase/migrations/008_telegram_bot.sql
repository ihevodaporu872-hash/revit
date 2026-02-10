-- ============================================================================
-- Migration 008: Telegram Bot + Task Extensions
-- ============================================================================
-- Extends tasks and field_reports for Telegram bot integration.
-- Creates telegram_users table.
-- ============================================================================

-- Telegram users registry
CREATE TABLE IF NOT EXISTS telegram_users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id TEXT UNIQUE NOT NULL,
  telegram_name TEXT,
  full_name TEXT,
  company TEXT,
  role TEXT DEFAULT 'executor',
  language TEXT DEFAULT 'EN',
  registered_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_telegram_users_tid ON telegram_users (telegram_id);

-- Extend tasks table with reminder/report fields
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_time TIME;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent BOOLEAN DEFAULT false;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_sent_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_count INT DEFAULT 0;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS reminder_interval INTERVAL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS report_date TIMESTAMPTZ;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS report_status TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS report_comment TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS executor_telegram_id TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS object TEXT;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS section TEXT;

-- Extend field_reports with Telegram metadata
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS telegram_file_id TEXT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS file_size_bytes INT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS media_group_id TEXT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS processing_status TEXT;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS reminder_read BOOLEAN DEFAULT false;
ALTER TABLE field_reports ADD COLUMN IF NOT EXISTS read_time TIMESTAMPTZ;
