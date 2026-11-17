-- Consolidate the obsolete Ratlam school-community chat into Ratlam-I.
-- This preserves member rows and message IDs, then removes only the empty
-- duplicate group record. The operation is guarded and safe to rerun.
BEGIN;

DO $migration$
DECLARE
  source_group_id uuid := 'eaaaf644-388b-45da-93f0-b7e37935eaf0';
  target_group_id uuid := '7ea046ca-21de-4518-9d86-9de15dd36a60';
  affected_count integer;
  source_group_count integer;
  target_group_count integer;
  source_member_count integer;
  target_member_count integer;
  source_message_count integer;
  target_message_count integer;
BEGIN
  SELECT count(*)::integer INTO source_group_count
    FROM groups WHERE id = source_group_id;
  SELECT count(*)::integer INTO target_group_count
    FROM groups WHERE id = target_group_id;

  -- A completed run is a no-op; the target must still exist.
  IF source_group_count = 0 THEN
    IF target_group_count = 1 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'Ratlam-I target group was not found; no changes applied';
  END IF;

  IF source_group_count <> 1 OR target_group_count <> 1 THEN
    RAISE EXCEPTION 'Expected exactly one source and target group; no changes applied';
  END IF;

  -- Lock both groups so new child rows cannot race the merge.
  PERFORM id FROM groups
   WHERE id IN (source_group_id, target_group_id)
   ORDER BY id FOR UPDATE;

  IF NOT EXISTS (
    SELECT 1 FROM groups
     WHERE id = source_group_id
       AND name = 'JNV Ratlam'
       AND subject = 'School community'
       AND group_type = 'system_created'
       AND jnv_name = 'JNV Ratlam-I'
       AND jnv_state = 'Madhya Pradesh'
       AND jnv_id IS NULL
       AND created_by_id IS NULL
  ) OR NOT EXISTS (
    SELECT 1 FROM groups
     WHERE id = target_group_id
       AND name = 'JNV Ratlam-I'
       AND subject = 'School community'
       AND group_type = 'system_created'
       AND jnv_name = 'JNV Ratlam-I'
       AND jnv_state = 'Madhya Pradesh'
       AND jnv_id IS NULL
       AND created_by_id IS NULL
  ) THEN
    RAISE EXCEPTION 'Ratlam group identity or school scope changed; no changes applied';
  END IF;

  SELECT count(*)::integer INTO source_member_count
    FROM group_members WHERE group_id = source_group_id;
  SELECT count(*)::integer INTO target_member_count
    FROM group_members WHERE group_id = target_group_id;
  SELECT count(*)::integer INTO source_message_count
    FROM group_messages WHERE group_id = source_group_id;
  SELECT count(*)::integer INTO target_message_count
    FROM group_messages WHERE group_id = target_group_id;

  IF source_member_count <> 2 OR target_member_count <> 1
     OR source_message_count <> 4 OR target_message_count <> 1
     OR EXISTS (SELECT 1 FROM group_members WHERE group_id = source_group_id AND role <> 'member')
     OR EXISTS (
       SELECT 1 FROM group_members source_member
       JOIN group_members target_member ON target_member.user_id = source_member.user_id
       WHERE source_member.group_id = source_group_id
         AND target_member.group_id = target_group_id
     ) THEN
    RAISE EXCEPTION 'Ratlam group dry-run counts or membership roles changed; no changes applied';
  END IF;

  INSERT INTO group_members (group_id, user_id, role, joined_at)
    SELECT target_group_id, user_id, role, joined_at
      FROM group_members
     WHERE group_id = source_group_id
  ON CONFLICT (group_id, user_id) DO NOTHING;
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 2 THEN
    RAISE EXCEPTION 'Expected to move 2 memberships, moved %', affected_count;
  END IF;

  UPDATE group_messages
     SET group_id = target_group_id
   WHERE group_id = source_group_id;
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 4 THEN
    RAISE EXCEPTION 'Expected to move 4 messages, moved %', affected_count;
  END IF;

  DELETE FROM group_members
   WHERE group_id = source_group_id;
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 2 THEN
    RAISE EXCEPTION 'Expected to move 2 source memberships, moved %', affected_count;
  END IF;

  UPDATE groups
     SET member_count = (
       SELECT count(*)::integer FROM group_members
        WHERE group_id = target_group_id AND role <> 'left'
     )
   WHERE id = target_group_id;

  IF EXISTS (SELECT 1 FROM group_members WHERE group_id = source_group_id)
     OR EXISTS (SELECT 1 FROM group_messages WHERE group_id = source_group_id)
     OR (SELECT count(*) FROM group_members WHERE group_id = target_group_id AND role <> 'left') <> 3
     OR (SELECT count(*) FROM group_messages WHERE group_id = target_group_id) <> 5 THEN
    RAISE EXCEPTION 'Post-merge checks failed; transaction rolled back';
  END IF;

  DELETE FROM groups
   WHERE id = source_group_id
     AND name = 'JNV Ratlam'
     AND subject = 'School community'
     AND group_type = 'system_created';
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 1 THEN
    RAISE EXCEPTION 'Expected to remove one empty duplicate group record, removed %', affected_count;
  END IF;
END
$migration$;

COMMIT;
