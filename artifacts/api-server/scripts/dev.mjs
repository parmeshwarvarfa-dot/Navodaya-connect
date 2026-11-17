import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envFile = path.resolve(packageDir, "../../.env");

if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const env = { ...process.env, NODE_ENV: "development" };
env.PUBLIC_APP_URL ??= env.REPLIT_DEV_DOMAIN
  ? `https://${env.REPLIT_DEV_DOMAIN}`
  : env.REPLIT_INTERNAL_APP_DOMAIN
    ? `https://${env.REPLIT_INTERNAL_APP_DOMAIN}`
    : env.EXPO_PUBLIC_DOMAIN
      ? `https://${env.EXPO_PUBLIC_DOMAIN}`
      : env.EXPO_PUBLIC_APP_URL;
const build = spawnSync(process.execPath, ["./build.mjs"], {
  cwd: packageDir,
  env,
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

// Local HTTPS connections should use certificates already trusted by Windows.
const tlsArgs = process.platform === "win32" && process.allowedNodeEnvironmentFlags.has("--use-system-ca")
  ? ["--use-system-ca"]
  : [];

const server = spawn(process.execPath, [...tlsArgs, "--enable-source-maps", "./dist/index.mjs"], {
  cwd: packageDir,
  env,
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill(signal));
}

server.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
