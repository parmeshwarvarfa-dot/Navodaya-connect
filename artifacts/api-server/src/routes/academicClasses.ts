import { Router } from "express";
import { and, desc, eq, isNull, or } from "drizzle-orm";
import {
  announcementsTable,
  assignmentsTable,
  assignmentSubmissionsTable,
  db,
  studyMaterialsTable,
  teacherClassAssignmentsTable,
  usersTable,
} from "@workspace/db";
import { getUser, isRegisteredJnvOfficial, isVerifiedTeacher, requireAuth } from "../lib/auth";
import { makeJnvId } from "../lib/jnv-identity";
import { academicStore } from "../lib/academicStore";

const router = Router();

function jnvIdOf(user: ReturnType<typeof getUser>) {
  return user.jnvId || makeJnvId(user.jnvState, user.jnvName);
}

function parseClassSection(value: string | null | undefined) {
  if (!value) return null;
  const normalized = value.trim();
  const grade = normalized.match(/^(?:class\s*)?(\d{1,2})(?:\s|$)/i);
  const section = /^(?:class\s*)?\d{1,2}$/i.test(normalized) ? null : normalized.match(/\s([A-Z]|\d{1,2})$/i);
  return grade ? { className: `Class ${Number(grade[1])}`, section: section?.[1]?.toUpperCase() ?? "Unspecified" } : null;
}

// ---------------------------------------------------------------------------
// 1. List Assigned Classes
// ---------------------------------------------------------------------------
router.get("/academic-classes", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const official = isRegisteredJnvOfficial(user);
    if (user.role === "official" && !official) return res.status(403).json({ error: "A registered JNV Official account is required" });
    if (!official && !isVerifiedTeacher(user) && user.role !== "student") {
      return res.status(403).json({ error: "Academic class access is unavailable for this account" });
    }
    const includeHistory = official && req.query.includeHistory === "true";
    const conditions = [eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user))];
    if (!includeHistory) conditions.push(eq(teacherClassAssignmentsTable.active, true));
    if (user.role === "teacher") conditions.push(eq(teacherClassAssignmentsTable.teacherId, user.id));
    if (user.role === "student") {
      if (!user.class) return res.json([]);
      const placement = parseClassSection(user.class);
      if (!placement) return res.json([]);
      conditions.push(eq(teacherClassAssignmentsTable.className, placement.className));
      conditions.push(eq(teacherClassAssignmentsTable.section, placement.section));
    }
    const rows = await db.select().from(teacherClassAssignmentsTable)
      .where(and(...conditions)).orderBy(teacherClassAssignmentsTable.className, teacherClassAssignmentsTable.subject);
    return res.json(rows);
  } catch (error) {
    req.log.error(error, "academic class assignment list failed");
    return res.status(500).json({ error: "Failed to load academic classes" });
  }
});

