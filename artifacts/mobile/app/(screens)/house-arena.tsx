import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { OFFICIAL_HOUSES, normalizeHouseName, type HouseName } from "@/constants/HouseTheme";
import { api, type CompetitionDashboardData, type CompetitionActivityItem, type GameResult } from "@/lib/api";

import LiveIndicator from "@/components/competition/LiveIndicator";
import BattleArenaSection from "@/components/competition/BattleArenaSection";
import DailyPuzzleSection from "@/components/competition/DailyPuzzleSection";
import LeaderboardSection from "@/components/competition/LeaderboardSection";
import EventsSection from "@/components/competition/EventsSection";
import AdminCompetitionModal from "@/components/competition/AdminCompetitionModal";
import GamePlayModal from "@/components/games/GamePlayModal";

type CompetitionTab = "battles" | "daily_puzzles" | "games" | "leaderboards" | "events";

type Challenge = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  status: "live" | "qualifying";
  points: number;
  pointsNote?: string;
  gameId: GameResult["gameId"];
};

const SOLO_CHALLENGES: Challenge[] = [
  { id: "gk-blitz", title: "GK Blitz Quiz", desc: "2-min rapid-fire general knowledge", icon: "🧠", color: "#7C3AED", bg: "#F5F3FF", status: "live", points: 50, gameId: "gk-blitz" },
  { id: "chess-cup", title: "House Chess Cup", desc: "Local two-player play · tournament qualifying", icon: "♟️", color: "#374151", bg: "#F3F4F6", status: "qualifying", points: 120, pointsNote: "tournament only", gameId: "chess-cup" },
  { id: "word-master", title: "Word Master", desc: "Speed spelling showdown", icon: "🔤", color: "#8B5CF6", bg: "#F5F3FF", status: "live", points: 60, gameId: "word-master" },
  { id: "math-ninja", title: "Number Ninja", desc: "Mental maths speed round", icon: "🔢", color: "#10B981", bg: "#ECFDF5", status: "live", points: 70, gameId: "math-ninja" },
  { id: "art-battle", title: "Art Battle", desc: "Draw your JNV memory in 60 sec", icon: "🎨", color: "#EF4444", bg: "#FEF2F2", status: "live", points: 80, gameId: "art-battle" },
];

