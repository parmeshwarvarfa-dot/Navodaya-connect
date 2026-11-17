import { Router } from "express";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  alumniTransitionBatchesTable,
  alumniTransitionResultsTable,
  db,
  digitalCredentialsTable,
  socialNotificationsTable,
  usersTable,
  verificationAssignmentsTable,
  verificationAuditTable,
  verificationRequestsTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { issueDigitalCredential } from "../lib/digital-credential";
import { getPublicAppUrl } from "../lib/public-app-url";
import { makeJnvId } from "../lib/jnv-identity";

const router = Router();
const ACTIVE_REQUEST_STATUSES = ["pending", "info_requested", "recommended_approval", "recommended_rejection", "awaiting_official_decision"];
const REQUEST_ROLES = new Set(["student", "teacher", "official"]);
type AssignmentRole = "admin" | "official";
const publicLookups = new Map<string, number[]>();
const GRADUATION_CONFIRMATION = "I confirm that I reviewed the selected students and verified their graduation eligibility for this JNV batch.";

function isClass12(value: string | null | undefined) {
  return /^class\s*12(?:\b|$)/i.test(value?.trim() ?? "");
}

function isYear(value: unknown): value is string {
  return typeof value === "string" && /^(19|20|21)\d{2}$/.test(value);
}

async function hasAssignment(userId: string, jnvId: string, assignmentRole: AssignmentRole) {
  if (assignmentRole === "official") {
    const [identity] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (identity?.role !== "official") return false;
  }
  const [assignment] = await db.select({ id: verificationAssignmentsTable.id })
    .from(verificationAssignmentsTable)
    .where(and(
      eq(verificationAssignmentsTable.userId, userId),
      eq(verificationAssignmentsTable.jnvId, jnvId),
      eq(verificationAssignmentsTable.assignmentRole, assignmentRole),
      eq(verificationAssignmentsTable.active, true),
    )).limit(1);
  return Boolean(assignment);
}

function safeRequest(request: typeof verificationRequestsTable.$inferSelect, includeReviewerLinks = false) {
  // Preserve links for same-JNV assigned reviewers only; applicants and other
  // consumers never receive document URLs from status/profile responses.
  if (includeReviewerLinks) return request;
  const { documentUrls: _documentUrls, ...safe } = request;
  return safe;
}

function hasEvidence(request: typeof verificationRequestsTable.$inferSelect) {
  // Only the applicant's description is stored here. Public document URLs are
  // not accepted as evidence because the server cannot enforce their privacy.
  return Boolean(request.evidenceSummary && request.evidenceSummary.trim().length >= 20);
}

async function notify(recipientId: string, actorId: string, type: string, requestId: string, message: string) {
  await db.insert(socialNotificationsTable).values({ recipientId, actorId, type, entityId: requestId, message });
}

router.get("/verification/requests", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
    const isOfficial = await hasAssignment(actor.id, jnvId, "official");
    const isAdmin = await hasAssignment(actor.id, jnvId, "admin");
    if (!isOfficial && !isAdmin) return res.status(403).json({ error: "Assigned school verification staff only" });
    const requestRows = await db.select({ request: verificationRequestsTable }).from(verificationRequestsTable)
      .innerJoin(usersTable, eq(usersTable.id, verificationRequestsTable.userId))
      .where(and(eq(verificationRequestsTable.jnvName, actor.jnvName), eq(verificationRequestsTable.jnvState, actor.jnvState), ne(verificationRequestsTable.role, "alumni"), ne(usersTable.role, "alumni")))
      .orderBy(desc(verificationRequestsTable.createdAt));
    return res.json(requestRows.map(({ request }) => safeRequest(request, true)));
  } catch (error) {
    req.log.error(error, "Failed to fetch verification requests");
    return res.status(500).json({ error: "Failed to fetch verification requests" });
  }
});

router.get("/verification/permissions", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
    const [canDecide, canReview] = await Promise.all([
      hasAssignment(actor.id, jnvId, "official"),
      hasAssignment(actor.id, jnvId, "admin"),
    ]);
    return res.json({ canReview: canReview || canDecide, canDecide, canManageReviewers: canDecide, jnvId });
  } catch (error) {
    req.log.error(error, "Failed to load verification permissions");
    return res.status(500).json({ error: "Failed to load verification permissions" });
  }
});

router.post("/verification/alumni-batches/preview", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
    if (!await hasAssignment(actor.id, jnvId, "official")) return res.status(403).json({ error: "Only an authorized JNV official can prepare a batch transition" });
    const graduationYear = req.body?.graduationYear;
    if (!isYear(graduationYear)) return res.status(400).json({ error: "Enter a valid four-digit graduation year" });

    const schoolUsers = await db.select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      role: usersTable.role,
      class: usersTable.class,
      passoutYear: usersTable.passoutYear,
      verificationStatus: usersTable.verificationStatus,
    }).from(usersTable).where(and(eq(usersTable.jnvName, actor.jnvName), eq(usersTable.jnvState, actor.jnvState)));
    const students = schoolUsers.filter((user) => user.role === "student" && isClass12(user.class));
    const alreadyTransitioned = schoolUsers.filter((user) => user.role === "alumni" && user.passoutYear === graduationYear);
    const rows = students.map((user) => ({
      ...user,
      graduationReview: user.passoutYear === graduationYear ? "recorded" : user.passoutYear ? "conflict" : "official_confirmation_required",
      selectable: !user.passoutYear || user.passoutYear === graduationYear,
      reason: user.passoutYear && user.passoutYear !== graduationYear
        ? `Account already records graduation year ${user.passoutYear}`
        : user.passoutYear === graduationYear ? "Graduation year matches the account" : "No graduation year is recorded; review and confirm this student individually",
    }));
    const [batch] = await db.insert(alumniTransitionBatchesTable).values({
      jnvId, jnvName: actor.jnvName, jnvState: actor.jnvState, graduationYear, createdBy: actor.id, status: "preview",
      previewUserIds: JSON.stringify(rows.filter((row) => row.selectable).map((row) => row.id)),
    }).returning();
    return res.status(201).json({
      batchId: batch.id,
      jnvName: actor.jnvName,
      jnvState: actor.jnvState,
      graduationYear,
      totalClass12Accounts: students.length,
      alreadyTransitioned: alreadyTransitioned.length,
      reviewRequired: rows.filter((row) => row.graduationReview === "official_confirmation_required").length,
      excluded: rows.filter((row) => !row.selectable).length,
      students: rows,
      confirmationText: GRADUATION_CONFIRMATION,
    });
  } catch (error) {
    req.log.error(error, "Failed to prepare alumni batch preview");
    return res.status(500).json({ error: "Failed to prepare batch preview" });
  }
});

