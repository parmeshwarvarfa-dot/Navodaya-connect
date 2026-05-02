import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { UserRole } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const ROLE_CONFIG: Record<UserRole, { label: string; bg: string; text: string }> = {
  student: { label: "Student", bg: "#DBEAFE", text: "#1D4ED8" },
  alumni: { label: "Alumni", bg: "#D1FAE5", text: "#065F46" },
  teacher: { label: "Teacher", bg: "#FEF3C7", text: "#92400E" },
  official: { label: "Official", bg: "#EDE9FE", text: "#5B21B6" },
};

export function RoleBadge({ role }: { role: UserRole }) {
  const config = ROLE_CONFIG[role];
  return (
    <View style={[styles.badge, { backgroundColor: config.bg }]}>
      <Text style={[styles.text, { color: config.text }]}>{config.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  text: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
});
