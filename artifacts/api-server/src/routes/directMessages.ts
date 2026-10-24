import { Router } from "express";
import { and, desc, eq, inArray, or } from "drizzle-orm";
import {
  db,
  directConversationsTable,
  directMessagesTable,
  directMessageRequestsTable,
  usersTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { createSocialNotification, isBlockedBetween } from "../lib/social-access";
import { isValidUserId } from "./user-validation";

const router = Router();
const typingStore: Map<string, Map<string, { name: string; expiresAt: number }>> = new Map();

function cleanTyping(conversationId: string) {
  const conversation = typingStore.get(conversationId);
  if (!conversation) return;
  const now = Date.now();
  for (const [userId, entry] of conversation) if (entry.expiresAt <= now) conversation.delete(userId);
}

async function getConversation(conversationId: string, userId: string) {
  const [conversation] = await db.select().from(directConversationsTable).where(and(
    eq(directConversationsTable.id, conversationId),
    or(eq(directConversationsTable.userOneId, userId), eq(directConversationsTable.userTwoId, userId)),
  )).limit(1);
  return conversation;
}

async function getOrCreateConversation(firstId: string, secondId: string) {
  const [userOneId, userTwoId] = [firstId, secondId].sort();
  let [conversation] = await db.select().from(directConversationsTable)
    .where(and(
      eq(directConversationsTable.userOneId, userOneId),
      eq(directConversationsTable.userTwoId, userTwoId),
    )).limit(1);
  if (conversation) return conversation;
  const [created] = await db.insert(directConversationsTable)
    .values({ userOneId, userTwoId })
    .onConflictDoNothing()
    .returning();
  if (created) return created;
  [conversation] = await db.select().from(directConversationsTable)
    .where(and(
      eq(directConversationsTable.userOneId, userOneId),
      eq(directConversationsTable.userTwoId, userTwoId),
    )).limit(1);
  if (!conversation) throw new Error("Could not create direct conversation");
  return conversation;
}

router.post("/direct-message-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const recipientId = typeof req.body.recipientId === "string" ? req.body.recipientId : "";
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!isValidUserId(recipientId)) return res.status(400).json({ error: "Invalid recipient." });
    if (recipientId === user.id) return res.status(400).json({ error: "You cannot message yourself." });
    if (!content || content.length > 2000) return res.status(400).json({ error: "Message must be between 1 and 2,000 characters." });
    if (await isBlockedBetween(user.id, recipientId)) return res.status(404).json({ error: "User not found" });
    const [recipient] = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.id, recipientId)).limit(1);
    if (!recipient) return res.status(404).json({ error: "User not found" });
    const [conversation] = await db.select({ id: directConversationsTable.id })
      .from(directConversationsTable).where(or(
        and(eq(directConversationsTable.userOneId, user.id), eq(directConversationsTable.userTwoId, recipientId)),
        and(eq(directConversationsTable.userOneId, recipientId), eq(directConversationsTable.userTwoId, user.id)),
      )).limit(1);
    if (conversation) return res.status(409).json({ error: "A conversation already exists. Continue it from your messages." });
    const [pending] = await db.select({ id: directMessageRequestsTable.id })
      .from(directMessageRequestsTable).where(and(
        eq(directMessageRequestsTable.senderId, user.id),
        eq(directMessageRequestsTable.recipientId, recipientId),
        eq(directMessageRequestsTable.status, "pending"),
      )).limit(1);
    if (pending) return res.status(409).json({ error: "You already have a pending request for this person." });

    const [request] = await db.insert(directMessageRequestsTable).values({
      senderId: user.id,
      recipientId,
      content,
      status: "pending",
    }).returning();
    await createSocialNotification(
      recipientId,
      user.id,
      "direct_message_request",
      request.id,
      `${user.fullName} sent you a message request.`,
    );
    return res.status(201).json({
      ...request,
      createdAt: request.createdAt.toISOString(),
      senderName: user.fullName,
    });
  } catch (error) {
    req.log.error(error, "Failed to create direct message request");
    return res.status(500).json({ error: "Failed to send message request" });
  }
});

