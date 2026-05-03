import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { NewsItem, Event } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const QUICK_ACTIONS = [
  { label: "Alumni", icon: "people", route: "/(tabs)/alumni" as const, color: "#1A3C6E" },
  { label: "Events", icon: "calendar", route: "/(tabs)/events" as const, color: "#FF7A00" },
  { label: "Jobs", icon: "briefcase", route: "/(tabs)/jobs" as const, color: "#16A34A" },
  { label: "Groups", icon: "chatbubbles", route: "/(tabs)/groups" as const, color: "#8B5CF6" },
  { label: "News", icon: "newspaper", route: "/(screens)/news" as const, color: "#EF4444" },
  { label: "Mentorship", icon: "star", route: "/(tabs)/mentorship" as const, color: "#F59E0B" },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "Just now";
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchData = async () => {
    try {
      const [n, e] = await Promise.all([api.news.list(), api.events.list()]);
      setNews(n.slice(0, 8));
      setEvents(e.slice(0, 3));
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  const AVATAR_COLORS = ["#1A3C6E", "#FF7A00", "#16A34A", "#8B5CF6", "#EF4444"];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerTop}>
          <View style={styles.logoRow}>
            <View style={styles.logoIcon}>
              <Ionicons name="school" size={20} color="#FF7A00" />
            </View>
            <View>
              <Text style={styles.appName}>Navodaya Connect</Text>
              <Text style={styles.appTagline}>Navodayans Together</Text>
            </View>
          </View>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={() => router.push("/(screens)/notifications" as any)}
            >
              <Ionicons name="notifications-outline" size={20} color="#fff" />
              <View style={styles.notifDot} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="chatbubble-outline" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.searchPlaceholder, { color: colors.mutedForeground }]}>
            Search alumni, posts, events…
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.saffron} />
        }
      >
        <View style={styles.greetingRow}>
          <Text style={[styles.greeting, { color: colors.foreground }]}>
            {greeting()}, <Text style={[styles.greetingName, { color: colors.primary }]}>{profile?.fullName?.split(" ")[0] || "Navodayan"}</Text>
          </Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroll} contentContainerStyle={styles.quickContent}>
          {QUICK_ACTIONS.map((action) => (
            <TouchableOpacity
              key={action.label}
              style={[styles.quickChip, { backgroundColor: action.color + "15", borderColor: action.color + "30" }]}
              onPress={() => router.push(action.route as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.quickChipIcon, { backgroundColor: action.color + "20" }]}>
                <Ionicons name={action.icon as any} size={16} color={action.color} />
              </View>
              <Text style={[styles.quickChipLabel, { color: action.color }]}>{action.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {events.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.primary }]}>Upcoming Events</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/events" as any)}>
                <Text style={[styles.seeAll, { color: colors.saffron }]}>See all</Text>
              </TouchableOpacity>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              {events.map((event) => (
                <View key={event.id} style={[styles.eventCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={[styles.eventAccent, { backgroundColor: colors.saffron }]} />
                  <View style={styles.eventCardBody}>
                    <Text style={[styles.eventTitle, { color: colors.primary }]} numberOfLines={2}>{event.title}</Text>
                    <View style={styles.eventMeta}>
                      <Ionicons name="calendar-outline" size={12} color={colors.mutedForeground} />
                      <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]}>{event.date}</Text>
                    </View>
                    {event.location && (
                      <View style={styles.eventMeta}>
                        <Ionicons name="location-outline" size={12} color={colors.mutedForeground} />
                        <Text style={[styles.eventMetaText, { color: colors.mutedForeground }]}>{event.location}</Text>
                      </View>
                    )}
                    <TouchableOpacity style={[styles.rsvpBtn, { backgroundColor: colors.saffron }]}>
                      <Text style={styles.rsvpText}>RSVP</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
          </View>
        )}

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Community Feed</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/news" as any)}>
              <Text style={[styles.seeAll, { color: colors.saffron }]}>View All</Text>
            </TouchableOpacity>
          </View>

          {(profile?.role === "teacher" || profile?.role === "official") && (
            <TouchableOpacity
              style={[styles.createPostBar, { backgroundColor: colors.card, borderColor: colors.border }]}
              onPress={() => router.push("/(screens)/news" as any)}
            >
              <View style={[styles.createAvatar, { backgroundColor: colors.primary }]}>
                <Text style={styles.createAvatarText}>{getInitials(profile.fullName || "N")}</Text>
              </View>
              <Text style={[styles.createPostText, { color: colors.mutedForeground }]}>Share something with the community…</Text>
              <View style={[styles.postBtn, { backgroundColor: colors.saffron }]}>
                <Text style={styles.postBtnText}>Post</Text>
              </View>
            </TouchableOpacity>
          )}

          {news.length === 0 ? (
            <View style={[styles.emptyFeed, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name="newspaper-outline" size={40} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No posts yet</Text>
              <Text style={[styles.emptySubText, { color: colors.mutedForeground }]}>Be the first to share something!</Text>
            </View>
          ) : (
            news.map((item, i) => {
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const initials = getInitials(item.authorName || "NC");
              return (
                <View key={item.id} style={[styles.feedCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.feedCardHeader}>
                    <View style={[styles.feedAvatar, { backgroundColor: avatarColor }]}>
                      <Text style={styles.feedAvatarText}>{initials}</Text>
                    </View>
                    <View style={styles.feedAuthorInfo}>
                      <Text style={[styles.feedAuthorName, { color: colors.foreground }]}>
                        {item.authorName || "Navodaya Connect"}
                      </Text>
                      <Text style={[styles.feedMeta, { color: colors.mutedForeground }]}>
                        {item.jnvName ? `${item.jnvName} · ` : ""}{timeAgo(item.createdAt)}
                      </Text>
                    </View>
                    <View style={[styles.categoryPill, { backgroundColor: colors.saffronLight }]}>
                      <Text style={[styles.categoryPillText, { color: colors.saffron }]}>{item.category || "General"}</Text>
                    </View>
                  </View>

                  <Text style={[styles.feedTitle, { color: colors.foreground }]}>{item.title}</Text>
                  <Text style={[styles.feedDesc, { color: colors.mutedForeground }]} numberOfLines={3}>
                    {item.description}
                  </Text>

                  <View style={[styles.feedActions, { borderTopColor: colors.border }]}>
                    <TouchableOpacity style={styles.feedAction}>
                      <Ionicons name="heart-outline" size={18} color={colors.mutedForeground} />
                      <Text style={[styles.feedActionText, { color: colors.mutedForeground }]}>Like</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.feedAction}>
                      <Ionicons name="chatbubble-outline" size={18} color={colors.mutedForeground} />
                      <Text style={[styles.feedActionText, { color: colors.mutedForeground }]}>Comment</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.feedAction}>
                      <Ionicons name="share-social-outline" size={18} color={colors.mutedForeground} />
                      <Text style={[styles.feedActionText, { color: colors.mutedForeground }]}>Share</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  appName: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  appTagline: { color: "rgba(255,255,255,0.65)", fontSize: 11, fontFamily: "Inter_400Regular" },
  headerActions: { flexDirection: "row", gap: 8 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 7, right: 7, width: 7, height: 7, borderRadius: 4, backgroundColor: "#FF7A00", borderWidth: 1.5, borderColor: "#0D2B6E" },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchPlaceholder: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  scrollContent: { paddingTop: 12 },
  greetingRow: { paddingHorizontal: 16, marginBottom: 12 },
  greeting: { fontSize: 16, fontFamily: "Inter_400Regular" },
  greetingName: { fontFamily: "Inter_700Bold" },
  quickScroll: { marginBottom: 16 },
  quickContent: { paddingHorizontal: 16, gap: 8 },
  quickChip: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, gap: 6 },
  quickChipIcon: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  quickChipLabel: { fontSize: 13, fontFamily: "Inter_500Medium" },
  section: { paddingHorizontal: 16, marginBottom: 20 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  eventCard: { width: 220, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  eventAccent: { height: 4 },
  eventCardBody: { padding: 14 },
  eventTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8, lineHeight: 20 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  eventMetaText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  rsvpBtn: { marginTop: 10, paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, alignSelf: "flex-start" },
  rsvpText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  createPostBar: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 12, gap: 10 },
  createAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  createAvatarText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  createPostText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  postBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20 },
  postBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  feedCard: { borderRadius: 12, borderWidth: 1, marginBottom: 12, overflow: "hidden" },
  feedCardHeader: { flexDirection: "row", alignItems: "center", padding: 14, gap: 10 },
  feedAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  feedAvatarText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  feedAuthorInfo: { flex: 1 },
  feedAuthorName: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  feedMeta: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  categoryPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
  categoryPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  feedTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", paddingHorizontal: 14, marginBottom: 6, lineHeight: 22 },
  feedDesc: { fontSize: 13, fontFamily: "Inter_400Regular", paddingHorizontal: 14, lineHeight: 20, marginBottom: 12 },
  feedActions: { flexDirection: "row", borderTopWidth: 1, paddingVertical: 4 },
  feedAction: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 8 },
  feedActionText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  emptyFeed: { borderRadius: 12, borderWidth: 1, padding: 40, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySubText: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
