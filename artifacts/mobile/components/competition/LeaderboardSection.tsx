import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { OFFICIAL_HOUSES, type HouseName, normalizeHouseName } from "@/constants/HouseTheme";
import { api, type PlayerLeaderboardEntry, type HouseChampionshipStanding } from "@/lib/api";
import HouseBadge from "./HouseBadge";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

interface LeaderboardSectionProps {
  userHouse?: string | null;
  onRefreshParent?: () => void;
}

const TIME_RANGES = [
  { id: "all", label: "All-Time" },
  { id: "today", label: "Today" },
  { id: "week", label: "This Week" },
  { id: "month", label: "This Month" },
];

const HOUSES_FILTER: Array<{ id: string; label: string; color?: string }> = [
  { id: "all", label: "All Houses" },
  { id: "Aravali", label: "Aravali", color: "#2563EB" },
  { id: "Nilgiri", label: "Nilgiri", color: "#16A34A" },
  { id: "Shiwalik", label: "Shiwalik", color: "#DC2626" },
  { id: "Udaygiri", label: "Udaygiri", color: "#EAB308" },
];

export default function LeaderboardSection({ userHouse }: LeaderboardSectionProps) {
  const [tab, setTab] = useState<"players" | "houses">("players");
  const [timeRange, setTimeRange] = useState("all");
  const [selectedHouse, setSelectedHouse] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);

  const [players, setPlayers] = useState<PlayerLeaderboardEntry[]>([]);
  const [houseStandings, setHouseStandings] = useState<HouseChampionshipStanding[]>([]);
  const [leadingHouse, setLeadingHouse] = useState<string>("Aravali");

  const fetchPlayerLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.competition.playerLeaderboard({
        timeRange,
        house: selectedHouse !== "all" ? selectedHouse : undefined,
        search: searchQuery.trim() || undefined,
      });
      setPlayers(res.leaderboard || []);
    } catch (e) {
      console.warn("Failed to load player leaderboard", e);
    } finally {
      setLoading(false);
    }
  }, [timeRange, selectedHouse, searchQuery]);

  const fetchHouseLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.competition.houseLeaderboard();
      setHouseStandings(res.standings || []);
      setLeadingHouse(res.leadingHouse || "Aravali");
    } catch (e) {
      console.warn("Failed to load house championship", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "players") {
      void fetchPlayerLeaderboard();
    } else {
      void fetchHouseLeaderboard();
    }
  }, [tab, fetchPlayerLeaderboard, fetchHouseLeaderboard]);

  const topThree = players.slice(0, 3);
  const remainingPlayers = players.slice(3);

  // Sorted podium: 2nd place (left), 1st place (center), 3rd place (right)
  const podiumOrder = [
    topThree[1] || null, // 2nd
    topThree[0] || null, // 1st
    topThree[2] || null, // 3rd
  ];

  return (
    <View style={styles.container}>
      {/* Sub-tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, tab === "players" && styles.tabButtonActive]}
          onPress={() => setTab("players")}
          accessibilityRole="tab"
          accessibilityLabel="Individual Player Leaderboard"
        >
          <Ionicons
            name="person"
            size={16}
            color={tab === "players" ? "#fff" : "#64748B"}
          />
          <Text style={[styles.tabButtonText, tab === "players" && styles.tabButtonTextActive]}>
            Individual Players
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, tab === "houses" && styles.tabButtonActive]}
          onPress={() => setTab("houses")}
          accessibilityRole="tab"
          accessibilityLabel="House Championship Leaderboard"
        >
          <Ionicons
            name="shield"
            size={16}
            color={tab === "houses" ? "#fff" : "#64748B"}
          />
          <Text style={[styles.tabButtonText, tab === "houses" && styles.tabButtonTextActive]}>
            House Championship
          </Text>
        </TouchableOpacity>
      </View>

      {tab === "players" ? (
        <View style={styles.playersContent}>
          {/* Search bar */}
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color="#94A3B8" style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search players by name..."
              placeholderTextColor="#94A3B8"
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={fetchPlayerLeaderboard}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")} style={styles.clearSearchBtn}>
                <Ionicons name="close-circle" size={18} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>

          {/* Time Range Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {TIME_RANGES.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[
                  styles.filterChip,
                  timeRange === item.id && styles.filterChipActive,
                ]}
                onPress={() => setTimeRange(item.id)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    timeRange === item.id && styles.filterChipTextActive,
                  ]}
                >
                  {item.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* House Filters */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScroll}
          >
            {HOUSES_FILTER.map((item) => {
              const isSelected = selectedHouse === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  style={[
                    styles.houseFilterChip,
                    isSelected && {
                      backgroundColor: item.color ? `${item.color}20` : "#7C3AED20",
                      borderColor: item.color || "#7C3AED",
                    },
                  ]}
                  onPress={() => setSelectedHouse(item.id)}
                >
                  {item.color && (
                    <View style={[styles.colorDot, { backgroundColor: item.color }]} />
                  )}
                  <Text
                    style={[
                      styles.houseFilterText,
                      isSelected && {
                        color: item.color || "#7C3AED",
                        fontWeight: "700",
                      },
                    ]}
                  >
                    {item.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingText}>Fetching authoritative scores...</Text>
            </View>
          ) : players.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🏅</Text>
              <Text style={styles.emptyTitle}>No player scores found</Text>
              <Text style={styles.emptySub}>
                Play daily puzzles or battle arena games to get on the leaderboard!
              </Text>
            </View>
          ) : (
            <>
              {/* Podium for Top 3 (if no specific name query is being typed) */}
              {!searchQuery && topThree.length > 0 && (
                <View style={styles.podiumContainer}>
                  <Text style={styles.podiumHeading}>🌟 Top Champions</Text>
                  <View style={styles.podiumRow}>
                    {/* 2nd place */}
                    <PodiumCard
                      player={podiumOrder[0]}
                      rank={2}
                      metalColor="#94A3B8"
                      metalBg="#F1F5F9"
                      badgeEmoji="🥈"
                    />
                    {/* 1st place (Center, elevated) */}
                    <PodiumCard
                      player={podiumOrder[1]}
                      rank={1}
                      metalColor="#EAB308"
                      metalBg="#FEFCE8"
                      badgeEmoji="👑"
                      elevated
                    />
                    {/* 3rd place */}
                    <PodiumCard
                      player={podiumOrder[2]}
                      rank={3}
                      metalColor="#B45309"
                      metalBg="#FFFBEB"
                      badgeEmoji="🥉"
                    />
                  </View>
                </View>
              )}

              {/* Leaderboard Table (Ranks 4+ or all when searching) */}
              <View style={styles.listContainer}>
                <Text style={styles.listHeading}>
                  {searchQuery ? "Search Results" : "Rankings"}
                </Text>
                {(searchQuery ? players : remainingPlayers).map((entry) => {
                  const houseMeta = OFFICIAL_HOUSES[normalizeHouseName(entry.house)];
                  return (
                    <View
                      key={entry.userId}
                      style={[
                        styles.playerRow,
                        entry.isCurrentUser && styles.playerRowHighlight,
                      ]}
                    >
                      <View style={styles.rankBadge}>
                        <Text style={styles.rankText}>#{entry.rank}</Text>
                      </View>

                      {/* Avatar */}
                      <View style={styles.avatarWrap}>
                        {entry.photoURL ? (
                          <Image
                            source={{ uri: entry.photoURL }}
                            style={styles.avatar}
                          />
                        ) : (
                          <View
                            style={[
                              styles.avatarFallback,
                              { backgroundColor: houseMeta.bgColor },
                            ]}
                          >
                            <Text
                              style={[
                                styles.avatarInitials,
                                { color: houseMeta.color },
                              ]}
                            >
                              {entry.fullName.substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                        <View
                          style={[
                            styles.avatarHouseDot,
                            { backgroundColor: houseMeta.color },
                          ]}
                        />
                      </View>

                      {/* Name + House Name DIRECTLY BELOW (Required!) */}
                      <View style={styles.nameBlock}>
                        <View style={styles.nameRow}>
                          <Text style={styles.playerName} numberOfLines={1}>
                            {entry.fullName}
                          </Text>
                          {entry.isCurrentUser && (
                            <View style={styles.youPill}>
                              <Text style={styles.youPillText}>YOU</Text>
                            </View>
                          )}
                        </View>
                        {/* OFFICIAL HOUSE NAME DIRECTLY BELOW NAME */}
                        <View style={styles.houseSubtitleRow}>
                          <View
                            style={[
                              styles.houseDotSmall,
                              { backgroundColor: houseMeta.color },
                            ]}
                          />
                          <Text
                            style={[
                              styles.houseSubtitleText,
                              { color: houseMeta.color },
                            ]}
                          >
                            {houseMeta.displayName} House {houseMeta.emoji}
                          </Text>
                          <Text style={styles.gamesPlayedDot}>•</Text>
                          <Text style={styles.gamesPlayedText}>
                            {entry.gamesPlayed} games
                          </Text>
                        </View>
                      </View>

                      {/* Points pill */}
                      <View
                        style={[
                          styles.pointsPill,
                          {
                            backgroundColor: houseMeta.bgColor,
                            borderColor: houseMeta.borderColor,
                          },
                        ]}
                      >
                        <Ionicons name="trophy" size={13} color={houseMeta.color} />
                        <Text style={[styles.pointsText, { color: houseMeta.color }]}>
                          {Number(entry.totalPoints).toLocaleString()} pts
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </>
          )}
        </View>
      ) : (
        <View style={styles.housesContent}>
          {/* Leading House Hero Card */}
          {houseStandings.length > 0 && (
            <LinearGradient
              colors={["#1E1B4B", "#312E81", "#4338CA"]}
              style={styles.leadingBanner}
            >
              <View style={styles.leadingHeader}>
                <Text style={styles.leadingTrophy}>🏆</Text>
                <View>
                  <Text style={styles.leadingOverline}>CURRENT LEADER</Text>
                  <Text style={styles.leadingTitle}>
                    {leadingHouse} House
                  </Text>
                </View>
              </View>
              <Text style={styles.leadingSub}>
                Dominating the championship leaderboard with authoritative score verification.
              </Text>
            </LinearGradient>
          )}

          {loading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color="#7C3AED" />
              <Text style={styles.loadingText}>Calculating house standings...</Text>
            </View>
          ) : (
            <View style={styles.houseCardList}>
              {houseStandings.map((standing, index) => {
                const meta = OFFICIAL_HOUSES[normalizeHouseName(standing.house)];
                const isUserHouse =
                  userHouse &&
                  normalizeHouseName(userHouse) === normalizeHouseName(standing.house);
                const medal = ["🥇", "🥈", "🥉", "4️⃣"][index] || `#${standing.rank}`;

                return (
                  <View
                    key={standing.house}
                    style={[
                      styles.houseCard,
                      {
                        borderLeftColor: meta.color,
                        borderColor: isUserHouse ? meta.color : "#E2E8F0",
                      },
                      isUserHouse && styles.houseCardUser,
                    ]}
                  >
                    <View style={styles.houseCardTop}>
                      <View style={styles.houseTitleRow}>
                        <Text style={styles.houseMedal}>{medal}</Text>
                        <View
                          style={[
                            styles.houseIconBadge,
                            { backgroundColor: meta.bgColor },
                          ]}
                        >
                          <Text style={styles.houseEmoji}>{meta.emoji}</Text>
                        </View>
                        <View style={styles.houseInfo}>
                          <View style={styles.houseNameAndTag}>
                            <Text style={styles.houseTitle}>
                              {meta.displayName} House
                            </Text>
                            {isUserHouse && (
                              <View
                                style={[
                                  styles.yourHouseTag,
                                  { backgroundColor: meta.color },
                                ]}
                              >
                                <Text style={styles.yourHouseTagText}>YOUR HOUSE</Text>
                              </View>
                            )}
                          </View>
                          <Text style={styles.houseMotto}>"{meta.motto}"</Text>
                        </View>
                      </View>

                      <View style={styles.housePointsBlock}>
                        <Text style={[styles.housePointsNumber, { color: meta.color }]}>
                          {Number(standing.totalPoints).toLocaleString()}
                        </Text>
                        <Text style={styles.housePointsUnit}>pts</Text>
                      </View>
                    </View>

                    {/* Progress Bar */}
                    <View style={styles.progressSection}>
                      <View style={styles.progressRow}>
                        <Text style={styles.progressLabel}>Championship Share</Text>
                        <Text style={styles.progressPercent}>
                          {standing.progressPercent}%
                        </Text>
                      </View>
                      <View style={styles.progressBarTrack}>
                        <View
                          style={[
                            styles.progressBarFill,
                            {
                              width: `${Math.max(5, standing.progressPercent)}%`,
                              backgroundColor: meta.color,
                            },
                          ]}
                        />
                      </View>
                    </View>

                    {/* Stats footer */}
                    <View style={styles.houseStatsFooter}>
                      <View style={styles.houseStatItem}>
                        <Ionicons name="trophy-outline" size={14} color="#64748B" />
                        <Text style={styles.houseStatText}>
                          {standing.victories} Battles Won
                        </Text>
                      </View>
                      <View style={styles.houseStatItem}>
                        <Ionicons name="flash-outline" size={14} color="#64748B" />
                        <Text style={styles.houseStatText}>Active in Arena</Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function PodiumCard({
  player,
  rank,
  metalColor,
  metalBg,
  badgeEmoji,
  elevated = false,
}: {
  player: PlayerLeaderboardEntry | null;
  rank: number;
  metalColor: string;
  metalBg: string;
  badgeEmoji: string;
  elevated?: boolean;
}) {
  if (!player) {
    return (
      <View style={[styles.podiumCardEmpty, elevated && styles.podiumElevated]}>
        <Text style={styles.podiumEmptyRank}>#{rank}</Text>
        <Text style={styles.podiumEmptyLabel}>Open</Text>
      </View>
    );
  }

  const houseMeta = OFFICIAL_HOUSES[normalizeHouseName(player.house)];

  return (
    <View
      style={[
        styles.podiumCard,
        elevated && styles.podiumElevated,
        { borderColor: metalColor, backgroundColor: "#fff" },
      ]}
    >
      <View style={[styles.podiumBadgeWrap, { backgroundColor: metalBg, borderColor: metalColor }]}>
        <Text style={styles.podiumBadgeEmoji}>{badgeEmoji}</Text>
        <Text style={[styles.podiumRankText, { color: metalColor }]}>#{rank}</Text>
      </View>

      {/* Avatar */}
      <View style={[styles.podiumAvatarWrap, { borderColor: metalColor }]}>
        {player.photoURL ? (
          <Image source={{ uri: player.photoURL }} style={styles.podiumAvatar} />
        ) : (
          <View style={[styles.podiumAvatarFallback, { backgroundColor: houseMeta.bgColor }]}>
            <Text style={[styles.podiumInitials, { color: houseMeta.color }]}>
              {player.fullName.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.podiumName} numberOfLines={1}>
        {player.fullName}
      </Text>

      {/* House Name DIRECTLY BELOW name */}
      <View style={styles.podiumHouseRow}>
        <View style={[styles.colorDotTiny, { backgroundColor: houseMeta.color }]} />
        <Text style={[styles.podiumHouseText, { color: houseMeta.color }]} numberOfLines={1}>
          {houseMeta.displayName}
        </Text>
      </View>

      <View style={[styles.podiumPointsChip, { backgroundColor: metalBg }]}>
        <Ionicons name="trophy" size={12} color={metalColor} />
        <Text style={[styles.podiumPointsText, { color: metalColor }]}>
          {Number(player.totalPoints).toLocaleString()}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: "#EEF2F6",
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  tabButtonActive: {
    backgroundColor: "#7C3AED",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  tabButtonText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  tabButtonTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  playersContent: {},
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  clearSearchBtn: {
    padding: 4,
  },
  filterScroll: {
    gap: 8,
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  filterChipActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  houseFilterChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  colorDotTiny: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  houseFilterText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  emptyBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyEmoji: {
    fontSize: 36,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
  },
  emptySub: {
    fontSize: 13,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  podiumContainer: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  podiumHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 10,
    textAlign: "center",
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  podiumCard: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1.5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  podiumElevated: {
    transform: [{ translateY: -10 }],
    borderWidth: 2,
    shadowOpacity: 0.12,
  },
  podiumCardEmpty: {
    flex: 1,
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  podiumEmptyRank: {
    fontSize: 16,
    fontWeight: "700",
    color: "#94A3B8",
  },
  podiumEmptyLabel: {
    fontSize: 11,
    color: "#94A3B8",
  },
  podiumBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 6,
    gap: 2,
  },
  podiumBadgeEmoji: {
    fontSize: 12,
  },
  podiumRankText: {
    fontSize: 11,
    fontWeight: "600",
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
    alignItems: "center",
    justifyContent: "center",
  },
  podiumInitials: {
    fontSize: 14,
    fontWeight: "700",
  },
  podiumName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  podiumHouseRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  podiumHouseText: {
    fontSize: 11,
    fontWeight: "600",
  },
  podiumPointsChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginTop: 6,
  },
  podiumPointsText: {
    fontSize: 11,
    fontWeight: "600",
  },
  listContainer: {
    marginTop: 8,
  },
  listHeading: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 8,
  },
  playerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  playerRowHighlight: {
    borderColor: "#7C3AED",
    backgroundColor: "#FAF5FF",
    borderWidth: 1.5,
  },
  rankBadge: {
    width: 28,
    alignItems: "center",
  },
  rankText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748B",
  },
  avatarWrap: {
    position: "relative",
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "700",
  },
  avatarHouseDot: {
    position: "absolute",
    bottom: -1,
    right: -1,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#fff",
  },
  nameBlock: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    maxWidth: 160,
  },
  youPill: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  youPillText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#fff",
  },
  houseSubtitleRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
    gap: 4,
  },
  houseDotSmall: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  houseSubtitleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  gamesPlayedDot: {
    color: "#94A3B8",
    fontSize: 10,
  },
  gamesPlayedText: {
    fontSize: 11,
    color: "#64748B",
  },
  pointsPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    gap: 4,
  },
  pointsText: {
    fontSize: 13,
    fontWeight: "600",
  },
  housesContent: {},
  leadingBanner: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  leadingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 6,
  },
  leadingTrophy: {
    fontSize: 28,
  },
  leadingOverline: {
    fontSize: 10,
    fontWeight: "600",
    color: "#FBBF24",
    letterSpacing: 1,
  },
  leadingTitle: {
    fontSize: 20,
    fontWeight: "600",
    color: "#fff",
  },
  leadingSub: {
    fontSize: 12,
    color: "#E2E8F0",
    lineHeight: 16,
  },
  houseCardList: {
    gap: 12,
  },
  houseCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderLeftWidth: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  houseCardUser: {
    backgroundColor: "#FAF5FF",
    borderWidth: 1.5,
    borderLeftWidth: 5,
  },
  houseCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  houseTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  houseMedal: {
    fontSize: 22,
  },
  houseIconBadge: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  houseEmoji: {
    fontSize: 20,
  },
  houseInfo: {
    flex: 1,
  },
  houseNameAndTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  houseTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  yourHouseTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  yourHouseTagText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#fff",
  },
  houseMotto: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
    marginTop: 2,
  },
  housePointsBlock: {
    alignItems: "flex-end",
  },
  housePointsNumber: {
    fontSize: 20,
    fontWeight: "600",
  },
  housePointsUnit: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "600",
  },
  progressSection: {
    marginTop: 12,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 11,
    color: "#64748B",
  },
  progressPercent: {
    fontSize: 11,
    fontWeight: "700",
    color: "#1E293B",
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
  houseStatsFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  houseStatItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  houseStatText: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
});
