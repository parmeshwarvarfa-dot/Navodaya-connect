import { Router, type Request, type Response } from "express";
import { and, count, desc, eq, gte, ilike, inArray, lt, or } from "drizzle-orm";
import {
  db,
  memoriesTable,
  memoryBookmarksTable,
  memoryCommentsTable,
  memoryLikesTable,
  navodayanTalksTable,
  talkModerationAuditTable,
  userBlocksTable,
  userFollowsTable,
  usersTable,
} from "@workspace/db";
import { getUser, requireAuth, isAuthorizedSchoolStaff } from "../lib/auth";
import { createSocialNotification } from "../lib/social-access";
import {
  isOwnedMemoryMediaKey,
  MemoryMediaError,
  parseStoredMemoryMedia,
  signMemoryMedia,
  validateOwnedMemoryMedia,
  type StoredMemoryMedia,
} from "../lib/memory-media";

const router = Router();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CATEGORIES = new Set([
  "Career Journey", "Education", "Entrepreneurship", "Community Service", "Personal Growth", "Other",
]);
const SPAM_URL_PATTERN = /(https?:\/\/|www\.)\S+/gi;
const REPEATED_CHAR_PATTERN = /(.)\1{14,}/;

type TalkRow = {
  talk: typeof navodayanTalksTable.$inferSelect;
  memory: typeof memoriesTable.$inferSelect;
  author: typeof usersTable.$inferSelect;
};

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function cleanText(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : null;
}

function cleanTopics(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 6) return null;
  const topics = value.map((topic) => (typeof topic === "string" ? topic.trim() : ""));
  if (topics.some((topic) => topic.length < 1 || topic.length > 32)) return null;
  return [...new Set(topics)];
}

function runAutomatedSafetyCheck(title: string, body: string): string | null {
  const combined = `${title}\n${body}`;
  const urls = combined.match(SPAM_URL_PATTERN) ?? [];
  if (urls.length > 4) {
    return "Your Talk contains too many external links. Please keep external links to 4 or fewer.";
  }
  if (REPEATED_CHAR_PATTERN.test(combined)) {
    return "Please remove excessive repeated characters before publishing.";
  }
  return null;
}

async function serializeTalks(rows: TalkRow[], viewerId: string) {
  const memoryIds = rows.map(({ memory }) => memory.id);
  if (!memoryIds.length) return [];
  const [likes, bookmarks, comments] = await Promise.all([
    db.select({ memoryId: memoryLikesTable.memoryId, userId: memoryLikesTable.userId })
      .from(memoryLikesTable).where(inArray(memoryLikesTable.memoryId, memoryIds)),
    db.select({ memoryId: memoryBookmarksTable.memoryId })
      .from(memoryBookmarksTable).where(and(
        inArray(memoryBookmarksTable.memoryId, memoryIds),
        eq(memoryBookmarksTable.userId, viewerId),
      )),
    db.select({ memoryId: memoryCommentsTable.memoryId, total: count() })
      .from(memoryCommentsTable).where(inArray(memoryCommentsTable.memoryId, memoryIds))
      .groupBy(memoryCommentsTable.memoryId),
  ]);
  const likedIds = new Set(likes.filter((like) => like.userId === viewerId).map((like) => like.memoryId));
  const likeCounts = new Map<string, number>();
  for (const like of likes) likeCounts.set(like.memoryId, (likeCounts.get(like.memoryId) ?? 0) + 1);
  const bookmarkedIds = new Set(bookmarks.map((bookmark) => bookmark.memoryId));
  const commentCounts = new Map(comments.map((row) => [row.memoryId, Number(row.total)]));

  return Promise.all(rows.map(async ({ talk, memory, author }) => {
    const storedMedia = parseStoredMemoryMedia(memory.mediaUrls);
    const media = await Promise.all(storedMedia.map(async (item) => {
      if (typeof item === "string") return { url: item, mediaType: "image" as const };
      return { url: await signMemoryMedia(item, talk.authorId), mediaType: item.mediaType };
    }));
    return {
      id: talk.id,
      memoryId: memory.id,
      title: talk.title,
      storyType: talk.storyType,
      category: talk.category,
      topics: talk.topics,
      career: talk.career,
      batch: talk.batch,
      visibility: memory.visibility,
      status: talk.status,
      moderationFeedback: talk.authorId === viewerId ? talk.moderationFeedback : null,
      body: memory.caption ?? "",
      media: media.filter((item) => item.url),
      author: {
        id: author.id,
        name: author.fullName,
        photoUrl: author.photoURL,
        jnvName: author.jnvName,
        role: author.role,
        profession: author.profession,
        passoutYear: author.passoutYear,
      },
      likes: likeCounts.get(memory.id) ?? 0,
      liked: likedIds.has(memory.id),
      bookmarked: bookmarkedIds.has(memory.id),
      commentsCount: commentCounts.get(memory.id) ?? 0,
      createdAt: (talk.publishedAt ?? talk.createdAt).toISOString(),
    };
  }));
}

