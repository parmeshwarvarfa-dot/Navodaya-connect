CREATE TABLE IF NOT EXISTS recognition_rules (
  activity text PRIMARY KEY,
  points integer NOT NULL CHECK (points BETWEEN -1000 AND 1000),
  daily_limit integer NOT NULL CHECK (daily_limit BETWEEN 1 AND 10000),
  enabled text NOT NULL DEFAULT 'true' CHECK (enabled IN ('true', 'false')),
  updated_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recognition_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  activity text NOT NULL,
  reference_id text NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  period_month text NOT NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT recognition_points_activity_ref_user_uidx UNIQUE (activity, reference_id, user_id)
);
CREATE INDEX IF NOT EXISTS recognition_points_user_created_idx ON recognition_points(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS recognition_points_period_activity_idx ON recognition_points(period_month, activity);

CREATE TABLE IF NOT EXISTS recognition_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  period text NOT NULL,
  winner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  score integer NOT NULL,
  summary text NOT NULL,
  status text NOT NULL DEFAULT 'review' CHECK (status IN ('review', 'finalized', 'revoked')),
  finalized_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  finalized_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT recognition_awards_category_period_uidx UNIQUE (category, period)
);
CREATE INDEX IF NOT EXISTS recognition_awards_status_period_idx ON recognition_awards(status, period);
ALTER TABLE recognition_awards DROP CONSTRAINT IF EXISTS recognition_awards_category_period_uidx;
DROP INDEX IF EXISTS recognition_awards_category_period_uidx;
CREATE UNIQUE INDEX IF NOT EXISTS recognition_awards_category_period_uidx
  ON recognition_awards(category, period) WHERE status <> 'revoked';

DELETE FROM memory_likes a USING memory_likes b
WHERE a.memory_id = b.memory_id AND a.user_id = b.user_id AND a.id > b.id;
CREATE UNIQUE INDEX IF NOT EXISTS memory_likes_memory_user_uidx ON memory_likes(memory_id, user_id);

CREATE TABLE IF NOT EXISTS recognition_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  target_id text NOT NULL,
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);

INSERT INTO recognition_rules (activity, points, daily_limit) VALUES
  ('profile_complete', 10, 1), ('memory_post', 5, 3), ('memory_like_received', 1, 20),
  ('memory_comment_received', 2, 10), ('help_verified', 10, 3), ('job_verified', 10, 3),
  ('mentorship_verified', 15, 3), ('event_success_verified', 20, 3),
  ('scholarship_verified', 10, 3), ('initiative_verified', 15, 3)
ON CONFLICT (activity) DO NOTHING;
