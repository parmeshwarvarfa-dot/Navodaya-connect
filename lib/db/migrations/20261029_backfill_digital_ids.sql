-- Idempotently issue Digital IDs to users whose existing approval trail is
-- complete. Unverified accounts and legacy records without proof are excluded.
DO $digital_id_backfill$
DECLARE
  candidate record;
  id_prefix text;
  inserted_id uuid;
  attempt integer;
BEGIN
  FOR candidate IN
    SELECT eligible.user_id, eligible.role, eligible.jnv_id, eligible.jnv_name,
           eligible.jnv_state, eligible.issued_by
    FROM (
      SELECT DISTINCT ON (u.id)
        u.id AS user_id, u.role, u.jnv_id, u.jnv_name, u.jnv_state,
        vr.reviewed_by AS issued_by, vr.reviewed_at AS approved_at
      FROM users u
      JOIN verification_requests vr ON vr.user_id = u.id
        AND vr.role = u.role
        AND vr.status = 'approved'
        AND vr.method <> 'alumni_peer'
        AND vr.reviewed_by IS NOT NULL
      JOIN verification_audit va ON va.request_id = vr.id
        AND va.subject_user_id = u.id
        AND va.action = 'official_approved'
      WHERE u.role IN ('student', 'teacher', 'official')
        AND u.verification_status = 'verified'
        AND u.jnv_id IS NOT NULL
      ORDER BY u.id, vr.reviewed_at DESC NULLS LAST, vr.created_at DESC
    ) eligible
    UNION ALL
    SELECT eligible.user_id, eligible.role, eligible.jnv_id, eligible.jnv_name,
           eligible.jnv_state, eligible.issued_by
    FROM (
      SELECT DISTINCT ON (u.id)
        u.id AS user_id, u.role, u.jnv_id, u.jnv_name, u.jnv_state,
        va.actor_id AS issued_by
      FROM users u
      JOIN verification_requests vr ON vr.user_id = u.id
        AND vr.role = 'alumni'
        AND vr.method = 'alumni_peer'
        AND vr.status = 'approved'
      JOIN verification_audit va ON va.request_id = vr.id
        AND va.subject_user_id = u.id
        AND va.action = 'alumni_peer_confirmed'
        AND va.actor_id IS NOT NULL
      WHERE u.role = 'alumni'
        AND u.verification_status = 'community_verified'
        AND u.community_verified_at IS NOT NULL
        AND u.jnv_id IS NOT NULL
      ORDER BY u.id, va.created_at DESC
    ) eligible
  LOOP
    IF EXISTS (
      SELECT 1 FROM digital_credentials dc
      WHERE dc.user_id = candidate.user_id AND dc.status = 'active'
    ) THEN
      CONTINUE;
    END IF;

    id_prefix := CASE candidate.role
      WHEN 'student' THEN 'STU'
      WHEN 'alumni' THEN 'ALU'
      WHEN 'teacher' THEN 'TCH'
      WHEN 'official' THEN 'OFC'
    END;

    FOR attempt IN 1..10 LOOP
      INSERT INTO digital_credentials (
        user_id, credential_id, public_token, role, jnv_id, jnv_name,
        jnv_state, status, issued_by
      ) VALUES (
        candidate.user_id,
        'NC-' || id_prefix || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
        substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 40),
        candidate.role, candidate.jnv_id, candidate.jnv_name,
        candidate.jnv_state, 'active', candidate.issued_by
      ) ON CONFLICT DO NOTHING RETURNING id INTO inserted_id;
      IF FOUND THEN EXIT; END IF;
      IF EXISTS (
        SELECT 1 FROM digital_credentials dc
        WHERE dc.user_id = candidate.user_id AND dc.status = 'active'
      ) THEN EXIT;
      END IF;
    END LOOP;
  END LOOP;
END
$digital_id_backfill$;
