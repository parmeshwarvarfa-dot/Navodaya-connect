import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  const envPaths = [
    path.resolve(process.cwd(), ".env"),
    path.resolve(process.cwd(), "../../.env"),
    path.resolve(process.cwd(), "../.env"),
  ];
  for (const p of envPaths) {
    if (existsSync(p) && typeof process.loadEnvFile === "function") {
      try {
        process.loadEnvFile(p);
        if (process.env.DATABASE_URL) break;
      } catch {
        // ignore
      }
    }
  }
}

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
