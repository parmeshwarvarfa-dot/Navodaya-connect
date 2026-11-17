import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { UserRole } from "@/context/AuthContext";

type RoleConfig = {
  label: string;
  bg: string;
  text: string;
  border: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
};

const ROLE_CONFIG: Record<UserRole, RoleConfig> = {
  student: { label: "Student", bg: "#EFF6FF", text: "#1D4ED8", border: "#BFDBFE", icon: "school-outline" },
  alumni: { label: "Alumni", bg: "#F5F3FF", text: "#6D28D9", border: "#DDD6FE", icon: "people-outline" },
  teacher: { label: "Teacher", bg: "#ECFDF5", text: "#047857", border: "#A7F3D0", icon: "book-outline" },
  official: { label: "JNV Official", bg: "#FFF7ED", text: "#C2410C", border: "#FED7AA", icon: "business-outline" },
};

export function RoleBadge({ role }: { role: UserRole | string }) {
  const config = ROLE_CONFIG[role as UserRole] ?? {
    label: role || "Member", bg: "#F3F4F6", text: "#4B5563", border: "#D1D5DB", icon: "person-outline" as const,
  };
  return (
    <View accessibilityRole="text" accessibilityLabel={`Account role: ${config.label}`} style={[styles.badge, { backgroundColor: config.bg, borderColor: config.border }]}>
      <Ionicons name={config.icon} size={13} color={config.text} />
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
