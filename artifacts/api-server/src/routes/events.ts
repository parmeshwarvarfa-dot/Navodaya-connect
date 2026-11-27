import { Router } from "express";
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, ne, or, sql, type SQL } from "drizzle-orm";
import { db, eventsTable, eventRegistrationsTable, socialNotificationsTable, usersTable } from "@workspace/db";
import { requireAuth, getUser, isCommunityVerifiedAlumni, isAuthorizedSchoolStaff, type AuthenticatedUser } from "../lib/auth";
import { createSocialNotification } from "../lib/social-access";
import { MemoryMediaError, parseStoredMemoryMedia, signMemoryMedia, validateOwnedMemoryMedia } from "../lib/memory-media";

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

async function canManageEvent(
  user: AuthenticatedUser,
  event: Pick<typeof eventsTable.$inferSelect, "organizerId" | "authorizedOrganizers" | "jnvName">,
): Promise<boolean> {
  if (event.organizerId && event.organizerId === user.id) return true;
  if (Array.isArray(event.authorizedOrganizers) && event.authorizedOrganizers.includes(user.id)) return true;
  if (await isAuthorizedSchoolStaff(user)) {
    if (event.jnvName && user.jnvName && event.jnvName === user.jnvName) return true;
  }
  return false;
}

function sanitizeCustomAnswers(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw).slice(0, 20)) {
    if (typeof k === "string" && typeof v === "string") {
      const key = k.trim().slice(0, 80);
      const val = v.trim().slice(0, 500);
      if (key && val) result[key] = val;
    }
  }
  return result;
}

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  // Neutralize spreadsheet formula injection
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replace(/"/g, '""')}"`;
}

router.get("/events", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
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

    const eventIds = events.map((e) => e.id);
    const [confirmedCounts, myRegs] = eventIds.length
      ? await Promise.all([
          db
            .select({ eventId: eventRegistrationsTable.eventId, total: count() })
            .from(eventRegistrationsTable)
            .where(and(inArray(eventRegistrationsTable.eventId, eventIds), eq(eventRegistrationsTable.status, "confirmed")))
            .groupBy(eventRegistrationsTable.eventId),
          db
            .select({ eventId: eventRegistrationsTable.eventId, status: eventRegistrationsTable.status })
            .from(eventRegistrationsTable)
            .where(and(inArray(eventRegistrationsTable.eventId, eventIds), eq(eventRegistrationsTable.userId, user.id))),
        ])
      : [[], []];

    const countByEvent = new Map(confirmedCounts.map((r) => [r.eventId, Number(r.total)]));
    const myStatusByEvent = new Map(myRegs.map((r) => [r.eventId, r.status]));

    const serialized = await Promise.all(
      events.map(async (event) => {
        const [media] = parseStoredMemoryMedia(event.media);
        const mediaUrl = media && typeof media !== "string" && event.organizerId
          ? await signMemoryMedia(media, event.organizerId)
          : null;
        const confirmedCount = countByEvent.get(event.id) ?? 0;
        const remainingCapacity = event.maxCapacity != null ? Math.max(0, event.maxCapacity - confirmedCount) : null;
        const myRegistrationStatus = myStatusByEvent.get(event.id) ?? null;
        const canManage = await canManageEvent(user, event);
        return {
          ...event,
          mediaUrl,
          mediaType: media && typeof media !== "string" ? media.mediaType : null,
          confirmedCount,
          remainingCapacity,
          isRegistered: myRegistrationStatus === "confirmed",
          myRegistrationStatus,
          canManage,
        };
      }),
    );
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
    if (user.role === "alumni" ? !isCommunityVerifiedAlumni(user) : user.verificationStatus !== "verified") {
      return res.status(403).json({ error: user.role === "alumni" ? "Community verification is required to publish events." : "Verified accounts can publish events." });
    }
    const { title, description, date, location, mediaKey, maxCapacity, registrationDeadline, authorizedOrganizers } = req.body ?? {};
    if (
      typeof title !== "string" || !title.trim() || title.length > 160 ||
      typeof description !== "string" || !description.trim() || description.length > 4000 ||
      typeof date !== "string" || Number.isNaN(new Date(date).getTime())
    ) {
      return res.status(400).json({ error: "A valid title, description and date are required" });
    }

    let parsedCapacity: number | null = null;
    if (maxCapacity !== undefined && maxCapacity !== null && maxCapacity !== "") {
      const n = Number(maxCapacity);
      if (!Number.isInteger(n) || n < 1 || n > 100000) {
        return res.status(400).json({ error: "Maximum capacity must be a positive whole number." });
      }
      parsedCapacity = n;
    }

    let parsedDeadline: Date | null = null;
    if (registrationDeadline !== undefined && registrationDeadline !== null && registrationDeadline !== "") {
      const d = new Date(registrationDeadline);
      if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Choose a valid registration deadline." });
      parsedDeadline = d;
    }

    const parsedOrganizers = Array.isArray(authorizedOrganizers)
      ? [...new Set(authorizedOrganizers.filter((id): id is string => isUuid(id) && id !== user.id))].slice(0, 20)
      : [];

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
      maxCapacity: parsedCapacity,
      registrationDeadline: parsedDeadline,
      authorizedOrganizers: parsedOrganizers,
      status: "active",
    }).returning();
    res.json({
      ...event,
      mediaUrl: media ? await signMemoryMedia(media, user.id) : null,
      mediaType: media?.mediaType ?? null,
      confirmedCount: 0,
      remainingCapacity: parsedCapacity,
      isRegistered: false,
      myRegistrationStatus: null,
      canManage: true,
    });
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
    if (!isUuid(eventId)) return res.status(400).json({ error: "Invalid event ID" });
    const [existing] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!existing) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEvent(user, existing))) return res.status(403).json({ error: "Only the event organizer can edit this event." });

    const { title, description, date, location, mediaKey, maxCapacity, registrationDeadline, authorizedOrganizers, status } = req.body ?? {};
    if (
      typeof title !== "string" || !title.trim() || title.length > 160 ||
      typeof description !== "string" || !description.trim() || description.length > 4000 ||
      typeof date !== "string" || Number.isNaN(new Date(date).getTime()) ||
      (location !== undefined && location !== null && typeof location !== "string")
    ) {
      return res.status(400).json({ error: "A valid title, description and date are required" });
    }

    let parsedCapacity: number | null | undefined = undefined;
    if (maxCapacity !== undefined) {
      if (maxCapacity === null || maxCapacity === "") parsedCapacity = null;
      else {
        const n = Number(maxCapacity);
        if (!Number.isInteger(n) || n < 1 || n > 100000) {
          return res.status(400).json({ error: "Maximum capacity must be a positive whole number." });
        }
        parsedCapacity = n;
      }
    }

    let parsedDeadline: Date | null | undefined = undefined;
    if (registrationDeadline !== undefined) {
      if (registrationDeadline === null || registrationDeadline === "") parsedDeadline = null;
      else {
        const d = new Date(registrationDeadline);
        if (Number.isNaN(d.getTime())) return res.status(400).json({ error: "Choose a valid registration deadline." });
        parsedDeadline = d;
      }
    }

    let nextStatus: string | undefined = undefined;
    if (status !== undefined) {
      if (!["active", "cancelled"].includes(status)) return res.status(400).json({ error: "Invalid event status." });
      nextStatus = status;
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
      ...(parsedCapacity !== undefined ? { maxCapacity: parsedCapacity } : {}),
      ...(parsedDeadline !== undefined ? { registrationDeadline: parsedDeadline } : {}),
      ...(Array.isArray(authorizedOrganizers)
        ? { authorizedOrganizers: [...new Set(authorizedOrganizers.filter((id): id is string => isUuid(id) && id !== existing.organizerId))].slice(0, 20) }
        : {}),
      ...(nextStatus !== undefined ? { status: nextStatus } : {}),
    }).where(eq(eventsTable.id, eventId)).returning();

    // Notify confirmed participants if key event details changed or event was cancelled
    const detailsChanged =
      existing.title !== updated.title ||
      existing.date !== updated.date ||
      existing.location !== updated.location ||
      (existing.status !== "cancelled" && updated.status === "cancelled");
    if (detailsChanged) {
      const confirmedRegs = await db
        .select({ userId: eventRegistrationsTable.userId })
        .from(eventRegistrationsTable)
        .where(and(eq(eventRegistrationsTable.eventId, eventId), eq(eventRegistrationsTable.status, "confirmed")));
      const msg = updated.status === "cancelled"
        ? `Event cancelled: ${updated.title}. Please check Events for details.`
        : `Event updated: ${updated.title} on ${new Date(updated.date).toLocaleDateString("en-IN")}${updated.location ? ` at ${updated.location}` : ""}.`;
      await Promise.all(
        confirmedRegs.map((reg) => createSocialNotification(reg.userId, user.id, "event_update", eventId, msg).catch(() => {})),
      );
    }

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
    if (!isUuid(eventId)) return res.status(400).json({ error: "Invalid event ID" });
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

// ─── Organizer Registrations Dashboard ─────────────────────────────────────────
router.get("/events/:id/registrations", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const eventId = req.params.id as string;
    if (!isUuid(eventId)) return res.status(400).json({ error: "Invalid event ID" });
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEvent(user, event))) {
      return res.status(403).json({ error: "Only authorized event organizers can view attendee registrations." });
    }

    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const roleFilter = typeof req.query.role === "string" && ["student", "alumni", "teacher", "official"].includes(req.query.role)
      ? req.query.role
      : "";
    const jnvFilter = typeof req.query.jnvName === "string" ? req.query.jnvName.trim().slice(0, 120) : "";
    const batchFilter = typeof req.query.batch === "string" ? req.query.batch.trim().slice(0, 40) : "";
    const statusFilter = typeof req.query.status === "string" && ["confirmed", "cancelled"].includes(req.query.status)
      ? req.query.status
      : "";
    const attendanceFilter = typeof req.query.attendanceStatus === "string" && ["checked_in", "not_checked_in"].includes(req.query.attendanceStatus)
      ? req.query.attendanceStatus
      : "";
    const sortParam = typeof req.query.sort === "string" ? req.query.sort : "newest";
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 50, 200));
    const offset = (page - 1) * limit;

    // Summary stats across the entire event (unfiltered)
    const allEventRegs = await db
      .select({
        status: eventRegistrationsTable.status,
        attendanceStatus: eventRegistrationsTable.attendanceStatus,
        createdAt: eventRegistrationsTable.createdAt,
      })
      .from(eventRegistrationsTable)
      .where(eq(eventRegistrationsTable.eventId, eventId));

    let confirmed = 0;
    let checkedIn = 0;
    let cancelled = 0;
    const activityMap = new Map<string, number>();
    for (const r of allEventRegs) {
      if (r.status === "confirmed") confirmed++;
      else if (r.status === "cancelled") cancelled++;
      if (r.status === "confirmed" && r.attendanceStatus === "checked_in") checkedIn++;
      if (r.createdAt) {
        const day = r.createdAt.toISOString().slice(0, 10);
        activityMap.set(day, (activityMap.get(day) ?? 0) + 1);
      }
    }
    const activityByDay = [...activityMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-14)
      .map(([date, countValue]) => ({ date, count: countValue }));

    const filters: SQL[] = [eq(eventRegistrationsTable.eventId, eventId)];
    if (roleFilter) filters.push(eq(eventRegistrationsTable.role, roleFilter));
    if (jnvFilter) filters.push(ilike(eventRegistrationsTable.jnvName, `%${jnvFilter.replace(/[%_]/g, "\\$&")}%`));
    if (batchFilter) filters.push(ilike(eventRegistrationsTable.passoutBatch, `%${batchFilter.replace(/[%_]/g, "\\$&")}%`));
    if (statusFilter) filters.push(eq(eventRegistrationsTable.status, statusFilter));
    if (attendanceFilter) filters.push(eq(eventRegistrationsTable.attendanceStatus, attendanceFilter));
    if (typeof req.query.dateFrom === "string" && !Number.isNaN(new Date(req.query.dateFrom).getTime())) {
      filters.push(gte(eventRegistrationsTable.createdAt, new Date(req.query.dateFrom)));
    }
    if (typeof req.query.dateTo === "string" && !Number.isNaN(new Date(req.query.dateTo).getTime())) {
      filters.push(lte(eventRegistrationsTable.createdAt, new Date(req.query.dateTo)));
    }
    if (search) {
      const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;
      filters.push(or(
        ilike(eventRegistrationsTable.fullName, pattern),
        ilike(eventRegistrationsTable.jnvName, pattern),
        ilike(eventRegistrationsTable.passoutBatch, pattern),
        ilike(eventRegistrationsTable.role, pattern),
        ilike(usersTable.jnvId, pattern),
      ) as SQL);
    }

    const orderClause =
      sortParam === "oldest"
        ? asc(eventRegistrationsTable.createdAt)
        : sortParam === "name_asc"
          ? asc(eventRegistrationsTable.fullName)
          : sortParam === "name_desc"
            ? desc(eventRegistrationsTable.fullName)
            : desc(eventRegistrationsTable.createdAt);

    const [{ totalMatching }] = await db
      .select({ totalMatching: count() })
      .from(eventRegistrationsTable)
      .leftJoin(usersTable, eq(eventRegistrationsTable.userId, usersTable.id))
      .where(and(...filters));

    const rows = await db
      .select({
        reg: eventRegistrationsTable,
        photoUrl: usersTable.photoURL,
        jnvId: usersTable.jnvId,
        profileVisibility: usersTable.profileVisibility,
      })
      .from(eventRegistrationsTable)
      .leftJoin(usersTable, eq(eventRegistrationsTable.userId, usersTable.id))
      .where(and(...filters))
      .orderBy(orderClause)
      .limit(limit)
      .offset(offset);

    const items = rows.map(({ reg, photoUrl, jnvId, profileVisibility }) => ({
      id: reg.id,
      eventId: reg.eventId,
      userId: reg.userId,
      fullName: reg.fullName,
      role: reg.role,
      jnvName: reg.jnvName,
      jnvState: reg.jnvState,
      jnvId: jnvId ?? null,
      photoUrl: photoUrl ?? null,
      canOpenProfile: profileVisibility !== "private",
      passoutBatch: reg.passoutBatch,
      house: reg.house,
      class: reg.class,
      designation: reg.designation,
      subject: reg.subject,
      contribution: reg.contribution,
      feedback: reg.feedback,
      dietaryPreference: reg.dietaryPreference,
      attendingInPerson: reg.attendingInPerson,
      customAnswers: reg.customAnswers ?? {},
      status: reg.status,
      attendanceStatus: reg.attendanceStatus,
      checkedInAt: reg.checkedInAt?.toISOString() ?? null,
      cancelledAt: reg.cancelledAt?.toISOString() ?? null,
      createdAt: reg.createdAt?.toISOString() ?? null,
    }));

    return res.json({
      event: {
        id: event.id,
        title: event.title,
        date: event.date,
        location: event.location,
        maxCapacity: event.maxCapacity,
        registrationDeadline: event.registrationDeadline?.toISOString() ?? null,
        status: event.status,
      },
      summary: {
        total: allEventRegs.length,
        confirmed,
        checkedIn,
        cancelled,
        remainingCapacity: event.maxCapacity != null ? Math.max(0, event.maxCapacity - confirmed) : null,
        maxCapacity: event.maxCapacity,
        activityByDay,
      },
      items,
      pagination: {
        page,
        limit,
        totalMatching: Number(totalMatching),
        hasMore: offset + items.length < Number(totalMatching),
      },
    });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch registrations" });
  }
});

// ─── Export Registrations CSV ─────────────────────────────────────────────────
router.get("/events/:id/registrations/export", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const eventId = req.params.id as string;
    if (!isUuid(eventId)) return res.status(400).json({ error: "Invalid event ID" });
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEvent(user, event))) {
      return res.status(403).json({ error: "Only authorized event organizers can export attendee lists." });
    }

    const regs = await db
      .select()
      .from(eventRegistrationsTable)
      .where(eq(eventRegistrationsTable.eventId, eventId))
      .orderBy(desc(eventRegistrationsTable.createdAt));

    req.log.info({ eventId, exporterId: user.id, rowCount: regs.length }, "Event attendee list exported");

    const header = [
      "Participant Name",
      "Role",
      "JNV",
      "Batch",
      "Registration Date",
      "Registration Status",
      "Attendance Status",
      "Checked In At",
      "Attending In Person",
      "Event Answers",
    ];
    const lines = [header.map(csvEscape).join(",")];
    for (const r of regs) {
      const answerParts: string[] = [];
      if (r.dietaryPreference && r.dietaryPreference !== "No Preference") answerParts.push(`Dietary: ${r.dietaryPreference}`);
      if (r.contribution) answerParts.push(`Profession/Contribution: ${r.contribution}`);
      if (r.customAnswers && typeof r.customAnswers === "object") {
        for (const [k, v] of Object.entries(r.customAnswers)) answerParts.push(`${k}: ${v}`);
      }
      lines.push(
        [
          r.fullName,
          r.role,
          r.jnvName ?? "",
          r.passoutBatch ?? "",
          r.createdAt ? r.createdAt.toISOString() : "",
          r.status,
          r.attendanceStatus,
          r.checkedInAt ? r.checkedInAt.toISOString() : "",
          r.attendingInPerson ? "Yes" : "No",
          answerParts.join(" | "),
        ]
          .map(csvEscape)
          .join(","),
      );
    }

    const safeFileName = (event.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "event";
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${safeFileName}-registrations.csv"`);
    return res.send(lines.join("\r\n"));
  } catch (e: any) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to export registrations" });
  }
});

