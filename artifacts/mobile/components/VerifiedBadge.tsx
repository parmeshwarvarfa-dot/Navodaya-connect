import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  status?: string;
  role?: string;
  size?: "sm" | "md";
}

export function VerifiedBadge({ status, role, size = "md" }: Props) {
  if (status !== "verified") return null;

  const isTeacher  = role === "teacher";
  const isOfficial = role === "official";

  const cfg = isOfficial
    ? { color: "#D97706", bg: "#FFFBEB", label: "Coordinator",      icon: "shield-checkmark"  as const }
    : isTeacher
    ? { color: "#10B981", bg: "#ECFDF5", label: "Verified Teacher", icon: "checkmark-circle"   as const }
    : { color: "#3D5AF1", bg: "#EEF2FF", label: "Verified Alumni",  icon: "checkmark-circle"   as const };

  const sm = size === "sm";
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }, sm && styles.sm]}>
      <Ionicons name={cfg.icon} size={sm ? 11 : 13} color={cfg.color} />
      {!sm && <Text style={[styles.label, { color: cfg.color }]}>{cfg.label}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 4,
  },
  sm: { paddingHorizontal: 5, paddingVertical: 3 },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
});
