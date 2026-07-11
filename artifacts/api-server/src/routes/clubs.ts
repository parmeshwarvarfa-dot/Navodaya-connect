import { Router } from "express";
import { db, clubsTable, clubAnnouncementsTable, clubMembersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq, and } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

router.get("/clubs", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db.select().from(clubsTable)
      .orderBy(desc(clubsTable.createdAt));
    const memberships = await db.select().from(clubMembersTable)
      .where(eq(clubMembersTable.userId, user.id));
    const memberSet = new Set(memberships.map((m) => m.clubId));
    const anns = await db.select().from(clubAnnouncementsTable)
      .orderBy(desc(clubAnnouncementsTable.createdAt));
    res.json(rows.map((c) => ({
      ...c,
      managed: c.managerId === user.id,
      joined: memberSet.has(c.id),
      announcements: anns.filter((a) => a.clubId === c.id).slice(0, 3),
    })));
  } catch (e) {
    req.log.error(e, "clubs error");
    res.status(500).json({ error: "Failed to fetch clubs" });
  }
});

router.post("/clubs", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only teachers can create clubs" });
    }
    const { name, description, icon, color, bg } = req.body;
    if (!name?.trim() || !description?.trim()) {
      return res.status(400).json({ error: "Name and description required" });
    }
    const [row] = await db.insert(clubsTable).values({
      name: name.trim(),
      description: description.trim(),
      icon: icon || "star-outline",
      color: color || "#EC4899",
      bg: bg || "#FDF2F8",
      managerId: user.id,
      managerName: user.fullName,
      jnvName: user.jnvName,
      members: 1,
    }).returning();
    await db.insert(clubMembersTable).values({ clubId: row.id, userId: user.id, role: "manager" });
    res.json({ ...row, managed: true, joined: true, announcements: [] });
  } catch (e) {
    res.status(500).json({ error: "Failed to create club" });
  }
});

router.post("/clubs/:id/join", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const existing = await db.select().from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, req.params.id as string), eq(clubMembersTable.userId, user.id)));
    const club = await db.select().from(clubsTable).where(eq(clubsTable.id, req.params.id as string));
    if (!club.length) return res.status(404).json({ error: "Club not found" });
    if (existing.length > 0) {
      await db.delete(clubMembersTable).where(eq(clubMembersTable.id, existing[0].id));
      await db.update(clubsTable).set({ members: Math.max(0, club[0].members - 1) }).where(eq(clubsTable.id, req.params.id as string));
      res.json({ joined: false });
    } else {
      await db.insert(clubMembersTable).values({ clubId: req.params.id as string, userId: user.id });
      await db.update(clubsTable).set({ members: club[0].members + 1 }).where(eq(clubsTable.id, req.params.id as string));
      res.json({ joined: true });
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to toggle membership" });
  }
});

router.post("/clubs/:id/announcements", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const club = await db.select().from(clubsTable).where(eq(clubsTable.id, req.params.id as string));
    if (!club.length) return res.status(404).json({ error: "Club not found" });
    if (club[0].managerId !== user.id && user.role !== "official") {
      return res.status(403).json({ error: "Only club manager can post announcements" });
    }
    const { text } = req.body;
    if (!text?.trim()) return res.status(400).json({ error: "Text required" });
    const [row] = await db.insert(clubAnnouncementsTable).values({
      clubId: req.params.id as string,
      text: text.trim(),
      authorId: user.id,
      authorName: user.fullName,
    }).returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to post announcement" });
  }
});

router.patch("/clubs/:id/manager", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Forbidden" });
    }
    const [row] = await db.update(clubsTable)
      .set({ managerId: user.id, managerName: user.fullName })
      .where(eq(clubsTable.id, req.params.id as string))
      .returning();
    const existing = await db.select().from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, req.params.id as string), eq(clubMembersTable.userId, user.id)));
    if (!existing.length) {
      await db.insert(clubMembersTable).values({ clubId: req.params.id as string, userId: user.id, role: "manager" });
    }
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to take over management" });
  }
});

export default router;
