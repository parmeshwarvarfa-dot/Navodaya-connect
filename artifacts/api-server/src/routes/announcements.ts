import { Router } from "express";
import { db, announcementsTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, isAuthorizedSchoolStaff, requireAuth } from "../lib/auth";
import { and, desc, eq, or } from "drizzle-orm";

const router = Router();

router.get("/announcements", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const schoolScope = eq(announcementsTable.jnvName, user.jnvName);
    const rows = await db
      .select()
      .from(announcementsTable)
      .where(user.role === "student"
        ? and(schoolScope, or(eq(announcementsTable.target, "Whole School"), eq(announcementsTable.target, user.class ?? "")))
        : schoolScope)
      .orderBy(desc(announcementsTable.pinned), desc(announcementsTable.createdAt));
    res.json(rows);
  } catch (e) {
    req.log.error(e, "announcements list error");
    res.status(500).json({ error: "Failed to fetch announcements" });
  }
});

router.post("/announcements", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!await isAuthorizedSchoolStaff(user)) return res.status(403).json({ error: "Verified school staff access is required" });
    if (user.role === "official" && !await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access is required" });
    const { title, body, target, priority, pinned } = req.body ?? {};
    if (typeof title !== "string" || typeof body !== "string" || !title.trim() || !body.trim() || title.length > 160 || body.length > 5000) {
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
    const user = getUser(req);
    if (!await isAuthorizedSchoolStaff(user)) return res.status(403).json({ error: "Verified school staff access is required" });
    const { pinned } = req.body ?? {};
    if (typeof pinned !== "boolean") return res.status(400).json({ error: "Pin state must be true or false" });
    const [existing] = await db.select().from(announcementsTable).where(and(eq(announcementsTable.id, req.params.id as string), eq(announcementsTable.jnvName, user.jnvName))).limit(1);
    if (!existing) return res.status(404).json({ error: "Announcement not found" });
    if (user.role === "teacher" && existing.authorId !== user.id) return res.status(403).json({ error: "You can only update your own announcement" });
    if (user.role === "official" && !await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access is required" });
    const [row] = await db.update(announcementsTable)
      .set({ pinned })
      .where(eq(announcementsTable.id, existing.id))
      .returning();
    if (!row) return res.status(404).json({ error: "Announcement not found" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to update" });
  }
});

router.delete("/announcements/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!await isAuthorizedSchoolStaff(user)) return res.status(403).json({ error: "Verified school staff access is required" });
    const [existing] = await db.select().from(announcementsTable).where(and(eq(announcementsTable.id, req.params.id as string), eq(announcementsTable.jnvName, user.jnvName))).limit(1);
    if (!existing) return res.status(404).json({ error: "Announcement not found" });
    if (user.role === "teacher" && existing.authorId !== user.id) return res.status(403).json({ error: "You can only delete your own announcement" });
    if (user.role === "official" && !await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access is required" });
    await db.delete(announcementsTable).where(eq(announcementsTable.id, existing.id));
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
