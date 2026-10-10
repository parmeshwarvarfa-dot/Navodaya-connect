import { Router } from "express";
import { and, desc, eq, or } from "drizzle-orm";
import {
  db,
  socialNotificationsTable,
  userBlocksTable,
  userFollowsTable,
  usersTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { createSocialNotification, isBlockedBetween } from "../lib/social-access";
import { isValidUserId } from "./user-validation";

const router = Router();

async function getStatus(viewerId: string, targetId: string) {
  const [target] = await db.select({
    id: usersTable.id,
    profileVisibility: usersTable.profileVisibility,
  }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) return null;

  const blocked = await isBlockedBetween(viewerId, targetId);
  const relations = blocked ? [] : await db.select().from(userFollowsTable).where(or(
    and(eq(userFollowsTable.followerId, viewerId), eq(userFollowsTable.followingId, targetId)),
    and(eq(userFollowsTable.followerId, targetId), eq(userFollowsTable.followingId, viewerId)),
  ));
  const outgoing = relations.find((relation) => relation.followerId === viewerId);
  const incoming = relations.find((relation) => relation.followerId === targetId);
  return {
    profileVisibility: target.profileVisibility ?? "public",
    followStatus: blocked ? "blocked" : outgoing?.status ?? "none",
    isFollowing: outgoing?.status === "accepted",
    followsYou: incoming?.status === "accepted",
    isBlocked: blocked,
  };
}

router.patch("/users/me/privacy", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const visibility = req.body.profileVisibility;
    if (visibility !== "public" && visibility !== "private") {
      return res.status(400).json({ error: "Choose public or private profile visibility." });
    }
    await db.update(usersTable).set({ profileVisibility: visibility }).where(eq(usersTable.id, user.id));
    return res.json({ success: true, status: visibility });
  } catch (error) {
    req.log.error(error, "Failed to update profile privacy");
    return res.status(500).json({ error: "Failed to update privacy settings" });
  }
});

router.get("/users/:id/social-status", requireAuth, async (req, res) => {
  const user = getUser(req);
  const targetId = req.params.id as string;
  if (!isValidUserId(targetId)) return res.status(400).json({ error: "Invalid user ID" });
  const status = await getStatus(user.id, targetId);
  if (!status) return res.status(404).json({ error: "User not found" });
  return res.json(status);
});

router.post("/users/:id/follow", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const targetId = req.params.id as string;
    if (!isValidUserId(targetId)) return res.status(400).json({ error: "Invalid user ID" });
    if (targetId === user.id) return res.status(400).json({ error: "You cannot follow your own profile." });
    if (await isBlockedBetween(user.id, targetId)) return res.status(404).json({ error: "User not found" });
    const [target] = await db.select({
      id: usersTable.id,
      profileVisibility: usersTable.profileVisibility,
      fullName: usersTable.fullName,
    }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });

    const status = target.profileVisibility === "private" ? "pending" : "accepted";
    const [existing] = await db.select().from(userFollowsTable).where(and(
      eq(userFollowsTable.followerId, user.id),
      eq(userFollowsTable.followingId, targetId),
    )).limit(1);
    if (existing?.status === "accepted" || existing?.status === "pending") {
      return res.json(await getStatus(user.id, targetId));
    }
    if (existing) {
      await db.update(userFollowsTable).set({ status, updatedAt: new Date() })
        .where(eq(userFollowsTable.id, existing.id));
    } else {
      await db.insert(userFollowsTable).values({
        followerId: user.id,
        followingId: targetId,
        status,
      });
    }
    await createSocialNotification(
      targetId,
      user.id,
      status === "pending" ? "follow_request" : "follow",
      user.id,
      status === "pending" ? `${user.fullName} requested to follow you.` : `${user.fullName} started following you.`,
    );
    return res.json(await getStatus(user.id, targetId));
  } catch (error) {
    req.log.error(error, "Failed to follow user");
    return res.status(500).json({ error: "Failed to follow profile" });
  }
});

router.delete("/users/:id/follow", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const targetId = req.params.id as string;
    if (!isValidUserId(targetId)) return res.status(400).json({ error: "Invalid user ID" });
    await db.delete(userFollowsTable).where(and(
      eq(userFollowsTable.followerId, user.id),
      eq(userFollowsTable.followingId, targetId),
    ));
    const status = await getStatus(user.id, targetId);
    if (!status) return res.status(404).json({ error: "User not found" });
    return res.json(status);
  } catch (error) {
    req.log.error(error, "Failed to unfollow user");
    return res.status(500).json({ error: "Failed to unfollow profile" });
  }
});

