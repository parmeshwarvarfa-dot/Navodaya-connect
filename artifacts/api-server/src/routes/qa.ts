import { Router } from "express";
import { db, qaQuestionsTable, qaAnswersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq } from "drizzle-orm";

const router = Router();

router.get("/qa", requireAuth, async (req, res) => {
  try {
    const questions = await db.select().from(qaQuestionsTable)
      .orderBy(desc(qaQuestionsTable.createdAt));
    const withAnswers = await Promise.all(questions.map(async (q) => {
      const answers = await db.select().from(qaAnswersTable)
        .where(eq(qaAnswersTable.questionId, q.id))
        .orderBy(qaAnswersTable.createdAt);
      return { ...q, answers };
    }));
    res.json(withAnswers);
  } catch (e) {
    req.log.error(e, "qa list error");
    res.status(500).json({ error: "Failed to fetch Q&A" });
  }
});

router.post("/qa", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { question, category } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: "Question required" });
    const [row] = await db.insert(qaQuestionsTable).values({
      question: question.trim(),
      category: category || "Career",
      askedById: user.id,
      askedByName: user.fullName,
      askedByClass: user.class,
      jnvName: user.jnvName,
    }).returning();
    res.json({ ...row, answers: [] });
  } catch (e) {
    res.status(500).json({ error: "Failed to post question" });
  }
});

router.post("/qa/:id/answer", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.verificationStatus !== "verified" && user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only verified alumni/teachers can answer" });
    }
    const { answer } = req.body;
    if (!answer?.trim()) return res.status(400).json({ error: "Answer required" });
    const [row] = await db.insert(qaAnswersTable).values({
      questionId: req.params.id as string,
      answer: answer.trim(),
      answeredById: user.id,
      answeredByName: user.fullName,
      answeredByRole: user.role,
      batch: user.passoutYear,
      subject: user.subject,
    }).returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to post answer" });
  }
});

export default router;
