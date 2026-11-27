import dns from "node:dns";

// Ensure IPv4 is preferred
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // ignore
}

// Resilient public DNS resolver for Neon and external cloud databases
const publicDnsResolver = new dns.promises.Resolver();
publicDnsResolver.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);

const originalLookup = dns.lookup;
// @ts-ignore
dns.lookup = function (hostname: any, options: any, callback: any) {
  const cb = typeof options === "function" ? options : callback;
  const opts = typeof options === "object" && options !== null ? options : {};

  if (typeof hostname === "string" && hostname.includes("neon.tech")) {
    publicDnsResolver
      .resolve4(hostname)
      .then((addrs) => {
        if (addrs && addrs.length > 0) {
          if (opts.all) {
            cb(null, addrs.map((a) => ({ address: a, family: 4 })));
          } else {
            cb(null, addrs[0], 4);
          }
        } else {
          (originalLookup as any).call(dns, hostname, options, callback);
        }
      })
      .catch(() => {
        (originalLookup as any).call(dns, hostname, options, callback);
      });
    return;
  }

  return (originalLookup as any).call(dns, hostname, options, callback);
};

import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const envPaths = [
  path.resolve(currentDir, "../../../.env"),
  path.resolve(currentDir, "../../.env"),
  path.resolve(currentDir, "../.env"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
];

for (const envPath of envPaths) {
  if (existsSync(envPath) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(envPath);
      break;
    } catch {
      // ignore
    }
  }
}

import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] ?? "3001";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

process.on("unhandledRejection", (reason) => {
  logger.warn({ reason }, "Unhandled promise rejection captured; continuing server execution");
});

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
