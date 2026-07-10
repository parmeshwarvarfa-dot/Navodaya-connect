import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";

const MOCK_NOTIFICATIONS = [
  { id: "1", type: "news", title: "New announcement", body: "Annual Sports Day scheduled for next month", time: "2 hours ago", read: false },
  { id: "2", type: "group", title: "Group update", body: "Your teacher posted new notes in Science Group", time: "5 hours ago", read: false },
  { id: "3", type: "mentorship", title: "Mentorship request", body: "Your request was accepted by Rahul Kumar", time: "1 day ago", read: true },
  { id: "4", type: "event", title: "Event reminder", body: "Alumni Meet is tomorrow at 10 AM", time: "1 day ago", read: true },
  { id: "5", type: "problem", title: "Problem update", body: "Your reported issue is now In Progress", time: "2 days ago", read: true },
];

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  news: { icon: "newspaper-outline", color: "#3B82F6" },
  group: { icon: "chatbubbles-outline", color: "#8B5CF6" },
  mentorship: { icon: "star-outline", color: "#F59E0B" },
  event: { icon: "calendar-outline", color: "#10B981" },
  problem: { icon: "alert-circle-outline", color: "#EF4444" },
};

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <FlatList
        data={MOCK_NOTIFICATIONS}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const config = TYPE_ICONS[item.type] || TYPE_ICONS.news;
          return (
            <TouchableOpacity activeOpacity={0.8}>
              <PremiumCard
                style={[
                  styles.notifCard,
                  !item.read ? { borderLeftWidth: 3, borderLeftColor: colors.primary } : {},
                ] as any}
              >
                <View style={styles.notifRow}>
                  <View style={[styles.iconBg, { backgroundColor: config.color + "15" }]}>
                    <Ionicons name={config.icon as any} size={20} color={config.color} />
                  </View>
                  <View style={styles.notifContent}>
                    <Text style={[styles.notifTitle, { color: colors.foreground }]}>
                      {item.title}
                    </Text>
                    <Text style={[styles.notifBody, { color: colors.mutedForeground }]}>
                      {item.body}
                    </Text>
                    <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>
                      {item.time}
                    </Text>
                  </View>
                  {!item.read && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}
                </View>
              </PremiumCard>
            </TouchableOpacity>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  listContent: { padding: 16 },
  notifCard: { marginBottom: 8 },
  notifRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  iconBg: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  notifBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
});
