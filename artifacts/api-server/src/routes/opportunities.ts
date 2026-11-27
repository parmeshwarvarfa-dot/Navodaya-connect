import { Router } from "express";
import { and, asc, count, desc, eq, gt, ilike, inArray, isNull, lte, or, sql } from "drizzle-orm";
import {
  db, opportunitiesTable, opportunityAuditTable, opportunityRegistrationsTable,
  opportunitySubmissionsTable, opportunityBookmarksTable, socialNotificationsTable, contentReportsTable, usersTable,
} from "@workspace/db";
import { getUser, isCommunityVerifiedAlumni, requireAuth } from "../lib/auth";
import { createSocialNotification } from "../lib/social-access";
import { isValidUserId } from "./user-validation";
import { MemoryMediaError, parseStoredMemoryMedia, signMemoryMedia, validateOwnedMemoryMedia } from "../lib/memory-media";

const router = Router();
const TYPES = new Set([
  "quiz", "academic_competition", "coding_challenge", "course", "workshop", "webinar",
  "creative_competition", "scholarship", "internship", "mentorship", "community_challenge", "other",
]);
const MAX_OPPORTUNITY_MEDIA_BYTES = 50 * 1024 * 1024;
const ROLES = new Set(["student", "alumni", "teacher", "official"]);
const CLASSES = new Set(["6", "7", "8", "9", "10", "11", "12"]);
const FORMATS = new Set(["online", "offline", "hybrid"]);
const SUBMISSION_MODES = new Set(["none", "text", "link"]);
const URL_PROTOCOLS = new Set(["http:", "https:"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

function validUrl(value: string) {
  try { return URL_PROTOCOLS.has(new URL(value).protocol); } catch { return false; }
}

async function validateOpportunityMedia(ownerId: string, key: string) {
  const media = await validateOwnedMemoryMedia(ownerId, key);
  if (media.size > MAX_OPPORTUNITY_MEDIA_BYTES) {
    throw new MemoryMediaError("Choose an image or video under 50 MB.");
  }
  return media;
}

function parseDate(value: unknown, label: string): { value?: Date | null; error?: string } {
  if (value === null || value === undefined || value === "") return { value: null };
  if (typeof value !== "string") return { error: `${label} must be a valid date and time.` };
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? { error: `${label} must be a valid date and time.` } : { value: parsed };
}

function eligibleRoles(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.some((role) => typeof role !== "string" || !ROLES.has(role))) return null;
  return [...new Set(value)] as Array<"student" | "alumni" | "teacher" | "official">;
}

function eligibleClasses(value: unknown) {
  if (value === undefined || value === null) return [] as Array<"6" | "7" | "8" | "9" | "10" | "11" | "12">;
  if (!Array.isArray(value) || value.some((grade) => typeof grade !== "string" || !CLASSES.has(grade))) return null;
  return [...new Set(value)] as Array<"6" | "7" | "8" | "9" | "10" | "11" | "12">;
}

function classNumber(value: string | null | undefined) {
  const match = /(?:class\s*)?(6|7|8|9|10|11|12)\b/i.exec(value ?? "");
  return match?.[1] ?? null;
}

function canOrganize(user: ReturnType<typeof getUser>) {
  return isCommunityVerifiedAlumni(user);
}

function statusFor(opportunity: typeof opportunitiesTable.$inferSelect, now = new Date()) {
  if (opportunity.status === "draft" || opportunity.status === "cancelled") return opportunity.status;
  if (opportunity.status === "completed") return "completed";
  if (opportunity.endsAt && opportunity.endsAt <= now) return "completed";
  if (opportunity.startsAt && opportunity.startsAt <= now && (!opportunity.endsAt || opportunity.endsAt > now)) return "ongoing";
  if (opportunity.registrationDeadline && opportunity.registrationDeadline <= now) return "registration_closed";
  if (opportunity.registrationOpensAt && opportunity.registrationOpensAt > now) return "upcoming";
  return "registration_open";
}

function isEligible(user: ReturnType<typeof getUser>, opportunity: typeof opportunitiesTable.$inferSelect) {
  if (!opportunity.eligibleRoles.includes(user.role as any)) return false;
  if (user.role === "student" && opportunity.eligibleClasses.length) {
    const grade = classNumber(user.class);
    if (!grade || !opportunity.eligibleClasses.includes(grade as any)) return false;
  }
  return true;
}

function validateOpportunity(input: Record<string, unknown>, publish: boolean) {
  const type = clean(input.type, 48), category = clean(input.category, 80);
  const title = clean(input.title, 160), summary = clean(input.summary, 360), description = clean(input.description, 10_000);
  const eligibility = clean(input.eligibility, 2_000);
  const roles = eligibleRoles(input.eligibleRoles);
  const classes = eligibleClasses(input.eligibleClasses);
  const format = clean(input.format || "online", 16);
  const mode = clean(input.participationMode || "individual", 24);
  const location = clean(input.location, 220);
  const timezone = clean(input.timezone || "Asia/Kolkata", 80);
  const dateFields = {
    registrationOpensAt: parseDate(input.registrationOpensAt, "Registration opening"),
    registrationDeadline: parseDate(input.registrationDeadline, "Registration deadline"),
    startsAt: parseDate(input.startsAt, "Start date"),
    endsAt: parseDate(input.endsAt, "End date"),
    submissionDeadline: parseDate(input.submissionDeadline, "Submission deadline"),
  };
  const maxParticipants = input.maxParticipants === null || input.maxParticipants === undefined || input.maxParticipants === "" ? null : Number(input.maxParticipants);
  const submissionMode = clean(input.submissionMode || "none", 16);
  const deliveryMode = clean(input.deliveryMode || "internal", 16);
  const provider = clean(input.externalProvider, 160);
  const externalUrl = clean(input.externalUrl, 1000);
  const feeAmount = Number(input.feeAmount ?? 0);
  const feeDetails = clean(input.feeDetails, 500);
  const certificateType = clean(input.certificateType || "none", 16);
  const certificateDetails = clean(input.certificateDetails, 600);
  const prizeDetails = clean(input.prizeDetails, 1200);
  const submissionInstructions = clean(input.submissionInstructions, 2000);
  const rules = clean(input.rules, 5000);
  const judgingCriteria = clean(input.judgingCriteria, 2000);
  const status = clean(input.status || "draft", 20);

  if (!TYPES.has(type) || !title || !category) return { error: "Choose a valid opportunity type and category, and add a title." };
  if (roles === null) return { error: "Choose at least one valid audience role." };
  if (classes === null) return { error: "Choose valid eligible student classes." };
  if (!FORMATS.has(format)) return { error: "Choose online, offline, or hybrid participation." };
  if (mode !== "individual") return { error: "Team registration is not supported yet. Choose individual participation." };
  if (!SUBMISSION_MODES.has(submissionMode)) return { error: "Choose no submission, text, or link submission." };
  if (!new Set(["internal", "external"]).has(deliveryMode)) return { error: "Choose an internal or external activity." };
  if (!new Set(["draft", "published", "cancelled", "completed"]).has(status)) return { error: "Invalid opportunity status." };
  if (dateFields.registrationOpensAt.error) return { error: dateFields.registrationOpensAt.error };
  if (dateFields.registrationDeadline.error) return { error: dateFields.registrationDeadline.error };
  if (dateFields.startsAt.error) return { error: dateFields.startsAt.error };
  if (dateFields.endsAt.error) return { error: dateFields.endsAt.error };
  if (dateFields.submissionDeadline.error) return { error: dateFields.submissionDeadline.error };
  if (maxParticipants !== null && (!Number.isInteger(maxParticipants) || maxParticipants < 1 || maxParticipants > 100_000)) return { error: "Maximum participants must be a whole number between 1 and 100,000." };
  if (!Number.isInteger(feeAmount) || feeAmount < 0 || feeAmount > 10_000_000) return { error: "Fee must be a non-negative amount in INR." };
  if (feeAmount > 0 && !feeDetails) return { error: "Explain the fee before publishing a paid opportunity." };
  if (feeAmount > 0 && deliveryMode !== "external") return { error: "Paid opportunities need an external provider because Navodaya Connect does not process payments." };
  if (certificateType !== "none" && certificateType !== "external") return { error: "Navodaya Connect does not issue internal opportunity certificates yet." };
  if (certificateType === "external" && !certificateDetails) return { error: "Explain which external provider issues the certificate." };
  if (deliveryMode === "external" && (!provider || !externalUrl || !validUrl(externalUrl))) return { error: "External activities need a provider name and a valid HTTP or HTTPS link." };
  if (["quiz", "course", "scholarship", "internship"].includes(type) && deliveryMode !== "external") return { error: "This opportunity type needs an external provider and link because its application or delivery is not hosted in Navodaya Connect." };
  if (deliveryMode === "internal" && externalUrl && !validUrl(externalUrl)) return { error: "External links must use HTTP or HTTPS." };
  if ((type === "quiz") && deliveryMode !== "external") return { error: "Custom in-app quizzes are not supported. Link to an external quiz provider." };
  if ((type === "internship") && roles.includes("student")) return { error: "Internship listings can target alumni only; student opportunities for minors need a separate safeguarding review." };
  if ((format === "offline" || format === "hybrid") && publish && !location) return { error: "Add the venue or location for offline and hybrid activities." };
  if (timezone) {
    try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { return { error: "Enter a valid time zone, such as Asia/Kolkata." }; }
  }
  const opensAt = dateFields.registrationOpensAt.value ?? null;
  const deadline = dateFields.registrationDeadline.value ?? null;
  const startsAt = dateFields.startsAt.value ?? null;
  const endsAt = dateFields.endsAt.value ?? null;
  const submissionDeadline = dateFields.submissionDeadline.value ?? null;
  if (opensAt && deadline && opensAt > deadline) return { error: "Registration must open before its deadline." };
  if (deadline && startsAt && deadline > startsAt) return { error: "Registration must close before the activity starts." };
  if (startsAt && endsAt && endsAt < startsAt) return { error: "The end date must be after the start date." };
  if (submissionDeadline && deadline && submissionDeadline < deadline) return { error: "The submission deadline cannot be earlier than registration closing." };
  if (submissionDeadline && endsAt && submissionDeadline > endsAt) return { error: "The submission deadline cannot be after the activity ends." };
  if (publish) {
    if (!summary || !description || !eligibility || !deadline) return { error: "Published opportunities need a summary, full description, eligibility, and registration deadline." };
    if (deliveryMode === "external" && !externalUrl) return { error: "Add the external provider or registration link before publishing." };
    if (submissionMode !== "none" && (!submissionInstructions || !submissionDeadline)) return { error: "Add submission instructions and a submission deadline." };
    if ((type === "academic_competition" || type === "coding_challenge" || type === "creative_competition") && submissionMode === "none") return { error: "Competition listings need a supported text or link submission format." };
  }

  return { data: {
    type, category, title, summary, description, eligibility, eligibleRoles: roles, eligibleClasses: classes,
    format, participationMode: "individual", location: location || null, timezone,
    registrationOpensAt: opensAt, registrationDeadline: deadline, startsAt, endsAt, submissionDeadline,
    maxParticipants, rules, judgingCriteria, submissionMode, submissionInstructions, deliveryMode,
    externalProvider: provider || null, externalUrl: externalUrl || null, feeAmount, feeDetails,
    prizeDetails, certificateType, certificateDetails, status,
  } };
}

function currentInput(opportunity: typeof opportunitiesTable.$inferSelect): Record<string, unknown> {
  return {
    ...opportunity,
    registrationOpensAt: opportunity.registrationOpensAt?.toISOString() ?? "",
    registrationDeadline: opportunity.registrationDeadline?.toISOString() ?? "",
    startsAt: opportunity.startsAt?.toISOString() ?? "",
    endsAt: opportunity.endsAt?.toISOString() ?? "",
    submissionDeadline: opportunity.submissionDeadline?.toISOString() ?? "",
  };
}

async function registrationCounts(ids: string[]) {
  if (!ids.length) return new Map<string, number>();
  const rows = await db.select({ opportunityId: opportunityRegistrationsTable.opportunityId, total: count() })
    .from(opportunityRegistrationsTable).where(and(inArray(opportunityRegistrationsTable.opportunityId, ids), eq(opportunityRegistrationsTable.status, "registered")))
    .groupBy(opportunityRegistrationsTable.opportunityId);
  return new Map(rows.map((row) => [row.opportunityId, Number(row.total)]));
}

async function notifyUser(recipientId: string, actorId: string, opportunityId: string, type: string, message: string) {
  await createSocialNotification(recipientId, actorId, type, opportunityId, message);
}

async function publicOpportunity(row: typeof opportunitiesTable.$inferSelect, organizerName: string, registrationCount: number, now = new Date()) {
  const { eligibleRoles: _eligibleRoles, eligibleClasses: _eligibleClasses, media, ...visible } = row;
  const [storedMedia] = parseStoredMemoryMedia(media);
  const mediaUrl = storedMedia && typeof storedMedia !== "string"
    ? await signMemoryMedia(storedMedia, row.organizerId)
    : null;
  return {
    ...visible, mediaUrl,
    mediaType: storedMedia && typeof storedMedia !== "string" ? storedMedia.mediaType : null,
    organizerName, registrationCount, displayStatus: statusFor(row, now),
  };
}

router.get("/opportunities", requireAuth, async (req, res) => {
  try {
    const q = clean(req.query.q, 100), type = clean(req.query.type, 48), category = clean(req.query.category, 80);
    const format = clean(req.query.format, 16), status = clean(req.query.status, 24);
    const page = Math.max(1, Math.min(1000, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
    const limit = Math.max(1, Math.min(30, Number.parseInt(String(req.query.limit ?? "15"), 10) || 15));
    const now = new Date();
    const viewer = getUser(req);
    const filters = [inArray(opportunitiesTable.status, ["published", "completed"])];
    if (req.query.eligibleOnly === "true") {
      filters.push(sql`${opportunitiesTable.eligibleRoles} @> ${JSON.stringify([viewer.role])}::jsonb`);
      if (viewer.role === "student") {
        const grade = classNumber(viewer.class);
        filters.push(grade
          ? sql`(${opportunitiesTable.eligibleClasses} = '[]'::jsonb OR ${opportunitiesTable.eligibleClasses} @> ${JSON.stringify([grade])}::jsonb)`
          : sql`${opportunitiesTable.eligibleClasses} = '[]'::jsonb`);
      }
    }
    if (q) {
      const pattern = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
      filters.push(or(
        ilike(opportunitiesTable.title, pattern), ilike(opportunitiesTable.summary, pattern),
        ilike(opportunitiesTable.description, pattern), ilike(opportunitiesTable.category, pattern),
        ilike(usersTable.fullName, pattern),
      )!);
    }
    if (type && TYPES.has(type)) filters.push(eq(opportunitiesTable.type, type));
    if (category) filters.push(eq(opportunitiesTable.category, category));
    if (FORMATS.has(format)) filters.push(eq(opportunitiesTable.format, format));
    if (status === "registration_open") filters.push(eq(opportunitiesTable.status, "published"),
      gt(opportunitiesTable.registrationDeadline, now),
      or(isNull(opportunitiesTable.registrationOpensAt), lte(opportunitiesTable.registrationOpensAt, now))!,
      or(isNull(opportunitiesTable.startsAt), gt(opportunitiesTable.startsAt, now))!,
    );
    if (status === "upcoming") filters.push(eq(opportunitiesTable.status, "published"), or(gt(opportunitiesTable.startsAt, now), gt(opportunitiesTable.registrationOpensAt, now))!);
    if (status === "ongoing") filters.push(eq(opportunitiesTable.status, "published"), lte(opportunitiesTable.startsAt, now), or(isNull(opportunitiesTable.endsAt), gt(opportunitiesTable.endsAt, now))!);
    if (status === "registration_closed") filters.push(eq(opportunitiesTable.status, "published"), lte(opportunitiesTable.registrationDeadline, now), or(isNull(opportunitiesTable.startsAt), gt(opportunitiesTable.startsAt, now))!);
    if (status === "completed") filters.push(or(eq(opportunitiesTable.status, "completed"), lte(opportunitiesTable.endsAt, now))!);
    const where = and(...filters);
    const [totalRow] = await db.select({ total: count() }).from(opportunitiesTable).innerJoin(usersTable, eq(usersTable.id, opportunitiesTable.organizerId)).where(where);
    const sortByDeadline = req.query.sort === "deadline";
    const rows = await db.select({ opportunity: opportunitiesTable, organizerName: usersTable.fullName }).from(opportunitiesTable)
      .innerJoin(usersTable, eq(usersTable.id, opportunitiesTable.organizerId)).where(where)
      .orderBy(sortByDeadline ? asc(opportunitiesTable.registrationDeadline) : desc(opportunitiesTable.createdAt))
      .limit(limit).offset((page - 1) * limit);
    const ids = rows.map(({ opportunity }) => opportunity.id);
    const counts = await registrationCounts(ids);
    const myRows = ids.length ? await db.select({ opportunityId: opportunityRegistrationsTable.opportunityId })
      .from(opportunityRegistrationsTable).where(and(eq(opportunityRegistrationsTable.participantId, viewer.id), eq(opportunityRegistrationsTable.status, "registered"), inArray(opportunityRegistrationsTable.opportunityId, ids))) : [];
    const registered = new Set(myRows.map((row) => row.opportunityId));
    return res.json({
      items: await Promise.all(rows.map(async ({ opportunity, organizerName }) => ({
        ...await publicOpportunity(opportunity, organizerName, counts.get(opportunity.id) ?? 0, now),
        isRegistered: registered.has(opportunity.id),
      }))),
      page, limit, total: Number(totalRow?.total ?? 0), hasMore: page * limit < Number(totalRow?.total ?? 0),
    });
  } catch (error) {
    req.log.error(error, "Failed to browse opportunities");
    return res.status(500).json({ error: "Could not load opportunities." });
  }
});

router.get("/opportunities/categories", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select({ category: opportunitiesTable.category }).from(opportunitiesTable)
      .where(inArray(opportunitiesTable.status, ["published", "completed"]))
      .groupBy(opportunitiesTable.category).orderBy(asc(opportunitiesTable.category)).limit(100);
    return res.json(rows.map((row) => row.category));
  } catch (error) {
    _req.log.error(error, "Failed to load opportunity categories");
    return res.status(500).json({ error: "Could not load opportunity categories." });
  }
});

router.get("/opportunities/mine", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!canOrganize(user)) return res.status(403).json({ error: "Only verified alumni organizers can manage opportunities." });
    const rows = await db.select({ opportunity: opportunitiesTable, organizerName: usersTable.fullName }).from(opportunitiesTable)
      .innerJoin(usersTable, eq(usersTable.id, opportunitiesTable.organizerId)).where(eq(opportunitiesTable.organizerId, user.id))
      .orderBy(desc(opportunitiesTable.updatedAt)).limit(100);
    const counts = await registrationCounts(rows.map(({ opportunity }) => opportunity.id));
    return res.json(await Promise.all(rows.map(({ opportunity, organizerName }) =>
      publicOpportunity(opportunity, organizerName, counts.get(opportunity.id) ?? 0))));
  } catch (error) {
    req.log.error(error, "Failed to list organizer opportunities");
    return res.status(500).json({ error: "Could not load your opportunities." });
  }
});

