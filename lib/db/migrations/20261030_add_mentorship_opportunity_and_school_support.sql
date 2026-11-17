CREATE TABLE IF NOT EXISTS mentor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  available boolean NOT NULL DEFAULT false,
  categories jsonb NOT NULL DEFAULT '[]'::jsonb,
  bio text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS mentor_profiles_available_idx ON mentor_profiles(available);

ALTER TABLE mentor_requests ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;
ALTER TABLE mentor_requests ADD COLUMN IF NOT EXISTS completed_at timestamptz;
ALTER TABLE mentor_requests ADD COLUMN IF NOT EXISTS feedback_rating integer;
ALTER TABLE mentor_requests ADD COLUMN IF NOT EXISTS feedback text;
CREATE INDEX IF NOT EXISTS mentor_requests_mentor_status_idx ON mentor_requests(mentor_id, status);

CREATE TABLE IF NOT EXISTS opportunity_bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_bookmarks_member_unique UNIQUE(opportunity_id, user_id)
);
CREATE INDEX IF NOT EXISTS opportunity_bookmarks_user_idx ON opportunity_bookmarks(user_id, created_at);

CREATE TABLE IF NOT EXISTS school_support_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alumni_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jnv_id text NOT NULL,
  type text NOT NULL,
  note text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'submitted',
  outcome text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT school_support_requests_status_check CHECK(status IN ('submitted', 'reviewing', 'in_progress', 'fulfilled', 'declined'))
);
CREATE INDEX IF NOT EXISTS school_support_requests_jnv_status_idx ON school_support_requests(jnv_id, status, created_at);
CREATE INDEX IF NOT EXISTS school_support_requests_alumni_idx ON school_support_requests(alumni_id, created_at);
