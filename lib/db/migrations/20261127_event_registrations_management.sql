ALTER TABLE events
  ADD COLUMN IF NOT EXISTS max_capacity integer,
  ADD COLUMN IF NOT EXISTS registration_deadline timestamp,
  ADD COLUMN IF NOT EXISTS authorized_organizers jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

ALTER TABLE event_registrations
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'confirmed',
  ADD COLUMN IF NOT EXISTS attendance_status text NOT NULL DEFAULT 'not_checked_in',
  ADD COLUMN IF NOT EXISTS checked_in_at timestamp,
  ADD COLUMN IF NOT EXISTS checked_in_by uuid,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
  ADD COLUMN IF NOT EXISTS attending_in_person boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS custom_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at timestamp DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS event_registrations_event_user_uidx
  ON event_registrations (event_id, user_id);

CREATE INDEX IF NOT EXISTS event_registrations_event_status_created_idx
  ON event_registrations (event_id, status, created_at);

CREATE INDEX IF NOT EXISTS event_registrations_event_attendance_idx
  ON event_registrations (event_id, attendance_status);
