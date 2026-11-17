-- Additive only: existing accounts, requests, credentials, and content remain intact.
BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS community_verified_at timestamp;

CREATE TABLE IF NOT EXISTS alumni_peer_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES verification_requests(id) ON DELETE CASCADE,
  applicant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  confirmer_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  jnv_id text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('confirmed', 'declined')),
  created_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT alumni_peer_decisions_not_self CHECK (applicant_id <> confirmer_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS alumni_peer_decisions_request_confirmer_uidx
  ON alumni_peer_decisions(request_id, confirmer_id);
CREATE UNIQUE INDEX IF NOT EXISTS alumni_peer_decisions_confirm_once_uidx
  ON alumni_peer_decisions(applicant_id, confirmer_id) WHERE decision = 'confirmed';
CREATE INDEX IF NOT EXISTS alumni_peer_decisions_applicant_idx
  ON alumni_peer_decisions(applicant_id, created_at);
CREATE INDEX IF NOT EXISTS alumni_peer_decisions_school_idx
  ON alumni_peer_decisions(jnv_id, created_at);

ALTER TABLE verification_audit
  ADD COLUMN IF NOT EXISTS report_id uuid REFERENCES reports(id) ON DELETE SET NULL;
COMMIT;
