import { Router } from "express";
import { and, desc, eq, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import {
  alumniPeerDecisionsTable, db, socialNotificationsTable, userBlocksTable, usersTable,
  reportsTable, verificationAssignmentsTable, verificationAuditTable, verificationRequestsTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { issueDigitalCredential } from "../lib/digital-credential";
import { makeJnvId } from "../lib/jnv-identity";
import { isValidUserId } from "./user-validation";
import { alumniPeerEligibility, hasValidAlumniSchool } from "../lib/alumni-peer-policy";

const router = Router();
const OPEN = ["pending", "info_requested", "recommended_approval", "recommended_rejection", "awaiting_official_decision"];
const validSchool = (user: typeof usersTable.$inferSelect) => hasValidAlumniSchool(user);
const effectiveStatus = (user: typeof usersTable.$inferSelect) => {
  if (user.verificationStatus === "verified" && user.role === "alumni" && !user.communityVerifiedAt) return "legacy_approval_peer_required";
  if (user.verificationStatus === "community_verified" && user.communityVerifiedAt) return "community_verified";
  if (["under_review", "suspended", "revoked"].includes(user.verificationStatus ?? "")) return user.verificationStatus;
  return "unverified";
};

router.use(requireAuth);

router.get("/alumni-verification/status", async (req, res) => {
  const user = getUser(req);
  if (user.role !== "alumni") return res.status(403).json({ error: "This flow is for alumni accounts." });
  const [request] = await db.select({
    id: verificationRequestsTable.id, status: verificationRequestsTable.status,
    createdAt: verificationRequestsTable.createdAt, method: verificationRequestsTable.method,
  }).from(verificationRequestsTable).where(and(
    eq(verificationRequestsTable.userId, user.id), eq(verificationRequestsTable.method, "alumni_peer"),
  )).orderBy(desc(verificationRequestsTable.createdAt)).limit(1);
  const decisions = await db.select({ decision: alumniPeerDecisionsTable.decision, createdAt: alumniPeerDecisionsTable.createdAt })
    .from(alumniPeerDecisionsTable).where(eq(alumniPeerDecisionsTable.applicantId, user.id)).orderBy(desc(alumniPeerDecisionsTable.createdAt));
  const moderationCases = await db.select({ id: reportsTable.id, status: reportsTable.status, createdAt: reportsTable.createdAt })
    .from(reportsTable).where(eq(reportsTable.reportedUserId, user.id)).orderBy(desc(reportsTable.createdAt)).limit(20);
  return res.json({ verificationStatus: effectiveStatus(user), request: request ?? null, confirmations: decisions.filter((d) => d.decision === "confirmed").length, moderationCases });
});

router.get("/alumni-verification/peers", async (req, res) => {
  const user = getUser(req);
  if (user.role !== "alumni") return res.status(403).json({ error: "This flow is for alumni accounts." });
  if (!validSchool(user)) return res.status(409).json({ code: "SCHOOL_ASSOCIATION_REVIEW_REQUIRED", error: "Your stored JNV association needs review before alumni matching." });
  const peers = await db.select({
    id: usersTable.id, fullName: usersTable.fullName, photoURL: usersTable.photoURL,
    passoutYear: usersTable.passoutYear, enrollYear: usersTable.enrollYear,
    verificationStatus: usersTable.verificationStatus, communityVerifiedAt: usersTable.communityVerifiedAt,
  }).from(usersTable).where(and(
    eq(usersTable.role, "alumni"), eq(usersTable.jnvId, user.jnvId!), ne(usersTable.id, user.id),
  )).orderBy(usersTable.fullName).limit(100);
  const blocked = await db.select({ blockerId: userBlocksTable.blockerId, blockedId: userBlocksTable.blockedId }).from(userBlocksTable).where(or(
    eq(userBlocksTable.blockerId, user.id), eq(userBlocksTable.blockedId, user.id),
  ));
  const hiddenIds = new Set(blocked.map((row) => row.blockerId === user.id ? row.blockedId : row.blockerId));
  const [request] = await db.select({ id: verificationRequestsTable.id })
    .from(verificationRequestsTable).where(and(eq(verificationRequestsTable.userId, user.id), eq(verificationRequestsTable.method, "alumni_peer"), inArray(verificationRequestsTable.status, OPEN))).limit(1);
  const decisions = request ? await db.select({ confirmerId: alumniPeerDecisionsTable.confirmerId, decision: alumniPeerDecisionsTable.decision })
    .from(alumniPeerDecisionsTable).where(eq(alumniPeerDecisionsTable.requestId, request.id)) : [];
  const responded = new Map(decisions.map((d) => [d.confirmerId, d.decision]));
  return res.json({ requestId: request?.id ?? null, peers: peers.filter((p) => !hiddenIds.has(p.id)).map((p) => ({
    id: p.id, fullName: p.fullName, photoURL: p.photoURL, passoutYear: p.passoutYear, enrollYear: p.enrollYear,
    status: effectiveStatus({ ...user, ...p, role: "alumni", jnvId: user.jnvId, jnvName: user.jnvName, jnvState: user.jnvState } as typeof user),
    response: responded.get(p.id) ?? null,
  })) });
});

router.post("/alumni-verification/request", async (req, res) => {
  const user = getUser(req);
  if (user.role !== "alumni") return res.status(403).json({ error: "This flow is for alumni accounts." });
  if (!validSchool(user)) return res.status(409).json({ code: "SCHOOL_ASSOCIATION_REVIEW_REQUIRED", error: "Your stored JNV association needs review before requesting confirmation." });
  if (["under_review", "suspended", "revoked"].includes(user.verificationStatus ?? "")) return res.status(403).json({ error: "Your account needs moderator review before requesting peer confirmation." });
  if (user.verificationStatus === "community_verified" && user.communityVerifiedAt) return res.status(409).json({ error: "Your account is already community verified." });
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from users where id = ${user.id} for update`);
      const [currentUser] = await tx.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
      if (!currentUser || currentUser.role !== "alumni" || !validSchool(currentUser)) throw new Error("ALUMNI_SCHOOL_ASSOCIATION_CHANGED");
      if (["under_review", "suspended", "revoked"].includes(currentUser.verificationStatus ?? "")) throw new Error("ALUMNI_MODERATION_RESTRICTED");
      if (currentUser.verificationStatus === "community_verified" && currentUser.communityVerifiedAt) throw new Error("ALUMNI_ALREADY_COMMUNITY_VERIFIED");
      const [existing] = await tx.select().from(verificationRequestsTable).where(and(
        eq(verificationRequestsTable.userId, currentUser.id), eq(verificationRequestsTable.method, "alumni_peer"), inArray(verificationRequestsTable.status, OPEN),
      )).limit(1);
      if (existing) return { request: existing, created: false };
      await tx.update(verificationRequestsTable).set({ status: "superseded_peer_only", updatedAt: new Date() }).where(and(
        eq(verificationRequestsTable.userId, user.id), inArray(verificationRequestsTable.status, OPEN),
      ));
      const [created] = await tx.insert(verificationRequestsTable).values({
        userId: currentUser.id, userFullName: currentUser.fullName, userEmail: currentUser.email, role: "alumni",
        jnvName: currentUser.jnvName, jnvState: currentUser.jnvState, method: "alumni_peer", status: "pending",
      }).returning();
      const peers = await tx.select({ id: usersTable.id }).from(usersTable).where(and(
        eq(usersTable.role, "alumni"), eq(usersTable.jnvId, currentUser.jnvId!), ne(usersTable.id, currentUser.id),
        notInArray(usersTable.verificationStatus, ["under_review", "suspended", "revoked"]),
      ));
      const blocked = await tx.select({ blockerId: userBlocksTable.blockerId, blockedId: userBlocksTable.blockedId }).from(userBlocksTable).where(or(
        eq(userBlocksTable.blockerId, currentUser.id), eq(userBlocksTable.blockedId, currentUser.id),
      ));
      const blockedIds = new Set(blocked.map((row) => row.blockerId === currentUser.id ? row.blockedId : row.blockerId));
      const notifyPeers = peers.filter((p) => !blockedIds.has(p.id));
      if (notifyPeers.length) await tx.insert(socialNotificationsTable).values(notifyPeers.map((p) => ({
        recipientId: p.id, actorId: currentUser.id, type: "alumni_peer_request", entityId: created.id,
        message: `${currentUser.fullName} is requesting an alumni confirmation for your JNV.`,
      })));
      await tx.insert(verificationAuditTable).values({
        requestId: created.id, actorId: currentUser.id, subjectUserId: currentUser.id, jnvId: currentUser.jnvId!,
        action: "alumni_peer_request_created", fromStatus: effectiveStatus(currentUser), toStatus: "unverified",
      });
      return { request: created, created: true };
    });
    return res.status(result.created ? 201 : 200).json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ALUMNI_SCHOOL_ASSOCIATION_CHANGED") return res.status(409).json({ code: "SCHOOL_ASSOCIATION_REVIEW_REQUIRED", error: "Your stored JNV association changed; refresh and request a school association review." });
    if (error instanceof Error && error.message === "ALUMNI_MODERATION_RESTRICTED") return res.status(403).json({ error: "Your account needs moderator review before requesting peer confirmation." });
    if (error instanceof Error && error.message === "ALUMNI_ALREADY_COMMUNITY_VERIFIED") return res.status(409).json({ error: "Your account is already community verified." });
    req.log.error(error, "Failed to create alumni peer verification request");
    return res.status(500).json({ error: "Could not create the peer verification request." });
  }
});

router.get("/alumni-verification/inbox", async (req, res) => {
  const user = getUser(req);
  if (user.role !== "alumni") return res.status(403).json({ error: "This flow is for alumni accounts." });
  if (!validSchool(user)) return res.status(409).json({ code: "SCHOOL_ASSOCIATION_REVIEW_REQUIRED", error: "Your stored JNV association needs review before alumni matching." });
  if (["under_review", "suspended", "revoked"].includes(user.verificationStatus ?? "")) return res.json([]);
  const requests = await db.select({ id: verificationRequestsTable.id, userId: verificationRequestsTable.userId,
    fullName: usersTable.fullName, photoURL: usersTable.photoURL, passoutYear: usersTable.passoutYear,
    enrollYear: usersTable.enrollYear, createdAt: verificationRequestsTable.createdAt,
  }).from(verificationRequestsTable).innerJoin(usersTable, eq(usersTable.id, verificationRequestsTable.userId))
    .where(and(eq(verificationRequestsTable.method, "alumni_peer"), eq(verificationRequestsTable.role, "alumni"),
      eq(usersTable.role, "alumni"), eq(usersTable.jnvId, user.jnvId!), eq(verificationRequestsTable.jnvName, user.jnvName),
      eq(verificationRequestsTable.jnvState, user.jnvState), inArray(verificationRequestsTable.status, OPEN), ne(usersTable.id, user.id)))
    .orderBy(desc(verificationRequestsTable.createdAt)).limit(100);
  if (!requests.length) return res.json([]);
  const blocked = await db.select({ blockerId: userBlocksTable.blockerId, blockedId: userBlocksTable.blockedId }).from(userBlocksTable).where(or(
    eq(userBlocksTable.blockerId, user.id), eq(userBlocksTable.blockedId, user.id),
  ));
  const hiddenIds = new Set(blocked.map((row) => row.blockerId === user.id ? row.blockedId : row.blockerId));
  const visibleRequests = requests.filter((r) => !hiddenIds.has(r.userId));
  if (!visibleRequests.length) return res.json([]);
  const prior = await db.select({ requestId: alumniPeerDecisionsTable.requestId, decision: alumniPeerDecisionsTable.decision })
    .from(alumniPeerDecisionsTable).where(and(eq(alumniPeerDecisionsTable.confirmerId, user.id), inArray(alumniPeerDecisionsTable.requestId, visibleRequests.map((r) => r.id))));
  const decisions = new Map(prior.map((d) => [d.requestId, d.decision]));
  return res.json(visibleRequests.map((r) => ({ ...r, decision: decisions.get(r.id) ?? null })));
});

router.post("/alumni-verification/requests/:id/respond", async (req, res) => {
  const actor = getUser(req);
  const requestId = req.params.id as string;
  const decision = req.body?.decision;
  if (!isValidUserId(requestId)) return res.status(400).json({ error: "Invalid request ID." });
  if (actor.role !== "alumni") return res.status(403).json({ error: "Only alumni can respond to an alumni confirmation request." });
  if (decision !== "confirmed" && decision !== "declined") return res.status(400).json({ error: "Choose confirmed or declined." });
  if (["under_review", "suspended", "revoked"].includes(actor.verificationStatus ?? "")) return res.status(403).json({ error: "Your account cannot confirm alumni while under moderator restriction." });
  try {
    const result = await db.transaction(async (tx) => {
      const [found] = await tx.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.id, requestId)).limit(1);
      if (!found || found.method !== "alumni_peer" || found.role !== "alumni") return { error: "not_found" as const };
      // Stable lock order prevents reciprocal confirmation requests deadlocking.
      const lockIds = [actor.id, found.userId].sort();
      await tx.execute(sql`select id from users where id in (${sql.join(lockIds.map((id) => sql`${id}`), sql`, `)}) order by id for update`);
      const people = await tx.select().from(usersTable).where(inArray(usersTable.id, lockIds));
      const applicant = people.find((p) => p.id === found.userId);
      const confirmer = people.find((p) => p.id === actor.id);
      if (!applicant || !confirmer) return { error: "role" as const };
      if (found.jnvName !== applicant.jnvName || found.jnvState !== applicant.jnvState) return { error: "school" as const };
      const eligibility = alumniPeerEligibility(confirmer, applicant);
      if (eligibility !== "eligible") return { error: eligibility };
      const blocked = await tx.select({ id: userBlocksTable.id }).from(userBlocksTable).where(or(
        and(eq(userBlocksTable.blockerId, actor.id), eq(userBlocksTable.blockedId, applicant.id)),
        and(eq(userBlocksTable.blockerId, applicant.id), eq(userBlocksTable.blockedId, actor.id)),
      )).limit(1);
      if (blocked.length) return { error: "blocked" as const };
      const [current] = await tx.select().from(verificationRequestsTable).where(eq(verificationRequestsTable.id, requestId)).limit(1);
      if (!current || current.status !== "pending") return { error: "closed" as const };
      const [previous] = await tx.select().from(alumniPeerDecisionsTable).where(and(
        eq(alumniPeerDecisionsTable.requestId, requestId), eq(alumniPeerDecisionsTable.confirmerId, actor.id),
      )).limit(1);
      if (previous) return { error: "duplicate" as const };
      if (decision === "confirmed") {
        const [priorConfirmation] = await tx.select().from(alumniPeerDecisionsTable).where(and(
          eq(alumniPeerDecisionsTable.applicantId, applicant.id), eq(alumniPeerDecisionsTable.confirmerId, actor.id), eq(alumniPeerDecisionsTable.decision, "confirmed"),
        )).limit(1);
        if (priorConfirmation) return { error: "duplicate" as const };
      }
      await tx.insert(alumniPeerDecisionsTable).values({ requestId, applicantId: applicant.id, confirmerId: actor.id, jnvId: applicant.jnvId!, decision });
      if (decision === "confirmed") {
        await issueDigitalCredential(tx, applicant, applicant.jnvId!, confirmer.id, "alumni");
        await tx.update(usersTable).set({ verificationStatus: "community_verified", communityVerifiedAt: new Date() }).where(eq(usersTable.id, applicant.id));
        await tx.update(verificationRequestsTable).set({ status: "approved", reviewedBy: actor.id, reviewedByName: actor.fullName, reviewedAt: new Date(), updatedAt: new Date() }).where(eq(verificationRequestsTable.id, requestId));
      }
      await tx.insert(verificationAuditTable).values({ requestId, actorId: actor.id, subjectUserId: applicant.id, jnvId: applicant.jnvId!,
        action: decision === "confirmed" ? "alumni_peer_confirmed" : "alumni_peer_declined",
        fromStatus: effectiveStatus(applicant), toStatus: decision === "confirmed" ? "community_verified" : "unverified" });
      await tx.insert(socialNotificationsTable).values({ recipientId: applicant.id, actorId: actor.id,
        type: decision === "confirmed" ? "alumni_peer_confirmed" : "alumni_peer_declined", entityId: requestId,
        message: decision === "confirmed" ? `${actor.fullName} confirmed your alumni status in your JNV community.` : `${actor.fullName} declined your alumni confirmation request.` });
      return { success: true, decision, verificationStatus: decision === "confirmed" ? "community_verified" : effectiveStatus(applicant) };
    });
    if ("error" in result) {
      const map: Record<string, [number, string]> = {
        not_found: [404, "Request not found."], role: [403, "Only alumni can respond to this request."], self: [400, "You cannot confirm yourself."],
        school: [403, "Both alumni must have the same valid stored JNV association."], restricted: [403, "This account is under moderator review."],
        blocked: [404, "Request not found."],
        closed: [409, "This request has already been completed."], duplicate: [409, "You have already responded to or confirmed this alumnus."],
      };
      const mapped = result.error ? map[result.error] : undefined;
      if (!mapped) return res.status(500).json({ error: "Unknown alumni response result." });
      const [status, error] = mapped;
      return res.status(status).json({ error });
    }
    return res.json(result);
  } catch (error) {
    req.log.error(error, "Failed to record alumni peer decision");
    return res.status(409).json({ error: "This response could not be recorded. Refresh and check the request status." });
  }
});

router.post("/alumni-verification/appeals", async (req, res) => {
  const user = getUser(req);
  if (user.role !== "alumni") return res.status(403).json({ error: "This appeal flow is for alumni accounts." });
  const reportId = req.body?.reportId;
  const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 1000) : "";
  if (!isValidUserId(reportId) || reason.length < 10) return res.status(400).json({ error: "Choose a report case and provide an appeal reason of at least 10 characters." });
  const [report] = await db.select({ id: reportsTable.id, status: reportsTable.status })
    .from(reportsTable).where(and(eq(reportsTable.id, reportId), eq(reportsTable.reportedUserId, user.id))).limit(1);
  if (!report) return res.status(404).json({ error: "Your moderation case was not found." });
  const jnvId = user.jnvId || makeJnvId(user.jnvState, user.jnvName);
  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`select id from reports where id = ${report.id} for update`);
      const [previous] = await tx.select({ id: verificationAuditTable.id }).from(verificationAuditTable).where(and(
        eq(verificationAuditTable.reportId, report.id), eq(verificationAuditTable.subjectUserId, user.id), eq(verificationAuditTable.action, "alumni_appeal_submitted"),
      )).limit(1);
      if (previous) return { duplicate: true, id: previous.id };
      const [appeal] = await tx.insert(verificationAuditTable).values({ reportId: report.id, actorId: user.id, subjectUserId: user.id, jnvId, action: "alumni_appeal_submitted", fromStatus: user.verificationStatus, toStatus: user.verificationStatus, reason }).returning({ id: verificationAuditTable.id });
      const moderators = await tx.select({ userId: verificationAssignmentsTable.userId }).from(verificationAssignmentsTable).where(and(
        eq(verificationAssignmentsTable.jnvId, jnvId), inArray(verificationAssignmentsTable.assignmentRole, ["official", "admin"]), eq(verificationAssignmentsTable.active, true),
      ));
      if (moderators.length) await tx.insert(socialNotificationsTable).values(moderators.map((m) => ({ recipientId: m.userId, actorId: user.id, type: "alumni_appeal_received", entityId: report.id, message: "An alumni moderation case has a new private appeal." })));
      return { duplicate: false, id: appeal.id };
    });
    return res.status(result.duplicate ? 200 : 201).json({ success: true, appealId: result.id, duplicate: result.duplicate });
  } catch (error) {
    req.log.error(error, "Failed to submit alumni appeal");
    return res.status(500).json({ error: "Could not submit your appeal." });
  }
});

export default router;
