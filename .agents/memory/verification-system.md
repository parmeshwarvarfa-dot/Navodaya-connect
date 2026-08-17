---
name: Verification System
description: How the verification & user management system works end-to-end in Navodaya Connect.
---

## Rule
Signup auto-sets verificationStatus="pending" and creates a verificationRequest row. Officials are auto-set to "verified" on signup. New non-verified users see `/(screens)/verification-center`, where they can start verification or skip to the dashboard with limited access. Protected features are gated until verification completes.

**Why:** Users need to understand and explore the product before verification, while messaging, events, communities, and member networking remain restricted until a JNV Official confirms their identity.

**How to apply:** `isVerified` = `role === "official" || verificationStatus === "verified"` (in AuthContext). Allow the home feed, news, rankings, Study Hub, and problem reporting before verification. Gate protected quick actions, events, mentor networking, House Arena, and Chat Groups. The official dashboard and user-management screens are in `/(screens)/` not `/(tabs)/`.
