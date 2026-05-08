import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const BADGES = [
  { icon: "school-outline"      as const, color: "#10B981", bg: "#ECFDF5", label: "Active Mentor",        earned: true,  desc: "Completed 5+ mentorship sessions"          },
  { icon: "checkmark-circle"    as const, color: "#3D5AF1", bg: "#EEF2FF", label: "Verified Alumni",       earned: true,  desc: "Identity verified by school coordinator"    },
  { icon: "briefcase-outline"   as const, color: "#0891B2", bg: "#E0F2FE", label: "Opportunity Sharer",   earned: true,  desc: "Shared 3+ opportunities with students"      },
  { icon: "trophy-outline"      as const, color: "#F59E0B", bg: "#FFFBEB", label: "Top Contributor",      earned: false, desc: "Earn by reaching 500 contribution points"   },
  { icon: "ribbon-outline"      as const, color: "#8B5CF6", bg: "#F5F3FF", label: "Community Leader",     earned: false, desc: "Manage an active community with 100+ members"},
  { icon: "star-outline"        as const, color: "#EC4899", bg: "#FDF2F8", label: "Featured Alumni",      earned: false, desc: "Selected by admin for alumni spotlight"      },
];

const MY_STATS = [
  { label: "Mentorship Sessions",    value: 8,   points: 160, icon: "school-outline"     as const, color: "#10B981" },
  { label: "Queries Answered",       value: 24,  points: 120, icon: "help-circle-outline" as const, color: "#3D5AF1" },
  { label: "Opportunities Posted",   value: 4,   points: 80,  icon: "briefcase-outline"  as const, color: "#0891B2" },
  { label: "Events Attended",        value: 6,   points: 60,  icon: "calendar-outline"   as const, color: "#8B5CF6" },
  { label: "Achievements Shared",    value: 3,   points: 45,  icon: "trophy-outline"     as const, color: "#F59E0B" },
  { label: "Community Posts",        value: 12,  points: 36,  icon: "chatbubble-outline" as const, color: "#EC4899" },
];

const LEADERBOARD = [
  { rank: 1, name: "Kavita Singh",   jnv: "JNV Patna",    points: 892, badge: "🥇", mentees: 31 },
  { rank: 2, name: "Rahul Verma",    jnv: "JNV Lucknow",  points: 743, badge: "🥈", mentees: 24 },
  { rank: 3, name: "Dr. Meera Iyer", jnv: "JNV Kochi",    points: 689, badge: "🥉", mentees: 18 },
  { rank: 4, name: "Arjun Sharma",   jnv: "JNV Jaipur",   points: 521, badge: "4",  mentees: 15 },
  { rank: 5, name: "Manish Kumar",   jnv: "JNV Ranchi",   points: 487, badge: "5",  mentees: 12 },
];

const totalPoints = MY_STATS.reduce((s, m) => s + m.points, 0);
const nextMilestone = 600;