async function fetchTalkRows(where: ReturnType<typeof and>, limit = 30): Promise<TalkRow[]> {
  return db.select({ talk: navodayanTalksTable, memory: memoriesTable, author: usersTable })
    .from(navodayanTalksTable)
    .innerJoin(memoriesTable, eq(navodayanTalksTable.memoryId, memoriesTable.id))
    .innerJoin(usersTable, eq(navodayanTalksTable.authorId, usersTable.id))
    .where(where)
    .orderBy(desc(navodayanTalksTable.createdAt))
    .limit(limit);
}

async function requireModerator(req: Request, res: Response) {
  const user = getUser(req);
  if (!await isAuthorizedSchoolStaff(user)) {
    res.status(403).json({ error: "Only verified school staff can moderate Navodayan Talks." });
    return null;
  }
  return user;
}

router.get("/talks", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 80) : "";
    const category = typeof req.query.category === "string" && CATEGORIES.has(req.query.category)
      ? req.query.category
      : "";
    const cursor = typeof req.query.cursor === "string" ? req.query.cursor : "";
    let cursorDate: Date | null = null;
    let cursorId: string | null = null;
    if (cursor) {
      const [dateValue, idValue] = cursor.split("|");
      const parsedDate = new Date(dateValue);
      if (Number.isNaN(parsedDate.getTime()) || !isUuid(idValue)) {
        return res.status(400).json({ error: "Invalid Talk feed cursor." });
      }
      cursorDate = parsedDate;
      cursorId = idValue;
    }
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 30));
    const filters = [
      inArray(navodayanTalksTable.status, ["approved", "published"]),
      or(
        eq(memoriesTable.visibility, "public"),
        eq(navodayanTalksTable.authorId, user.id),
        and(
          eq(memoriesTable.visibility, "followers"),
          inArray(
            navodayanTalksTable.authorId,
            db.select({ followingId: userFollowsTable.followingId })
              .from(userFollowsTable)
              .where(and(eq(userFollowsTable.followerId, user.id), eq(userFollowsTable.status, "accepted"))),
          ),
        ),
      )!,
      or(eq(usersTable.profileVisibility, "public"), eq(usersTable.id, user.id))!,
    ];
    if (category) filters.push(eq(navodayanTalksTable.category, category));
    if (cursorDate && cursorId) {
      filters.push(or(
        lt(navodayanTalksTable.createdAt, cursorDate),
        and(eq(navodayanTalksTable.createdAt, cursorDate), lt(navodayanTalksTable.id, cursorId)),
      )!);
    }
    if (search) {
      const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;
      filters.push(or(
        ilike(navodayanTalksTable.title, pattern),
        ilike(memoriesTable.caption, pattern),
        ilike(navodayanTalksTable.category, pattern),
      )!);
    }
    let rows = await fetchTalkRows(and(...filters), limit + 1);
    const hasMore = rows.length > limit;
    const cursorRow = rows[Math.min(limit, rows.length) - 1];
    rows = rows.slice(0, limit);
    const authorIds = [...new Set(rows.filter((row) => row.author.id !== user.id).map((row) => row.author.id))];
    if (authorIds.length) {
      const blocked = await db.select({
        blockerId: userBlocksTable.blockerId,
        blockedId: userBlocksTable.blockedId,
      }).from(userBlocksTable).where(or(
        and(eq(userBlocksTable.blockerId, user.id), inArray(userBlocksTable.blockedId, authorIds)),
        and(inArray(userBlocksTable.blockerId, authorIds), eq(userBlocksTable.blockedId, user.id)),
      ));
      const blockedIds = new Set(blocked.map((entry) =>
        entry.blockerId === user.id ? entry.blockedId : entry.blockerId,
      ));
      rows = rows.filter((row) => !blockedIds.has(row.author.id));
    }
    return res.json({
      items: await serializeTalks(rows, user.id),
      nextCursor: hasMore && cursorRow
        ? `${cursorRow.talk.createdAt.toISOString()}|${cursorRow.talk.id}`
        : undefined,
      hasMore,
    });
  } catch (error) {
    req.log.error(error, "Failed to fetch Navodayan Talks");
    return res.status(500).json({ error: "Could not load Navodayan Talks." });
  }
});

