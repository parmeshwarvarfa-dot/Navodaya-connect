import { EventEmitter } from "events";
import { and, desc, eq, sql } from "drizzle-orm";
import {
  db,
  competitionScoreLedgerTable,
  usersTable,
} from "@workspace/db";
import { normalizeHouseName } from "./houseConstants";

// Global in-memory competition event bus for live updates
export const competitionEventBus = new EventEmitter();
competitionEventBus.setMaxListeners(200);

export interface ScoreEventPayload {
  userId: string;
  house: string;
  jnvId?: string | null;
  sourceType: "battle" | "daily_puzzle" | "solo_game" | "admin_adjustment" | "tournament";
  sourceId: string;
  points: number;
  idempotencyKey?: string;
  reason: string;
  verifiedBy?: string | null;
}

/**
 * Authoritative Server-Side Score Recording
 * All points (battles, puzzles, solo games, tournaments, admin adjustments) must flow through this ledger.
 */
export async function recordScoreEvent(payload: ScoreEventPayload): Promise<{
  success: boolean;
  scoreId: string;
  pointsAwarded: number;
  duplicate: boolean;
}> {
  const normalizedHouse = normalizeHouseName(payload.house);
  const idempotencyKey =
    payload.idempotencyKey ||
    `${payload.sourceType}:${payload.sourceId}:${payload.userId}`;

  try {
    // Check for existing event if idempotency key provided
    const [existing] = await db
      .select()
      .from(competitionScoreLedgerTable)
      .where(eq(competitionScoreLedgerTable.idempotencyKey, idempotencyKey))
      .limit(1);

    if (existing) {
      return {
        success: true,
        scoreId: existing.id,
        pointsAwarded: existing.points,
        duplicate: true,
      };
    }

    const [inserted] = await db
      .insert(competitionScoreLedgerTable)
      .values({
        userId: payload.userId,
        house: normalizedHouse,
        jnvId: payload.jnvId || null,
        sourceType: payload.sourceType,
        sourceId: payload.sourceId,
        points: payload.points,
        idempotencyKey,
        reason: payload.reason,
        verifiedBy: payload.verifiedBy || null,
      })
      .returning();

    // Fetch user details for live broadcast
    const [user] = await db
      .select({
        id: usersTable.id,
        fullName: usersTable.fullName,
        photoURL: usersTable.photoURL,
      })
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .limit(1);

    const activityEvent = {
      type: "SCORE_AWARDED",
      scoreId: inserted.id,
      userId: payload.userId,
      userName: user?.fullName || "Student",
      photoURL: user?.photoURL || null,
      house: normalizedHouse,
      points: payload.points,
      sourceType: payload.sourceType,
      reason: payload.reason,
      createdAt: inserted.createdAt,
    };

    // Emit live event for connected SSE listeners
    competitionEventBus.emit("activity", activityEvent);

    return {
      success: true,
      scoreId: inserted.id,
      pointsAwarded: inserted.points,
      duplicate: false,
    };
  } catch (err: any) {
    if (err?.code === "23505") {
      // Postgres unique constraint violation
      return {
        success: true,
        scoreId: "duplicate",
        pointsAwarded: payload.points,
        duplicate: true,
      };
    }
    console.error("[scoreLedger] Failed to record score event:", err);
    throw err;
  }
}
