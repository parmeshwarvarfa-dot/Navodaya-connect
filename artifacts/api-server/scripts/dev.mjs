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
const build = spawnSync(process.execPath, ["./build.mjs"], {
  cwd: packageDir,
  env,
  stdio: "inherit",
});

if (build.status !== 0) {
  process.exit(build.status ?? 1);
}

const server = spawn(process.execPath, ["--enable-source-maps", "./dist/index.mjs"], {
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