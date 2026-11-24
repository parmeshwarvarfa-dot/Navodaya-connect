import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type RankingProfileData } from "@/lib/api";

interface UserRankingProfileModalProps {
  userId: string | null;
  visible: boolean;
  onClose: () => void;
}

export default function UserRankingProfileModal({
  userId,
  visible,
  onClose,
}: UserRankingProfileModalProps) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState<RankingProfileData | null>(null);

  useEffect(() => {
    if (!userId || !visible) return;
    async function loadProfile() {
      try {
        setLoading(true);
        const res = await api.ranking.profile(userId!);
        setProfileData(res);
      } catch (e) {
        console.warn("Failed to load ranking profile", e);
      } finally {
        setLoading(false);
      }
    }
    void loadProfile();
  }, [userId, visible]);

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 14 : insets.top + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Contributor Ranking Profile</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#1E293B" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centerLoading}>
            <ActivityIndicator size="large" color="#7C3AED" />
            <Text style={styles.loadingText}>Fetching verified contribution records...</Text>
          </View>
        ) : profileData ? (
          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {/* Hero Profile Card */}
            <LinearGradient colors={["#1E1B4B", "#312E81", "#4338CA"]} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                {profileData.user.avatarUrl ? (
                  <Image source={{ uri: profileData.user.avatarUrl }} style={styles.avatar} />
                ) : (
                  <View style={styles.avatarFallback}>
                    <Text style={styles.avatarInitials}>
                      {profileData.user.fullName.substring(0, 2).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.heroText}>
                  <Text style={styles.userName}>{profileData.user.fullName}</Text>
                  <Text style={styles.userJnv}>
                    {profileData.user.jnvName} • {profileData.user.jnvState}
                  </Text>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{profileData.user.role.toUpperCase()}</Text>
                  </View>
                </View>
              </View>

              {/* Stats Bar */}
              <View style={styles.heroStatsRow}>
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>All-India Rank</Text>
                  <Text style={styles.statVal}>#{profileData.stats.rank}</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>Total Verified XP</Text>
                  <Text style={[styles.statVal, { color: "#FBBF24" }]}>
                    {profileData.stats.totalPoints.toLocaleString()} pts
                  </Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={styles.statLabel}>This Month</Text>
                  <Text style={styles.statVal}>
                    +{profileData.stats.monthlyPoints.toLocaleString()}
                  </Text>
                </View>
              </View>
            </LinearGradient>

            {/* Badge Tier Progress */}
            <View style={styles.card}>
              <View style={styles.badgeCardHeader}>
                <View style={[styles.badgeIconWrap, { backgroundColor: `${profileData.stats.badge.color}20` }]}>
                  <Ionicons name={profileData.stats.badge.icon as any} size={20} color={profileData.stats.badge.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>Current Badge: {profileData.stats.badge.badgeTitle}</Text>
                  <Text style={styles.cardSubtitle}>
                    {profileData.stats.badge.currentPoints.toLocaleString()} / {profileData.stats.badge.nextTierPoints.toLocaleString()} pts
                  </Text>
                </View>
                <Text style={[styles.percentText, { color: profileData.stats.badge.color }]}>
                  {profileData.stats.badge.progressPercent}%
                </Text>
              </View>

              <View style={styles.progressBarTrack}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${profileData.stats.badge.progressPercent}%`,
                      backgroundColor: profileData.stats.badge.color,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Earned Awards */}
            {profileData.earnedAwards.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>🏆 Official Awards</Text>
                <View style={styles.awardsList}>
                  {profileData.earnedAwards.map((aw) => (
                    <View key={aw.id} style={styles.awardItem}>
                      <Text style={styles.awardMedal}>🥇</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.awardTitle}>
                          {aw.awardType === "navodayan_of_the_month" ? "Navodayan of the Month" : "Navodayan of the Year"}
                        </Text>
                        <Text style={styles.awardPeriod}>Period: {aw.period}</Text>
                        <Text style={styles.awardSummary}>{aw.summary}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Activity Category Breakdown */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊 Verified Activity Breakdown</Text>
              <View style={styles.activityList}>
                {profileData.activityBreakdown.map((act) => (
                  <View key={act.activity} style={styles.activityRow}>
                    <Text style={styles.activityName}>
                      {act.activity.replaceAll("_", " ").toUpperCase()}
                    </Text>
                    <View style={styles.actNumbers}>
                      <Text style={styles.actCount}>{act.count} times</Text>
                      <Text style={styles.actPoints}>+{act.totalPoints} pts</Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>

            {/* Recent Ledger History */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📜 Points Transaction History</Text>
              <View style={styles.historyList}>
                {profileData.pointsHistory.map((item) => (
                  <View key={item.id} style={styles.historyRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.historyReason}>{item.reason}</Text>
                      <Text style={styles.historyDate}>
                        {new Date(item.createdAt).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </Text>
                    </View>
                    <Text style={[styles.historyPoints, { color: item.points >= 0 ? "#059669" : "#DC2626" }]}>
                      {item.points >= 0 ? `+${item.points}` : item.points} pts
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </ScrollView>
        ) : (
          <View style={styles.centerLoading}>
            <Text style={styles.loadingText}>No contribution profile found.</Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0F172A",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  scrollContent: {
    padding: 16,
    gap: 14,
  },
  heroCard: {
    borderRadius: 18,
    padding: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 16,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "#4338CA",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  avatarInitials: {
    fontSize: 22,
    fontWeight: "600",
    color: "#fff",
  },
  heroText: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  userJnv: {
    fontSize: 12,
    color: "#C7D2FE",
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  roleText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#fff",
  },
  heroStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingVertical: 10,
  },
  statBox: {
    alignItems: "center",
  },
  statLabel: {
    fontSize: 10,
    color: "#C7D2FE",
  },
  statVal: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 22,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
  },
  cardSubtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  badgeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  badgeIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  percentText: {
    fontSize: 14,
    fontWeight: "600",
  },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  awardsList: {
    gap: 10,
    marginTop: 10,
  },
  awardItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#FEFCE8",
    borderWidth: 1,
    borderColor: "#FEF08A",
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  awardMedal: {
    fontSize: 22,
  },
  awardTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#854D0E",
  },
  awardPeriod: {
    fontSize: 11,
    color: "#A16207",
    marginTop: 1,
  },
  awardSummary: {
    fontSize: 12,
    color: "#713F12",
    marginTop: 3,
    lineHeight: 16,
  },
  activityList: {
    gap: 8,
    marginTop: 10,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  activityName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },
  actNumbers: {
    alignItems: "flex-end",
  },
  actCount: {
    fontSize: 11,
    color: "#64748B",
  },
  actPoints: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C3AED",
  },
  historyList: {
    gap: 8,
    marginTop: 10,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  historyReason: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1E293B",
  },
  historyDate: {
    fontSize: 10,
    color: "#94A3B8",
    marginTop: 1,
  },
  historyPoints: {
    fontSize: 13,
    fontWeight: "600",
  },
});