router.get("/direct-message-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await db.select({
      id: directMessageRequestsTable.id,
      senderId: directMessageRequestsTable.senderId,
      senderName: usersTable.fullName,
      recipientId: directMessageRequestsTable.recipientId,
      content: directMessageRequestsTable.content,
      status: directMessageRequestsTable.status,
      createdAt: directMessageRequestsTable.createdAt,
    }).from(directMessageRequestsTable)
      .innerJoin(usersTable, eq(directMessageRequestsTable.senderId, usersTable.id))
      .where(and(
        eq(directMessageRequestsTable.recipientId, user.id),
        eq(directMessageRequestsTable.status, "pending"),
      ))
      .orderBy(desc(directMessageRequestsTable.createdAt));
    return res.json(rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() })));
  } catch (error) {
    req.log.error(error, "Failed to list direct message requests");
    return res.status(500).json({ error: "Failed to fetch message requests" });
  }
});

router.patch("/direct-message-requests/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const requestId = req.params.id as string;
    const decision = req.body.decision;
    if (decision !== "accept" && decision !== "decline") {
      return res.status(400).json({ error: "Choose accept or decline." });
    }
    const [request] = await db.select().from(directMessageRequestsTable)
      .where(and(
        eq(directMessageRequestsTable.id, requestId),
        eq(directMessageRequestsTable.recipientId, user.id),
        eq(directMessageRequestsTable.status, "pending"),
      )).limit(1);
    if (!request) return res.status(404).json({ error: "Message request not found" });
    if (await isBlockedBetween(user.id, request.senderId)) {
      await db.update(directMessageRequestsTable)
        .set({ status: "declined", updatedAt: new Date() })
        .where(eq(directMessageRequestsTable.id, requestId));
      return res.json({ success: true, status: "declined" });
    }

    if (decision === "decline") {
      await db.update(directMessageRequestsTable)
        .set({ status: "declined", updatedAt: new Date() })
        .where(eq(directMessageRequestsTable.id, requestId));
      return res.json({ success: true, status: "declined" });
    }

    const conversation = await getOrCreateConversation(user.id, request.senderId);
    await db.insert(directMessagesTable).values({
      conversationId: conversation.id,
      senderId: request.senderId,
      content: request.content,
    });
    await db.update(directConversationsTable)
      .set({ updatedAt: new Date() })
      .where(eq(directConversationsTable.id, conversation.id));
    await db.update(directMessageRequestsTable).set({
      status: "accepted",
      conversationId: conversation.id,
      updatedAt: new Date(),
    }).where(eq(directMessageRequestsTable.id, requestId));
    await createSocialNotification(
      request.senderId,
      user.id,
      "direct_message_accepted",
      conversation.id,
      `${user.fullName} accepted your message request.`,
    );
    return res.json({ success: true, status: "accepted" });
  } catch (error) {
    req.log.error(error, "Failed to decide direct message request");
    return res.status(500).json({ error: "Failed to update message request" });
  }
});

router.get("/direct-conversations", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const conversations = await db.select().from(directConversationsTable)
      .where(or(
        eq(directConversationsTable.userOneId, user.id),
        eq(directConversationsTable.userTwoId, user.id),
      ))
      .orderBy(desc(directConversationsTable.updatedAt))
      .limit(100);
    const peers = [...new Set(conversations.map((conversation) =>
      conversation.userOneId === user.id ? conversation.userTwoId : conversation.userOneId,
    ))];
    if (!peers.length) return res.json([]);
    const [users, messages] = await Promise.all([
      db.select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        photoURL: usersTable.photoURL,
      }).from(usersTable).where(inArray(usersTable.id, peers)),
      db.select().from(directMessagesTable)
        .where(inArray(directMessagesTable.conversationId, conversations.map((conversation) => conversation.id)))
        .orderBy(desc(directMessagesTable.createdAt)),
    ]);
    const userById = new Map(users.map((peer) => [peer.id, peer]));
    const latestMessageByConversation = new Map<string, string>();
    const unreadByConversation = new Map<string, number>();
    for (const message of messages) {
      if (!latestMessageByConversation.has(message.conversationId)) {
        latestMessageByConversation.set(message.conversationId, message.content);
      }
      if (message.senderId !== user.id && !message.readAt) {
        unreadByConversation.set(message.conversationId, (unreadByConversation.get(message.conversationId) ?? 0) + 1);
      }
    }
    return res.json(conversations.flatMap((conversation) => {
      const peerId = conversation.userOneId === user.id ? conversation.userTwoId : conversation.userOneId;
      const peer = userById.get(peerId);
      if (!peer) return [];
      return [{
        id: conversation.id,
        peerId,
        peerName: peer.fullName,
        peerPhotoUrl: peer.photoURL ?? undefined,
        lastMessage: latestMessageByConversation.get(conversation.id) ?? "",
        unreadCount: unreadByConversation.get(conversation.id) ?? 0,
        updatedAt: conversation.updatedAt.toISOString(),
      }];
    }));
  } catch (error) {
    req.log.error(error, "Failed to list direct conversations");
    return res.status(500).json({ error: "Failed to fetch conversations" });
  }
});

