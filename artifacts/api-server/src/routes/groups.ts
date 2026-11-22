import { Router } from "express";
import { createHash, randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, inArray, isNull, lt, ne, notInArray, or } from "drizzle-orm";
import { db, groupsTable, groupMembersTable, groupMessagesTable, clubMembersTable, groupInvitesTable, usersTable, verificationAssignmentsTable } from "@workspace/db";
import { requireAuth, requireVerifiedGroupChat, getUser, isAuthorizedJnvOfficial, isVerifiedTeacher } from "../lib/auth";
import { isEligibleForCommunityGroup } from "../lib/group-access";
import { initialGroupMemberRole, mayChangeGroupMemberRole, supportsAdminOnlyMessages, supportsGroupAdminRoles } from "../lib/group-administration";
import { makeJnvId } from "../lib/jnv-identity";
import { getMemoryMediaOwnerId, MemoryMediaError, signMemoryMedia, validateOwnedMemoryMedia } from "../lib/memory-media";

const router = Router();
router.use("/groups", requireAuth, requireVerifiedGroupChat);
const STAFF_GROUP_SUBJECT = "Staff Group";
const GROUP_INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const hashGroupInvite = (token: string) => createHash("sha256").update(token).digest("hex");

function isSystemManagedGroup(group: { groupType: string; clubId: string | null }) {
  return group.groupType === "staff_managed" || group.groupType === "club_managed"
    || group.groupType === "system_created" || group.groupType === "class_based" || !!group.clubId;
}

function isPrivateGroup(group: { groupType: string; subject: string }) {
  return group.groupType === "user_created"
    || (group.groupType === "legacy" && group.subject === "Private chat group");
}

function isStaffGroup(group: { groupType: string; subject: string; jnvId: string | null }) {
  return group.groupType === "staff_managed"
    || (group.groupType === "legacy" && group.subject === STAFF_GROUP_SUBJECT && !!group.jnvId);
}

function canDeleteGroup(group: { groupType: string; clubId: string | null }, role: string | undefined) {
  if (role !== "admin" || isSystemManagedGroup(group)) return false;
  return group.groupType === "user_created" || group.groupType === "school_managed";
}

function getJnvId(user: ReturnType<typeof getUser>) {
  return user.jnvId || makeJnvId(user.jnvState, user.jnvName);
}

async function serializeGroup(group: typeof groupsTable.$inferSelect) {
  const { avatarKey, avatarContentType, ...publicGroup } = group;
  const ownerId = avatarKey ? getMemoryMediaOwnerId(avatarKey) : null;
  const avatarUrl = avatarKey && avatarContentType && ownerId
    ? await signMemoryMedia({ key: avatarKey, fileName: "group-avatar", contentType: avatarContentType, size: 0, mediaType: "image" }, ownerId)
    : undefined;
  return { ...publicGroup, avatarUrl };
}

async function canAccessStaffWorkspace(user: ReturnType<typeof getUser>, jnvId: string) {
  return getJnvId(user) === jnvId && (isVerifiedTeacher(user) || await isAuthorizedJnvOfficial(user));
}

async function syncStaffGroupMembers(groupId: string, jnvId: string) {
  const users = await db.select({ id: usersTable.id, role: usersTable.role, verificationStatus: usersTable.verificationStatus, jnvId: usersTable.jnvId, jnvName: usersTable.jnvName, jnvState: usersTable.jnvState })
    .from(usersTable).where(or(eq(usersTable.role, "teacher"), eq(usersTable.role, "official")));
  const allowed = users.filter((candidate) => {
    const candidateJnvId = candidate.jnvId || makeJnvId(candidate.jnvState, candidate.jnvName);
    return !jnvId || candidateJnvId === jnvId;
  });
  const allowedIds = allowed.map((candidate) => candidate.id);
  if (allowedIds.length) {
    await db.insert(groupMembersTable).values(allowed.map((candidate) => ({ groupId, userId: candidate.id, role: candidate.role === "official" ? "admin" : "member" }))).onConflictDoNothing();
    const officialIds = allowed.filter((candidate) => candidate.role === "official").map((candidate) => candidate.id);
    const teacherIds = allowed.filter((candidate) => candidate.role === "teacher").map((candidate) => candidate.id);
    if (officialIds.length) {
      await db.update(groupMembersTable).set({ role: "admin" }).where(and(
        eq(groupMembersTable.groupId, groupId), inArray(groupMembersTable.userId, officialIds), ne(groupMembersTable.role, "left"),
      ));
    }
    if (teacherIds.length) {
      await db.update(groupMembersTable).set({ role: "member" }).where(and(
        eq(groupMembersTable.groupId, groupId), inArray(groupMembersTable.userId, teacherIds), ne(groupMembersTable.role, "left"),
      ));
    }
    await db.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), notInArray(groupMembersTable.userId, allowedIds)));
  } else {
    await db.delete(groupMembersTable).where(eq(groupMembersTable.groupId, groupId));
  }
  const [memberCount] = await db.select({ total: count() }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), ne(groupMembersTable.role, "left")));
  await db.update(groupsTable).set({ memberCount: memberCount.total }).where(eq(groupsTable.id, groupId));
}