router.get("/opportunities/my-registrations", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await db.select({ registration: opportunityRegistrationsTable, opportunity: opportunitiesTable, organizerName: usersTable.fullName })
      .from(opportunityRegistrationsTable).innerJoin(opportunitiesTable, eq(opportunitiesTable.id, opportunityRegistrationsTable.opportunityId))
      .innerJoin(usersTable, eq(usersTable.id, opportunitiesTable.organizerId)).where(eq(opportunityRegistrationsTable.participantId, user.id))
      .orderBy(desc(opportunityRegistrationsTable.updatedAt)).limit(100);
    const counts = await registrationCounts(rows.map(({ opportunity }) => opportunity.id));
    const submissions = rows.length ? await db.select().from(opportunitySubmissionsTable)
      .where(and(eq(opportunitySubmissionsTable.participantId, user.id), inArray(opportunitySubmissionsTable.opportunityId, rows.map(({ opportunity }) => opportunity.id)))) : [];
    const submissionByOpportunity = new Map(submissions.map((row) => [row.opportunityId, row]));
    return res.json(await Promise.all(rows.map(async ({ registration, opportunity, organizerName }) => ({
      ...await publicOpportunity(opportunity, organizerName, counts.get(opportunity.id) ?? 0),
      registrationStatus: registration.status,
      registeredAt: registration.createdAt,
      submission: (() => {
        const submission = submissionByOpportunity.get(opportunity.id);
        if (!submission) return null;
        return opportunity.resultsPublished ? submission : {
          ...submission, status: "submitted", score: null, organizerFeedback: "", reviewedBy: null, reviewedAt: null,
        };
      })(),
    }))));
  } catch (error) {
    req.log.error(error, "Failed to load participant registrations");
    return res.status(500).json({ error: "Could not load your registrations." });
  }
});

