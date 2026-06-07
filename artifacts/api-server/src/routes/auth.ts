import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable, verificationRequestsTable } from "@workspace/db";
import type { UserProfile } from "./types";

const router = Router();

function toProfile(user: typeof usersTable.$inferSelect): UserProfile {
  return {
    uid: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserProfile["role"],
    jnvState: user.jnvState,
    jnvName: user.jnvName,
    house: user.house as UserProfile["house"],
    photoURL: user.photoURL ?? undefined,
    class: user.class ?? undefined,
    enrollYear: user.enrollYear ?? undefined,
    passoutYear: user.passoutYear ?? undefined,
    profession: user.profession ?? undefined,
    field: user.field ?? undefined,
    company: user.company ?? undefined,
    skills: user.skills ? JSON.parse(user.skills) : undefined,
    verificationStatus: (user.verificationStatus as UserProfile["verificationStatus"]) ?? undefined,
    subject: user.subject ?? undefined,
    designation: user.designation ?? undefined,
  };
}

async function createSession(userId: string) {
  const token = randomUUID() + "-" + randomUUID();
  const expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);
  await db.insert(sessionsTable).values({ userId, token, expiresAt });
  return token;
}

router.post("/auth/signup", async (req, res) => {
  try {
    const { email, password, fullName, role, jnvState, jnvName, house, ...rest } = req.body;
    const needsHouse = role === "student" || role === "alumni";
    if (!email || !password || !fullName || !role || !jnvState || !jnvName || (needsHouse && !house)) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const isOfficial = role === "official";
    const initialStatus = isOfficial ? "verified" : "pending";

    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role,
      jnvState,
      jnvName,
      house: house || "Aravali",
      class: rest.class,
      enrollYear: rest.enrollYear,
      passoutYear: rest.passoutYear,
      profession: rest.profession,
      field: rest.field,
      company: rest.company,
      skills: rest.skills ? JSON.stringify(rest.skills) : null,
      verificationStatus: initialStatus,
      subject: rest.subject,
      designation: rest.designation,
    }).returning();

    if (!isOfficial) {
      await db.insert(verificationRequestsTable).values({
        userId: user.id,
        userFullName: fullName,
        userEmail: email.toLowerCase(),
        role,
        jnvName,
        jnvState,
        method: "official",
        status: "pending",
      });
    }

    const token = await createSession(user.id);
    res.json({ token, profile: toProfile(user) });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Signup failed" });
  }
});

router.post("/auth/signin", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: "Email and password required" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (!user) return res.status(401).json({ error: "Invalid credentials" });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: "Invalid credentials" });
    const token = await createSession(user.id);
    res.json({ token, profile: toProfile(user) });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Sign in failed" });
  }
});

router.post("/auth/signout", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (auth?.startsWith("Bearer ")) {
      const token = auth.slice(7);
      await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
    }
    res.json({ ok: true });
  } catch {
    res.json({ ok: true });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const auth = req.headers.authorization;
    if (!auth?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });
    const token = auth.slice(7);
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
    if (!session || session.expiresAt < new Date()) return res.status(401).json({ error: "Session expired" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ profile: toProfile(user) });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;
