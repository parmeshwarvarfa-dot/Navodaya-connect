CREATE TABLE IF NOT EXISTS email_otp_challenges (
  email text PRIMARY KEY,
  challenge_id text NOT NULL,
  code_hash text NOT NULL,
  expires_at timestamp NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  send_count integer NOT NULL DEFAULT 1,
  window_started_at timestamp NOT NULL,
  last_sent_at timestamp NOT NULL,
  verification_token_hash text,
  verification_token_expires_at timestamp,
  consumed_at timestamp
);
