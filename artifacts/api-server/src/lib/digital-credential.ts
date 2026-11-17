import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { digitalCredentialsTable, usersTable } from "@workspace/db";

type CredentialTx = Pick<typeof import("@workspace/db").db, "insert" | "select" | "update"> | any;

/** Issues one active credential for a role already approved by the calling workflow. */
export async function issueDigitalCredential(
  tx: CredentialTx,
  user: typeof usersTable.$inferSelect,
  jnvId: string,
  issuedBy: string,
  role: string,
) {
  const prefix: Record<string, string> = { student: "STU", alumni: "ALU", teacher: "TCH", official: "OFC" };
  if (!prefix[role]) throw new Error("Unsupported role for Navodaya Digital ID");

  const [current] = await tx.select().from(digitalCredentialsTable).where(and(
    eq(digitalCredentialsTable.userId, user.id), eq(digitalCredentialsTable.status, "active"),
  )).limit(1);
  if (current?.role === role) return { credential: current, created: false };
  if (current) {
    if (current.role === "alumni" || role === "alumni") throw new Error("Alumni credentials cannot be superseded through school verification");
    await tx.update(digitalCredentialsTable).set({ status: "superseded", updatedAt: new Date() })
      .where(eq(digitalCredentialsTable.id, current.id));
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const [created] = await tx.insert(digitalCredentialsTable).values({
      userId: user.id,
      credentialId: `NC-${prefix[role]}-${randomBytes(5).toString("hex").toUpperCase()}`,
      publicToken: randomBytes(32).toString("base64url"),
      role,
      jnvId,
      jnvName: user.jnvName,
      jnvState: user.jnvState,
      issuedBy,
    }).onConflictDoNothing().returning();
    if (created) return { credential: created, created: true };

    const [active] = await tx.select().from(digitalCredentialsTable).where(and(
      eq(digitalCredentialsTable.userId, user.id), eq(digitalCredentialsTable.status, "active"),
    )).limit(1);
    if (active?.role === role) return { credential: active, created: false };
  }
  throw new Error("Could not issue a unique Navodaya Digital ID");
}