// ---------------------------------------------------------------------------
// 2. Teacher Aggregated Overview (Statistics Cards & Recent Activity)
// ---------------------------------------------------------------------------
router.get("/academic-classes/teacher-overview", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const official = isRegisteredJnvOfficial(user);
    if (!official && !isVerifiedTeacher(user)) {
      return res.status(403).json({ error: "Authorized teacher or official account required" });
    }

    const jnvId = jnvIdOf(user);
    const assignmentConditions = [
      eq(teacherClassAssignmentsTable.jnvId, jnvId),
      eq(teacherClassAssignmentsTable.active, true),
    ];
    if (user.role === "teacher") {
      assignmentConditions.push(eq(teacherClassAssignmentsTable.teacherId, user.id));
    }

    const teacherAssignments = await db.select().from(teacherClassAssignmentsTable).where(and(...assignmentConditions));

    // Get unique classes
    const uniqueClassSet = new Set(teacherAssignments.map((a) => `${a.className}__${a.section}`));

    // Fetch all school students matching these classes
    const schoolStudents = await db.select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      photoURL: usersTable.photoURL,
      class: usersTable.class,
    }).from(usersTable).where(and(
      eq(usersTable.role, "student"),
      or(
        eq(usersTable.jnvId, jnvId),
        and(isNull(usersTable.jnvId), eq(usersTable.jnvName, user.jnvName), eq(usersTable.jnvState, user.jnvState))
      )
    ));

    const enrolledStudents = schoolStudents.filter((student) => {
      const placement = parseClassSection(student.class);
      if (!placement) return false;
      return teacherAssignments.some((a) =>
        a.className === placement.className &&
        (a.section === "Unspecified" || placement.section === "Unspecified" || a.section === placement.section)
      );
    });

    const uniqueStudentIds = new Set(enrolledStudents.map((s) => s.id));

    // Fetch pending assignments (submitted but unreviewed)
    const schoolAssignments = await db.select().from(assignmentsTable).where(
      or(
        eq(assignmentsTable.jnvId, jnvId),
        and(isNull(assignmentsTable.jnvId), eq(assignmentsTable.jnvName, user.jnvName), eq(assignmentsTable.jnvState, user.jnvState))
      )
    ).orderBy(desc(assignmentsTable.createdAt));

    const assignedClassNames = new Set(teacherAssignments.map((a) => a.className));
    const teacherClassAssignmentsList = schoolAssignments.filter(
      (a) => user.role === "official" || assignedClassNames.has(a.targetClass) || a.authorId === user.id
    );

    let pendingSubmissionsCount = 0;
    const assignmentIds = teacherClassAssignmentsList.map((a) => a.id);

    if (assignmentIds.length > 0) {
      const submissions = await db.select().from(assignmentSubmissionsTable);
      const pendingSubs = submissions.filter(
        (s) => assignmentIds.includes(s.assignmentId) && s.status === "submitted"
      );
      pendingSubmissionsCount = pendingSubs.length;
    }

    // Upcoming tests count
    let upcomingTestsCount = 0;
    for (const assignment of teacherAssignments) {
      const tests = academicStore.getAssessmentsForClass(assignment.id);
      const futureOrRecent = tests.filter((t) => {
        const testDate = new Date(t.date).getTime();
        return testDate >= Date.now() - 24 * 60 * 60 * 1000;
      });
      upcomingTestsCount += futureOrRecent.length;
    }

    // Build real recent activities
    const recentActivities: Array<{
      id: string;
      title: string;
      description: string;
      type: "assignment" | "material" | "announcement" | "attendance" | "test";
      timestamp: string;
      icon: string;
      color: string;
    }> = [];

    // 1. Recent assignments
    teacherClassAssignmentsList.slice(0, 3).forEach((a) => {
      recentActivities.push({
        id: `asg-${a.id}`,
        title: `Assignment: ${a.title}`,
        description: `${a.subject} · Target: ${a.targetClass} (Due: ${a.dueDate})`,
        type: "assignment",
        timestamp: a.createdAt?.toISOString() || new Date().toISOString(),
        icon: "checkbox-outline",
        color: "#3D5AF1",
      });
    });

    // 2. Recent study materials
    const recentMaterials = await db.select().from(studyMaterialsTable).where(
      or(
        eq(studyMaterialsTable.authorId, user.id),
        eq(studyMaterialsTable.jnvName, user.jnvName)
      )
    ).orderBy(desc(studyMaterialsTable.createdAt)).limit(3);

    recentMaterials.forEach((m) => {
      recentActivities.push({
        id: `mat-${m.id}`,
        title: `Resource Shared: ${m.title}`,
        description: `${m.subject} · Type: ${m.type} · ${m.authorName || "Faculty"}`,
        type: "material",
        timestamp: m.createdAt?.toISOString() || new Date().toISOString(),
        icon: "document-text-outline",
        color: "#10B981",
      });
    });

    // 3. Recent announcements
    const recentAnnouncements = await db.select().from(announcementsTable).where(
      eq(announcementsTable.jnvName, user.jnvName)
    ).orderBy(desc(announcementsTable.createdAt)).limit(2);

    recentAnnouncements.forEach((an) => {
      recentActivities.push({
        id: `ann-${an.id}`,
        title: `Notice: ${an.title}`,
        description: `Target: ${an.target} · Priority: ${an.priority}`,
        type: "announcement",
        timestamp: an.createdAt?.toISOString() || new Date().toISOString(),
        icon: "megaphone-outline",
        color: "#8B5CF6",
      });
    });

    // Sort activities newest first
    recentActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return res.json({
      totalAssignedClasses: uniqueClassSet.size,
      totalStudents: uniqueStudentIds.size,
      pendingAssignments: pendingSubmissionsCount,
      upcomingTests: Math.max(upcomingTestsCount, 0),
      recentActivities: recentActivities.slice(0, 6),
    });
  } catch (error) {
    req.log.error(error, "academic teacher overview failed");
    return res.status(500).json({ error: "Failed to generate teacher overview" });
  }
});

// ---------------------------------------------------------------------------
// 3. Teachers Directory for Class Allocation
// ---------------------------------------------------------------------------
router.get("/academic-classes/teachers", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!isRegisteredJnvOfficial(user)) return res.status(403).json({ error: "A registered JNV Official account is required" });
    const candidates = await db.select({ id: usersTable.id, fullName: usersTable.fullName, subject: usersTable.subject })
      .from(usersTable)
      .where(and(eq(usersTable.role, "teacher"), eq(usersTable.verificationStatus, "verified"), or(
        eq(usersTable.jnvId, jnvIdOf(user)),
        and(isNull(usersTable.jnvId), eq(usersTable.jnvName, user.jnvName), eq(usersTable.jnvState, user.jnvState)),
      )));
    return res.json(candidates);
  } catch (error) {
    req.log.error(error, "academic teacher directory failed");
    return res.status(500).json({ error: "Failed to load verified teachers" });
  }
});

