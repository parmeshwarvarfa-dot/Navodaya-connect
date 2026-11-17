import * as Linking from "expo-linking";
import { Platform } from "react-native";

export function createDigitalIdProfileUrl(userId: string) {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return new URL(`/profile/${encodeURIComponent(userId)}`, window.location.origin).toString();
  }
  return Linking.createURL(`profile/${encodeURIComponent(userId)}`);
}

export function isDigitalId(value: string) {
  return /^NC-(?:STU|ALU|TCH|OFC)-[A-F0-9]{10}$/i.test(value.replace(/\s/g, ""));
}

export function parseDigitalIdProfileLink(value: string) {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 2048) return null;
  try {
    const url = new URL(trimmed);
    const allowedScheme = url.protocol === "mobile:" && url.hostname === "";
    const configuredWebOrigin = process.env.EXPO_PUBLIC_APP_URL?.trim()
      || (process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN.trim()}` : "");
    const allowedWebOrigin = url.protocol === "https:" && (
      (configuredWebOrigin !== "" && url.origin === new URL(configuredWebOrigin).origin)
      || (typeof window !== "undefined" && url.origin === window.location.origin)
    ) || url.protocol === "http:" && __DEV__ && url.hostname === "localhost"
    if (!allowedScheme && !allowedWebOrigin) return null;
    const match = url.pathname.match(/^\/profile\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/?$/i);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}
