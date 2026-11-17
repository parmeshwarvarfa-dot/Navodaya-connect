import { Router } from "express";
import { and, asc, avg, count, desc, eq, ilike, inArray, ne, or } from "drizzle-orm";
import { db, businessesTable, businessReviewsTable, bloodRequestsTable, bloodRequestResponsesTable, contentReportsTable, usersTable } from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { createSocialNotification, isBlockedBetween } from "../lib/social-access";
import { isValidUserId } from "./user-validation";
import { MemoryMediaError, parseStoredMemoryMedia, signMemoryMedia, validateOwnedMemoryMedia, type StoredMemoryMedia } from "../lib/memory-media";

const router = Router();
const GROUPS = new Set(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]);
const REPORT_REASONS = new Set(["Spam or Fake Account", "Inappropriate Content", "Harassment or Bullying", "Privacy Violation", "Other"]);
const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const validHttpUrl = (value: string) => {
  try { const parsed = new URL(value); return parsed.protocol === "https:" || parsed.protocol === "http:"; } catch { return false; }
};

async function serializeBusiness<T extends { media?: string | null; ownerId?: string | null }>(row: T, applicantName = "") {
  const { media: storedMedia, ...business } = row;
  const media = parseStoredMemoryMedia(storedMedia);
  const ownerId = row.ownerId;
  const mediaUrls = await Promise.all(media.map((item) =>
    typeof item === "string" ? Promise.resolve(item) : ownerId ? signMemoryMedia(item, ownerId) : Promise.resolve(""),
  ));
  return { ...business, applicantName, mediaUrls: mediaUrls.filter(Boolean) };
}

