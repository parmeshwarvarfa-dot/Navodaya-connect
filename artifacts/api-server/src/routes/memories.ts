import { Router } from "express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  lt,
  or,
  type SQL,
} from "drizzle-orm";
import {
  contentReportsTable,
  db,
  memoriesTable,
  memoryBookmarksTable,
  memoryCommentsTable,
  memoryLikesTable,
  memoryPollVotesTable,
  userBlocksTable,
  userFollowsTable,
  usersTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { canViewProfile, createSocialNotification, hasAcceptedFollow, isBlockedBetween } from "../lib/social-access";

const router = Router();
const POST_TYPES = new Set(["text", "photo", "video", "poll", "achievement", "event"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseStringArray(value: string | null | undefined): string[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function cursorFor(row: typeof memoriesTable.$inferSelect) {
  const createdAt = row.createdAt ?? new Date(0);
  return `${createdAt.toISOString()}|${row.id}`;
}

async function serializeMemories(rows: (typeof memoriesTable.$inferSelect)[], viewerId: string) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.id);
  const authorIds = [...new Set(rows.flatMap((row) => row.authorId ? [row.authorId] : []))];

  const [likes, commentCounts, bookmarks, votes, authors] = await Promise.all([
    db.select({ memoryId: memoryLikesTable.memoryId, userId: memoryLikesTable.userId })
      .from(memoryLikesTable).where(inArray(memoryLikesTable.memoryId, ids)),
    db.select({ memoryId: memoryCommentsTable.memoryId, total: count() })
      .from(memoryCommentsTable).where(inArray(memoryCommentsTable.memoryId, ids))
      .groupBy(memoryCommentsTable.memoryId),
    db.select({ memoryId: memoryBookmarksTable.memoryId })
      .from(memoryBookmarksTable)
      .where(and(inArray(memoryBookmarksTable.memoryId, ids), eq(memoryBookmarksTable.userId, viewerId))),
    db.select({
      memoryId: memoryPollVotesTable.memoryId,
      optionIndex: memoryPollVotesTable.optionIndex,
      userId: memoryPollVotesTable.userId,
    }).from(memoryPollVotesTable).where(inArray(memoryPollVotesTable.memoryId, ids)),
    authorIds.length
      ? db.select({ id: usersTable.id, photoURL: usersTable.photoURL })
        .from(usersTable).where(inArray(usersTable.id, authorIds))
      : Promise.resolve([]),
  ]);

  const likeUsersByMemory = new Map<string, Set<string>>();
  for (const like of likes) {
    const users = likeUsersByMemory.get(like.memoryId) ?? new Set<string>();
    users.add(like.userId);
    likeUsersByMemory.set(like.memoryId, users);
  }
  const commentsByMemory = new Map(commentCounts.map((row) => [row.memoryId, Number(row.total)]));
  const bookmarkedIds = new Set(bookmarks.map((row) => row.memoryId));
  const authorPhotoById = new Map(authors.map((author) => [author.id, author.photoURL]));
  const pollVotesByMemory = new Map<string, Map<number, number>>();
  const viewerVotes = new Map<string, number>();
  for (const vote of votes) {
    const options = pollVotesByMemory.get(vote.memoryId) ?? new Map<number, number>();
    options.set(vote.optionIndex, (options.get(vote.optionIndex) ?? 0) + 1);
    pollVotesByMemory.set(vote.memoryId, options);
    if (vote.userId === viewerId) viewerVotes.set(vote.memoryId, vote.optionIndex);
  }

  return rows.map((row) => {
    const pollOptions = parseStringArray(row.pollOptions);
    const pollCounts = pollVotesByMemory.get(row.id);
    const mediaUrls = parseStringArray(row.mediaUrls);
    if (mediaUrls.length === 0 && row.imageUrl) mediaUrls.push(row.imageUrl);
    return {
      ...row,
      createdAt: (row.createdAt ?? new Date(0)).toISOString(),
      updatedAt: row.updatedAt?.toISOString() ?? null,
      postType: row.postType || "text",
      mediaUrls,
      pollOptions,
      pollVotes: pollOptions.map((_, index) => pollCounts?.get(index) ?? 0),
      viewerVote: viewerVotes.get(row.id),
      commentsEnabled: row.commentsEnabled ?? true,
      likes: likeUsersByMemory.get(row.id)?.size ?? 0,
      commentsCount: commentsByMemory.get(row.id) ?? 0,
      liked: likeUsersByMemory.get(row.id)?.has(viewerId) ?? false,
      bookmarked: bookmarkedIds.has(row.id),
      authorPhotoUrl: row.authorId ? authorPhotoById.get(row.authorId) ?? undefined : undefined,
    };
  });
}

async function getVisibleMemory(memoryId: string, viewerId: string) {
  const [memory] = await db.select().from(memoriesTable)
    .where(eq(memoriesTable.id, memoryId)).limit(1);
  if (!memory) return null;
  if (memory.authorId && memory.authorId !== viewerId) {
    if (await isBlockedBetween(viewerId, memory.authorId)) return null;
    if (!await canViewProfile(viewerId, memory.authorId)) return null;
    if (memory.visibility === "followers" && !await hasAcceptedFollow(viewerId, memory.authorId)) return null;
  }
  return memory;
}

router.get("/memories", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 50));
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
    const postType = typeof req.query.type === "string" && POST_TYPES.has(req.query.type) ? req.query.type : "";
    const filters: SQL[] = [];
    if (search) {
      const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;
      filters.push(or(
        ilike(memoriesTable.caption, pattern),
        ilike(memoriesTable.authorName, pattern),
        ilike(memoriesTable.jnvName, pattern),
      ) as SQL);
    }
    if (postType) filters.push(eq(memoriesTable.postType, postType));

    let cursorBoundary: Date | null = null;
    let cursorId: string | null = null;
    if (typeof req.query.cursor === "string") {
      const [dateValue, idValue] = req.query.cursor.split("|");
      const parsedDate = new Date(dateValue);
      if (!Number.isNaN(parsedDate.getTime()) && UUID_PATTERN.test(idValue ?? "")) {
        cursorBoundary = parsedDate;
        cursorId = idValue;
      }
    }
    if (cursorBoundary && cursorId) {
      filters.push(or(
        lt(memoriesTable.createdAt, cursorBoundary),
        and(eq(memoriesTable.createdAt, cursorBoundary), lt(memoriesTable.id, cursorId)),
      ) as SQL);
    }

    const candidateLimit = Math.min(limit * 5 + 1, 251);
    const candidates = await db.select().from(memoriesTable)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(memoriesTable.createdAt), desc(memoriesTable.id))
      .limit(candidateLimit);

    const authorIds = [...new Set(candidates.flatMap((row) => row.authorId ? [row.authorId] : []))];
    const owners = authorIds.length
      ? await db.select({ id: usersTable.id, profileVisibility: usersTable.profileVisibility })
        .from(usersTable).where(inArray(usersTable.id, authorIds))
      : [];
    const ownerVisibility = new Map(owners.map((owner) => [owner.id, owner.profileVisibility]));
    const [acceptedFollows, blockRows] = authorIds.length
      ? await Promise.all([
          db.select({ followingId: userFollowsTable.followingId })
            .from(userFollowsTable)
            .where(and(
              eq(userFollowsTable.followerId, user.id),
              eq(userFollowsTable.status, "accepted"),
              inArray(userFollowsTable.followingId, authorIds),
            )),
          db.select({
            blockerId: userBlocksTable.blockerId,
            blockedId: userBlocksTable.blockedId,
          }).from(userBlocksTable)
            .where(or(
              and(
                eq(userBlocksTable.blockerId, user.id),
                inArray(userBlocksTable.blockedId, authorIds),
              ),
              and(
                inArray(userBlocksTable.blockerId, authorIds),
                eq(userBlocksTable.blockedId, user.id),
              ),
            )),
        ])
      : [[], []];

    const acceptedIds = new Set(acceptedFollows.map((follow) => follow.followingId));
    const blockedIds = new Set(blockRows.map((block) =>
      block.blockerId === user.id ? block.blockedId : block.blockerId,
    ));
    const visible = candidates.filter((row) => {
      if (!row.authorId || row.authorId === user.id) return true;
      if (!ownerVisibility.has(row.authorId) || blockedIds.has(row.authorId)) return false;
      const accepted = acceptedIds.has(row.authorId);
      if (ownerVisibility.get(row.authorId) === "private" && !accepted) return false;
      return row.visibility !== "followers" || accepted;
    });
    const hasVisibleOverflow = visible.length > limit;
    const items = visible.slice(0, limit);
    const pageCursorRow = hasVisibleOverflow
      ? items[items.length - 1]
      : candidates.length === candidateLimit
        ? candidates[candidates.length - 1]
        : items[items.length - 1];
    const nextCursor = pageCursorRow ? cursorFor(pageCursorRow) : undefined;
    const serialized = await serializeMemories(items, user.id);
    return res.json({
      items: serialized,
      nextCursor,
      hasMore: hasVisibleOverflow || candidates.length === candidateLimit,
    });
  } catch (error) {
    req.log.error(error, "Failed to list memories");
    return res.status(500).json({ error: "Failed to fetch memories" });
  }
});

