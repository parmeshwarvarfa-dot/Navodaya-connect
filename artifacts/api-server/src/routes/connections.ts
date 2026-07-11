import { Router } from "express";
import { db, connectionsTable, usersTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { eq, or, and } from "drizzle-orm";

const router = Router();

router.get("/connections", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const rows = await db.select().from(connectionsTable)
      .where(or(
        eq(connectionsTable.fromId, user.id),
        eq(connectionsTable.toId, user.id),
      ));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

router.post("/connections/request", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { toId } = req.body;
    if (!toId) return res.status(400).json({ error: "Target user required" });
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
    const [row] = await db.update(connectionsTable)
      .set({ status: "connected" })
      .where(eq(connectionsTable.id, req.params.id as string))
      .returning();
    res.json(row);
  } catch (e) {
    res.status(500).json({ error: "Failed to accept" });
  }
});

export default router;
