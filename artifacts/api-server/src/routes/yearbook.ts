import { Router } from "express";
import { and, asc, desc, eq, isNotNull, ne, or } from "drizzle-orm";
import { db, memoriesTable, usersTable, yearbookEntriesTable, verificationAuditTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, requireAuth } from "../lib/auth";
import { canViewProfile, createSocialNotification, isBlockedBetween } from "../lib/social-access";
import { makeJnvId } from "../lib/jnv-identity";
import { parseStoredMemoryMedia, signMemoryMedia } from "../lib/memory-media";

const router = Router();
const YEAR_PATTERN = /^(19|20|21)\d{2}$/;

async function signedMediaList(value: string | null, fallback: string | null, ownerId: string) {
  const stored = parseStoredMemoryMedia(value);
  if (stored.length === 0 && fallback?.startsWith("https://")) stored.push(fallback);
  return Promise.all(stored.map((media) => typeof media === "string" ? media : signMemoryMedia(media, ownerId)));
}

router.get("/yearbook", requireAuth, async (req, res) => {
  try {
    const viewer = getUser(req);
    const { jnvName, jnvState, cohortYear } = req.query;
    if ((jnvName !== undefined && typeof jnvName !== "string") || (jnvState !== undefined && typeof jnvState !== "string")) {
      return res.status(400).json({ error: "Choose a valid school" });
    }
    if (typeof cohortYear === "string" && !YEAR_PATTERN.test(cohortYear)) {
      return res.status(400).json({ error: "Choose a valid graduation year" });
    }
    if ((jnvName && !jnvState) || (jnvState && !jnvName)) {
      return res.status(400).json({ error: "School name and state must be selected together" });
    }

    const filters = [
      eq(yearbookEntriesTable.status, "approved"),
      eq(memoriesTable.visibility, "public"),
      or(
        and(eq(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "community_verified"), isNotNull(usersTable.communityVerifiedAt)),
        and(ne(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "verified")),
      )!,
    ];
    if (typeof jnvName === "string") filters.push(eq(yearbookEntriesTable.jnvName, jnvName));
    if (typeof jnvState === "string") filters.push(eq(yearbookEntriesTable.jnvState, jnvState));
    if (typeof cohortYear === "string") filters.push(eq(yearbookEntriesTable.cohortYear, cohortYear));

    const rows = await db.select({
      id: yearbookEntriesTable.id,
      cohortYear: yearbookEntriesTable.cohortYear,
      jnvName: yearbookEntriesTable.jnvName,
      jnvState: yearbookEntriesTable.jnvState,
      approvedAt: yearbookEntriesTable.reviewedAt,
      memoryId: memoriesTable.id,
      caption: memoriesTable.caption,
      mediaUrls: memoriesTable.mediaUrls,
      imageUrl: memoriesTable.imageUrl,
      memoryCreatedAt: memoriesTable.createdAt,
      authorId: usersTable.id,
      authorName: usersTable.fullName,
      authorPhotoUrl: usersTable.photoURL,
      authorVisibility: usersTable.profileVisibility,
    }).from(yearbookEntriesTable)
      .innerJoin(memoriesTable, eq(yearbookEntriesTable.memoryId, memoriesTable.id))
      .innerJoin(usersTable, eq(yearbookEntriesTable.submittedBy, usersTable.id))
      .where(and(...filters))
      .orderBy(asc(yearbookEntriesTable.cohortYear), desc(yearbookEntriesTable.createdAt))
      .limit(100);

    const visible = await Promise.all(rows.map(async (row) => {
      if (await isBlockedBetween(viewer.id, row.authorId) || (row.authorVisibility === "private" && !await canViewProfile(viewer.id, row.authorId))) return null;
      return {
        id: row.id,
        memoryId: row.memoryId,
        cohortYear: row.cohortYear,
        jnvName: row.jnvName,
        jnvState: row.jnvState,
        approvedAt: row.approvedAt?.toISOString() ?? null,
        caption: row.caption,
        mediaUrls: await signedMediaList(row.mediaUrls, row.imageUrl, row.authorId),
        memoryCreatedAt: row.memoryCreatedAt?.toISOString() ?? null,
        author: { id: row.authorId, fullName: row.authorName, photoURL: row.authorPhotoUrl },
      };
    }));
    return res.json(visible.filter(Boolean));
  } catch (error) {
    req.log.error(error, "Failed to fetch yearbook entries");
    return res.status(500).json({ error: "Could not load this yearbook" });
  }
});

