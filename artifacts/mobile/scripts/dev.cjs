const { spawn } = require("node:child_process");
const { existsSync } = require("node:fs");
const path = require("node:path");

const projectDir = path.resolve(__dirname, "..");
const envFile = path.resolve(projectDir, "../../.env");

if (existsSync(envFile) && typeof process.loadEnvFile === "function") {
  process.loadEnvFile(envFile);
}

const env = { ...process.env };
const replitDomain = env.REPLIT_DEV_DOMAIN;
const expoDevDomain = env.REPLIT_EXPO_DEV_DOMAIN;

if (expoDevDomain) env.EXPO_PACKAGER_PROXY_URL ??= `https://${expoDevDomain}`;
if (replitDomain) {
  env.EXPO_PUBLIC_DOMAIN ??= replitDomain;
  env.REACT_NATIVE_PACKAGER_HOSTNAME ??= replitDomain;
}
if (env.REPL_ID) env.EXPO_PUBLIC_REPL_ID ??= env.REPL_ID;

const isReplit = Boolean(env.REPLIT_DEV_DOMAIN || env.REPLIT_INTERNAL_APP_DOMAIN);
const port = env.EXPO_PORT ?? (isReplit ? env.PORT : undefined) ?? "8081";
const expoCli = require.resolve("expo/bin/cli", { paths: [projectDir] });
const child = spawn(
  process.execPath,
  [expoCli, "start", "--localhost", "--port", port],
  { cwd: projectDir, env, stdio: "inherit" },
);

child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});