router.get("/opportunities/saved", requireAuth, async (req, res) => {
  const user = getUser(req);
  try {
    const rows = await db.select({ opportunity: opportunitiesTable, organizerName: usersTable.fullName, savedAt: opportunityBookmarksTable.createdAt })
      .from(opportunityBookmarksTable).innerJoin(opportunitiesTable, eq(opportunitiesTable.id, opportunityBookmarksTable.opportunityId))
      .innerJoin(usersTable, eq(usersTable.id, opportunitiesTable.organizerId))
      .where(and(eq(opportunityBookmarksTable.userId, user.id), inArray(opportunitiesTable.status, ["published", "completed"]))).orderBy(desc(opportunityBookmarksTable.createdAt)).limit(100);
    const counts = await registrationCounts(rows.map(({ opportunity }) => opportunity.id));
    return res.json(await Promise.all(rows.map(async ({ opportunity, organizerName, savedAt }) => ({
      ...await publicOpportunity(opportunity, organizerName, counts.get(opportunity.id) ?? 0), savedAt,
    }))));
  } catch (error) {
    req.log.error(error, "Failed to load saved opportunities");
    return res.status(500).json({ error: "Could not load saved opportunities." });
  }
});

router.post("/opportunities/:id/save", requireAuth, async (req, res) => {
  const user = getUser(req);
  try {
    const [opportunity] = await db.select({ id: opportunitiesTable.id, status: opportunitiesTable.status }).from(opportunitiesTable)
      .where(eq(opportunitiesTable.id, req.params.id as string)).limit(1);
    if (!opportunity || !["published", "completed"].includes(opportunity.status)) return res.status(404).json({ error: "Opportunity not found." });
    const [saved] = await db.insert(opportunityBookmarksTable).values({ opportunityId: opportunity.id, userId: user.id })
      .onConflictDoNothing().returning({ id: opportunityBookmarksTable.id });
    return res.json({ saved: true, created: Boolean(saved) });
  } catch (error) {
    req.log.error(error, "Failed to save opportunity");
    return res.status(500).json({ error: "Could not save this opportunity." });
  }
});

