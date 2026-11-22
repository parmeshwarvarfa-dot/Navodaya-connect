// Centralized Official House Identity System for Navodaya Connect
// These colours are permanent and must never be interchanged.

export type HouseName = "Aravali" | "Nilgiri" | "Shiwalik" | "Udaygiri";

export interface HouseThemeMeta {
  name: HouseName;
  displayName: string;
  color: string; // Official primary color
  secondaryColor: string;
  bgColor: string; // Soft background tint
  borderColor: string;
  textColor: string; // High contrast text
  glowColor: string;
  emoji: string;
  motto: string;
  element: string;
}

export const OFFICIAL_HOUSES: Record<HouseName, HouseThemeMeta> = {
  Aravali: {
    name: "Aravali",
    displayName: "Aravali",
    color: "#2563EB", // Official Blue
    secondaryColor: "#1D4ED8",
    bgColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    textColor: "#1E40AF",
    glowColor: "rgba(37, 99, 235, 0.4)",
    emoji: "💙",
    motto: "Courage & Integrity",
    element: "Mountains",
  },
  Nilgiri: {
    name: "Nilgiri",
    displayName: "Nilgiri",
    color: "#16A34A", // Official Green
    secondaryColor: "#15803D",
    bgColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    textColor: "#166534",
    glowColor: "rgba(22, 163, 74, 0.4)",
    emoji: "💚",
    motto: "Growth & Excellence",
    element: "Nature",
  },
  Shiwalik: {
    name: "Shiwalik",
    displayName: "Shiwalik",
    color: "#DC2626", // Official Red
    secondaryColor: "#B91C1C",
    bgColor: "#FEF2F2",
    borderColor: "#FECACA",
    textColor: "#991B1B",
    glowColor: "rgba(220, 38, 38, 0.4)",
    emoji: "❤️",
    motto: "Passion & Strength",
    element: "Fire",
  },
  Udaygiri: {
    name: "Udaygiri",
    displayName: "Udaygiri",
    color: "#EAB308", // Official Yellow / Gold
    secondaryColor: "#CA8A04",
    bgColor: "#FEFCE8",
    borderColor: "#FEF08A",
    textColor: "#854D0E",
    glowColor: "rgba(234, 179, 8, 0.4)",
    emoji: "💛",
    motto: "Wisdom & Radiance",
    element: "Sun",
  },
};

/**
 * Normalizes any house spelling variation (e.g. "Shivalik" vs "Shiwalik")
 */
export function normalizeHouseName(input?: string | null): HouseName {
  if (!input) return "Aravali";
  const lower = input.trim().toLowerCase();
  if (lower.includes("aravali")) return "Aravali";
  if (lower.includes("nilgiri")) return "Nilgiri";
  if (lower.includes("shivalik") || lower.includes("shiwalik")) return "Shiwalik";
  if (lower.includes("udaygiri") || lower.includes("udayagiri")) return "Udaygiri";
  return "Aravali";
}

export function getHouseMeta(houseName?: string | null): HouseThemeMeta {
  const normalized = normalizeHouseName(houseName);
  return OFFICIAL_HOUSES[normalized];
}
