import { Router } from "express";
import { and, desc, eq, ilike, or } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const jobs = await db.select().from(jobsTable).where(q ? or(
      ilike(jobsTable.title, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
      ilike(jobsTable.company, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
      ilike(jobsTable.location, `%${q.replace(/[%_\\]/g, "\\$&")}%`),
    ) : undefined).orderBy(desc(jobsTable.createdAt)).limit(100);
    res.json(jobs);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.post("/jobs", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { title, company, location, salary, type, category, description } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || title.length > 160 || typeof company !== "string" || !company.trim() || company.length > 160) {
      return res.status(400).json({ error: "title and company required" });
    }
    if ([location, salary, type, category, description].some((value) => value !== undefined && typeof value !== "string")) return res.status(400).json({ error: "Invalid job fields" });
    if (String(description ?? "").length > 5000 || String(salary ?? "").length > 100) return res.status(400).json({ error: "Job details are too long" });
    const [job] = await db.insert(jobsTable).values({
      title: title.trim(),
      company: company.trim(),
      location: location?.trim() || "Remote",
      salary: salary?.trim() || null,
      type: (type || "Full-time").slice(0, 60),
      category: (category || "Other").slice(0, 60),
      description: description?.trim() || "",
      postedBy: user.id,
      postedByName: user.fullName,
      postedByJnv: user.jnvName || "JNV",
    }).returning();
    res.json(job);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to create job" });
  }
});

router.delete("/jobs/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [job] = await db.select().from(jobsTable).where(eq(jobsTable.id, req.params.id as string)).limit(1);
    if (!job) return res.status(404).json({ error: "Not found" });
    if (job.postedBy !== user.id) {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(jobsTable).where(eq(jobsTable.id, req.params.id as string));
    res.json({ success: true });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to delete job" });
  }
});

export default router;
