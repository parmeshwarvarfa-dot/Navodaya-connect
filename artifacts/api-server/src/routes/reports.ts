import { Router } from "express";
import { db, reportsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { desc } from "drizzle-orm";

const router = Router();

router.post("/reports", requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { reportedUserId, reportedUserName, reason, details } = req.body;
    if (!reason?.trim()) return res.status(400).json({ error: "Reason required" });
    const [row] = await db.insert(reportsTable).values({
      reportedUserId,
      reportedUserName: reportedUserName?.trim(),
      reason: reason.trim(),
      details: details?.trim(),
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
