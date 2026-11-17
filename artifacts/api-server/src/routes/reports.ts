import { Router } from "express";
import { db, reportsTable, contentReportsTable, digitalCredentialsTable, usersTable, verificationAssignmentsTable, verificationAuditTable, socialNotificationsTable } from "@workspace/db";
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { getUser, isCommunityVerifiedAlumni, requireAuth } from "../lib/auth";
import { isSelfReport, isValidUserId } from "./user-validation";
import { makeJnvId } from "../lib/jnv-identity";
import { hasValidAlumniSchool } from "../lib/alumni-peer-policy";

const router = Router();
const REPORT_REASONS = new Set([
  "Harassment or Bullying",
  "Spam or Fake Account",
  "Inappropriate Content",
  "Impersonation",
  "Hate Speech or Abuse",
  "Cheating or Academic Fraud",
  "Suspected false alumni claim",
  "Incorrect JNV association",
  "Fraudulent verification behavior",
  "Privacy Violation",
  "Other",
]);

router.get("/reports/alumni", requireAuth, async (req, res) => {
  try {
    const moderator = getUser(req);
    const jnvId = moderator.jnvId || makeJnvId(moderator.jnvState, moderator.jnvName);
    const [assignment] = await db.select({ id: verificationAssignmentsTable.id }).from(verificationAssignmentsTable).where(and(
      eq(verificationAssignmentsTable.userId, moderator.id), eq(verificationAssignmentsTable.jnvId, jnvId),
      inArray(verificationAssignmentsTable.assignmentRole, ["official", "admin"]), eq(verificationAssignmentsTable.active, true),
    )).limit(1);
    if (!assignment) return res.status(403).json({ error: "Assigned JNV moderation access required." });
    const rows = await db.select({
      id: reportsTable.id, reportedUserId: reportsTable.reportedUserId, reportedUserName: reportsTable.reportedUserName,
      reason: reportsTable.reason, details: reportsTable.details, reporterId: reportsTable.reporterId,
      reporterName: reportsTable.reporterName, status: reportsTable.status, createdAt: reportsTable.createdAt,
      targetStatus: usersTable.verificationStatus, hasPeerConfirmation: usersTable.communityVerifiedAt,
    }).from(reportsTable).innerJoin(usersTable, eq(usersTable.id, reportsTable.reportedUserId)).where(and(
      eq(usersTable.role, "alumni"), eq(usersTable.jnvId, jnvId), ne(reportsTable.reportedUserId, moderator.id),
    )).orderBy(desc(reportsTable.createdAt)).limit(200);
    return res.json(rows.map((row) => ({ ...row, hasPeerConfirmation: Boolean(row.hasPeerConfirmation) })));
  } catch (error) {
    req.log.error(error, "Failed to load alumni moderation reports");
    return res.status(500).json({ error: "Could not load alumni reports." });
  }
});

