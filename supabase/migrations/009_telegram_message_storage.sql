-- ============================================================================
-- Migration 009: Telegram Message Storage
-- ============================================================================
-- Stores ALL messages from Telegram chats for AI search via /tovbin command.
-- ============================================================================

-- Chat metadata
CREATE TABLE IF NOT EXISTS telegram_chats (
  id BIGINT PRIMARY KEY,                    -- Telegram chat_id
  chat_type TEXT,                           -- private, group, supergroup, channel
  title TEXT,
  username TEXT,
  first_name TEXT,
  last_name TEXT,
  message_count INT DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- All messages
CREATE TABLE IF NOT EXISTS telegram_messages (
  id BIGSERIAL PRIMARY KEY,
  telegram_message_id INT NOT NULL,
  chat_id BIGINT NOT NULL REFERENCES telegram_chats(id) ON DELETE CASCADE,
  from_user_id BIGINT,
  from_username TEXT,
  from_first_name TEXT,
  message_type TEXT NOT NULL DEFAULT 'text', -- text, photo, document, voice, video, etc.
  text_content TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INT,
  mime_type TEXT,
  telegram_file_id TEXT,
  reply_to_message_id INT,
  forward_from TEXT,
  telegram_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(chat_id, telegram_message_id)
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_tg_messages_chat_date
  ON telegram_messages (chat_id, telegram_date DESC);

CREATE INDEX IF NOT EXISTS idx_tg_messages_text_gin
  ON telegram_messages USING GIN (to_tsvector('simple', coalesce(text_content, '')));

CREATE INDEX IF NOT EXISTS idx_tg_messages_type
  ON telegram_messages (message_type);
