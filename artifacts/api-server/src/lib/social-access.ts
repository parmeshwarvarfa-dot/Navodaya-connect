import { and, eq, or } from "drizzle-orm";
import {
  db,
  socialNotificationsTable,
  userBlocksTable,
  userFollowsTable,
  usersTable,
} from "@workspace/db";

export async function isBlockedBetween(firstUserId: string, secondUserId: string) {
  const [block] = await db.select({ id: userBlocksTable.id }).from(userBlocksTable)
    .where(or(
      and(eq(userBlocksTable.blockerId, firstUserId), eq(userBlocksTable.blockedId, secondUserId)),
      and(eq(userBlocksTable.blockerId, secondUserId), eq(userBlocksTable.blockedId, firstUserId)),
    ))
    .limit(1);
  return Boolean(block);
}

export async function hasAcceptedFollow(followerId: string, followingId: string) {
  const [follow] = await db.select({ id: userFollowsTable.id }).from(userFollowsTable)
    .where(and(
      eq(userFollowsTable.followerId, followerId),
      eq(userFollowsTable.followingId, followingId),
      eq(userFollowsTable.status, "accepted"),
    ))
    .limit(1);
  return Boolean(follow);
}

export async function canViewProfile(viewerId: string, targetId: string) {
  if (viewerId === targetId) return true;
  if (await isBlockedBetween(viewerId, targetId)) return false;

  const [target] = await db.select({
    profileVisibility: usersTable.profileVisibility,
  }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target) return false;
  if (target.profileVisibility !== "private") return true;
  return hasAcceptedFollow(viewerId, targetId);
}

export async function createSocialNotification(
  recipientId: string,
  actorId: string,
  type: string,
  entityId: string | null,
  message: string,
) {
  if (recipientId === actorId) return;
  await db.insert(socialNotificationsTable).values({
    recipientId,
    actorId,
    type,
    entityId,
    message,
  });
}
