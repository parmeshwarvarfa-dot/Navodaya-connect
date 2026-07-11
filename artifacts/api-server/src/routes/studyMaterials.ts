import { Router } from "express";
import { db, studyMaterialsTable, studyMaterialBookmarksTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq, and } from "drizzle-orm";

const router = Router();

router.get("/study-materials", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db.select().from(studyMaterialsTable)
      .where(eq(studyMaterialsTable.jnvName, user.jnvName))
      .orderBy(desc(studyMaterialsTable.createdAt));
    const bookmarks = await db.select().from(studyMaterialBookmarksTable)
      .where(eq(studyMaterialBookmarksTable.userId, user.id));
    const bmSet = new Set(bookmarks.map((b) => b.materialId));
    res.json(rows.map((r) => ({ ...r, bookmarked: bmSet.has(r.id) })));
  } catch (e) {
    req.log.error(e, "study materials error");
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

router.post("/study-materials", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only teachers can upload materials" });
    }
    const { title, subject, type, url, size, targetClass } = req.body;
    if (!title?.trim() || !subject?.trim()) {
      return res.status(400).json({ error: "Title and subject required" });
    }
    const [row] = await db.insert(studyMaterialsTable).values({
      title: title.trim(),
      subject: subject.trim(),
      type: type || "Notes",
      url: url?.trim(),
      size: size?.trim(),
      targetClass: targetClass?.trim(),
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
    }).returning();
    res.json({ ...row, bookmarked: false });
  } catch (e) {
    res.status(500).json({ error: "Failed to upload material" });
  }
});

router.post("/study-materials/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const existing = await db.select().from(studyMaterialBookmarksTable)
      .where(and(
        eq(studyMaterialBookmarksTable.materialId, req.params.id as string),
        eq(studyMaterialBookmarksTable.userId, user.id),
      ));
    if (existing.length > 0) {
      await db.delete(studyMaterialBookmarksTable)
        .where(eq(studyMaterialBookmarksTable.id, existing[0].id));
      res.json({ bookmarked: false });
    } else {
      await db.insert(studyMaterialBookmarksTable).values({
        materialId: req.params.id as string,
        userId: user.id,
      });
      res.json({ bookmarked: true });
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

export default router;
