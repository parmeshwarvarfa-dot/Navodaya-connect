import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
  maxLifetimeSeconds: 300,
  keepAlive: true,
});
// A dropped idle connection must not terminate the whole API process. Requests
// can reconnect through the pool after transient database/network interruptions.
pool.on("error", (error) => {
  console.error("Database pool connection error:", error.message);
});
export const db = drizzle(pool, { schema });

export * from "./schema";