async function syncOfficialsGroupMembers(groupId: string, jnvId: string) {
  const users = await db.select({ id: usersTable.id, role: usersTable.role, verificationStatus: usersTable.verificationStatus, jnvId: usersTable.jnvId, jnvName: usersTable.jnvName, jnvState: usersTable.jnvState })
    .from(usersTable).where(eq(usersTable.role, "official"));
  const allowed = users.filter((candidate) => {
    const candidateJnvId = candidate.jnvId || makeJnvId(candidate.jnvState, candidate.jnvName);
    return !jnvId || candidateJnvId === jnvId;
  });
  const allowedIds = allowed.map((candidate) => candidate.id);
  if (allowedIds.length) {
    await db.insert(groupMembersTable).values(allowed.map((candidate) => ({ groupId, userId: candidate.id, role: "admin" }))).onConflictDoNothing();
  }
  const [memberCount] = await db.select({ total: count() }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), ne(groupMembersTable.role, "left")));
  await db.update(groupsTable).set({ memberCount: memberCount.total }).where(eq(groupsTable.id, groupId));
}

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

async function addGroupMember(groupId: string, userId: string, role = "member") {
  const [inserted] = await db.insert(groupMembersTable)
    .values({ groupId, userId, role })
    .onConflictDoNothing()
    .returning({ userId: groupMembersTable.userId });
  if (!inserted) return;

  const [members] = await db.select({ total: count() }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), ne(groupMembersTable.role, "left")));
  await db.update(groupsTable).set({ memberCount: members.total }).where(eq(groupsTable.id, groupId));
}

async function canAccessGroup(groupId: string, user: ReturnType<typeof getUser>) {
  const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
  if (!group) return false;
  if (isStaffGroup(group)) {
    if (!group.jnvId || !await canAccessStaffWorkspace(user, group.jnvId)) return false;
    await syncStaffGroupMembers(group.id, group.jnvId);
    const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id))).limit(1);
    return !!membership && membership.role !== "left";
  }
  if (group.subject === "Officials Group") {
    if (user.role !== "official") return false;
    const jnvId = getJnvId(user);
    if (group.jnvId && group.jnvId !== jnvId) return false;
    await syncOfficialsGroupMembers(group.id, group.jnvId || jnvId);
    const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id))).limit(1);
    return !!membership && membership.role !== "left";
  }
  if (group.clubId) {
    const [membership] = await db.select({ id: clubMembersTable.id, role: clubMembersTable.role }).from(clubMembersTable)
      .where(and(eq(clubMembersTable.clubId, group.clubId), eq(clubMembersTable.userId, user.id))).limit(1);
    if (!membership) return false;
    const role = membership.role === "manager" ? "admin" : "member";
    const [groupMembership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
    if (!groupMembership) await addGroupMember(groupId, user.id, role);
    else if (groupMembership.role !== "left" && groupMembership.role !== role) {
      await db.update(groupMembersTable).set({ role }).where(and(
        eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id), ne(groupMembersTable.role, "left"),
      ));
    }
    return true;
  }
  if (!isPrivateGroup(group)) {
    const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id))).limit(1);
    if (membership?.role === "left") return false;
    if (!isEligibleForCommunityGroup(group, user)) return false;
    await addGroupMember(groupId, user.id, "member");
    return true;
  }
  const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
    .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
  return !!membership && membership.role !== "left";
}

