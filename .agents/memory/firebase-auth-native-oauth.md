---
name: Firebase native OAuth configuration
description: Native Google sign-in needs OAuth client IDs beyond the Firebase web configuration.
---

Native Firebase email/password and Apple credentials can be implemented from the existing app configuration, but Google sign-in on iOS and Android requires platform OAuth client IDs and native redirect configuration. The Firebase API key, app ID, and auth domain alone are not enough.

**Why:** The Firebase JavaScript SDK supports Google popup sign-in on web, while native Expo builds need an OAuth session or native Google SDK configuration.

**How to apply:** Keep native Google sign-in behind an explicit configuration check; do not silently fall back to a fake or “coming soon” action. Request the non-secret iOS, Android, and web client IDs before claiming native Google auth is complete.