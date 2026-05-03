import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ITEMS: {
  name: string;
  title: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
}[] = [
  { name: "index", title: "JNV Connect", icon: "home-outline", activeIcon: "home" },
  { name: "memories", title: "Memories", icon: "heart-outline", activeIcon: "heart" },
  { name: "chats", title: "Chat Groups", icon: "chatbubble-outline", activeIcon: "chatbubble" },
  { name: "events", title: "Events", icon: "calendar-outline", activeIcon: "calendar" },
  { name: "profile", title: "Profile", icon: "person-outline", activeIcon: "person" },
];

const HIDDEN = ["alumni", "jobs", "groups", "mentorship", "problems"];

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const tabBarHeight = isWeb ? 60 : 80;
  const paddingBottom = isWeb ? 8 : 16;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#3D5AF1",
        tabBarInactiveTintColor: "#9CA3AF",
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#fff",
          borderTopWidth: 1,
          borderTopColor: "#F0F0F0",
          elevation: 8,
          height: tabBarHeight,
          paddingBottom,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontFamily: "Inter_500Medium",
        },
        tabBarBackground: () => (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: "#fff" }]} />
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
              <Ionicons name={focused ? tab.activeIcon : tab.icon} size={22} color={color} />
            ),
          }}
        />
      ))}
      {HIDDEN.map((name) => (
        <Tabs.Screen key={name} name={name} options={{ href: null }} />
      ))}
    </Tabs>
  );
}