// ---------------------------------------------------------------------------
// 4. Class Roster (Students in an Assigned Class)
// ---------------------------------------------------------------------------
router.get("/academic-classes/:id/students", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    const official = isRegisteredJnvOfficial(user);
    if (!official && (!isVerifiedTeacher(user) || assignment.teacherId !== user.id)) {
      return res.status(403).json({ error: "You are not assigned to this class" });
    }

    const schoolStudents = await db.select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      photoURL: usersTable.photoURL,
      uploadedPhotoURL: usersTable.uploadedPhotoURL,
      class: usersTable.class,
      house: usersTable.house,
      enrollYear: usersTable.enrollYear,
    }).from(usersTable).where(and(
      eq(usersTable.role, "student"),
      or(
        eq(usersTable.jnvId, assignment.jnvId),
        and(isNull(usersTable.jnvId), eq(usersTable.jnvName, assignment.jnvName), eq(usersTable.jnvState, assignment.jnvState))
      )
    )).orderBy(usersTable.fullName);

    const students = schoolStudents.filter((student) => {
      const placement = parseClassSection(student.class);
      if (!placement) return false;
      return placement.className === assignment.className &&
        (assignment.section === "Unspecified" || placement.section === "Unspecified" || placement.section === assignment.section);
    });

    return res.json(students);
  } catch (error) {
    req.log.error(error, "academic class roster lookup failed");
    return res.status(500).json({ error: "Failed to load class roster" });
  }
});

// ---------------------------------------------------------------------------
// 5. Single Class Overview & Metrics
// ---------------------------------------------------------------------------
router.get("/academic-classes/:id/overview", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    // Students count
    const schoolStudents = await db.select({ id: usersTable.id, class: usersTable.class })
      .from(usersTable).where(and(
        eq(usersTable.role, "student"),
        or(
          eq(usersTable.jnvId, assignment.jnvId),
          and(isNull(usersTable.jnvId), eq(usersTable.jnvName, assignment.jnvName), eq(usersTable.jnvState, assignment.jnvState))
        )
      ));

    const enrolledStudents = schoolStudents.filter((student) => {
      const placement = parseClassSection(student.class);
      if (!placement) return false;
      return placement.className === assignment.className &&
        (assignment.section === "Unspecified" || placement.section === "Unspecified" || placement.section === assignment.section);
    });

    // Attendance stats
    const today = new Date().toISOString().split("T")[0];
    const todayAttendance = academicStore.getAttendanceForClass(assignment.id, today)[0];
    let todayAttendanceRate = 0;
    if (todayAttendance && todayAttendance.students.length > 0) {
      const presentCount = todayAttendance.students.filter((s) => s.status === "present").length;
      todayAttendanceRate = Math.round((presentCount / todayAttendance.students.length) * 100);
    }

    // Pending assignments
    const classAssignments = await db.select().from(assignmentsTable).where(
      and(
        eq(assignmentsTable.targetClass, assignment.className),
        or(
          eq(assignmentsTable.jnvId, assignment.jnvId),
          and(isNull(assignmentsTable.jnvId), eq(assignmentsTable.jnvName, assignment.jnvName))
        )
      )
    );

    const tests = academicStore.getAssessmentsForClass(assignment.id);

    // Recent announcements for this class
    const announcements = await db.select().from(announcementsTable).where(
      and(
        eq(announcementsTable.jnvName, assignment.jnvName),
        or(
          eq(announcementsTable.target, "Whole School"),
          eq(announcementsTable.target, assignment.className)
        )
      )
    ).orderBy(desc(announcementsTable.createdAt)).limit(3);

    // Performance average
    let performanceAverage = 0;
    if (tests.length > 0) {
      let totalPct = 0;
      let scoreCount = 0;
      tests.forEach((t) => {
        t.scores.forEach((s) => {
          if (t.totalMarks > 0) {
            totalPct += (s.marksObtained / t.totalMarks) * 100;
            scoreCount++;
          }
        });
      });
      performanceAverage = scoreCount > 0 ? Math.round(totalPct / scoreCount) : 0;
    }

    return res.json({
      assignment,
      totalStudents: enrolledStudents.length,
      todayAttendanceRate,
      pendingAssignments: classAssignments.length,
      upcomingExams: tests.length,
      performanceAverage,
      announcements,
    });
  } catch (error) {
    req.log.error(error, "academic class overview failed");
    return res.status(500).json({ error: "Failed to load class overview" });
  }
});

