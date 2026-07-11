import { Router } from "express";
import { db, achievementsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc } from "drizzle-orm";

const router = Router();

router.get("/achievements", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(achievementsTable)
      .orderBy(desc(achievementsTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch achievements" });
  }
});

router.post("/achievements", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { title, description, category } = req.body;
    if (!title?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "Title and description required" });
    }
    const [row] = await db.insert(achievementsTable).values({
      title: title.trim(),
      description: description.trim(),
      category: category || "Career",
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
      batch: user.passoutYear,
    }).returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to post achievement" });
  }
});

export default router;
