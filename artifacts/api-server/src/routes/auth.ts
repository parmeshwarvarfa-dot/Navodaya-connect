import { Router } from "express";
import bcrypt from "bcryptjs";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db, emailOtpChallengesTable, usersTable, sessionsTable } from "@workspace/db";
import type { UserProfile } from "./types";
import { makeJnvId } from "../lib/jnv-identity";
import { isValidJnvSelection } from "@workspace/api-zod";
import { awardRecognitionPoints, recognitionProfileComplete } from "../lib/recognition";

const router = Router();
const ACCOUNT_ROLES = new Set(["student", "alumni", "teacher", "official"]);
const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_WAIT_MS = 60 * 1000;
const OTP_WINDOW_MS = 60 * 60 * 1000;
const OTP_MAX_SENDS_PER_WINDOW = 5;
const OTP_MAX_ATTEMPTS = 5;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function otpSecret(): string {
  const secret = process.env.EMAIL_OTP_SECRET?.trim() || process.env.RESEND_API_KEY?.trim();
  if (!secret) throw new Error("Email OTP secret is not configured");
  return secret;
}

function digestOtp(value: string): string {
  return createHmac("sha256", otpSecret()).update(value).digest("hex");
}

function equalDigest(left: string, right: string): boolean {
  const leftBytes = Buffer.from(left, "hex");
  const rightBytes = Buffer.from(right, "hex");
  return leftBytes.length === rightBytes.length && timingSafeEqual(leftBytes, rightBytes);
}

async function sendEmailOtp(email: string, code: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new Error("Email delivery is not configured");
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Your Navodaya Connect verification code",
      text: `Your Navodaya Connect verification code is ${code}. It expires in 10 minutes. If you did not request this code, you can ignore this email.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:28px;color:#172033"><h2>Verify your email</h2><p>Enter this one-time code in Navodaya Connect:</p><div style="font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 20px;background:#f3f5ff;border-radius:12px;display:inline-block">${code}</div><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>`,
    }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error("The email provider could not send the verification code");
}

async function consumeEmailOtpToken(email: string, token: string): Promise<boolean> {
  if (!token) return false;
  const tokenHash = digestOtp(token);
  const [consumed] = await db.update(emailOtpChallengesTable)
    .set({ consumedAt: new Date() })
    .where(and(
      eq(emailOtpChallengesTable.email, email),
      eq(emailOtpChallengesTable.verificationTokenHash, tokenHash),
      gt(emailOtpChallengesTable.verificationTokenExpiresAt, new Date()),
      isNull(emailOtpChallengesTable.consumedAt),
    ))
    .returning({ email: emailOtpChallengesTable.email });
  return Boolean(consumed);
}

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

export async function verifyFirebaseToken(idToken: string) {
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
  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error("[Firebase Token Verification Failed]", response.status, errorBody);
    return null;
  }

  const data = (await response.json()) as {
    users?: Array<{ localId?: string; email?: string; displayName?: string; photoUrl?: string; emailVerified?: boolean }>;
  };
  const identity = data.users?.[0];
  if (!identity?.localId || !identity.email) return null;
  return { ...identity, emailVerified: identity.emailVerified === true };
}

