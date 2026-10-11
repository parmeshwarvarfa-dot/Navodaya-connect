import React from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { api, type Achievement } from "@/lib/api";

const CATEGORY_COLORS: Record<string, string> = {
  Placement: "#10B981",
  "College Admission": "#3D5AF1",
  "UPSC/Gov": "#8B5CF6",
  Startup: "#F59E0B",
  Research: "#0891B2",
  Sports: "#EC4899",
  Award: "#D97706",
  Career: "#6366F1",
};

export default function AchievementsHighlights() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/achievements"],
    queryFn: () => api.achievements.list(),
  });
  const items = (data ?? []).slice(0, 3);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <View style={styles.icon}>
            <Ionicons name="trophy-outline" size={17} color="#8B5CF6" />
          </View>
          <Text style={styles.title}>Achievements</Text>
        </View>
        <TouchableOpacity onPress={() => router.push("/(screens)/alumni-achievements" as any)}>
          <Text style={styles.link}>See all</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <ActivityIndicator color="#8B5CF6" style={{ paddingVertical: 12 }} />
      ) : isError ? (
        <Text style={styles.empty}>Achievements couldn’t be loaded. Pull to refresh or try again later.</Text>
      ) : items.length === 0 ? (
        <Text style={styles.empty}>No achievements shared yet. Be the first to share one.</Text>
      ) : (
        items.map((item: Achievement) => {
          const color = CATEGORY_COLORS[item.category] || "#6B7280";
          return (
            <View key={item.id} style={styles.item}>
              <View style={[styles.marker, { backgroundColor: `${color}18` }]}>
                <Ionicons name="ribbon-outline" size={17} color={color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.achievementTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {[item.authorName, item.jnvName, item.batch].filter(Boolean).join(" · ") || item.category}
                </Text>
              </View>
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#F0F0F0", padding: 15, marginHorizontal: 16, marginTop: 14 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  icon: { width: 30, height: 30, borderRadius: 10, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  link: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6D4AFF" },
  item: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 9, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  marker: { width: 34, height: 34, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  achievementTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  meta: { marginTop: 3, fontSize: 11, fontFamily: "Inter_400Regular", color: "#8B93A1" },
  empty: { paddingVertical: 10, color: "#737B89", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular" },
});
