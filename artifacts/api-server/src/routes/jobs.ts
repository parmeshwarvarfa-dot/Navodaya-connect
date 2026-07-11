import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, jobsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/jobs", requireAuth, async (req, res) => {
  try {
    const jobs = await db.select().from(jobsTable).orderBy(desc(jobsTable.createdAt));
    res.json(jobs);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

router.post("/jobs", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { title, company, location, salary, type, category, description } = req.body;
    if (!title?.trim() || !company?.trim()) {
      return res.status(400).json({ error: "title and company required" });
    }
    const [job] = await db.insert(jobsTable).values({
      title: title.trim(),
      company: company.trim(),
      location: location?.trim() || "Remote",
      salary: salary?.trim() || null,
      type: type || "Full-time",
      category: category || "Other",
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
    if (job.postedBy !== user.id && user.role !== "official") {
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
