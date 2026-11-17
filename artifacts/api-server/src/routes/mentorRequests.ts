import { Router } from "express";
import { and, asc, eq, isNotNull, or } from "drizzle-orm";
import { db, mentorProfilesTable, mentorRequestsTable, usersTable } from "@workspace/db";
import { requireAuth, getUser, isCommunityVerifiedAlumni } from "../lib/auth";

const router = Router();
const MENTOR_CATEGORIES = ["JEE/IIT", "NEET", "UPSC", "Coding/Tech", "Startup", "Defence", "Law", "Research", "General Career"];

router.get("/mentor-requests/availability", requireAuth, async (req, res) => {
  const user = getUser(req);
  if (!isCommunityVerifiedAlumni(user)) return res.status(403).json({ error: "Community verified alumni access is required." });
  try {
    const [profile] = await db.select().from(mentorProfilesTable).where(eq(mentorProfilesTable.userId, user.id)).limit(1);
    return res.json(profile ?? { available: false, categories: [], bio: "" });
  } catch (error) {
    req.log.error(error, "Failed to load mentor availability");
    return res.status(500).json({ error: "Could not load mentor settings." });
  }
});

router.patch("/mentor-requests/availability", requireAuth, async (req, res) => {
  const user = getUser(req);
  if (!isCommunityVerifiedAlumni(user)) return res.status(403).json({ error: "Community verified alumni access is required." });
  const available = req.body?.available;
  const categories = req.body?.categories;
  const bio = typeof req.body?.bio === "string" ? req.body.bio.trim() : "";
  if (typeof available !== "boolean" || !Array.isArray(categories) || categories.length > MENTOR_CATEGORIES.length || categories.some((item: unknown) => typeof item !== "string" || !MENTOR_CATEGORIES.includes(item)) || bio.length > 1000) {
    return res.status(400).json({ error: "Choose valid mentorship categories and a bio under 1,000 characters." });
  }
  try {
    const [profile] = await db.insert(mentorProfilesTable).values({ userId: user.id, available, categories: [...new Set(categories)], bio, updatedAt: new Date() })
      .onConflictDoUpdate({ target: mentorProfilesTable.userId, set: { available, categories: [...new Set(categories)], bio, updatedAt: new Date() } }).returning();
    return res.json(profile);
  } catch (error) {
    req.log.error(error, "Failed to save mentor availability");
    return res.status(500).json({ error: "Could not save mentor settings." });
  }
});

router.get("/mentor-requests/mentors", requireAuth, async (req, res) => {
  const user = getUser(req);
  if (user.role !== "student" || user.verificationStatus !== "verified") return res.status(403).json({ error: "Verified students can browse mentors." });
  try {
    const mentors = await db.select({ id: usersTable.id, fullName: usersTable.fullName, profession: usersTable.profession, company: usersTable.company, jnvName: usersTable.jnvName, categories: mentorProfilesTable.categories, bio: mentorProfilesTable.bio })
      .from(mentorProfilesTable).innerJoin(usersTable, eq(usersTable.id, mentorProfilesTable.userId))
      .where(and(eq(mentorProfilesTable.available, true), eq(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "community_verified"), isNotNull(usersTable.communityVerifiedAt), eq(usersTable.jnvName, user.jnvName), eq(usersTable.jnvState, user.jnvState)))
      .orderBy(asc(usersTable.fullName)).limit(100);
    return res.json(mentors);
  } catch (error) {
    req.log.error(error, "Failed to load available mentors");
    return res.status(500).json({ error: "Could not load available mentors." });
  }
});

router.get("/mentor-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "student" && user.role !== "alumni") return res.status(403).json({ error: "Mentorship requests are unavailable for this account" });
    const requests = await db.select().from(mentorRequestsTable)
      .where(or(eq(mentorRequestsTable.studentId, user.id), eq(mentorRequestsTable.mentorId, user.id)));
    res.json(requests);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.post("/mentor-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "student") return res.status(403).json({ error: "Only students can request a mentor" });
    const { mentorId, category, message } = req.body ?? {};
    if (typeof mentorId !== "string" || typeof category !== "string" || !category.trim() || typeof message !== "string" || !message.trim() || message.length > 2000) return res.status(400).json({ error: "Choose a mentor and provide a short message" });
    if (user.verificationStatus !== "verified") return res.status(403).json({ error: "Verified student status is required to request a mentor" });
    const [mentor] = await db.select({ id: usersTable.id, fullName: usersTable.fullName }).from(usersTable).innerJoin(mentorProfilesTable, eq(mentorProfilesTable.userId, usersTable.id)).where(and(
      eq(usersTable.id, mentorId), eq(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "community_verified"), isNotNull(usersTable.communityVerifiedAt),
      eq(usersTable.jnvName, user.jnvName), eq(usersTable.jnvState, user.jnvState), eq(mentorProfilesTable.available, true),
    )).limit(1);
    if (!mentor) return res.status(404).json({ error: "Verified alumni mentor not found in your school community" });
    const [request] = await db.insert(mentorRequestsTable).values({
      studentId: user.id,
      studentName: user.fullName,
      mentorId,
      mentorName: mentor.fullName,
      category: category.trim().slice(0, 80),
      message: message.trim(),
      status: "pending",
    }).returning();
    res.json(request);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to send request" });
  }
});

