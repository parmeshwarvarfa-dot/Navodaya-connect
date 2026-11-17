-- Store administration uses a separate session table. Revoking admin access
-- must not sign the staff member out of their regular Navodaya Connect account.
CREATE TABLE IF NOT EXISTS store_admin_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE CHECK (token ~ '^[a-f0-9]{64}$'),
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS store_admin_sessions_user_idx ON store_admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS store_admin_sessions_expires_idx ON store_admin_sessions(expires_at);

-- Revoke tokens created by the earlier dashboard implementation, which were
-- mistakenly written to the normal application session table.
DELETE FROM sessions
WHERE token ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
  AND user_id IN (SELECT user_id FROM store_admin_staff);