router.post("/memories", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const caption = typeof req.body.caption === "string" ? req.body.caption.trim() : "";
    const postType = POST_TYPES.has(req.body.postType) ? req.body.postType : "text";
    const mediaUrls = Array.isArray(req.body.mediaUrls)
      ? req.body.mediaUrls.filter((value: unknown): value is string =>
          typeof value === "string" && value.startsWith("https://"),
        ).slice(0, 10)
      : [];
    const pollOptions = Array.isArray(req.body.pollOptions)
      ? req.body.pollOptions.filter((value: unknown): value is string =>
          typeof value === "string" && value.trim().length > 0,
        ).map((value: string) => value.trim().slice(0, 100)).slice(0, 4)
      : [];
    if (!caption || caption.length > 4000) {
      return res.status(400).json({ error: "Add a post description of up to 4,000 characters." });
    }
    if ((postType === "photo" || postType === "video") && mediaUrls.length === 0) {
      return res.status(400).json({ error: "Upload media before sharing this post." });
    }
    if (postType === "poll" && pollOptions.length < 2) {
      return res.status(400).json({ error: "A poll needs at least two options." });
    }
    if (postType !== "poll" && pollOptions.length > 0) {
      return res.status(400).json({ error: "Poll options are only allowed on poll posts." });
    }
    const requestedVisibility = req.body.visibility === "followers" ? "followers" : "public";
    const [row] = await db.insert(memoriesTable).values({
      caption,
      imageUrl: mediaUrls[0] ?? null,
      mediaUrls: JSON.stringify(mediaUrls),
      pollOptions: JSON.stringify(pollOptions),
      postType,
      visibility: requestedVisibility,
      commentsEnabled: req.body.commentsEnabled !== false,
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
      likes: 0,
    }).returning();
    return res.status(201).json((await serializeMemories([row], user.id))[0]);
  } catch (error) {
    req.log.error(error, "Failed to create memory");
    return res.status(500).json({ error: "Failed to post memory" });
  }
});

