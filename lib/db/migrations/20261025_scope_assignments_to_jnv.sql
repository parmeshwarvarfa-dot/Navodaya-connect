BEGIN;

ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jnv_id text;
ALTER TABLE assignments ADD COLUMN IF NOT EXISTS jnv_state text;

UPDATE assignments AS assignment
SET jnv_id = teacher.jnv_id,
    jnv_state = teacher.jnv_state
FROM users AS teacher
WHERE assignment.author_id = teacher.id
  AND (assignment.jnv_id IS NULL OR assignment.jnv_state IS NULL);

CREATE INDEX IF NOT EXISTS assignments_jnv_class_subject_idx
  ON assignments (jnv_id, jnv_state, target_class, subject);

COMMIT;
