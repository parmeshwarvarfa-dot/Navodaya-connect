import { Router } from "express";
import { and, asc, desc, eq, gte, lte, ne } from "drizzle-orm";
import { db, eventsTable, eventRegistrationsTable } from "@workspace/db";
import { requireAuth, getUser, isCommunityVerifiedAlumni } from "../lib/auth";
import { MemoryMediaError, parseStoredMemoryMedia, signMemoryMedia, validateOwnedMemoryMedia } from "../lib/memory-media";

const router = Router();

router.get("/events", requireAuth, async (req, res) => {
  try {
    const { from: fromParam, to: toParam } = req.query;
    let events;
    if (fromParam !== undefined || toParam !== undefined) {
      if (typeof fromParam !== "string" || typeof toParam !== "string") {
        return res.status(400).json({ error: "Both valid from and to dates are required." });
      }
      const from = new Date(fromParam);
      const to = new Date(toParam);
      const rangeLength = to.getTime() - from.getTime();
      if (
        Number.isNaN(from.getTime()) ||
        Number.isNaN(to.getTime()) ||
        rangeLength < 0 ||
        rangeLength > 366 * 24 * 60 * 60 * 1000
      ) {
        return res.status(400).json({ error: "Choose a valid date range of 366 days or less." });
      }
      events = await db
        .select()
        .from(eventsTable)
        .where(and(ne(eventsTable.date, ""), gte(eventsTable.date, from.toISOString()), lte(eventsTable.date, to.toISOString())))
        .orderBy(asc(eventsTable.date))
        .limit(500);
    } else {
      events = await db.select().from(eventsTable).where(ne(eventsTable.date, "")).orderBy(desc(eventsTable.createdAt)).limit(100);
    }
    const serialized = await Promise.all(events.map(async (event) => {
      const [media] = parseStoredMemoryMedia(event.media);
      if (!media || typeof media === "string" || !event.organizerId) return { ...event, mediaUrl: null, mediaType: null };
      return {
        ...event,
        mediaUrl: await signMemoryMedia(media, event.organizerId),
        mediaType: media.mediaType,
      };
    }));
    res.json(serialized);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.post("/events", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role === "student") return res.status(403).json({ error: "Student accounts cannot publish events." });
    if (user.role === "alumni" ? !isCommunityVerifiedAlumni(user) : user.verificationStatus !== "verified") return res.status(403).json({ error: user.role === "alumni" ? "Community verification is required to publish events." : "Verified accounts can publish events." });
    const { title, description, date, location, mediaKey } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || title.length > 160 || typeof description !== "string" || !description.trim() || description.length > 4000 || typeof date !== "string" || Number.isNaN(new Date(date).getTime())) return res.status(400).json({ error: "A valid title, description and date are required" });
    let media = null;
    if (mediaKey !== undefined) {
      if (typeof mediaKey !== "string") return res.status(400).json({ error: "Choose a valid event photo or video." });
      media = await validateOwnedMemoryMedia(user.id, mediaKey);
    }
    const [event] = await db.insert(eventsTable).values({
      title: title.trim(),
      description: description.trim(),
      date: new Date(date).toISOString(),
      location: typeof location === "string" ? location.trim().slice(0, 200) : null,
      media: media ? JSON.stringify([media]) : null,
      organizer: user.fullName,
      organizerId: user.id,
      jnvName: user.jnvName,
    }).returning();
    res.json({ ...event, mediaUrl: media ? await signMemoryMedia(media, user.id) : null, mediaType: media?.mediaType ?? null });
  } catch (e: any) {
    if (e instanceof MemoryMediaError) return res.status(e.statusCode).json({ error: e.message });
    req.log.error(e);
    res.status(500).json({ error: "Failed to create event" });
  }
});

router.patch("/events/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role === "student") return res.status(403).json({ error: "Student accounts cannot publish or edit events." });
    const eventId = req.params.id as string;
    const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Event not found" });
    if (existing.organizerId !== user.id) return res.status(403).json({ error: "Only the event organizer can edit this event." });

    const { title, description, date, location, mediaKey } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || title.length > 160 ||
      typeof description !== "string" || !description.trim() || description.length > 4000 ||
      typeof date !== "string" || Number.isNaN(new Date(date).getTime()) ||
      (location !== undefined && location !== null && typeof location !== "string")) {
      return res.status(400).json({ error: "A valid title, description and date are required" });
    }

    let media = null;
    if (mediaKey !== undefined) {
      if (typeof mediaKey !== "string") return res.status(400).json({ error: "Choose a valid event photo or video." });
      media = await validateOwnedMemoryMedia(user.id, mediaKey);
    }
    const [updated] = await db.update(eventsTable).set({
      title: title.trim(),
      description: description.trim(),
      date: new Date(date).toISOString(),
      location: typeof location === "string" ? location.trim().slice(0, 200) || null : location === null ? null : existing.location,
      ...(media ? { media: JSON.stringify([media]) } : {}),
    }).where(eq(eventsTable.id, eventId)).returning();
    const [storedMedia] = parseStoredMemoryMedia(updated.media);
    const mediaUrl = storedMedia && typeof storedMedia !== "string" && updated.organizerId
      ? await signMemoryMedia(storedMedia, updated.organizerId)
      : null;
    return res.json({ ...updated, mediaUrl, mediaType: storedMedia && typeof storedMedia !== "string" ? storedMedia.mediaType : null });
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error, "Failed to update event");
    return res.status(500).json({ error: "Failed to update event" });
  }
});

router.delete("/events/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const eventId = req.params.id as string;
    const [event] = await db.select({ id: eventsTable.id, organizerId: eventsTable.organizerId })
      .from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.organizerId !== user.id) return res.status(403).json({ error: "Only the event organizer can delete this event." });
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    return res.json({ deleted: true });
  } catch (error) {
    req.log.error(error, "Failed to delete event");
    return res.status(500).json({ error: "Failed to delete event" });
  }
});

router.get("/events/:id/registrations", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, req.params.id as string)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.organizerId !== user.id && user.role !== "official") return res.status(403).json({ error: "Only the organizer can view registrations" });
    const regs = await db
      .select()
      .from(eventRegistrationsTable)
      .where(eq(eventRegistrationsTable.eventId, req.params.id as string))
      .orderBy(desc(eventRegistrationsTable.createdAt));
    res.json(regs);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

router.post("/events/:id/register", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const {
      contactNo, contribution,
    } = req.body;
    const eventId = req.params.id as string;
    const [event] = await db.select({ id: eventsTable.id }).from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    const existing = await db.select({ id: eventRegistrationsTable.id }).from(eventRegistrationsTable).where(and(eq(eventRegistrationsTable.eventId, eventId), eq(eventRegistrationsTable.userId, user.id))).limit(1);
    if (existing.length) return res.status(409).json({ error: "You are already registered" });
    const [reg] = await db.insert(eventRegistrationsTable).values({
      eventId,
      userId: user.id,
      role: user.role,
      fullName: user.fullName,
      jnvName: user.jnvName,
      jnvState: user.jnvState,
      contactNo: typeof contactNo === "string" ? contactNo.trim().slice(0, 40) : null,
      passoutBatch: user.passoutYear,
      house: user.house,
      class: user.class,
      designation: user.designation,
      subject: user.subject,
      contribution: typeof contribution === "string" ? contribution.trim().slice(0, 500) : null,
      feedback: null,
      dietaryPreference: null,
    }).returning();
    res.json(reg);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to register" });
  }
});

export default router;
