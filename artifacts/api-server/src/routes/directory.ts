import { Router } from "express";
import { and, asc, count, eq, ilike, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { db, eventsTable, problemsTable, usersTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, isRegisteredJnvOfficial, requireAuth } from "../lib/auth";
import { makeJnvId } from "../lib/jnv-identity";

const router = Router();

const DIRECTORY_ROLES = ["student", "teacher", "alumni", "official"] as const;

router.get("/school-admin/classes", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    if (!isRegisteredJnvOfficial(actor)) {
      return res.status(403).json({ error: "A registered JNV official account with school details is required" });
    }
    const jnvId = actor.jnvId || makeJnvId(actor.jnvState, actor.jnvName);
    const schoolScope = or(
      eq(usersTable.jnvId, jnvId),
      and(isNull(usersTable.jnvId), eq(usersTable.jnvName, actor.jnvName), eq(usersTable.jnvState, actor.jnvState)),
    );
    const [classes, unassigned] = await Promise.all([
      db.select({ className: usersTable.class, students: count() }).from(usersTable)
        .where(and(schoolScope, eq(usersTable.role, "student"), eq(usersTable.verificationStatus, "verified"), isNotNull(usersTable.class)))
        .groupBy(usersTable.class)
        .orderBy(asc(usersTable.class)),
      db.select({ students: count() }).from(usersTable)
        .where(and(schoolScope, eq(usersTable.role, "student"), eq(usersTable.verificationStatus, "verified"), or(isNull(usersTable.class), eq(usersTable.class, "")))),
    ]);
    return res.json({
      classes: classes.filter((row) => row.className?.trim()).map((row) => ({ className: row.className!, students: Number(row.students) })),
      unassignedStudents: Number(unassigned[0]?.students ?? 0),
    });
  } catch (error) {
    req.log.error(error, "Failed to load school classes");
    return res.status(500).json({ error: "Could not load classes" });
  }
});

router.get("/school-admin/dashboard-metrics", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    if (!await isAuthorizedJnvOfficial(actor)) {
      return res.status(403).json({ error: "Assigned JNV official access is required" });
    }
    const jnvId = actor.jnvId || makeJnvId(actor.jnvState, actor.jnvName);
    const schoolScope = or(
      eq(usersTable.jnvId, jnvId),
      and(isNull(usersTable.jnvId), eq(usersTable.jnvName, actor.jnvName), eq(usersTable.jnvState, actor.jnvState)),
    );
    const [classes, students, events, issues] = await Promise.all([
      db.select({ className: usersTable.class }).from(usersTable).where(and(
        schoolScope,
        eq(usersTable.role, "student"),
        eq(usersTable.verificationStatus, "verified"),
        isNotNull(usersTable.class),
        ne(usersTable.class, ""),
      )).groupBy(usersTable.class),
      db.select({ total: count() }).from(usersTable).where(and(
        schoolScope,
        eq(usersTable.role, "student"),
        eq(usersTable.verificationStatus, "verified"),
      )),
      db.select({ total: count() }).from(eventsTable).where(and(
        eq(eventsTable.jnvName, actor.jnvName),
        ne(eventsTable.date, ""),
      )),
      db.select({ total: count() }).from(problemsTable).where(and(
        eq(problemsTable.jnvName, actor.jnvName),
        eq(problemsTable.jnvState, actor.jnvState),
        inArray(problemsTable.status, ["submitted", "seen", "in_progress"]),
      )),
    ]);
    return res.json({
      classes: classes.filter((row) => row.className?.trim()).length,
      students: Number(students[0]?.total ?? 0),
      events: Number(events[0]?.total ?? 0),
      issues: Number(issues[0]?.total ?? 0),
    });
  } catch (error) {
    req.log.error(error, "Failed to load school dashboard metrics");
    return res.status(500).json({ error: "Could not load school metrics" });
  }
});

