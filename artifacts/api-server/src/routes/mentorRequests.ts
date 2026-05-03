import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, mentorRequestsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/mentor-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const requests = await db.select().from(mentorRequestsTable)
      .where(eq(mentorRequestsTable.studentId, user.id));
    res.json(requests);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.post("/mentor-requests", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { mentorId, mentorName, category, message } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: "message required" });
    const [request] = await db.insert(mentorRequestsTable).values({
      studentId: user.id,
      studentName: user.fullName,
      mentorId,
      mentorName,
      category,
      message: message.trim(),
      status: "pending",
    }).returning();
    res.json(request);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to send request" });
  }
});

export default router;
