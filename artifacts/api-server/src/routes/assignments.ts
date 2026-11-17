import { Router } from "express";
import { db, assignmentsTable, assignmentSubmissionsTable, teacherClassAssignmentsTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, isAuthorizedSchoolStaff, requireAuth } from "../lib/auth";
import { makeJnvId } from "../lib/jnv-identity";
import { desc, eq, and, isNull, or } from "drizzle-orm";

const router = Router();

function parseDueAt(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return Number.NaN;
  if (/\b\d{1,2}:\d{2}\b|\b(?:am|pm)\b|T\d{2}:\d{2}/i.test(value)) return timestamp;
  const endOfDueDate = new Date(timestamp);
  endOfDueDate.setHours(23, 59, 59, 999);
  return endOfDueDate.getTime();
}

function schoolScope(user: ReturnType<typeof getUser>) {
  const jnvId = user.jnvId || makeJnvId(user.jnvState, user.jnvName);
  return or(
    eq(assignmentsTable.jnvId, jnvId),
    and(isNull(assignmentsTable.jnvId), eq(assignmentsTable.jnvName, user.jnvName), eq(assignmentsTable.jnvState, user.jnvState)),
  );
}

router.get("/assignments", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const jnvId = user.jnvId || makeJnvId(user.jnvState, user.jnvName);
    if (user.role === "official" && !await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access is required" });
    const canReview = await isAuthorizedSchoolStaff(user);
    if (!canReview && user.role !== "student") return res.status(403).json({ error: "Assignment access is unavailable for this account" });
    const rows = await db.select().from(assignmentsTable)
      .where(schoolScope(user))
      .orderBy(desc(assignmentsTable.createdAt));
    const classAssignments = user.role === "teacher"
      ? await db.select({ className: teacherClassAssignmentsTable.className, subject: teacherClassAssignmentsTable.subject })
        .from(teacherClassAssignmentsTable)
        .where(and(
          eq(teacherClassAssignmentsTable.teacherId, user.id),
          eq(teacherClassAssignmentsTable.jnvId, jnvId),
          eq(teacherClassAssignmentsTable.active, true),
        ))
      : [];
    const visibleAssignments = canReview
      ? rows.filter((assignment) => user.role === "official"
        || classAssignments.some((assigned) => assigned.className === assignment.targetClass && assigned.subject === assignment.subject))
      : rows.filter((assignment) => assignment.targetClass === user.class);
    const withSubs = await Promise.all(visibleAssignments.map(async (a) => {
      const subs = await db.select().from(assignmentSubmissionsTable)
        .where(canReview
          ? eq(assignmentSubmissionsTable.assignmentId, a.id)
          : and(eq(assignmentSubmissionsTable.assignmentId, a.id), eq(assignmentSubmissionsTable.studentId, user.id)));
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
    const user = getUser(req);
    const jnvId = user.jnvId || makeJnvId(user.jnvState, user.jnvName);
    if (!await isAuthorizedSchoolStaff(user)) return res.status(403).json({ error: "Verified school staff access is required" });
    if (user.role === "official" && !await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access is required" });
    const { title, subject, targetClass, dueDate, description } = req.body ?? {};
    if ([title, subject, targetClass, dueDate].some((value) => typeof value !== "string" || !value.trim()) ||
        title.length > 160 || subject.length > 100 || targetClass.length > 100 || dueDate.length > 80 ||
        (description !== undefined && (typeof description !== "string" || description.length > 5000))) {
      return res.status(400).json({ error: "All fields are required" });
    }
    if (!Number.isFinite(parseDueAt(dueDate.trim()))) return res.status(400).json({ error: "Enter a valid assignment due date" });
    if (user.role === "teacher") {
      const [authorizedClass] = await db.select({ id: teacherClassAssignmentsTable.id }).from(teacherClassAssignmentsTable).where(and(
        eq(teacherClassAssignmentsTable.teacherId, user.id),
        eq(teacherClassAssignmentsTable.jnvId, jnvId),
        eq(teacherClassAssignmentsTable.className, targetClass.trim()),
        eq(teacherClassAssignmentsTable.subject, subject.trim()),
        eq(teacherClassAssignmentsTable.active, true),
      )).limit(1);
      if (!authorizedClass) return res.status(403).json({ error: "You are not assigned to this class and subject" });
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
      jnvId,
      jnvState: user.jnvState,
    }).returning();
    res.json({ ...row, submissions: [] });
  } catch (e) {
    req.log.error(e, "assignment create error");
    res.status(500).json({ error: "Failed to create assignment" });
  }
});

router.post("/assignments/:id/submit", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "student") return res.status(403).json({ error: "Only students can submit this assignment" });
    const { note } = req.body ?? {};
    if (note !== undefined && (typeof note !== "string" || note.length > 1000)) return res.status(400).json({ error: "Submission note is too long or invalid" });
    const [assignment] = await db.select().from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, req.params.id as string), schoolScope(user)))
      .limit(1);
    if (!assignment || assignment.targetClass !== user.class) return res.status(404).json({ error: "Assignment not found" });
    const dueAt = parseDueAt(assignment.dueDate);
    if (Number.isFinite(dueAt) && Date.now() > dueAt) return res.status(403).json({ error: "The assignment submission deadline has passed" });
    const submitted = await db.transaction(async (tx) => {
      await tx.select({ id: assignmentsTable.id }).from(assignmentsTable)
        .where(eq(assignmentsTable.id, assignment.id)).for("update");
      const [existing] = await tx.select({ id: assignmentSubmissionsTable.id }).from(assignmentSubmissionsTable)
        .where(and(eq(assignmentSubmissionsTable.assignmentId, assignment.id), eq(assignmentSubmissionsTable.studentId, user.id)))
        .limit(1);
      if (existing) return { duplicate: true as const };
      const [row] = await tx.insert(assignmentSubmissionsTable).values({
        assignmentId: assignment.id,
        studentId: user.id,
        studentName: user.fullName,
        note: note?.trim(),
        status: "submitted",
      }).returning();
      return { duplicate: false as const, row };
    });
    if (submitted.duplicate) return res.status(409).json({ error: "Already submitted" });
    return res.json(submitted.row);
  } catch (e) {
    res.status(500).json({ error: "Failed to submit" });
  }
});

