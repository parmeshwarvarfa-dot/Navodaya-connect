import React from "react";
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import type { RankingOverviewData } from "@/lib/api";

interface RankingOverviewSectionProps {
  data: RankingOverviewData | null;
  onSelectUser: (userId: string) => void;
  onNavigateTab: (tab: "individual" | "jnv" | "awards") => void;
}

export default function RankingOverviewSection({
  data,
  onSelectUser,
  onNavigateTab,
}: RankingOverviewSectionProps) {
  if (!data) return null;

  const { userStats, topIndividuals, topJnvs, currentAwards, recentActivity } = data;

  return (
    <View style={styles.container}>
      {/* 1. User's Personal Ranking & Badge Status Card */}
      <LinearGradient colors={["#1E1B4B", "#312E81", "#4338CA"]} style={styles.userCard}>
        <View style={styles.userCardHeader}>
          <View style={styles.userCardLeft}>
            <Text style={styles.userGreeting}>YOUR CONTRIBUTION STATUS</Text>
            <Text style={styles.userName}>{userStats.fullName}</Text>
            <Text style={styles.userSchool}>{userStats.jnvName}</Text>
          </View>
          <View style={styles.userRankPill}>
            <Text style={styles.userRankLabel}>ALL-INDIA RANK</Text>
            <Text style={styles.userRankValue}>#{userStats.rank}</Text>
          </View>
        </View>

        {/* Badge Tier Row */}
        <View style={styles.badgeProgressBox}>
          <View style={styles.badgeRow}>
            <View style={[styles.badgeIconBubble, { backgroundColor: `${userStats.badge.color}30` }]}>
              <Ionicons name={userStats.badge.icon as any} size={18} color={userStats.badge.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.badgeTitle}>{userStats.badge.badgeTitle}</Text>
              <Text style={styles.badgePointsSub}>
                {userStats.badge.currentPoints.toLocaleString()} / {userStats.badge.nextTierPoints.toLocaleString()} pts to next badge
              </Text>
            </View>
            <Text style={[styles.badgePercentText, { color: userStats.badge.color }]}>
              {userStats.badge.progressPercent}%
            </Text>
          </View>

          <View style={styles.progressBarTrack}>
            <View
              style={[
                styles.progressBarFill,
                { width: `${userStats.badge.progressPercent}%`, backgroundColor: userStats.badge.color },
              ]}
            />
          </View>
        </View>

        {/* User Numbers Row */}
        <View style={styles.userPointsBar}>
          <View style={styles.pointBlock}>
            <Text style={styles.pointBlockLabel}>Total Verified XP</Text>
            <Text style={[styles.pointBlockNum, { color: "#FBBF24" }]}>
              {userStats.totalPoints.toLocaleString()} pts
            </Text>
          </View>
          <View style={styles.dividerV} />
          <View style={styles.pointBlock}>
            <Text style={styles.pointBlockLabel}>Points This Month</Text>
            <Text style={styles.pointBlockNum}>
              +{userStats.monthPoints.toLocaleString()} pts
            </Text>
          </View>
          <View style={styles.dividerV} />
          <TouchableOpacity
            style={styles.viewProfileBtn}
            onPress={() => onSelectUser(userStats.userId)}
          >
            <Text style={styles.viewProfileBtnText}>Full Profile</Text>
            <Ionicons name="chevron-forward" size={13} color="#fff" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* 2. Spotlight Official Awards */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>🏆 Current Spotlight Awards</Text>
          <TouchableOpacity onPress={() => onNavigateTab("awards")}>
            <Text style={styles.seeAllLink}>View All Awards →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.awardsGrid}>
          {/* Navodaya of the Month */}
          {currentAwards.navodayaMonth && (
            <View style={[styles.awardCard, { borderLeftColor: "#EAB308" }]}>
              <View style={styles.awardCardTop}>
                <Text style={styles.awardEmoji}>🏫</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.awardOverline}>NAVODAYA OF THE MONTH</Text>
                  <Text style={styles.awardWinnerTitle}>{currentAwards.navodayaMonth.winnerJnvName}</Text>
                  <Text style={styles.awardState}>{currentAwards.navodayaMonth.winnerJnvState}</Text>
                </View>
                <View style={styles.awardScoreBadge}>
                  <Text style={styles.awardScoreText}>{currentAwards.navodayaMonth.score}/100</Text>
                </View>
              </View>
              <Text style={styles.awardSummaryText} numberOfLines={2}>
                {currentAwards.navodayaMonth.summary}
              </Text>
            </View>
          )}

          {/* Navodayan of the Month */}
          {currentAwards.navodayanMonth && (
            <View style={[styles.awardCard, { borderLeftColor: "#7C3AED" }]}>
              <View style={styles.awardCardTop}>
                <Text style={styles.awardEmoji}>🌟</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.awardOverline}>NAVODAYAN OF THE MONTH</Text>
                  <Text style={styles.awardWinnerTitle}>{currentAwards.navodayanMonth.winnerName}</Text>
                  <Text style={styles.awardState}>
                    {currentAwards.navodayanMonth.winnerRole?.toUpperCase()} • {currentAwards.navodayanMonth.winnerJnvName}
                  </Text>
                </View>
                <View style={[styles.awardScoreBadge, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                  <Text style={[styles.awardScoreText, { color: "#7C3AED" }]}>
                    +{currentAwards.navodayanMonth.score} pts
                  </Text>
                </View>
              </View>
              <Text style={styles.awardSummaryText} numberOfLines={2}>
                {currentAwards.navodayanMonth.summary}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 3. Top 3 Individual Champions */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>🌟 Top Individual Champions</Text>
          <TouchableOpacity onPress={() => onNavigateTab("individual")}>
            <Text style={styles.seeAllLink}>Full Leaderboard →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.podiumRow}>
          {/* 2nd place */}
          {topIndividuals[1] && (
            <TopPlayerPodium
              item={topIndividuals[1]}
              rank={2}
              badgeEmoji="🥈"
              metalColor="#94A3B8"
              onSelect={onSelectUser}
            />
          )}
          {/* 1st place */}
          {topIndividuals[0] && (
            <TopPlayerPodium
              item={topIndividuals[0]}
              rank={1}
              badgeEmoji="👑"
              metalColor="#EAB308"
              elevated
              onSelect={onSelectUser}
            />
          )}
          {/* 3rd place */}
          {topIndividuals[2] && (
            <TopPlayerPodium
              item={topIndividuals[2]}
              rank={3}
              badgeEmoji="🥉"
              metalColor="#B45309"
              onSelect={onSelectUser}
            />
          )}
        </View>
      </View>

      {/* 4. Top Institutional JNVs */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionHeading}>🏫 Top Ranked JNVs</Text>
          <TouchableOpacity onPress={() => onNavigateTab("jnv")}>
            <Text style={styles.seeAllLink}>JNV Index →</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.topJnvList}>
          {topJnvs.map((jnv, idx) => (
            <View key={jnv.id} style={styles.topJnvCard}>
              <Text style={styles.jnvRankMedal}>{["🥇", "🥈", "🥉"][idx] || `#${idx + 1}`}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.jnvName}>{jnv.jnvName}</Text>
                <Text style={styles.jnvState}>{jnv.jnvState}</Text>
              </View>
              <View style={styles.jnvScoreBlock}>
                <Text style={styles.jnvScoreNum}>{jnv.totalScore}</Text>
                <Text style={styles.jnvScoreLabel}>Index / 100</Text>
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 5. Recent Verified Activities */}
      <View style={styles.sectionBlock}>
        <Text style={styles.sectionHeading}>⚡ Live Activity Ticker</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentScroll}>
          {recentActivity.map((act) => (
            <View key={act.id} style={styles.recentPill}>
              <Ionicons name="sparkles" size={12} color="#7C3AED" />
              <Text style={styles.recentUser} numberOfLines={1}>
                {act.userName}
              </Text>
              <Text style={styles.recentReason} numberOfLines={1}>
                {act.reason}
              </Text>
              <View style={styles.recentPtsBadge}>
                <Text style={styles.recentPtsText}>+{act.points} pts</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

function TopPlayerPodium({
  item,
  rank,
  badgeEmoji,
  metalColor,
  elevated,
  onSelect,
}: {
  item: any;
  rank: number;
  badgeEmoji: string;
  metalColor: string;
  elevated?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.podiumCard,
        elevated && styles.podiumElevated,
        { borderColor: metalColor },
      ]}
      onPress={() => onSelect(item.userId)}
      activeOpacity={0.8}
    >
      <View style={[styles.podiumRankBadge, { borderColor: metalColor }]}>
        <Text style={styles.podiumBadgeEmoji}>{badgeEmoji}</Text>
        <Text style={[styles.podiumRankNum, { color: metalColor }]}>#{rank}</Text>
      </View>

      <View style={[styles.podiumAvatarWrap, { borderColor: metalColor }]}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.podiumAvatar} />
        ) : (
          <View style={styles.podiumAvatarFallback}>
            <Text style={styles.podiumAvatarInitials}>
              {item.fullName.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.podiumName} numberOfLines={1}>
        {item.fullName}
      </Text>
      <Text style={styles.podiumSchool} numberOfLines={1}>
        {item.jnvName}
      </Text>

      <View style={styles.podiumPtsWrap}>
        <Ionicons name="trophy" size={11} color={metalColor} />
        <Text style={[styles.podiumPts, { color: metalColor }]}>
          {Number(item.totalPoints).toLocaleString()} pts
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 20,
  },
  userCard: {
    borderRadius: 20,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  userCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  userCardLeft: {
    flex: 1,
  },
  userGreeting: {
    fontSize: 9,
    fontWeight: "800",
    color: "#C7D2FE",
    letterSpacing: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
    marginTop: 2,
  },
  userSchool: {
    fontSize: 12,
    color: "#E2E8F0",
    marginTop: 2,
  },
  userRankPill: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  userRankLabel: {
    fontSize: 8,
    fontWeight: "800",
    color: "#FBBF24",
    letterSpacing: 0.5,
  },
  userRankValue: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
  },
  badgeProgressBox: {
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 14,
    padding: 12,
    marginVertical: 12,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  badgeIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
  },
  badgePointsSub: {
    fontSize: 10,
    color: "#CBD5E1",
  },
  badgePercentText: {
    fontSize: 13,
    fontWeight: "800",
  },
  progressBarTrack: {
    height: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  userPointsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(0, 0, 0, 0.15)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  pointBlock: {
    alignItems: "center",
  },
  pointBlockLabel: {
    fontSize: 9,
    color: "#C7D2FE",
  },
  pointBlockNum: {
    fontSize: 13,
    fontWeight: "800",
    color: "#fff",
    marginTop: 2,
  },
  dividerV: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  viewProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  viewProfileBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fff",
  },
  sectionBlock: {},
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7C3AED",
  },
  awardsGrid: {
    gap: 10,
  },
  awardCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderLeftWidth: 4,
  },
  awardCardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 6,
  },
  awardEmoji: {
    fontSize: 22,
  },
  awardOverline: {
    fontSize: 9,
    fontWeight: "800",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  awardWinnerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
  },
  awardState: {
    fontSize: 11,
    color: "#64748B",
  },
  awardScoreBadge: {
    backgroundColor: "#FEFCE8",
    borderWidth: 1,
    borderColor: "#FEF08A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  awardScoreText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#854D0E",
  },
  awardSummaryText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
    paddingTop: 8,
  },
  podiumCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  podiumElevated: {
    transform: [{ translateY: -10 }],
    borderWidth: 2,
    shadowOpacity: 0.1,
  },
  podiumRankBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    gap: 2,
  },
  podiumBadgeEmoji: {
    fontSize: 11,
  },
  podiumRankNum: {
    fontSize: 10,
    fontWeight: "800",
  },
  podiumAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  podiumAvatar: {
    width: "100%",
    height: "100%",
  },
  podiumAvatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EEF2F6",
    alignItems: "center",
    justifyContent: "center",
  },
  podiumAvatarInitials: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  podiumName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  podiumSchool: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    marginTop: 1,
  },
  podiumPtsWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
  },
  podiumPts: {
    fontSize: 11,
    fontWeight: "800",
  },
  topJnvList: {
    gap: 8,
  },
  topJnvCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  jnvRankMedal: {
    fontSize: 22,
  },
  jnvName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  jnvState: {
    fontSize: 11,
    color: "#64748B",
  },
  jnvScoreBlock: {
    alignItems: "flex-end",
  },
  jnvScoreNum: {
    fontSize: 16,
    fontWeight: "900",
    color: "#7C3AED",
  },
  jnvScoreLabel: {
    fontSize: 9,
    color: "#94A3B8",
    fontWeight: "600",
  },
  recentScroll: {
    gap: 8,
    paddingVertical: 6,
  },
  recentPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
  },
  recentUser: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
    maxWidth: 90,
  },
  recentReason: {
    fontSize: 11,
    color: "#64748B",
    maxWidth: 120,
  },
  recentPtsBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  recentPtsText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#059669",
  },
});
