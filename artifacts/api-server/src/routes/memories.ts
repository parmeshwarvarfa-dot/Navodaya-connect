import { Router } from "express";
import { db, memoriesTable, memoryLikesTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq, and } from "drizzle-orm";

const router = Router();

router.get("/memories", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db.select().from(memoriesTable)
      .orderBy(desc(memoriesTable.createdAt));
    const likes = await db.select().from(memoryLikesTable)
      .where(eq(memoryLikesTable.userId, user.id));
    const likedSet = new Set(likes.map((l) => l.memoryId));
    res.json(rows.map((r) => ({ ...r, liked: likedSet.has(r.id) })));
  } catch (e) {
    req.log.error(e, "memories error");
    res.status(500).json({ error: "Failed to fetch memories" });
  }
});

router.post("/memories", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { caption, imageUrl } = req.body;
    const [row] = await db.insert(memoriesTable).values({
      caption: caption?.trim(),
      imageUrl: imageUrl?.trim(),
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
      likes: 0,
    }).returning();
    res.json({ ...row, liked: false });
  } catch (e) {
    res.status(500).json({ error: "Failed to post memory" });
  }
});

router.post("/memories/:id/like", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const existing = await db.select().from(memoryLikesTable)
      .where(and(
        eq(memoryLikesTable.memoryId, req.params.id as string),
        eq(memoryLikesTable.userId, user.id),
      ));
    const mem = await db.select().from(memoriesTable).where(eq(memoriesTable.id, req.params.id as string));
    if (!mem.length) return res.status(404).json({ error: "Not found" });
    const currentLikes = mem[0].likes;
    if (existing.length > 0) {
      await db.delete(memoryLikesTable).where(eq(memoryLikesTable.id, existing[0].id));
      await db.update(memoriesTable).set({ likes: Math.max(0, currentLikes - 1) }).where(eq(memoriesTable.id, req.params.id as string));
      res.json({ liked: false, likes: Math.max(0, currentLikes - 1) });
    } else {
      await db.insert(memoryLikesTable).values({ memoryId: req.params.id as string, userId: user.id });
      await db.update(memoriesTable).set({ likes: currentLikes + 1 }).where(eq(memoriesTable.id, req.params.id as string));
      res.json({ liked: true, likes: currentLikes + 1 });
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

export default router;
