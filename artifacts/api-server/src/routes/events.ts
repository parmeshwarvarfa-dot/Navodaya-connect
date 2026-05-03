import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, eventsTable, eventRegistrationsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/events", requireAuth, async (req, res) => {
  try {
    const events = await db.select().from(eventsTable).orderBy(desc(eventsTable.createdAt));
    res.json(events);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch events" });
  }
});

router.post("/events", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { title, description, date, location } = req.body;
    if (!title || !description || !date) return res.status(400).json({ error: "title, description and date required" });
    const [event] = await db.insert(eventsTable).values({
      title,
      description,
      date,
      location,
      organizer: user.fullName,
      organizerId: user.id,
      jnvName: user.jnvName,
    }).returning();
    res.json(event);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to create event" });
  }
});

router.get("/events/:id/registrations", requireAuth, async (req, res) => {
  try {
    const regs = await db
      .select()
      .from(eventRegistrationsTable)
      .where(eq(eventRegistrationsTable.eventId, req.params.id))
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
      fullName, jnvName, jnvState, contactNo, passoutBatch,
      house, class: cls, designation, subject, contribution,
      feedback, dietaryPreference,
    } = req.body;
    if (!fullName) return res.status(400).json({ error: "fullName required" });
    const [reg] = await db.insert(eventRegistrationsTable).values({
      eventId: req.params.id,
      userId: user.id,
      role: user.role,
      fullName,
      jnvName: jnvName || user.jnvName,
      jnvState: jnvState || user.jnvState,
      contactNo,
      passoutBatch,
      house,
      class: cls,
      designation,
      subject,
      contribution,
      feedback,
      dietaryPreference,
    }).returning();
    res.json(reg);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to register" });
  }
});

export default router;
