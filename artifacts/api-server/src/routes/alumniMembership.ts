import { Router } from "express";
import { and, desc, eq, gt, gte, lte } from "drizzle-orm";
import crypto from "crypto";
import {
  db,
  usersTable,
  alumniMembershipPlansTable,
  alumniMembershipsTable,
  alumniMembershipPaymentsTable,
  alumniMembershipRefundsTable,
} from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { ensureMembershipPlansSeed } from "../lib/membershipSeed";

const router = Router();
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Seed plans on first route load
void ensureMembershipPlansSeed();

// 1. Get available active membership plans
router.get("/alumni/membership/plans", async (_req, res) => {
  try {
    await ensureMembershipPlansSeed();
    const plans = await db
      .select()
      .from(alumniMembershipPlansTable)
      .where(eq(alumniMembershipPlansTable.isActive, true))
      .orderBy(alumniMembershipPlansTable.pricePaise);

    res.json({ plans });
  } catch (error) {
    console.error("[alumniMembership] Error fetching plans:", error);
    res.status(500).json({ error: "Failed to fetch membership plans" });
  }
});

// 2. Get current user's membership status
router.get("/alumni/membership/status", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Find the latest membership for user
    const [latestMembership] = await db
      .select({
        membership: alumniMembershipsTable,
        plan: alumniMembershipPlansTable,
      })
      .from(alumniMembershipsTable)
      .innerJoin(
        alumniMembershipPlansTable,
        eq(alumniMembershipsTable.planId, alumniMembershipPlansTable.id)
      )
      .where(eq(alumniMembershipsTable.userId, user.id))
      .orderBy(desc(alumniMembershipsTable.createdAt))
      .limit(1);

    const now = new Date();

    if (!latestMembership) {
      return res.json({
        isPremium: false,
        membership: null,
        plan: null,
        expiresAt: null,
        daysRemaining: 0,
      });
    }

    const expiresAt = new Date(latestMembership.membership.expiresAt);
    const isExpired = now.getTime() > expiresAt.getTime();
    const isActive = latestMembership.membership.status === "active" && !isExpired;

    // Synchronize user table if status flipped
    if (isExpired && latestMembership.membership.status === "active") {
      await db
        .update(alumniMembershipsTable)
        .set({ status: "expired", updatedAt: now })
        .where(eq(alumniMembershipsTable.id, latestMembership.membership.id));

      await db
        .update(usersTable)
        .set({ isPremium: false })
        .where(eq(usersTable.id, user.id));
    }

    const daysRemaining = isActive
      ? Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    res.json({
      isPremium: isActive,
      membership: {
        ...latestMembership.membership,
        status: isActive ? "active" : "expired",
      },
      plan: latestMembership.plan,
      expiresAt: latestMembership.membership.expiresAt,
      daysRemaining,
    });
  } catch (error) {
    console.error("[alumniMembership] Error checking status:", error);
    res.status(500).json({ error: "Failed to retrieve membership status" });
  }
});

