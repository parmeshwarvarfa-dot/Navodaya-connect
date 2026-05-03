import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";

interface Ranking {
  id: string;
  jnvName: string;
  state: string;
  indiaRank: number;
  stateRank: number;
  score: number;
}

const MOCK_RANKINGS: Ranking[] = [
  { id: "1", jnvName: "JNV Patna", state: "Bihar", indiaRank: 1, stateRank: 1, score: 980 },
  { id: "2", jnvName: "JNV Pune", state: "Maharashtra", indiaRank: 2, stateRank: 1, score: 975 },
  { id: "3", jnvName: "JNV Hyderabad", state: "Telangana", indiaRank: 3, stateRank: 1, score: 968 },
  { id: "4", jnvName: "JNV Chennai", state: "Tamil Nadu", indiaRank: 4, stateRank: 1, score: 962 },
  { id: "5", jnvName: "JNV Lucknow", state: "Uttar Pradesh", indiaRank: 5, stateRank: 1, score: 955 },
  { id: "6", jnvName: "JNV Ranchi", state: "Jharkhand", indiaRank: 6, stateRank: 1, score: 948 },
  { id: "7", jnvName: "JNV Bhopal", state: "Madhya Pradesh", indiaRank: 7, stateRank: 1, score: 940 },
  { id: "8", jnvName: "JNV Kolkata", state: "West Bengal", indiaRank: 8, stateRank: 1, score: 935 },
  { id: "9", jnvName: "JNV Jaipur", state: "Rajasthan", indiaRank: 9, stateRank: 1, score: 928 },
  { id: "10", jnvName: "JNV Bengaluru Urban", state: "Karnataka", indiaRank: 10, stateRank: 1, score: 920 },
];

const MEDAL_COLORS = ["#F59E0B", "#94A3B8", "#CD7F32"];

export default function RankingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [tab, setTab] = useState<"india" | "state">("india");
  const [rankings] = useState(MOCK_RANKINGS);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const filtered = tab === "state"
    ? rankings.filter((r) => r.state === profile?.jnvState)
    : rankings;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Rankings</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={styles.tabRow}>
          <TouchableOpacity style={[styles.tab, tab === "india" && styles.activeTab]} onPress={() => setTab("india")}>
            <Text style={[styles.tabText, tab === "india" && styles.activeTabText]}>India Ranking</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tab, tab === "state" && styles.activeTab]} onPress={() => setTab("state")}>
            <Text style={[styles.tabText, tab === "state" && styles.activeTabText]}>State Ranking</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {filtered.length > 0 && (
        <View style={styles.podium}>
          {[filtered[1], filtered[0], filtered[2]].filter(Boolean).map((item, i) => {
            const podiumPos = [1, 0, 2][i];
            const heights = [80, 100, 60];
            return (
              <View key={item.id} style={[styles.podiumItem, { height: heights[i] + 60 }]}>
                <Text style={[styles.podiumName, { color: colors.foreground }]} numberOfLines={1}>
                  {item.jnvName.replace("JNV ", "")}
                </Text>
                <View style={[styles.podiumBlock, { height: heights[i], backgroundColor: MEDAL_COLORS[podiumPos] + "30" }]}>
                  <Text style={[styles.podiumRank, { color: MEDAL_COLORS[podiumPos] }]}>
                    #{tab === "india" ? item.indiaRank : item.stateRank}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="trophy-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No rankings for your state</Text>
          </View>
        }
        renderItem={({ item }) => {
          const rank = tab === "india" ? item.indiaRank : item.stateRank;
          const isYou = item.jnvName === profile?.jnvName;
          return (
            <PremiumCard style={[styles.rankCard, isYou && { borderColor: colors.primary, borderWidth: 2 }]}>
              <View style={styles.rankRow}>
                <View style={[styles.rankBadge, { backgroundColor: rank <= 3 ? MEDAL_COLORS[rank - 1] + "20" : colors.muted }]}>
                  <Text style={[styles.rankNum, { color: rank <= 3 ? MEDAL_COLORS[rank - 1] : colors.mutedForeground }]}>
                    #{rank}
                  </Text>
                </View>
                <View style={styles.rankInfo}>
                  <Text style={[styles.jnvName, { color: colors.foreground }]}>
                    {item.jnvName}{isYou ? " (You)" : ""}
                  </Text>
                  <Text style={[styles.stateName, { color: colors.mutedForeground }]}>{item.state}</Text>
                </View>
                <Text style={[styles.score, { color: colors.primary }]}>{item.score}</Text>
              </View>
            </PremiumCard>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  tabRow: { flexDirection: "row", gap: 4, marginBottom: 0 },
  tab: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  activeTab: { backgroundColor: "rgba(255,255,255,0.2)" },
  tabText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)" },
  activeTabText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  podium: { flexDirection: "row", justifyContent: "center", alignItems: "flex-end", padding: 16, gap: 8 },
  podiumItem: { alignItems: "center", flex: 1, justifyContent: "flex-end" },
  podiumName: { fontSize: 10, fontFamily: "Inter_600SemiBold", textAlign: "center", marginBottom: 4 },
  podiumBlock: { width: "100%", borderRadius: 8, alignItems: "center", justifyContent: "center" },
  podiumRank: { fontSize: 18, fontFamily: "Inter_700Bold" },
  listContent: { padding: 16 },
  rankCard: { marginBottom: 8 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rankBadge: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  rankNum: { fontSize: 14, fontFamily: "Inter_700Bold" },
  rankInfo: { flex: 1 },
  jnvName: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  stateName: { fontSize: 12, fontFamily: "Inter_400Regular" },
  score: { fontSize: 16, fontFamily: "Inter_700Bold" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