router.get("/groups", async (req, res) => {
  try {
    const user = getUser(req);
    // Auto-ensure Staff Group & Officials Group for authorized staff
    if (user.role === "teacher" || user.role === "official") {
      const jnvId = getJnvId(user);
      if (jnvId) {
        let [staffGroup] = await db.select().from(groupsTable)
          .where(and(eq(groupsTable.subject, STAFF_GROUP_SUBJECT), eq(groupsTable.jnvId, jnvId))).limit(1);
        if (!staffGroup) {
          try {
            [staffGroup] = await db.insert(groupsTable).values({
              name: "Staff Group",
              subject: STAFF_GROUP_SUBJECT,
              groupType: "staff_managed",
              jnvId,
              jnvName: user.jnvName,
              jnvState: user.jnvState,
              teacherId: user.id,
              teacherName: user.fullName,
              memberCount: 1,
            }).onConflictDoNothing().returning();
          } catch {}
          if (!staffGroup) {
            [staffGroup] = await db.select().from(groupsTable)
              .where(and(eq(groupsTable.subject, STAFF_GROUP_SUBJECT), eq(groupsTable.jnvId, jnvId))).limit(1);
          }
        }
        if (staffGroup) {
          await addGroupMember(staffGroup.id, user.id, user.role === "official" ? "admin" : "member");
          await syncStaffGroupMembers(staffGroup.id, jnvId);
        }

        if (user.role === "official") {
          let [officialGroup] = await db.select().from(groupsTable)
            .where(and(eq(groupsTable.subject, "Officials Group"), eq(groupsTable.jnvId, jnvId))).limit(1);
          if (!officialGroup) {
            try {
              [officialGroup] = await db.insert(groupsTable).values({
                name: "JNV Officials Group",
                subject: "Officials Group",
                groupType: "staff_managed",
                jnvId,
                jnvName: user.jnvName,
                jnvState: user.jnvState,
                createdById: user.id,
                memberCount: 1,
              }).onConflictDoNothing().returning();
            } catch {}
            if (!officialGroup) {
              [officialGroup] = await db.select().from(groupsTable)
                .where(and(eq(groupsTable.subject, "Officials Group"), eq(groupsTable.jnvId, jnvId))).limit(1);
            }
          }
          if (officialGroup) {
            await addGroupMember(officialGroup.id, user.id, "admin");
            await syncOfficialsGroupMembers(officialGroup.id, jnvId);
          }
        }
      }
    }
    const memberships = await db.select({ groupId: groupMembersTable.groupId, role: groupMembersTable.role }).from(groupMembersTable).where(eq(groupMembersTable.userId, user.id));
    const memberGroupIds = memberships.filter((membership) => membership.role !== "left").map((membership) => membership.groupId);
    const memberGroupIdSet = new Set(memberGroupIds);
    const leftGroupIdSet = new Set(memberships.filter((membership) => membership.role === "left").map((membership) => membership.groupId));
    const clubMemberships = await db.select({ clubId: clubMembersTable.clubId }).from(clubMembersTable).where(eq(clubMembersTable.userId, user.id));
    const clubIds = new Set(clubMemberships.map((membership) => membership.clubId));
    const communityTypeCondition = and(
      ne(groupsTable.groupType, "user_created"),
      or(ne(groupsTable.groupType, "legacy"), ne(groupsTable.subject, "Private chat group")),
    );
    const communityConditions = or(
      and(eq(groupsTable.jnvName, user.jnvName), eq(groupsTable.jnvState, user.jnvState), communityTypeCondition!),
      and(isNull(groupsTable.jnvName), isNull(groupsTable.jnvState), communityTypeCondition!),
    );
    const listConditions = [communityConditions!];
    if (memberGroupIds.length) listConditions.push(inArray(groupsTable.id, memberGroupIds));
    if (clubIds.size) listConditions.push(inArray(groupsTable.clubId, [...clubIds]));
    const groups = await db.select().from(groupsTable)
      .where(or(...listConditions))
      .orderBy(desc(groupsTable.createdAt))
      .limit(100);
    const roleVisibleGroups = (await Promise.all(groups.map(async (group) => {
      if (group.clubId) return clubIds.has(group.clubId) ? group : null;
      if (isStaffGroup(group)) {
        return (user.role === "teacher" || user.role === "official") && (!group.jnvId || group.jnvId === getJnvId(user)) ? group : null;
      }
      if (group.subject === "Officials Group") {
        return user.role === "official" && (!group.jnvId || group.jnvId === getJnvId(user)) ? group : null;
      }
      if (isPrivateGroup(group)) return memberGroupIdSet.has(group.id) ? group : null;
      if (leftGroupIdSet.has(group.id)) return null;
      return isEligibleForCommunityGroup(group, user) ? group : null;
    }))).filter((group): group is NonNullable<typeof group> => group !== null);
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
      const serializableGroup = await serializeGroup(group);
      return {
        ...serializableGroup,
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

router.post("/groups", async (req, res) => {
  try {
    const user = getUser(req);
    const { name, memberIds } = req.body ?? {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "Group name required" });
    }
    if (name.trim().length > 80) {
      return res.status(400).json({ error: "Group name must be under 80 characters" });
    }
    if (req.body?.avatarKey !== undefined && req.body.avatarKey !== null && typeof req.body.avatarKey !== "string") {
      return res.status(400).json({ error: "The group photo upload is invalid" });
    }
    const avatarMedia = typeof req.body?.avatarKey === "string" && req.body.avatarKey
      ? await validateOwnedMemoryMedia(user.id, req.body.avatarKey)
      : null;
    if (avatarMedia && avatarMedia.mediaType !== "image") {
      return res.status(400).json({ error: "Group photos must be images" });
    }
    if (!Array.isArray(memberIds)) {
      if (avatarMedia) return res.status(400).json({ error: "Set a school group photo through its group administration settings" });
      const { subject, class: cls } = req.body ?? {};
      if (user.role !== "teacher" || !isVerifiedTeacher(user)) return res.status(403).json({ error: "Only verified teachers can create school groups" });
      if (typeof subject !== "string" || !subject.trim()) return res.status(400).json({ error: "Group subject required" });
      if (subject.trim().length > 80 || (typeof cls === "string" && cls.length > 80)) {
        return res.status(400).json({ error: "Group name and subject must be under 80 characters" });
      }
      const group = await db.transaction(async (tx) => {
        const [created] = await tx.insert(groupsTable).values({
          name: name.trim(), subject: subject.trim(), class: typeof cls === "string" ? cls.trim() || null : null,
          jnvName: user.jnvName, jnvState: user.jnvState, teacherName: user.fullName,
          teacherId: user.id, createdById: user.id, groupType: "school_managed", memberCount: 1,
        }).returning();
        await tx.insert(groupMembersTable).values({
          groupId: created.id, userId: user.id,
          role: initialGroupMemberRole("school_managed", user.id, user.id),
        }).onConflictDoNothing();
        return created;
      });
      return res.json(await serializeGroup(group));
    }
    if (memberIds.length < 1 || memberIds.length > 99 || memberIds.some((id: unknown) => typeof id !== "string" || !UUID_RE.test(id))) {
      return res.status(400).json({ error: "Select between 1 and 99 group members" });
    }
    const selectedIds = [...new Set<string>([user.id, ...memberIds])];
    const selectedUsers = await db.select({ id: usersTable.id, jnvName: usersTable.jnvName }).from(usersTable).where(inArray(usersTable.id, selectedIds));
    if (selectedUsers.length !== selectedIds.length) return res.status(400).json({ error: "One or more selected members were not found" });
    const group = await db.transaction(async (tx) => {
      const [created] = await tx.insert(groupsTable).values({
        name: name.trim(), subject: "Private chat group", groupType: "user_created", createdById: user.id, jnvName: null,
        jnvState: null, teacherName: user.fullName, teacherId: user.id,
        avatarKey: avatarMedia?.key ?? null, avatarContentType: avatarMedia?.contentType ?? null,
        memberCount: selectedIds.length,
      }).returning();
      await tx.insert(groupMembersTable).values(selectedIds.map((userId) => ({
        groupId: created.id, userId,
        role: initialGroupMemberRole("user_created", userId, user.id),
      })));
      return created;
    });
    res.json(await serializeGroup(group));
  } catch (e: any) {
    if (e instanceof MemoryMediaError) return res.status(e.statusCode).json({ error: e.message });
    req.log.error(e);
    res.status(500).json({ error: "Failed to create group" });
  }
});

router.post("/groups/:id/invite-link", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!await canAccessGroup(groupId, user)) return res.status(403).json({ error: "You must be an active group member to invite others" });
    const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
    if (!membership || membership.role === "left") return res.status(403).json({ error: "You must be an active group member to invite others" });

    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + GROUP_INVITE_TTL_MS);
    await db.insert(groupInvitesTable).values({
      groupId,
      tokenHash: hashGroupInvite(token),
      createdById: user.id,
      expiresAt,
    });
    return res.json({ token, groupName: group.name, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    req.log.error(error, "Failed to create group invite link");
    return res.status(500).json({ error: "Could not create an invite link" });
  }
});

