# Verification system setup

The application does not treat a selected `official` role as proof of school authority. Before anyone can make final decisions, an operator must confirm that person's authority with the school and create the first `official` assignment for that JNV. No in-app self-promotion or default official account exists.

1. Apply the Drizzle schema changes with `pnpm --filter @workspace/db push`.
2. Verify the principal or authorized representative outside the app.
3. Use a database administrator session to insert the official assignment for the already-created `official` account. Confirm the email, school name, state, and `jnv_id` in the `users` row before running the insert.

Example SQL (replace the email only after independent verification):

```sql
INSERT INTO verification_assignments
  (user_id, jnv_id, jnv_name, jnv_state, assignment_role, active)
SELECT id, jnv_id, jnv_name, jnv_state, 'official', true
FROM users
WHERE lower(email) = lower('verified.school.official@example.org')
  AND role = 'official'
  AND jnv_id IS NOT NULL;

INSERT INTO verification_audit (actor_id, subject_user_id, jnv_id, action, reason)
SELECT NULL, id, jnv_id, 'official_assignment_bootstrapped',
       'Database operator confirmed school authority before granting assignment'
FROM users
WHERE lower(email) = lower('verified.school.official@example.org')
  AND role = 'official'
  AND jnv_id IS NOT NULL;
```

Confirm exactly one row was inserted. An authorized official can then appoint verified students, alumni, or teachers at that same JNV as school reviewers from the existing User Management screen. Cross-school assignments are not exposed by the app.

Set `PUBLIC_APP_URL` on the API server to the public Navodaya Connect web origin for credential verification links. Never put private evidence URLs in a public profile or public credential.

Existing verification records predate the approval workflow and do not contain proof of an official final decision. Review legacy verified users before treating their status as a newly issued Digital ID; this code does not silently rewrite existing records.

## Alumni batch transition and legacy credential reconciliation

An assigned JNV official can open **User Management → Student Batch & Alumni Transition**. The batch preview uses existing Class XII Navodaya Connect accounts for that official's JNV. The official selects each student, enters the graduating year, and confirms graduation eligibility. Existing account IDs and content are preserved. Records with a conflicting passout year are excluded; verified users without a current credential and a complete matching official approval record are held for review.

Each batch preview and each per-user outcome is stored in `alumni_transition_batches` and `alumni_transition_results`. Role changes, credential supersession, and success notifications are committed per student in a transaction. Failed records can be retried using the same batch from the screen; completed records are idempotent. The current project has no imported school roster, so unregistered students do not appear in this account-based roster and are never created or linked by name. Use an independently maintained school roster to verify account coverage before confirming a batch.

The **Review approved records** action lists verified users at the official's JNV whose existing approved request includes the required recommendation, final official decision, and evidence. Only selected records meeting all these checks receive a credential. Records without clear approval remain unchanged for manual review. This operation is safe to repeat.

When a verified student becomes an alumnus, the active Student credential is marked `superseded` and an Alumni credential becomes active in the same transaction. Public verification continues to resolve old tokens and reports their superseded status. The one-active-credential index allows historical credentials to remain auditable.
