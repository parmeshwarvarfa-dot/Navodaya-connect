---
name: Verification System
description: How the verification & user management system works end-to-end in Navodaya Connect.
---

## Rule
Signup auto-sets verificationStatus="pending" and creates a verificationRequest row. Officials are auto-set to "verified" on signup. Non-verified users are redirected from `app/index.tsx` to `/(screens)/verification-center` (not in the tab structure). The tab layout also watches `isVerified` and redirects back if a suspended/rejected user somehow reaches tabs.

**Why:** Unverified JNV members should not access the community feed or features until a JNV Official confirms their identity.

**How to apply:** `isVerified` = `role === "official" || verificationStatus === "verified"` (in AuthContext). Check this before allowing tab access. The official dashboard and user-management screens are in `/(screens)/` not `/(tabs)/`.
