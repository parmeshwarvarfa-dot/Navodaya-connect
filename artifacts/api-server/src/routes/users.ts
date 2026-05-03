import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";

const router = Router();

router.get("/users/alumni", requireAuth, async (req, res) => {
  try {
    const alumni = await db.select().from(usersTable)
      .where(and(eq(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "verified")));
    const safe = alumni.map(({ passwordHash, ...u }) => ({
      ...u,
      skills: u.skills ? JSON.parse(u.skills) : [],
    }));
    res.json(safe);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch alumni" });
  }
});

router.patch("/users/me", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { fullName, profession, company, field, subject, designation, skills, verificationStatus } = req.body;
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (profession !== undefined) updates.profession = profession;
    if (company !== undefined) updates.company = company;
    if (field !== undefined) updates.field = field;
    if (subject !== undefined) updates.subject = subject;
    if (designation !== undefined) updates.designation = designation;
    if (skills !== undefined) updates.skills = JSON.stringify(skills);
    if (verificationStatus !== undefined && (user.role === "alumni")) {
      updates.verificationStatus = verificationStatus;
    }
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    const { passwordHash, ...safe } = updated;
    res.json({ ...safe, skills: safe.skills ? JSON.parse(safe.skills) : [] });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
