import { Router } from "express";
import { and, asc, desc, eq } from "drizzle-orm";
import { db, schoolSupportRequestsTable } from "@workspace/db";
import { getUser, isAuthorizedJnvOfficial, isCommunityVerifiedAlumni, requireAuth } from "../lib/auth";

const router = Router();
const SUPPORT_TYPES = ["Sponsor an Event", "Donate Books", "Scholarship Fund", "Mentorship Program", "Infrastructure", "Other Contribution"] as const;
const STATUSES = ["reviewing", "in_progress", "fulfilled", "declined"] as const;

router.get("/school-support", requireAuth, async (req, res) => {
  const user = getUser(req);
  try {
    if (isCommunityVerifiedAlumni(user)) {
      const rows = await db.select().from(schoolSupportRequestsTable).where(eq(schoolSupportRequestsTable.alumniId, user.id)).orderBy(desc(schoolSupportRequestsTable.createdAt)).limit(100);
      return res.json(rows);
    }
    if (await isAuthorizedJnvOfficial(user)) {
      const rows = await db.select().from(schoolSupportRequestsTable).where(eq(schoolSupportRequestsTable.jnvId, user.jnvId ?? "")).orderBy(asc(schoolSupportRequestsTable.status), desc(schoolSupportRequestsTable.createdAt)).limit(200);
      return res.json(rows);
    }
    return res.status(403).json({ error: "Community verified alumni or assigned JNV staff access is required." });
  } catch (error) {
    req.log.error(error, "Failed to load school support requests");
    return res.status(500).json({ error: "Could not load school support requests." });
  }
});

router.post("/school-support", requireAuth, async (req, res) => {
  const user = getUser(req);
  if (!isCommunityVerifiedAlumni(user)) return res.status(403).json({ error: "Community verified alumni access is required." });
  const type = req.body?.type;
  const note = typeof req.body?.note === "string" ? req.body.note.trim() : "";
  if (!SUPPORT_TYPES.includes(type)) return res.status(400).json({ error: "Choose a valid school support type." });
  if (note.length > 2000) return res.status(400).json({ error: "Keep the request note under 2,000 characters." });
  try {
    const [row] = await db.insert(schoolSupportRequestsTable).values({ alumniId: user.id, jnvId: user.jnvId ?? "", type, note }).returning();
    return res.status(201).json(row);
  } catch (error) {
    req.log.error(error, "Failed to submit school support request");
    return res.status(500).json({ error: "Could not submit this request." });
  }
});

router.patch("/school-support/:id", requireAuth, async (req, res) => {
  const user = getUser(req);
  if (!await isAuthorizedJnvOfficial(user)) return res.status(403).json({ error: "Only assigned JNV staff can update school support requests." });
  const status = req.body?.status;
  const outcome = typeof req.body?.outcome === "string" ? req.body.outcome.trim() : "";
  if (!STATUSES.includes(status)) return res.status(400).json({ error: "Choose a valid request status." });
  if (outcome.length > 2000 || (status === "fulfilled" && outcome.length < 10)) return res.status(400).json({ error: "A fulfilled request needs an outcome summary of at least 10 characters." });
  try {
    const [row] = await db.update(schoolSupportRequestsTable).set({ status, outcome, reviewedBy: user.id, updatedAt: new Date() })
      .where(and(eq(schoolSupportRequestsTable.id, req.params.id as string), eq(schoolSupportRequestsTable.jnvId, user.jnvId ?? ""))).returning();
    if (!row) return res.status(404).json({ error: "School support request not found." });
    return res.json(row);
  } catch (error) {
    req.log.error(error, "Failed to update school support request");
    return res.status(500).json({ error: "Could not update this request." });
  }
});

export default router;
