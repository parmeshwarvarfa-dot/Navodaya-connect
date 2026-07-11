import { Router } from "express";
import { db, announcementsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/announcements", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db
      .select()
      .from(announcementsTable)
      .where(eq(announcementsTable.jnvName, user.jnvName))
      .orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt));
    res.json(rows);
  } catch (e) {
    req.log.error(e, "announcements list error");
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post("/announcements", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only teachers/officials can post announcements" });
    }
    const { title, body, target, priority, pinned } = req.body;
    if (!title?.trim() || !body?.trim()) {
      return res.status(400).json({ error: "Title and body are required" });
    }
    const [row] = await db.insert(announcementsTable).values({
      title: title.trim(),
      body: body.trim(),
      target: target || "Whole School",
      priority: priority || "normal",
      pinned: !!pinned,
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
    }).returning();
    res.json(row);
  } catch (e) {
    req.log.error(e, "announcement create error");
    res.status(500).json({ error: "Failed to post announcement" });
  }
});

router.patch("/announcements/:id/pin", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { pinned } = req.body;
    const [row] = await db.update(announcementsTable)
      .set({ pinned: !!pinned })
      .where(eq(announcementsTable.id, req.params.id as string))
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to update" });
  }
});

router.delete("/announcements/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(announcementsTable).where(eq(announcementsTable.id, req.params.id as string));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
