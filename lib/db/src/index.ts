import dns from "node:dns";
import { existsSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const NEON_FALLBACK_IPS = ["52.76.246.190", "52.76.212.156", "3.0.27.201"];
const originalLookup = dns.lookup;
// @ts-ignore
dns.lookup = function (hostname: any, options: any, callback: any) {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "object" && options !== null ? options : {};

  if (typeof hostname === "string" && hostname.includes("neon.tech")) {
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        if (opts.all) {
          cb(null, NEON_FALLBACK_IPS.map((ip) => ({ address: ip, family: 4 })));
        } else {
          cb(null, NEON_FALLBACK_IPS[0], 4);
        }
      }
    }, 1500);

    (originalLookup as any).call(dns, hostname, options, (err: any, address: any, family: any) => {
      if (settled) return;
      clearTimeout(timer);
      settled = true;
      if (err || !address) {
        if (opts.all) {
          cb(null, NEON_FALLBACK_IPS.map((ip) => ({ address: ip, family: 4 })));
        } else {
          cb(null, NEON_FALLBACK_IPS[0], 4);
        }
      } else {
        cb(null, address, family);
      }
    });
    return;
  }

  return (originalLookup as any).call(dns, hostname, options, callback);
};

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