router.post("/groups/join-by-invite", async (req, res) => {
  const token = typeof req.body?.token === "string" ? req.body.token : "";
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(token)) return res.status(400).json({ error: "This invite link is invalid" });
  try {
    const user = getUser(req);
    const [invite] = await db.select().from(groupInvitesTable).where(and(
      eq(groupInvitesTable.tokenHash, hashGroupInvite(token)),
      gt(groupInvitesTable.expiresAt, new Date()),
    )).limit(1);
    if (!invite) return res.status(404).json({ error: "This invite link has expired or is invalid" });
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, invite.groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "This group is no longer available" });

    if (isPrivateGroup(group)) {
      await db.transaction(async (tx) => {
        await tx.select({ id: groupsTable.id }).from(groupsTable).where(eq(groupsTable.id, group.id)).for("update").limit(1);
        const [membership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
          .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id))).limit(1);
        if (membership?.role === "left") {
          await tx.update(groupMembersTable).set({ role: "member" }).where(and(
            eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id), eq(groupMembersTable.role, "left"),
          ));
        } else if (!membership) {
          await tx.insert(groupMembersTable).values({ groupId: group.id, userId: user.id, role: "member" }).onConflictDoNothing();
        }
        const [activeMembers] = await tx.select({ total: count() }).from(groupMembersTable)
          .where(and(eq(groupMembersTable.groupId, group.id), ne(groupMembersTable.role, "left")));
        await tx.update(groupsTable).set({ memberCount: activeMembers.total }).where(eq(groupsTable.id, group.id));
      });
    } else {
      const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id))).limit(1);
      if (membership?.role === "left" && !group.clubId && !isStaffGroup(group)) {
        if (!isEligibleForCommunityGroup(group, user)) return res.status(403).json({ error: "This group is not available for your account" });
        await db.update(groupMembersTable).set({ role: "member" }).where(and(
          eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id), eq(groupMembersTable.role, "left"),
        ));
      } else if (!await canAccessGroup(group.id, user)) {
        return res.status(403).json({ error: "This group is not available for your account" });
      }
    }

    return res.json({ id: group.id, name: group.name, joined: true });
  } catch (error) {
    req.log.error(error, "Failed to join group by invite");
    return res.status(500).json({ error: "Could not join this group" });
  }
});

router.get("/groups/:id/members", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, req.params.id as string)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!await canAccessGroup(group.id, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const members = await db.select({ id: usersTable.id, fullName: usersTable.fullName, role: groupMembersTable.role, accountRole: usersTable.role, subject: usersTable.subject, designation: usersTable.designation, photoURL: usersTable.photoURL })
      .from(groupMembersTable).innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
      .where(and(eq(groupMembersTable.groupId, group.id), ne(groupMembersTable.role, "left")));
    return res.json(members);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Failed to load group members" });
  }
});

