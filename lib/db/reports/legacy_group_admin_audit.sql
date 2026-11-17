-- Run after 20261026_add_group_administration.sql.
-- Lists every conservatively classified legacy group and every group type that
-- expects a group-scoped admin. A zero admin count needs an explicit ownership
-- decision; nonzero legacy counts still need review because their provenance is
-- unavailable in the original schema.
SELECT
  g.id AS group_id,
  g.name,
  g.subject,
  g.jnv_name,
  g.jnv_state,
  g.jnv_id,
  g.club_id,
  g.created_by_id,
  g.created_at,
  COUNT(*) FILTER (WHERE gm.role = 'admin' AND gm.user_id IS NOT NULL) AS active_admin_count,
  COUNT(*) FILTER (WHERE gm.user_id IS NOT NULL AND gm.role <> 'left') AS active_member_count,
  CASE
    WHEN COUNT(*) FILTER (WHERE gm.role = 'admin' AND gm.user_id IS NOT NULL) = 0
      AND g.group_type IN ('staff_managed', 'club_managed')
      THEN 'review linked school or club administrator source'
    WHEN COUNT(*) FILTER (WHERE gm.role = 'admin' AND gm.user_id IS NOT NULL) = 0
      THEN 'requires explicit administrative decision'
    WHEN g.group_type = 'legacy' THEN 'review existing admin assignment provenance'
    ELSE 'group admin assignment present'
  END AS ownership_review
FROM groups g
LEFT JOIN group_members gm ON gm.group_id = g.id
WHERE g.group_type IN ('legacy', 'user_created', 'school_managed', 'staff_managed', 'club_managed')
GROUP BY g.id
ORDER BY g.created_at NULLS FIRST, g.id;