router.post("/verification/alumni-batches/:id/process", requireAuth, async (req, res) => {
  const actor = getUser(req);
  try {
    const batchId = req.params.id as string;
    const selectedIds = req.body?.selectedUserIds;
    if (req.body?.confirmation !== GRADUATION_CONFIRMATION) return res.status(400).json({ error: "Explicit batch confirmation is required" });
    if (!Array.isArray(selectedIds) || selectedIds.length < 1 || selectedIds.length > 500 || selectedIds.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) || new Set(selectedIds).size !== selectedIds.length) {
      return res.status(400).json({ error: "Select between 1 and 500 unique student accounts" });
    }
    const [batch] = await db.select().from(alumniTransitionBatchesTable).where(eq(alumniTransitionBatchesTable.id, batchId)).limit(1);
    if (!batch) return res.status(404).json({ error: "Batch preview not found; prepare a new preview" });
    if (batch.createdBy !== actor.id || batch.jnvId !== makeJnvId(actor.jnvState, actor.jnvName) || !await hasAssignment(actor.id, batch.jnvId, "official")) {
      return res.status(403).json({ error: "Only the JNV official who prepared this batch may process it" });
    }
    const canonicalIds = [...selectedIds].sort();
    const previewIds: string[] = batch.previewUserIds ? JSON.parse(batch.previewUserIds) : [];
    if (canonicalIds.some((id) => !previewIds.includes(id))) return res.status(400).json({ error: "Selection includes a student outside this batch preview" });
    const savedIds: string[] = batch.selectedUserIds ? JSON.parse(batch.selectedUserIds) : [];
    if (savedIds.length && JSON.stringify([...savedIds].sort()) !== JSON.stringify(canonicalIds)) {
      return res.status(409).json({ error: "This batch was already confirmed with a different selection" });
    }
    if (!savedIds.length) {
      await db.update(alumniTransitionBatchesTable).set({ selectedUserIds: JSON.stringify(canonicalIds), status: "processing", updatedAt: new Date() }).where(eq(alumniTransitionBatchesTable.id, batch.id));
    }

    for (const userId of canonicalIds) {
      const [existingResult] = await db.select().from(alumniTransitionResultsTable).where(and(
        eq(alumniTransitionResultsTable.batchId, batch.id), eq(alumniTransitionResultsTable.userId, userId),
      )).limit(1);
      if (existingResult && existingResult.result !== "failed") continue;
      try {
        await db.transaction(async (tx) => {
          const [student] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
          let result = "failed";
          let reason = "";
          let credentialId: string | null = null;
          const previousRole = student?.role ?? null;
          if (!student || student.jnvName !== batch.jnvName || student.jnvState !== batch.jnvState) {
            result = "skipped";
            reason = "Account is missing or registered to a different JNV";
          } else if (student.role === "alumni" && student.passoutYear === batch.graduationYear) {
            result = "already_transitioned";
            reason = "Account was already transitioned in this graduating batch";
          } else if (student.role !== "student" || !isClass12(student.class)) {
            result = "skipped";
            reason = "Only an existing Class XII student account can be transitioned";
          } else if (student.passoutYear && student.passoutYear !== batch.graduationYear) {
            result = "skipped";
            reason = `Account records a different graduation year (${student.passoutYear})`;
          } else {
            const [activeCredential] = await tx.select().from(digitalCredentialsTable).where(and(
              eq(digitalCredentialsTable.userId, student.id), eq(digitalCredentialsTable.status, "active"),
            )).limit(1);
            if (student.verificationStatus === "verified" && activeCredential?.status === "active" && activeCredential.role !== "student" && activeCredential.role !== "alumni") {
              result = "skipped";
              reason = "An unrelated active credential needs manual review";
            } else if (student.verificationStatus === "verified" && !activeCredential) {
              const [approvedRequest] = await tx.select().from(verificationRequestsTable).where(and(
                eq(verificationRequestsTable.userId, student.id),
                eq(verificationRequestsTable.status, "approved"),
                eq(verificationRequestsTable.role, "student"),
                eq(verificationRequestsTable.jnvName, student.jnvName),
                eq(verificationRequestsTable.jnvState, student.jnvState),
                eq(verificationRequestsTable.adminRecommendation, "approval"),
              )).orderBy(desc(verificationRequestsTable.officialReviewedAt)).limit(1);
              if (!approvedRequest || !approvedRequest.officialReviewedBy || !approvedRequest.officialReviewedAt || !hasEvidence(approvedRequest)) {
                result = "skipped";
                reason = "Verified status has no active credential or complete official approval record; reconcile it before transition";
              }
            }
            if (result === "failed") {
              const [transitioned] = await tx.update(usersTable).set({ role: "alumni", passoutYear: batch.graduationYear })
                .where(and(eq(usersTable.id, student.id), eq(usersTable.role, "student"))).returning();
              if (!transitioned) {
                const [latest] = await tx.select().from(usersTable).where(eq(usersTable.id, student.id)).limit(1);
                result = latest?.role === "alumni" && latest.passoutYear === batch.graduationYear ? "already_transitioned" : "skipped";
                reason = result === "already_transitioned" ? "Another confirmed operation already transitioned this account" : "Account changed while this batch was processing; review the current record";
              } else {
                if (activeCredential && activeCredential.role !== "alumni") {
                  await tx.update(digitalCredentialsTable).set({ status: "superseded", updatedAt: new Date() }).where(eq(digitalCredentialsTable.id, activeCredential.id));
                }
                // School confirmation of graduation changes the role only. It is
                // not alumni community verification and never issues an alumni ID.
                await tx.update(usersTable).set({ verificationStatus: "unverified", communityVerifiedAt: null }).where(eq(usersTable.id, student.id));
                const [openRequest] = await tx.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.userId, student.id)).orderBy(desc(verificationRequestsTable.createdAt)).limit(1);
                if (openRequest && ACTIVE_REQUEST_STATUSES.includes(openRequest.status)) {
                  await tx.update(verificationRequestsTable).set({ status: "superseded_peer_only", updatedAt: new Date() }).where(eq(verificationRequestsTable.id, openRequest.id));
                  await tx.insert(verificationAuditTable).values({ requestId: openRequest.id, actorId: actor.id, subjectUserId: student.id, jnvId: batch.jnvId, action: "student_request_closed_on_alumni_transition", fromStatus: openRequest.status, toStatus: "superseded_peer_only", reason: `Role updated with JNV-confirmed ${batch.graduationYear} graduation batch; alumni verification requires a peer` });
                }
                result = "succeeded";
                reason = `Official confirmed graduation for batch ${batch.graduationYear}`;
                await tx.insert(verificationAuditTable).values({ actorId: actor.id, subjectUserId: student.id, jnvId: batch.jnvId, action: "student_to_alumni_transition", fromStatus: student.role, toStatus: "alumni", reason: `Batch ${batch.id}; graduation year ${batch.graduationYear}; source: authorized JNV official confirmation` });
                await tx.insert(socialNotificationsTable).values({ recipientId: student.id, actorId: actor.id, type: "alumni_batch_transition", entityId: batch.id, message: `Your account role was updated to Alumni for the ${batch.graduationYear} graduating batch. Your existing account and history are unchanged.` });
              }
            }
          }
          await tx.insert(alumniTransitionResultsTable).values({ batchId: batch.id, userId, previousRole, newRole: result === "succeeded" || result === "already_transitioned" ? "alumni" : previousRole, result, reason, credentialId, updatedAt: new Date() })
            .onConflictDoUpdate({ target: [alumniTransitionResultsTable.batchId, alumniTransitionResultsTable.userId], set: { previousRole, newRole: result === "succeeded" || result === "already_transitioned" ? "alumni" : previousRole, result, reason, credentialId, updatedAt: new Date() } });
        });
      } catch (error) {
        req.log.error({ error, batchId, userId }, "Student batch transition failed");
        const [unchanged] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        await db.insert(alumniTransitionResultsTable).values({ batchId: batch.id, userId, previousRole: unchanged?.role ?? null, newRole: unchanged?.role ?? null, result: "failed", reason: "Transition failed; safe to retry this batch", updatedAt: new Date() })
          .onConflictDoUpdate({ target: [alumniTransitionResultsTable.batchId, alumniTransitionResultsTable.userId], set: { previousRole: unchanged?.role ?? null, newRole: unchanged?.role ?? null, result: "failed", reason: "Transition failed; safe to retry this batch", updatedAt: new Date() } });
      }
    }

    const results = await db.select().from(alumniTransitionResultsTable).where(eq(alumniTransitionResultsTable.batchId, batch.id));
    const failed = results.filter((item) => item.result === "failed").length;
    const skipped = results.filter((item) => item.result === "skipped").length;
    const notProcessed = canonicalIds.length - results.filter((item) => canonicalIds.includes(item.userId)).length;
    const status = failed || skipped || notProcessed ? "partial" : "completed";
    await db.update(alumniTransitionBatchesTable).set({ status, updatedAt: new Date() }).where(eq(alumniTransitionBatchesTable.id, batch.id));
    return res.json({ batchId: batch.id, status, summary: {
      selected: canonicalIds.length,
      succeeded: results.filter((item) => item.result === "succeeded").length,
      alreadyTransitioned: results.filter((item) => item.result === "already_transitioned").length,
      skipped: results.filter((item) => item.result === "skipped").length,
      failed,
    }, results: results.filter((item) => canonicalIds.includes(item.userId)) });
  } catch (error) {
    req.log.error(error, "Failed to process alumni batch");
    return res.status(500).json({ error: "Failed to process alumni batch" });
  }
});

