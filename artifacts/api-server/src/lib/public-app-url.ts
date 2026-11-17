/** Public web origin used in shareable credential verification and profile links. */
export function getPublicAppUrl(env: NodeJS.ProcessEnv = process.env): string {
  const configured = env.PUBLIC_APP_URL?.trim()
    || env.REPLIT_DEV_DOMAIN?.trim()
    || env.REPLIT_INTERNAL_APP_DOMAIN?.trim()
    || env.EXPO_PUBLIC_DOMAIN?.trim()
    || env.EXPO_PUBLIC_APP_URL?.trim()
    || "";
  if (!configured) return "";

  try {
    const withProtocol = /^https?:\/\//i.test(configured) ? configured : `https://${configured}`;
    const url = new URL(withProtocol);
    if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") return "";
    return url.origin.replace(/\/$/, "");
  } catch {
    return "";
  }
}
