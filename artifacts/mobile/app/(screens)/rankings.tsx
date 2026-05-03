import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

interface Ranking {
  id: string;
  jnvName: string;
  state: string;
  score: number;
}

const ALL_RANKINGS: Ranking[] = [
  { id: "1", jnvName: "JNV Delhi", state: "Delhi", score: 95.5 },
  { id: "2", jnvName: "JNV Bangalore Urban", state: "Karnataka", score: 94.2 },
  { id: "3", jnvName: "JNV Pune", state: "Maharashtra", score: 93.8 },
  { id: "4", jnvName: "JNV Ranga Reddy", state: "Telangana", score: 92.5 },
  { id: "5", jnvName: "JNV Patna", state: "Bihar", score: 91.8 },
  { id: "6", jnvName: "JNV Lucknow", state: "Uttar Pradesh", score: 91.2 },
  { id: "7", jnvName: "JNV Ahmedabad", state: "Gujarat", score: 90.6 },
  { id: "8", jnvName: "JNV Jaipur", state: "Rajasthan", score: 90.1 },
  { id: "9", jnvName: "JNV Bhopal", state: "Madhya Pradesh", score: 89.7 },
  { id: "10", jnvName: "JNV Chennai", state: "Tamil Nadu", score: 89.3 },
  { id: "11", jnvName: "JNV Kolkata", state: "West Bengal", score: 88.9 },
  { id: "12", jnvName: "JNV Chandigarh", state: "Punjab", score: 88.4 },
];

const ACADEMIC_RANKINGS: Ranking[] = [
  { id: "1", jnvName: "JNV Patna", state: "Bihar", score: 97.2 },
  { id: "2", jnvName: "JNV Delhi", state: "Delhi", score: 96.1 },
  { id: "3", jnvName: "JNV Lucknow", state: "Uttar Pradesh", score: 95.4 },
  { id: "4", jnvName: "JNV Pune", state: "Maharashtra", score: 94.8 },
  { id: "5", jnvName: "JNV Chennai", state: "Tamil Nadu", score: 94.2 },
];

const SPORTS_RANKINGS: Ranking[] = [
  { id: "1", jnvName: "JNV Bangalore Urban", state: "Karnataka", score: 96.8 },
  { id: "2", jnvName: "JNV Ranga Reddy", state: "Telangana", score: 95.5 },
  { id: "3", jnvName: "JNV Jaipur", state: "Rajasthan", score: 94.1 },
  { id: "4", jnvName: "JNV Delhi", state: "Delhi", score: 93.7 },
  { id: "5", jnvName: "JNV Kolkata", state: "West Bengal", score: 92.3 },
];

const RANK_BORDER = ["#F59E0B", "#94A3B8", "#CD7F32"];
const RANK_NUM_BG = ["#FFFBEB", "#F8FAFC", "#FFF8F3"];
const RANK_NUM_COLOR = ["#F59E0B", "#94A3B8", "#CD7F32"];