router.post("/reports", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { reportedUserId, reason, details } = req.body ?? {};
    if (!isValidUserId(reportedUserId)) {
      return res.status(400).json({ error: "A valid target user is required" });
    }
    if (isSelfReport(user.id, reportedUserId)) {
      return res.status(400).json({ error: "You cannot report yourself" });
    }
    if (typeof reason !== "string" || !REPORT_REASONS.has(reason)) {
      return res.status(400).json({ error: "Select a valid report reason" });
    }
    if (details !== undefined && typeof details !== "string") {
      return res.status(400).json({ error: "Invalid report details" });
    }
    if (typeof details === "string" && details.length > 1000) {
      return res.status(400).json({ error: "Report details must be 1,000 characters or fewer" });
    }

    const [target] = await db.select({ id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role,
      jnvId: usersTable.jnvId, jnvName: usersTable.jnvName, jnvState: usersTable.jnvState })
      .from(usersTable)
      .where(eq(usersTable.id, reportedUserId))
      .limit(1);
    if (!target) return res.status(404).json({ error: "Reported user not found" });
    if (user.role === "alumni" && !isCommunityVerifiedAlumni(user)) {
      if (!hasValidAlumniSchool(user) || target.role !== "alumni" || target.jnvId !== user.jnvId) return res.status(404).json({ error: "Reported user not found" });
    }

    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from users where id = ${target.id} for update`);
      const [duplicate] = await tx.select().from(reportsTable).where(and(
        eq(reportsTable.reportedUserId, target.id), eq(reportsTable.reporterId, user.id), inArray(reportsTable.status, ["pending", "under_review"]),
      )).orderBy(desc(reportsTable.createdAt)).limit(1);
      if (duplicate) return { row: duplicate, duplicate: true };
      const [row] = await tx.insert(reportsTable).values({
        reportedUserId: target.id, reportedUserName: target.fullName, reason,
        details: details?.trim() || undefined, reporterId: user.id, reporterName: user.fullName, status: "pending",
      }).returning();
      const [targetSchool] = await tx.select({ jnvState: usersTable.jnvState, jnvName: usersTable.jnvName }).from(usersTable).where(eq(usersTable.id, target.id)).limit(1);
      const targetJnvId = makeJnvId(targetSchool.jnvState, targetSchool.jnvName);
      const moderators = await tx.select({ userId: verificationAssignmentsTable.userId }).from(verificationAssignmentsTable).where(and(
        eq(verificationAssignmentsTable.jnvId, targetJnvId), inArray(verificationAssignmentsTable.assignmentRole, ["official", "admin"]), eq(verificationAssignmentsTable.active, true),
      ));
      if (moderators.length) await tx.insert(socialNotificationsTable).values(moderators.map((m) => ({
        recipientId: m.userId, actorId: user.id, type: "alumni_report_received", entityId: row.id, message: "A private alumni community report needs review.",
      })));
      return { row, duplicate: false };
    });
    return res.status(result.duplicate ? 200 : 201).json({ ...result.row, duplicate: result.duplicate });
  } catch (e) {
    req.log.error(e, "report error");
    res.status(500).json({ error: "Failed to submit report" });
  }
});

router.post("/reports/:id/alumni-review", requireAuth, async (req, res) => {
  try {
    const moderator = getUser(req);
    const reportId = req.params.id as string;
    const action = req.body?.action;
    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
    if (!isValidUserId(reportId)) return res.status(400).json({ error: "Invalid report ID." });
    if (!["begin_review", "suspend", "revoke", "complete_review", "allow_peer_retry"].includes(action)) return res.status(400).json({ error: "Choose a valid moderation action." });
    if (!reason) return res.status(400).json({ error: "Record a reason for this moderation action." });
    const [report] = await db.select().from(reportsTable).where(eq(reportsTable.id, reportId)).limit(1);
    if (!report?.reportedUserId) return res.status(404).json({ error: "Report not found." });
    const targetId = report.reportedUserId;
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target || target.role !== "alumni") return res.status(404).json({ error: "Alumni report not found." });
    const jnvId = target.jnvId || makeJnvId(target.jnvState, target.jnvName);
    const [assignment] = await db.select({ id: verificationAssignmentsTable.id }).from(verificationAssignmentsTable).where(and(
      eq(verificationAssignmentsTable.userId, moderator.id), eq(verificationAssignmentsTable.jnvId, jnvId),
      inArray(verificationAssignmentsTable.assignmentRole, ["official", "admin"]), eq(verificationAssignmentsTable.active, true),
    )).limit(1);
    if (!assignment || moderator.id === target.id) return res.status(403).json({ error: "Assigned JNV moderation access is required." });
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from users where id = ${targetId} for update`);
      const [freshTarget] = await tx.select({ verificationStatus: usersTable.verificationStatus, communityVerifiedAt: usersTable.communityVerifiedAt })
        .from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
      if (!freshTarget) return { error: "Alumni account no longer exists." };
      const fromStatus = freshTarget.verificationStatus ?? "unverified";
      let toStatus = fromStatus;
      if (action === "begin_review") {
        if (!["community_verified", "unverified", "verified", "under_review"].includes(fromStatus)) return { error: "This account cannot enter review from its current status." };
        toStatus = "under_review";
      } else if (action === "suspend") {
        if (!freshTarget.communityVerifiedAt || !["community_verified", "under_review"].includes(fromStatus)) return { error: "Only an account with peer confirmation can be suspended." };
        toStatus = "suspended";
      } else if (action === "revoke") {
        if (!freshTarget.communityVerifiedAt || !["community_verified", "under_review", "suspended"].includes(fromStatus)) return { error: "Only an account with peer confirmation can have it revoked." };
        toStatus = "revoked";
      } else if (action === "complete_review") {
        // Completing review restores access only when a real peer confirmation exists.
        if (!["under_review", "suspended"].includes(fromStatus)) return { error: "Only a case under review or suspended account can complete review." };
        toStatus = freshTarget.communityVerifiedAt ? "community_verified" : "unverified";
      } else {
        if (!["suspended", "revoked"].includes(fromStatus)) return { error: "Peer retry can be allowed only after suspension or revocation." };
        toStatus = "unverified";
      }
      await tx.update(usersTable).set({ verificationStatus: toStatus, ...(action === "allow_peer_retry" ? { communityVerifiedAt: null } : {}) }).where(eq(usersTable.id, targetId));
      if (action === "suspend" || action === "revoke") {
        await tx.update(digitalCredentialsTable).set({ status: action === "suspend" ? "suspended" : "revoked", updatedAt: new Date() }).where(and(
          eq(digitalCredentialsTable.userId, targetId), eq(digitalCredentialsTable.status, "active"),
        ));
      } else if (action === "complete_review" && toStatus === "community_verified") {
        await tx.update(digitalCredentialsTable).set({ status: "active", updatedAt: new Date() }).where(and(
          eq(digitalCredentialsTable.userId, targetId), eq(digitalCredentialsTable.status, "suspended"),
        ));
      }
      await tx.update(reportsTable).set({ status: action === "begin_review" ? "under_review" : "reviewed" }).where(eq(reportsTable.id, report.id));
      await tx.insert(verificationAuditTable).values({ reportId: report.id, actorId: moderator.id, subjectUserId: target.id, jnvId,
        action: `alumni_moderation_${action}`, fromStatus, toStatus, reason });
      await tx.insert(socialNotificationsTable).values({ recipientId: target.id, actorId: moderator.id, type: "alumni_moderation_update", entityId: report.id,
        message: action === "begin_review" ? "Your alumni account is under review. You can still use account support and appeal." : `A moderator updated your alumni verification status to ${toStatus.replaceAll("_", " ")}.` });
      return { toStatus };
    });
    if ("error" in result) return res.status(409).json({ error: result.error });
    return res.json({ success: true, status: result.toStatus });
  } catch (error) {
    req.log.error(error, "Failed to moderate alumni report");
    return res.status(500).json({ error: "Could not update the alumni moderation case." });
  }
});