router.post("/groups/:id/members", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!supportsGroupAdminRoles(group.groupType)) return res.status(403).json({ error: "Membership for this group is managed by its school, club, or community workflow" });
    if (!await canAccessGroup(groupId, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const ids = req.body?.memberIds;
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 99 || ids.some((memberId: unknown) => typeof memberId !== "string" || !UUID_RE.test(memberId))) {
      return res.status(400).json({ error: "Select between 1 and 99 members" });
    }
    const uniqueIds = [...new Set<string>(ids)];
    const found = await db.select().from(usersTable).where(inArray(usersTable.id, uniqueIds));
    if (found.length !== uniqueIds.length) return res.status(400).json({ error: "One or more selected members were not found" });
    if (group.clubId) {
      const clubMemberships = await db.select({ userId: clubMembersTable.userId }).from(clubMembersTable)
        .where(and(eq(clubMembersTable.clubId, group.clubId), inArray(clubMembersTable.userId, uniqueIds)));
      if (clubMemberships.length !== uniqueIds.length) return res.status(403).json({ error: "Add club members through the club membership workflow" });
    } else if (!isPrivateGroup(group) && found.some((member) => !isEligibleForCommunityGroup(group, member))) {
      return res.status(403).json({ error: "One or more selected members are not eligible for this group" });
    }
    const result = await db.transaction(async (tx) => {
      const [lockedGroup] = await tx.select({ id: groupsTable.id }).from(groupsTable)
        .where(eq(groupsTable.id, groupId)).for("update").limit(1);
      if (!lockedGroup) return { status: 404 as const, error: "Group not found" };
      const [adminMembership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
      if (adminMembership?.role !== "admin") return { status: 403 as const, error: "Only group admins can add members" };
      await tx.update(groupMembersTable).set({ role: "member" }).where(and(
        eq(groupMembersTable.groupId, groupId), inArray(groupMembersTable.userId, uniqueIds), eq(groupMembersTable.role, "left"),
      ));
      await tx.insert(groupMembersTable).values(uniqueIds.map((userId) => ({ groupId, userId, role: "member" }))).onConflictDoNothing();
      const [membersCount] = await tx.select({ total: count() }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), ne(groupMembersTable.role, "left")));
      await tx.update(groupsTable).set({ memberCount: membersCount.total }).where(eq(groupsTable.id, groupId));
      const members = await tx.select({ id: usersTable.id, fullName: usersTable.fullName, role: groupMembersTable.role, accountRole: usersTable.role, subject: usersTable.subject, designation: usersTable.designation, photoURL: usersTable.photoURL })
        .from(groupMembersTable).innerJoin(usersTable, eq(groupMembersTable.userId, usersTable.id))
        .where(and(eq(groupMembersTable.groupId, groupId), ne(groupMembersTable.role, "left")));
      return { status: 200 as const, members };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    res.json(result.members);
  } catch (error) {
    req.log.error(error);
    res.status(500).json({ error: "Failed to add group members" });
  }
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

router.patch("/groups/:id/members/:userId/role", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string) || !UUID_RE.test(req.params.userId as string)) {
    return res.status(400).json({ error: "invalid group or user id" });
  }
  const requestedRole = req.body?.role;
  if (requestedRole !== "admin" && requestedRole !== "member") {
    return res.status(400).json({ error: "role must be admin or member" });
  }
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    const targetId = req.params.userId as string;
    if (user.id === targetId) return res.status(400).json({ error: "You cannot change your own group role" });

    const result = await db.transaction(async (tx) => {
      const [group] = await tx.select().from(groupsTable).where(eq(groupsTable.id, groupId)).for("update").limit(1);
      if (!group) return { status: 404 as const, error: "Group not found" };
      const [actorMembership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
      if (!mayChangeGroupMemberRole(group.groupType, user.id, targetId, actorMembership?.role)) {
        return { status: 403 as const, error: "Only this group's admins can change roles managed by the group" };
      }

      const [targetMembership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetId))).limit(1);
      if (!targetMembership || targetMembership.role === "left") {
        return { status: 404 as const, error: "Active group member not found" };
      }
      if (targetMembership.role === requestedRole) return { status: 200 as const, role: requestedRole };

      if (requestedRole === "member") {
        const [admins] = await tx.select({ total: count() }).from(groupMembersTable)
          .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.role, "admin")));
        if (admins.total <= 1) return { status: 409 as const, error: "Promote another member before removing the last admin" };
      }

      await tx.update(groupMembersTable).set({ role: requestedRole }).where(and(
        eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, targetId), ne(groupMembersTable.role, "left"),
      ));
      return { status: 200 as const, role: requestedRole };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    return res.json({ userId: targetId, role: result.role });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Could not update group member role" });
  }
});

router.get("/groups/:id/settings", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, req.params.id as string)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!await canAccessGroup(group.id, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id))).limit(1);
    const isAdmin = membership?.role === "admin";
    const canDelete = canDeleteGroup(group, membership?.role);
    const [admins] = await db.select({ total: count() }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.role, "admin")));
    const serializableGroup = await serializeGroup(group);
    return res.json({
      ...serializableGroup,
      canLeave: true,
      canDelete,
      canManageRoles: isAdmin && supportsGroupAdminRoles(group.groupType),
      canConfigureAdminOnlyMessages: isAdmin && supportsAdminOnlyMessages(group.groupType),
      canUpdateAvatar: isAdmin && (group.groupType === "user_created" || group.groupType === "school_managed"),
      requiresAdminDecision: admins.total === 0
        && group.groupType !== "system_created" && group.groupType !== "class_based",
    });
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error);
    return res.status(500).json({ error: "Could not load group settings" });
  }
});

