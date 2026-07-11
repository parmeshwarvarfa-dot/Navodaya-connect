import { Router } from "express";
import { db, studentQueriesTable, queryAnswersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/student-queries", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db.select().from(studentQueriesTable)
      .where(eq(studentQueriesTable.jnvName, user.jnvName))
      .orderBy(desc(studentQueriesTable.createdAt));
    const withAnswers = await Promise.all(rows.map(async (q) => {
      const answers = await db.select().from(queryAnswersTable)
        .where(eq(queryAnswersTable.queryId, q.id))
        .orderBy(queryAnswersTable.createdAt);
      return { ...q, answers };
    }));
    res.json(withAnswers);
  } catch (e) {
    req.log.error(e, "student queries error");
    res.status(500).json({ error: "Failed to fetch queries" });
  }
});

router.post("/student-queries", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { question, subject, category } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: "Question required" });
    const [row] = await db.insert(studentQueriesTable).values({
      question: question.trim(),
      subject: subject?.trim() || "General",
      category: category || "Academics",
      studentId: user.id,
      studentName: user.fullName,
      studentClass: user.class,
      jnvName: user.jnvName,
      solved: false,
    }).returning();
    res.json({ ...row, answers: [] });
  } catch (e) {
    res.status(500).json({ error: "Failed to post query" });
  }
});

router.post("/student-queries/:id/answer", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official" && user.role !== "alumni") {
      return res.status(403).json({ error: "Only teachers/alumni can answer" });
    }
    const { answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ error: "Answer required" });
    const [ansRow] = await db.insert(queryAnswersTable).values({
      queryId: req.params.id as string,
      answer: answer.trim(),
      answeredById: user.id,
      answeredByName: user.fullName,
    }).returning();
    await db.update(studentQueriesTable)
      .set({ solved: true })
      .where(eq(studentQueriesTable.id, req.params.id as string));
    res.json(ansRow);
  } catch (e) {
    res.status(500).json({ error: "Failed to post answer" });
  }
});

export default router;