router.get("/verification/alumni-batches/:id", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [batch] = await db.select().from(alumniTransitionBatchesTable).where(eq(alumniTransitionBatchesTable.id, req.params.id as string)).limit(1);
    if (!batch) return res.status(404).json({ error: "Batch not found" });
    if (batch.jnvId !== makeJnvId(actor.jnvState, actor.jnvName) || !await hasAssignment(actor.id, batch.jnvId, "official")) return res.status(403).json({ error: "Assigned JNV official only" });
    const results = await db.select().from(alumniTransitionResultsTable).where(eq(alumniTransitionResultsTable.batchId, batch.id));
    return res.json({ batch, results });
  } catch (error) {
    req.log.error(error, "Failed to fetch alumni batch results");
    return res.status(500).json({ error: "Failed to fetch batch results" });
  }
});

router.get("/verification/requests/:id/audit", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [request] = await db.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.id, req.params.id as string)).limit(1);
    if (!request) return res.status(404).json({ error: "Request not found" });
    const jnvId = makeJnvId(request.jnvState, request.jnvName);
    if (!await hasAssignment(actor.id, jnvId, "official") && !await hasAssignment(actor.id, jnvId, "admin")) return res.status(403).json({ error: "Assigned school verification staff only" });
    const events = await db.select({
      id: verificationAuditTable.id,
      action: verificationAuditTable.action,
      fromStatus: verificationAuditTable.fromStatus,
      toStatus: verificationAuditTable.toStatus,
      reason: verificationAuditTable.reason,
      createdAt: verificationAuditTable.createdAt,
      actorName: usersTable.fullName,
    }).from(verificationAuditTable)
      .leftJoin(usersTable, eq(usersTable.id, verificationAuditTable.actorId))
      .where(eq(verificationAuditTable.requestId, request.id))
      .orderBy(desc(verificationAuditTable.createdAt));
    return res.json(events);
  } catch (error) {
    req.log.error(error, "Failed to fetch verification audit history");
    return res.status(500).json({ error: "Failed to fetch request history" });
  }
});

router.get("/verification/my-status", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, actor.id)).limit(1);
    const [request] = await db.select().from(verificationRequestsTable)
      .where(eq(verificationRequestsTable.userId, actor.id))
      .orderBy(desc(verificationRequestsTable.createdAt)).limit(1);
    const status = dbUser?.role === "alumni" && dbUser.verificationStatus === "verified" && !dbUser.communityVerifiedAt
      ? "legacy_approval_peer_required"
      : dbUser?.verificationStatus ?? "unverified";
    return res.json({ verificationStatus: status, request: request ? safeRequest(request) : null });
  } catch (error) {
    req.log.error(error, "Failed to fetch verification status");
    return res.status(500).json({ error: "Failed to fetch status" });
  }
});