router.patch("/groups/:id/settings", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  if (typeof req.body?.adminOnlyMessages !== "boolean") {
    return res.status(400).json({ error: "adminOnlyMessages must be a boolean" });
  }
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    if (!await canAccessGroup(groupId, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const result = await db.transaction(async (tx) => {
      const [group] = await tx.select().from(groupsTable).where(eq(groupsTable.id, groupId)).for("update").limit(1);
      if (!group) return { status: 404 as const, error: "Group not found" };
      if (!supportsAdminOnlyMessages(group.groupType)) return { status: 403 as const, error: "This group does not support admin-only messaging" };
      const [membership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
      if (membership?.role !== "admin") return { status: 403 as const, error: "Only this group's admins can update settings" };
      const [updated] = await tx.update(groupsTable).set({ adminOnlyMessages: req.body.adminOnlyMessages })
        .where(eq(groupsTable.id, groupId)).returning();
      return { status: 200 as const, group: updated };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    return res.json(await serializeGroup(result.group));
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Could not update group settings" });
  }
});

router.patch("/groups/:id/avatar", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  const rawAvatarKey = req.body?.avatarKey;
  if (rawAvatarKey !== null && typeof rawAvatarKey !== "string") {
    return res.status(400).json({ error: "avatarKey must be a media key or null" });
  }
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    const avatarMedia = rawAvatarKey ? await validateOwnedMemoryMedia(user.id, rawAvatarKey) : null;
    if (avatarMedia && avatarMedia.mediaType !== "image") {
      return res.status(400).json({ error: "Group photos must be images" });
    }
    if (!await canAccessGroup(groupId, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const result = await db.transaction(async (tx) => {
      const [group] = await tx.select().from(groupsTable).where(eq(groupsTable.id, groupId)).for("update").limit(1);
      if (!group) return { status: 404 as const, error: "Group not found" };
      if (group.groupType !== "user_created" && group.groupType !== "school_managed") {
        return { status: 403 as const, error: "This group does not allow member-managed photos" };
      }
      const [membership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
      if (membership?.role !== "admin") return { status: 403 as const, error: "Only this group's admins can update its photo" };
      const [updated] = await tx.update(groupsTable).set({
        avatarKey: avatarMedia?.key ?? null,
        avatarContentType: avatarMedia?.contentType ?? null,
      }).where(eq(groupsTable.id, groupId)).returning();
      return { status: 200 as const, group: updated };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    return res.json(await serializeGroup(result.group));
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error);
    return res.status(500).json({ error: "Could not update the group photo" });
  }
});

router.post("/groups/:id/leave", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (group.clubId) return res.status(400).json({ error: "Leave this group through its club membership" });
    if (!await canAccessGroup(groupId, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const result = await db.transaction(async (tx) => {
      const [lockedGroup] = await tx.select().from(groupsTable)
        .where(eq(groupsTable.id, groupId)).for("update").limit(1);
      if (!lockedGroup) return { status: 404 as const, error: "Group not found" };
      if (lockedGroup.clubId) return { status: 400 as const, error: "Leave this group through its club membership" };
      const [membership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
      if (!membership || membership.role === "left") return { status: 403 as const, error: "You are not a member of this group" };

      const activeMembers = await tx.select({ userId: groupMembersTable.userId })
        .from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), ne(groupMembersTable.role, "left")));
      if (membership.role === "admin" && supportsGroupAdminRoles(lockedGroup.groupType)) {
        const [otherAdmins] = await tx.select({ total: count() }).from(groupMembersTable)
          .where(and(
            eq(groupMembersTable.groupId, groupId),
            eq(groupMembersTable.role, "admin"),
            ne(groupMembersTable.userId, user.id),
          ));
        if (otherAdmins.total === 0 && (activeMembers.length > 1 || !isPrivateGroup(lockedGroup))) {
          return { status: 409 as const, error: "Promote another member before leaving so the group keeps an admin, or delete the group if it is no longer needed." };
        }
      }

      if (isPrivateGroup(lockedGroup)) {
        await tx.delete(groupMembersTable).where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id)));
      } else {
        await tx.update(groupMembersTable).set({ role: "left" }).where(and(
          eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id),
        ));
      }

      const remainingMembers = await tx.select({ userId: groupMembersTable.userId })
        .from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), ne(groupMembersTable.role, "left")));
      if (isPrivateGroup(lockedGroup) && remainingMembers.length === 0) {
        await tx.delete(groupsTable).where(eq(groupsTable.id, groupId));
        return { status: 200 as const, left: true, deleted: true };
      }
      await tx.update(groupsTable).set({ memberCount: remainingMembers.length }).where(eq(groupsTable.id, groupId));
      return { status: 200 as const, left: true, deleted: false };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    return res.json({ left: result.left, deleted: result.deleted });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Could not leave this group" });
  }
});