function toProfile(user: typeof usersTable.$inferSelect): UserProfile {
  return {
    uid: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserProfile["role"],
    jnvState: user.jnvState,
    jnvName: user.jnvName,
    jnvId: user.jnvId ?? makeJnvId(user.jnvState, user.jnvName),
    profileVisibility: (user.profileVisibility ?? "public") as UserProfile["profileVisibility"],
    house: user.house as UserProfile["house"],
    photoURL: user.photoURL ?? undefined,
    avatarConfig: user.avatarConfig as UserProfile["avatarConfig"] ?? undefined,
    avatarThumbnailURL: user.avatarThumbnailURL ?? undefined,
    uploadedPhotoURL: user.uploadedPhotoURL ?? undefined,
    profileImageType: (user.profileImageType as UserProfile["profileImageType"]) ?? undefined,
    class: user.class ?? undefined,
    enrollYear: user.enrollYear ?? undefined,
    passoutYear: user.passoutYear ?? undefined,
    profession: user.profession ?? undefined,
    field: user.field ?? undefined,
    company: user.company ?? undefined,
    skills: user.skills ? JSON.parse(user.skills) : undefined,
    verificationStatus: (user.verificationStatus as UserProfile["verificationStatus"]) ?? undefined,
    communityVerifiedAt: user.communityVerifiedAt?.toISOString() ?? undefined,
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

async function awardProfileCompletionBestEffort(
  user: typeof usersTable.$inferSelect,
  onError: (error: unknown) => void,
): Promise<void> {
  if (!recognitionProfileComplete(user)) return;
  try {
    await awardRecognitionPoints({
      userId: user.id,
      activity: "profile_complete",
      referenceId: user.id,
      reason: "Completed profile",
    });
  } catch (error) {
    // Recognition is an optional side effect; it must not invalidate auth or profile loading.
    onError(error);
  }
}

router.post("/auth/email-otp/send", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email) return res.status(400).json({ error: "Enter a valid email address." });
  try {
    const now = new Date();
    const [existing] = await db.select().from(emailOtpChallengesTable)
      .where(eq(emailOtpChallengesTable.email, email)).limit(1);
    const inWindow = existing && now.getTime() - existing.windowStartedAt.getTime() < OTP_WINDOW_MS;
    if (existing && now.getTime() - existing.lastSentAt.getTime() < OTP_RESEND_WAIT_MS) {
      return res.status(429).json({ error: "Wait a minute before requesting another code." });
    }
    if (inWindow && existing.sendCount >= OTP_MAX_SENDS_PER_WINDOW) {
      return res.status(429).json({ error: "Too many codes requested. Try again in an hour." });
    }

    const code = String(randomInt(100_000, 1_000_000));
    const challengeId = randomUUID();
    await sendEmailOtp(email, code);
    const windowStartedAt = inWindow ? existing.windowStartedAt : now;
    const sendCount = inWindow ? existing.sendCount + 1 : 1;
    const codeHash = digestOtp(`${email}:${challengeId}:${code}`);
    await db.insert(emailOtpChallengesTable).values({
      email, challengeId, codeHash,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      attempts: 0, sendCount, windowStartedAt, lastSentAt: now,
      verificationTokenHash: null, verificationTokenExpiresAt: null, consumedAt: null,
    }).onConflictDoUpdate({
      target: emailOtpChallengesTable.email,
      set: {
        challengeId, codeHash,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
        attempts: 0, sendCount, windowStartedAt, lastSentAt: now,
        verificationTokenHash: null, verificationTokenExpiresAt: null, consumedAt: null,
      },
    });
    return res.json({ sent: true, expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Email OTP send failed");
    return res.status(503).json({ error: "Email verification is temporarily unavailable. Please try again later." });
  }
});

router.post("/auth/email-otp/verify", async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!email || !/^\d{6}$/.test(code)) return res.status(400).json({ error: "Enter the six-digit code from your email." });
  try {
    const [challenge] = await db.select().from(emailOtpChallengesTable)
      .where(eq(emailOtpChallengesTable.email, email)).limit(1);
    const now = new Date();
    if (!challenge || challenge.expiresAt <= now || challenge.attempts >= OTP_MAX_ATTEMPTS || challenge.consumedAt) {
      return res.status(400).json({ error: "This code is invalid or expired. Request a new code." });
    }
    const codeHash = digestOtp(`${email}:${challenge.challengeId}:${code}`);
    if (!equalDigest(challenge.codeHash, codeHash)) {
      await db.update(emailOtpChallengesTable).set({ attempts: challenge.attempts + 1 })
        .where(eq(emailOtpChallengesTable.email, email));
      return res.status(400).json({ error: "That code is incorrect. Check it and try again." });
    }
    const verificationToken = `${randomUUID()}${randomUUID()}`;
    await db.update(emailOtpChallengesTable).set({
      verificationTokenHash: digestOtp(verificationToken),
      verificationTokenExpiresAt: new Date(now.getTime() + OTP_TTL_MS),
    }).where(eq(emailOtpChallengesTable.email, email));
    return res.json({ verificationToken, expiresInSeconds: OTP_TTL_MS / 1000 });
  } catch (error) {
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Email OTP verification failed");
    return res.status(503).json({ error: "Email verification is temporarily unavailable. Please try again later." });
  }
});

