CREATE TABLE IF NOT EXISTS navodayan_talks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memory_id uuid NOT NULL UNIQUE REFERENCES memories(id) ON DELETE CASCADE,
  author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  submission_key uuid NOT NULL,
  title text NOT NULL,
  story_type text NOT NULL,
  category text NOT NULL,
  topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  career text,
  batch text,
  status text NOT NULL DEFAULT 'submitted',
  consent_confirmed boolean NOT NULL DEFAULT false,
  rights_confirmed boolean NOT NULL DEFAULT false,
  moderator_id uuid REFERENCES users(id) ON DELETE SET NULL,
  moderation_feedback text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  published_at timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS navodayan_talks_author_submission_uidx
  ON navodayan_talks (author_id, submission_key);
CREATE INDEX IF NOT EXISTS navodayan_talks_status_created_idx
  ON navodayan_talks (status, created_at);
CREATE INDEX IF NOT EXISTS navodayan_talks_category_idx
  ON navodayan_talks (category);

CREATE TABLE IF NOT EXISTS talk_moderation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  talk_id uuid NOT NULL REFERENCES navodayan_talks(id) ON DELETE CASCADE,
  moderator_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action text NOT NULL,
  reason text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS talk_moderation_audit_talk_created_idx
  ON talk_moderation_audit (talk_id, created_at);
