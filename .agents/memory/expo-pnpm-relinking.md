---
name: Expo pnpm relinking
description: Recovery guidance when Expo reports a declared package missing or duplicate installations after workspace dependency drift.
---

When Expo startup says a declared module such as `babel-preset-expo` is missing, but it exists in the app manifest and lockfile, first suspect an incomplete or stale pnpm installation rather than a bad dependency declaration. A filtered install can restore the app link while leaving stale Expo package copies that keep Expo Doctor's duplicate-dependency check failing. Use a full workspace relink with `pnpm install --force --frozen-lockfile`, then rerun Expo Doctor. Keep the lockfile intact.

**Why:** An interrupted or partial workspace install can leave the app's module links inconsistent with the lockfile; a full relink restored Metro startup and Expo Doctor in this workspace.

**How to apply:** Use this recovery when module resolution contradicts the manifest/lockfile or Expo Doctor reports stale duplicate package installations after an install interruption. Avoid changing versions or deleting the lockfile until a clean relink has been tried.