// ---------------------------------------------------------------------------
// 6. Attendance API (Get & Record)
// ---------------------------------------------------------------------------
router.get("/academic-classes/:id/attendance", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    const date = typeof req.query.date === "string" ? req.query.date : undefined;
    const records = academicStore.getAttendanceForClass(assignment.id, date);
    return res.json(records);
  } catch (error) {
    req.log.error(error, "attendance fetch failed");
    return res.status(500).json({ error: "Failed to load attendance records" });
  }
});

router.post("/academic-classes/:id/attendance", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    const official = isRegisteredJnvOfficial(user);
    if (!official && (!isVerifiedTeacher(user) || assignment.teacherId !== user.id)) {
      return res.status(403).json({ error: "Unauthorized to record attendance for this class" });
    }

    const { date, students } = req.body ?? {};
    if (!date || !Array.isArray(students)) {
      return res.status(400).json({ error: "Date and students list are required" });
    }

    const recorded = academicStore.recordAttendance({
      assignmentId: assignment.id,
      className: assignment.className,
      section: assignment.section,
      date: String(date),
      markedById: user.id,
      markedByName: user.fullName,
      students,
    });

    return res.json(recorded);
  } catch (error) {
    req.log.error(error, "attendance record failed");
    return res.status(500).json({ error: "Failed to save attendance" });
  }
});

// ---------------------------------------------------------------------------
// 7. Results & Assessments API
// ---------------------------------------------------------------------------
router.get("/academic-classes/:id/results", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    const records = academicStore.getAssessmentsForClass(assignment.id);
    return res.json(records);
  } catch (error) {
    req.log.error(error, "results fetch failed");
    return res.status(500).json({ error: "Failed to load examination results" });
  }
});

router.post("/academic-classes/:id/results", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    const official = isRegisteredJnvOfficial(user);
    if (!official && (!isVerifiedTeacher(user) || assignment.teacherId !== user.id)) {
      return res.status(403).json({ error: "Unauthorized to record assessment results for this class" });
    }

    const { title, subject, totalMarks, date, scores, published, weightage } = req.body ?? {};
    if (!title?.trim() || !totalMarks || !Array.isArray(scores)) {
      return res.status(400).json({ error: "Title, total marks, and student scores are required" });
    }

    const created = academicStore.createAssessment({
      assignmentId: assignment.id,
      className: assignment.className,
      section: assignment.section,
      subject: subject || assignment.subject,
      title: title.trim(),
      date: date || new Date().toISOString().split("T")[0],
      totalMarks: Number(totalMarks),
      weightage: weightage ? Number(weightage) : undefined,
      createdById: user.id,
      createdByName: user.fullName,
      published: Boolean(published),
      scores,
    });

    return res.json(created);
  } catch (error) {
    req.log.error(error, "assessment create failed");
    return res.status(500).json({ error: "Failed to save assessment results" });
  }
});

// ---------------------------------------------------------------------------
// 8. Timetable API (Get & Update)
// ---------------------------------------------------------------------------
router.get("/academic-classes/:id/timetable", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    const timetable = academicStore.getTimetable(
      assignment.id,
      assignment.className,
      assignment.section,
      assignment.subject,
      assignment.teacherName
    );

    return res.json(timetable);
  } catch (error) {
    req.log.error(error, "timetable fetch failed");
    return res.status(500).json({ error: "Failed to load class timetable" });
  }
});

router.post("/academic-classes/:id/timetable", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [assignment] = await db.select().from(teacherClassAssignmentsTable).where(and(
      eq(teacherClassAssignmentsTable.id, req.params.id as string),
      eq(teacherClassAssignmentsTable.jnvId, jnvIdOf(user)),
      eq(teacherClassAssignmentsTable.active, true),
    )).limit(1);

    if (!assignment) return res.status(404).json({ error: "Class assignment not found" });

    const official = isRegisteredJnvOfficial(user);
    if (!official && (!isVerifiedTeacher(user) || assignment.teacherId !== user.id)) {
      return res.status(403).json({ error: "Unauthorized to modify timetable" });
    }

    const { schedule } = req.body ?? {};
    if (!schedule || typeof schedule !== "object") {
      return res.status(400).json({ error: "Invalid schedule payload" });
    }

    const updated = academicStore.updateTimetable(assignment.id, schedule);
    return res.json(updated);
  } catch (error) {
    req.log.error(error, "timetable update failed");
    return res.status(500).json({ error: "Failed to update timetable" });
  }
});

// ---------------------------------------------------------------------------
// 9. Revoke / Delete Assignment (JNV Official Only)
// ---------------------------------------------------------------------------
router.delete("/academic-classes/:id", requireAuth, async (req, res) => {
  const user = getUser(req);
  if (!isRegisteredJnvOfficial(user)) return res.status(403).json({ error: "A registered JNV Official account is required" });
  return res.status(410).json({ error: "Use the Academic Management page to remove assignments with a complete audit history." });
});

export default router;