router.get("/talks/mine", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await fetchTalkRows(and(eq(navodayanTalksTable.authorId, user.id)), 50);
    return res.json(await serializeTalks(rows, user.id));
  } catch (error) {
    req.log.error(error, "Failed to fetch user's Navodayan Talks");
    return res.status(500).json({ error: "Could not load your submissions." });
  }
});

router.post("/talks", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const submissionKey = req.body?.submissionKey;
    const title = cleanText(req.body?.title, 5, 120);
    const body = cleanText(req.body?.body, 30, 8000);
    const category = typeof req.body?.category === "string" && CATEGORIES.has(req.body.category)
      ? req.body.category
      : null;
    const topics = cleanTopics(req.body?.topics);
    const storyType = req.body?.storyType;
    const mediaKey = req.body?.mediaKey;
    const career = req.body?.career == null ? null : cleanText(req.body.career, 1, 100);
    const batch = req.body?.batch == null ? null : cleanText(req.body.batch, 1, 40);
    const visibility = req.body?.visibility === "followers" ? "followers" : "public";
    const saveAsDraft = req.body?.saveAsDraft === true;

    if (!isUuid(submissionKey) || !title || !body || !category || !topics ||
      !["written", "video"].includes(storyType) ||
      (req.body?.career != null && !career) || (req.body?.batch != null && !batch)) {
      return res.status(400).json({ error: "Check the title, story, category, topics, and submission details." });
    }
    if (!saveAsDraft && (req.body?.consentConfirmed !== true || req.body?.rightsConfirmed !== true)) {
      return res.status(400).json({ error: "Confirm the permissions and content rights before publishing." });
    }
    if ((!saveAsDraft && storyType === "video" && typeof mediaKey !== "string") ||
      (mediaKey != null && (typeof mediaKey !== "string" || !isOwnedMemoryMediaKey(user.id, mediaKey)))) {
      return res.status(400).json({ error: "Choose a valid video or image upload." });
    }

    // Automated safety & spam check before automatic publishing
    if (!saveAsDraft) {
      const safetyIssue = runAutomatedSafetyCheck(title, body);
      if (safetyIssue) {
        return res.status(400).json({ error: safetyIssue });
      }
      // Simple rate limit: max 5 published Talks per hour per user
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const [{ recentCount }] = await db
        .select({ recentCount: count() })
        .from(navodayanTalksTable)
        .where(and(
          eq(navodayanTalksTable.authorId, user.id),
          eq(navodayanTalksTable.status, "published"),
          gte(navodayanTalksTable.createdAt, oneHourAgo),
        ));
      if (Number(recentCount) >= 5) {
        return res.status(429).json({ error: "You have published several Talks recently. Please wait a little before publishing another." });
      }
    }

    const existing = await db.select().from(navodayanTalksTable).where(and(
      eq(navodayanTalksTable.authorId, user.id),
      eq(navodayanTalksTable.submissionKey, submissionKey),
    )).limit(1);
    if (existing[0]) {
      return res.status(200).json({ id: existing[0].id, memoryId: existing[0].memoryId, status: existing[0].status, duplicate: true });
    }

    let media: StoredMemoryMedia | null = null;
    if (typeof mediaKey === "string") {
      media = await validateOwnedMemoryMedia(user.id, mediaKey);
      if ((storyType === "video" && media.mediaType !== "video") ||
        (storyType === "written" && media.mediaType !== "image")) {
        return res.status(400).json({ error: storyType === "video" ? "Choose a video for a video story." : "A written story can only include an image." });
      }
    }

    const now = new Date();
    const nextStatus = saveAsDraft ? "draft" : "published";
    const result = await db.transaction(async (tx) => {
      const [memory] = await tx.insert(memoriesTable).values({
        caption: body,
        authorId: user.id,
        authorName: user.fullName,
        jnvName: user.jnvName,
        postType: storyType === "video" ? "video" : "text",
        mediaUrls: JSON.stringify(media ? [media] : []),
        visibility,
        commentsEnabled: true,
      }).returning();
      const [talk] = await tx.insert(navodayanTalksTable).values({
        memoryId: memory.id,
        authorId: user.id,
        submissionKey,
        title,
        storyType,
        category,
        topics,
        career,
        batch,
        status: nextStatus,
        consentConfirmed: req.body?.consentConfirmed === true,
        rightsConfirmed: req.body?.rightsConfirmed === true,
        publishedAt: saveAsDraft ? null : now,
      }).onConflictDoNothing().returning();
      if (!talk) {
        await tx.delete(memoriesTable).where(eq(memoriesTable.id, memory.id));
        const [duplicate] = await tx.select().from(navodayanTalksTable).where(and(
          eq(navodayanTalksTable.authorId, user.id),
          eq(navodayanTalksTable.submissionKey, submissionKey),
        )).limit(1);
        return duplicate ? { id: duplicate.id, memoryId: duplicate.memoryId, status: duplicate.status, duplicate: true } : null;
      }
      return { id: talk.id, memoryId: memory.id, status: talk.status, duplicate: false };
    });
    if (!result) return res.status(409).json({ error: "This submission could not be saved. Please try again." });
    return res.status(result.duplicate ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error, "Failed to publish Navodayan Talk");
    return res.status(500).json({ error: "Could not publish your story." });
  }
});

