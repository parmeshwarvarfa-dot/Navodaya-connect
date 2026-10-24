import { Router } from "express";
import { db, clubsTable, clubAnnouncementsTable, clubMembersTable, clubJoinRequestsTable, groupMembersTable, groupsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc, eq, and, inArray } from "drizzle-orm";
import { sql } from "drizzle-orm";

const router = Router();

async function syncClubChatGroup(clubId: string) {
  const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
  if (!club) return null;
  await db.insert(groupsTable).values({
    name: club.name,
    subject: "Club chat",
    jnvName: club.jnvName,
    jnvState: null,
    teacherName: club.managerName,
    teacherId: club.managerId,
    clubId: club.id,
    memberCount: club.members,
  }).onConflictDoNothing({ target: groupsTable.clubId });
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.clubId, club.id)).limit(1);
  if (!group) return null;
  const members = await db.select().from(clubMembersTable).where(eq(clubMembersTable.clubId, club.id));
  if (members.length) {
    await db.insert(groupMembersTable).values(members.map((member) => ({
      groupId: group.id,
      userId: member.userId,
      role: member.role === "manager" ? "admin" : "member",
    }))).onConflictDoNothing();
  }
  return group;
}

router.get("/clubs", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db.select().from(clubsTable)
      .orderBy(desc(clubsTable.createdAt));
    const memberships = await db.select().from(clubMembersTable)
      .where(eq(clubMembersTable.userId, user.id));
    const memberSet = new Set(memberships.map((m) => m.clubId));
    const requests = await db.select().from(clubJoinRequestsTable)
      .where(eq(clubJoinRequestsTable.studentId, user.id));
    const requestStatus = new Map(requests.map((request) => [request.clubId, request.status]));
    const anns = await db.select().from(clubAnnouncementsTable)
      .orderBy(desc(clubAnnouncementsTable.createdAt));
    res.json(rows.map((c) => ({
      ...c,
      managed: c.managerId === user.id,
      joined: memberSet.has(c.id),
      joinStatus: memberSet.has(c.id) ? "approved" : requestStatus.get(c.id) ?? "none",
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
    await syncClubChatGroup(row.id);
    res.json({ ...row, managed: true, joined: true, announcements: [] });
  } catch (e) {
    res.status(500).json({ error: "Failed to create club" });
  }
});

router.get("/clubs/requests", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") return res.status(403).json({ error: "Teacher access required" });
    const managedClubs = user.role === "official"
      ? await db.select({ id: clubsTable.id, name: clubsTable.name }).from(clubsTable)
      : await db.select({ id: clubsTable.id, name: clubsTable.name }).from(clubsTable).where(eq(clubsTable.managerId, user.id));
    const clubIds = managedClubs.map((club) => club.id);
    if (!clubIds.length) return res.json([]);
    const pending = await db.select().from(clubJoinRequestsTable)
      .where(and(inArray(clubJoinRequestsTable.clubId, clubIds), eq(clubJoinRequestsTable.status, "pending")))
      .orderBy(desc(clubJoinRequestsTable.createdAt));
    const studentIds = [...new Set(pending.map((request) => request.studentId))];
    const students = studentIds.length ? await db.select({ id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role, class: usersTable.class, jnvName: usersTable.jnvName })
      .from(usersTable).where(inArray(usersTable.id, studentIds)) : [];
    const studentById = new Map(students.map((student) => [student.id, student]));
    const clubById = new Map(managedClubs.map((club) => [club.id, club]));
    res.json(pending.map((request) => ({ ...request, student: studentById.get(request.studentId), club: clubById.get(request.clubId) })));
  } catch (e) {
    req.log.error(e, "club join requests error");
    res.status(500).json({ error: "Failed to fetch club requests" });
  }
});

router.post("/clubs/:id/chat", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const clubId = req.params.id as string;
    const [membership] = await db.select({ id: clubMembersTable.id }).from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.userId, user.id))).limit(1);
    if (!membership) return res.status(403).json({ error: "Join the club before opening its chat" });
    const group = await syncClubChatGroup(clubId);
    if (!group) return res.status(404).json({ error: "Club not found" });
    res.json({ id: group.id, name: group.name });
  } catch (error) {
    req.log.error(error, "club chat open error");
    res.status(500).json({ error: "Could not open club chat" });
  }
});