router.delete("/groups/:id", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    const [group] = await db.select().from(groupsTable).where(eq(groupsTable.id, groupId)).limit(1);
    if (!group) return res.status(404).json({ error: "Group not found" });
    if (!await canAccessGroup(groupId, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const result = await db.transaction(async (tx) => {
      const [lockedGroup] = await tx.select().from(groupsTable)
        .where(eq(groupsTable.id, groupId)).for("update").limit(1);
      if (!lockedGroup) return { status: 404 as const, error: "Group not found" };
      const [membership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
      if (!canDeleteGroup(lockedGroup, membership?.role)) {
        return { status: 403 as const, error: "Only an authorized group admin can delete this group" };
      }
      await tx.delete(groupsTable).where(eq(groupsTable.id, groupId));
      return { status: 200 as const };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    return res.json({ deleted: true });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Could not delete this group" });
  }
});

const INTEREST_GROUPS: Record<string, string> = {
  "alumni-network": "JNV Alumni Network",
  "upsc-aspirants": "UPSC Aspirants",
  "tech-careers": "Tech Careers",
  "jee-neet": "JEE & NEET Prep",
  "arts-culture": "Arts & Culture",
};

router.post("/groups/ensure-community", async (req, res) => {
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
    } else if (kind === "staff" && (user.role === "teacher" || user.role === "official")) {
      name = "Staff Group";
      subject = STAFF_GROUP_SUBJECT;
    } else if (kind === "officials" && user.role === "official") {
      name = "JNV Officials Group";
      subject = "Officials Group";
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
    conditions.push(eq(groupsTable.subject, subject));
    conditions.push(jnvName ? eq(groupsTable.jnvName, jnvName) : isNull(groupsTable.jnvName));
    conditions.push(jnvName && user.jnvState ? eq(groupsTable.jnvState, user.jnvState) : isNull(groupsTable.jnvState));
    conditions.push(className ? eq(groupsTable.class, className) : isNull(groupsTable.class));
    const [existing] = await db.select().from(groupsTable).where(and(...conditions)).limit(1);
    if (existing) {
      const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, existing.id), eq(groupMembersTable.userId, user.id))).limit(1);
      if (membership?.role === "left" && isEligibleForCommunityGroup(existing, user)) {
        await db.update(groupMembersTable).set({ role: "member" }).where(and(
          eq(groupMembersTable.groupId, existing.id), eq(groupMembersTable.userId, user.id),
        ));
      }
      if (!await canAccessGroup(existing.id, user)) return res.status(403).json({ error: "This community is not available for your profile" });
      return res.json(existing);
    }

    const groupType = subject === "Class community" || subject === "Alumni batch" ? "class_based" : "system_created";
    const group = await db.transaction(async (tx) => {
      const [created] = await tx.insert(groupsTable).values({
        name,
        subject,
        groupType,
        class: className,
        jnvName,
        jnvState: jnvName ? user.jnvState : null,
        createdById: null,
        teacherName: null,
        teacherId: null,
        memberCount: 1,
      }).returning();
      await tx.insert(groupMembersTable).values({ groupId: created.id, userId: user.id, role: "member" }).onConflictDoNothing();
      return created;
    });
    return res.json(group);
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Could not open this community chat" });
  }
});

router.post("/groups/ensure-staff", async (req, res) => {
  try {
    const user = getUser(req);
    const rejoin = req.body?.rejoin === true;
    const jnvId = getJnvId(user);
    if (!await canAccessStaffWorkspace(user, jnvId)) return res.status(403).json({ error: "Verified teachers or authorized JNV officials only" });
    let [group] = await db.select().from(groupsTable)
      .where(and(eq(groupsTable.subject, STAFF_GROUP_SUBJECT), eq(groupsTable.jnvId, jnvId))).limit(1);
    if (!group) {
      try {
        [group] = await db.insert(groupsTable).values({
          name: "Staff Group",
          subject: STAFF_GROUP_SUBJECT,
          groupType: "staff_managed",
          jnvId,
          jnvName: user.jnvName,
          jnvState: user.jnvState,
          teacherId: user.id,
          teacherName: user.fullName,
          memberCount: 0,
        }).onConflictDoNothing().returning();
      } catch (error) {
        req.log.error(error, "Staff group creation failed");
      }
      if (!group) {
        [group] = await db.select().from(groupsTable)
          .where(and(eq(groupsTable.subject, STAFF_GROUP_SUBJECT), eq(groupsTable.jnvId, jnvId))).limit(1);
      }
    }
    if (!group) return res.status(500).json({ error: "Could not create the school staff group" });
    await syncStaffGroupMembers(group.id, jnvId);
    if (rejoin) {
      await db.update(groupMembersTable).set({ role: user.role === "official" ? "admin" : "member" }).where(and(
        eq(groupMembersTable.groupId, group.id), eq(groupMembersTable.userId, user.id), eq(groupMembersTable.role, "left"),
      ));
    }
    const [activeMembers] = await db.select({ total: count() }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), ne(groupMembersTable.role, "left")));
    await db.update(groupsTable).set({ memberCount: activeMembers.total }).where(eq(groupsTable.id, group.id));
    const [current] = await db.select().from(groupsTable).where(eq(groupsTable.id, group.id)).limit(1);
    return res.json(current);
  } catch (error) {
    req.log.error(error, "Failed to ensure Staff Group");
    return res.status(500).json({ error: "Could not open the Staff Group" });
  }
});

router.post("/groups/ensure-officials", async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "official") return res.status(403).json({ error: "JNV officials only" });
    const jnvId = getJnvId(user);
    let [group] = await db.select().from(groupsTable)
      .where(and(eq(groupsTable.subject, "Officials Group"), eq(groupsTable.jnvId, jnvId))).limit(1);
    if (!group) {
      try {
        [group] = await db.insert(groupsTable).values({
          name: "JNV Officials Group",
          subject: "Officials Group",
          groupType: "staff_managed",
          jnvId,
          jnvName: user.jnvName,
          jnvState: user.jnvState,
          createdById: user.id,
          memberCount: 0,
        }).onConflictDoNothing().returning();
      } catch (error) {
        req.log.error(error, "Officials group creation failed");
      }
      if (!group) {
        [group] = await db.select().from(groupsTable)
          .where(and(eq(groupsTable.subject, "Officials Group"), eq(groupsTable.jnvId, jnvId))).limit(1);
      }
    }
    if (!group) return res.status(500).json({ error: "Could not create JNV Officials Group" });
    await syncOfficialsGroupMembers(group.id, jnvId);
    const [activeMembers] = await db.select({ total: count() }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, group.id), ne(groupMembersTable.role, "left")));
    await db.update(groupsTable).set({ memberCount: activeMembers.total }).where(eq(groupsTable.id, group.id));
    const [current] = await db.select().from(groupsTable).where(eq(groupsTable.id, group.id)).limit(1);
    return res.json(current);
  } catch (error) {
    req.log.error(error, "Failed to ensure Officials Group");
    return res.status(500).json({ error: "Could not open JNV Officials Group" });
  }
});