router.get("/yearbook/my-submissions", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await db.select({
      id: yearbookEntriesTable.id,
      memoryId: yearbookEntriesTable.memoryId,
      cohortYear: yearbookEntriesTable.cohortYear,
      status: yearbookEntriesTable.status,
      reviewNote: yearbookEntriesTable.reviewNote,
      createdAt: yearbookEntriesTable.createdAt,
      reviewedAt: yearbookEntriesTable.reviewedAt,
      caption: memoriesTable.caption,
      visibility: memoriesTable.visibility,
    }).from(yearbookEntriesTable)
      .innerJoin(memoriesTable, eq(yearbookEntriesTable.memoryId, memoriesTable.id))
      .where(eq(yearbookEntriesTable.submittedBy, user.id))
      .orderBy(desc(yearbookEntriesTable.createdAt));
    return res.json(rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
    })));
  } catch (error) {
    req.log.error(error, "Failed to fetch yearbook submissions");
    return res.status(500).json({ error: "Could not load your yearbook submissions" });
  }
});

router.post("/yearbook/submissions", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "alumni" || user.verificationStatus !== "community_verified" || !user.communityVerifiedAt) {
      return res.status(403).json({ error: "Only verified alumni can submit a yearbook memory" });
    }
    if (!user.passoutYear || !YEAR_PATTERN.test(user.passoutYear)) {
      return res.status(409).json({ error: "Add a valid graduation year to your profile before submitting" });
    }
    const memoryId = req.body?.memoryId;
    if (typeof memoryId !== "string") return res.status(400).json({ error: "Select one of your public Memories" });
    const [memory] = await db.select().from(memoriesTable).where(eq(memoriesTable.id, memoryId)).limit(1);
    if (!memory || memory.authorId !== user.id || memory.visibility !== "public" || memory.jnvName !== user.jnvName) {
      return res.status(404).json({ error: "Only your own public Memory can be submitted" });
    }
    const [existing] = await db.select({ id: yearbookEntriesTable.id }).from(yearbookEntriesTable)
      .where(eq(yearbookEntriesTable.memoryId, memory.id)).limit(1);
    if (existing) return res.status(409).json({ error: "This Memory has already been submitted to a yearbook" });

    const [entry] = await db.insert(yearbookEntriesTable).values({
      memoryId: memory.id,
      submittedBy: user.id,
      jnvName: user.jnvName,
      jnvState: user.jnvState,
      cohortYear: user.passoutYear,
      status: "pending",
    }).returning();

    return res.status(201).json({ id: entry.id, memoryId: entry.memoryId, status: entry.status, cohortYear: entry.cohortYear, createdAt: entry.createdAt.toISOString() });
  } catch (error) {
    req.log.error(error, "Failed to submit yearbook memory");
    return res.status(500).json({ error: "Could not submit this Memory" });
  }
});

router.post("/yearbook/submissions/:id/withdraw", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [entry] = await db.update(yearbookEntriesTable)
      .set({ status: "withdrawn", updatedAt: new Date() })
      .where(and(
        eq(yearbookEntriesTable.id, req.params.id as string),
        eq(yearbookEntriesTable.submittedBy, user.id),
        eq(yearbookEntriesTable.status, "pending"),
      )).returning({ id: yearbookEntriesTable.id, status: yearbookEntriesTable.status });
    if (!entry) return res.status(404).json({ error: "Pending submission not found" });
    return res.json(entry);
  } catch (error) {
    req.log.error(error, "Failed to withdraw yearbook submission");
    return res.status(500).json({ error: "Could not withdraw this submission" });
  }
});

