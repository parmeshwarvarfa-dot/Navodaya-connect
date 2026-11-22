import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface LiveIndicatorProps {
  status?: "LIVE" | "RECONNECTING" | "OFFLINE";
}

export default function LiveIndicator({ status = "LIVE" }: LiveIndicatorProps) {
  const isLive = status === "LIVE";
  const isReconnecting = status === "RECONNECTING";

  const dotColor = isLive ? "#10B981" : isReconnecting ? "#F59E0B" : "#9CA3AF";
  const bgColor = isLive ? "rgba(16, 185, 129, 0.15)" : isReconnecting ? "rgba(245, 158, 11, 0.15)" : "rgba(156, 163, 175, 0.15)";
  const textColor = isLive ? "#059669" : isReconnecting ? "#D97706" : "#6B7280";

  return (
    <View style={[styles.pill, { backgroundColor: bgColor, borderColor: dotColor }]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.label, { color: textColor }]}>{status}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
