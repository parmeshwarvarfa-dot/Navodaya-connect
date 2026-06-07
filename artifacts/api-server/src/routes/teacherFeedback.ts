import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, teacherFeedbackTable, usersTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.post("/teacher-feedback", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "student") return res.status(403).json({ error: "Students only" });
    const { teacherId, teacherName, subject, rating, comment, anonymous } = req.body;
    if (!teacherId || !teacherName || !rating || !comment) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    const [feedback] = await db.insert(teacherFeedbackTable).values({
      studentId: user.id,
      studentName: anonymous ? "Anonymous Student" : dbUser.fullName,
      teacherId,
      teacherName,
      jnvName: dbUser.jnvName,
      jnvState: dbUser.jnvState,
      subject: subject || null,
      rating: Number(rating),
      comment,
      anonymous: !!anonymous,
    }).returning();
    res.json(feedback);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

router.get("/teacher-feedback", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "official") return res.status(403).json({ error: "Officials only" });
    const feedbacks = await db.select().from(teacherFeedbackTable)
      .where(eq(teacherFeedbackTable.jnvName, user.jnvName))
      .orderBy(teacherFeedbackTable.createdAt);
    res.json(feedbacks);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch feedback" });
  }
});

export default router;