export default function AlumniContributionsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [activeTab, setActiveTab] = useState<"mine" | "badges" | "top">("mine");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Contributions & Recognition</Text>
      </View>

      {/* Points hero */}
      <View style={styles.pointsCard}>
        <View style={styles.pointsLeft}>
          <Text style={styles.pointsLabel}>My Contribution Score</Text>
          <Text style={styles.pointsValue}>{totalPoints}</Text>
          <Text style={styles.pointsNext}>Next milestone: {nextMilestone} pts → Top Contributor</Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.min((totalPoints / nextMilestone) * 100, 100)}%` }]} />
          </View>
        </View>
        <View style={styles.pointsRight}>
          <View style={styles.rankCircle}>
            <Text style={styles.rankText}>#6</Text>
          </View>
          <Text style={styles.rankLabel}>Your Rank</Text>
        </View>
      </View>

      <View style={styles.tabBar}>
        {([["mine", "My Contributions"], ["badges", "Badges"], ["top", "Leaderboard"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tabBtn, activeTab === key && styles.tabBtnActive]} onPress={() => setActiveTab(key)}>
            <Text style={[styles.tabBtnText, activeTab === key && styles.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>

        {activeTab === "mine" && (
          <>
            <Text style={styles.sectionLabel}>Breakdown by Activity</Text>
            {MY_STATS.map((s) => (
              <View key={s.label} style={styles.statRow}>
                <View style={[styles.statIcon, { backgroundColor: s.color + "18" }]}>
                  <Ionicons name={s.icon} size={20} color={s.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.statLabel}>{s.label}</Text>
                  <View style={styles.statBarRow}>
                    <View style={styles.statBarTrack}>
                      <View style={[styles.statBarFill, { width: `${Math.min((s.points / 200) * 100, 100)}%`, backgroundColor: s.color }]} />
                    </View>
                    <Text style={styles.statPointsText}>{s.points} pts</Text>
                  </View>
                </View>
                <View style={[styles.countBadge, { backgroundColor: s.color + "18" }]}>
                  <Text style={[styles.countBadgeText, { color: s.color }]}>{s.value}x</Text>
                </View>
              </View>
            ))}
          </>
        )}

        {activeTab === "badges" && (
          <>
            <Text style={styles.sectionLabel}>Earned {BADGES.filter((b) => b.earned).length} of {BADGES.length} badges</Text>
            <View style={styles.badgeGrid}>
              {BADGES.map((b, i) => (
                <View key={i} style={[styles.badgeCard, !b.earned && styles.badgeCardLocked]}>
                  <View style={[styles.badgeIcon, { backgroundColor: b.earned ? b.bg : "#F3F4F6" }]}>
                    <Ionicons name={b.icon} size={28} color={b.earned ? b.color : "#D1D5DB"} />
                  </View>
                  {!b.earned && <View style={styles.lockOverlay}><Ionicons name="lock-closed" size={14} color="#9CA3AF" /></View>}
                  <Text style={[styles.badgeLabel, !b.earned && styles.badgeLabelLocked]}>{b.label}</Text>
                  <Text style={styles.badgeDesc}>{b.desc}</Text>
                  {b.earned && <View style={styles.earnedPill}><Ionicons name="checkmark-circle" size={12} color="#10B981" /><Text style={styles.earnedText}>Earned</Text></View>}
                </View>
              ))}
            </View>
          </>
        )}

        {activeTab === "top" && (
          <>
            <Text style={styles.sectionLabel}>Top Contributors this Month</Text>
            {LEADERBOARD.map((l, i) => (
              <View key={i} style={[styles.leaderRow, l.rank <= 3 && styles.leaderRowTop]}>
                <Text style={styles.leaderBadge}>{l.rank <= 3 ? l.badge : l.rank}</Text>
                <View style={styles.leaderAvatar}><Text style={styles.leaderAvatarText}>{l.name[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.leaderName}>{l.name}</Text>
                  <Text style={styles.leaderJnv}>{l.jnv} · {l.mentees} mentees</Text>
                </View>
                <View style={styles.leaderPoints}>
                  <Text style={styles.leaderPointsText}>{l.points}</Text>
                  <Text style={styles.leaderPointsLabel}>pts</Text>
                </View>
              </View>
            ))}
            <View style={styles.yourRankRow}>
              <Text style={styles.yourRankLabel}>You are ranked #6 with {totalPoints} pts</Text>
              <Text style={styles.yourRankHint}>Answer more queries and mentor students to climb the leaderboard!</Text>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  pointsCard: { flexDirection: "row", alignItems: "center", margin: 16, backgroundColor: "#fff", borderRadius: 18, padding: 18, borderWidth: 1, borderColor: "#F0F0F0" },
  pointsLeft: { flex: 1 },
  pointsLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 4 },
  pointsValue: { fontSize: 40, fontFamily: "Inter_700Bold", color: "#10B981", lineHeight: 46 },
  pointsNext: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 4, marginBottom: 8 },
  progressTrack: { height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#10B981", borderRadius: 3 },
  pointsRight: { alignItems: "center", gap: 4 },
  rankCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#D97706", alignItems: "center", justifyContent: "center" },
  rankText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  rankLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  tabBar: { flexDirection: "row", backgroundColor: "#F3F4F6", marginHorizontal: 16, borderRadius: 12, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#fff" },
  tabBtnText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6B7280" },
  tabBtnTextActive: { color: "#111827", fontFamily: "Inter_600SemiBold" },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6B7280", marginBottom: 12 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  statIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  statLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 6 },
  statBarRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statBarTrack: { flex: 1, height: 5, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" },
  statBarFill: { height: "100%", borderRadius: 3 },
  statPointsText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6B7280", width: 50, textAlign: "right" },
  countBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  countBadgeText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  badgeCard: { width: "47%", backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", gap: 6, position: "relative" },
  badgeCardLocked: { opacity: 0.7 },
  badgeIcon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center" },
  lockOverlay: { position: "absolute", top: 10, right: 10 },
  badgeLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#111827", textAlign: "center" },
  badgeLabelLocked: { color: "#9CA3AF" },
  badgeDesc: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", lineHeight: 14 },
  earnedPill: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  earnedText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  leaderRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  leaderRowTop: { borderColor: "#FDE68A", borderWidth: 1.5 },
  leaderBadge: { fontSize: 22, width: 28, textAlign: "center" },
  leaderAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  leaderAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#10B981" },
  leaderName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  leaderJnv: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  leaderPoints: { alignItems: "center" },
  leaderPointsText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#D97706" },
  leaderPointsLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  yourRankRow: { backgroundColor: "#EEF2FF", borderRadius: 14, padding: 14, marginTop: 4, borderWidth: 1, borderColor: "#C7D2FE" },
  yourRankLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1", marginBottom: 4 },
  yourRankHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
});