// ─── Check-In Management ──────────────────────────────────────────────────────
router.patch("/events/:id/registrations/:registrationId/check-in", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const eventId = req.params.id as string;
    const registrationId = req.params.registrationId as string;
    if (!isUuid(eventId) || !isUuid(registrationId)) return res.status(400).json({ error: "Invalid ID" });

    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (!(await canManageEvent(user, event))) {
      return res.status(403).json({ error: "Only authorized event organizers can manage check-in." });
    }

    const [reg] = await db
      .select()
      .from(eventRegistrationsTable)
      .where(and(eq(eventRegistrationsTable.id, registrationId), eq(eventRegistrationsTable.eventId, eventId)))
      .limit(1);
    if (!reg) return res.status(404).json({ error: "Registration not found" });
    if (reg.status !== "confirmed") {
      return res.status(409).json({ error: "Cancelled registrations cannot be checked in." });
    }

    const desired = req.body?.checkedIn === false ? "not_checked_in" : "checked_in";
    const now = new Date();
    const [updated] = await db
      .update(eventRegistrationsTable)
      .set({
        attendanceStatus: desired,
        checkedInAt: desired === "checked_in" ? now : null,
        checkedInBy: desired === "checked_in" ? user.id : null,
        updatedAt: now,
      })
      .where(eq(eventRegistrationsTable.id, registrationId))
      .returning();

    return res.json({
      id: updated.id,
      attendanceStatus: updated.attendanceStatus,
      checkedInAt: updated.checkedInAt?.toISOString() ?? null,
    });
  } catch (e: any) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to update attendance" });
  }
});

