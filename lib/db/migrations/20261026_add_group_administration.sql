BEGIN;

ALTER TABLE groups ADD COLUMN IF NOT EXISTS group_type text NOT NULL DEFAULT 'legacy';
ALTER TABLE groups ADD COLUMN IF NOT EXISTS created_by_id uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE groups ADD COLUMN IF NOT EXISTS admin_only_messages boolean NOT NULL DEFAULT false;

-- Classify only rows with a reliable structural relation or controlled category
-- marker. Existing memberships, admin roles, and messages are not changed.
UPDATE groups
SET group_type = 'club_managed'
WHERE club_id IS NOT NULL AND group_type = 'legacy';

UPDATE groups
SET group_type = 'staff_managed'
WHERE subject = 'Staff Group' AND jnv_id IS NOT NULL AND group_type = 'legacy';

UPDATE groups
SET group_type = 'class_based'
WHERE teacher_id IS NULL
  AND jnv_id IS NULL
  AND subject IN ('Class community', 'Alumni batch')
  AND group_type = 'legacy';

UPDATE groups
SET group_type = 'system_created'
WHERE teacher_id IS NULL
  AND jnv_id IS NULL
  AND subject IN ('House community', 'School community', 'All Navodayans', 'Interest community')
  AND group_type = 'legacy';

CREATE INDEX IF NOT EXISTS groups_group_type_idx ON groups (group_type);

COMMIT;
