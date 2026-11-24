import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, type IndividualRankingItem } from "@/lib/api";
import { STATES } from "@/data/jnvData";

interface IndividualRankingSectionProps {
  onSelectUser: (userId: string) => void;
}

const PERIODS = [
  { id: "all_time", label: "All-Time" },
  { id: "monthly", label: "Monthly" },
  { id: "annual", label: "Annual" },
  { id: "weekly", label: "Weekly" },
  { id: "daily", label: "Daily" },
];

const ROLES = [
  { id: "all", label: "All Roles" },
  { id: "student", label: "Students" },
  { id: "alumni", label: "Alumni" },
  { id: "teacher", label: "Teachers" },
  { id: "official", label: "Officials" },
];

export default function IndividualRankingSection({ onSelectUser }: IndividualRankingSectionProps) {
  const [period, setPeriod] = useState("all_time");
  const [role, setRole] = useState("all");
  const [selectedState, setSelectedState] = useState("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaderboard, setLeaderboard] = useState<IndividualRankingItem[]>([]);

  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.ranking.individual({
        period,
        role: role !== "all" ? role : undefined,
        state: selectedState !== "all" ? selectedState : undefined,
        search: search.trim() || undefined,
      });
      setLeaderboard(res.leaderboard || []);
    } catch (e) {
      console.warn("Failed to load individual leaderboard", e);
    } finally {
      setLoading(false);
    }
  }, [period, role, selectedState, search]);

  useEffect(() => {
    void fetchLeaderboard();
  }, [fetchLeaderboard]);

  const topThree = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchBar}>
        <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search contributor by name..."
          placeholderTextColor="#94A3B8"
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={fetchLeaderboard}
          returnKeyType="search"
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch("")} style={{ padding: 4 }}>
            <Ionicons name="close-circle" size={18} color="#94A3B8" />
          </TouchableOpacity>
        )}
      </View>

      {/* Period Filter Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.id}
            style={[styles.filterChip, period === p.id && styles.filterChipActive]}
            onPress={() => setPeriod(p.id)}
          >
            <Text style={[styles.filterChipText, period === p.id && styles.filterChipTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Role Filter Scroll */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        {ROLES.map((r) => (
          <TouchableOpacity
            key={r.id}
            style={[styles.roleChip, role === r.id && styles.roleChipActive]}
            onPress={() => setRole(r.id)}
          >
            <Text style={[styles.roleChipText, role === r.id && styles.roleChipTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* State Filter Chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
        <TouchableOpacity
          style={[styles.stateChip, selectedState === "all" && styles.stateChipActive]}
          onPress={() => setSelectedState("all")}
        >
          <Text style={[styles.stateChipText, selectedState === "all" && styles.stateChipTextActive]}>
            All States
          </Text>
        </TouchableOpacity>
        {STATES.slice(0, 10).map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.stateChip, selectedState === st && styles.stateChipActive]}
            onPress={() => setSelectedState(st)}
          >
            <Text style={[styles.stateChipText, selectedState === st && styles.stateChipTextActive]}>
              {st}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Fetching authoritative contributor scores...</Text>
        </View>
      ) : leaderboard.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🏅</Text>
          <Text style={styles.emptyTitle}>No contributors found</Text>
          <Text style={styles.emptySub}>Try adjusting your filter selection or search query.</Text>
        </View>
      ) : (
        <>
          {/* Top 3 Champions Podium (when not searching) */}
          {!search && topThree.length > 0 && (
            <View style={styles.podiumBox}>
              <Text style={styles.podiumHeaderTitle}>🌟 Top Contributors</Text>
              <View style={styles.podiumRow}>
                {/* 2nd place */}
                {topThree[1] && (
                  <PodiumColumn
                    item={topThree[1]}
                    rank={2}
                    badgeEmoji="🥈"
                    metalColor="#94A3B8"
                    onSelect={onSelectUser}
                  />
                )}
                {/* 1st place */}
                {topThree[0] && (
                  <PodiumColumn
                    item={topThree[0]}
                    rank={1}
                    badgeEmoji="👑"
                    metalColor="#EAB308"
                    elevated
                    onSelect={onSelectUser}
                  />
                )}
                {/* 3rd place */}
                {topThree[2] && (
                  <PodiumColumn
                    item={topThree[2]}
                    rank={3}
                    badgeEmoji="🥉"
                    metalColor="#B45309"
                    onSelect={onSelectUser}
                  />
                )}
              </View>
            </View>
          )}

          {/* Table List (Ranks 4+ or all during search) */}
          <View style={styles.tableList}>
            <Text style={styles.tableHeading}>
              {search ? "Search Results" : "Rankings"}
            </Text>

            {(search ? leaderboard : remaining).map((user) => (
              <TouchableOpacity
                key={user.userId}
                style={[styles.userRow, user.isCurrentUser && styles.userRowHighlight]}
                onPress={() => onSelectUser(user.userId)}
                activeOpacity={0.8}
              >
                {/* Rank & Movement */}
                <View style={styles.rankCol}>
                  <Text style={styles.rankNumber}>#{user.rank}</Text>
                  <Text style={styles.rankMovement}>
                    {user.rankMovement === "up" ? "▲" : user.rankMovement === "down" ? "▼" : "•"}
                  </Text>
                </View>

                {/* Avatar */}
                <View style={styles.avatarWrap}>
                  {user.avatarUrl ? (
                    <Image source={{ uri: user.avatarUrl }} style={styles.avatar} />
                  ) : (
                    <View style={styles.avatarFallback}>
                      <Text style={styles.avatarInitials}>
                        {user.fullName.substring(0, 2).toUpperCase()}
                      </Text>
                    </View>
                  )}
                </View>

                {/* User Info */}
                <View style={styles.userInfoCol}>
                  <View style={styles.nameRow}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {user.fullName}
                    </Text>
                    {user.isCurrentUser && (
                      <View style={styles.youBadge}>
                        <Text style={styles.youBadgeText}>YOU</Text>
                      </View>
                    )}
                  </View>

                  <Text style={styles.userSchool} numberOfLines={1}>
                    {user.jnvName} • {user.jnvState}
                  </Text>

                  {/* Badge & Role Row */}
                  <View style={styles.tagsRow}>
                    <View style={[styles.roleTag, { backgroundColor: getRoleColor(user.role) + "15" }]}>
                      <Text style={[styles.roleTagText, { color: getRoleColor(user.role) }]}>
                        {user.role.toUpperCase()}
                      </Text>
                    </View>

                    <View style={[styles.badgeTag, { backgroundColor: `${user.badge.color}15` }]}>
                      <Ionicons name={user.badge.icon as any} size={11} color={user.badge.color} />
                      <Text style={[styles.badgeTagText, { color: user.badge.color }]}>
                        {user.badge.badgeTitle}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Points Pill */}
                <View style={styles.pointsCol}>
                  <Ionicons name="trophy" size={13} color="#FBBF24" />
                  <Text style={styles.pointsNumber}>
                    {Number(user.periodPoints).toLocaleString()}
                  </Text>
                  <Text style={styles.pointsUnit}>pts</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

function PodiumColumn({
  item,
  rank,
  badgeEmoji,
  metalColor,
  elevated,
  onSelect,
}: {
  item: IndividualRankingItem;
  rank: number;
  badgeEmoji: string;
  metalColor: string;
  elevated?: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <TouchableOpacity
      style={[
        styles.podiumColCard,
        elevated && styles.podiumElevated,
        { borderColor: metalColor },
      ]}
      onPress={() => onSelect(item.userId)}
      activeOpacity={0.8}
    >
      <View style={[styles.podiumBadgeBubble, { borderColor: metalColor }]}>
        <Text style={styles.podiumEmoji}>{badgeEmoji}</Text>
        <Text style={[styles.podiumRankDigit, { color: metalColor }]}>#{rank}</Text>
      </View>

      <View style={[styles.podiumAvatarBorder, { borderColor: metalColor }]}>
        {item.avatarUrl ? (
          <Image source={{ uri: item.avatarUrl }} style={styles.podiumAvatarImg} />
        ) : (
          <View style={styles.podiumAvatarInitialsWrap}>
            <Text style={styles.podiumInitialsText}>
              {item.fullName.substring(0, 2).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.podiumNameText} numberOfLines={1}>
        {item.fullName}
      </Text>
      <Text style={styles.podiumSchoolText} numberOfLines={1}>
        {item.jnvName}
      </Text>

      <View style={styles.podiumPtsBadge}>
        <Ionicons name="trophy" size={11} color={metalColor} />
        <Text style={[styles.podiumPtsText, { color: metalColor }]}>
          {Number(item.periodPoints).toLocaleString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function getRoleColor(role: string): string {
  switch (role) {
    case "student":
      return "#2563EB";
    case "alumni":
      return "#7C3AED";
    case "teacher":
      return "#059669";
    case "official":
      return "#D97706";
    default:
      return "#64748B";
  }
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#1E293B",
  },
  filterScroll: {
    gap: 8,
    paddingBottom: 8,
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
    fontWeight: "700",
    color: "#64748B",
  },
  filterChipTextActive: {
    color: "#fff",
  },
  roleChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  roleChipActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#7C3AED",
  },
  roleChipText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  roleChipTextActive: {
    color: "#7C3AED",
    fontWeight: "700",
  },
  stateChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stateChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  stateChipText: {
    fontSize: 11,
    color: "#64748B",
  },
  stateChipTextActive: {
    color: "#2563EB",
    fontWeight: "700",
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
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyEmoji: {
    fontSize: 34,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  podiumBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 12,
    marginVertical: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  podiumHeaderTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    textAlign: "center",
    marginBottom: 10,
  },
  podiumRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    gap: 8,
  },
  podiumColCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 10,
    alignItems: "center",
    borderWidth: 1.5,
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
  },
  podiumElevated: {
    transform: [{ translateY: -10 }],
    borderWidth: 2,
    shadowOpacity: 0.12,
  },
  podiumBadgeBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 6,
    gap: 2,
  },
  podiumEmoji: {
    fontSize: 11,
  },
  podiumRankDigit: {
    fontSize: 10,
    fontWeight: "600",
  },
  podiumAvatarBorder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    overflow: "hidden",
    marginBottom: 6,
  },
  podiumAvatarImg: {
    width: "100%",
    height: "100%",
  },
  podiumAvatarInitialsWrap: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EEF2F6",
    alignItems: "center",
    justifyContent: "center",
  },
  podiumInitialsText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  podiumNameText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  podiumSchoolText: {
    fontSize: 10,
    color: "#64748B",
    textAlign: "center",
    marginTop: 1,
  },
  podiumPtsBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 6,
  },
  podiumPtsText: {
    fontSize: 11,
    fontWeight: "600",
  },
  tableList: {
    marginTop: 8,
  },
  tableHeading: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E293B",
    marginBottom: 8,
  },
  userRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  userRowHighlight: {
    borderColor: "#7C3AED",
    backgroundColor: "#FAF5FF",
    borderWidth: 1.5,
  },
  rankCol: {
    width: 30,
    alignItems: "center",
  },
  rankNumber: {
    fontSize: 13,
    fontWeight: "600",
    color: "#475569",
  },
  rankMovement: {
    fontSize: 10,
    color: "#10B981",
  },
  avatarWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginHorizontal: 8,
    overflow: "hidden",
  },
  avatar: {
    width: "100%",
    height: "100%",
  },
  avatarFallback: {
    width: "100%",
    height: "100%",
    backgroundColor: "#EEF2F6",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: {
    fontSize: 14,
    fontWeight: "700",
    color: "#475569",
  },
  userInfoCol: {
    flex: 1,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  userName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
    maxWidth: 150,
  },
  youBadge: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  youBadgeText: {
    fontSize: 9,
    fontWeight: "600",
    color: "#fff",
  },
  userSchool: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  tagsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  roleTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  roleTagText: {
    fontSize: 9,
    fontWeight: "600",
  },
  badgeTag: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
    gap: 3,
  },
  badgeTagText: {
    fontSize: 9,
    fontWeight: "700",
  },
  pointsCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FEFCE8",
    borderWidth: 1,
    borderColor: "#FEF08A",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pointsNumber: {
    fontSize: 12,
    fontWeight: "600",
    color: "#854D0E",
  },
  pointsUnit: {
    fontSize: 9,
    color: "#A16207",
    fontWeight: "600",
  },
});