router.patch("/memories/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    const [memory] = await db.select().from(memoriesTable)
      .where(eq(memoriesTable.id, memoryId)).limit(1);
    if (!memory) return res.status(404).json({ error: "Post not found" });
    if (memory.authorId !== user.id) return res.status(403).json({ error: "Only the author can edit this post." });
    const updates: Partial<typeof memoriesTable.$inferInsert> = { updatedAt: new Date() };
    if (req.body.caption !== undefined) {
      if (typeof req.body.caption !== "string" || !req.body.caption.trim() || req.body.caption.length > 4000) {
        return res.status(400).json({ error: "Post text must be between 1 and 4,000 characters." });
      }
      updates.caption = req.body.caption.trim();
    }
    if (req.body.visibility !== undefined) {
      if (!["public", "followers"].includes(req.body.visibility)) {
        return res.status(400).json({ error: "Choose public or followers-only visibility." });
      }
      updates.visibility = req.body.visibility;
    }
    if (req.body.commentsEnabled !== undefined) updates.commentsEnabled = Boolean(req.body.commentsEnabled);
    const [updated] = await db.update(memoriesTable).set(updates)
      .where(eq(memoriesTable.id, memoryId)).returning();
    return res.json((await serializeMemories([updated], user.id))[0]);
  } catch (error) {
    req.log.error(error, "Failed to update memory");
    return res.status(500).json({ error: "Failed to update post" });
  }
});