// ─── Register for Event (Auto-Confirmed, Transactional Capacity & Deduplication) ───
router.post("/events/:id/register", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const {
      contactNo,
      contribution,
      feedback,
      dietaryPreference,
      attendingInPerson,
      customAnswers,
      jnvName,
      jnvState,
      passoutBatch,
      house,
      class: studentClass,
      designation,
      subject,
    } = req.body ?? {};
    const eventId = req.params.id as string;
    if (!isUuid(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    const outcome = await db.transaction(async (tx) => {
      // Lock the event row to safely serialize concurrent capacity checks
      await tx.execute(sql`SELECT id FROM events WHERE id = ${eventId} FOR UPDATE`);
      const [event] = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId)).limit(1);
      if (!event) return { status: 404 as const, error: "Event not found" };
      if (event.status === "cancelled") {
        return { status: 409 as const, error: "This event has been cancelled." };
      }
      if (event.registrationDeadline && new Date() > event.registrationDeadline) {
        return { status: 400 as const, error: "The registration deadline for this event has passed." };
      }

      const [existing] = await tx
        .select()
        .from(eventRegistrationsTable)
        .where(and(eq(eventRegistrationsTable.eventId, eventId), eq(eventRegistrationsTable.userId, user.id)))
        .limit(1);

      if (existing && existing.status === "confirmed") {
        return { status: 409 as const, error: "You are already registered" };
      }

      if (event.maxCapacity != null) {
        const [{ confirmedCount }] = await tx
          .select({ confirmedCount: count() })
          .from(eventRegistrationsTable)
          .where(and(eq(eventRegistrationsTable.eventId, eventId), eq(eventRegistrationsTable.status, "confirmed")));
        if (Number(confirmedCount) >= event.maxCapacity) {
          return { status: 409 as const, error: "This event has reached its maximum capacity." };
        }
      }

      const now = new Date();
      const payload = {
        role: user.role,
        fullName: user.fullName,
        jnvName: typeof jnvName === "string" && jnvName.trim() ? jnvName.trim().slice(0, 120) : user.jnvName,
        jnvState: typeof jnvState === "string" && jnvState.trim() ? jnvState.trim().slice(0, 80) : user.jnvState,
        contactNo: typeof contactNo === "string" ? contactNo.trim().slice(0, 40) : null,
        passoutBatch: typeof passoutBatch === "string" && passoutBatch.trim() ? passoutBatch.trim().slice(0, 40) : user.passoutYear,
        house: typeof house === "string" && house.trim() ? house.trim().slice(0, 40) : user.house,
        class: typeof studentClass === "string" && studentClass.trim() ? studentClass.trim().slice(0, 20) : user.class,
        designation: typeof designation === "string" && designation.trim() ? designation.trim().slice(0, 80) : user.designation,
        subject: typeof subject === "string" && subject.trim() ? subject.trim().slice(0, 80) : user.subject,
        contribution: typeof contribution === "string" ? contribution.trim().slice(0, 500) : null,
        feedback: typeof feedback === "string" ? feedback.trim().slice(0, 1000) : null,
        dietaryPreference: typeof dietaryPreference === "string" ? dietaryPreference.trim().slice(0, 60) : null,
        attendingInPerson: attendingInPerson !== false,
        customAnswers: sanitizeCustomAnswers(customAnswers),
        status: "confirmed",
        attendanceStatus: "not_checked_in",
        checkedInAt: null,
        checkedInBy: null,
        cancelledAt: null,
        updatedAt: now,
      };

      const [reg] = existing
        ? await tx
            .update(eventRegistrationsTable)
            .set(payload)
            .where(eq(eventRegistrationsTable.id, existing.id))
            .returning()
        : await tx
            .insert(eventRegistrationsTable)
            .values({
              eventId,
              userId: user.id,
              ...payload,
            })
            .returning();

      return { status: 200 as const, reg, event };
    });

    if ("error" in outcome) {
      return res.status(outcome.status).json({ error: outcome.error });
    }

    // Send confirmation notification (deduplicated)
    const eventDateLabel = new Date(outcome.event.date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const confirmMsg = `Your registration for ${outcome.event.title} has been confirmed (${eventDateLabel}${outcome.event.location ? ` · ${outcome.event.location}` : ""}).`;
    const [existingNotif] = await db
      .select({ id: socialNotificationsTable.id })
      .from(socialNotificationsTable)
      .where(
        and(
          eq(socialNotificationsTable.recipientId, user.id),
          eq(socialNotificationsTable.type, "event_registration_confirmed"),
          eq(socialNotificationsTable.entityId, eventId),
        ),
      )
      .limit(1);
    if (!existingNotif) {
      await db.insert(socialNotificationsTable).values({
        recipientId: user.id,
        actorId: outcome.event.organizerId ?? user.id,
        type: "event_registration_confirmed",
        entityId: eventId,
        message: confirmMsg,
      }).catch(() => {});
    }

    return res.json(outcome.reg);
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "You are already registered" });
    }
    req.log.error(e);
    return res.status(500).json({ error: "Failed to register" });
  }
});

// ─── Cancel Own Registration ──────────────────────────────────────────────────
router.delete("/events/:id/register", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const eventId = req.params.id as string;
    if (!isUuid(eventId)) return res.status(400).json({ error: "Invalid event ID" });

    const [existing] = await db
      .select()
      .from(eventRegistrationsTable)
      .where(and(eq(eventRegistrationsTable.eventId, eventId), eq(eventRegistrationsTable.userId, user.id)))
      .limit(1);
    if (!existing || existing.status === "cancelled") {
      return res.status(404).json({ error: "Active registration not found." });
    }

    const now = new Date();
    await db
      .update(eventRegistrationsTable)
      .set({
        status: "cancelled",
        cancelledAt: now,
        updatedAt: now,
      })
      .where(eq(eventRegistrationsTable.id, existing.id));

    return res.json({ cancelled: true, status: "cancelled" });
  } catch (e: any) {
    req.log.error(e);
    return res.status(500).json({ error: "Failed to cancel registration" });
  }
});

export default router;