router.get("/direct-conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const conversationId = req.params.id as string;
    const [conversation] = await db.select().from(directConversationsTable)
      .where(and(
        eq(directConversationsTable.id, conversationId),
        or(
          eq(directConversationsTable.userOneId, user.id),
          eq(directConversationsTable.userTwoId, user.id),
        ),
      )).limit(1);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const peerId = conversation.userOneId === user.id ? conversation.userTwoId : conversation.userOneId;
    if (await isBlockedBetween(user.id, peerId)) return res.status(404).json({ error: "Conversation not found" });
    const rows = await db.select().from(directMessagesTable)
      .where(eq(directMessagesTable.conversationId, conversationId))
      .orderBy(desc(directMessagesTable.createdAt))
      .limit(100);
    await db.update(directMessagesTable).set({ readAt: new Date() })
      .where(and(
        eq(directMessagesTable.conversationId, conversationId),
        eq(directMessagesTable.senderId, peerId),
      ));
    return res.json(rows.reverse().map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      readAt: row.readAt?.toISOString(),
    })));
  } catch (error) {
    req.log.error(error, "Failed to list direct messages");
    return res.status(500).json({ error: "Failed to fetch messages" });
  }
});

router.get("/direct-conversations/:id/typing", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const conversation = await getConversation(req.params.id as string, user.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    cleanTyping(conversation.id);
    const typing = [...(typingStore.get(conversation.id)?.entries() ?? [])]
      .filter(([userId]) => userId !== user.id)
      .map(([, entry]) => entry.name);
    return res.json({ typing });
  } catch (error) {
    req.log.error(error, "Failed to fetch direct chat typing status");
    return res.status(500).json({ error: "Failed to fetch typing status" });
  }
});

router.post("/direct-conversations/:id/typing", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const conversation = await getConversation(req.params.id as string, user.id);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    if (await isBlockedBetween(user.id, conversation.userOneId === user.id ? conversation.userTwoId : conversation.userOneId)) {
      return res.status(403).json({ error: "Messaging is unavailable for this profile." });
    }
    const isTyping = req.body?.typing === true;
    if (!typingStore.has(conversation.id)) typingStore.set(conversation.id, new Map());
    const participants = typingStore.get(conversation.id)!;
    if (isTyping) participants.set(user.id, { name: user.fullName, expiresAt: Date.now() + 4000 });
    else participants.delete(user.id);
    return res.json({ ok: true });
  } catch (error) {
    req.log.error(error, "Failed to update direct chat typing status");
    return res.status(500).json({ error: "Failed to update typing status" });
  }
});

router.post("/direct-conversations/:id/messages", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const conversationId = req.params.id as string;
    const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
    if (!content || content.length > 2000) return res.status(400).json({ error: "Message must be between 1 and 2,000 characters." });
    const [conversation] = await db.select().from(directConversationsTable)
      .where(and(
        eq(directConversationsTable.id, conversationId),
        or(
          eq(directConversationsTable.userOneId, user.id),
          eq(directConversationsTable.userTwoId, user.id),
        ),
      )).limit(1);
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });
    const peerId = conversation.userOneId === user.id ? conversation.userTwoId : conversation.userOneId;
    if (await isBlockedBetween(user.id, peerId)) return res.status(403).json({ error: "Messaging is unavailable for this profile." });
    const [message] = await db.insert(directMessagesTable).values({
      conversationId,
      senderId: user.id,
      content,
    }).returning();
    await db.update(directConversationsTable).set({ updatedAt: new Date() })
      .where(eq(directConversationsTable.id, conversationId));
    await createSocialNotification(
      peerId,
      user.id,
      "direct_message",
      conversationId,
      `${user.fullName} sent you a message.`,
    );
    return res.status(201).json({
      ...message,
      createdAt: message.createdAt.toISOString(),
      readAt: undefined,
    });
  } catch (error) {
    req.log.error(error, "Failed to send direct message");
    return res.status(500).json({ error: "Failed to send message" });
  }
});

export default router;