router.patch("/talks/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid Talk ID." });
    const [existing] = await db.select({ talk: navodayanTalksTable, memory: memoriesTable })
      .from(navodayanTalksTable)
      .innerJoin(memoriesTable, eq(navodayanTalksTable.memoryId, memoriesTable.id))
      .where(and(eq(navodayanTalksTable.id, req.params.id), eq(navodayanTalksTable.authorId, user.id)))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Submission not found." });
    if (["removed", "rejected"].includes(existing.talk.status)) {
      return res.status(409).json({ error: "This Talk is no longer available for editing." });
    }
    const title = cleanText(req.body?.title, 5, 120);
    const body = cleanText(req.body?.body, 30, 8000);
    const category = typeof req.body?.category === "string" && CATEGORIES.has(req.body.category)
      ? req.body.category
      : null;
    const topics = cleanTopics(req.body?.topics);
    const visibility = req.body?.visibility === "followers" ? "followers" : existing.memory.visibility;
    const saveAsDraft = req.body?.saveAsDraft === true;
    if (!title || !body || !category || !topics) {
      return res.status(400).json({ error: "Check the title, story, category, and topics." });
    }
    if (!saveAsDraft && (req.body?.consentConfirmed !== true || req.body?.rightsConfirmed !== true)) {
      return res.status(400).json({ error: "Confirm the permissions and content rights before publishing." });
    }
    if (!saveAsDraft) {
      const safetyIssue = runAutomatedSafetyCheck(title, body);
      if (safetyIssue) return res.status(400).json({ error: safetyIssue });
    }

    const now = new Date();
    const nextStatus = saveAsDraft ? "draft" : "published";
    await db.transaction(async (tx) => {
      await tx.update(memoriesTable).set({ caption: body, visibility, updatedAt: now })
        .where(eq(memoriesTable.id, existing.memory.id));
      await tx.update(navodayanTalksTable).set({
        title,
        category,
        topics,
        status: nextStatus,
        consentConfirmed: req.body?.consentConfirmed === true,
        rightsConfirmed: req.body?.rightsConfirmed === true,
        publishedAt: saveAsDraft ? null : (existing.talk.publishedAt ?? now),
        moderationFeedback: null,
        moderatorId: null,
        updatedAt: now,
      }).where(eq(navodayanTalksTable.id, existing.talk.id));
    });
    return res.json({ id: existing.talk.id, status: nextStatus });
  } catch (error) {
    req.log.error(error, "Failed to update Navodayan Talk");
    return res.status(500).json({ error: "Could not update your story." });
  }
});

