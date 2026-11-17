# JNV Ratlam affiliation correction

Audit date: 2026-10-26. This report is based on the configured development database. The audit and backup queries were read-only.

## School identity findings

There is no `schools` table or school foreign-key registry in this database. A school's stable key is derived by `makeJnvId(state, schoolName)` and stored as text on user and school-scoped rows.

| School entry | Stored name | State | Stable key | Existing users before migration |
| --- | --- | --- | --- | ---: |
| Legacy | JNV Ratlam | Madhya Pradesh | `jnv:madhya-pradesh:ratlam` | 4 |
| Target | JNV Ratlam-I (the app directory's spelling of Ratlam-1) | Madhya Pradesh | `jnv:madhya-pradesh:ratlam-i` | 1 |
| Separate school | JNV Ratlam-II | Madhya Pradesh | `jnv:madhya-pradesh:ratlam-ii` | 0 |

The four legacy accounts are 1 verified alumnus, 2 verified teachers, and 1 verified official. The database contains no conflicting IDs or null-ID accounts for these exact legacy name/state values. The existing Ratlam-I user is preserved and not merged with the four legacy users.

## Dry-run counts

The planned transaction changes school affiliation fields only:

| Table | Rows to update | Scope |
| --- | ---: | --- |
| `users` | 4 | Exact legacy `jnv_name`, `jnv_state`, and `jnv_id` |
| `groups` | 4 | Legacy school-scoped groups; preserve group IDs, memberships, and messages |
| `clubs` | 1 | Legacy club managed by a migrated account |
| `memories` | 1 | Legacy-tagged memory authored by a migrated account |
| `verification_requests` | 3 | Legacy school requests whose `user_id` is one of the four migrated accounts |
| **Total rows/records with affiliation fields changed** | **13** | No account, content, or membership rows are deleted |

One other approved student verification request has the legacy school name but belongs to the existing Ratlam-I account. Its historical school reference is excluded and remains unchanged.

Rows related through the four existing user IDs are preserved in place: 14 group memberships, 9 group messages, 2 direct conversations, 3 direct messages, 2 message requests, 1 club membership, 1 managed club, 1 memory, 15 notifications, 5 follow records, 16 sessions, 4 verification-request records, and 2 group teacher references (75 related rows total). Their internal user IDs remain unchanged. Other queried school-reference tables had no legacy Ratlam rows. There are no active legacy verification assignments or digital credentials to move.

## Authentication and signup

The app supports password sign-in and Firebase ID-token sign-in. Firebase `localId` is verified by the API, while the internal account is resolved by normalized email; Firebase UIDs are not stored in the `users` table. This operation leaves Firebase accounts, internal user IDs, email addresses, password hashes, and sessions unchanged.

Signup's school picker reads the canonical app directory, which lists Ratlam-I and Ratlam-II separately and does not list the retired Ratlam entry. The API derives `jnv_id` from the selected state and school name; it has no Ratlam default. The ordinary profile update endpoint rejects school-affiliation changes and requires an authorized transfer workflow.

## Backup and migration

Before applying the transaction, the 13 affected rows' original IDs and affiliation columns were snapshotted to a DPAPI-encrypted, current-Windows-user-bound file at:

`%TEMP%\NavodayaConnect-Ratlam-Affiliation-Backup\legacy-to-ratlam-one.dpapi`

The encrypted snapshot was decrypted in memory and its table counts verified (4 users, 4 groups, 1 club, 1 memory, 3 verification requests). The repeatable, guarded transaction is in `ratlam_school_association_migration.sql`. It performs no schema changes and contains no delete or truncate statements.

## Post-migration verification

The transaction committed, and its in-transaction assertions confirmed that the same four user UUIDs now resolve to the Ratlam-I affiliation. A read-only post-commit count returned:

| Check | Result |
| --- | ---: |
| Users still on legacy Ratlam ID | 0 |
| Users on Ratlam-I | 5 (4 migrated + 1 pre-existing) |
| Users on Ratlam-II | 0 |
| Legacy-scoped groups / Ratlam-I groups | 0 / 6 |
| Legacy-named clubs / Ratlam-I clubs | 0 / 1 |
| Legacy-tagged memories / Ratlam-I memories | 0 / 1 |
| Legacy-named verification requests / Ratlam-I requests | 1 / 3 |
| Group memberships and messages belonging to Ratlam-I users | 22 / 21 |
| Sessions belonging to Ratlam-I users | 35 |

The single remaining legacy-named request is the existing Ratlam-I student's historical approved verification request. No authentication fields, user IDs, content IDs, memberships, messages, or sessions were modified or deleted.
