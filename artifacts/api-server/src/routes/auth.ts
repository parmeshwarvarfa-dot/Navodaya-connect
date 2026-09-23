import { Router } from "express";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db, usersTable, sessionsTable, verificationRequestsTable } from "@workspace/db";
import type { UserProfile } from "./types";

const router = Router();

type FirebaseProfileData = {
  fullName?: string;
  role?: string;
  jnvState?: string;
  jnvName?: string;
  house?: string;
  class?: string;
  passoutYear?: string;
  profession?: string;
  designation?: string;
  subject?: string;
};

async function verifyFirebaseToken(idToken: string) {
  const apiKey = (process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "")
    .trim()
    .replace(/^["']|["']$/g, "")
    .trim();
  if (!apiKey) throw new Error("Firebase API key is not configured");

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    },
  );
  if (!response.ok) return null;

  const data = (await response.json()) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string; photoUrl?: string }>;
  };
  const identity = data.users?.[0];
  if (!identity?.localId || !identity.email) return null;
  return identity;
}

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

router.post("/auth/firebase", async (req, res) => {
  try {
    const idToken = typeof req.body?.idToken === "string" ? req.body.idToken : "";
    const profileData = (req.body?.profileData ?? {}) as FirebaseProfileData;
    if (!idToken) return res.status(400).json({ error: "Firebase identity token required" });

    const identity = await verifyFirebaseToken(idToken);
    if (!identity) return res.status(401).json({ error: "Firebase authentication failed" });

    const email = identity.email!.toLowerCase();
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    let user = existing;

    if (!user) {
      const role = profileData.role;
      if (!profileData.fullName || !role || !profileData.jnvState || !profileData.jnvName) {
        return res.status(422).json({
          code: "PROFILE_REQUIRED",
          error: "Complete your profile before continuing",
          email,
        });
      }

      const isOfficial = role === "official";
      [user] = await db.insert(usersTable).values({
        email,
        passwordHash: await bcrypt.hash(randomUUID(), 12),
        fullName: profileData.fullName,
        role,
        jnvState: profileData.jnvState,
        jnvName: profileData.jnvName,
        house: profileData.house || "Aravali",
        class: profileData.class,
        passoutYear: profileData.passoutYear,
        profession: profileData.profession,
        designation: profileData.designation,
        subject: profileData.subject,
        verificationStatus: isOfficial ? "verified" : "pending",
        photoURL: identity.photoUrl,
      }).returning();

      if (!isOfficial) {
        await db.insert(verificationRequestsTable).values({
          userId: user.id,
          userFullName: user.fullName,
          userEmail: user.email,
          role,
          jnvName: user.jnvName,
          jnvState: user.jnvState,
          method: "official",
          status: "pending",
        });
      }
    }

    const token = await createSession(user.id);
    return res.json({ token, profile: toProfile(user) });
  } catch (error) {
    req.log.error(error);
    return res.status(500).json({ error: "Firebase authentication failed" });
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
