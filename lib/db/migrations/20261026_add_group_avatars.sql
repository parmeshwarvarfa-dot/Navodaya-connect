BEGIN;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_key text;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS avatar_content_type text;

COMMIT;
