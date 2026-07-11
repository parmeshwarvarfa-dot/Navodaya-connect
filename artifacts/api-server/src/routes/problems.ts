import { Router } from "express";
import { desc, eq, asc } from "drizzle-orm";
import { db, problemsTable, problemCommentsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/problems", requireAuth, async (req, res) => {
  try {
    const problems = await db.select().from(problemsTable).orderBy(desc(problemsTable.createdAt));
    res.json(problems);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch problems" });
  }
});

router.post("/problems", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { title, description, category, priority, anonymous } = req.body;
    if (!title || !description) return res.status(400).json({ error: "title and description required" });
    const [problem] = await db.insert(problemsTable).values({
      title,
      description,
      category: category || "Academic",
      priority: priority || "medium",
      anonymous: !!anonymous,
      status: "submitted",
      submittedBy: user.id,
      submittedByName: anonymous ? "Anonymous" : user.fullName,
      jnvName: user.jnvName,
      jnvState: user.jnvState,
    }).returning();
    res.json(problem);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to submit problem" });
  }
});

router.get("/problems/:id", requireAuth, async (req, res) => {
  try {
    const [problem] = await db.select().from(problemsTable).where(eq(problemsTable.id, req.params.id as string)).limit(1);
    if (!problem) return res.status(404).json({ error: "Not found" });
    const comments = await db.select().from(problemCommentsTable)
      .where(eq(problemCommentsTable.problemId, req.params.id as string))
      .orderBy(asc(problemCommentsTable.createdAt));
    res.json({ ...problem, comments });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch problem" });
  }
});

router.post("/problems/:id/comments", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "text required" });
    const [comment] = await db.insert(problemCommentsTable).values({
      problemId: req.params.id as string,
      text: text.trim(),
      authorId: user.id,
      authorName: user.fullName,
      role: user.role,
    }).returning();
    res.json(comment);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to add comment" });
  }
});

router.patch("/problems/:id/status", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { status } = req.body;
    const [problem] = await db.update(problemsTable)
      .set({ status })
      .where(eq(problemsTable.id, req.params.id as string))
      .returning();
    res.json(problem);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update status" });
  }
});

export default router;