function validEmail(value: string) {
  return !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validPhone(value: string) {
  return !value || /^[+\d() .-]{7,25}$/.test(value);
}

router.get("/businesses", requireAuth, async (req, res) => {
  try {
    const q = clean(req.query.q, 100), category = clean(req.query.category, 60), city = clean(req.query.city, 100);
    const rows = await db.select({ business: businessesTable, applicantName: usersTable.fullName }).from(businessesTable)
      .innerJoin(usersTable, eq(usersTable.id, businessesTable.ownerId)).where(and(
      eq(businessesTable.status, "active"),
      ...(q ? [or(
        ilike(businessesTable.name, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
        ilike(businessesTable.category, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
        ilike(businessesTable.description, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
        ilike(businessesTable.services, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
      )] : []),
      ...(category ? [eq(businessesTable.category, category)] : []),
      ...(city ? [ilike(businessesTable.city, `%${city.replace(/[%_\\]/g, "\\$&")}%`)] : []),
    )).orderBy(desc(businessesTable.createdAt)).limit(100);
    const ids = rows.map(({ business }) => business.id);
    const reviewStats = ids.length ? await db.select({
      businessId: businessReviewsTable.businessId,
      rating: avg(businessReviewsTable.rating),
      reviewsCount: count(),
    }).from(businessReviewsTable).where(inArray(businessReviewsTable.businessId, ids)).groupBy(businessReviewsTable.businessId) : [];
    const statsById = new Map(reviewStats.map((item) => [item.businessId, { rating: Number(item.rating ?? 0), reviewsCount: Number(item.reviewsCount) }]));
    const viewer = getUser(req);
    const visible = await Promise.all(rows.map(async ({ business, applicantName }) => {
      if (await isBlockedBetween(viewer.id, business.ownerId)) return null;
      return { ...await serializeBusiness(business, applicantName), ...(statsById.get(business.id) ?? { rating: 0, reviewsCount: 0 }) };
    }));
    return res.json(visible.filter(Boolean));
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error); return res.status(500).json({ error: "Could not load businesses" });
  }
});

router.get("/businesses/:id", requireAuth, async (req, res) => {
  try {
    const viewer = getUser(req), id = req.params.id as string;
    const [result] = await db.select({ business: businessesTable, applicantName: usersTable.fullName }).from(businessesTable)
      .innerJoin(usersTable, eq(usersTable.id, businessesTable.ownerId)).where(eq(businessesTable.id, id)).limit(1);
    if (!result || (result.business.status !== "active" && result.business.ownerId !== viewer.id) || await isBlockedBetween(viewer.id, result.business.ownerId)) {
      return res.status(404).json({ error: "Business listing not found." });
    }
    const reviews = await db.select({
      id: businessReviewsTable.id, reviewerId: businessReviewsTable.reviewerId,
      reviewerName: usersTable.fullName, rating: businessReviewsTable.rating,
      review: businessReviewsTable.review, createdAt: businessReviewsTable.createdAt,
    }).from(businessReviewsTable).innerJoin(usersTable, eq(usersTable.id, businessReviewsTable.reviewerId))
      .where(eq(businessReviewsTable.businessId, id)).orderBy(desc(businessReviewsTable.createdAt)).limit(100);
    const rating = reviews.length ? reviews.reduce((total, item) => total + item.rating, 0) / reviews.length : 0;
    return res.json({ ...await serializeBusiness(result.business, result.applicantName), rating, reviewsCount: reviews.length, reviews });
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error); return res.status(500).json({ error: "Could not load this business" });
  }
});

router.post("/businesses", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "alumni") return res.status(403).json({ error: "Only alumni accounts can publish a business listing." });
    const name = clean(req.body?.name, 120), ownerName = clean(req.body?.ownerName, 120), category = clean(req.body?.category, 60);
    const address = clean(req.body?.address, 300), state = clean(req.body?.state, 80), district = clean(req.body?.district, 100), pincode = clean(req.body?.pincode, 12);
    const city = clean(req.body?.city, 100) || district;
    const description = clean(req.body?.description, 2000), services = clean(req.body?.services, 1000), website = clean(req.body?.website, 500);
    const phone = clean(req.body?.phone, 25), email = clean(req.body?.email, 160);
    const contactPreference = req.body?.contactPreference === "website" ? "website" : "message";
    const social = {
      facebook: clean(req.body?.facebook, 500), linkedin: clean(req.body?.linkedin, 500),
      instagram: clean(req.body?.instagram, 500), xProfile: clean(req.body?.xProfile, 500),
    };
    if (!name || !ownerName || !category || !address || !state || !district || !/^\d{6}$/.test(pincode)) return res.status(400).json({ error: "Complete the business name, owner and location details, including a 6-digit pincode." });
    if (!phone && !email) return res.status(400).json({ error: "Add a phone number or email so customers can contact the business." });
    if (!validPhone(phone) || !validEmail(email)) return res.status(400).json({ error: "Enter a valid phone number and email address." });
    if (website && !validHttpUrl(website)) return res.status(400).json({ error: "Website must be a valid HTTP or HTTPS URL." });
    for (const link of Object.values(social)) if (link && !validHttpUrl(link)) return res.status(400).json({ error: "Social profile links must be valid HTTP or HTTPS URLs." });
    const priceMin = req.body?.priceMin === null || req.body?.priceMin === "" || req.body?.priceMin === undefined ? null : Number(req.body.priceMin);
    const priceMax = req.body?.priceMax === null || req.body?.priceMax === "" || req.body?.priceMax === undefined ? null : Number(req.body.priceMax);
    const discount = Number(req.body?.navodayansDiscount ?? 0);
    if ((priceMin !== null && (!Number.isInteger(priceMin) || priceMin < 0 || priceMin > 1_000_000_000)) ||
      (priceMax !== null && (!Number.isInteger(priceMax) || priceMax < 0 || priceMax > 1_000_000_000)) ||
      (priceMin !== null && priceMax !== null && priceMax < priceMin)) return res.status(400).json({ error: "Enter a valid minimum and maximum price range." });
    if (!Number.isInteger(discount) || discount < 0 || discount > 100) return res.status(400).json({ error: "Navodayans discount must be from 0 to 100%." });
    const keys: unknown = req.body?.mediaKeys ?? [];
    if (!Array.isArray(keys) || keys.length > 10 || keys.some((key) => typeof key !== "string" || !key) || new Set(keys).size !== keys.length) {
      return res.status(400).json({ error: "Add up to 10 valid business photos." });
    }
    const media: StoredMemoryMedia[] = await Promise.all((keys as string[]).map((key) => validateOwnedMemoryMedia(user.id, key)));
    if (media.some((item) => item.mediaType !== "image")) return res.status(400).json({ error: "Business galleries can only contain photos." });
    const [row] = await db.insert(businessesTable).values({
      ownerId: user.id, name, ownerName, category, city, state, district, address, pincode,
      description, services, phone, email, website: website || null, contactPreference, ...social,
      media: JSON.stringify(media), priceMin, priceMax, navodayansDiscount: discount,
    }).returning();
    return res.status(201).json({ ...await serializeBusiness(row, user.fullName), rating: 0, reviewsCount: 0 });
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error); return res.status(500).json({ error: "Could not create business listing" });
  }
});

