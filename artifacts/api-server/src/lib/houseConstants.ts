export type HouseName = "Aravali" | "Nilgiri" | "Shiwalik" | "Udaygiri";

export interface HouseConfig {
  name: HouseName;
  displayName: string;
  color: string;
  emoji: string;
  motto: string;
}

export const OFFICIAL_HOUSES: Record<HouseName, HouseConfig> = {
  Aravali: {
    name: "Aravali",
    displayName: "Aravali",
    color: "#2563EB",
    emoji: "💙",
    motto: "Courage & Integrity",
  },
  Nilgiri: {
    name: "Nilgiri",
    displayName: "Nilgiri",
    color: "#16A34A",
    emoji: "💚",
    motto: "Growth & Excellence",
  },
  Shiwalik: {
    name: "Shiwalik",
    displayName: "Shiwalik",
    color: "#DC2626",
    emoji: "❤️",
    motto: "Passion & Strength",
  },
  Udaygiri: {
    name: "Udaygiri",
    displayName: "Udaygiri",
    color: "#EAB308",
    emoji: "💛",
    motto: "Wisdom & Radiance",
  },
};

export const ALL_HOUSES: HouseName[] = ["Aravali", "Nilgiri", "Shiwalik", "Udaygiri"];

export function normalizeHouseName(input?: string | null): HouseName {
  if (!input) return "Aravali";
  const lower = input.trim().toLowerCase();
  if (lower.includes("aravali")) return "Aravali";
  if (lower.includes("nilgiri")) return "Nilgiri";
  if (lower.includes("shivalik") || lower.includes("shiwalik")) return "Shiwalik";
  if (lower.includes("udaygiri") || lower.includes("udayagiri")) return "Udaygiri";
  return "Aravali";
}
