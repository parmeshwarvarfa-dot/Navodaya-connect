---
name: Typing indicator pattern
description: How the real-time typing indicator works (in-memory, no DB)
---

**Rule:** Typing state lives in a `Map<groupId, Map<userId, {name, expiresAt}>>` on the API server. It is deliberately NOT stored in the database.

**Backend:** `GET /groups/:id/typing` returns `{typing: string[]}` (names of others typing). `POST /groups/:id/typing` with `{typing: boolean}` sets/clears the caller's typing state. Entries expire 4 seconds after the last POST.

**Frontend:** `handleTextChange` in group-chat.tsx sends `setTyping(id, true)` on first keypress, resets a 3-second debounce timer, sends `setTyping(id, false)` when timer fires or input is cleared. A `setInterval` every 2 seconds fetches typing state.

**Why:** DB writes for ephemeral state every few seconds would create excessive load. In-memory with TTL is the standard pattern for presence/typing indicators.

**How to apply:** `artifacts/api-server/src/routes/groups.ts` — `typingStore` Map at module level. Clean up on group route teardown is not needed (server restart = clean state).