export default function RankingsScreen() {
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState<"overall" | "academics" | "sports">("overall");
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const data = activeFilter === "academics" ? ACADEMIC_RANKINGS : activeFilter === "sports" ? SPORTS_RANKINGS : ALL_RANKINGS;

  const top3 = data.slice(0, 3);
  const rest = data.slice(3);

  const avgScore = (data.reduce((s, r) => s + r.score, 0) / data.length).toFixed(1);
  const topScore = data[0]?.score.toFixed(1) ?? "—";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>JNV Rankings</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search-outline" size={22} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        <View style={styles.statsRow}>
          <View style={[styles.statBox, { backgroundColor: "#EEF2FF" }]}>
            <Text style={[styles.statValue, { color: "#3D5AF1" }]}>{data.length}</Text>
            <Text style={styles.statLabel}>Schools</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#ECFDF5" }]}>
            <Text style={[styles.statValue, { color: "#10B981" }]}>{avgScore}</Text>
            <Text style={styles.statLabel}>Avg Score</Text>
          </View>
          <View style={[styles.statBox, { backgroundColor: "#FFFBEB" }]}>
            <Text style={[styles.statValue, { color: "#F59E0B" }]}>{topScore}</Text>
            <Text style={styles.statLabel}>Top Score</Text>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(["overall", "academics", "sports"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
              onPress={() => setActiveFilter(f)}
            >
              <Ionicons
                name={f === "overall" ? "bar-chart" : f === "academics" ? "school" : "football"}
                size={14}
                color={activeFilter === f ? "#fff" : "#374151"}
              />
              <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Top Performers</Text>
          <View style={styles.podium}>
            <View style={styles.podiumSide}>
              <View style={[styles.podiumCard, styles.podiumCard2]}>
                <View style={styles.medalWrap}>
                  <Ionicons name="ribbon" size={28} color="#94A3B8" />
                </View>
                <Text style={styles.podiumJnv} numberOfLines={2}>{top3[1]?.jnvName}</Text>
                <Text style={styles.podiumState}>{top3[1]?.state}</Text>
                <Text style={[styles.podiumScore, { color: "#94A3B8" }]}>{top3[1]?.score}</Text>
                <Text style={styles.podiumRank}>#2</Text>
              </View>
            </View>

            <View style={styles.podiumCenter}>
              <View style={[styles.podiumCard, styles.podiumCard1]}>
                <View style={styles.medalWrap}>
                  <Ionicons name="trophy" size={34} color="#F59E0B" />
                </View>
                <Text style={styles.podiumJnv} numberOfLines={2}>{top3[0]?.jnvName}</Text>
                <Text style={styles.podiumState}>{top3[0]?.state}</Text>
                <Text style={[styles.podiumScore, { color: "#F59E0B", fontSize: 22 }]}>{top3[0]?.score}</Text>
                <Text style={styles.podiumRank}>#1</Text>
              </View>
            </View>

            <View style={styles.podiumSide}>
              <View style={[styles.podiumCard, styles.podiumCard3]}>
                <View style={styles.medalWrap}>
                  <Ionicons name="medal" size={28} color="#CD7F32" />
                </View>
                <Text style={styles.podiumJnv} numberOfLines={2}>{top3[2]?.jnvName}</Text>
                <Text style={styles.podiumState}>{top3[2]?.state}</Text>
                <Text style={[styles.podiumScore, { color: "#CD7F32" }]}>{top3[2]?.score}</Text>
                <Text style={styles.podiumRank}>#3</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Rankings</Text>
          {data.map((item, index) => {
            const borderColor = index < 3 ? RANK_BORDER[index] : "#E5E7EB";
            const numBg = index < 3 ? RANK_NUM_BG[index] : "#F3F4F6";
            const numColor = index < 3 ? RANK_NUM_COLOR[index] : "#6B7280";
            return (
              <TouchableOpacity key={item.id} style={[styles.rankRow, { borderLeftColor: borderColor }]} activeOpacity={0.8}>
                <View style={[styles.rankNum, { backgroundColor: numBg }]}>
                  <Text style={[styles.rankNumText, { color: numColor }]}>{index + 1}</Text>
                </View>
                <View style={styles.rankInfo}>
                  <Text style={styles.rankJnv}>{item.jnvName}</Text>
                  <Text style={styles.rankState}>{item.state}</Text>
                </View>
                <View style={styles.rankRight}>
                  <Text style={[styles.rankScore, { color: "#3D5AF1" }]}>{item.score}</Text>
                  <View style={styles.rankActions}>
                    <Ionicons name="trending-up" size={14} color="#10B981" />
                    <Ionicons name="chevron-down" size={14} color="#9CA3AF" />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center" },
  searchBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  statsRow: { flexDirection: "row", padding: 16, gap: 10 },
  statBox: {
    flex: 1, borderRadius: 14, paddingVertical: 14,
    alignItems: "center", gap: 4,
  },
  statValue: { fontSize: 22, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 8,
    flexWrap: "wrap",
  },
  filterChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    backgroundColor: "#fff",
  },
  filterChipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  filterText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  filterTextActive: { color: "#fff" },
  section: { paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  podium: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 8 },
  podiumCenter: { flex: 1.2 },
  podiumSide: { flex: 1 },
  podiumCard: {
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  podiumCard1: { backgroundColor: "#FFFBEB", borderWidth: 1.5, borderColor: "#F59E0B" },
  podiumCard2: { backgroundColor: "#F8FAFC", borderWidth: 1, borderColor: "#E2E8F0" },
  podiumCard3: { backgroundColor: "#FFF8F3", borderWidth: 1, borderColor: "#FDE8D8" },
  medalWrap: { marginBottom: 4 },
  podiumJnv: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center", lineHeight: 16 },
  podiumState: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  podiumScore: { fontSize: 18, fontFamily: "Inter_700Bold", marginTop: 4 },
  podiumRank: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    borderLeftWidth: 4,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  rankNum: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  rankNumText: { fontSize: 15, fontFamily: "Inter_700Bold" },
  rankInfo: { flex: 1 },
  rankJnv: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  rankState: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  rankRight: { alignItems: "flex-end", gap: 4 },
  rankScore: { fontSize: 18, fontFamily: "Inter_700Bold" },
  rankActions: { flexDirection: "row", gap: 4 },
});
