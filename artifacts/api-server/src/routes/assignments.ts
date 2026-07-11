import { Router } from "express";
import { db, assignmentsTable, assignmentSubmissionsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq, and } from "drizzle-orm";

const router = Router();

router.get("/assignments", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db.select().from(assignmentsTable)
      .where(eq(assignmentsTable.jnvName, user.jnvName))
      .orderBy(desc(assignmentsTable.createdAt));
    const withSubs = await Promise.all(rows.map(async (a) => {
      const subs = await db.select().from(assignmentSubmissionsTable)
        .where(eq(assignmentSubmissionsTable.assignmentId, a.id));
      return { ...a, submissions: subs };
    }));
    res.json(withSubs);
  } catch (e) {
    req.log.error(e, "assignments list error");
    res.status(500).json({ error: "Failed to fetch assignments" });
  }
});

router.post("/assignments", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only teachers can create assignments" });
    }
    const { title, subject, targetClass, dueDate, description } = req.body;
    if (!title?.trim() || !subject?.trim() || !targetClass?.trim() || !dueDate?.trim()) {
      return res.status(400).json({ error: "All fields are required" });
    }
    const [row] = await db.insert(assignmentsTable).values({
      title: title.trim(),
      subject: subject.trim(),
      targetClass: targetClass.trim(),
      dueDate: dueDate.trim(),
      description: description?.trim(),
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
    }).returning();
    res.json({ ...row, submissions: [] });
  } catch (e) {
    req.log.error(e, "assignment create error");
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

router.post("/assignments/:id/submit", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { note } = req.body;
    const existing = await db.select().from(assignmentSubmissionsTable)
      .where(and(
        eq(assignmentSubmissionsTable.assignmentId, req.params.id as string),
        eq(assignmentSubmissionsTable.studentId, user.id),
      ));
    if (existing.length > 0) {
      return res.status(400).json({ error: "Already submitted" });
    }
    const [row] = await db.insert(assignmentSubmissionsTable).values({
      assignmentId: req.params.id as string,
      studentId: user.id,
      studentName: user.fullName,
      note: note?.trim(),
      status: "submitted",
    }).returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to submit" });
  }
});

router.patch("/assignments/:id/submissions/:subId/review", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const { remarks } = req.body;
    const [row] = await db.update(assignmentSubmissionsTable)
      .set({ status: "reviewed", remarks: remarks?.trim(), reviewedAt: new Date() })
      .where(eq(assignmentSubmissionsTable.id, req.params.subId as string))
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to review" });
  }
});

export default router;