router.post("/businesses/:id/reviews", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string;
    if (user.role !== "alumni") return res.status(403).json({ error: "Only alumni accounts can review community businesses." });
    const rating = Number(req.body?.rating), review = clean(req.body?.review, 1000);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return res.status(400).json({ error: "Choose a rating from 1 to 5 stars." });
    const [business] = await db.select({ id: businessesTable.id, ownerId: businessesTable.ownerId, status: businessesTable.status })
      .from(businessesTable).where(eq(businessesTable.id, id)).limit(1);
    if (!business || business.status !== "active") return res.status(404).json({ error: "Business listing not found." });
    if (business.ownerId === user.id) return res.status(400).json({ error: "You cannot review your own business." });
    if (await isBlockedBetween(user.id, business.ownerId)) return res.status(404).json({ error: "Business listing not found." });
    const [saved] = await db.insert(businessReviewsTable).values({ businessId: id, reviewerId: user.id, rating, review })
      .onConflictDoUpdate({ target: [businessReviewsTable.businessId, businessReviewsTable.reviewerId], set: { rating, review, updatedAt: new Date() } }).returning();
    return res.status(201).json({ ...saved, reviewerName: user.fullName });
  } catch (error) { req.log.error(error); return res.status(500).json({ error: "Could not save review" }); }
});

router.patch("/businesses/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string;
    const [current] = await db.select().from(businessesTable).where(eq(businessesTable.id, id)).limit(1);
    if (!current) return res.status(404).json({ error: "Listing not found" });
    if (current.ownerId !== user.id) return res.status(403).json({ error: "Only the listing owner can edit it." });
    const status = req.body?.status;
    if (status !== undefined && !["active", "inactive"].includes(status)) return res.status(400).json({ error: "Invalid listing status." });
    const website = req.body?.website === undefined ? current.website : clean(req.body.website, 500);
    if (website && !validHttpUrl(website)) return res.status(400).json({ error: "Website must be a valid HTTP or HTTPS URL." });
    const [row] = await db.update(businessesTable).set({
      name: req.body?.name === undefined ? current.name : clean(req.body.name, 120),
      category: req.body?.category === undefined ? current.category : clean(req.body.category, 60),
      city: req.body?.city === undefined ? current.city : clean(req.body.city, 100),
      description: req.body?.description === undefined ? current.description : clean(req.body.description, 2000),
      services: req.body?.services === undefined ? current.services : clean(req.body.services, 1000), website: website || null,
      contactPreference: req.body?.contactPreference === "website" ? "website" : req.body?.contactPreference === "message" ? "message" : current.contactPreference,
      status: status ?? current.status, updatedAt: new Date(),
    }).where(eq(businessesTable.id, id)).returning();
    return res.json(row);
  } catch (error) { req.log.error(error); return res.status(500).json({ error: "Could not update listing" }); }
});

router.get("/blood-requests", requireAuth, async (req, res) => {
  try {
    const group = clean(req.query.bloodGroup, 3), city = clean(req.query.city, 100);
    const rows = await db.select({ id: bloodRequestsTable.id, ownerId: bloodRequestsTable.ownerId, bloodGroup: bloodRequestsTable.bloodGroup,
      hospital: bloodRequestsTable.hospital, city: bloodRequestsTable.city, requiredAt: bloodRequestsTable.requiredAt,
      urgency: bloodRequestsTable.urgency, notes: bloodRequestsTable.notes, responseMethod: bloodRequestsTable.responseMethod,
      status: bloodRequestsTable.status, createdAt: bloodRequestsTable.createdAt, updatedAt: bloodRequestsTable.updatedAt,
      ownerName: usersTable.fullName,
    }).from(bloodRequestsTable).innerJoin(usersTable, eq(usersTable.id, bloodRequestsTable.ownerId)).where(and(
      ne(bloodRequestsTable.status, "cancelled"),
      ...(group && GROUPS.has(group) ? [eq(bloodRequestsTable.bloodGroup, group)] : []),
      ...(city ? [ilike(bloodRequestsTable.city, `%${city.replace(/[%_\\]/g, "\\$&")}%`)] : []),
    )).orderBy(asc(bloodRequestsTable.requiredAt)).limit(100);
    const viewer = getUser(req);
    const visible = await Promise.all(rows.map(async row => await isBlockedBetween(viewer.id, row.ownerId) ? null : row));
    return res.json(visible.filter(Boolean));
  } catch (error) { req.log.error(error); return res.status(500).json({ error: "Could not load blood requests" }); }
});