router.delete("/opportunities/:id/save", requireAuth, async (req, res) => {
  const user = getUser(req);
  try {
    const removed = await db.delete(opportunityBookmarksTable).where(and(eq(opportunityBookmarksTable.opportunityId, req.params.id as string), eq(opportunityBookmarksTable.userId, user.id))).returning({ id: opportunityBookmarksTable.id });
    return res.json({ saved: false, removed: removed.length > 0 });
  } catch (error) {
    req.log.error(error, "Failed to remove saved opportunity");
    return res.status(500).json({ error: "Could not remove this saved opportunity." });
  }
});

router.get("/opportunities/analytics/mine", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!canOrganize(user)) return res.status(403).json({ error: "Organizer analytics are only available to verified alumni." });
    const [opportunityStats] = await db.select({ total: count() }).from(opportunitiesTable).where(eq(opportunitiesTable.organizerId, user.id));
    const mine = await db.select({ id: opportunitiesTable.id, status: opportunitiesTable.status }).from(opportunitiesTable).where(eq(opportunitiesTable.organizerId, user.id));
    const ids = mine.map((row) => row.id);
    const [registrationStats] = ids.length ? await db.select({ total: count() }).from(opportunityRegistrationsTable)
      .where(and(inArray(opportunityRegistrationsTable.opportunityId, ids), eq(opportunityRegistrationsTable.status, "registered"))) : [{ total: 0 }];
    const [submissionStats] = ids.length ? await db.select({ total: count() }).from(opportunitySubmissionsTable).where(inArray(opportunitySubmissionsTable.opportunityId, ids)) : [{ total: 0 }];
    return res.json({ totalOpportunities: Number(opportunityStats?.total ?? 0), activeOpportunities: mine.filter((row) => row.status === "published").length, registrations: Number(registrationStats?.total ?? 0), submissions: Number(submissionStats?.total ?? 0) });
  } catch (error) {
    req.log.error(error, "Failed to load organizer analytics");
    return res.status(500).json({ error: "Could not load organizer analytics." });
  }
});

