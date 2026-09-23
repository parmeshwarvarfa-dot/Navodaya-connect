---
name: Firebase config normalization
description: Firebase web configuration from Replit Secrets may contain whitespace or quote characters that break client auth.
---

Normalize and validate all Firebase web configuration values at the boundary before initializing the client or calling the Identity Toolkit API. Treat an `auth/api-key-not-valid` error as a configuration-path issue first; do not expose the key while debugging.

**Why:** The stored key can be valid for Firebase while the Expo bundle rejects the untrimmed value.

**How to apply:** Trim values, remove accidental wrapping quotes, require apiKey/authDomain/projectId/appId, and log only non-sensitive presence booleans in development.