router.get("/groups/:id/messages", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.json([]);
  const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
  const beforeId = typeof req.query.beforeId === "string" ? req.query.beforeId : null;
  if (before && Number.isNaN(before.getTime())) return res.status(400).json({ error: "invalid message cursor" });
  if (beforeId && !UUID_RE.test(beforeId)) return res.status(400).json({ error: "invalid message cursor" });
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user)) return res.status(403).json({ error: "You are not a member of this group" });
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

router.post("/groups/:id/messages", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    const groupId = req.params.id as string;
    if (!await canAccessGroup(groupId, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const { text, replyToId } = req.body;
    if (typeof text !== "string" || !text.trim()) return res.status(400).json({ error: "text required" });
    if (text.length > 5000) return res.status(400).json({ error: "Message is too long" });
    if (replyToId && (typeof replyToId !== "string" || !UUID_RE.test(replyToId))) {
      return res.status(400).json({ error: "invalid reply message id" });
    }
    const result = await db.transaction(async (tx) => {
      const [group] = await tx.select({ adminOnlyMessages: groupsTable.adminOnlyMessages, groupType: groupsTable.groupType }).from(groupsTable)
        .where(eq(groupsTable.id, groupId)).for("update").limit(1);
      if (!group) return { status: 404 as const, error: "Group not found" };
      const [membership] = await tx.select({ role: groupMembersTable.role }).from(groupMembersTable)
        .where(and(eq(groupMembersTable.groupId, groupId), eq(groupMembersTable.userId, user.id))).limit(1);
      if (!membership || membership.role === "left") return { status: 403 as const, error: "You are not a member of this group" };
      if (supportsAdminOnlyMessages(group.groupType) && group.adminOnlyMessages && membership.role !== "admin") {
        return { status: 403 as const, error: "Only group admins can send messages" };
      }
      let reply: { id: string; text: string | null; senderName: string | null } | null = null;
      if (replyToId) {
        const [parent] = await tx.select({ id: groupMessagesTable.id, text: groupMessagesTable.text, senderName: groupMessagesTable.senderName }).from(groupMessagesTable)
          .where(and(
            eq(groupMessagesTable.id, replyToId),
            eq(groupMessagesTable.groupId, groupId),
            isNull(groupMessagesTable.deletedAt),
          )).limit(1);
        if (!parent) return { status: 400 as const, error: "The message you are replying to is unavailable" };
        reply = parent;
      }
      const [msg] = await tx.insert(groupMessagesTable).values({
        groupId,
        text: text.trim(),
        senderName: user.fullName,
        senderId: user.id,
        role: user.role,
        replyToId: reply?.id ?? null,
        replyToText: reply?.text ?? null,
        replyToSender: reply?.senderName ?? null,
      }).returning();
      return { status: 200 as const, msg };
    });
    if (result.status !== 200) return res.status(result.status).json({ error: result.error });
    res.json(result.msg);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to send message" });
  }
});

router.patch("/groups/:id/messages/:msgId", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string) || !UUID_RE.test(req.params.msgId as string)) {
    return res.status(400).json({ error: "invalid message or group id" });
  }
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user)) return res.status(403).json({ error: "You are not a member of this group" });
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

router.delete("/groups/:id/messages/:msgId", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string) || !UUID_RE.test(req.params.msgId as string)) {
    return res.status(400).json({ error: "invalid message or group id" });
  }
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user)) return res.status(403).json({ error: "You are not a member of this group" });
    const [existing] = await db.select().from(groupMessagesTable)
      .where(and(eq(groupMessagesTable.id, req.params.msgId as string), eq(groupMessagesTable.groupId, req.params.id as string))).limit(1);
    if (!existing) return res.status(404).json({ error: "Message not found" });
    const [membership] = await db.select({ role: groupMembersTable.role }).from(groupMembersTable)
      .where(and(eq(groupMembersTable.groupId, req.params.id as string), eq(groupMembersTable.userId, user.id))).limit(1);
    const [group] = await db.select({ groupType: groupsTable.groupType }).from(groupsTable)
      .where(eq(groupsTable.id, req.params.id as string)).limit(1);
    const groupAdmin = !!group && supportsAdminOnlyMessages(group.groupType) && membership?.role === "admin";
    if (existing.senderId !== user.id && !groupAdmin) {
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

router.post("/groups/:id/messages/:msgId/react", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string) || !UUID_RE.test(req.params.msgId as string)) {
    return res.status(400).json({ error: "invalid message or group id" });
  }
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user)) return res.status(403).json({ error: "You are not a member of this group" });
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

router.get("/groups/:id/typing", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user)) return res.status(403).json({ error: "You are not a member of this group" });
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

router.post("/groups/:id/typing", async (req, res) => {
  if (!UUID_RE.test(req.params.id as string)) return res.status(400).json({ error: "invalid group id" });
  try {
    const user = getUser(req);
    if (!await canAccessGroup(req.params.id as string, user)) return res.status(403).json({ error: "You are not a member of this group" });
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