router.post("/opportunities", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!isCommunityVerifiedAlumni(user)) return res.status(403).json({ error: "Only community verified alumni can create opportunities." });
    const input = { ...req.body, status: req.body?.status === "published" ? "published" : "draft" } as Record<string, unknown>;
    const validated = validateOpportunity(input, input.status === "published");
    if (validated.error || !validated.data) return res.status(400).json({ error: validated.error });
    if (validated.data.status === "published" && validated.data.registrationDeadline && validated.data.registrationDeadline <= new Date()) return res.status(400).json({ error: "Set a future registration deadline before publishing." });
    let media = null;
    if (req.body?.mediaKey !== undefined && req.body.mediaKey !== null) {
      if (typeof req.body.mediaKey !== "string") return res.status(400).json({ error: "Choose a valid opportunity photo or video." });
      media = await validateOpportunityMedia(user.id, req.body.mediaKey);
    }
    const row = await db.transaction(async (tx) => {
      const [created] = await tx.insert(opportunitiesTable).values({
        ...validated.data, organizerId: user.id, media: media ? JSON.stringify([media]) : null,
      }).returning();
      await tx.insert(opportunityAuditTable).values({ opportunityId: created.id, actorId: user.id, action: created.status === "published" ? "published" : "draft_created", details: { type: created.type } });
      return created;
    });
    return res.status(201).json({ ...await publicOpportunity(row, user.fullName, 0), isRegistered: false });
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error, "Failed to create opportunity");
    return res.status(500).json({ error: "Could not save this opportunity." });
  }
});

router.get("/opportunities/:id/participants", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string;
    const [opportunity] = await db.select({ id: opportunitiesTable.id, organizerId: opportunitiesTable.organizerId })
      .from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).limit(1);
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found." });
    if (!canOrganize(user) || opportunity.organizerId !== user.id) return res.status(403).json({ error: "Only this opportunity's verified alumni organizer can view participants." });
    const rows = await db.select({
      id: opportunityRegistrationsTable.id, participantId: usersTable.id, fullName: usersTable.fullName,
      role: usersTable.role, class: usersTable.class,
      status: opportunityRegistrationsTable.status, registeredAt: opportunityRegistrationsTable.createdAt,
    }).from(opportunityRegistrationsTable).innerJoin(usersTable, eq(usersTable.id, opportunityRegistrationsTable.participantId))
      .where(and(eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.status, "registered")))
      .orderBy(desc(opportunityRegistrationsTable.createdAt)).limit(500);
    return res.json(rows);
  } catch (error) {
    req.log.error(error, "Failed to list opportunity participants");
    return res.status(500).json({ error: "Could not load participants." });
  }
});

router.get("/opportunities/:id/submissions", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string;
    const [opportunity] = await db.select({ organizerId: opportunitiesTable.organizerId }).from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).limit(1);
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found." });
    if (!canOrganize(user) || opportunity.organizerId !== user.id) return res.status(403).json({ error: "Only this opportunity's verified alumni organizer can review submissions." });
    const rows = await db.select({
      id: opportunitySubmissionsTable.id, participantId: usersTable.id, participantName: usersTable.fullName,
      participantRole: usersTable.role, participantClass: usersTable.class, content: opportunitySubmissionsTable.content,
      submissionUrl: opportunitySubmissionsTable.submissionUrl, status: opportunitySubmissionsTable.status,
      score: opportunitySubmissionsTable.score, organizerFeedback: opportunitySubmissionsTable.organizerFeedback,
      submittedAt: opportunitySubmissionsTable.submittedAt, reviewedAt: opportunitySubmissionsTable.reviewedAt,
    }).from(opportunitySubmissionsTable).innerJoin(usersTable, eq(usersTable.id, opportunitySubmissionsTable.participantId))
      .where(eq(opportunitySubmissionsTable.opportunityId, id)).orderBy(desc(opportunitySubmissionsTable.submittedAt)).limit(500);
    return res.json(rows);
  } catch (error) {
    req.log.error(error, "Failed to list opportunity submissions");
    return res.status(500).json({ error: "Could not load submissions." });
  }
});

router.get("/opportunities/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string;
    if (!isValidUserId(id)) return res.status(404).json({ error: "Opportunity not found." });
    const [found] = await db.select({ opportunity: opportunitiesTable, organizerName: usersTable.fullName })
      .from(opportunitiesTable).innerJoin(usersTable, eq(usersTable.id, opportunitiesTable.organizerId))
      .where(eq(opportunitiesTable.id, id)).limit(1);
    const organizerView = Boolean(found && canOrganize(user) && found.opportunity.organizerId === user.id);
    const [viewerRegistration] = found && found.opportunity.status !== "published" && found.opportunity.status !== "completed" && !organizerView
      ? await db.select({ id: opportunityRegistrationsTable.id }).from(opportunityRegistrationsTable).where(and(
        eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.participantId, user.id),
      )).limit(1)
      : [];
    if (!found || (found.opportunity.status !== "published" && found.opportunity.status !== "completed" && !organizerView && !viewerRegistration)) return res.status(404).json({ error: "Opportunity not found." });
    const [countRow] = await db.select({ total: count() }).from(opportunityRegistrationsTable)
      .where(and(eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.status, "registered")));
    const [registration] = await db.select().from(opportunityRegistrationsTable)
      .where(and(eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.participantId, user.id))).limit(1);
    const [submission] = await db.select().from(opportunitySubmissionsTable)
      .where(and(eq(opportunitySubmissionsTable.opportunityId, id), eq(opportunitySubmissionsTable.participantId, user.id))).limit(1);
    const result = {
      ...await publicOpportunity(found.opportunity, found.organizerName, Number(countRow?.total ?? 0)),
      eligibleRoles: found.opportunity.eligibleRoles,
      eligibleClasses: found.opportunity.eligibleClasses,
      isOrganizer: organizerView,
      isEligible: isEligible(user, found.opportunity),
      isRegistered: registration?.status === "registered",
      registrationStatus: registration?.status ?? null,
      mySubmission: submission ? {
        id: submission.id, content: submission.content, submissionUrl: submission.submissionUrl,
        status: found.opportunity.resultsPublished ? submission.status : "submitted", score: found.opportunity.resultsPublished ? submission.score : null,
        organizerFeedback: found.opportunity.resultsPublished ? submission.organizerFeedback : "",
        submittedAt: submission.submittedAt,
      } : null,
      canViewResults: found.opportunity.resultsPublished,
    };
    return res.json(result);
  } catch (error) {
    req.log.error(error, "Failed to load opportunity details");
    return res.status(500).json({ error: "Could not load this opportunity." });
  }
});

