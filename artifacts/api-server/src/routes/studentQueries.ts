import { Router } from "express";
import { db, studentQueriesTable, queryAnswersTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, isCommunityVerifiedAlumni, isVerifiedTeacher, requireAuth } from "../lib/auth";
import { and, desc, eq } from "drizzle-orm";

const router = Router();

router.get("/student-queries", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const canAnswer = isCommunityVerifiedAlumni(user) || isVerifiedTeacher(user) || await isAuthorizedJnvOfficial(user);
    if (user.role !== "student" && !canAnswer) return res.status(403).json({ error: "Student query access is unavailable for this account" });
    const schoolScope = eq(studentQueriesTable.jnvName, user.jnvName);
    const rows = await db.select().from(studentQueriesTable)
      .where(user.role === "student"
        ? and(schoolScope, eq(studentQueriesTable.studentId, user.id))
        : schoolScope)
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
    const user = getUser(req);
    if (user.role !== "student") return res.status(403).json({ error: "Only students can create student queries" });
    const { question, subject, category } = req.body ?? {};
    if (typeof question !== "string" || !question.trim() || question.length > 4000 || (subject !== undefined && (typeof subject !== "string" || subject.length > 100)) || (category !== undefined && (typeof category !== "string" || category.length > 80))) return res.status(400).json({ error: "Provide a question of 1 to 4,000 characters" });
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
    const user = getUser(req);
    const canAnswer = isCommunityVerifiedAlumni(user) || isVerifiedTeacher(user) || await isAuthorizedJnvOfficial(user);
    if (!canAnswer) {
      return res.status(403).json({ error: "Only teachers/alumni can answer" });
    }
    const [query] = await db.select().from(studentQueriesTable).where(and(
      eq(studentQueriesTable.id, req.params.id as string),
      eq(studentQueriesTable.jnvName, user.jnvName),
    )).limit(1);
    if (!query) return res.status(404).json({ error: "Student query not found" });
    const { answer } = req.body ?? {};
    if (typeof answer !== "string" || !answer.trim() || answer.length > 4000) return res.status(400).json({ error: "Provide an answer of 1 to 4,000 characters" });
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
