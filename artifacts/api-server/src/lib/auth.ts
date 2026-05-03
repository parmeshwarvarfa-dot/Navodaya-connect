import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const token = auth.slice(7);
  try {
    const [session] = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
    if (!session || session.expiresAt < new Date()) {
      return res.status(401).json({ error: "Session expired" });
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, session.userId)).limit(1);
    if (!user) return res.status(401).json({ error: "User not found" });
    (req as any).currentUser = user;
    next();
  } catch (e) {
    res.status(401).json({ error: "Unauthorized" });
  }
}

export function getUser(req: Request) {
  return (req as any).currentUser as typeof usersTable.$inferSelect;
}