router.post("/opportunities/:id/register", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string, now = new Date();
    const outcome = await db.transaction(async (tx) => {
      const [opportunity] = await tx.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).for("update").limit(1);
      if (!opportunity || opportunity.status !== "published") return { status: 404, body: { error: "This opportunity is not open for registration." } };
      if (opportunity.organizerId === user.id) return { status: 400, body: { error: "Organizers cannot register for their own opportunity." } };
      if (!isEligible(user, opportunity)) return { status: 403, body: { error: "Your account role or class is not eligible for this opportunity." } };
      if ((opportunity.registrationOpensAt && opportunity.registrationOpensAt > now) ||
        !opportunity.registrationDeadline || opportunity.registrationDeadline <= now ||
        (opportunity.startsAt && opportunity.startsAt <= now)) return { status: 409, body: { error: "Registration is not currently open." } };
      const [existing] = await tx.select().from(opportunityRegistrationsTable).where(and(
        eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.participantId, user.id),
      )).limit(1);
      if (existing?.status === "registered") return { status: 200, body: { registrationId: existing.id, registered: true, alreadyRegistered: true } };
      if (opportunity.maxParticipants !== null) {
        const [total] = await tx.select({ count: count() }).from(opportunityRegistrationsTable).where(and(
          eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.status, "registered"),
        ));
        if (Number(total?.count ?? 0) >= opportunity.maxParticipants) return { status: 409, body: { error: "This opportunity has reached its registration capacity." } };
      }
      const [registration] = existing
        ? await tx.update(opportunityRegistrationsTable).set({ status: "registered", updatedAt: now }).where(eq(opportunityRegistrationsTable.id, existing.id)).returning()
        : await tx.insert(opportunityRegistrationsTable).values({ opportunityId: id, participantId: user.id, status: "registered" }).returning();
      await tx.insert(opportunityAuditTable).values({ opportunityId: id, actorId: user.id, action: existing ? "registration_reactivated" : "registration_created", details: { registrationId: registration.id } });
      await tx.insert(socialNotificationsTable).values({ recipientId: opportunity.organizerId, actorId: user.id, entityId: id, type: "opportunity_new_registration", message: `${user.fullName} registered for “${opportunity.title}”.` });
      return { status: 201, body: { registrationId: registration.id, registered: true, alreadyRegistered: false } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    req.log.error(error, "Failed to register for opportunity");
    return res.status(500).json({ error: "Could not register for this opportunity." });
  }
});

router.delete("/opportunities/:id/register", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string, now = new Date();
    const outcome = await db.transaction(async (tx) => {
      const [opportunity] = await tx.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).for("update").limit(1);
      if (!opportunity) return { status: 404, body: { error: "Opportunity not found." } };
      if (opportunity.startsAt && opportunity.startsAt <= now) return { status: 409, body: { error: "Registration can no longer be cancelled because the activity has started." } };
      const [registration] = await tx.select().from(opportunityRegistrationsTable).where(and(
        eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.participantId, user.id),
      )).limit(1);
      if (!registration || registration.status === "cancelled") return { status: 200, body: { cancelled: true, alreadyCancelled: true } };
      await tx.update(opportunityRegistrationsTable).set({ status: "cancelled", updatedAt: now }).where(eq(opportunityRegistrationsTable.id, registration.id));
      await tx.insert(opportunityAuditTable).values({ opportunityId: id, actorId: user.id, action: "registration_cancelled", details: { registrationId: registration.id } });
      await tx.insert(socialNotificationsTable).values({ recipientId: opportunity.organizerId, actorId: user.id, entityId: id, type: "opportunity_registration_cancelled", message: `${user.fullName} cancelled their registration for “${opportunity.title}”.` });
      return { status: 200, body: { cancelled: true, alreadyCancelled: false } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    req.log.error(error, "Failed to cancel opportunity registration");
    return res.status(500).json({ error: "Could not cancel this registration." });
  }
});

