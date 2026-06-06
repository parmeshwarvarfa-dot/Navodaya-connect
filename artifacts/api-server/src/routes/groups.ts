import { Router } from "express";
import { desc, eq, asc, isNull } from "drizzle-orm";
import { db, groupsTable, groupMessagesTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

// In-memory typing indicator store  { groupId -> { userId -> { name, expiresAt } } }
const typingStore: Map<string, Map<string, { name: string; expiresAt: number }>> = new Map();

function cleanTyping(groupId: string) {
  const group = typingStore.get(groupId);
  if (!group) return;
  const now = Date.now();
  for (const [uid, data] of group) {
    if (data.expiresAt < now) group.delete(uid);
  }
}

router.get("/groups", requireAuth, async (req, res) => {
  try {
    const groups = await db.select().from(groupsTable).orderBy(desc(groupsTable.createdAt));
    res.json(groups);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

router.post("/groups", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "teacher") return res.status(403).json({ error: "Only teachers can create groups" });
    const { name, subject, class: cls } = req.body;
    if (!name || !subject) return res.status(400).json({ error: "name and subject required" });
    const [group] = await db.insert(groupsTable).values({
      name,
      subject,
      class: cls,
      jnvName: user.jnvName,
      jnvState: user.jnvState,
      teacherName: user.fullName,
      teacherId: user.id,
      memberCount: 1,
    }).returning();
    res.json(group);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to create group" });
  }
});

router.get("/groups/:id/messages", requireAuth, async (req, res) => {
  try {
    const messages = await db.select().from(groupMessagesTable)
      .where(eq(groupMessagesTable.groupId, req.params.id))
      .orderBy(asc(groupMessagesTable.createdAt))
      .limit(200);
    res.json(messages);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/groups/:id/messages", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { text, replyToId, replyToText, replyToSender } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });
    const [msg] = await db.insert(groupMessagesTable).values({
      groupId: req.params.id,
      text: text.trim(),
      senderName: user.fullName,
      senderId: user.id,
      role: user.role,
      replyToId: replyToId || null,
      replyToText: replyToText || null,
      replyToSender: replyToSender || null,
    }).returning();
    res.json(msg);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.patch("/groups/:id/messages/:msgId", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });
    const [existing] = await db.select().from(groupMessagesTable)
      .where(eq(groupMessagesTable.id, req.params.msgId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Message not found" });
    if (existing.senderId !== user.id) return res.status(403).json({ error: "You can only edit your own messages" });
    const [updated] = await db.update(groupMessagesTable)
      .set({ text: text.trim(), isEdited: true })
      .where(eq(groupMessagesTable.id, req.params.msgId))
      .returning();
    res.json(updated);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

router.delete("/groups/:id/messages/:msgId", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [existing] = await db.select().from(groupMessagesTable)
      .where(eq(groupMessagesTable.id, req.params.msgId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Message not found" });
    if (existing.senderId !== user.id && user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Cannot delete this message" });
    }
    const [deleted] = await db.update(groupMessagesTable)
      .set({ deletedAt: new Date() })
      .where(eq(groupMessagesTable.id, req.params.msgId))
      .returning();
    res.json(deleted);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

router.post("/groups/:id/messages/:msgId/react", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { emoji } = req.body;
    if (!emoji) return res.status(400).json({ error: "emoji required" });
    const [existing] = await db.select().from(groupMessagesTable)
      .where(eq(groupMessagesTable.id, req.params.msgId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Message not found" });

    type ReactionEntry = { emoji: string; count: number; userIds: string[] };
    const reactions: ReactionEntry[] = existing.reactions
      ? JSON.parse(existing.reactions)
      : [];

    const idx = reactions.findIndex((r) => r.emoji === emoji);
    if (idx >= 0) {
      const uidIdx = reactions[idx].userIds.indexOf(user.id);
      if (uidIdx >= 0) {
        reactions[idx].userIds.splice(uidIdx, 1);
        reactions[idx].count = reactions[idx].userIds.length;
        if (reactions[idx].count <= 0) reactions.splice(idx, 1);
      } else {
        reactions[idx].userIds.push(user.id);
        reactions[idx].count = reactions[idx].userIds.length;
      }
    } else {
      reactions.push({ emoji, count: 1, userIds: [user.id] });
    }

    const [updated] = await db.update(groupMessagesTable)
      .set({ reactions: JSON.stringify(reactions) })
      .where(eq(groupMessagesTable.id, req.params.msgId))
      .returning();
    res.json(updated);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to react" });
  }
});

router.get("/groups/:id/typing", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    cleanTyping(req.params.id);
    const group = typingStore.get(req.params.id);
    const typers: string[] = [];
    if (group) {
      for (const [uid, data] of group) {
        if (uid !== user.id) typers.push(data.name);
      }
    }
    res.json({ typing: typers });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to get typing" });
  }
});

router.post("/groups/:id/typing", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { typing } = req.body;
    if (!typingStore.has(req.params.id)) typingStore.set(req.params.id, new Map());
    const group = typingStore.get(req.params.id)!;
    if (typing) {
      group.set(user.id, { name: user.fullName, expiresAt: Date.now() + 4000 });
    } else {
      group.delete(user.id);
    }
    res.json({ ok: true });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update typing" });
  }
});

export default router;
