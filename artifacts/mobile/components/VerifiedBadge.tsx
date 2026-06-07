import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface Props {
  status?: string | null;
  role?: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function VerifiedBadge({ status, role, size = "md", showLabel = true }: Props) {
  const sm = size === "sm";
  const lg = size === "lg";
  const iconSize = sm ? 11 : lg ? 16 : 13;
  const textSize = sm ? 9 : lg ? 13 : 11;
  const padH = sm ? 5 : lg ? 10 : 8;
  const padV = sm ? 2 : lg ? 5 : 3;

  const isOfficial = role === "official";
  const isTeacher  = role === "teacher";

  if (status === "verified") {
    const cfg = isOfficial
      ? { color: "#D97706", bg: "#FFFBEB", label: "Coordinator",      icon: "shield-checkmark" as const }
      : isTeacher
      ? { color: "#10B981", bg: "#ECFDF5", label: "Verified Teacher", icon: "checkmark-circle"  as const }
      : { color: "#10B981", bg: "#ECFDF5", label: "Verified",         icon: "checkmark-circle"  as const };
    return (
      <View style={[s.badge, { backgroundColor: cfg.bg, paddingHorizontal: padH, paddingVertical: padV, borderColor: cfg.color + "40", borderWidth: 1 }]}>
        <Ionicons name={cfg.icon} size={iconSize} color={cfg.color} />
        {showLabel && !sm && <Text style={[s.label, { color: cfg.color, fontSize: textSize }]}>{cfg.label}</Text>}
      </View>
    );
  }

  if (status === "pending") {
    return (
      <View style={[s.badge, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderWidth: 1, paddingHorizontal: padH, paddingVertical: padV }]}>
        <Ionicons name="time" size={iconSize} color="#D97706" />
        {showLabel && !sm && <Text style={[s.label, { color: "#D97706", fontSize: textSize }]}>Pending</Text>}
      </View>
    );
  }

  if (status === "rejected") {
    return (
      <View style={[s.badge, { backgroundColor: "#FEF2F2", borderColor: "#FECACA", borderWidth: 1, paddingHorizontal: padH, paddingVertical: padV }]}>
        <Ionicons name="close-circle" size={iconSize} color="#EF4444" />
        {showLabel && !sm && <Text style={[s.label, { color: "#EF4444", fontSize: textSize }]}>Rejected</Text>}
      </View>
    );
  }

  if (status === "suspended") {
    return (
      <View style={[s.badge, { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB", borderWidth: 1, paddingHorizontal: padH, paddingVertical: padV }]}>
        <Ionicons name="ban" size={iconSize} color="#6B7280" />
        {showLabel && !sm && <Text style={[s.label, { color: "#6B7280", fontSize: textSize }]}>Suspended</Text>}
      </View>
    );
  }

  return null;
}

const s = StyleSheet.create({
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 20, alignSelf: "flex-start" },
  label: { fontFamily: "Inter_600SemiBold" },
});
