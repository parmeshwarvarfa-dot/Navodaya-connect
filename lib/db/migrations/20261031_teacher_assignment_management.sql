BEGIN;

ALTER TABLE teacher_class_assignments
  ADD COLUMN IF NOT EXISTS section text NOT NULL DEFAULT 'Unspecified',
  ADD COLUMN IF NOT EXISTS assignment_type text NOT NULL DEFAULT 'subject_teacher',
  ADD COLUMN IF NOT EXISTS academic_year text,
  ADD COLUMN IF NOT EXISTS periods_per_week integer,
  ADD COLUMN IF NOT EXISTS modified_by_id uuid REFERENCES users(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE teacher_class_assignments
SET section = COALESCE((regexp_match(class_name, '\s([AB])$', 'i'))[1], 'Unspecified'),
    class_name = regexp_replace(class_name, '^(Class[[:space:]]*[0-9]+).*$', '\1', 'i'),
    academic_year = CASE
      WHEN EXTRACT(MONTH FROM COALESCE(created_at::date, CURRENT_DATE)) >= 4
        THEN EXTRACT(YEAR FROM COALESCE(created_at::date, CURRENT_DATE))::integer::text || '-' || (EXTRACT(YEAR FROM COALESCE(created_at::date, CURRENT_DATE))::integer + 1)::text
      ELSE (EXTRACT(YEAR FROM COALESCE(created_at::date, CURRENT_DATE))::integer - 1)::text || '-' || EXTRACT(YEAR FROM COALESCE(created_at::date, CURRENT_DATE))::integer::text
    END,
    updated_at = COALESCE(updated_at, created_at, now())
WHERE academic_year IS NULL;

ALTER TABLE teacher_class_assignments ALTER COLUMN academic_year SET NOT NULL;
ALTER TABLE teacher_class_assignments ALTER COLUMN academic_year SET DEFAULT (
  CASE
    WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 4
      THEN EXTRACT(YEAR FROM CURRENT_DATE)::integer::text || '-' || (EXTRACT(YEAR FROM CURRENT_DATE)::integer + 1)::text
    ELSE (EXTRACT(YEAR FROM CURRENT_DATE)::integer - 1)::text || '-' || EXTRACT(YEAR FROM CURRENT_DATE)::integer::text
  END
);

DROP INDEX IF EXISTS teacher_class_assignments_active_uidx;
DROP INDEX IF EXISTS teacher_class_assignments_jnv_class_idx;
CREATE INDEX teacher_class_assignments_jnv_class_idx
  ON teacher_class_assignments (jnv_id, academic_year, class_name, section, active);

CREATE TABLE IF NOT EXISTS jnv_academic_settings (
  jnv_id text PRIMARY KEY,
  jnv_name text NOT NULL,
  jnv_state text NOT NULL,
  allow_multiple_subject_teachers boolean NOT NULL DEFAULT false,
  updated_by_id uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS teacher_assignment_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid REFERENCES teacher_class_assignments(id) ON DELETE SET NULL,
  jnv_id text NOT NULL,
  jnv_name text NOT NULL,
  jnv_state text NOT NULL,
  actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
  actor_name text NOT NULL,
  action text NOT NULL CHECK (action IN ('created', 'updated', 'removed')),
  academic_year text NOT NULL,
  previous_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_assignment_audit_school_year_idx
  ON teacher_assignment_audit (jnv_id, academic_year, created_at DESC);
CREATE INDEX IF NOT EXISTS teacher_assignment_audit_assignment_idx
  ON teacher_assignment_audit (assignment_id, created_at DESC);

INSERT INTO teacher_assignment_audit (
  assignment_id, jnv_id, jnv_name, jnv_state, actor_id, actor_name,
  action, academic_year, new_data, created_at
)
SELECT a.id, a.jnv_id, a.jnv_name, a.jnv_state, a.assigned_by_id, u.full_name,
       'created', a.academic_year,
       jsonb_build_object(
         'assignmentType', a.assignment_type,
         'teacherId', a.teacher_id,
         'teacherName', a.teacher_name,
         'className', a.class_name,
         'section', a.section,
         'subject', a.subject,
         'periodsPerWeek', a.periods_per_week,
         'academicYear', a.academic_year,
         'active', a.active
       ), a.created_at
FROM teacher_class_assignments a
JOIN users u ON u.id = a.assigned_by_id
WHERE NOT EXISTS (
  SELECT 1 FROM teacher_assignment_audit audit
  WHERE audit.assignment_id = a.id AND audit.action = 'created'
);

INSERT INTO teacher_assignment_audit (
  assignment_id, jnv_id, jnv_name, jnv_state, actor_id, actor_name,
  action, academic_year, previous_data, new_data
)
WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY jnv_id, academic_year, class_name, section, subject, teacher_id
    ORDER BY created_at, id
  ) AS row_number
  FROM teacher_class_assignments
  WHERE active = true AND assignment_type = 'subject_teacher'
)
SELECT a.id, a.jnv_id, a.jnv_name, a.jnv_state, NULL, 'System migration',
       'removed', a.academic_year, created.new_data,
       created.new_data || jsonb_build_object('active', false)
FROM ranked r
JOIN teacher_class_assignments a ON a.id = r.id
JOIN teacher_assignment_audit created ON created.assignment_id = a.id AND created.action = 'created'
WHERE r.row_number > 1
  AND NOT EXISTS (SELECT 1 FROM teacher_assignment_audit removed WHERE removed.assignment_id = a.id AND removed.action = 'removed');

WITH ranked AS (
  SELECT id, row_number() OVER (
    PARTITION BY jnv_id, academic_year, class_name, section, subject, teacher_id
    ORDER BY created_at, id
  ) AS row_number
  FROM teacher_class_assignments
  WHERE active = true AND assignment_type = 'subject_teacher'
)
UPDATE teacher_class_assignments a
SET active = false, revoked_at = now(), updated_at = now()
FROM ranked r
WHERE a.id = r.id AND r.row_number > 1 AND a.active = true;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_class_assignments_type_check' AND conrelid = 'teacher_class_assignments'::regclass) THEN
    ALTER TABLE teacher_class_assignments ADD CONSTRAINT teacher_class_assignments_type_check CHECK (assignment_type IN ('class_teacher', 'subject_teacher'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_class_assignments_periods_check' AND conrelid = 'teacher_class_assignments'::regclass) THEN
    ALTER TABLE teacher_class_assignments ADD CONSTRAINT teacher_class_assignments_periods_check CHECK (periods_per_week IS NULL OR periods_per_week BETWEEN 1 AND 60);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'teacher_class_assignments_academic_year_check' AND conrelid = 'teacher_class_assignments'::regclass) THEN
    ALTER TABLE teacher_class_assignments ADD CONSTRAINT teacher_class_assignments_academic_year_check CHECK (academic_year ~ '^20[0-9]{2}-20[0-9]{2}$');
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS teacher_class_assignments_primary_class_teacher_uidx
  ON teacher_class_assignments (jnv_id, academic_year, class_name, section)
  WHERE active = true AND assignment_type = 'class_teacher';
CREATE UNIQUE INDEX IF NOT EXISTS teacher_class_assignments_subject_teacher_uidx
  ON teacher_class_assignments (jnv_id, academic_year, class_name, section, subject, teacher_id)
  WHERE active = true AND assignment_type = 'subject_teacher';

COMMIT;
