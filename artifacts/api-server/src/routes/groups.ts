import { Router } from "express";
import { and, desc, eq, inArray, isNull, lt, ne, or } from "drizzle-orm";
import { db, groupsTable, groupMembersTable, groupMessagesTable, clubMembersTable, usersTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

// In-memory typing indicator store  { groupId -> { userId -> { name, expiresAt } } }
const typingStore: Map<string, Map<string, { name: string; expiresAt: number }>> = new Map();

function cleanTyping(groupId: string) {
  const group = typingStore.get(groupId);
  if (!group) return;
  const now = Date.now();
  for (const [uid, data] of group) {
    if (data.expiresAt < now) group.delete(uid);
  }
}

async function canAccessGroup(groupId: string, userId: string) {
  const [group] = await db.select({ id: groupsTable.id, subject: groupsTable.subject, clubId: groupsTable.clubId }).from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) return false;
  if (group.clubId) {
    const [membership] = await db.select({ id: clubMembersTable.id }).from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, group.clubId), eq(clubMembersTable.userId, userId))).limit(1);
    return !!membership;
  }
  if (group.subject !== "Private chat group") return true;
  const [membership] = await db.select({ userId: groupMembersTable.userId }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, userId))).limit(1);
  return !!membership;
}

router.get("/groups", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memberships = await db.select({ groupId: groupMembersTable.groupId }).from(groupMembersTable).where(eq(groupMembersTable.userId, user.id));
    const memberGroupIds = memberships.map((membership) => membership.groupId);
    const clubMemberships = await db.select({ clubId: clubMembersTable.clubId }).from(clubMembersTable).where(eq(clubMembersTable.userId, user.id));
    const clubIds = new Set(clubMemberships.map((membership) => membership.clubId));
    const communityConditions = user.jnvName
      ? and(or(eq(groupsTable.jnvName, user.jnvName), isNull(groupsTable.jnvName)), ne(groupsTable.subject, "Private chat group"))
      : and(isNull(groupsTable.jnvName), ne(groupsTable.subject, "Private chat group"));
    const groups = await db.select().from(groupsTable)
      .where(memberGroupIds.length ? or(communityConditions, inArray(groupsTable.id, memberGroupIds)) : communityConditions)
      .orderBy(desc(groupsTable.createdAt))
      .limit(100);
    const classLevel = (value?: string | null) => value?.match(/^(?:class\s*)?(\d+)/i)?.[1] ?? "";
    const roleVisibleGroups = groups.filter((group) => {
      if (group.clubId && !clubIds.has(group.clubId)) return false;
      if (group.name.trim().toLowerCase() === "jnv alumni network" && user.role !== "alumni") return false;
      if (group.subject === "Alumni batch" && user.role !== "alumni") return false;
      const namedClass = group.name.match(/^class\s+([0-9]+[a-z]?)/i)?.[1];
      const classScoped = group.subject === "Class community" || !!group.class || !!namedClass;
      if (classScoped && group.subject !== "Alumni batch") {
        const groupClass = group.class ?? namedClass;
        return user.role === "student" && !!user.class && !!classLevel(groupClass) && classLevel(groupClass) === classLevel(user.class);
      }
      return true;
    });
    const groupsWithLatestMessage = await Promise.all(roleVisibleGroups.map(async (group) => {
      const [lastMessage] = await db.select({
        text: groupMessagesTable.text,
        createdAt: groupMessagesTable.createdAt,
        deletedAt: groupMessagesTable.deletedAt,
        senderId: groupMessagesTable.senderId,
        senderName: groupMessagesTable.senderName,
      })
        .from(groupMessagesTable)
        .where(eq(groupMessagesTable.groupId, group.id))
        .orderBy(desc(groupMessagesTable.createdAt), desc(groupMessagesTable.id))
        .limit(1);
      return {
        ...group,
        lastMessage: lastMessage?.deletedAt ? "Message deleted" : lastMessage?.text ?? null,
        lastMessageAt: lastMessage?.createdAt ?? null,
        lastMessageSenderId: lastMessage?.senderId ?? null,
        lastMessageSenderName: lastMessage?.senderName ?? null,
      };
    }));
    res.json(groupsWithLatestMessage);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch groups" });
  }
});