router.post("/verification/requests", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    if (actor.role === "alumni") return res.status(410).json({ error: "Alumni verification is handled only through same-JNV peer confirmation." });
    if (!REQUEST_ROLES.has(actor.role)) return res.status(403).json({ error: "This account role cannot request verification" });
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, actor.id)).limit(1);
    if (!dbUser) return res.status(404).json({ error: "User not found" });
    if (dbUser.verificationStatus === "verified") return res.status(409).json({ error: "This account is already verified" });
    if (["suspended", "revoked"].includes(dbUser.verificationStatus ?? "")) return res.status(403).json({ error: "This account cannot submit a verification request while its status is restricted." });
    if (!dbUser.jnvName || !dbUser.jnvState || makeJnvId(dbUser.jnvState, dbUser.jnvName) !== dbUser.jnvId) {
      return res.status(409).json({ error: "Your JNV association must be corrected before requesting verification." });
    }
    const [existing] = await db.select().from(verificationRequestsTable)
      .where(eq(verificationRequestsTable.userId, actor.id)).orderBy(desc(verificationRequestsTable.createdAt)).limit(1);
    if (existing && ACTIVE_REQUEST_STATUSES.includes(existing.status)) return res.status(409).json({ error: "An active verification request already exists", request: safeRequest(existing) });
    const evidenceSummary = typeof req.body?.evidenceSummary === "string" ? req.body.evidenceSummary.trim().slice(0, 2000) : "";
    if (evidenceSummary.length < 20) return res.status(400).json({ error: "Describe the role-specific evidence you are submitting (at least 20 characters)" });
    if (req.body?.documentUrls !== undefined) return res.status(400).json({ error: "Document links are not accepted because their access privacy cannot be verified. Describe the evidence and provide it directly to your JNV official." });
    const [created] = await db.transaction(async (tx) => {
      const [row] = await tx.insert(verificationRequestsTable).values({
        userId: dbUser.id,
        userFullName: dbUser.fullName,
        userEmail: dbUser.email,
        role: dbUser.role,
        jnvName: dbUser.jnvName,
        jnvState: dbUser.jnvState,
        method: "official",
        status: "pending",
        evidenceSummary,
      }).returning();
      await tx.update(usersTable).set({ verificationStatus: "pending" }).where(eq(usersTable.id, dbUser.id));
      await tx.insert(verificationAuditTable).values({ requestId: row.id, actorId: dbUser.id, subjectUserId: dbUser.id, jnvId: dbUser.jnvId!, action: "request_submitted", fromStatus: dbUser.verificationStatus ?? "unverified", toStatus: "pending" });
      await tx.insert(socialNotificationsTable).values({ recipientId: dbUser.id, actorId: dbUser.id, type: "verification_request_submitted", entityId: row.id, message: "Your verification request was submitted to your JNV." });
      const officials = await tx.select({ userId: verificationAssignmentsTable.userId }).from(verificationAssignmentsTable)
        .innerJoin(usersTable, eq(usersTable.id, verificationAssignmentsTable.userId)).where(and(
          eq(verificationAssignmentsTable.jnvId, dbUser.jnvId!), eq(verificationAssignmentsTable.assignmentRole, "official"), eq(verificationAssignmentsTable.active, true), eq(usersTable.role, "official"),
        ));
      if (officials.length) await tx.insert(socialNotificationsTable).values(officials.map(({ userId }) => ({ recipientId: userId, actorId: dbUser.id, type: "verification_request_submitted", entityId: row.id, message: `A ${dbUser.role} verification request is ready for review.` })));
      return [row];
    });
    return res.status(201).json(safeRequest(created));
  } catch (error) {
    if ((error as { code?: string })?.code === "23505") return res.status(409).json({ error: "An active verification request already exists" });
    req.log.error(error, "Failed to create verification request");
    return res.status(500).json({ error: "Failed to create verification request" });
  }
});

router.patch("/verification/requests/:id", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [existing] = await db.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.id, req.params.id as string)).limit(1);
    if (!existing) return res.status(404).json({ error: "Request not found" });
    if (existing.role === "alumni" || existing.method === "alumni_peer") return res.status(410).json({ error: "Alumni verification is handled only by same-JNV alumni." });
    if (existing.userId === actor.id) return res.status(403).json({ error: "You cannot review your own request" });
    const [applicant] = await db.select().from(usersTable).where(eq(usersTable.id, existing.userId)).limit(1);
    if (!applicant) return res.status(404).json({ error: "Applicant account not found" });
    if (applicant.role === "alumni") return res.status(410).json({ error: "Alumni verification is handled only by same-JNV alumni." });
    if (applicant.role !== existing.role || applicant.jnvName !== existing.jnvName || applicant.jnvState !== existing.jnvState) {
      return res.status(409).json({ error: "The applicant's current role or school differs from this request. Refresh the request before deciding." });
    }
    const jnvId = makeJnvId(existing.jnvState, existing.jnvName);
    const isOfficial = await hasAssignment(actor.id, jnvId, "official");
    const isAdmin = await hasAssignment(actor.id, jnvId, "admin");
    if (!isOfficial && !isAdmin) return res.status(403).json({ error: "Not assigned to this JNV" });
    const { status, notes, infoRequest } = req.body ?? {};
    const reason = typeof notes === "string" ? notes.trim().slice(0, 2000) : "";
    const requestedInfo = typeof infoRequest === "string" ? infoRequest.trim().slice(0, 2000) : "";
    const now = new Date();

    if (isAdmin && !isOfficial) {
      if (!["recommend_approval", "recommend_rejection", "info_requested"].includes(status)) return res.status(400).json({ error: "Admins may recommend or request information; only an assigned official makes the final decision" });
      if ((status === "recommend_rejection" || status === "info_requested") && !reason && !requestedInfo) return res.status(400).json({ error: "A reason is required" });
      if (status === "recommend_approval" && !hasEvidence(existing)) return res.status(409).json({ error: "The applicant must submit role evidence before an approval recommendation" });
      if (existing.status !== "pending" && existing.status !== "info_requested") return res.status(409).json({ error: "This request is not awaiting school admin review" });
      const nextStatus = status === "recommend_approval" ? "awaiting_official_decision" : status === "recommend_rejection" ? "awaiting_official_decision" : "info_requested";
      const recommendation = status === "recommend_approval" ? "approval" : status === "recommend_rejection" ? "rejection" : null;
      const [updated] = await db.transaction(async (tx) => {
        const [row] = await tx.update(verificationRequestsTable).set({
          status: nextStatus,
          adminRecommendation: recommendation,
          adminNotes: reason || null,
          adminReviewedBy: actor.id,
          adminReviewedAt: now,
          infoRequest: status === "info_requested" ? (requestedInfo || reason) : null,
          updatedAt: now,
        }).where(eq(verificationRequestsTable.id, existing.id)).returning();
        await tx.insert(verificationAuditTable).values({ requestId: existing.id, actorId: actor.id, subjectUserId: existing.userId, jnvId, action: status, fromStatus: existing.status, toStatus: nextStatus, reason: reason || requestedInfo || null });
        return [row];
      });
      await notify(existing.userId, actor.id, "verification_reviewed", existing.id, status === "info_requested" ? "Your school requested more information for verification." : "Your verification request was reviewed and sent for an official decision.");
      const officials = await db.select({ userId: verificationAssignmentsTable.userId }).from(verificationAssignmentsTable)
        .innerJoin(usersTable, eq(usersTable.id, verificationAssignmentsTable.userId)).where(and(
          eq(verificationAssignmentsTable.jnvId, jnvId), eq(verificationAssignmentsTable.assignmentRole, "official"), eq(verificationAssignmentsTable.active, true), eq(usersTable.role, "official"),
        ));
      await Promise.all(officials.map((item) => notify(item.userId, actor.id, "verification_decision_needed", existing.id, "A verification request is awaiting your final decision.")));
      return res.json(updated);
    }

    if (!isOfficial) return res.status(403).json({ error: "Only an authorized JNV official can make the final decision" });
    if (!["approved", "rejected", "info_requested", "pending"].includes(status)) return res.status(400).json({ error: "Invalid official decision" });
    if (status === "rejected" && !reason) return res.status(400).json({ error: "A rejection reason is required" });
    if (status === "approved" && !hasEvidence(existing)) return res.status(409).json({ error: "The applicant must submit role evidence before approval" });
    if (status === "approved" && applicant.role === "official" && existing.status !== "awaiting_official_decision") return res.status(409).json({ error: "An assigned reviewer must complete the official verification recommendation first" });
    if (existing.status === "approved" || existing.status === "rejected" || existing.status === "withdrawn") return res.status(409).json({ error: "This request is already closed" });

    let result: { updated: typeof verificationRequestsTable.$inferSelect; credential: typeof digitalCredentialsTable.$inferSelect | null };
    try {
      result = await db.transaction(async (tx) => {
      const [updated] = await tx.update(verificationRequestsTable).set({
        status,
        officialNotes: reason || null,
        reviewedBy: actor.id,
        reviewedByName: actor.fullName,
        reviewedAt: now,
        officialReviewedBy: actor.id,
        officialReviewedAt: now,
        infoRequest: status === "info_requested" ? requestedInfo || reason : null,
        ...(status === "pending" ? { adminRecommendation: null, adminNotes: null, adminReviewedBy: null, adminReviewedAt: null } : {}),
        updatedAt: now,
      }).where(and(eq(verificationRequestsTable.id, existing.id), eq(verificationRequestsTable.status, existing.status))).returning();
      if (!updated) throw Object.assign(new Error("This verification request was already processed"), { code: "VERIFICATION_ALREADY_PROCESSED" });
      let credential = null;
      if (status === "approved") {
        const issued = await issueDigitalCredential(tx, applicant, jnvId, actor.id, applicant.role);
        credential = issued.credential;
      }
      await tx.update(usersTable).set({ verificationStatus: status === "approved" ? "verified" : status === "rejected" ? "rejected" : "pending" }).where(eq(usersTable.id, existing.userId));
      await tx.insert(verificationAuditTable).values({ requestId: existing.id, actorId: actor.id, subjectUserId: existing.userId, jnvId, action: `official_${status}`, fromStatus: existing.status, toStatus: status, reason: reason || null });
      const decisionMessage = status === "approved"
        ? "Your verification was approved and your Navodaya Connect ID is ready."
        : status === "rejected"
          ? `Your verification request was rejected: ${reason}`
          : status === "info_requested"
            ? `More information is needed: ${requestedInfo || reason}`
            : "Your verification was returned for further review.";
      await tx.insert(socialNotificationsTable).values({ recipientId: existing.userId, actorId: actor.id, type: status === "approved" ? "verification_approved" : "verification_decision", entityId: existing.id, message: decisionMessage });
      return { updated, credential };
      });
    } catch (error) {
      if (status === "approved" && (error as { code?: string })?.code !== "VERIFICATION_ALREADY_PROCESSED") {
        await db.insert(verificationAuditTable).values({
          requestId: existing.id, actorId: actor.id, subjectUserId: existing.userId, jnvId,
          action: "credential_issuance_failed", fromStatus: existing.status, toStatus: existing.status,
          reason: error instanceof Error ? error.message.slice(0, 500) : "Credential issuance failed; approval transaction rolled back",
        }).catch((auditError) => req.log.error(auditError, "Could not record credential issuance failure"));
      }
      throw error;
    }
    return res.json({ ...result.updated, credential: result.credential ? { credentialId: result.credential.credentialId, status: result.credential.status } : null });
  } catch (error) {
    if ((error as { code?: string })?.code === "VERIFICATION_ALREADY_PROCESSED") return res.status(409).json({ error: "This verification request was already processed" });
    req.log.error(error, "Failed to process verification review");
    return res.status(500).json({ error: "Failed to process verification review" });
  }
});

