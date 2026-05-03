import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { NewsItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STUDENT_ACTIONS = [
  { label: "Ask Alumni", icon: "chatbubble-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(tabs)/chats" },
  { label: "Report Problem", icon: "alert-circle-outline" as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/community" },
  { label: "Find Mentor", icon: "people-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/alumni" },
  { label: "AI Career Guide", icon: "ribbon-outline" as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/dost-ai" },
];

const TEACHER_ACTIONS = [
  { label: "Manage Students", icon: "people-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/community" },
  { label: "Post Update", icon: "megaphone-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/create-news" },
  { label: "Create Event", icon: "calendar-outline" as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(tabs)/events" },
  { label: "View Problems", icon: "alert-circle-outline" as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/community" },
];

const ALUMNI_ACTIONS = [
  { label: "Mentor Students", icon: "school-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/alumni" },
  { label: "Post Advice", icon: "create-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/create-news" },
  { label: "Job Referrals", icon: "briefcase-outline" as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/alumni" },
  { label: "My Network", icon: "people-outline" as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/community" },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function formatPostDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch { return dateStr; }
}

const AVATAR_COLORS = ["#3D5AF1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const role = profile?.role ?? "student";
  const isTeacher = role === "teacher";
  const isAlumni = role === "alumni";

  const quickActions = isTeacher ? TEACHER_ACTIONS : isAlumni ? ALUMNI_ACTIONS : STUDENT_ACTIONS;

  const fetchData = async () => {
    try {
      const n = await api.news.list();
      setNews(n.slice(0, 10));
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>JNV Connect</Text>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => router.push("/(screens)/notifications" as any)}
        >
          <Ionicons name="notifications-outline" size={22} color="#3D5AF1" />
          <View style={styles.bellDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3D5AF1" />
        }
      >
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeLabel}>
            {isTeacher ? "Teacher Dashboard" : "Welcome back,"}
          </Text>
          <Text style={styles.welcomeName}>{profile?.fullName || "Navodayan"}</Text>
          <Text style={styles.welcomeJnv}>{profile?.jnvName || "JNV India"}</Text>
        </View>

        {isTeacher && (
          <View style={styles.teacherStats}>
            {[
              { label: "My Classes", value: "3", icon: "school-outline" as const },
              { label: "Students", value: "86", icon: "people-outline" as const },
              { label: "Events", value: "4", icon: "calendar-outline" as const },
              { label: "Issues", value: "7", icon: "alert-circle-outline" as const },
            ].map((stat) => (
              <View key={stat.label} style={styles.teacherStatBox}>
                <Ionicons name={stat.icon} size={18} color="#3D5AF1" />
                <Text style={styles.teacherStatVal}>{stat.value}</Text>
                <Text style={styles.teacherStatLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity
                key={action.label}
                style={styles.actionCard}
                activeOpacity={0.75}
                onPress={() => router.push(action.route as any)}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={24} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {isTeacher && (
          <View style={styles.section}>
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>My Groups</Text>
              <TouchableOpacity onPress={() => router.push("/(tabs)/chats" as any)}>
                <Text style={styles.seeAll}>See All</Text>
              </TouchableOpacity>
            </View>
            {[
              { name: "Class 9A", icon: "school-outline" as const, count: 28, id: "class-9a" },
              { name: "Class 10B", icon: "school-outline" as const, count: 30, id: "class-10b" },
              { name: "Aravali House", icon: "home-outline" as const, count: 45, id: "aravali" },
            ].map((g) => (
              <TouchableOpacity key={g.name} style={styles.teacherGroupRow}
                onPress={() => router.push({ pathname: "/(screens)/group-chat" as any, params: { id: g.id, name: g.name } })}
              >
                <View style={styles.teacherGroupIcon}>
                  <Ionicons name={g.icon} size={18} color="#3D5AF1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.teacherGroupName}>{g.name}</Text>
                  <Text style={styles.teacherGroupCount}>{g.count} students</Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore More</Text>
          {[
            { label: "JNV Rankings", desc: "View India-wide & state rankings", icon: "trophy-outline" as const, iconColor: "#F59E0B", iconBg: "#FFFBEB", route: "/(screens)/rankings" },
            { label: "JNV Store", desc: "Buy merchandise, books & notes", icon: "storefront-outline" as const, iconColor: "#8B5CF6", iconBg: "#F5F3FF", route: "/(screens)/store" },
            { label: "DOST AI", desc: "Your AI guide & assistant", icon: "hardware-chip-outline" as const, iconColor: "#3D5AF1", iconBg: "#EEF2FF", route: "/(screens)/dost-ai" },
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.exploreRow}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.exploreIconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <View style={styles.exploreText}>
                <Text style={styles.exploreLabel}>{item.label}</Text>
                <Text style={styles.exploreDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Mentors</Text>
          <View style={styles.mentorsRow}>
            {[
              { id: "1", name: "Priya S.", field: "Engineering" },
              { id: "2", name: "Amit K.", field: "IAS Officer" },
              { id: "3", name: "Neha R.", field: "Medicine" },
              { id: "4", name: "Raj M.", field: "Research" },
            ].map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.mentorCard}
                activeOpacity={0.8}
                onPress={() => router.push("/(screens)/alumni" as any)}
              >
                <View style={styles.mentorAvatarWrap}>
                  <View style={styles.mentorAvatar}>
                    <Text style={styles.mentorInitial}>{m.name[0]}</Text>
                  </View>
                  <View style={styles.mentorDot} />
                </View>
                <Text style={styles.mentorName} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.mentorField} numberOfLines={1}>{m.field}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Latest Updates</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/news" as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {news.length === 0 ? (
            <View style={styles.emptyFeed}>
              <Ionicons name="newspaper-outline" size={44} color="#D1D5DB" />
              <Text style={styles.emptyText}>No updates yet</Text>
              <Text style={styles.emptySub}>Check back soon for community posts</Text>
            </View>
          ) : (
            news.map((item, i) => {
              const avatarColor = AVATAR_COLORS[i % AVATAR_COLORS.length];
              const initials = getInitials(item.authorName || "NC");
              return (
                <View key={item.id} style={styles.feedCard}>
                  <View style={styles.feedHeader}>
                    <View style={[styles.feedAvatar, { backgroundColor: avatarColor }]}>
                      <Text style={styles.feedAvatarText}>{initials}</Text>
                    </View>
                    <View style={styles.feedMeta}>
                      <Text style={styles.feedAuthor}>{item.authorName || "Navodaya Connect"}</Text>
                      <Text style={styles.feedSub}>
                        {item.category || "alumni"} · {formatPostDate(item.createdAt)}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.feedText} numberOfLines={3}>{item.description || item.title}</Text>
                  <View style={styles.feedActions}>
                    <TouchableOpacity style={styles.feedAction}>
                      <Ionicons name="heart-outline" size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.feedAction}>
                      <Ionicons name="chatbubble-outline" size={16} color="#6B7280" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.feedAction}>
                      <Ionicons name="share-social-outline" size={16} color="#6B7280" />
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
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  bellBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
  },
  bellDot: {
    position: "absolute", top: 8, right: 8,
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: "#EF4444",
    borderWidth: 1.5, borderColor: "#fff",
  },
  welcomeCard: {
    marginHorizontal: 16,
    marginTop: 16,
    backgroundColor: "#3D5AF1",
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  welcomeLabel: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular", marginBottom: 4 },
  welcomeName: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold", marginBottom: 4 },
  welcomeJnv: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_400Regular" },
  teacherStats: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  teacherStatBox: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRightWidth: 1,
    borderRightColor: "#F0F0F0",
    gap: 3,
  },
  teacherStatVal: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  teacherStatLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  seeAll: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  actionCard: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  actionIcon: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: "center", justifyContent: "center",
  },
  actionLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#111827", textAlign: "center" },
  teacherGroupRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  teacherGroupIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
  },
  teacherGroupName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  teacherGroupCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  feedCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  feedHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  feedAvatar: {
    width: 42, height: 42, borderRadius: 21,
    alignItems: "center", justifyContent: "center",
  },
  feedAvatarText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  feedMeta: { flex: 1 },
  feedAuthor: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  feedSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  feedText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 22 },
  feedActions: { flexDirection: "row", gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F5F5F5" },
  feedAction: { padding: 4 },
  emptyFeed: { alignItems: "center", paddingVertical: 40, gap: 8 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center" },
  exploreRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  exploreIconWrap: {
    width: 46, height: 46, borderRadius: 23,
    alignItems: "center", justifyContent: "center",
  },
  exploreText: { flex: 1 },
  exploreLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" },
  exploreDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  mentorsRow: { flexDirection: "row", gap: 12 },
  mentorCard: { alignItems: "center", gap: 6, width: 72 },
  mentorAvatarWrap: { position: "relative" },
  mentorAvatar: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#3D5AF1",
  },
  mentorDot: {
    position: "absolute", bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    backgroundColor: "#10B981",
    borderWidth: 2, borderColor: "#fff",
  },
  mentorInitial: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  mentorName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#111827" },
  mentorField: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },
});
