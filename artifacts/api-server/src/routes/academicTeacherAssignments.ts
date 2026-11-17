import { Router } from "express";
import { and, asc, desc, eq, isNull, ne, or, sql } from "drizzle-orm";
import {
  db, jnvAcademicSettingsTable, teacherAssignmentAuditTable,
  teacherClassAssignmentsTable, usersTable,
} from "@workspace/db";
import { getUser, isRegisteredJnvOfficial, isVerifiedTeacher, requireAuth } from "../lib/auth";
import { makeJnvId } from "../lib/jnv-identity";

const router = Router();
const TYPES = ["class_teacher", "subject_teacher"] as const;
type AssignmentType = typeof TYPES[number];

class AssignmentError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function jnvIdOf(user: ReturnType<typeof getUser>) {
  return user.jnvId || makeJnvId(user.jnvState, user.jnvName);
}

function schoolScope(user: ReturnType<typeof getUser>) {
  return or(
    eq(usersTable.jnvId, jnvIdOf(user)),
    and(isNull(usersTable.jnvId), eq(usersTable.jnvName, user.jnvName), eq(usersTable.jnvState, user.jnvState)),
  )!;
}

function parsePlacement(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  const grade = normalized.match(/^(?:class\s*)?(\d{1,2})(?:\s|$)/i);
  if (!grade) return null;
  const section = /^(?:class\s*)?\d{1,2}$/i.test(normalized) ? null : normalized.match(/\s([A-Z]|\d{1,2})$/i);
  return { className: `Class ${Number(grade[1])}`, section: section?.[1]?.toUpperCase() ?? "Unspecified" };
}

function currentAcademicYear(now = new Date()) {
  const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return `${start}-${start + 1}`;
}

function validAcademicYear(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = value.match(/^(20\d{2})-(20\d{2})$/);
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1);
}