router.post("/groups", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { name, memberIds } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Group name required" });
    }
    if (name.trim().length > 80) {
      return res.status(400).json({ error: "Group name must be under 80 characters" });
    }
    if (!Array.isArray(memberIds)) {
      const { subject, class: cls } = req.body ?? {};
      if (user.role !== "teacher" || typeof subject !== "string" || !subject.trim()) {
        return res.status(400).json({ error: "Select group members" });
      }
      if (subject.trim().length > 80 || (typeof cls === "string" && cls.length > 80)) {
        return res.status(400).json({ error: "Group name and subject must be under 80 characters" });
      }
      const [group] = await db.insert(groupsTable).values({
        name: name.trim(), subject: subject.trim(), class: typeof cls === "string" ? cls : null,
        jnvName: user.jnvName, jnvState: user.jnvState, teacherName: user.fullName,
        teacherId: user.id, memberCount: 1,
      }).returning();
      return res.json(group);
    }
    if (memberIds.length < 1 || memberIds.length > 99 || memberIds.some((id: unknown) => typeof id !== "string" || !UUID_RE.test(id))) {
      return res.status(400).json({ error: "Select between 1 and 99 group members" });
    }
    const selectedIds = [...new Set<string>([user.id, ...memberIds])];
    const selectedUsers = await db.select({ id: usersTable.id, jnvName: usersTable.jnvName }).from(usersTable).where(inArray(usersTable.id, selectedIds));
    if (selectedUsers.length !== selectedIds.length) return res.status(400).json({ error: "One or more selected members were not found" });
    const group = await db.transaction(async (tx) => {
      const [created] = await tx.insert(groupsTable).values({
        name: name.trim(), subject: "Private chat group", jnvName: null,
        jnvState: null, teacherName: user.fullName, teacherId: user.id,
        memberCount: selectedIds.length,
      }).returning();
      await tx.insert(groupMembersTable).values(selectedIds.map((userId) => ({
        groupId: created.id, userId, role: userId === user.id ? "admin" : "member",
      })));
      return created;
    });
    res.json(group);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to create group" });
  }
});

router.get("/groups/:id/members", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, req.params.id as string)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.subject === "Private chat group") {
      const members = await db.select({ id: usersTable.id, fullName: usersTable.fullName, role: groupMembersTable.role, photoURL: usersTable.photoURL })
        .from(groupMembersTable).innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
        .where(eq(groupMembersTable.groupId, group.id));
      if (!members.some((member) => member.id === user.id)) return res.status(403).json({ error: "You are not a member of this group" });
      return res.json(members);
    }
    const messages = await db.select({ id: groupMessagesTable.senderId, fullName: groupMessagesTable.senderName })
      .from(groupMessagesTable).where(eq(groupMessagesTable.groupId, group.id));
    const byId = new Map(messages.filter((member) => member.id).map((member) => [member.id!, member.fullName || "Member"]));
    byId.set(user.id, user.fullName);
    return res.json([...byId].map(([id, fullName]) => ({ id, fullName, role: id === group.teacherId ? "admin" : "member" })));
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to load group members" });
  }
});