router.patch("/mentor-requests/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!isCommunityVerifiedAlumni(user)) return res.status(403).json({ error: "Community verified alumni access is required" });
    const [request] = await db.select().from(mentorRequestsTable).where(and(eq(mentorRequestsTable.id, req.params.id as string), eq(mentorRequestsTable.mentorId, user.id))).limit(1);
    if (!request) return res.status(404).json({ error: "Mentor request not found" });
    const [student] = await db.select({ id: usersTable.id }).from(usersTable).where(and(
      eq(usersTable.id, request.studentId!), eq(usersTable.jnvName, user.jnvName), eq(usersTable.jnvState, user.jnvState),
    )).limit(1);
    if (!student) return res.status(404).json({ error: "Mentor request not found" });
    const status = req.body?.status;
    if (status !== "accepted" && status !== "declined") return res.status(400).json({ error: "Choose accept or decline" });
    const [row] = await db.update(mentorRequestsTable).set({ status })
      .where(and(eq(mentorRequestsTable.id, request.id), eq(mentorRequestsTable.mentorId, user.id), eq(mentorRequestsTable.status, "pending")))
      .returning();
    if (!row) return res.status(404).json({ error: "Pending mentor request not found" });
    return res.json(row);
  } catch (error) {
    req.log.error(error, "Failed to respond to mentor request");
    return res.status(500).json({ error: "Failed to update mentorship request" });
  }
});

router.patch("/mentor-requests/:id/schedule", requireAuth, async (req, res) => {
  const user = getUser(req);
  const scheduledAt = typeof req.body?.scheduledAt === "string" ? new Date(req.body.scheduledAt) : null;
  if (!scheduledAt || Number.isNaN(scheduledAt.getTime()) || scheduledAt.getTime() < Date.now() + 5 * 60_000 || scheduledAt.getTime() > Date.now() + 180 * 24 * 60 * 60_000) return res.status(400).json({ error: "Choose a session time between 5 minutes and 6 months from now." });
  try {
    const [request] = await db.select().from(mentorRequestsTable).where(eq(mentorRequestsTable.id, req.params.id as string)).limit(1);
    if (!request || (request.studentId !== user.id && request.mentorId !== user.id)) return res.status(404).json({ error: "Mentorship request not found." });
    if (request.status !== "accepted") return res.status(409).json({ error: "Accept the request before scheduling a session." });
    const [saved] = await db.update(mentorRequestsTable).set({ scheduledAt })
      .where(and(eq(mentorRequestsTable.id, request.id), eq(mentorRequestsTable.status, "accepted"))).returning();
    return res.json(saved);
  } catch (error) {
    req.log.error(error, "Failed to schedule mentorship session");
    return res.status(500).json({ error: "Could not schedule the session." });
  }
});

router.post("/mentor-requests/:id/complete", requireAuth, async (req, res) => {
  const user = getUser(req);
  if (!isCommunityVerifiedAlumni(user)) return res.status(403).json({ error: "Community verified alumni access is required." });
  try {
    const [saved] = await db.update(mentorRequestsTable).set({ status: "completed", completedAt: new Date() })
      .where(and(eq(mentorRequestsTable.id, req.params.id as string), eq(mentorRequestsTable.mentorId, user.id), eq(mentorRequestsTable.status, "accepted"), isNotNull(mentorRequestsTable.scheduledAt))).returning();
    if (!saved) return res.status(409).json({ error: "Only an accepted, scheduled session can be marked complete." });
    return res.json(saved);
  } catch (error) {
    req.log.error(error, "Failed to complete mentorship session");
    return res.status(500).json({ error: "Could not complete the session." });
  }
});

router.post("/mentor-requests/:id/feedback", requireAuth, async (req, res) => {
  const user = getUser(req);
  const rating = req.body?.rating;
  const feedback = typeof req.body?.feedback === "string" ? req.body.feedback.trim() : "";
  if (!Number.isInteger(rating) || rating < 1 || rating > 5 || feedback.length > 1000) return res.status(400).json({ error: "Provide a rating from 1 to 5 and feedback under 1,000 characters." });
  try {
    const [saved] = await db.update(mentorRequestsTable).set({ feedbackRating: rating, feedback })
      .where(and(eq(mentorRequestsTable.id, req.params.id as string), eq(mentorRequestsTable.studentId, user.id), eq(mentorRequestsTable.status, "completed"))).returning();
    if (!saved) return res.status(409).json({ error: "Only the student can review a completed mentorship session." });
    return res.json(saved);
  } catch (error) {
    req.log.error(error, "Failed to save mentorship feedback");
    return res.status(500).json({ error: "Could not save feedback." });
  }
});

export default router;