router.get("/talks/moderation", requireAuth, async (req, res) => {
  try {
    const user = await requireModerator(req, res);
    if (!user) return;
    const rows = await fetchTalkRows(and(
      eq(usersTable.jnvName, user.jnvName),
      inArray(navodayanTalksTable.status, ["published", "removed", "submitted", "under_review", "approved"]),
    ), 50);
    return res.json(await serializeTalks(rows, user.id));
  } catch (error) {
    req.log.error(error, "Failed to fetch Talk moderation queue");
    return res.status(500).json({ error: "Could not load the moderation queue." });
  }
});

router.patch("/talks/:id/moderate", requireAuth, async (req, res) => {
  try {
    const moderator = await requireModerator(req, res);
    if (!moderator) return;
    if (!isUuid(req.params.id)) return res.status(400).json({ error: "Invalid Talk ID." });
    const action = req.body?.action;
    const reason = cleanText(req.body?.reason, 3, 1000);
    if (!["start_review", "request_changes", "approve", "reject", "publish", "remove", "restore"].includes(action) || !reason) {
      return res.status(400).json({ error: "Choose a valid moderation action and provide a reason." });
    }
    const [row] = await db.select({ talk: navodayanTalksTable, author: usersTable })
      .from(navodayanTalksTable)
      .innerJoin(usersTable, eq(navodayanTalksTable.authorId, usersTable.id))
      .where(eq(navodayanTalksTable.id, req.params.id))
      .limit(1);
    if (!row) return res.status(404).json({ error: "Talk not found." });
    if (row.author.id === moderator.id) return res.status(403).json({ error: "Authors cannot moderate their own Talks." });
    if (row.author.jnvName !== moderator.jnvName) return res.status(404).json({ error: "Talk not found." });

    const transitions: Record<string, { from: string[]; to: string }> = {
      start_review: { from: ["submitted"], to: "under_review" },
      request_changes: { from: ["submitted", "under_review", "published"], to: "changes_requested" },
      approve: { from: ["submitted", "under_review"], to: "approved" },
      reject: { from: ["submitted", "under_review"], to: "rejected" },
      publish: { from: ["approved"], to: "published" },
      remove: { from: ["published", "approved"], to: "removed" },
      restore: { from: ["removed"], to: "published" },
    };
    const transition = transitions[action as string];
    if (!transition || !transition.from.includes(row.talk.status)) {
      return res.status(409).json({ error: "That moderation action is not available for this Talk's current status." });
    }
    const now = new Date();
    await db.transaction(async (tx) => {
      await tx.update(navodayanTalksTable).set({
        status: transition.to,
        moderatorId: moderator.id,
        moderationFeedback: ["request_changes", "reject", "remove"].includes(action) ? reason : null,
        updatedAt: now,
        ...(action === "publish" || action === "restore" ? { publishedAt: now } : {}),
        ...(action === "remove" ? { publishedAt: null } : {}),
      }).where(eq(navodayanTalksTable.id, row.talk.id));
      await tx.insert(talkModerationAuditTable).values({
        talkId: row.talk.id,
        moderatorId: moderator.id,
        action,
        reason,
      });
    });

    if (action === "remove") {
      await createSocialNotification(
        row.author.id,
        moderator.id,
        "talk_removed",
        row.talk.id,
        `Your Navodayan Talk "${row.talk.title}" was removed by a moderator: ${reason}`,
      ).catch(() => {});
    } else if (action === "restore") {
      await createSocialNotification(
        row.author.id,
        moderator.id,
        "talk_restored",
        row.talk.id,
        `Your Navodayan Talk "${row.talk.title}" has been restored and is visible again.`,
      ).catch(() => {});
    }

    return res.json({ id: row.talk.id, status: transition.to });
  } catch (error) {
    req.log.error(error, "Failed to moderate Navodayan Talk");
    return res.status(500).json({ error: "Could not update this Talk." });
  }
});

export default router;
