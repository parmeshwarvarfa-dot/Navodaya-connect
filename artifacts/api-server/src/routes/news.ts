import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, newsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/news", requireAuth, async (req, res) => {
  try {
    const items = await db.select().from(newsTable).orderBy(desc(newsTable.createdAt)).limit(50);
    res.json(items);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.post("/news", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only teachers and officials can post news" });
    }
    const { title, description, category } = req.body;
    if (!title || !description) return res.status(400).json({ error: "title and description required" });
    const [item] = await db.insert(newsTable).values({
      title,
      description,
      category: category || "General",
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
    }).returning();
    res.json(item);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to post news" });
  }
});

router.delete("/news/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [item] = await db.select().from(newsTable).where(eq(newsTable.id, req.params.id as string)).limit(1);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.authorId !== user.id && user.role !== "official") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(newsTable).where(eq(newsTable.id, req.params.id as string));
    res.json({ ok: true });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