router.post("/verification/requests/:id/withdraw", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [request] = await db.select().from(verificationRequestsTable).where(and(eq(verificationRequestsTable.id, req.params.id as string), eq(verificationRequestsTable.userId, actor.id))).limit(1);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.role !== actor.role || request.role === "alumni") return res.status(403).json({ error: "This account cannot withdraw that verification request." });
    if (!ACTIVE_REQUEST_STATUSES.includes(request.status)) return res.status(409).json({ error: "This request cannot be withdrawn" });
    await db.transaction(async (tx) => {
      const [withdrawn] = await tx.update(verificationRequestsTable).set({ status: "withdrawn", updatedAt: new Date() })
        .where(and(eq(verificationRequestsTable.id, request.id), eq(verificationRequestsTable.userId, actor.id), eq(verificationRequestsTable.status, request.status))).returning({ id: verificationRequestsTable.id });
      if (!withdrawn) throw Object.assign(new Error("This request was already updated"), { code: "VERIFICATION_ALREADY_UPDATED" });
      await tx.update(usersTable).set({ verificationStatus: "unverified" }).where(eq(usersTable.id, actor.id));
      await tx.insert(verificationAuditTable).values({ requestId: request.id, actorId: actor.id, subjectUserId: actor.id, jnvId: makeJnvId(request.jnvState, request.jnvName), action: "request_withdrawn", fromStatus: request.status, toStatus: "withdrawn" });
    });
    return res.json({ success: true, status: "withdrawn" });
  } catch (error) {
    if ((error as { code?: string })?.code === "VERIFICATION_ALREADY_UPDATED") return res.status(409).json({ error: "This request was already updated. Refresh its status." });
    req.log.error(error, "Failed to withdraw verification request");
    return res.status(500).json({ error: "Failed to withdraw request" });
  }
});

