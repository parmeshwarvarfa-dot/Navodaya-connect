---
name: Verification System
description: How the verification & user management system works end-to-end in Navodaya Connect.
---

## Rule
New accounts start `unverified`. Students, teachers, and JNV officials continue to use their existing assigned school review rules. Alumni verification is peer-only: a different alumnus with the same valid stored JNV association may confirm, whether that peer is verified or unverified. One confirmation sets `community_verified` and records `community_verified_at` in the same transaction. Historical alumni school approvals remain in the old request and audit records but do not count as community confirmation.

JNV officials and teachers cannot approve alumni verification. Assigned moderators may review reports and suspend or revoke existing peer confirmation, but cannot create the first badge. Reports do not automatically change status. Login, profile completion, account security, alumni matching, reports, and appeals remain available before community confirmation; other protected alumni APIs require peer confirmation on the server.

**How to apply:** Use `isCommunityVerifiedAlumni` and the alumni access middleware in `artifacts/api-server/src/lib/auth.ts`; do not treat the old `verified` status as community verification for alumni. Alumni use `/(screens)/alumni-peer-verification`; other roles use `/(screens)/verification-center`. Keep role labels separate from verification badges.
