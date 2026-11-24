import { Router } from "express";
import { db, connectionsTable, usersTable } from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { eq, or, and } from "drizzle-orm";
import { isBlockedBetween } from "../lib/social-access";
import { isValidUserId } from "./user-validation";

const router = Router();

router.get("/connections", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const rows = await db.select().from(connectionsTable)
      .where(or(
        eq(connectionsTable.fromId, user.id),
        eq(connectionsTable.toId, user.id),
      ));
    const visible = await Promise.all(rows.map(async (row) => {
      const peerId = row.fromId === user.id ? row.toId : row.fromId;
      return await isBlockedBetween(user.id, peerId) ? null : row;
    }));
    res.json(visible.filter(Boolean));
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

router.post("/connections/request", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { toId } = req.body;
    if (!isValidUserId(toId)) return res.status(400).json({ error: "A valid target user is required" });
    if (toId === user.id) return res.status(400).json({ error: "You cannot connect to your own profile" });
    const [target] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, toId)).limit(1);
    if (!target || await isBlockedBetween(user.id, toId)) return res.status(404).json({ error: "User not found" });
    const existing = await db.select().from(connectionsTable)
      .where(or(
        and(eq(connectionsTable.fromId, user.id), eq(connectionsTable.toId, toId)),
        and(eq(connectionsTable.fromId, toId), eq(connectionsTable.toId, user.id)),
      ));
    if (existing.length > 0) return res.status(400).json({ error: "Connection already exists" });
    const [row] = await db.insert(connectionsTable).values({
      fromId: user.id,
      toId,
      status: "pending",
    }).returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to send request" });
  }
});

router.patch("/connections/:id/accept", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [existing] = await db.select().from(connectionsTable)
      .where(and(eq(connectionsTable.id, req.params.id as string), eq(connectionsTable.toId, user.id)))
      .limit(1);
    if (!existing || existing.status !== "pending") return res.status(404).json({ error: "Pending connection request not found" });
    if (await isBlockedBetween(existing.fromId, user.id)) return res.status(404).json({ error: "Pending connection request not found" });
    const [row] = await db.update(connectionsTable)
      .set({ status: "connected" })
      .where(and(eq(connectionsTable.id, existing.id), eq(connectionsTable.toId, user.id), eq(connectionsTable.status, "pending")))
      .returning();
    if (!row) return res.status(409).json({ error: "Connection request was already handled" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to accept" });
  }
});

router.patch("/connections/:id/decline", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [existing] = await db.select().from(connectionsTable)
      .where(and(eq(connectionsTable.id, req.params.id as string), eq(connectionsTable.toId, user.id)))
      .limit(1);
    if (!existing || existing.status !== "pending") return res.status(404).json({ error: "Pending connection request not found" });
    const [row] = await db.update(connectionsTable)
      .set({ status: "declined" })
      .where(and(eq(connectionsTable.id, existing.id), eq(connectionsTable.toId, user.id), eq(connectionsTable.status, "pending")))
      .returning();
    if (!row) return res.status(409).json({ error: "Connection request was already handled" });
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to decline connection" });
  }
});

router.delete("/connections/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [existing] = await db.select().from(connectionsTable)
      .where(and(
        eq(connectionsTable.id, req.params.id as string),
        or(eq(connectionsTable.fromId, user.id), eq(connectionsTable.toId, user.id)),
      ))
      .limit(1);
    if (!existing) return res.status(404).json({ error: "Connection not found" });
    await db.delete(connectionsTable).where(eq(connectionsTable.id, existing.id));
    res.json({ success: true, id: existing.id });
  } catch (e) {
    res.status(500).json({ error: "Failed to remove connection" });
  }
});

export default router;