export default function HouseArenaScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [activeTab, setActiveTab] = useState<CompetitionTab>("battles");
  const [dashboard, setDashboard] = useState<CompetitionDashboardData | null>(null);
  const [activities, setActivities] = useState<CompetitionActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [activeSoloGame, setActiveSoloGame] = useState<Challenge | null>(null);
  const [adminModalVisible, setAdminModalVisible] = useState(false);

  const userHouseName: HouseName = normalizeHouseName(profile?.house);
  const userHouseMeta = OFFICIAL_HOUSES[userHouseName];
  const userHouseStanding = dashboard?.houseStandings?.find(
    (h) => normalizeHouseName(h.house) === userHouseName
  );
  const canAccessAdmin = profile?.role === "official" || profile?.role === "teacher";

  const fetchDashboardData = useCallback(async () => {
    try {
      const [dashRes, actRes] = await Promise.allSettled([
        api.competition.dashboard(),
        api.competition.activityFeed(),
      ]);

      if (dashRes.status === "fulfilled") {
        setDashboard(dashRes.value);
      }
      if (actRes.status === "fulfilled") {
        setActivities(actRes.value.activities || []);
      }
    } catch (err) {
      console.warn("Failed to load competition dashboard", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboardData();
  }, [fetchDashboardData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchDashboardData();
  }, [fetchDashboardData]);

  return (
    <View style={styles.container}>
      {/* Top Header Bar */}
      <View style={[styles.pageHeader, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={22} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Inter House Competition 2.0</Text>
          <View style={styles.headerStatusRow}>
            <LiveIndicator status={(dashboard?.connectionStatus as any) || "LIVE"} />
            <Text style={styles.seasonBadge}>SEASON 2026-Q4</Text>
          </View>
        </View>

        {canAccessAdmin ? (
          <TouchableOpacity
            style={styles.adminHeaderBtn}
            onPress={() => setAdminModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Admin Hub"
          >
            <Ionicons name="shield-checkmark" size={18} color="#7C3AED" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 24 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7C3AED"]} />}
      >
        {/* Esports Hero Card with Verified Student House Identity */}
        <LinearGradient
          colors={["#0F172A", "#1E1B4B", "#312E81"]}
          style={styles.heroCard}
        >
          <View style={styles.heroGlow}>
            <View style={styles.heroTopRow}>
              <View style={styles.heroUserHouse}>
                <View style={[styles.houseColorIndicator, { backgroundColor: userHouseMeta.color }]} />
                <Text style={styles.heroHouseEmoji}>{userHouseMeta.emoji}</Text>
                <View>
                  <Text style={styles.heroHouseOverline}>OFFICIAL HOUSE</Text>
                  <Text style={styles.heroHouseTitle}>
                    {userHouseMeta.displayName} House
                  </Text>
                </View>
              </View>

              <View style={[styles.userPointsPill, { borderColor: userHouseMeta.color }]}>
                <Ionicons name="trophy" size={14} color="#FBBF24" />
                <Text style={styles.userPointsNumber}>
                  {dashboard?.user?.individualPoints?.toLocaleString() ?? 0}
                </Text>
                <Text style={styles.userPointsUnit}>pts</Text>
              </View>
            </View>

            <Text style={styles.heroMotto}>"{userHouseMeta.motto}"</Text>

            {/* Quick House Stats */}
            <View style={styles.heroStatsBar}>
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>House Rank</Text>
                <Text style={styles.heroStatValue}>
                  {dashboard?.user?.houseRank ? `#${dashboard.user.houseRank}` : "#1"}
                </Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>House Total</Text>
                <Text style={[styles.heroStatValue, { color: userHouseMeta.color }]}>
                  {userHouseStanding?.points?.toLocaleString() ?? 0} pts
                </Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroStatItem}>
                <Text style={styles.heroStatLabel}>Arena Status</Text>
                <Text style={styles.heroStatValue}>
                  {userHouseStanding ? "Active" : "Ready"} ⚔️
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* 5-Section Segment Navigation Bar */}
        <View style={styles.segmentNavWrap}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.segmentNavScroll}
          >
            <SegmentTabButton
              active={activeTab === "battles"}
              icon="flash"
              label="BATTLES"
              badge="LIVE"
              onPress={() => setActiveTab("battles")}
            />
            <SegmentTabButton
              active={activeTab === "daily_puzzles"}
              icon="extension-puzzle"
              label="DAILY PUZZLES"
              badge="6 NEW"
              onPress={() => setActiveTab("daily_puzzles")}
            />
            <SegmentTabButton
              active={activeTab === "games"}
              icon="game-controller"
              label="GAMES"
              onPress={() => setActiveTab("games")}
            />
            <SegmentTabButton
              active={activeTab === "leaderboards"}
              icon="trophy"
              label="LEADERBOARDS"
              onPress={() => setActiveTab("leaderboards")}
            />
            <SegmentTabButton
              active={activeTab === "events"}
              icon="calendar"
              label="EVENTS"
              onPress={() => setActiveTab("events")}
            />
          </ScrollView>
        </View>

        {/* Dynamic Section Rendering */}
        {activeTab === "battles" && (
          <BattleArenaSection
            userHouse={userHouseName}
            onPointsEarned={fetchDashboardData}
          />
        )}

        {activeTab === "daily_puzzles" && (
          <DailyPuzzleSection
            userHouse={userHouseName}
            onPointsEarned={fetchDashboardData}
          />
        )}

        {activeTab === "games" && (
          <View style={styles.soloGamesSection}>
            <View style={styles.gamesHeaderRow}>
              <View>
                <Text style={styles.sectionTitle}>Solo Challenge Games</Text>
                <Text style={styles.sectionSubtitle}>
                  Earn verified points for {userHouseMeta.displayName} House in speed and skill tests.
                </Text>
              </View>
              <View style={styles.verifiedBadge}>
                <Ionicons name="shield-checkmark" size={12} color="#059669" />
                <Text style={styles.verifiedBadgeText}>VERIFIED</Text>
              </View>
            </View>

            <View style={styles.gamesList}>
              {SOLO_CHALLENGES.map((challenge) => {
                const isLive = challenge.status === "live";
                return (
                  <View
                    key={challenge.id}
                    style={[styles.soloCard, { borderLeftColor: challenge.color }]}
                  >
                    <View style={[styles.soloIconWrap, { backgroundColor: challenge.bg }]}>
                      <Text style={styles.soloIcon}>{challenge.icon}</Text>
                    </View>

                    <View style={styles.soloInfo}>
                      <Text style={styles.soloTitle}>{challenge.title}</Text>
                      <Text style={styles.soloDesc}>{challenge.desc}</Text>
                      <View style={styles.soloMetaRow}>
                        <Text style={[styles.soloStatus, { color: isLive ? "#10B981" : "#8B5CF6" }]}>
                          {isLive ? "LIVE · Solo Play" : "Qualifying · Practice"}
                        </Text>
                        <Text style={styles.soloPts}>
                          +{challenge.points} pts{challenge.pointsNote ? ` (${challenge.pointsNote})` : ""}
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[styles.soloPlayBtn, { backgroundColor: challenge.color }]}
                      onPress={() => setActiveSoloGame(challenge)}
                      accessibilityRole="button"
                      accessibilityLabel={`Play ${challenge.title}`}
                    >
                      <Text style={styles.soloPlayBtnText}>
                        {challenge.status === "qualifying" ? "Practice" : "Play"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {activeTab === "leaderboards" && (
          <LeaderboardSection
            userHouse={userHouseName}
            onRefreshParent={fetchDashboardData}
          />
        )}

        {activeTab === "events" && <EventsSection />}

        {/* Live Activity Ticker Bar at Bottom */}
        {activities.length > 0 && (
          <View style={styles.activityTickerWrap}>
            <View style={styles.tickerHeader}>
              <View style={styles.tickerDot} />
              <Text style={styles.tickerTitle}>LIVE ARENA ACTIVITY</Text>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tickerScroll}
            >
              {activities.map((act) => {
                const houseMeta = OFFICIAL_HOUSES[normalizeHouseName(act.house)];
                return (
                  <View key={act.id} style={styles.tickerPill}>
                    <Text style={styles.tickerEmoji}>{houseMeta.emoji}</Text>
                    <Text style={styles.tickerUser} numberOfLines={1}>
                      {act.userName}
                    </Text>
                    <Text style={[styles.tickerHouse, { color: houseMeta.color }]}>
                      ({houseMeta.displayName})
                    </Text>
                    <View style={styles.tickerPtsWrap}>
                      <Text style={styles.tickerPts}>+{act.points} pts</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </ScrollView>

      {/* Solo Game Play Modal */}
      <Modal
        visible={!!activeSoloGame}
        animationType="slide"
        onRequestClose={() => setActiveSoloGame(null)}
        presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
      >
        <View style={styles.gameModalRoot}>
          <View style={[styles.gameModalHeader, { paddingTop: Platform.OS === "web" ? 12 : insets.top + 8 }]}>
            <Text style={styles.gameModalTitle}>
              {activeSoloGame?.icon} {activeSoloGame?.title}
            </Text>
            <TouchableOpacity
              style={styles.gameModalCloseBtn}
              onPress={() => setActiveSoloGame(null)}
              accessibilityRole="button"
              accessibilityLabel="Close game"
            >
              <Ionicons name="close" size={22} color="#1E293B" />
            </TouchableOpacity>
          </View>
          {activeSoloGame && (
            <GamePlayModal
              key={activeSoloGame.gameId}
              gameId={activeSoloGame.gameId}
              onComplete={() => {
                void fetchDashboardData();
              }}
              onClose={() => setActiveSoloGame(null)}
            />
          )}
        </View>
      </Modal>

      {/* Admin Competition Management Modal */}
      {canAccessAdmin && (
        <AdminCompetitionModal
          visible={adminModalVisible}
          onClose={() => setAdminModalVisible(false)}
          onSuccess={() => {
            void fetchDashboardData();
          }}
        />
      )}
    </View>
  );
}

function SegmentTabButton({
  active,
  icon,
  label,
  badge,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentBtn, active && styles.segmentBtnActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? "#7C3AED" : "#64748B"}
      />
      <Text style={[styles.segmentBtnText, active && styles.segmentBtnTextActive]}>
        {label}
      </Text>
      {badge && (
        <View style={[styles.segmentBadge, active && styles.segmentBadgeActive]}>
          <Text style={[styles.segmentBadgeText, active && styles.segmentBadgeTextActive]}>
            {badge}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  pageHeader: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  headerStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },
  seasonBadge: {
    fontSize: 10,
    fontWeight: "600",
    color: "#7C3AED",
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  adminHeaderBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  headerSpacer: {
    width: 36,
  },
  heroCard: {
    margin: 16,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 4,
  },
  heroGlow: {
    padding: 16,
  },
  heroTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroUserHouse: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  houseColorIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  heroHouseEmoji: {
    fontSize: 26,
  },
  heroHouseOverline: {
    fontSize: 9,
    fontWeight: "600",
    color: "#94A3B8",
    letterSpacing: 1,
  },
  heroHouseTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#fff",
  },
  userPointsPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 1.5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  userPointsNumber: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  userPointsUnit: {
    fontSize: 11,
    color: "#CBD5E1",
    fontWeight: "600",
  },
  heroMotto: {
    fontSize: 12,
    fontStyle: "italic",
    color: "#CBD5E1",
    marginTop: 8,
    marginBottom: 12,
  },
  heroStatsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  heroStatItem: {
    alignItems: "center",
  },
  heroStatLabel: {
    fontSize: 10,
    color: "#94A3B8",
    marginBottom: 2,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
  },
  heroDivider: {
    width: 1,
    height: 20,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  segmentNavWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 8,
    marginBottom: 4,
  },
  segmentNavScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  segmentBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  segmentBtnActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#7C3AED",
  },
  segmentBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
  },
  segmentBtnTextActive: {
    color: "#7C3AED",
  },
  segmentBadge: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  segmentBadgeActive: {
    backgroundColor: "#7C3AED",
  },
  segmentBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#475569",
  },
  segmentBadgeTextActive: {
    color: "#fff",
  },
  soloGamesSection: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  gamesHeaderRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  sectionSubtitle: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    maxWidth: 260,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    gap: 4,
  },
  verifiedBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
  },
  gamesList: {
    gap: 10,
  },
  soloCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  soloIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  soloIcon: {
    fontSize: 22,
  },
  soloInfo: {
    flex: 1,
  },
  soloTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  soloDesc: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  soloMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  soloStatus: {
    fontSize: 11,
    fontWeight: "700",
  },
  soloPts: {
    fontSize: 11,
    fontWeight: "700",
    color: "#7C3AED",
  },
  soloPlayBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  soloPlayBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  activityTickerWrap: {
    marginTop: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
  },
  tickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  tickerDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  tickerTitle: {
    fontSize: 10,
    fontWeight: "600",
    color: "#64748B",
    letterSpacing: 1,
  },
  tickerScroll: {
    gap: 8,
    paddingBottom: 4,
  },
  tickerPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 5,
  },
  tickerEmoji: {
    fontSize: 12,
  },
  tickerUser: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    maxWidth: 90,
  },
  tickerHouse: {
    fontSize: 11,
    fontWeight: "600",
  },
  tickerPtsWrap: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  tickerPts: {
    fontSize: 10,
    fontWeight: "600",
    color: "#059669",
  },
  gameModalRoot: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  gameModalHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  gameModalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  gameModalCloseBtn: {
    padding: 6,
    borderRadius: 16,
    backgroundColor: "#F1F5F9",
  },
});
