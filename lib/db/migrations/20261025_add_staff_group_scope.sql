BEGIN;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS jnv_id text;

CREATE UNIQUE INDEX IF NOT EXISTS groups_staff_jnv_id_uidx
  ON groups (jnv_id)
  WHERE subject = 'Staff Group' AND jnv_id IS NOT NULL;

COMMIT;
