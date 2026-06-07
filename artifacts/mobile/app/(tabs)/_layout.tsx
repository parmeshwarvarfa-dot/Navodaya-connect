import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useEffect } from "react";
import { Platform, StyleSheet, View, TouchableOpacity, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];

const TAB_ITEMS: {
  name: string;
  title: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
}[] = [
  { name: "index",    title: "JNV Connect", icon: "home-outline",        activeIcon: "home"        },
  { name: "memories", title: "Memories",    icon: "heart-outline",        activeIcon: "heart"       },
  { name: "chats",    title: "Chat Groups", icon: "chatbubble-outline",   activeIcon: "chatbubble"  },
  { name: "store",    title: "JNV Store",   icon: "bag-handle-outline",   activeIcon: "bag-handle"  },
  { name: "profile",  title: "Profile",     icon: "person-outline",       activeIcon: "person"      },
];

const HIDDEN = ["alumni", "jobs", "groups", "mentorship", "problems", "events"];

const HOUSE_COLOR: Record<string, string> = {
  Aravali:  "#1D6ADE",
  Nilgiri:  "#16A34A",
  Shivalik: "#DC2626",
  Udaygiri: "#D97706",
};

const DEFAULT_COLOR = "#3D5AF1";

function DostAiFab() {
  const insets = useSafeAreaInsets();
  const tabBarHeight = Platform.OS === "web" ? 60 : 80;
  const bottom = tabBarHeight + insets.bottom + 12;

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom }]}
      onPress={() => router.push("/(screens)/param-ai" as any)}
      activeOpacity={0.88}
    >
      <LinearGradient
        colors={["#6D5FFA", "#4B6EF5"]}
        style={styles.fabGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.roboWrap}>
          <Ionicons name="hardware-chip" size={26} color="#fff" />
        </View>
      </LinearGradient>

      <View style={styles.fabRing} />

      <View style={styles.fabLabel}>
        <Text style={styles.fabLabelText}>PA₹AM AI</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const isWeb = Platform.OS === "web";
  const tabBarHeight = isWeb ? 60 : 80;
  const paddingBottom = isWeb ? 8 : 16;
  const { profile, isVerified } = useAuth();

  const activeColor = useMemo(
    () => HOUSE_COLOR[profile?.house ?? ""] ?? DEFAULT_COLOR,
    [profile?.house]
  );

  useEffect(() => {
    if (profile && !isVerified) {
      router.replace("/(screens)/verification-center" as any);
    }
  }, [profile, isVerified]);

  return (
    <View style={{ flex: 1 }}>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: activeColor,
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

      <DostAiFab />
    </View>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    alignItems: "center",
    zIndex: 999,
  },
  fabGradient: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#4B6EF5",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  fabRing: {
    position: "absolute",
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 2,
    borderColor: "rgba(107, 95, 250, 0.3)",
    top: -6,
    left: -6,
  },
  roboWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  fabLabel: {
    marginTop: 5,
    backgroundColor: "#1E1B4B",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  fabLabelText: {
    color: "#fff",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