router.post("/groups/:id/members", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    const [group] = await db.select({ id: groupsTable.id, subject: groupsTable.subject, teacherId: groupsTable.teacherId }).from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    const [adminMembership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
    const isAdmin = adminMembership?.role === "admin" || (group.subject !== "Private chat group" && group.teacherId === user.id);
    if (!isAdmin) return res.status(403).json({ error: "Only group admins can add members" });
    const ids = req.body?.memberIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 99 || ids.some((memberId: unknown) => typeof memberId !== "string" || !UUID_RE.test(memberId))) {
      return res.status(400).json({ error: "Select between 1 and 99 members" });
    }
    const uniqueIds = [...new Set<string>(ids)];
    const found = await db.select({ id: usersTable.id }).from(usersTable).where(inArray(usersTable.id, uniqueIds));
    if (found.length !== uniqueIds.length) return res.status(400).json({ error: "One or more selected members were not found" });
    const existing = await db.select({ userId: groupMembersTable.userId }).from(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
    const existingIds = new Set(existing.map((member) => member.userId));
    const newIds = uniqueIds.filter((memberId) => !existingIds.has(memberId));
    if (newIds.length) {
      await db.insert(groupMembersTable).values(newIds.map((userId) => ({ groupId, userId, role: "member" })));
      await db.update(groupsTable).set({ memberCount: existing.length + newIds.length }).where(eq(groupsTable.id, groupId));
    }
    const members = await db.select({ id: usersTable.id, fullName: usersTable.fullName, role: groupMembersTable.role, photoURL: usersTable.photoURL })
      .from(groupMembersTable).innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id)).where(eq(groupMembersTable.groupId, groupId));
    res.json(members);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to add group members" });
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const INTEREST_GROUPS: Record<string, string> = {
  "alumni-network": "JNV Alumni Network",
  "upsc-aspirants": "UPSC Aspirants",
  "tech-careers": "Tech Careers",
  "jee-neet": "JEE & NEET Prep",
  "arts-culture": "Arts & Culture",
};

router.post("/groups/ensure-community", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const kind = req.body?.kind as string;
    let name: string;
    let subject = "Community";
    let className: string | null = null;
    let jnvName: string | null = user.jnvName || null;

    if (kind === "house" && ["student", "alumni"].includes(user.role) && user.house) {
      name = `${user.house} House`;
      subject = "House community";
    } else if (kind === "class" && user.role === "student" && user.class) {
      className = user.class.replace(/^class\s+/i, "");
      name = `Class ${className}`;
      subject = "Class community";
    } else if (kind === "batch" && user.role === "alumni" && user.passoutYear) {
      className = user.passoutYear;
      name = `Batch ${user.passoutYear}`;
      subject = "Alumni batch";
    } else if (kind === "school" && user.jnvName) {
      name = user.jnvName;
      subject = "School community";
    } else if (kind === "all") {
      name = "All Navodayans";
      subject = "All Navodayans";
      jnvName = null;
    } else if (kind === "interest" && INTEREST_GROUPS[req.body?.interestId]) {
      if (req.body?.interestId === "alumni-network" && user.role !== "alumni") {
        return res.status(403).json({ error: "The alumni network is available to alumni accounts only" });
      }
      name = INTEREST_GROUPS[req.body.interestId];
      subject = "Interest community";
      jnvName = null;
    } else {
      return res.status(403).json({ error: "This community is not available for your profile" });
    }

    const conditions = [eq(groupsTable.name, name)];
    conditions.push(jnvName ? eq(groupsTable.jnvName, jnvName) : isNull(groupsTable.jnvName));
    conditions.push(className ? eq(groupsTable.class, className) : isNull(groupsTable.class));
    const [existing] = await db.select().from(groupsTable).where(and(...conditions)).limit(1);
    if (existing) return res.json(existing);

    const [group] = await db.insert(groupsTable).values({
      name,
      subject,
      class: className,
      jnvName,
      jnvState: jnvName ? user.jnvState : null,
      teacherName: user.fullName,
      teacherId: user.role === "teacher" ? user.id : null,
      memberCount: 1,
    }).returning();
    return res.json(group);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Could not open this community chat" });
  }
});

