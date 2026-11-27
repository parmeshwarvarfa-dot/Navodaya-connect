ALTER TABLE memories
  ADD COLUMN IF NOT EXISTS poll_expires_at timestamp;