router.delete("/memories/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    const [memory] = await db.select().from(memoriesTable)
      .where(eq(memoriesTable.id, memoryId)).limit(1);
    if (!memory) return res.status(404).json({ error: "Post not found" });
    if (memory.authorId !== user.id) return res.status(403).json({ error: "Only the author can delete this post." });
    await db.delete(memoryLikesTable).where(eq(memoryLikesTable.memoryId, memoryId));
    await db.delete(memoryCommentsTable).where(eq(memoryCommentsTable.memoryId, memoryId));
    await db.delete(memoryBookmarksTable).where(eq(memoryBookmarksTable.memoryId, memoryId));
    await db.delete(memoryPollVotesTable).where(eq(memoryPollVotesTable.memoryId, memoryId));
    await db.delete(memoriesTable).where(eq(memoriesTable.id, memoryId));
    return res.json({ success: true, status: "deleted" });
  } catch (error) {
    req.log.error(error, "Failed to delete memory");
    return res.status(500).json({ error: "Failed to delete post" });
  }
});

router.post("/memories/:id/like", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    const memory = await getVisibleMemory(memoryId, user.id);
    if (!memory) return res.status(404).json({ error: "Post not found" });
    const existing = await db.select({ id: memoryLikesTable.id }).from(memoryLikesTable)
      .where(and(eq(memoryLikesTable.memoryId, memoryId), eq(memoryLikesTable.userId, user.id)));
    if (existing.length) {
      await db.delete(memoryLikesTable).where(and(
        eq(memoryLikesTable.memoryId, memoryId),
        eq(memoryLikesTable.userId, user.id),
      ));
    } else {
      await db.insert(memoryLikesTable).values({ memoryId, userId: user.id });
      if (memory.authorId) {
        await createSocialNotification(memory.authorId, user.id, "memory_like", memoryId, `${user.fullName} liked your post.`);
      }
    }
    const current = await db.select({ userId: memoryLikesTable.userId }).from(memoryLikesTable)
      .where(eq(memoryLikesTable.memoryId, memoryId));
    const uniqueLikes = new Set(current.map((like) => like.userId)).size;
    await db.update(memoriesTable).set({ likes: uniqueLikes }).where(eq(memoriesTable.id, memoryId));
    return res.json({ liked: existing.length === 0, likes: uniqueLikes });
  } catch (error) {
    req.log.error(error, "Failed to toggle memory like");
    return res.status(500).json({ error: "Failed to update like" });
  }
});

router.get("/memories/:id/comments", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    if (!await getVisibleMemory(memoryId, user.id)) return res.status(404).json({ error: "Post not found" });
    const rows = await db.select({
      id: memoryCommentsTable.id,
      memoryId: memoryCommentsTable.memoryId,
      authorId: memoryCommentsTable.authorId,
      authorName: memoryCommentsTable.authorName,
      authorPhotoUrl: usersTable.photoURL,
      parentId: memoryCommentsTable.parentId,
      content: memoryCommentsTable.content,
      createdAt: memoryCommentsTable.createdAt,
    }).from(memoryCommentsTable)
      .leftJoin(usersTable, eq(memoryCommentsTable.authorId, usersTable.id))
      .where(eq(memoryCommentsTable.memoryId, memoryId))
      .orderBy(asc(memoryCommentsTable.createdAt));
    return res.json(rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      authorPhotoUrl: row.authorPhotoUrl ?? undefined,
    })));
  } catch (error) {
    req.log.error(error, "Failed to list memory comments");
    return res.status(500).json({ error: "Failed to fetch comments" });
  }
});