router.post("/opportunities/:id/submission", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string, now = new Date();
    const outcome = await db.transaction(async (tx) => {
      const [opportunity] = await tx.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).for("update").limit(1);
      if (!opportunity || opportunity.status !== "published") return { status: 404, body: { error: "This opportunity is not accepting submissions." } };
      if (opportunity.organizerId === user.id) return { status: 400, body: { error: "Organizers cannot submit entries to their own opportunity." } };
      if (!isEligible(user, opportunity)) return { status: 403, body: { error: "You are not eligible to submit to this opportunity." } };
      if (opportunity.submissionMode === "none") return { status: 400, body: { error: "This opportunity does not accept submissions." } };
      if (!opportunity.submissionDeadline || opportunity.submissionDeadline <= now) return { status: 409, body: { error: "The submission deadline has passed." } };
      const [registration] = await tx.select({ id: opportunityRegistrationsTable.id }).from(opportunityRegistrationsTable).where(and(
        eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.participantId, user.id), eq(opportunityRegistrationsTable.status, "registered"),
      )).limit(1);
      if (!registration) return { status: 403, body: { error: "Register before submitting an entry." } };
      const content = clean(req.body?.content, 10_000), submissionUrl = clean(req.body?.submissionUrl, 1000);
      if (opportunity.submissionMode === "text" && !content) return { status: 400, body: { error: "Add your text submission." } };
      if (opportunity.submissionMode === "link" && (!submissionUrl || !validUrl(submissionUrl))) return { status: 400, body: { error: "Enter a valid HTTP or HTTPS submission link." } };
      if (opportunity.submissionMode === "text" && submissionUrl) return { status: 400, body: { error: "This opportunity accepts text submissions only." } };
      if (opportunity.submissionMode === "link" && content) return { status: 400, body: { error: "This opportunity accepts a link submission only." } };
      const [existing] = await tx.select().from(opportunitySubmissionsTable).where(and(
        eq(opportunitySubmissionsTable.opportunityId, id), eq(opportunitySubmissionsTable.participantId, user.id),
      )).limit(1);
      if (opportunity.resultsPublished) return { status: 409, body: { error: "Results are published; submissions are locked." } };
      const changed = !existing || existing.content !== content || existing.submissionUrl !== (submissionUrl || null);
      const [submission] = existing
        ? await tx.update(opportunitySubmissionsTable).set({ content, submissionUrl: submissionUrl || null, status: "submitted", score: null, organizerFeedback: "", reviewedBy: null, reviewedAt: null, submittedAt: now, updatedAt: now }).where(eq(opportunitySubmissionsTable.id, existing.id)).returning()
        : await tx.insert(opportunitySubmissionsTable).values({ opportunityId: id, participantId: user.id, content, submissionUrl: submissionUrl || null }).returning();
      if (changed) await tx.insert(opportunityAuditTable).values({ opportunityId: id, actorId: user.id, action: existing ? "submission_updated" : "submission_created", details: { submissionId: submission.id } });
      if (changed) await tx.insert(socialNotificationsTable).values({ recipientId: opportunity.organizerId, actorId: user.id, entityId: id, type: "opportunity_submission_received", message: `${user.fullName} submitted an entry for “${opportunity.title}”.` });
      return { status: existing ? 200 : 201, body: { id: submission.id, submittedAt: submission.submittedAt, status: submission.status } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    req.log.error(error, "Failed to submit opportunity entry");
    return res.status(500).json({ error: "Could not submit this entry." });
  }
});

router.patch("/opportunities/:id/submissions/:submissionId", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string, submissionId = req.params.submissionId as string;
    const status = clean(req.body?.status, 20), score = req.body?.score === null || req.body?.score === "" || req.body?.score === undefined ? null : Number(req.body.score);
    const organizerFeedback = clean(req.body?.organizerFeedback, 2000);
    if (!new Set(["reviewed", "selected", "not_selected"]).has(status)) return res.status(400).json({ error: "Choose reviewed, selected, or not selected." });
    if (score !== null && (!Number.isInteger(score) || score < 0 || score > 1000)) return res.status(400).json({ error: "Score must be a whole number from 0 to 1000." });
    const outcome = await db.transaction(async (tx) => {
      const [opportunity] = await tx.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).for("update").limit(1);
      if (!opportunity) return { status: 404, body: { error: "Opportunity not found." } };
      if (!canOrganize(user) || opportunity.organizerId !== user.id) return { status: 403, body: { error: "Only this opportunity's verified alumni organizer can review entries." } };
      if (opportunity.resultsPublished) return { status: 409, body: { error: "Published results are locked." } };
      const [current] = await tx.select().from(opportunitySubmissionsTable).where(and(eq(opportunitySubmissionsTable.id, submissionId), eq(opportunitySubmissionsTable.opportunityId, id))).limit(1);
      if (!current) return { status: 404, body: { error: "Submission not found." } };
      const now = new Date();
      const changed = current.status !== status || current.score !== score || current.organizerFeedback !== organizerFeedback;
      const [saved] = await tx.update(opportunitySubmissionsTable).set({ status, score, organizerFeedback, reviewedBy: user.id, reviewedAt: now, updatedAt: now }).where(eq(opportunitySubmissionsTable.id, current.id)).returning();
      if (!saved) return { status: 404, body: { error: "Submission not found." } };
      if (changed) {
        if (current.participantId !== user.id) await tx.insert(socialNotificationsTable).values({ recipientId: current.participantId, actorId: user.id, entityId: id, type: "opportunity_submission_reviewed", message: `Your entry for ${opportunity.title} has been reviewed.` });
        await tx.insert(opportunityAuditTable).values({ opportunityId: id, actorId: user.id, action: "submission_reviewed", details: { submissionId, status, score } });
      }
      return { status: 200, body: { id: saved.id, status: saved.status, score: saved.score, reviewedAt: saved.reviewedAt } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    req.log.error(error, "Failed to review opportunity submission");
    return res.status(500).json({ error: "Could not save the review." });
  }
});
router.post("/opportunities/:id/report", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string, reason = clean(req.body?.reason, 100), details = clean(req.body?.details, 1000);
    const [opportunity] = await db.select({ id: opportunitiesTable.id, title: opportunitiesTable.title, organizerId: opportunitiesTable.organizerId })
      .from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).limit(1);
    if (!opportunity) return res.status(404).json({ error: "Opportunity not found." });
    if (opportunity.organizerId === user.id) return res.status(400).json({ error: "You cannot report your own opportunity." });
    if (!new Set(["Misleading or fraudulent", "Unsafe or inappropriate", "Spam", "Other"]).has(reason)) return res.status(400).json({ error: "Choose a report reason." });
    const [report] = await db.insert(contentReportsTable).values({
      reporterId: user.id, targetUserId: opportunity.organizerId,
      reason: `opportunity: ${reason}`, details: `Opportunity ${id} — ${opportunity.title}${details ? `\n${details}` : ""}`.slice(0, 1200),
    }).returning({ id: contentReportsTable.id });
    return res.status(201).json({ id: report.id, status: "pending" });
  } catch (error) {
    req.log.error(error, "Failed to report opportunity");
    return res.status(500).json({ error: "Could not submit this report." });
  }
});

