import { Router } from "express";
import { db, qaQuestionsTable, qaAnswersTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, isCommunityVerifiedAlumni, isVerifiedTeacher, requireAuth } from "../lib/auth";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

router.get("/qa", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const questions = await db.select().from(qaQuestionsTable)
      .where(eq(qaQuestionsTable.jnvName, user.jnvName))
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
    const user = getUser(req);
    const { question, category } = req.body ?? {};
    if (typeof question !== "string" || !question.trim() || question.length > 4000 || (category !== undefined && (typeof category !== "string" || category.length > 80))) return res.status(400).json({ error: "Provide a question of 1 to 4,000 characters" });
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
    const user = getUser(req);
    const canAnswer = isCommunityVerifiedAlumni(user) || isVerifiedTeacher(user) || await isAuthorizedJnvOfficial(user);
    if (!canAnswer) {
      return res.status(403).json({ error: "Only verified alumni/teachers can answer" });
    }
    const [questionRow] = await db.select().from(qaQuestionsTable).where(and(
      eq(qaQuestionsTable.id, req.params.id as string),
      eq(qaQuestionsTable.jnvName, user.jnvName),
    )).limit(1);
    if (!questionRow) return res.status(404).json({ error: "Question not found" });
    const { answer } = req.body ?? {};
    if (typeof answer !== "string" || !answer.trim() || answer.length > 4000) return res.status(400).json({ error: "Provide an answer of 1 to 4,000 characters" });
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
