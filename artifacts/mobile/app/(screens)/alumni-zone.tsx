import React, { useCallback, useState } from "react";
import { View, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { ThemedText as Text } from "@/components/ThemedNative";

const FEATURES = [
  { label: "Mentorship", icon: "people-outline" as const, color: "#7C3AED", bg: "#F5F3FF", route: "/(screens)/alumni-mentorship" },
  { label: "Blood Donation Help", icon: "water-outline" as const, color: "#DC2626", bg: "#FEF2F2", route: "/(screens)/alumni-community" },
  { label: "Contributions",  icon: "ribbon-outline"           as const, color: "#D97706", bg: "#FFFBEB", route: "/(screens)/alumni-contributions"  },
  { label: "Support JNV",    icon: "heart-outline"            as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/alumni-support"        },
];

export default function AlumniZoneScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [connectionsCount, setConnectionsCount] = useState<number | null>(null);
  const [contributionCount, setContributionCount] = useState<number | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const isVerified = profile?.role === "alumni"
    ? ["community_verified", "under_review"].includes(profile.verificationStatus ?? "") && !!profile.communityVerifiedAt
    : profile?.verificationStatus === "verified";

  useFocusEffect(useCallback(() => {
    let active = true;
    setStatsLoading(true);
    Promise.allSettled([api.connections.list(), api.recognition.summary()])
      .then(([connectionsResult, recognitionResult]) => {
        if (!active) return;
        setConnectionsCount(connectionsResult.status === "fulfilled"
          ? connectionsResult.value.filter((connection) => connection.status === "connected").length
          : null);
        const count = recognitionResult.status === "fulfilled" ? recognitionResult.value.contributionCount : null;
        setContributionCount(typeof count === "number" && Number.isFinite(count) && count >= 0 ? count : null);
      })
      .finally(() => { if (active) setStatsLoading(false); });
    return () => { active = false; };
  }, [profile?.uid]));

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#7C3AED", "#6366F1"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreet}>{greeting}, {profile?.fullName?.split(" ")[0] || "Alumni"}</Text>
          <Text style={styles.headerTitle}>Alumni Zone</Text>
        </View>
        {isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/(screens)/notifications" as any)}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Connections", value: statsLoading ? "—" : connectionsCount ?? "—", icon: "people-outline" as const, color: "#7C3AED", bg: "#F5F3FF" },
            { label: "Contributions", value: statsLoading ? "—" : contributionCount ?? "—", icon: "ribbon-outline" as const, color: "#8B5CF6", bg: "#F5F3FF" },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>


        {/* Feature Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Features</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <TouchableOpacity key={f.label} style={styles.featureCard} activeOpacity={0.75} onPress={() => router.push(f.route as any)}>
                <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon} size={24} color={f.color} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  headerGreet: { color: "rgba(255,255,255,0.85)", fontSize: 11.5, fontFamily: "Inter_500Medium" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  notifBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 14 },
  statCard: { flex: 1, borderRadius: 16, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.6)" },
  statVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#64748B", textAlign: "center" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
  mentorRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E9D5FF", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  mentorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  mentorAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#7C3AED" },
  mentorStudent: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", marginBottom: 2 },
  mentorClass: { fontFamily: "Inter_400Regular", color: "#94A3B8", fontSize: 12 },
  mentorGoal: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#64748B", marginBottom: 2 },
  mentorTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  acceptBtn: { backgroundColor: "#F5F3FF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
  eventCard: { backgroundColor: "#fff", borderRadius: 18, padding: 14, width: 200, borderWidth: 1, borderColor: "#E9D5FF", gap: 5, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  eventEmptyCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E9D5FF" },
  eventEmptyText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#64748B" },
  eventType: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#7C3AED", textTransform: "uppercase", letterSpacing: 0.5 },
  eventTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", lineHeight: 19 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  eventDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  eventDivider: { color: "#CBD5E1" },
  rsvpBtn: { backgroundColor: "#F5F3FF", borderRadius: 10, paddingVertical: 7, alignItems: "center", marginTop: 4 },
  rsvpBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#7C3AED" },
  achieveRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E9D5FF", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  achieveBadge: { fontSize: 22 },
  achieveName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", marginBottom: 3 },
  achieveYear: { fontFamily: "Inter_400Regular", color: "#94A3B8", fontSize: 12 },
  achieveText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  oppRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E9D5FF", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  oppIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  oppTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", marginBottom: 2 },
  oppTypePill: { backgroundColor: "#F5F3FF", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  oppTypeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
  oppTarget: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  urgentPill: { backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  urgentText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  featureCard: { width: "31%", backgroundColor: "#fff", borderRadius: 18, padding: 14, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#E9D5FF", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  featureIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", textAlign: "center" },
});
