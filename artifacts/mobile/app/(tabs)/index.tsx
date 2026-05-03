import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { NewsItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { RoleBadge } from "@/components/RoleBadge";
import { SectionHeader } from "@/components/SectionHeader";

const FEATURE_CARDS = [
  { id: "news", icon: "newspaper-outline", label: "News", color: "#3B82F6", route: "/(screens)/news" },
  { id: "events", icon: "calendar-outline", label: "Events", color: "#8B5CF6", route: "/(screens)/events" },
  { id: "rankings", icon: "trophy-outline", label: "Rankings", color: "#F59E0B", route: "/(screens)/rankings" },
  { id: "store", icon: "bag-outline", label: "Store", color: "#10B981", route: "/(screens)/store" },
  { id: "alumni", icon: "people-outline", label: "Alumni", color: "#EF4444", route: "/(screens)/alumni" },
  { id: "community", icon: "globe-outline", label: "Community", color: "#06B6D4", route: "/(screens)/community" },
];

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchNews = async () => {
    try {
      const items = await api.news.list();
      setNews(items.slice(0, 5));
    } catch {}
  };

  useEffect(() => { fetchNews(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNews();
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.userName}>
              {profile?.fullName?.split(" ")[0] || "Navodayan"}
            </Text>
          </View>
          <TouchableOpacity
            style={styles.notifBtn}
            onPress={() => router.push("/(screens)/notifications")}
          >
            <Ionicons name="notifications-outline" size={22} color="#fff" />
            <View style={styles.notifDot} />
          </TouchableOpacity>
        </View>
        {profile && (
          <View style={styles.profileChip}>
            <RoleBadge role={profile.role} />
            <Text style={styles.jnvText} numberOfLines={1}>
              {profile.jnvName}
            </Text>
          </View>
        )}
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={styles.featuresSection}>
          <SectionHeader title="Explore" />
          <View style={styles.featuresGrid}>
            {FEATURE_CARDS.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={[
                  styles.featureCard,
                  {
                    backgroundColor: colors.card,
                    borderRadius: colors.radius,
                    borderColor: colors.border,
                    shadowColor: colors.shadow,
                  },
                ]}
                onPress={() => router.push(f.route as any)}
                activeOpacity={0.8}
              >
                <View style={[styles.featureIcon, { backgroundColor: f.color + "18" }]}>
                  <Ionicons name={f.icon as any} size={22} color={f.color} />
                </View>
                <Text style={[styles.featureLabel, { color: colors.foreground }]}>
                  {f.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader
            title="Latest News"
            action="View All"
            onAction={() => router.push("/(screens)/news" as any)}
          />
          {news.length === 0 ? (
            <PremiumCard>
              <View style={styles.emptyState}>
                <Ionicons name="newspaper-outline" size={36} color={colors.mutedForeground} />
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                  No news yet
                </Text>
              </View>
            </PremiumCard>
          ) : (
            news.map((item) => (
              <TouchableOpacity
                key={item.id}
                activeOpacity={0.9}
              >
                <PremiumCard style={styles.newsCard}>
                  <View style={styles.newsCategoryRow}>
                    <View style={[styles.categoryBadge, { backgroundColor: colors.accent }]}>
                      <Text style={[styles.categoryText, { color: colors.primary }]}>
                        {item.category || "General"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.newsTitle, { color: colors.foreground }]}>
                    {item.title}
                  </Text>
                  <Text style={[styles.newsDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                    {item.description}
                  </Text>
                </PremiumCard>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <SectionHeader title="Quick Actions" />
          <View style={styles.quickActions}>
            {(profile?.role === "teacher" || profile?.role === "official") && (
              <TouchableOpacity
                style={[styles.quickCard, { backgroundColor: colors.primary, borderRadius: colors.radius }]}
                onPress={() => router.push("/(screens)/news" as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle" size={20} color="#fff" />
                <Text style={styles.quickCardText}>Post News</Text>
              </TouchableOpacity>
            )}
            {profile?.role === "student" && (
              <TouchableOpacity
                style={[styles.quickCard, { backgroundColor: "#8B5CF6", borderRadius: colors.radius }]}
                onPress={() => router.push("/(tabs)/problems" as any)}
                activeOpacity={0.85}
              >
                <Ionicons name="alert-circle" size={20} color="#fff" />
                <Text style={styles.quickCardText}>Report Problem</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: "#10B981", borderRadius: colors.radius }]}
              onPress={() => router.push("/(tabs)/mentorship" as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="star" size={20} color="#fff" />
              <Text style={styles.quickCardText}>Find Mentor</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.quickCard, { backgroundColor: "#F59E0B", borderRadius: colors.radius }]}
              onPress={() => router.push("/(screens)/events" as any)}
              activeOpacity={0.85}
            >
              <Ionicons name="calendar" size={20} color="#fff" />
              <Text style={styles.quickCardText}>Events</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 24 },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  greeting: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular" },
  userName: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold" },
  notifBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  notifDot: {
    position: "absolute", top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#F59E0B",
    borderWidth: 1.5, borderColor: "#1E40AF",
  },
  profileChip: { flexDirection: "row", alignItems: "center", gap: 8 },
  jnvText: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_500Medium", flex: 1 },
  scrollContent: { padding: 16 },
  featuresSection: { marginBottom: 24 },
  featuresGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureCard: {
    width: "30%", aspectRatio: 1,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1, shadowRadius: 8, elevation: 2, gap: 6,
  },
  featureIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 12, fontFamily: "Inter_500Medium" },
  section: { marginBottom: 24 },
  newsCard: { marginBottom: 10 },
  newsCategoryRow: { marginBottom: 6 },
  categoryBadge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  categoryText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  newsTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 6, lineHeight: 22 },
  newsDesc: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19 },
  emptyState: { alignItems: "center", paddingVertical: 24, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  quickActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickCard: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, gap: 6 },
  quickCardText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
