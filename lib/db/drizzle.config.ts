import { defineConfig } from "drizzle-kit";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Load the workspace root .env when Drizzle is run directly from the CLI.
const workspaceEnv = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../.env",
);
if (
  !process.env.DATABASE_URL &&
  existsSync(workspaceEnv) &&
  typeof process.loadEnvFile === "function"
) {
  process.loadEnvFile(workspaceEnv);
}

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing. Add it to the workspace root .env and ensure the database is provisioned.");
}

export default defineConfig({
  schema: "./src/schema/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
