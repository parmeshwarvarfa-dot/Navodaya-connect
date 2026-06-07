import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable, verificationRequestsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/verification/requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "official") return res.status(403).json({ error: "Officials only" });
    const requests = await db.select().from(verificationRequestsTable)
      .where(eq(verificationRequestsTable.jnvName, user.jnvName))
      .orderBy(verificationRequestsTable.createdAt);
    res.json(requests);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch verification requests" });
  }
});

router.get("/verification/my-status", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    const [request] = await db.select().from(verificationRequestsTable)
      .where(eq(verificationRequestsTable.userId, user.id))
      .orderBy(verificationRequestsTable.createdAt)
      .limit(1);
    res.json({
      verificationStatus: dbUser?.verificationStatus ?? "pending",
      request: request ?? null,
    });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch status" });
  }
});

router.post("/verification/requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const existing = await db.select().from(verificationRequestsTable)
      .where(eq(verificationRequestsTable.userId, user.id)).limit(1);
    if (existing.length > 0) {
      return res.json(existing[0]);
    }
    const [dbUser] = await db.select().from(usersTable).where(eq(usersTable.id, user.id)).limit(1);
    const method = req.body.method || "official";
    const [request] = await db.insert(verificationRequestsTable).values({
      userId: user.id,
      userFullName: dbUser.fullName,
      userEmail: dbUser.email,
      role: user.role,
      jnvName: dbUser.jnvName,
      jnvState: dbUser.jnvState,
      method,
      status: "pending",
      documentUrls: req.body.documentUrls ? JSON.stringify(req.body.documentUrls) : null,
    }).returning();
    res.json(request);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to create verification request" });
  }
});

router.patch("/verification/requests/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "official") return res.status(403).json({ error: "Officials only" });
    const { status, notes, infoRequest } = req.body;
    const allowedStatuses = ["approved", "rejected", "info_requested", "pending"];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: "Invalid status" });

    const [existing] = await db.select().from(verificationRequestsTable)
      .where(eq(verificationRequestsTable.id, req.params.id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Request not found" });
    if (existing.jnvName !== user.jnvName) return res.status(403).json({ error: "Not your JNV" });

    const updates: Partial<typeof verificationRequestsTable.$inferInsert> = {
      status,
      reviewedBy: user.id,
      reviewedByName: user.fullName,
      reviewedAt: new Date(),
      updatedAt: new Date(),
    };
    if (notes !== undefined) updates.notes = notes;
    if (infoRequest !== undefined) updates.infoRequest = infoRequest;

    const [updated] = await db.update(verificationRequestsTable)
      .set(updates)
      .where(eq(verificationRequestsTable.id, req.params.id))
      .returning();

    if (status === "approved") {
      await db.update(usersTable)
        .set({ verificationStatus: "verified" })
        .where(eq(usersTable.id, existing.userId));
    } else if (status === "rejected") {
      await db.update(usersTable)
        .set({ verificationStatus: "rejected" })
        .where(eq(usersTable.id, existing.userId));
    } else if (status === "pending") {
      await db.update(usersTable)
        .set({ verificationStatus: "pending" })
        .where(eq(usersTable.id, existing.userId));
    }

    res.json(updated);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update verification request" });
  }
});

router.patch("/users/:id/suspend", requireAuth, async (req, res) => {
  try {
    const official = getUser(req);
    if (official.role !== "official") return res.status(403).json({ error: "Officials only" });
    const { suspended } = req.body;
    const [target] = await db.select().from(usersTable).where(eq(usersTable.id, req.params.id)).limit(1);
    if (!target) return res.status(404).json({ error: "User not found" });
    if (target.jnvName !== official.jnvName) return res.status(403).json({ error: "Not your JNV" });
    const newStatus = suspended ? "suspended" : "verified";
    const [updated] = await db.update(usersTable)
      .set({ verificationStatus: newStatus })
      .where(eq(usersTable.id, req.params.id))
      .returning();
    const { passwordHash, ...safe } = updated;
    res.json(safe);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update user status" });
  }
});

router.get("/users/manage", requireAuth, async (req, res) => {
  try {
    const official = getUser(req);
    if (official.role !== "official") return res.status(403).json({ error: "Officials only" });
    const users = await db.select().from(usersTable)
      .where(eq(usersTable.jnvName, official.jnvName));
    const safe = users.map(({ passwordHash, ...u }) => ({
      ...u,
      skills: u.skills ? JSON.parse(u.skills) : [],
    }));
    res.json(safe);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

export default router;
