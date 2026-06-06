---
name: Group chat schema additions
description: Extra columns added to group_messages table and how to apply future schema changes
---

**Rule:** Any new columns in `lib/db/src/schema/groups.ts` require running `pnpm --filter @workspace/db exec drizzle-kit push --force` followed by `pnpm run typecheck:libs` to regenerate type declarations.

**Columns added to group_messages:**
- `reactions` text — JSON string of `ReactionEntry[]` (`{emoji, count, userIds[]}`)
- `replyToId` uuid — points to replied-to message id
- `replyToText` text — cached preview of replied-to message (max 120 chars)
- `replyToSender` text — cached sender name of replied-to message
- `isEdited` boolean — true when PATCH edit has been applied
- `deletedAt` timestamp — soft-delete; null means visible

**Why:** Avoids a separate reactions table; soft-delete keeps history for moderation; caching reply text avoids a join for every message render.

**How to apply:** Schema in `lib/db/src/schema/groups.ts`, types in `artifacts/mobile/lib/api.ts` (`GroupMessage` interface + `ReactionEntry` interface).