router.get("/groups/:id/messages", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.json([]);
  const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
  const beforeId = typeof req.query.beforeId === "string" ? req.query.beforeId : null;
  if (before && Number.isNaN(before.getTime())) return res.status(400).json({ error: "invalid message cursor" });
  if (beforeId && !UUID_RE.test(beforeId)) return res.status(400).json({ error: "invalid message cursor" });
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user.id)) return res.status(403).json({ error: "You are not a member of this group" });
    const latestMessages = await db.select().from(groupMessagesTable)
      .where(before
        ? and(
            eq(groupMessagesTable.groupId, req.params.id as string),
            beforeId
              ? or(
                  lt(groupMessagesTable.createdAt, before),
                  and(eq(groupMessagesTable.createdAt, before), lt(groupMessagesTable.id, beforeId)),
                )
              : lt(groupMessagesTable.createdAt, before),
          )
        : eq(groupMessagesTable.groupId, req.params.id as string))
      .orderBy(desc(groupMessagesTable.createdAt), desc(groupMessagesTable.id))
      .limit(200);
    res.json(latestMessages.reverse());
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.post("/groups/:id/messages", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user.id)) return res.status(403).json({ error: "You are not a member of this group" });
    const { text, replyToId, replyToText, replyToSender } = req.body;
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text required" });
    if (text.length > 5000) return res.status(400).json({ error: "Message is too long" });
    if (replyToId) {
      const [parent] = await db.select({ id: groupMessagesTable.id }).from(groupMessagesTable)
        .where(and(
          eq(groupMessagesTable.id, replyToId),
          eq(groupMessagesTable.groupId, req.params.id as string),
          isNull(groupMessagesTable.deletedAt),
        )).limit(1);
      if (!parent) return res.status(400).json({ error: "The message you are replying to is unavailable" });
    }
    const [msg] = await db.insert(groupMessagesTable).values({
      groupId: req.params.id as string,
      text: text.trim(),
      senderName: user.fullName,
      senderId: user.id,
      role: user.role,
      replyToId: replyToId || null,
      replyToText: replyToText || null,
      replyToSender: replyToSender || null,
    }).returning();
    res.json(msg);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.patch("/groups/:id/messages/:msgId", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string) || !UUID_RE.test(req.params.msgId as string)) {
    return res.status(400).json({ error: "invalid message or group id" });
  }
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user.id)) return res.status(403).json({ error: "You are not a member of this group" });
    const { text } = req.body;
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text required" });
    if (text.length > 4000) return res.status(400).json({ error: "Message is too long" });
    const [existing] = await db.select().from(groupMessagesTable)
      .where(and(eq(groupMessagesTable.id, req.params.msgId as string), eq(groupMessagesTable.groupId, req.params.id as string))).limit(1);
    if (!existing) return res.status(404).json({ error: "Message not found" });
    if (existing.senderId !== user.id) return res.status(403).json({ error: "You can only edit your own messages" });
    const [updated] = await db.update(groupMessagesTable)
      .set({ text: text.trim(), isEdited: true })
      .where(eq(groupMessagesTable.id, req.params.msgId as string))
      .returning();
    res.json(updated);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to edit message" });
  }
});

router.delete("/groups/:id/messages/:msgId", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string) || !UUID_RE.test(req.params.msgId as string)) {
    return res.status(400).json({ error: "invalid message or group id" });
  }
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user.id)) return res.status(403).json({ error: "You are not a member of this group" });
    const [existing] = await db.select().from(groupMessagesTable)
      .where(and(eq(groupMessagesTable.id, req.params.msgId as string), eq(groupMessagesTable.groupId, req.params.id as string))).limit(1);
    if (!existing) return res.status(404).json({ error: "Message not found" });
    const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, req.params.id as string), eq(groupMembersTable.userId, user.id))).limit(1);
    const [group] = await db.select({ teacherId: groupsTable.teacherId }).from(groupsTable).where(eq(groupsTable.id, req.params.id as string)).limit(1);
    const groupAdmin = membership?.role === "admin" || group?.teacherId === user.id;
    if (existing.senderId !== user.id && !groupAdmin && user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Cannot delete this message" });
    }
    const [deleted] = await db.update(groupMessagesTable)
      .set({ deletedAt: new Date() })
      .where(eq(groupMessagesTable.id, req.params.msgId as string))
      .returning();
    res.json(deleted);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to delete message" });
  }
});

