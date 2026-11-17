import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(scriptDir, "../../..");
const envFile = path.join(workspaceRoot, ".env");
if (!process.env.DATABASE_URL && typeof process.loadEnvFile === "function") process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing; add it to the workspace .env file.");

const migrationFile = path.join(workspaceRoot, "lib/db/migrations/20261031_teacher_assignment_management.sql");
const migration = await readFile(migrationFile, "utf8");
const { Pool } = createRequire(path.join(workspaceRoot, "lib/db/package.json"))("pg");
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query(migration);
  process.stdout.write("Teacher assignment management migration applied.\n");
} finally {
  await pool.end();
}
