const required = [
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_APP_URL",
  "EXPO_PUBLIC_FIREBASE_API_KEY",
  "EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "EXPO_PUBLIC_FIREBASE_PROJECT_ID",
  "EXPO_PUBLIC_FIREBASE_APP_ID",
  "EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET",
  "EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
];

const missing = required.filter((name) => !process.env[name]?.trim());
if (missing.length > 0) {
  throw new Error(
    `Missing Cloudflare build configuration: ${missing.join(", ")}`,
  );
}

function requireHttpsOrigin(name) {
  const value = process.env[name].trim();
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} must be a valid HTTPS URL.`);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error(`${name} must be a credential-free HTTPS URL.`);
  }
  return url;
}

const apiUrl = requireHttpsOrigin("EXPO_PUBLIC_API_URL");
if (apiUrl.hostname === "localhost" || apiUrl.hostname === "127.0.0.1") {
  throw new Error(
    "EXPO_PUBLIC_API_URL must point to the deployed staging API, not localhost.",
  );
}
if (!apiUrl.pathname.replace(/\/+$/, "").endsWith("/api")) {
  throw new Error("EXPO_PUBLIC_API_URL must end in /api.");
}

const appUrl = requireHttpsOrigin("EXPO_PUBLIC_APP_URL");
if (appUrl.pathname !== "/" || appUrl.search || appUrl.hash) {
  throw new Error(
    "EXPO_PUBLIC_APP_URL must be the Pages site origin without a path.",
  );
}

console.info("Cloudflare build configuration validated.");