router.post("/clubs/:id/join", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const clubId = req.params.id as string;
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (user.role !== "student") {
      const [existingMember] = await db.select({ id: clubMembersTable.id }).from(clubMembersTable)
        .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.userId, user.id))).limit(1);
      if (existingMember) {
        await db.delete(clubMembersTable).where(eq(clubMembersTable.id, existingMember.id));
        const [clubGroup] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.clubId, clubId)).limit(1);
        if (clubGroup) await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, clubGroup.id), eq(groupMembersTable.userId, user.id)));
        await db.update(clubsTable).set({ members: sql`greatest(0, ${clubsTable.members} - 1)` }).where(eq(clubsTable.id, clubId));
        return res.json({ joined: false, joinStatus: "none" });
      }
      await db.insert(clubMembersTable).values({ clubId, userId: user.id, role: "member" });
      await db.update(clubsTable).set({ members: sql`${clubsTable.members} + 1` }).where(eq(clubsTable.id, clubId));
      await syncClubChatGroup(clubId);
      return res.json({ joined: true, joinStatus: "approved" });
    }
    const [member] = await db.select({ id: clubMembersTable.id }).from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.userId, user.id))).limit(1);
    if (member) return res.json({ joined: true, joinStatus: "approved" });
    const [existing] = await db.select().from(clubJoinRequestsTable)
      .where(and(eq(clubJoinRequestsTable.clubId, clubId), eq(clubJoinRequestsTable.studentId, user.id))).limit(1);
    if (existing?.status === "pending") return res.json({ joined: false, joinStatus: "pending" });
    if (existing) {
      await db.update(clubJoinRequestsTable).set({ status: "pending", createdAt: new Date(), reviewedAt: null, reviewedById: null })
        .where(eq(clubJoinRequestsTable.id, existing.id));
    } else {
      await db.insert(clubJoinRequestsTable).values({ clubId, studentId: user.id, status: "pending" });
    }
    res.json({ joined: false, joinStatus: "pending" });
  } catch (e) {
    req.log.error(e, "club join request error");
    res.status(500).json({ error: "Failed to send club request" });
  }
});

router.post("/clubs/:id/leave", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const clubId = req.params.id as string;
    const [member] = await db.select({ id: clubMembersTable.id }).from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.userId, user.id))).limit(1);
    if (!member) return res.json({ joined: false });
    await db.delete(clubMembersTable).where(eq(clubMembersTable.id, member.id));
    const [clubGroup] = await db.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.clubId, clubId)).limit(1);
    if (clubGroup) await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, clubGroup.id), eq(groupMembersTable.userId, user.id)));
    await db.update(clubsTable).set({ members: sql`greatest(0, ${clubsTable.members} - 1)` }).where(eq(clubsTable.id, clubId));
    res.json({ joined: false, joinStatus: "none" });
  } catch (e) {
    req.log.error(e, "club leave error");
    res.status(500).json({ error: "Failed to leave club" });
  }
});

router.patch("/clubs/:clubId/requests/:requestId", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "teacher" && user.role !== "official") return res.status(403).json({ error: "Teacher access required" });
    const clubId = req.params.clubId as string;
    const requestId = req.params.requestId as string;
    const decision = req.body?.decision;
    if (decision !== "approved" && decision !== "denied") return res.status(400).json({ error: "Choose approve or deny" });
    const [club] = await db.select().from(clubsTable).where(eq(clubsTable.id, clubId)).limit(1);
    if (!club) return res.status(404).json({ error: "Club not found" });
    if (club.managerId !== user.id && user.role !== "official") return res.status(403).json({ error: "Only the club's managing teacher can review requests" });
    const [request] = await db.select().from(clubJoinRequestsTable)
      .where(and(eq(clubJoinRequestsTable.id, requestId), eq(clubJoinRequestsTable.clubId, clubId), eq(clubJoinRequestsTable.status, "pending"))).limit(1);
    if (!request) return res.status(404).json({ error: "Pending request not found" });
    if (decision === "approved") {
      const [member] = await db.select({ id: clubMembersTable.id }).from(clubMembersTable)
        .where(and(eq(clubMembersTable.clubId, clubId), eq(clubMembersTable.userId, request.studentId))).limit(1);
      if (!member) {
        await db.insert(clubMembersTable).values({ clubId, userId: request.studentId, role: "member" });
        await db.update(clubsTable).set({ members: sql`${clubsTable.members} + 1` }).where(eq(clubsTable.id, clubId));
      }
      await syncClubChatGroup(clubId);
    }
    await db.update(clubJoinRequestsTable).set({ status: decision, reviewedAt: new Date(), reviewedById: user.id })
      .where(eq(clubJoinRequestsTable.id, requestId));
    res.json({ requestId, clubId, status: decision, studentId: request.studentId });
  } catch (e) {
    req.log.error(e, "club request review error");
    res.status(500).json({ error: "Failed to review club request" });
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
