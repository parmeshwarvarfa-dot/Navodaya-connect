import type { Request, Response, NextFunction } from "express";
import { and, eq } from "drizzle-orm";
import { db, sessionsTable, usersTable, verificationAssignmentsTable } from "@workspace/db";
import { makeJnvId } from "./jnv-identity";

export type AuthenticatedUser = typeof usersTable.$inferSelect;

function alumniHasCommunityAccess(user: AuthenticatedUser): boolean {
  return user.role === "alumni"
    && Boolean(user.communityVerifiedAt)
    && ["community_verified", "under_review"].includes(user.verificationStatus ?? "");
}

export function isCommunityVerifiedAlumni(user: Pick<AuthenticatedUser, "role" | "verificationStatus" | "communityVerifiedAt">): boolean {
  return user.role === "alumni" && ["community_verified", "under_review"].includes(user.verificationStatus ?? "") && Boolean(user.communityVerifiedAt);
}

function isAlumniVerificationEssentialRoute(req: Request, user: AuthenticatedUser): boolean {
  const path = (req.originalUrl.split("?")[0] ?? req.path).replace(/^\/api(?=\/)/, "");
  if (path.startsWith("/alumni-verification/")) return true;
  if (user.role === "alumni" && req.method === "GET" && /^\/users\/[^/]+\/report-context$/.test(path)) return true;
  if (path === "/users/me" || path === "/users/me/privacy" || path === "/users/blocked-users") return true;
  const selfProfile = path.match(/^\/users\/profile\/([^/]+)$/);
  if (selfProfile && selfProfile[1] === user.id) return true;
  if (path === "/reports" && ["GET", "POST"].includes(req.method)) return true;
  if (/^\/users\/[^/]+\/block$/.test(path) && ["POST", "DELETE"].includes(req.method)) return true;
  if (path === "/social-notifications" || /^\/social-notifications\/[^/]+\/read$/.test(path)) return true;
  if (path === "/verification/my-status" || path === "/verification/requests" && req.method === "POST") return true;
  // Profile photo upload is needed to complete the account before verification;
  // publishing any memory remains behind the community access check.
  if (["/memories/uploads", "/memories/media/uploads", "/problems"].includes(path) && ["GET", "POST"].includes(req.method)) return true;
  return false;
}

export async function isAuthorizedJnvOfficial(user: AuthenticatedUser): Promise<boolean> {
  if (user.role !== "official") return false;
  // Any registered or verified JNV official is authorized for their school
  if (isRegisteredJnvOfficial(user) || user.verificationStatus === "verified") {
    return true;
  }
  const jnvId = user.jnvId || makeJnvId(user.jnvState, user.jnvName);
  const [assignment] = await db.select({ id: verificationAssignmentsTable.id })
    .from(verificationAssignmentsTable)
    .where(and(
      eq(verificationAssignmentsTable.userId, user.id),
      eq(verificationAssignmentsTable.jnvId, jnvId),
      eq(verificationAssignmentsTable.assignmentRole, "official"),
      eq(verificationAssignmentsTable.active, true),
    )).limit(1);
  return Boolean(assignment);
}

/**
 * A registered official can use JNV scoped academic tools for the JNV on their
 * account. Administrative verification remains available for other management
 * routes, but is not required to assign teachers to classes.
 */
export function isRegisteredJnvOfficial(user: AuthenticatedUser): boolean {
  return user.role === "official" && Boolean(user.jnvName?.trim()) && Boolean(user.jnvState?.trim());
}

export function isVerifiedTeacher(user: AuthenticatedUser): boolean {
  return user.role === "teacher" && user.verificationStatus === "verified";
}

export async function isAuthorizedSchoolStaff(user: AuthenticatedUser): Promise<boolean> {
  return isVerifiedTeacher(user) || isAuthorizedJnvOfficial(user);
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const auth = req.headers.authorization;

  if (!auth?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = auth.slice(7);

  try {
    const [session] = await db
      .select()
      .from(sessionsTable)
      .where(eq(sessionsTable.token, token))
      .limit(1);

    if (!session || session.expiresAt < new Date()) {
      res.status(401).json({ error: "Session expired" });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, session.userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    (req as any).currentUser = user;
    if (user.role === "alumni" && !alumniHasCommunityAccess(user) && !isAlumniVerificationEssentialRoute(req, user)) {
      res.status(403).json({
        code: "ALUMNI_COMMUNITY_VERIFICATION_REQUIRED",
        error: "Confirm your alumni status with one alumnus from your JNV to access community features.",
        verificationStatus: user.verificationStatus === "verified" ? "legacy_approval_peer_required" : user.verificationStatus ?? "unverified",
      });
      return;
    }
    next();
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
}

export function getUser(req: Request) {
  return (req as any).currentUser as typeof usersTable.$inferSelect;
}

export function requireVerifiedGroupChat(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const user = getUser(req);
  if (user.role === "alumni" ? !alumniHasCommunityAccess(user) : user.verificationStatus !== "verified") {
    res.status(403).json({
      code: user.role === "alumni" ? "ALUMNI_COMMUNITY_VERIFICATION_REQUIRED" : "VERIFICATION_REQUIRED",
      error: user.role === "alumni"
        ? "Confirm your alumni status with one alumnus from your JNV to access group chats."
        : "Complete account verification to access group chats.",
      verificationStatus: user.verificationStatus ?? "unverified",
    });
    return;
  }
  next();
}
