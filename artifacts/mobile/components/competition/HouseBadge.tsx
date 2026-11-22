import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { getHouseMeta, type HouseName } from "@/constants/HouseTheme";

interface HouseBadgeProps {
  house: string;
  size?: "sm" | "md" | "lg";
  showEmoji?: boolean;
}

export default function HouseBadge({ house, size = "md", showEmoji = true }: HouseBadgeProps) {
  const meta = getHouseMeta(house);

  const isSm = size === "sm";
  const isLg = size === "lg";

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: meta.bgColor,
          borderColor: meta.borderColor,
          paddingHorizontal: isSm ? 6 : isLg ? 12 : 8,
          paddingVertical: isSm ? 2 : isLg ? 5 : 3,
        },
      ]}
    >
      {showEmoji && (
        <Text style={{ fontSize: isSm ? 10 : isLg ? 15 : 12, marginRight: 4 }}>
          {meta.emoji}
        </Text>
      )}
      <Text
        style={[
          styles.text,
          {
            color: meta.textColor,
            fontSize: isSm ? 10 : isLg ? 14 : 12,
            fontFamily: "Inter_700Bold",
          },
        ]}
      >
        {meta.displayName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  text: {
    letterSpacing: 0.3,
  },
});