async function getAvailableSections(user: ReturnType<typeof getUser>) {
  const students = await db.select({ class: usersTable.class }).from(usersTable).where(and(
    schoolScope(user), eq(usersTable.role, "student"), eq(usersTable.verificationStatus, "verified"),
  ));
  const counts = new Map<string, number>();
  for (const student of students) {
    const placement = parsePlacement(student.class);
    if (!placement) continue;
    const key = `${placement.className}\u0000${placement.section}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].map(([key, students]) => {
    const [className, section] = key.split("\u0000");
    return { className: className!, section: section!, students };
  }).sort((a, b) => a.className.localeCompare(b.className, undefined, { numeric: true }) || a.section.localeCompare(b.section));
}

function snapshot(row: typeof teacherClassAssignmentsTable.$inferSelect) {
  return {
    assignmentType: row.assignmentType,
    teacherId: row.teacherId,
    teacherName: row.teacherName,
    className: row.className,
    section: row.section,
    subject: row.subject,
    academicYear: row.academicYear,
    periodsPerWeek: row.periodsPerWeek,
    active: row.active,
  };
}

function readPayload(body: any) {
  const assignmentType = body?.assignmentType as AssignmentType;
  const academicYear = body?.academicYear;
  const teacherId = body?.teacherId;
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  const selections = body?.selections;
  if (!TYPES.includes(assignmentType) || !validAcademicYear(academicYear)
    || typeof teacherId !== "string" || !/^[0-9a-f-]{36}$/i.test(teacherId)) {
    throw new AssignmentError("Select an assignment type, academic year, and approved teacher.");
  }
  if (assignmentType === "subject_teacher" && (!subject || subject.length > 120)) {
    throw new AssignmentError("Enter a valid subject.");
  }
  if (!Array.isArray(selections) || selections.length < 1 || selections.length > 60) {
    throw new AssignmentError("Select between 1 and 60 class sections.");
  }
  const normalized = selections.map((item: any) => {
    const className = typeof item?.className === "string" ? item.className.trim() : "";
    const rawSection = typeof item?.section === "string" ? item.section.trim() : "";
    const section = rawSection.toLowerCase() === "unspecified" ? "Unspecified" : rawSection.toUpperCase();
    const periodsPerWeek = item?.periodsPerWeek == null || item.periodsPerWeek === "" ? null : Number(item.periodsPerWeek);
    if (!/^Class\s\d{1,2}$/.test(className) || !(section === "Unspecified" || /^[A-Z0-9]{1,10}$/.test(section))
      || (periodsPerWeek !== null && (!Number.isInteger(periodsPerWeek) || periodsPerWeek < 1 || periodsPerWeek > 60))) {
      throw new AssignmentError("Each selection needs a valid class, section, and optional weekly period count.");
    }
    return { className, section, periodsPerWeek };
  });
  const keys = normalized.map((item: any) => `${item.className}\u0000${item.section}`);
  if (new Set(keys).size !== keys.length) throw new AssignmentError("A class section was selected more than once.");
  return { assignmentType, academicYear, teacherId, subject: assignmentType === "class_teacher" ? "" : subject, selections: normalized };
}

async function lockSettings(tx: any, official: ReturnType<typeof getUser>) {
  const jnvId = jnvIdOf(official);
  await tx.insert(jnvAcademicSettingsTable).values({ jnvId, jnvName: official.jnvName, jnvState: official.jnvState })
    .onConflictDoNothing();
  const [settings] = await tx.select().from(jnvAcademicSettingsTable).where(eq(jnvAcademicSettingsTable.jnvId, jnvId)).for("update");
  return settings;
}

async function verifyTeacher(tx: any, official: ReturnType<typeof getUser>, teacherId: string) {
  const [teacher] = await tx.select().from(usersTable).where(and(
    eq(usersTable.id, teacherId), eq(usersTable.role, "teacher"), eq(usersTable.verificationStatus, "verified"),
  )).limit(1);
  if (!teacher || (teacher.jnvId || makeJnvId(teacher.jnvState, teacher.jnvName)) !== jnvIdOf(official)) {
    throw new AssignmentError("The approved teacher was not found in your authorized JNV.", 404);
  }
  return teacher;
}

async function validateSelections(user: ReturnType<typeof getUser>, selections: Array<{ className: string; section: string }>) {
  const available = new Set((await getAvailableSections(user)).map((item) => `${item.className}\u0000${item.section}`));
  if (selections.some((item) => !available.has(`${item.className}\u0000${item.section}`))) {
    throw new AssignmentError("One or more class sections are not present in verified student records for this JNV.", 404);
  }
}

async function enforceSlotPolicy(tx: any, official: ReturnType<typeof getUser>, settings: any, data: {
  id?: string; assignmentType: AssignmentType; academicYear: string; className: string; section: string; subject: string;
}) {
  const base = [
    eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(official)),
    eq(teacherClassAssignmentsTable.academicYear, data.academicYear),
    eq(teacherClassAssignmentsTable.className, data.className),
    eq(teacherClassAssignmentsTable.section, data.section),
    eq(teacherClassAssignmentsTable.assignmentType, data.assignmentType),
    eq(teacherClassAssignmentsTable.active, true),
  ];
  if (data.id) base.push(ne(teacherClassAssignmentsTable.id, data.id));
  if (data.assignmentType === "class_teacher") {
    const [existing] = await tx.select({ id: teacherClassAssignmentsTable.id }).from(teacherClassAssignmentsTable).where(and(...base)).limit(1);
    if (existing) throw new AssignmentError("This section already has a primary class teacher for that academic year.", 409);
  } else {
    const subjectConditions = [...base, eq(teacherClassAssignmentsTable.subject, data.subject)];
    const [existing] = await tx.select({ id: teacherClassAssignmentsTable.id, teacherId: teacherClassAssignmentsTable.teacherId })
      .from(teacherClassAssignmentsTable).where(and(...subjectConditions)).limit(1);
    if (existing && !settings.allowMultipleSubjectTeachers) {
      throw new AssignmentError("This class section already has a teacher for that subject. School settings do not allow multiple teachers.", 409);
    }
  }
}

router.get("/academic-teacher-assignments/overview", requireAuth, async (req, res) => {
  try {
    const official = getUser(req);
    if (!isRegisteredJnvOfficial(official)) return res.status(403).json({ error: "A registered JNV Official account is required." });
    const academicYear = typeof req.query.academicYear === "string" ? req.query.academicYear : currentAcademicYear();
    if (!validAcademicYear(academicYear)) return res.status(400).json({ error: "Academic year must use YYYY-YYYY format." });
    const jnvId = jnvIdOf(official);
    const [teachers, classSections, assignments, history, years, settingsRows] = await Promise.all([
      db.select({ id: usersTable.id, fullName: usersTable.fullName, subject: usersTable.subject })
        .from(usersTable).where(and(schoolScope(official), eq(usersTable.role, "teacher"), eq(usersTable.verificationStatus, "verified")))
        .orderBy(asc(usersTable.fullName)),
      getAvailableSections(official),
      db.select().from(teacherClassAssignmentsTable)
        .where(and(eq(teacherClassAssignmentsTable.jnvId, jnvId), eq(teacherClassAssignmentsTable.academicYear, academicYear)))
        .orderBy(asc(teacherClassAssignmentsTable.className), asc(teacherClassAssignmentsTable.section), asc(teacherClassAssignmentsTable.assignmentType)),
      db.select({
        id: teacherAssignmentAuditTable.id,
        assignmentId: teacherAssignmentAuditTable.assignmentId,
        actorName: teacherAssignmentAuditTable.actorName,
        actorId: teacherAssignmentAuditTable.actorId,
        action: teacherAssignmentAuditTable.action,
        academicYear: teacherAssignmentAuditTable.academicYear,
        previousData: teacherAssignmentAuditTable.previousData,
        newData: teacherAssignmentAuditTable.newData,
        createdAt: teacherAssignmentAuditTable.createdAt,
      }).from(teacherAssignmentAuditTable).where(and(
        eq(teacherAssignmentAuditTable.jnvId, jnvId), eq(teacherAssignmentAuditTable.academicYear, academicYear),
      )).orderBy(desc(teacherAssignmentAuditTable.createdAt)),
      db.select({ academicYear: teacherClassAssignmentsTable.academicYear }).from(teacherClassAssignmentsTable)
        .where(eq(teacherClassAssignmentsTable.jnvId, jnvId)).groupBy(teacherClassAssignmentsTable.academicYear)
        .orderBy(desc(teacherClassAssignmentsTable.academicYear)),
      db.select().from(jnvAcademicSettingsTable).where(eq(jnvAcademicSettingsTable.jnvId, jnvId)).limit(1),
    ]);
    const active = assignments.filter((row) => row.active);
    const workloadMap = new Map<string, { teacherId: string; teacherName: string; classes: Set<string>; subjects: Set<string>; periodsPerWeek: number }>();
    for (const row of active) {
      const workload = workloadMap.get(row.teacherId) ?? { teacherId: row.teacherId, teacherName: row.teacherName, classes: new Set<string>(), subjects: new Set<string>(), periodsPerWeek: 0 };
      workload.classes.add(`${row.className} ${row.section}`);
      if (row.assignmentType === "subject_teacher" && row.subject) {
        workload.subjects.add(row.subject);
        workload.periodsPerWeek += row.periodsPerWeek ?? 0;
      }
      workloadMap.set(row.teacherId, workload);
    }
    const [settings] = settingsRows;
    return res.json({
      academicYear,
      academicYears: [...new Set([currentAcademicYear(), ...years.map((row) => row.academicYear)])].sort((a, b) => b.localeCompare(a)),
      teachers,
      classSections,
      assignments,
      history,
      settings: { allowMultipleSubjectTeachers: settings?.allowMultipleSubjectTeachers ?? false },
      summary: {
        classTeacherAssignments: active.filter((row) => row.assignmentType === "class_teacher").length,
        subjectTeacherAssignments: active.filter((row) => row.assignmentType === "subject_teacher").length,
        teachersAssigned: workloadMap.size,
        classSections: classSections.length,
        configuredPeriodsPerWeek: active.reduce((sum, row) => sum + (row.assignmentType === "subject_teacher" ? row.periodsPerWeek ?? 0 : 0), 0),
        workloads: [...workloadMap.values()].map((item) => ({ teacherId: item.teacherId, teacherName: item.teacherName, classes: item.classes.size, subjects: item.subjects.size, periodsPerWeek: item.periodsPerWeek })),
        timetableAvailable: false,
      },
    });
  } catch (error) {
    req.log.error(error, "academic teacher assignment overview failed");
    return res.status(500).json({ error: "Could not load teacher assignments for this JNV." });
  }
});

router.post("/academic-teacher-assignments/bulk", requireAuth, async (req, res) => {
  try {
    const official = getUser(req);
    if (!isRegisteredJnvOfficial(official)) return res.status(403).json({ error: "A registered JNV Official account is required." });
    const payload = readPayload(req.body);
    await validateSelections(official, payload.selections);
    const created = await db.transaction(async (tx) => {
      const teacher = await verifyTeacher(tx, official, payload.teacherId);
      const settings = await lockSettings(tx, official);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${jnvIdOf(official)}), hashtext(${payload.academicYear}))`);
      const rows = [];
      for (const item of payload.selections) {
        const normalized = { ...item, assignmentType: payload.assignmentType, academicYear: payload.academicYear, subject: payload.subject };
        await enforceSlotPolicy(tx, official, settings, normalized);
        const [row] = await tx.insert(teacherClassAssignmentsTable).values({
          jnvId: jnvIdOf(official), jnvName: official.jnvName, jnvState: official.jnvState,
          teacherId: teacher.id, teacherName: teacher.fullName,
          className: item.className, section: item.section, assignmentType: payload.assignmentType,
          academicYear: payload.academicYear, subject: payload.subject,
          periodsPerWeek: payload.assignmentType === "subject_teacher" ? item.periodsPerWeek : null,
          assignedById: official.id, modifiedById: official.id,
        }).onConflictDoNothing().returning();
        if (!row) throw new AssignmentError("A duplicate or conflicting teacher assignment already exists.", 409);
        rows.push(row);
        await tx.insert(teacherAssignmentAuditTable).values({
          assignmentId: row.id, jnvId: row.jnvId, jnvName: row.jnvName, jnvState: row.jnvState,
          actorId: official.id, actorName: official.fullName, action: "created", academicYear: row.academicYear,
          newData: snapshot(row),
        });
      }
      return rows;
    });
    return res.status(201).json({ assignments: created });
  } catch (error) {
    if (error instanceof AssignmentError) return res.status(error.status).json({ error: error.message });
    req.log.error(error, "bulk teacher assignment creation failed");
    return res.status(500).json({ error: "Could not save teacher assignments." });
  }
});