router.get("/reports", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "official") {
      const own = await db.select().from(reportsTable)
        .where(eq(reportsTable.reporterId, user.id)).orderBy(desc(reportsTable.createdAt));
      const contentReports = await db.select().from(contentReportsTable).where(eq(contentReportsTable.reporterId, user.id)).orderBy(desc(contentReportsTable.createdAt));
      return res.json([...own, ...contentReports]);
    }
    const jnvId = makeJnvId(user.jnvState, user.jnvName);
    const [assignment] = await db.select({ id: verificationAssignmentsTable.id })
      .from(verificationAssignmentsTable)
      .where(and(
        eq(verificationAssignmentsTable.userId, user.id),
        eq(verificationAssignmentsTable.jnvId, jnvId),
        eq(verificationAssignmentsTable.assignmentRole, "official"),
        eq(verificationAssignmentsTable.active, true),
      )).limit(1);
    if (!assignment) return res.status(403).json({ error: "Assigned school official access required" });

    const schoolUsers = await db.select({ id: usersTable.id }).from(usersTable).where(and(
      eq(usersTable.jnvName, user.jnvName),
      eq(usersTable.jnvState, user.jnvState),
    ));
    const rows = schoolUsers.length
      ? await db.select().from(reportsTable)
        .where(and(inArray(reportsTable.reportedUserId, schoolUsers.map((schoolUser) => schoolUser.id)), ne(reportsTable.reportedUserId, user.id)))
        .orderBy(desc(reportsTable.createdAt))
      : [];
    const contentRows = await db.select().from(contentReportsTable).where(and(eq(contentReportsTable.status, "pending"), ne(contentReportsTable.targetUserId, user.id))).orderBy(desc(contentReportsTable.createdAt));
    const scopedContentRows = contentRows.filter((row) => row.targetUserId && schoolUsers.some((schoolUser) => schoolUser.id === row.targetUserId));
    res.json([...rows, ...scopedContentRows]);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

router.patch("/reports/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "official") return res.status(403).json({ error: "Assigned school official access required" });
    const jnvId = user.jnvId || makeJnvId(user.jnvState, user.jnvName);
    const [assignment] = await db.select({ id: verificationAssignmentsTable.id })
      .from(verificationAssignmentsTable).where(and(
        eq(verificationAssignmentsTable.userId, user.id),
        eq(verificationAssignmentsTable.jnvId, jnvId),
        eq(verificationAssignmentsTable.assignmentRole, "official"),
        eq(verificationAssignmentsTable.active, true),
      )).limit(1);
    if (!assignment) return res.status(403).json({ error: "Assigned school official access required" });
    const status = req.body?.status;
    if (status !== "reviewed" && status !== "dismissed" && status !== "escalated") {
      return res.status(400).json({ error: "Choose reviewed, dismissed, or escalated" });
    }
    const [current] = await db.select().from(reportsTable)
      .where(eq(reportsTable.id, req.params.id as string)).limit(1);
    if (!current?.reportedUserId) return res.status(404).json({ error: "Report not found" });
    const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(and(
      eq(usersTable.id, current.reportedUserId),
      eq(usersTable.jnvName, user.jnvName),
      eq(usersTable.jnvState, user.jnvState),
    )).limit(1);
    if (!target) return res.status(404).json({ error: "Report not found for this school" });
    if (target.id === user.id) return res.status(404).json({ error: "Report not found" });
    const [updated] = await db.update(reportsTable).set({ status })
      .where(and(eq(reportsTable.id, current.id), eq(reportsTable.reportedUserId, target.id)))
      .returning();
    if (!updated) return res.status(404).json({ error: "Report not found" });
    await db.insert(verificationAuditTable).values({
      actorId: user.id,
      subjectUserId: target.id,
      jnvId,
      action: `report_${status}`,
      fromStatus: current.status,
      toStatus: status,
      reason: `Community report ${updated.id} status updated by assigned JNV official`,
    });
    return res.json(updated);
  } catch (error) {
    req.log.error(error, "Failed to update report status");
    return res.status(500).json({ error: "Failed to update report" });
  }
});

export default router;
