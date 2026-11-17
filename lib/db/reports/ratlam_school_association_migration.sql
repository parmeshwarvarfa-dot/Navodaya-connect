-- One-time, repeatable affiliation correction for the audited Ratlam records.
-- No school registry exists: IDs are derived from state and canonical name.
-- The companion dry-run report records scope, counts, and the pre-update backup.
BEGIN;

DO $migration$
DECLARE
  legacy_user_ids uuid[];
  legacy_user_count integer;
  ratlam_one_user_count integer;
  affected_count integer;
BEGIN
  SELECT array_agg(id), count(*)::integer
    INTO legacy_user_ids, legacy_user_count
    FROM users
   WHERE jnv_state = 'Madhya Pradesh'
     AND jnv_name = 'JNV Ratlam'
     AND jnv_id = 'jnv:madhya-pradesh:ratlam';

  SELECT count(*)::integer
    INTO ratlam_one_user_count
    FROM users
   WHERE jnv_state = 'Madhya Pradesh'
     AND jnv_name = 'JNV Ratlam-I'
     AND jnv_id = 'jnv:madhya-pradesh:ratlam-i';

  -- A rerun after successful commit is a no-op. Any unexpected partial scope
  -- or target identity stops the transaction before changes are made.
  IF legacy_user_count = 0 THEN
    IF ratlam_one_user_count < 1 THEN
      RAISE EXCEPTION 'Ratlam-I target identity was not found; no changes applied';
    END IF;
    RETURN;
  END IF;

  IF legacy_user_count <> 4 OR ratlam_one_user_count <> 1 THEN
    RAISE EXCEPTION 'Dry-run scope changed (legacy users %, Ratlam-I users %); no changes applied',
      legacy_user_count, ratlam_one_user_count;
  END IF;

  IF (SELECT count(*) FROM groups
       WHERE jnv_id = 'jnv:madhya-pradesh:ratlam'
          OR (jnv_name = 'JNV Ratlam' AND jnv_state = 'Madhya Pradesh')) <> 4
     OR (SELECT count(*) FROM clubs
          WHERE jnv_name = 'JNV Ratlam' AND manager_id = ANY(legacy_user_ids)) <> 1
     OR (SELECT count(*) FROM memories
          WHERE jnv_name = 'JNV Ratlam' AND author_id = ANY(legacy_user_ids)) <> 1
     OR (SELECT count(*) FROM verification_requests
          WHERE jnv_name = 'JNV Ratlam' AND jnv_state = 'Madhya Pradesh'
            AND user_id = ANY(legacy_user_ids)) <> 3 THEN
    RAISE EXCEPTION 'School-dependent dry-run scope changed; no changes applied';
  END IF;

  UPDATE users
     SET jnv_name = 'JNV Ratlam-I',
         jnv_id = 'jnv:madhya-pradesh:ratlam-i'
   WHERE id = ANY(legacy_user_ids)
     AND jnv_state = 'Madhya Pradesh'
     AND jnv_name = 'JNV Ratlam'
     AND jnv_id = 'jnv:madhya-pradesh:ratlam';
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 4 THEN
    RAISE EXCEPTION 'Expected to update 4 user affiliations, updated %', affected_count;
  END IF;

  UPDATE groups
     SET jnv_name = 'JNV Ratlam-I',
         jnv_state = 'Madhya Pradesh',
         jnv_id = CASE WHEN jnv_id = 'jnv:madhya-pradesh:ratlam'
                       THEN 'jnv:madhya-pradesh:ratlam-i' ELSE jnv_id END
   WHERE jnv_id = 'jnv:madhya-pradesh:ratlam'
      OR (jnv_name = 'JNV Ratlam' AND jnv_state = 'Madhya Pradesh');
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 4 THEN
    RAISE EXCEPTION 'Expected to update 4 group affiliations, updated %', affected_count;
  END IF;

  UPDATE clubs
     SET jnv_name = 'JNV Ratlam-I'
   WHERE jnv_name = 'JNV Ratlam'
     AND manager_id = ANY(legacy_user_ids);
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 1 THEN
    RAISE EXCEPTION 'Expected to update 1 club affiliation, updated %', affected_count;
  END IF;

  UPDATE memories
     SET jnv_name = 'JNV Ratlam-I'
   WHERE jnv_name = 'JNV Ratlam'
     AND author_id = ANY(legacy_user_ids);
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 1 THEN
    RAISE EXCEPTION 'Expected to update 1 memory affiliation, updated %', affected_count;
  END IF;

  UPDATE verification_requests
     SET jnv_name = 'JNV Ratlam-I'
   WHERE jnv_name = 'JNV Ratlam'
     AND jnv_state = 'Madhya Pradesh'
     AND user_id = ANY(legacy_user_ids);
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  IF affected_count <> 3 THEN
    RAISE EXCEPTION 'Expected to update 3 legacy-user verification requests, updated %', affected_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM users
     WHERE id = ANY(legacy_user_ids)
       AND (jnv_name <> 'JNV Ratlam-I' OR jnv_id <> 'jnv:madhya-pradesh:ratlam-i')
  ) OR (SELECT count(*) FROM users
         WHERE jnv_state = 'Madhya Pradesh'
           AND jnv_name = 'JNV Ratlam-I'
           AND jnv_id = 'jnv:madhya-pradesh:ratlam-i') <> 5 THEN
    RAISE EXCEPTION 'Post-update identity verification failed';
  END IF;
END
$migration$;

COMMIT;
