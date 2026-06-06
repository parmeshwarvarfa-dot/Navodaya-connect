---
name: Official quick action routing
description: Where JNV Official quick actions route and problem status values
---

**Rule:** The "View Problems" quick action for officials in `app/(tabs)/index.tsx` must route to `/(screens)/view-problems`, NOT the `/problems` tab (which is a student submission screen).

**Problem status values (backend accepts any string):**
- `submitted` → displayed as "Pending"
- `seen` → displayed as "Under Review"
- `in_progress` → displayed as "In Progress"
- `solved` → displayed as "Resolved"
- `rejected` → displayed as "Rejected"

**Why:** The problems tab is for students/alumni/teachers to SUBMIT problems. Officials need a separate read-only management view with status controls. Mixing the two creates UX confusion.

**How to apply:** OFFICIAL_ACTIONS array in `app/(tabs)/index.tsx`; view-problems.tsx at `app/(screens)/view-problems.tsx`.