router.patch("/assignments/:id/submissions/:subId/review", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!await isAuthorizedSchoolStaff(user)) return res.status(403).json({ error: "Verified school staff access is required" });
    if (user.role === "official" && !await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access is required" });
    const [submission] = await db.select().from(assignmentSubmissionsTable)
      .where(and(eq(assignmentSubmissionsTable.id, req.params.subId as string), eq(assignmentSubmissionsTable.assignmentId, req.params.id as string)))
      .limit(1);
    if (!submission) return res.status(404).json({ error: "Submission not found" });
    const [assignment] = await db.select().from(assignmentsTable)
      .where(and(eq(assignmentsTable.id, submission.assignmentId), schoolScope(user)))
      .limit(1);
    if (!assignment) return res.status(404).json({ error: "Assignment not found" });
    if (user.role === "teacher") {
      const jnvId = user.jnvId || makeJnvId(user.jnvState, user.jnvName);
      const [authorizedClass] = await db.select({ id: teacherClassAssignmentsTable.id }).from(teacherClassAssignmentsTable).where(and(
        eq(teacherClassAssignmentsTable.teacherId, user.id),
        eq(teacherClassAssignmentsTable.jnvId, jnvId),
        eq(teacherClassAssignmentsTable.className, assignment.targetClass),
        eq(teacherClassAssignmentsTable.subject, assignment.subject),
        eq(teacherClassAssignmentsTable.active, true),
      )).limit(1);
      if (!authorizedClass) return res.status(403).json({ error: "You are not assigned to this class and subject" });
    }
    const { remarks } = req.body ?? {};
    if (remarks !== undefined && (typeof remarks !== "string" || remarks.length > 1000)) return res.status(400).json({ error: "Review remarks are too long or invalid" });
    const [row] = await db.update(assignmentSubmissionsTable)
      .set({ status: "reviewed", remarks: remarks?.trim(), reviewedAt: new Date() })
      .where(and(eq(assignmentSubmissionsTable.id, submission.id), eq(assignmentSubmissionsTable.assignmentId, assignment.id)))
      .returning();
    if (!row) return res.status(404).json({ error: "Submission not found" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to review" });
  }
});

export default router;
