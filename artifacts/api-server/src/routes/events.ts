import { Router } from "express";
import { desc } from "drizzle-orm";
import { db, eventsTable } from "@workspace/db";
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
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only teachers and officials can create events" });
    }
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

export default router;