router.post("/memories/:id/comments", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > 2000) return res.status(400).json({ error: "Comment must be between 1 and 2,000 characters." });
    const memory = await getVisibleMemory(memoryId, user.id);
    if (!memory) return res.status(404).json({ error: "Post not found" });
    if (!memory.commentsEnabled) return res.status(403).json({ error: "Comments are disabled for this post." });
    let parentId: string | null = null;
    if (req.body.parentId !== undefined && req.body.parentId !== null) {
      if (typeof req.body.parentId !== "string" || !UUID_PATTERN.test(req.body.parentId)) {
        return res.status(400).json({ error: "Invalid reply target." });
      }
      const [parent] = await db.select({ id: memoryCommentsTable.id }).from(memoryCommentsTable)
        .where(and(
          eq(memoryCommentsTable.id, req.body.parentId),
          eq(memoryCommentsTable.memoryId, memoryId),
        )).limit(1);
      if (!parent) return res.status(404).json({ error: "Comment not found" });
      parentId = parent.id;
    }
    const [row] = await db.insert(memoryCommentsTable).values({
      memoryId,
      authorId: user.id,
      authorName: user.fullName,
      parentId,
      content,
    }).returning();
    if (memory.authorId) {
      await createSocialNotification(memory.authorId, user.id, "memory_comment", memoryId, `${user.fullName} commented on your post.`);
    }
    return res.status(201).json({
      ...row,
      createdAt: (row.createdAt ?? new Date()).toISOString(),
      authorPhotoUrl: user.photoURL ?? undefined,
    });
  } catch (error) {
    req.log.error(error, "Failed to create memory comment");
    return res.status(500).json({ error: "Failed to add comment" });
  }
});

router.post("/memories/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    if (!await getVisibleMemory(memoryId, user.id)) return res.status(404).json({ error: "Post not found" });
    const [bookmark] = await db.select({ id: memoryBookmarksTable.id }).from(memoryBookmarksTable)
      .where(and(eq(memoryBookmarksTable.memoryId, memoryId), eq(memoryBookmarksTable.userId, user.id)))
      .limit(1);
    if (bookmark) {
      await db.delete(memoryBookmarksTable).where(eq(memoryBookmarksTable.id, bookmark.id));
      return res.json({ success: true, status: "removed" });
    }
    await db.insert(memoryBookmarksTable).values({ memoryId, userId: user.id });
    return res.json({ success: true, status: "bookmarked" });
  } catch (error) {
    req.log.error(error, "Failed to toggle memory bookmark");
    return res.status(500).json({ error: "Failed to update bookmark" });
  }
});

router.post("/memories/:id/poll-votes", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    const memory = await getVisibleMemory(memoryId, user.id);
    if (!memory || memory.postType !== "poll") return res.status(404).json({ error: "Poll not found" });
    const options = parseStringArray(memory.pollOptions);
    const optionIndex = Number(req.body.optionIndex);
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= options.length) {
      return res.status(400).json({ error: "Choose a valid poll option." });
    }
    const [existing] = await db.select({ id: memoryPollVotesTable.id }).from(memoryPollVotesTable)
      .where(and(eq(memoryPollVotesTable.memoryId, memoryId), eq(memoryPollVotesTable.userId, user.id)))
      .limit(1);
    if (existing) {
      await db.update(memoryPollVotesTable).set({ optionIndex })
        .where(eq(memoryPollVotesTable.id, existing.id));
    } else {
      await db.insert(memoryPollVotesTable).values({ memoryId, userId: user.id, optionIndex });
    }
    const votes = await db.select({ optionIndex: memoryPollVotesTable.optionIndex })
      .from(memoryPollVotesTable).where(eq(memoryPollVotesTable.memoryId, memoryId));
    const pollVotes = options.map((_, index) => votes.filter((vote) => vote.optionIndex === index).length);
    return res.json({ pollVotes, viewerVote: optionIndex });
  } catch (error) {
    req.log.error(error, "Failed to vote in memory poll");
    return res.status(500).json({ error: "Failed to submit vote" });
  }
});

router.post("/memories/:id/report", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const memoryId = req.params.id as string;
    const reason = typeof req.body.reason === "string" ? req.body.reason.trim().slice(0, 100) : "";
    const details = typeof req.body.details === "string" ? req.body.details.trim().slice(0, 1000) : "";
    const memory = await getVisibleMemory(memoryId, user.id);
    if (!memory) return res.status(404).json({ error: "Post not found" });
    if (memory.authorId === user.id) return res.status(400).json({ error: "You cannot report your own post." });
    if (!reason) return res.status(400).json({ error: "Choose a reason for the report." });
    await db.insert(contentReportsTable).values({
      reporterId: user.id,
      targetUserId: memory.authorId ?? null,
      memoryId,
      reason,
      details: details || null,
    });
    return res.status(201).json({ success: true, status: "submitted" });
  } catch (error) {
    req.log.error(error, "Failed to report memory");
    return res.status(500).json({ error: "Failed to submit report" });
  }
});

export default router;
