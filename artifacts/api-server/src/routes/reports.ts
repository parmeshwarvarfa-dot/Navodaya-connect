import { Router } from "express";
import { db, reportsTable, usersTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { getUser, requireAuth } from "../lib/auth";
import { isSelfReport, isValidUserId } from "./user-validation";

const router = Router();
const REPORT_REASONS = new Set([
  "Harassment or Bullying",
  "Spam or Fake Account",
  "Inappropriate Content",
  "Impersonation",
  "Hate Speech or Abuse",
  "Cheating or Academic Fraud",
  "Privacy Violation",
  "Other",
]);

router.post("/reports", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { reportedUserId, reason, details } = req.body ?? {};
    if (!isValidUserId(reportedUserId)) {
      return res.status(400).json({ error: "A valid target user is required" });
    }
    if (isSelfReport(user.id, reportedUserId)) {
      return res.status(400).json({ error: "You cannot report yourself" });
    }
    if (typeof reason !== "string" || !REPORT_REASONS.has(reason)) {
      return res.status(400).json({ error: "Select a valid report reason" });
    }
    if (details !== undefined && typeof details !== "string") {
      return res.status(400).json({ error: "Invalid report details" });
    }

    const [target] = await db.select({ id: usersTable.id, fullName: usersTable.fullName })
      .from(usersTable)
      .where(eq(usersTable.id, reportedUserId))
      .limit(1);
    if (!target) return res.status(404).json({ error: "Reported user not found" });

    const [row] = await db.insert(reportsTable).values({
      reportedUserId: target.id,
      reportedUserName: target.fullName,
      reason,
      details: details?.trim() || undefined,
      reporterId: user.id,
      reporterName: user.fullName,
      status: "pending",
    }).returning();
    res.json(row);
  } catch (e) {
    req.log.error(e, "report error");
    res.status(500).json({ error: "Failed to submit report" });
  }
});

router.get("/reports", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    if (user.role !== "official") return res.status(403).json({ error: "Forbidden" });
    const rows = await db.select().from(reportsTable).orderBy(desc(reportsTable.createdAt));
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

export default router;