// 3. Subscribe to a plan (STRICT ALUMNI ONLY)
router.post("/alumni/membership/subscribe", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Strict role eligibility check
    if (user.role !== "alumni") {
      return res.status(403).json({
        error:
          "Premium membership is exclusively available to verified Alumni accounts. Students, Teachers, and JNV Officials are not eligible to subscribe.",
      });
    }

    const { planId, paymentMethod = "upi", idempotencyKey } = req.body;
    if (!planId || !UUID.test(planId)) {
      return res.status(400).json({ error: "Valid planId is required" });
    }

    // Verify plan
    const [plan] = await db
      .select()
      .from(alumniMembershipPlansTable)
      .where(
        and(
          eq(alumniMembershipPlansTable.id, planId),
          eq(alumniMembershipPlansTable.isActive, true)
        )
      )
      .limit(1);

    if (!plan) {
      return res.status(404).json({ error: "Selected plan does not exist or is inactive" });
    }

    // Idempotency check if key provided
    if (idempotencyKey) {
      const [existingPayment] = await db
        .select()
        .from(alumniMembershipPaymentsTable)
        .where(eq(alumniMembershipPaymentsTable.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existingPayment) {
        return res.json({
          success: true,
          message: "Payment already processed",
          payment: existingPayment,
        });
      }
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setMonth(expiresAt.getMonth() + plan.durationMonths);

    // Create or update membership
    const [membership] = await db
      .insert(alumniMembershipsTable)
      .values({
        userId: user.id,
        planId: plan.id,
        status: "active",
        startsAt: now,
        expiresAt,
      })
      .returning();

    // Create payment transaction
    const transactionRef = `NAV-ALUM-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const [payment] = await db
      .insert(alumniMembershipPaymentsTable)
      .values({
        membershipId: membership.id,
        userId: user.id,
        amountPaise: plan.pricePaise,
        currency: "INR",
        paymentMethod,
        paymentStatus: "completed",
        transactionRef,
        idempotencyKey: idempotencyKey || null,
      })
      .returning();

    // Update user record with premium flag and expiry
    await db
      .update(usersTable)
      .set({
        isPremium: true,
        premiumExpiresAt: expiresAt,
      })
      .where(eq(usersTable.id, user.id));

    res.json({
      success: true,
      message: `Congratulations! You are now a Navodaya Premium Alumni Member (${plan.name}).`,
      membership,
      payment,
      plan,
    });
  } catch (error) {
    console.error("[alumniMembership] Error subscribing:", error);
    res.status(500).json({ error: "Failed to process subscription" });
  }
});

// 4. Manual Renewal for existing subscription (NO auto-debit)
router.post("/alumni/membership/renew", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    if (user.role !== "alumni") {
      return res.status(403).json({
        error: "Only alumni accounts can renew an alumni membership.",
      });
    }

    const { planId, paymentMethod = "upi" } = req.body;

    // Find user's current or last membership
    const [current] = await db
      .select()
      .from(alumniMembershipsTable)
      .where(eq(alumniMembershipsTable.userId, user.id))
      .orderBy(desc(alumniMembershipsTable.createdAt))
      .limit(1);

    const targetPlanId = planId || current?.planId;
    if (!targetPlanId) {
      return res.status(400).json({ error: "Target plan not found" });
    }

    const [plan] = await db
      .select()
      .from(alumniMembershipPlansTable)
      .where(eq(alumniMembershipPlansTable.id, targetPlanId))
      .limit(1);

    if (!plan) return res.status(404).json({ error: "Plan not found" });

    const now = new Date();
    // If current membership is still active, extend from current expiresAt; otherwise extend from now
    const baseDate = current && new Date(current.expiresAt).getTime() > now.getTime()
      ? new Date(current.expiresAt)
      : new Date(now);

    const newExpiresAt = new Date(baseDate);
    newExpiresAt.setMonth(newExpiresAt.getMonth() + plan.durationMonths);

    let updatedMembership;
    if (current) {
      const [m] = await db
        .update(alumniMembershipsTable)
        .set({
          planId: plan.id,
          status: "active",
          expiresAt: newExpiresAt,
          renewedAt: now,
          updatedAt: now,
        })
        .where(eq(alumniMembershipsTable.id, current.id))
        .returning();
      updatedMembership = m;
    } else {
      const [m] = await db
        .insert(alumniMembershipsTable)
        .values({
          userId: user.id,
          planId: plan.id,
          status: "active",
          startsAt: now,
          expiresAt: newExpiresAt,
        })
        .returning();
      updatedMembership = m;
    }

    // Record renewal payment
    const transactionRef = `NAV-REN-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const [payment] = await db
      .insert(alumniMembershipPaymentsTable)
      .values({
        membershipId: updatedMembership.id,
        userId: user.id,
        amountPaise: plan.pricePaise,
        currency: "INR",
        paymentMethod,
        paymentStatus: "completed",
        transactionRef,
      })
      .returning();

    // Update user record
    await db
      .update(usersTable)
      .set({
        isPremium: true,
        premiumExpiresAt: newExpiresAt,
      })
      .where(eq(usersTable.id, user.id));

    res.json({
      success: true,
      message: `Membership successfully renewed until ${newExpiresAt.toLocaleDateString()}.`,
      membership: updatedMembership,
      payment,
      plan,
    });
  } catch (error) {
    console.error("[alumniMembership] Error renewing:", error);
    res.status(500).json({ error: "Failed to renew membership" });
  }
});

// 5. Subscription & Payment history
router.get("/alumni/membership/history", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    const payments = await db
      .select({
        payment: alumniMembershipPaymentsTable,
        membership: alumniMembershipsTable,
        plan: alumniMembershipPlansTable,
      })
      .from(alumniMembershipPaymentsTable)
      .innerJoin(
        alumniMembershipsTable,
        eq(alumniMembershipPaymentsTable.membershipId, alumniMembershipsTable.id)
      )
      .innerJoin(
        alumniMembershipPlansTable,
        eq(alumniMembershipsTable.planId, alumniMembershipPlansTable.id)
      )
      .where(eq(alumniMembershipPaymentsTable.userId, user.id))
      .orderBy(desc(alumniMembershipPaymentsTable.createdAt));

    res.json({ history: payments });
  } catch (error) {
    console.error("[alumniMembership] Error fetching history:", error);
    res.status(500).json({ error: "Failed to fetch payment history" });
  }
});

// 6. Admin: List members & manage plans
router.get("/admin/alumni-memberships", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!user || (user.role !== "official" && user.role !== "teacher")) {
      return res.status(403).json({ error: "Admin privilege required" });
    }

    const subscribers = await db
      .select({
        membership: alumniMembershipsTable,
        user: {
          id: usersTable.id,
          fullName: usersTable.fullName,
          email: usersTable.email,
          role: usersTable.role,
          jnvName: usersTable.jnvName,
          passoutYear: usersTable.passoutYear,
        },
        plan: alumniMembershipPlansTable,
      })
      .from(alumniMembershipsTable)
      .innerJoin(usersTable, eq(alumniMembershipsTable.userId, usersTable.id))
      .innerJoin(
        alumniMembershipPlansTable,
        eq(alumniMembershipsTable.planId, alumniMembershipPlansTable.id)
      )
      .orderBy(desc(alumniMembershipsTable.createdAt))
      .limit(50);

    res.json({ subscribers });
  } catch (error) {
    console.error("[alumniMembership] Admin subscribers error:", error);
    res.status(500).json({ error: "Failed to fetch subscribers" });
  }
});

export default router;
