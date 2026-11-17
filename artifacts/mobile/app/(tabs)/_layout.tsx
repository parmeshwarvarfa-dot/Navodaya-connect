import { Tabs, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View, TouchableOpacity, Text } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useReducedMotion } from "@/components/motion/MotionProvider";

type IoniconsName = React.ComponentProps<typeof Ionicons>["name"];
type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>["tabBar"]>>[0];

const TAB_ITEMS: {
  name: string;
  title: string;
  icon: IoniconsName;
  activeIcon: IoniconsName;
}[] = [
  { name: "index",    title: "Home",     icon: "home-outline",       activeIcon: "home" },
  { name: "memories", title: "Memories", icon: "heart-outline",      activeIcon: "heart" },
  { name: "chats",    title: "Chats",    icon: "chatbubble-outline", activeIcon: "chatbubble" },
  { name: "events",   title: "Events",   icon: "calendar-outline",   activeIcon: "calendar" },
  { name: "profile",  title: "Profile",  icon: "person-outline",     activeIcon: "person" },
];

const HIDDEN = ["alumni", "jobs", "groups", "mentorship", "problems", "store"];

function DostAiFab() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottom = (isWeb ? 86 : 94 + insets.bottom);

  return (
    <TouchableOpacity
      style={[styles.fab, { bottom }]}
      onPress={() => router.push("/(screens)/param-ai" as any)}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="Ask Param AI"
    >
      <LinearGradient
        colors={["#8B5CF6", "#6D28D9"]}
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

function FloatingTabBar({ state, navigation }: TabBarProps) {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";
  const bottomPad = isWeb ? 12 : Math.max(12, insets.bottom);

  return (
    <View pointerEvents="box-none" style={[styles.tabBarWrapper, { bottom: bottomPad }]}>
      <View style={styles.floatingBar}>
        {TAB_ITEMS.map((item) => {
          const routeIndex = state.routes.findIndex((r: { name: string }) => r.name === item.name);
          if (routeIndex === -1) return null;
          const route = state.routes[routeIndex];
          const isFocused = state.index === routeIndex;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const onLongPress = () => {
            navigation.emit({
              type: "tabLongPress",
              target: route.key,
            });
          };

          if (isFocused) {
            return (
              <TouchableOpacity
                key={item.name}
                accessibilityRole="button"
                accessibilityState={{ selected: true }}
                accessibilityLabel={item.title}
                onPress={onPress}
                onLongPress={onLongPress}
                style={styles.tabItemActiveWrap}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={["#8B5CF6", "#6D28D9"]}
                  style={styles.activeCircle}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name={item.activeIcon} size={22} color="#FFFFFF" />
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={item.name}
              accessibilityRole="button"
              accessibilityState={{ selected: false }}
              accessibilityLabel={item.title}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabItem}
              activeOpacity={0.7}
            >
              <Ionicons name={item.icon} size={20} color="#64748B" />
              <Text style={styles.tabLabelInactive}>{item.title}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

export default function TabLayout() {
  const reducedMotion = useReducedMotion();

  return (
    <View style={{ flex: 1, backgroundColor: "#F8F7FF" }}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{
          animation: reducedMotion === false ? "fade" : "none",
          headerShown: false,
        }}
      >
        {TAB_ITEMS.map((tab) => (
          <Tabs.Screen
            key={tab.name}
            name={tab.name}
            options={{ title: tab.title }}
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
  tabBarWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 900,
  },
  floatingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#FFFFFF",
    borderRadius: 36,
    width: "92%",
    maxWidth: 520,
    height: 64,
    paddingHorizontal: 8,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 20,
    elevation: 16,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  tabItemActiveWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  activeCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  tabLabelInactive: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    marginTop: 3,
  },
  fab: {
    position: "absolute",
    right: 18,
    alignItems: "center",
    zIndex: 999,
  },
  fabGradient: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 12,
  },
  fabRing: {
    position: "absolute",
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: "rgba(139, 92, 246, 0.3)",
    top: -6,
    left: -6,
  },
  roboWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  fabLabel: {
    marginTop: 4,
    backgroundColor: "#1E1B4B",
    borderRadius: 8,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
  },
  fabLabelText: {
    color: "#FFFFFF",
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },
});