router.post("/groups/:id/messages/:msgId/react", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string) || !UUID_RE.test(req.params.msgId as string)) {
    return res.status(400).json({ error: "invalid message or group id" });
  }
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user.id)) return res.status(403).json({ error: "You are not a member of this group" });
    const { emoji } = req.body;
    if (typeof emoji !== "string" || !emoji || emoji.length > 80) return res.status(400).json({ error: "emoji required" });
    const [existing] = await db.select().from(groupMessagesTable)
      .where(and(eq(groupMessagesTable.id, req.params.msgId as string), eq(groupMessagesTable.groupId, req.params.id as string))).limit(1);
    if (!existing) return res.status(404).json({ error: "Message not found" });

    type ReactionEntry = { emoji: string; count: number; userIds: string[] };
    const reactions: ReactionEntry[] = existing.reactions
      ? JSON.parse(existing.reactions)
      : [];

    const POLL_MARKER = "__NAVODAYA_POLL__:";
    if (existing.text.startsWith(POLL_MARKER)) {
      try {
        const poll = JSON.parse(existing.text.slice(POLL_MARKER.length));
        if (Array.isArray(poll.options) && poll.options.includes(emoji)) {
          for (let i = reactions.length - 1; i >= 0; i--) {
            if (poll.options.includes(reactions[i].emoji) && reactions[i].emoji !== emoji) {
              reactions[i].userIds = reactions[i].userIds.filter((id) => id !== user.id);
              reactions[i].count = reactions[i].userIds.length;
              if (!reactions[i].count) reactions.splice(i, 1);
            }
          }
        }
      } catch {}
    }

    const idx = reactions.findIndex((r) => r.emoji === emoji);
    if (idx >= 0) {
      const uidIdx = reactions[idx].userIds.indexOf(user.id);
      if (uidIdx >= 0) {
        reactions[idx].userIds.splice(uidIdx, 1);
        reactions[idx].count = reactions[idx].userIds.length;
        if (reactions[idx].count <= 0) reactions.splice(idx, 1);
      } else {
        reactions[idx].userIds.push(user.id);
        reactions[idx].count = reactions[idx].userIds.length;
      }
    } else {
      reactions.push({ emoji, count: 1, userIds: [user.id] });
    }

    const [updated] = await db.update(groupMessagesTable)
      .set({ reactions: JSON.stringify(reactions) })
      .where(eq(groupMessagesTable.id, req.params.msgId as string))
      .returning();
    res.json(updated);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to react" });
  }
});

router.get("/groups/:id/typing", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user.id)) return res.status(403).json({ error: "You are not a member of this group" });
    cleanTyping(req.params.id as string);
    const group = typingStore.get(req.params.id as string);
    const typers: string[] = [];
    if (group) {
      for (const [uid, data] of group) {
        if (uid !== user.id) typers.push(data.name);
      }
    }
    res.json({ typing: typers });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to get typing" });
  }
});

router.post("/groups/:id/typing", requireAuth, async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user.id)) return res.status(403).json({ error: "You are not a member of this group" });
    const { typing } = req.body;
    if (!typingStore.has(req.params.id as string)) typingStore.set(req.params.id as string, new Map());
    const group = typingStore.get(req.params.id as string)!;
    if (typing) {
      group.set(user.id, { name: user.fullName, expiresAt: Date.now() + 4000 });
    } else {
      group.delete(user.id);
    }
    res.json({ ok: true });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update typing" });
  }
});

export default router;
