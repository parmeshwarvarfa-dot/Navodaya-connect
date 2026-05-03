import { Router } from "express";
import { desc, eq, asc } from "drizzle-orm";
import { db, groupsTable, groupMessagesTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

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
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });
    const [msg] = await db.insert(groupMessagesTable).values({
      groupId: req.params.id,
      text: text.trim(),
      senderName: user.fullName,
      senderId: user.id,
      role: user.role,
    }).returning();
    res.json(msg);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
