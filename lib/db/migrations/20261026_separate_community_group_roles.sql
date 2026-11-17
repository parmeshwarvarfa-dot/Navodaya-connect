BEGIN;

-- High-confidence system communities have no user-assigned group admins.
-- Leave all legacy rows untouched because their creator and group type cannot
-- be established from the existing data.
UPDATE group_members AS members
SET role = 'member'
FROM groups
WHERE members.group_id = groups.id
  AND members.role = 'admin'
  AND groups.group_type IN ('system_created', 'class_based');

UPDATE groups
SET admin_only_messages = false
WHERE group_type IN ('system_created', 'class_based');

COMMIT;