router.get("/yearbook/review-queue", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access required" });
    const rows = await db.select({
      id: yearbookEntriesTable.id,
      cohortYear: yearbookEntriesTable.cohortYear,
      createdAt: yearbookEntriesTable.createdAt,
      memoryId: memoriesTable.id,
      caption: memoriesTable.caption,
      mediaUrls: memoriesTable.mediaUrls,
      imageUrl: memoriesTable.imageUrl,
      authorId: usersTable.id,
      authorName: usersTable.fullName,
    }).from(yearbookEntriesTable)
      .innerJoin(memoriesTable, eq(yearbookEntriesTable.memoryId, memoriesTable.id))
      .innerJoin(usersTable, eq(yearbookEntriesTable.submittedBy, usersTable.id))
      .where(and(
        eq(yearbookEntriesTable.jnvName, user.jnvName),
        eq(yearbookEntriesTable.jnvState, user.jnvState),
        eq(yearbookEntriesTable.status, "pending"),
        eq(memoriesTable.visibility, "public"),
        eq(usersTable.verificationStatus, "verified"),
      )).orderBy(asc(yearbookEntriesTable.createdAt)).limit(100);
    const visible = await Promise.all(rows.map(async (row) => {
      if (await isBlockedBetween(user.id, row.authorId) || !await canViewProfile(user.id, row.authorId)) return null;
      return {
        ...row,
        mediaUrls: await signedMediaList(row.mediaUrls, row.imageUrl, row.authorId),
        createdAt: row.createdAt.toISOString(),
      };
    }));
    return res.json(visible.filter(Boolean));
  } catch (error) {
    req.log.error(error, "Failed to fetch yearbook review queue");
    return res.status(500).json({ error: "Could not load yearbook submissions" });
  }
});

router.post("/yearbook/submissions/:id/review", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Assigned JNV official access required" });
    const status = req.body?.status;
    const reviewNote = typeof req.body?.reviewNote === "string" ? req.body.reviewNote.trim() : "";
    if (status !== "approved" && status !== "rejected") return res.status(400).json({ error: "Choose approve or reject" });
    if (reviewNote.length > 1000 || (status === "rejected" && !reviewNote)) return res.status(400).json({ error: "Provide a short reason when rejecting a submission" });
    const [entry] = await db.transaction(async (tx) => {
      const [updated] = await tx.update(yearbookEntriesTable)
        .set({ status, reviewNote: reviewNote || null, reviewedBy: user.id, reviewedAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(yearbookEntriesTable.id, req.params.id as string),
          eq(yearbookEntriesTable.jnvName, user.jnvName),
          eq(yearbookEntriesTable.jnvState, user.jnvState),
          eq(yearbookEntriesTable.status, "pending"),
        )).returning();
      if (updated) await tx.insert(verificationAuditTable).values({
        actorId: user.id,
        subjectUserId: updated.submittedBy,
        jnvId: user.jnvId || makeJnvId(user.jnvState, user.jnvName),
        action: `yearbook_${status}`,
        fromStatus: "pending",
        toStatus: status,
        reason: reviewNote || null,
      });
      return [updated];
    });
    if (!entry) return res.status(404).json({ error: "Pending submission not found" });
    await createSocialNotification(
      entry.submittedBy,
      user.id,
      "yearbook_review",
      entry.id,
      status === "approved" ? "Your yearbook memory was approved." : `Your yearbook memory was not approved: ${reviewNote}`,
    );
    return res.json({ id: entry.id, status: entry.status, reviewedAt: entry.reviewedAt?.toISOString() ?? null });
  } catch (error) {
    req.log.error(error, "Failed to review yearbook submission");
    return res.status(500).json({ error: "Could not review this submission" });
  }
});

export default router;