router.get("/follow-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await db.select({
      id: userFollowsTable.id,
      followerId: userFollowsTable.followerId,
      followerName: usersTable.fullName,
      followerPhotoUrl: usersTable.photoURL,
      createdAt: userFollowsTable.createdAt,
    }).from(userFollowsTable)
      .innerJoin(usersTable, eq(userFollowsTable.followerId, usersTable.id))
      .where(and(
        eq(userFollowsTable.followingId, user.id),
        eq(userFollowsTable.status, "pending"),
      ))
      .orderBy(desc(userFollowsTable.createdAt));
    return res.json(rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      followerPhotoUrl: row.followerPhotoUrl ?? undefined,
    })));
  } catch (error) {
    req.log.error(error, "Failed to list follow requests");
    return res.status(500).json({ error: "Failed to fetch follow requests" });
  }
});

router.patch("/follow-requests/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const requestId = req.params.id as string;
    const decision = req.body.decision;
    if (decision !== "accept" && decision !== "decline") {
      return res.status(400).json({ error: "Choose accept or decline." });
    }
    const [request] = await db.select().from(userFollowsTable)
      .where(and(eq(userFollowsTable.id, requestId), eq(userFollowsTable.followingId, user.id)))
      .limit(1);
    if (!request || request.status !== "pending") return res.status(404).json({ error: "Follow request not found" });
    const nextStatus = decision === "accept" ? "accepted" : "declined";
    await db.update(userFollowsTable).set({ status: nextStatus, updatedAt: new Date() })
      .where(eq(userFollowsTable.id, requestId));
    if (decision === "accept") {
      await createSocialNotification(
        request.followerId,
        user.id,
        "follow_accepted",
        user.id,
        `${user.fullName} accepted your follow request.`,
      );
    }
    return res.json({ success: true, status: nextStatus });
  } catch (error) {
    req.log.error(error, "Failed to decide follow request");
    return res.status(500).json({ error: "Failed to update follow request" });
  }
});

router.post("/users/:id/block", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const targetId = req.params.id as string;
    if (!isValidUserId(targetId)) return res.status(400).json({ error: "Invalid user ID" });
    if (targetId === user.id) return res.status(400).json({ error: "You cannot block your own profile." });
    const [target] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.id, targetId)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });
    await db.insert(userBlocksTable).values({ blockerId: user.id, blockedId: targetId }).onConflictDoNothing();
    await db.delete(userFollowsTable).where(or(
      and(eq(userFollowsTable.followerId, user.id), eq(userFollowsTable.followingId, targetId)),
      and(eq(userFollowsTable.followerId, targetId), eq(userFollowsTable.followingId, user.id)),
    ));
    return res.json({ success: true, status: "blocked" });
  } catch (error) {
    req.log.error(error, "Failed to block user");
    return res.status(500).json({ error: "Failed to block profile" });
  }
});

router.delete("/users/:id/block", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const targetId = req.params.id as string;
    if (!isValidUserId(targetId)) return res.status(400).json({ error: "Invalid user ID" });
    await db.delete(userBlocksTable).where(and(
      eq(userBlocksTable.blockerId, user.id),
      eq(userBlocksTable.blockedId, targetId),
    ));
    return res.json({ success: true, status: "unblocked" });
  } catch (error) {
    req.log.error(error, "Failed to unblock user");
    return res.status(500).json({ error: "Failed to unblock profile" });
  }
});

router.get("/blocked-users", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await db.select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      photoURL: usersTable.photoURL,
      jnvName: usersTable.jnvName,
    }).from(userBlocksTable)
      .innerJoin(usersTable, eq(userBlocksTable.blockedId, usersTable.id))
      .where(eq(userBlocksTable.blockerId, user.id))
      .orderBy(desc(userBlocksTable.createdAt));
    return res.json(rows.map((row) => ({ ...row, photoURL: row.photoURL ?? undefined })));
  } catch (error) {
    req.log.error(error, "Failed to list blocked users");
    return res.status(500).json({ error: "Failed to fetch blocked profiles" });
  }
});

router.get("/social-notifications", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await db.select({
      id: socialNotificationsTable.id,
      type: socialNotificationsTable.type,
      actorId: socialNotificationsTable.actorId,
      actorName: usersTable.fullName,
      entityId: socialNotificationsTable.entityId,
      message: socialNotificationsTable.message,
      createdAt: socialNotificationsTable.createdAt,
      readAt: socialNotificationsTable.readAt,
    }).from(socialNotificationsTable)
      .innerJoin(usersTable, eq(socialNotificationsTable.actorId, usersTable.id))
      .where(eq(socialNotificationsTable.recipientId, user.id))
      .orderBy(desc(socialNotificationsTable.createdAt))
      .limit(100);
    return res.json(rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString(),
    })));
  } catch (error) {
    req.log.error(error, "Failed to list social notifications");
    return res.status(500).json({ error: "Failed to fetch notifications" });
  }
});

export default router;