router.post("/verification/requests/:id/resubmit", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [request] = await db.select().from(verificationRequestsTable).where(and(eq(verificationRequestsTable.id, req.params.id as string), eq(verificationRequestsTable.userId, actor.id))).limit(1);
    if (!request) return res.status(404).json({ error: "Request not found" });
    if (request.role !== actor.role || request.role === "alumni") return res.status(403).json({ error: "This account cannot update that verification request." });
    if (request.status !== "info_requested") return res.status(409).json({ error: "This request is not waiting for additional information" });
    const documentUrls = req.body?.documentUrls;
    const applicantResponse = typeof req.body?.applicantResponse === "string" ? req.body.applicantResponse.trim().slice(0, 2000) : "";
    if (applicantResponse.length < 20) return res.status(400).json({ error: "Provide a detailed response of at least 20 characters" });
    if (documentUrls !== undefined) return res.status(400).json({ error: "Document links are not accepted because their access privacy cannot be verified. Provide supporting evidence directly to your JNV official." });
    const now = new Date();
    const [updated] = await db.transaction(async (tx) => {
      const [row] = await tx.update(verificationRequestsTable).set({
        status: "pending", infoRequest: null, adminRecommendation: null, adminNotes: null,
        adminReviewedBy: null, adminReviewedAt: null,
        applicantResponse: applicantResponse || null,
        evidenceSummary: applicantResponse || request.evidenceSummary,
        documentUrls: request.documentUrls,
        updatedAt: now,
      }).where(and(eq(verificationRequestsTable.id, request.id), eq(verificationRequestsTable.userId, actor.id), eq(verificationRequestsTable.status, "info_requested"))).returning();
      if (!row) throw Object.assign(new Error("This request was already updated"), { code: "VERIFICATION_ALREADY_UPDATED" });
      await tx.update(usersTable).set({ verificationStatus: "pending" }).where(eq(usersTable.id, actor.id));
      await tx.insert(verificationAuditTable).values({ requestId: request.id, actorId: actor.id, subjectUserId: actor.id, jnvId: makeJnvId(request.jnvState, request.jnvName), action: "additional_information_submitted", fromStatus: request.status, toStatus: "pending" });
      return [row];
    });
    const jnvId = makeJnvId(request.jnvState, request.jnvName);
    const staff = await db.select({ userId: verificationAssignmentsTable.userId }).from(verificationAssignmentsTable)
      .where(and(eq(verificationAssignmentsTable.jnvId, jnvId), inArray(verificationAssignmentsTable.assignmentRole, ["admin", "official"]), eq(verificationAssignmentsTable.active, true)));
    await Promise.all(staff.map((item) => notify(item.userId, actor.id, "verification_resubmitted", request.id, "An applicant submitted additional verification information.")));
    return res.json(safeRequest(updated));
  } catch (error) {
    if ((error as { code?: string })?.code === "VERIFICATION_ALREADY_UPDATED") return res.status(409).json({ error: "This request was already updated. Refresh its status." });
    req.log.error(error, "Failed to resubmit verification request");
    return res.status(500).json({ error: "Failed to resubmit request" });
  }
});

router.get("/verification/credentials/reconcile-preview", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
    if (!await hasAssignment(actor.id, jnvId, "official")) return res.status(403).json({ error: "Assigned JNV official only" });
    const schoolUsers = await db.select().from(usersTable).where(and(
      eq(usersTable.jnvName, actor.jnvName), eq(usersTable.jnvState, actor.jnvState), eq(usersTable.verificationStatus, "verified"), ne(usersTable.role, "alumni"),
    ));
    const candidates: Array<{ id: string; fullName: string; role: string }> = [];
    let reviewRequired = 0;
    for (const user of schoolUsers) {
      const credentials = await db.select().from(digitalCredentialsTable).where(eq(digitalCredentialsTable.userId, user.id));
      if (credentials.some((credential) => credential.status === "active" || credential.status === "suspended" || credential.status === "revoked")) continue;
      const [approved] = await db.select().from(verificationRequestsTable).where(and(
        eq(verificationRequestsTable.userId, user.id), eq(verificationRequestsTable.status, "approved"),
        eq(verificationRequestsTable.role, user.role), eq(verificationRequestsTable.jnvName, user.jnvName), eq(verificationRequestsTable.jnvState, user.jnvState),
        eq(verificationRequestsTable.adminRecommendation, "approval"),
      )).orderBy(desc(verificationRequestsTable.officialReviewedAt)).limit(1);
      if (approved?.officialReviewedBy && approved.officialReviewedAt && hasEvidence(approved)) {
        candidates.push({ id: user.id, fullName: user.fullName, role: user.role });
      } else reviewRequired += 1;
    }
    return res.json({ candidates, reviewRequired, message: "Only verified accounts with a matching official approval record and complete evidence can be reconciled." });
  } catch (error) {
    req.log.error(error, "Failed to preview legacy credential reconciliation");
    return res.status(500).json({ error: "Failed to prepare credential reconciliation" });
  }
});

router.post("/verification/credentials/reconcile", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
    if (!await hasAssignment(actor.id, jnvId, "official")) return res.status(403).json({ error: "Assigned JNV official only" });
    const userIds = req.body?.userIds;
    if (req.body?.confirmed !== true || !Array.isArray(userIds) || userIds.length > 500 || userIds.some((id: unknown) => typeof id !== "string") || new Set(userIds).size !== userIds.length) {
      return res.status(400).json({ error: "Confirm reconciliation and provide a list of up to 500 user IDs" });
    }
    let issued = 0;
    let skipped = 0;
    for (const userId of userIds as string[]) {
      const didIssue = await db.transaction(async (tx) => {
        const [user] = await tx.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
        if (!user || user.jnvName !== actor.jnvName || user.jnvState !== actor.jnvState || user.verificationStatus !== "verified" || user.role === "alumni") return false;
        const [approved] = await tx.select().from(verificationRequestsTable).where(and(
          eq(verificationRequestsTable.userId, user.id), eq(verificationRequestsTable.status, "approved"),
          eq(verificationRequestsTable.role, user.role), eq(verificationRequestsTable.jnvName, user.jnvName), eq(verificationRequestsTable.jnvState, user.jnvState),
          eq(verificationRequestsTable.adminRecommendation, "approval"),
        )).orderBy(desc(verificationRequestsTable.officialReviewedAt)).limit(1);
        if (!approved || !approved.officialReviewedBy || !approved.officialReviewedAt || !hasEvidence(approved)) return false;
        const issued = await issueDigitalCredential(tx, user, jnvId, actor.id, user.role);
        if (!issued.created) return false;
        const { credential } = issued;
        await tx.insert(verificationAuditTable).values({ requestId: approved.id, actorId: actor.id, subjectUserId: user.id, jnvId, action: "legacy_credential_reconciled", toStatus: "active", reason: `Reconciled from existing official approval; credential ${credential.credentialId}` });
        await tx.insert(socialNotificationsTable).values({ recipientId: user.id, actorId: actor.id, type: "verification_approved", entityId: approved.id, message: "Your existing approved verification now has a Navodaya Connect Digital ID." });
        return true;
      });
      if (didIssue) issued += 1;
      else skipped += 1;
    }
    return res.json({ issued, skipped });
  } catch (error) {
    req.log.error(error, "Failed to reconcile legacy credentials");
    return res.status(500).json({ error: "Failed to reconcile credentials" });
  }
});