router.get("/school-admin/directory", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    if (actor.role !== "official") return res.status(403).json({ error: "A registered JNV official account is required." });
    if (!actor.jnvName?.trim() || !actor.jnvState?.trim()) {
      return res.status(403).json({ error: "Complete your JNV details to open its school directory." });
    }

    // Directory access is read-only and stays scoped to the official's registered JNV.
    // Academic class tools are scoped to registered JNV details; other administrative tools remain assignment-gated.
    const jnvId = actor.jnvId || makeJnvId(actor.jnvState, actor.jnvName);
    const schoolScope = or(
      eq(usersTable.jnvId, jnvId),
      and(eq(usersTable.jnvName, actor.jnvName), eq(usersTable.jnvState, actor.jnvState)),
    );
    const requestedRole = typeof req.query.role === "string" ? req.query.role : "all";
    if (requestedRole !== "all" && !DIRECTORY_ROLES.includes(requestedRole as typeof DIRECTORY_ROLES[number])) {
      return res.status(400).json({ error: "Invalid directory role" });
    }
    const requestedClass = typeof req.query.class === "string" ? req.query.class.trim().slice(0, 100) : "";
    if (requestedClass && requestedRole !== "student") {
      return res.status(400).json({ error: "Class filtering is only available for students" });
    }
    const search = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const page = Math.max(1, Math.min(10_000, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
    const pageSize = Math.max(1, Math.min(50, Number.parseInt(String(req.query.pageSize ?? "20"), 10) || 20));
    const conditions = [schoolScope];
    if (requestedRole !== "all") conditions.push(eq(usersTable.role, requestedRole));
    else conditions.push(inDirectoryRoles());
    if (requestedClass === "__unassigned__") conditions.push(or(isNull(usersTable.class), eq(usersTable.class, ""))!);
    else if (requestedClass) conditions.push(eq(usersTable.class, requestedClass));
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(or(
        ilike(usersTable.fullName, pattern),
        ilike(usersTable.class, pattern),
        ilike(usersTable.subject, pattern),
        ilike(usersTable.designation, pattern),
        ilike(usersTable.house, pattern),
      )!);
    }

    const [counts, totalRows, users, classRows] = await Promise.all([
      db.select({ role: usersTable.role, total: count() }).from(usersTable)
        .where(and(schoolScope, inDirectoryRoles()))
        .groupBy(usersTable.role),
      db.select({ total: count() }).from(usersTable).where(and(...conditions)),
      db.select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        role: usersTable.role,
        jnvName: usersTable.jnvName,
        jnvState: usersTable.jnvState,
        photoURL: usersTable.photoURL,
        class: usersTable.class,
        house: usersTable.house,
        subject: usersTable.subject,
        designation: usersTable.designation,
        verificationStatus: usersTable.verificationStatus,
        createdAt: usersTable.createdAt,
      }).from(usersTable)
        .where(and(...conditions))
        .orderBy(asc(usersTable.fullName))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
      requestedRole === "student"
        ? db.select({ className: usersTable.class, students: count() }).from(usersTable)
          .where(and(schoolScope, eq(usersTable.role, "student")))
          .groupBy(usersTable.class)
        : Promise.resolve([]),
    ]);

    const classCounts = classRows
      .map((row) => ({ className: row.className?.trim() || null, students: Number(row.students) }))
      .sort((a, b) => {
        if (a.className === null) return 1;
        if (b.className === null) return -1;
        return a.className.localeCompare(b.className, undefined, { numeric: true, sensitivity: "base" });
      });

    const roleCounts = Object.fromEntries(DIRECTORY_ROLES.map((role) => [role, 0])) as Record<typeof DIRECTORY_ROLES[number], number>;
    for (const row of counts) {
      if (DIRECTORY_ROLES.includes(row.role as typeof DIRECTORY_ROLES[number])) {
        roleCounts[row.role as typeof DIRECTORY_ROLES[number]] = Number(row.total);
      }
    }
    return res.json({
      users,
      classes: classCounts,
      school: { jnvName: actor.jnvName, jnvState: actor.jnvState },
      counts: roleCounts,
      total: Number(totalRows[0]?.total ?? 0),
      page,
      pageSize,
    });
  } catch (error) {
    req.log.error(error, "Failed to load school administration directory");
    return res.status(500).json({ error: "Could not load the school directory" });
  }
});

function inDirectoryRoles() {
  return inArray(usersTable.role, [...DIRECTORY_ROLES]);
}

router.get("/schools", requireAuth, async (req, res) => {
  try {
    getUser(req);
    const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const state = typeof req.query.state === "string" ? req.query.state.trim().slice(0, 100) : "";
    const conditions = [
      eq(usersTable.verificationStatus, "verified"),
      ilike(usersTable.jnvName, "JNV%"),
    ];
    if (query) conditions.push(ilike(usersTable.jnvName, `%${query.replace(/[%_\\]/g, "\\$&")}%`));
    if (state) conditions.push(eq(usersTable.jnvState, state));

    const rows = await db.select({
      jnvName: usersTable.jnvName,
      jnvState: usersTable.jnvState,
      verifiedMemberCount: count(usersTable.id),
    }).from(usersTable)
      .where(and(...conditions))
      .groupBy(usersTable.jnvName, usersTable.jnvState)
      .orderBy(asc(usersTable.jnvState), asc(usersTable.jnvName))
      .limit(250);

    return res.json({
      coordinateDataAvailable: false,
      schools: rows.map((row) => ({
        jnvName: row.jnvName,
        jnvState: row.jnvState,
        verifiedMemberCount: Number(row.verifiedMemberCount) >= 5 ? Number(row.verifiedMemberCount) : null,
      })),
    });
  } catch (error) {
    req.log.error(error, "Failed to list verified JNV communities");
    return res.status(500).json({ error: "Could not load the school directory" });
  }
});

export default router;
