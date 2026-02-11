-- ============================================================================
-- Telegram Bot: Chat & Message Storage Tables
-- ============================================================================

-- Chat metadata
CREATE TABLE IF NOT EXISTS telegram_chats (
  id BIGINT PRIMARY KEY,
  chat_type TEXT NOT NULL DEFAULT 'private',
  title TEXT,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- All messages (text, photos, documents, voice, video, etc.)
CREATE TABLE IF NOT EXISTS telegram_messages (
  id BIGSERIAL PRIMARY KEY,
  telegram_message_id INTEGER NOT NULL,
  chat_id BIGINT NOT NULL REFERENCES telegram_chats(id),
  from_user_id BIGINT,
  from_username TEXT,
  from_first_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text',
  text_content TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  mime_type TEXT,
  telegram_file_id TEXT,
  reply_to_message_id INTEGER,
  forward_from TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  telegram_date TIMESTAMPTZ NOT NULL,
  UNIQUE(chat_id, telegram_message_id)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_tg_msgs_chat_date ON telegram_messages(chat_id, telegram_date DESC);
CREATE INDEX IF NOT EXISTS idx_tg_msgs_type ON telegram_messages(message_type);

-- Disable RLS (bot is the only writer, uses anon key)
ALTER TABLE telegram_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE telegram_messages ENABLE ROW LEVEL SECURITY;

-- Allow full access for anon role (matches existing project pattern)
CREATE POLICY "telegram_chats_all" ON telegram_chats FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "telegram_messages_all" ON telegram_messages FOR ALL USING (true) WITH CHECK (true);