router.get("/verification/my-credential", requireAuth, async (req, res) => {
  const actor = getUser(req);
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from users where id = ${actor.id} for update`);
      const [account] = await tx.select().from(usersTable).where(eq(usersTable.id, actor.id)).limit(1);
      const eligible = account && (account.role === "alumni"
        ? account.verificationStatus === "community_verified" && Boolean(account.communityVerifiedAt)
        : account.verificationStatus === "verified");
      if (!account || !eligible) return { error: "unverified" as const };

      let [credential] = await tx.select().from(digitalCredentialsTable).where(and(
        eq(digitalCredentialsTable.userId, actor.id), eq(digitalCredentialsTable.status, "active"),
      )).limit(1);
      let matchedApprovalId: string | null = null;

      if (!credential) {
        const jnvId = account.jnvId || makeJnvId(account.jnvState, account.jnvName);
        const approvals = await tx.select().from(verificationRequestsTable).where(and(
          eq(verificationRequestsTable.userId, account.id),
          eq(verificationRequestsTable.role, account.role),
          eq(verificationRequestsTable.status, "approved"),
          eq(verificationRequestsTable.jnvName, account.jnvName),
          eq(verificationRequestsTable.jnvState, account.jnvState),
        )).orderBy(desc(verificationRequestsTable.reviewedAt), desc(verificationRequestsTable.createdAt)).limit(10);

        for (const approval of approvals) {
          if (account.role === "alumni") {
            if (approval.method !== "alumni_peer" || !approval.reviewedBy || !account.communityVerifiedAt) continue;
            const [confirmation] = await tx.select({ id: verificationAuditTable.id }).from(verificationAuditTable).where(and(
              eq(verificationAuditTable.requestId, approval.id),
              eq(verificationAuditTable.subjectUserId, account.id),
              eq(verificationAuditTable.actorId, approval.reviewedBy),
              eq(verificationAuditTable.action, "alumni_peer_confirmed"),
              eq(verificationAuditTable.jnvId, jnvId),
            )).limit(1);
            if (!confirmation) continue;
            const issued = await issueDigitalCredential(tx, account, jnvId, approval.reviewedBy, "alumni");
            credential = issued.credential;
            matchedApprovalId = approval.id;
            break;
          }

          const officialId = approval.officialReviewedBy || approval.reviewedBy;
          const officialReviewTime = approval.officialReviewedAt || approval.reviewedAt;
          if (approval.method === "alumni_peer" || !officialId || !officialReviewTime || !hasEvidence(approval)) continue;
          const [officialApproval] = await tx.select({ id: verificationAuditTable.id }).from(verificationAuditTable).where(and(
            eq(verificationAuditTable.requestId, approval.id),
            eq(verificationAuditTable.subjectUserId, account.id),
            eq(verificationAuditTable.actorId, officialId),
            eq(verificationAuditTable.action, "official_approved"),
            eq(verificationAuditTable.jnvId, jnvId),
          )).limit(1);
          if (!officialApproval) continue;
          const issued = await issueDigitalCredential(tx, account, jnvId, officialId, account.role);
          credential = issued.credential;
          matchedApprovalId = approval.id;
          break;
        }

        // Verification status is the authoritative eligibility check for accounts
        // approved before Digital ID issuance was added. New approvals issue the
        // credential in the approval transaction above; this backfills older
        // verified accounts the first time their profile or Digital ID is opened.
        // Alumni must still have an explicit community_verified status and date,
        // as enforced by `eligible` above.
        if (!credential) {
          const issued = await issueDigitalCredential(tx, account, jnvId, account.id, account.role);
          credential = issued.credential;
        }

        if (credential) {
          await tx.insert(verificationAuditTable).values({
            requestId: matchedApprovalId,
            actorId: credential.issuedBy,
            subjectUserId: account.id,
            jnvId: credential.jnvId,
            action: matchedApprovalId ? "digital_id_backfilled_on_access" : "digital_id_issued_for_verified_account",
            fromStatus: account.verificationStatus,
            toStatus: "active",
            reason: matchedApprovalId
              ? `Issued ${credential.credentialId} from an existing completed verification record`
              : `Issued ${credential.credentialId} because this account already has an eligible verified status`,
          });
        }
      }

      if (!credential || credential.role !== account.role) return { error: "missing" as const };
      return { account, credential };
    });

    if ("error" in result) {
      if (result.error === "unverified") return res.status(403).json({ error: "Complete the required verification before accessing a Digital ID." });
      return res.status(404).json({ error: "No matching completed verification approval was found for this Digital ID." });
    }

    const { account, credential } = result;
    const publicAppUrl = getPublicAppUrl();
    return res.json({
      credentialId: credential.credentialId,
      userId: account.id,
      fullName: account.fullName,
      photoURL: account.photoURL,
      publicVerificationUrl: publicAppUrl ? `${publicAppUrl}/verify/${credential.publicToken}` : null,
      publicProfileUrl: publicAppUrl ? `${publicAppUrl}/profile/${account.id}` : null,
      status: credential.status,
      role: credential.role,
      jnvName: credential.jnvName,
      jnvState: credential.jnvState,
      issuedAt: credential.issuedAt,
    });
  } catch (error) {
    req.log.error(error, "Failed to load or restore the caller's Digital ID");
    return res.status(500).json({ error: "Could not load your Digital ID." });
  }
});

router.get("/verification/public/:token", async (req, res) => {
  try {
    const remote = req.ip || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const recent = (publicLookups.get(remote) ?? []).filter((timestamp) => now - timestamp < 60_000);
    if (!recent.length) publicLookups.delete(remote);
    if (recent.length >= 30) return res.status(429).json({ error: "Too many credential lookups. Try again shortly." });
    recent.push(now);
    publicLookups.set(remote, recent);
    const token = typeof req.params.token === "string" ? req.params.token : "";
    if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return res.status(404).json({ status: "not_found" });
    const [credential] = await db.select().from(digitalCredentialsTable).where(eq(digitalCredentialsTable.publicToken, token)).limit(1);
    if (!credential) return res.status(404).json({ status: "not_found" });
    return res.json({ status: credential.status === "active" ? "valid" : credential.status, credentialId: credential.credentialId, role: credential.role, jnvName: credential.jnvName, jnvState: credential.jnvState, issuedAt: credential.issuedAt });
  } catch (error) {
    req.log.error(error, "Failed to verify public credential");
    return res.status(500).json({ error: "Credential lookup failed" });
  }
});

router.get("/verification/assignments", requireAuth, async (req, res) => {
  const actor = getUser(req);
  const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
  if (!await hasAssignment(actor.id, jnvId, "official")) return res.status(403).json({ error: "Only an authorized school official can manage reviewers" });
  const rows = await db.select({ id: verificationAssignmentsTable.id, userId: verificationAssignmentsTable.userId, jnvName: verificationAssignmentsTable.jnvName, jnvState: verificationAssignmentsTable.jnvState, assignmentRole: verificationAssignmentsTable.assignmentRole, active: verificationAssignmentsTable.active, fullName: usersTable.fullName, email: usersTable.email, role: usersTable.role }).from(verificationAssignmentsTable).innerJoin(usersTable, eq(usersTable.id, verificationAssignmentsTable.userId)).where(and(eq(verificationAssignmentsTable.jnvId, jnvId), eq(verificationAssignmentsTable.active, true)));
  return res.json(rows);
});

router.post("/verification/assignments", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
    if (!await hasAssignment(actor.id, jnvId, "official")) return res.status(403).json({ error: "Only an authorized school official can appoint reviewers" });
    const userId = typeof req.body?.userId === "string" ? req.body.userId : "";
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    if (!target || makeJnvId(target.jnvState, target.jnvName) !== jnvId) return res.status(404).json({ error: "Select an existing user from your JNV" });
    if (target.id === actor.id || target.role === "official" || (target.role === "alumni" ? !(target.verificationStatus === "community_verified" && target.communityVerifiedAt) : target.verificationStatus !== "verified")) return res.status(400).json({ error: "A reviewer must be a different community verified alumnus or verified student or teacher at this JNV" });
    const [existing] = await db.select().from(verificationAssignmentsTable).where(and(eq(verificationAssignmentsTable.userId, target.id), eq(verificationAssignmentsTable.jnvId, jnvId), eq(verificationAssignmentsTable.assignmentRole, "admin"))).limit(1);
    const [assignment] = existing
      ? await db.update(verificationAssignmentsTable).set({ active: true, assignedBy: actor.id, updatedAt: new Date() }).where(eq(verificationAssignmentsTable.id, existing.id)).returning()
      : await db.insert(verificationAssignmentsTable).values({ userId: target.id, jnvId, jnvName: target.jnvName, jnvState: target.jnvState, assignmentRole: "admin", assignedBy: actor.id }).returning();
    await db.insert(verificationAuditTable).values({ actorId: actor.id, subjectUserId: target.id, jnvId, action: "reviewer_appointed", reason: "School verification admin appointed" });
    await notify(target.id, actor.id, "verification_admin_appointed", assignment.id, "You have been appointed as a verification reviewer for your JNV.");
    return res.status(201).json(assignment);
  } catch (error) {
    req.log.error(error, "Failed to appoint reviewer");
    return res.status(500).json({ error: "Failed to appoint reviewer" });
  }
});

router.delete("/verification/assignments/:id", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [assignment] = await db.select().from(verificationAssignmentsTable).where(eq(verificationAssignmentsTable.id, req.params.id as string)).limit(1);
    if (!assignment) return res.status(404).json({ error: "Reviewer assignment not found" });
    if (!await hasAssignment(actor.id, assignment.jnvId, "official")) return res.status(403).json({ error: "Only an authorized official for this JNV can remove reviewers" });
    await db.update(verificationAssignmentsTable).set({ active: false, updatedAt: new Date() }).where(eq(verificationAssignmentsTable.id, assignment.id));
    await db.insert(verificationAuditTable).values({ actorId: actor.id, subjectUserId: assignment.userId, jnvId: assignment.jnvId, action: "reviewer_removed", reason: "School verification admin assignment removed" });
    await notify(assignment.userId, actor.id, "verification_admin_removed", assignment.id, "Your verification reviewer permissions have been removed.");
    return res.json({ success: true });
  } catch (error) {
    req.log.error(error, "Failed to remove reviewer");
    return res.status(500).json({ error: "Failed to remove reviewer" });
  }
});

router.get("/verification/audit", requireAuth, async (req, res) => {
  const actor = getUser(req);
  const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
  if (!await hasAssignment(actor.id, jnvId, "official")) return res.status(403).json({ error: "Only an authorized school official can view the audit history" });
  const rows = await db.select().from(verificationAuditTable).where(eq(verificationAuditTable.jnvId, jnvId)).orderBy(desc(verificationAuditTable.createdAt)).limit(500);
  return res.json(rows);
});

router.patch("/users/:id/suspend", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id as string)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.role === "alumni") return res.status(410).json({ error: "Alumni status is moderated through peer-verification reports." });
    const jnvId = makeJnvId(target.jnvState, target.jnvName);
    if (target.id === actor.id || !await hasAssignment(actor.id, jnvId, "official")) return res.status(403).json({ error: "Only an authorized JNV official can update another member's credential status" });
    const suspended = req.body?.suspended === true;
    if (suspended && target.verificationStatus !== "verified") return res.status(409).json({ error: "Only currently verified users can be suspended" });
    if (!suspended && target.verificationStatus !== "suspended") return res.status(409).json({ error: "Only suspended users can be reactivated" });
    const [credential] = await db.select().from(digitalCredentialsTable).where(eq(digitalCredentialsTable.userId, target.id)).limit(1);
    if (!credential || (suspended && credential.status !== "active") || (!suspended && credential.status !== "suspended")) return res.status(409).json({ error: "An active Navodaya Connect credential is required" });
    const status = suspended ? "suspended" : "verified";
    const updated = await db.transaction(async (tx) => {
      const [row] = await tx.update(usersTable).set({ verificationStatus: status }).where(eq(usersTable.id, target.id)).returning();
      await tx.update(digitalCredentialsTable).set({ status: suspended ? "suspended" : "active", updatedAt: new Date() }).where(eq(digitalCredentialsTable.id, credential.id));
      await tx.insert(verificationAuditTable).values({ actorId: actor.id, subjectUserId: target.id, jnvId, action: suspended ? "credential_suspended" : "credential_reactivated", fromStatus: target.verificationStatus ?? null, toStatus: status });
      return row;
    });
    const { passwordHash, ...safe } = updated;
    await notify(target.id, actor.id, suspended ? "credential_suspended" : "credential_reactivated", target.id, suspended ? "Your Navodaya Connect credential was suspended by your JNV." : "Your Navodaya Connect credential was reactivated.");
    return res.json(safe);
  } catch (error) {
    req.log.error(error, "Failed to update credential status");
    return res.status(500).json({ error: "Failed to update user status" });
  }
});

router.get("/users/manage", requireAuth, async (req, res) => {
  try {
    const actor = getUser(req);
    const jnvId = makeJnvId(actor.jnvState, actor.jnvName);
    if (!await hasAssignment(actor.id, jnvId, "official") && !await hasAssignment(actor.id, jnvId, "admin")) return res.status(403).json({ error: "Assigned school verification staff only" });
    const users = await db.select().from(usersTable).where(and(eq(usersTable.jnvName, actor.jnvName), eq(usersTable.jnvState, actor.jnvState)));
    return res.json(users.map(({ passwordHash, ...user }) => ({ ...user, skills: user.skills ? JSON.parse(user.skills) : [] })));
  } catch (error) {
    req.log.error(error, "Failed to fetch school users");
    return res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