router.patch("/academic-teacher-assignments/settings", requireAuth, async (req, res) => {
  try {
    const official = getUser(req);
    if (!isRegisteredJnvOfficial(official)) return res.status(403).json({ error: "A registered JNV Official account is required." });
    if (typeof req.body?.allowMultipleSubjectTeachers !== "boolean") return res.status(400).json({ error: "Choose whether multiple teachers may share a subject section." });
    const [settings] = await db.insert(jnvAcademicSettingsTable).values({
      jnvId: jnvIdOf(official), jnvName: official.jnvName, jnvState: official.jnvState,
      allowMultipleSubjectTeachers: req.body.allowMultipleSubjectTeachers, updatedById: official.id,
    }).onConflictDoUpdate({
      target: jnvAcademicSettingsTable.jnvId,
      set: { allowMultipleSubjectTeachers: req.body.allowMultipleSubjectTeachers, updatedById: official.id, updatedAt: new Date() },
    }).returning();
    return res.json({ allowMultipleSubjectTeachers: settings!.allowMultipleSubjectTeachers });
  } catch (error) {
    req.log.error(error, "academic assignment settings update failed");
    return res.status(500).json({ error: "Could not update academic assignment settings." });
  }
});

router.patch("/academic-teacher-assignments/:id", requireAuth, async (req, res) => {
  try {
    const official = getUser(req);
    if (!isRegisteredJnvOfficial(official)) return res.status(403).json({ error: "A registered JNV Official account is required." });
    const payload = readPayload({ ...req.body, selections: [req.body?.selection] });
    await validateSelections(official, payload.selections);
    const selection = payload.selections[0]!;
    const result = await db.transaction(async (tx) => {
      const settings = await lockSettings(tx, official);
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${jnvIdOf(official)}), hashtext(${payload.academicYear}))`);
      const [current] = await tx.select().from(teacherClassAssignmentsTable).where(and(
        eq(teacherClassAssignmentsTable.id, req.params.id as string),
        eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(official)),
        eq(teacherClassAssignmentsTable.active, true),
      )).limit(1);
      if (!current) throw new AssignmentError("Active assignment not found in this JNV.", 404);
      const teacher = await verifyTeacher(tx, official, payload.teacherId);
      const next = { ...selection, assignmentType: payload.assignmentType, academicYear: payload.academicYear, subject: payload.subject, id: current.id };
      await enforceSlotPolicy(tx, official, settings, next);
      const [updated] = await tx.update(teacherClassAssignmentsTable).set({
        teacherId: teacher.id, teacherName: teacher.fullName,
        assignmentType: payload.assignmentType, academicYear: payload.academicYear,
        className: selection.className, section: selection.section, subject: payload.subject,
        periodsPerWeek: payload.assignmentType === "subject_teacher" ? selection.periodsPerWeek : null,
        modifiedById: official.id, updatedAt: new Date(),
      }).where(and(eq(teacherClassAssignmentsTable.id, current.id), eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(official)))).returning();
      if (!updated) throw new AssignmentError("Assignment was not found.", 404);
      await tx.insert(teacherAssignmentAuditTable).values({
        assignmentId: updated.id, jnvId: updated.jnvId, jnvName: updated.jnvName, jnvState: updated.jnvState,
        actorId: official.id, actorName: official.fullName, action: "updated", academicYear: updated.academicYear,
        previousData: snapshot(current), newData: snapshot(updated),
      });
      return updated;
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AssignmentError) return res.status(error.status).json({ error: error.message });
    req.log.error(error, "teacher assignment update failed");
    return res.status(500).json({ error: "Could not update this teacher assignment." });
  }
});

router.delete("/academic-teacher-assignments/:id", requireAuth, async (req, res) => {
  try {
    const official = getUser(req);
    if (!isRegisteredJnvOfficial(official)) return res.status(403).json({ error: "A registered JNV Official account is required." });
    const result = await db.transaction(async (tx) => {
      const [current] = await tx.select().from(teacherClassAssignmentsTable).where(and(
        eq(teacherClassAssignmentsTable.id, req.params.id as string),
        eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(official)),
        eq(teacherClassAssignmentsTable.active, true),
      )).limit(1);
      if (!current) throw new AssignmentError("Active assignment not found in this JNV.", 404);
      const [removed] = await tx.update(teacherClassAssignmentsTable).set({
        active: false, revokedAt: new Date(), revokedById: official.id, modifiedById: official.id, updatedAt: new Date(),
      }).where(and(eq(teacherClassAssignmentsTable.id, current.id), eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(official)))).returning();
      if (!removed) throw new AssignmentError("Assignment was not found.", 404);
      await tx.insert(teacherAssignmentAuditTable).values({
        assignmentId: removed.id, jnvId: removed.jnvId, jnvName: removed.jnvName, jnvState: removed.jnvState,
        actorId: official.id, actorName: official.fullName, action: "removed", academicYear: current.academicYear,
        previousData: snapshot(current), newData: snapshot(removed),
      });
      return { id: removed.id, active: false };
    });
    return res.json(result);
  } catch (error) {
    if (error instanceof AssignmentError) return res.status(error.status).json({ error: error.message });
    req.log.error(error, "teacher assignment removal failed");
    return res.status(500).json({ error: "Could not remove this teacher assignment." });
  }
});

router.get("/teacher/academic-assignments", requireAuth, async (req, res) => {
  try {
    const teacher = getUser(req);
    if (!isVerifiedTeacher(teacher)) return res.status(403).json({ error: "Verified teacher access is required." });
    const conditions = [eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(teacher)), eq(teacherClassAssignmentsTable.teacherId, teacher.id), eq(teacherClassAssignmentsTable.active, true)];
    if (typeof req.query.academicYear === "string") {
      if (!validAcademicYear(req.query.academicYear)) return res.status(400).json({ error: "Academic year must use YYYY-YYYY format." });
      conditions.push(eq(teacherClassAssignmentsTable.academicYear, req.query.academicYear));
    }
    const assignments = await db.select().from(teacherClassAssignmentsTable).where(and(...conditions))
      .orderBy(asc(teacherClassAssignmentsTable.className), asc(teacherClassAssignmentsTable.section), asc(teacherClassAssignmentsTable.assignmentType));
    return res.json({ assignments });
  } catch (error) {
    req.log.error(error, "teacher self-assignment lookup failed");
    return res.status(500).json({ error: "Could not load your teaching assignments." });
  }
});

export default router;
