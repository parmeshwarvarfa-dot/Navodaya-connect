CREATE TABLE IF NOT EXISTS game_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  game_id text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  state jsonb NOT NULL,
  score integer NOT NULL DEFAULT 0,
  correct_count integer NOT NULL DEFAULT 0,
  question_count integer NOT NULL DEFAULT 0,
  reward_points integer NOT NULL DEFAULT 0,
  result jsonb,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_sessions_reward_nonnegative CHECK (reward_points >= 0),
  CONSTRAINT game_sessions_score_nonnegative CHECK (score >= 0)
);

CREATE INDEX IF NOT EXISTS game_sessions_user_created_idx
  ON game_sessions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS game_sessions_game_points_idx
  ON game_sessions(game_id, reward_points);