router.patch("/opportunities/:id/results", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string;
    const publishResults = req.body?.published === true;
    if (req.body?.published !== true && req.body?.published !== false) return res.status(400).json({ error: "Choose whether to publish results." });
    const outcome = await db.transaction(async (tx) => {
      const [opportunity] = await tx.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).for("update").limit(1);
      if (!opportunity) return { status: 404, body: { error: "Opportunity not found." } };
      if (!canOrganize(user) || opportunity.organizerId !== user.id) return { status: 403, body: { error: "Only this opportunity's verified alumni organizer can publish results." } };
      const now = new Date();
      if (publishResults && (opportunity.status === "cancelled" || (opportunity.status !== "completed" && !(opportunity.endsAt && opportunity.endsAt <= now)))) return { status: 409, body: { error: "Complete the opportunity before publishing final results." } };
      if (opportunity.resultsPublished === publishResults) return { status: 200, body: { published: publishResults, unchanged: true } };
      const [updated] = await tx.update(opportunitiesTable).set({ resultsPublished: publishResults, updatedAt: now }).where(eq(opportunitiesTable.id, id)).returning();
      if (!updated) return { status: 404, body: { error: "Opportunity not found." } };
      await tx.insert(opportunityAuditTable).values({ opportunityId: id, actorId: user.id, action: publishResults ? "results_published" : "results_unpublished", details: {} });
      if (publishResults) {
        const registrations = await tx.select({ participantId: opportunityRegistrationsTable.participantId }).from(opportunityRegistrationsTable)
          .where(and(eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.status, "registered")));
        for (const participant of registrations) if (participant.participantId !== user.id) await tx.insert(socialNotificationsTable).values({
          recipientId: participant.participantId, actorId: user.id, entityId: id, type: "opportunity_results_published",
          message: `Results are available for ${opportunity.title}.`,
        });
      }
      return { status: 200, body: { published: updated.resultsPublished } };
    });
    return res.status(outcome.status).json(outcome.body);
  } catch (error) {
    req.log.error(error, "Failed to publish opportunity results");
    return res.status(500).json({ error: "Could not publish results." });
  }
});
router.patch("/opportunities/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string;
    const [current] = await db.select().from(opportunitiesTable).where(eq(opportunitiesTable.id, id)).limit(1);
    if (!current) return res.status(404).json({ error: "Opportunity not found." });
    if (current.organizerId !== user.id || !canOrganize(user)) return res.status(403).json({ error: "Only this opportunity's verified alumni organizer can manage it." });
    if (current.resultsPublished) return res.status(409).json({ error: "Published results lock this opportunity." });
    const merged = { ...currentInput(current), ...req.body } as Record<string, unknown>;
    if (req.body?.resultsPublished !== undefined) return res.status(400).json({ error: "Use the results publishing action to manage final results." });
    const validated = validateOpportunity(merged, merged.status === "published");
    if (validated.error || !validated.data) return res.status(400).json({ error: validated.error });
    const nextStatus = String(validated.data.status);
    const allowed = current.status === "draft"
      ? new Set(["draft", "published", "cancelled"])
      : current.status === "published" ? new Set(["published", "cancelled", "completed"]) : new Set([current.status]);
    if (!allowed.has(nextStatus)) return res.status(409).json({ error: "This opportunity can no longer change to that status." });
    if (current.status === "draft" && nextStatus === "published" && validated.data.registrationDeadline && validated.data.registrationDeadline <= new Date()) return res.status(400).json({ error: "Set a future registration deadline before publishing." });
    const mediaProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, "mediaKey");
    let media = current.media;
    if (mediaProvided) {
      if (req.body.mediaKey === null) media = null;
      else if (typeof req.body.mediaKey === "string") media = JSON.stringify([await validateOpportunityMedia(user.id, req.body.mediaKey)]);
      else return res.status(400).json({ error: "Choose a valid opportunity photo or video." });
    }
    const saved = await db.transaction(async (tx) => {
      const [updated] = await tx.update(opportunitiesTable).set({
        ...validated.data, ...(mediaProvided ? { media } : {}), updatedAt: new Date(),
      })
        .where(and(eq(opportunitiesTable.id, id), eq(opportunitiesTable.organizerId, user.id), eq(opportunitiesTable.status, current.status), eq(opportunitiesTable.resultsPublished, false))).returning();
      if (!updated) return null;
      const changedFields = ["type", "category", "title", "summary", "description", "eligibility", "eligibleRoles", "eligibleClasses", "format", "location", "media", "timezone", "registrationOpensAt", "registrationDeadline", "startsAt", "endsAt", "submissionDeadline", "maxParticipants", "rules", "judgingCriteria", "submissionMode", "submissionInstructions", "deliveryMode", "externalProvider", "externalUrl", "feeAmount", "feeDetails", "prizeDetails", "certificateType", "certificateDetails"]
        .filter((key) => JSON.stringify((current as any)[key]) !== JSON.stringify((updated as any)[key]));
      const statusChanged = current.status !== updated.status;
      await tx.insert(opportunityAuditTable).values({ opportunityId: id, actorId: user.id, action: statusChanged ? `status_${updated.status}` : "updated", details: { changedFields } });
      return { updated, changedFields, statusChanged };
    });
    if (!saved) return res.status(409).json({ error: "This opportunity changed while you were editing. Reload and try again." });
    const { updated, changedFields, statusChanged } = saved;
    if (statusChanged && ["cancelled", "completed"].includes(updated.status)) {
      const registrations = await db.select({ participantId: opportunityRegistrationsTable.participantId }).from(opportunityRegistrationsTable)
        .where(and(eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.status, "registered")));
      for (const participant of registrations) await notifyUser(participant.participantId, user.id, id,
        updated.status === "cancelled" ? "opportunity_cancelled" : "opportunity_completed",
        updated.status === "cancelled" ? `“${updated.title}” was cancelled by its organizer.` : `“${updated.title}” has been marked completed by its organizer.`,
      );
    } else if (updated.status === "published" && changedFields.length) {
      const registrations = await db.select({ participantId: opportunityRegistrationsTable.participantId }).from(opportunityRegistrationsTable)
        .where(and(eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.status, "registered")));
      for (const participant of registrations) await notifyUser(participant.participantId, user.id, id, "opportunity_updated", `“${updated.title}” has important updated details.`);
    }
    const [countRow] = await db.select({ total: count() }).from(opportunityRegistrationsTable)
      .where(and(eq(opportunityRegistrationsTable.opportunityId, id), eq(opportunityRegistrationsTable.status, "registered")));
    return res.json(await publicOpportunity(updated, user.fullName, Number(countRow?.total ?? 0)));
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error, "Failed to update opportunity");
    return res.status(500).json({ error: "Could not update this opportunity." });
  }
});

export default router;
