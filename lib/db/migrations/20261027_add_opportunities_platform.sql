CREATE TABLE IF NOT EXISTS opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organizer_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  type text NOT NULL,
  category text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  eligibility text NOT NULL DEFAULT '',
  eligible_roles jsonb NOT NULL DEFAULT '["student","alumni"]'::jsonb,
  eligible_classes jsonb NOT NULL DEFAULT '[]'::jsonb,
  format text NOT NULL DEFAULT 'online',
  participation_mode text NOT NULL DEFAULT 'individual',
  location text,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  registration_opens_at timestamptz,
  registration_deadline timestamptz,
  starts_at timestamptz,
  ends_at timestamptz,
  submission_deadline timestamptz,
  max_participants integer,
  rules text NOT NULL DEFAULT '',
  judging_criteria text NOT NULL DEFAULT '',
  submission_mode text NOT NULL DEFAULT 'none',
  submission_instructions text NOT NULL DEFAULT '',
  delivery_mode text NOT NULL DEFAULT 'internal',
  external_provider text,
  external_url text,
  fee_amount integer NOT NULL DEFAULT 0,
  fee_details text NOT NULL DEFAULT '',
  prize_details text NOT NULL DEFAULT '',
  certificate_type text NOT NULL DEFAULT 'none',
  certificate_details text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'draft',
  results_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunities_type_check CHECK (type IN ('quiz', 'academic_competition', 'coding_challenge', 'course', 'workshop', 'webinar', 'creative_competition', 'scholarship', 'internship', 'mentorship', 'community_challenge', 'other')),
  CONSTRAINT opportunities_format_check CHECK (format IN ('online', 'offline', 'hybrid')),
  CONSTRAINT opportunities_participation_mode_check CHECK (participation_mode = 'individual'),
  CONSTRAINT opportunities_submission_mode_check CHECK (submission_mode IN ('none', 'text', 'link')),
  CONSTRAINT opportunities_delivery_mode_check CHECK (delivery_mode IN ('internal', 'external')),
  CONSTRAINT opportunities_certificate_type_check CHECK (certificate_type IN ('none', 'external')),
  CONSTRAINT opportunities_status_check CHECK (status IN ('draft', 'published', 'cancelled', 'completed')),
  CONSTRAINT opportunities_max_participants_check CHECK (max_participants IS NULL OR max_participants > 0),
  CONSTRAINT opportunities_fee_amount_check CHECK (fee_amount >= 0)
);
CREATE INDEX IF NOT EXISTS opportunities_status_deadline_idx ON opportunities(status, registration_deadline);
CREATE INDEX IF NOT EXISTS opportunities_organizer_created_idx ON opportunities(organizer_id, created_at);

CREATE TABLE IF NOT EXISTS opportunity_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_registrations_status_check CHECK (status IN ('registered', 'cancelled')),
  CONSTRAINT opportunity_registrations_status_check CHECK (status IN ('registered', 'cancelled'))
);
CREATE UNIQUE INDEX IF NOT EXISTS opportunity_registrations_member_unique_idx ON opportunity_registrations(opportunity_id, participant_id);
CREATE INDEX IF NOT EXISTS opportunity_registrations_user_created_idx ON opportunity_registrations(participant_id, created_at);

CREATE TABLE IF NOT EXISTS opportunity_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  submission_url text,
  status text NOT NULL DEFAULT 'submitted',
  score integer,
  organizer_feedback text NOT NULL DEFAULT '',
  reviewed_by uuid REFERENCES users(id) ON DELETE SET NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT opportunity_submissions_score_check CHECK (score IS NULL OR score BETWEEN 0 AND 1000),
  CONSTRAINT opportunity_submissions_status_check CHECK (status IN ('submitted', 'reviewed', 'selected', 'not_selected'))
);
CREATE UNIQUE INDEX IF NOT EXISTS opportunity_submissions_member_unique_idx ON opportunity_submissions(opportunity_id, participant_id);
CREATE INDEX IF NOT EXISTS opportunity_submissions_opportunity_idx ON opportunity_submissions(opportunity_id, submitted_at);

CREATE TABLE IF NOT EXISTS opportunity_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS opportunity_audit_history_idx ON opportunity_audit(opportunity_id, created_at);
