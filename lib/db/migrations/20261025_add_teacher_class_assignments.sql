BEGIN;

CREATE TABLE IF NOT EXISTS teacher_class_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jnv_id text NOT NULL,
  jnv_name text NOT NULL,
  jnv_state text NOT NULL,
  teacher_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  teacher_name text NOT NULL,
  class_name text NOT NULL,
  subject text NOT NULL,
  assigned_by_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  revoked_by_id uuid REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS teacher_class_assignments_jnv_teacher_idx
  ON teacher_class_assignments (jnv_id, teacher_id, active);
CREATE INDEX IF NOT EXISTS teacher_class_assignments_jnv_class_idx
  ON teacher_class_assignments (jnv_id, class_name, active);
CREATE UNIQUE INDEX IF NOT EXISTS teacher_class_assignments_active_uidx
  ON teacher_class_assignments (jnv_id, teacher_id, class_name, subject)
  WHERE active = true;

COMMIT;
