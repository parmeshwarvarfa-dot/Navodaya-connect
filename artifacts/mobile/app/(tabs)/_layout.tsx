import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, useColorScheme } from "react-native";
import { BlurView } from "expo-blur";
import { useColors } from "@/hooks/useColors";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ITEMS: {
  name: string;
  title: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
}[] = [
  { name: "index", title: "Home", icon: "home-outline", activeIcon: "home" },
  { name: "alumni", title: "Alumni", icon: "people-outline", activeIcon: "people" },
  { name: "events", title: "Events", icon: "calendar-outline", activeIcon: "calendar" },
  { name: "jobs", title: "Jobs", icon: "briefcase-outline", activeIcon: "briefcase" },
  { name: "profile", title: "Profile", icon: "person-outline", activeIcon: "person" },
];

export default function TabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";
  const tabBarHeight = isWeb ? 60 : 80;
  const paddingBottom = isWeb ? 8 : 16;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.saffron,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.card,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 10,
          height: tabBarHeight,
          paddingBottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontFamily: "Inter_500Medium",
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={80}
              tint={isDark ? "dark" : "light"}
              style={StyleSheet.absoluteFill}
            />
          ) : (
            <View
              style={[
                StyleSheet.absoluteFill,
                { backgroundColor: colors.card },
              ]}
            />
          ),
      }}
    >
      {TAB_ITEMS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{
            title: tab.title,
            tabBarIcon: ({ color, focused }) => (
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={22}
                color={color}
              />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