router.post("/auth/signup", async (req, res) => {
  try {
    const { password, fullName, role, jnvState, jnvName, house, emailOtpToken, ...rest } = req.body;
    const email = normalizeEmail(req.body?.email);
    if (!ACCOUNT_ROLES.has(role)) return res.status(400).json({ error: "Invalid account role" });
    const needsHouse = role === "student" || role === "alumni";
    if (!email || !password || !fullName || !role || !jnvState || !jnvName || (needsHouse && !house)) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    if (!isValidJnvSelection(jnvState, jnvName)) return res.status(400).json({ code: "INVALID_JNV_SELECTION", error: "Select a JNV from the school directory." });
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase())).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "Email already in use" });
    }
    if (typeof emailOtpToken !== "string" || !await consumeEmailOtpToken(email, emailOtpToken)) {
      return res.status(403).json({ error: "Verify your email before creating an account." });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    // A self-selected role never grants verification or school administration rights.
    const initialStatus = "unverified";

    const [user] = await db.insert(usersTable).values({
      email: email.toLowerCase(),
      passwordHash,
      fullName,
      role,
      jnvState,
      jnvName,
      jnvId: makeJnvId(jnvState, jnvName),
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

    const token = await createSession(user.id);
    await awardProfileCompletionBestEffort(user, (error) =>
      req.log.warn({ err: error }, "Profile completion recognition was not recorded during signup"),
    );
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
    const emailOtpToken = typeof req.body?.emailOtpToken === "string" ? req.body.emailOtpToken : "";
    if (!idToken) return res.status(400).json({ error: "Firebase identity token required" });

    const identity = await verifyFirebaseToken(idToken);
    if (!identity) return res.status(401).json({ error: "Firebase authentication failed" });

    const email = identity.email!.toLowerCase();
    const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email)).limit(1);
    let user = existing;

    if (!user) {
      const role = profileData.role;
      if (role && !ACCOUNT_ROLES.has(role)) return res.status(422).json({ error: "Invalid account role" });
      if (!profileData.fullName || !role || !profileData.jnvState || !profileData.jnvName) {
        return res.status(422).json({
          code: "PROFILE_REQUIRED",
          error: "Complete your profile before continuing",
          email,
        });
      }
      if (!isValidJnvSelection(profileData.jnvState, profileData.jnvName)) return res.status(422).json({ code: "INVALID_JNV_SELECTION", error: "Select a JNV from the school directory." });

      const emailVerified = identity.emailVerified || (emailOtpToken ? await consumeEmailOtpToken(email, emailOtpToken) : false);
      if (!emailVerified) {
        return res.status(403).json({ error: "Verify your email before creating an account." });
      }

      [user] = await db.insert(usersTable).values({
        email,
        passwordHash: await bcrypt.hash(randomUUID(), 12),
        fullName: profileData.fullName,
        role,
        jnvState: profileData.jnvState,
        jnvName: profileData.jnvName,
        jnvId: makeJnvId(profileData.jnvState, profileData.jnvName),
        house: profileData.house || "Aravali",
        class: profileData.class,
        passoutYear: profileData.passoutYear,
        profession: profileData.profession,
        designation: profileData.designation,
        subject: profileData.subject,
        verificationStatus: "unverified",
        photoURL: identity.photoUrl,
      }).returning();

    }

    if (user && !user.jnvId) {
      [user] = await db.update(usersTable)
        .set({ jnvId: makeJnvId(user.jnvState, user.jnvName) })
        .where(eq(usersTable.id, user.id))
        .returning();
    }

    const token = await createSession(user.id);
    await awardProfileCompletionBestEffort(user, (error) =>
      req.log.warn({ err: error }, "Profile completion recognition was not recorded during Firebase auth"),
    );
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
    await awardProfileCompletionBestEffort(user, (error) =>
      req.log.warn({ err: error }, "Profile completion recognition was not recorded during profile lookup"),
    );
    res.json({ profile: toProfile(user) });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch profile" });
  }
});

export default router;