router.post("/blood-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), bloodGroup = clean(req.body?.bloodGroup, 3), hospital = clean(req.body?.hospital, 160), city = clean(req.body?.city, 100);
    const requiredAt = new Date(req.body?.requiredAt), urgency = req.body?.urgency === "urgent" ? "urgent" : "normal";
    const notes = clean(req.body?.notes, 1000);
    if (!GROUPS.has(bloodGroup) || !hospital || !city || Number.isNaN(requiredAt.getTime())) return res.status(400).json({ error: "Blood group, hospital, city and required time are required." });
    if (requiredAt < new Date(Date.now() - 60_000)) return res.status(400).json({ error: "Required time must be in the future." });
    const [row] = await db.insert(bloodRequestsTable).values({ ownerId: user.id, bloodGroup, hospital, city, requiredAt, urgency, notes }).returning();
    return res.status(201).json(row);
  } catch (error) { req.log.error(error); return res.status(500).json({ error: "Could not create blood request" }); }
});

router.post("/blood-requests/:id/respond", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string, message = clean(req.body?.message, 500);
    const [request] = await db.select().from(bloodRequestsTable).where(eq(bloodRequestsTable.id, id)).limit(1);
    if (!request || request.status !== "open") return res.status(404).json({ error: "Open request not found." });
    if (request.ownerId === user.id) return res.status(400).json({ error: "You cannot respond to your own request." });
    if (await isBlockedBetween(user.id, request.ownerId)) return res.status(404).json({ error: "Open request not found." });
    const [response] = await db.insert(bloodRequestResponsesTable).values({ requestId: id, responderId: user.id, message }).onConflictDoNothing().returning();
    if (!response) return res.status(409).json({ error: "You have already responded." });
    await createSocialNotification(request.ownerId, user.id, "blood_request_response", id, `${user.fullName} responded to your blood donation request.`);
    return res.status(201).json({ success: true });
  } catch (error) { req.log.error(error); return res.status(500).json({ error: "Could not send response" }); }
});

router.patch("/blood-requests/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), id = req.params.id as string, status = req.body?.status;
    if (![
      "open", "fulfilled", "cancelled",
    ].includes(status)) return res.status(400).json({ error: "Invalid request status." });
    const [row] = await db.update(bloodRequestsTable).set({ status, updatedAt: new Date() }).where(and(
      eq(bloodRequestsTable.id, id), eq(bloodRequestsTable.ownerId, user.id),
    )).returning();
    if (!row) return res.status(404).json({ error: "Request not found." });
    return res.json(row);
  } catch (error) { req.log.error(error); return res.status(500).json({ error: "Could not update request" }); }
});

router.post("/community-reports", requireAuth, async (req, res) => {
  try {
    const user = getUser(req), targetType = req.body?.targetType, targetId = clean(req.body?.targetId, 40), reason = clean(req.body?.reason, 80), details = clean(req.body?.details, 1000);
    if (!isValidUserId(targetId) || !["business", "blood_request"].includes(targetType) || !REPORT_REASONS.has(reason)) return res.status(400).json({ error: "Invalid report." });
    if (targetType === "business" && !await db.select({ id: businessesTable.id }).from(businessesTable).where(eq(businessesTable.id, targetId)).limit(1).then(rows => rows.length)) return res.status(404).json({ error: "Listing not found." });
    if (targetType === "blood_request" && !await db.select({ id: bloodRequestsTable.id }).from(bloodRequestsTable).where(eq(bloodRequestsTable.id, targetId)).limit(1).then(rows => rows.length)) return res.status(404).json({ error: "Request not found." });
    const [row] = await db.insert(contentReportsTable).values({
      reporterId: user.id,
      targetUserId: targetType === "business"
        ? (await db.select({ ownerId: businessesTable.ownerId }).from(businessesTable).where(eq(businessesTable.id, targetId)).limit(1))[0]?.ownerId ?? null
        : (await db.select({ ownerId: bloodRequestsTable.ownerId }).from(bloodRequestsTable).where(eq(bloodRequestsTable.id, targetId)).limit(1))[0]?.ownerId ?? null,
      reason: `${targetType}: ${reason}`, details: details || null,
    }).returning();
    return res.status(201).json({ success: true, id: row.id });
  } catch (error) { req.log.error(error); return res.status(500).json({ error: "Could not submit report" }); }
});

export default router;
