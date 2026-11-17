import React, { useCallback, useEffect, useState } from "react";
import { Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { api, type GameResult, type GameSummary } from "@/lib/api";
import GamePlayModal from "@/components/games/GamePlayModal";

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

const HOUSE_META: Record<string, { color: string; emoji: string }> = {
  Aravali: { color: "#1D6ADE", emoji: "💙" },
  Nilgiri: { color: "#16A34A", emoji: "💚" },
  Shivalik: { color: "#DC2626", emoji: "❤️" },
  Udaygiri: { color: "#D97706", emoji: "💛" },
};
const MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];
const CHALLENGES: Challenge[] = [
  { id: "gk-blitz", title: "GK Blitz Quiz", desc: "2-min rapid-fire general knowledge", icon: "🧠", color: "#7C3AED", bg: "#F5F3FF", status: "live", points: 50, gameId: "gk-blitz" },
  { id: "chess-cup", title: "House Chess Cup", desc: "Local two-player play · tournament not scheduled", icon: "♟️", color: "#374151", bg: "#F3F4F6", status: "qualifying", points: 120, pointsNote: "tournament only", gameId: "chess-cup" },
  { id: "word-master", title: "Word Master", desc: "Speed spelling showdown", icon: "🔤", color: "#8B5CF6", bg: "#F5F3FF", status: "live", points: 60, gameId: "word-master" },
  { id: "math-ninja", title: "Number Ninja", desc: "Mental maths speed round", icon: "🔢", color: "#10B981", bg: "#ECFDF5", status: "live", points: 70, gameId: "math-ninja" },
  { id: "art-battle", title: "Art Battle", desc: "Draw your JNV memory in 60 sec", icon: "🎨", color: "#EF4444", bg: "#FEF2F2", status: "live", points: 80, gameId: "art-battle" },
];

export default function HouseArenaScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const house = profile?.house ?? "";
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const [summary, setSummary] = useState<GameSummary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);

  const refreshSummary = useCallback(async () => {
    try {
      setSummary(await api.games.summary());
      setSummaryError("");
    } catch (error) {
      setSummary(null);
      setSummaryError(error instanceof Error ? error.message : "Sign in to save game scores.");
    }
  }, []);

  useEffect(() => { void refreshSummary(); }, [refreshSummary]);
  useEffect(() => {
    if (Platform.OS !== "web" || !activeChallenge) return;
    const warnBeforeLeave = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeLeave);
    return () => window.removeEventListener("beforeunload", warnBeforeLeave);
  }, [activeChallenge]);
  const rankedHouses = (summary?.houses ?? []).filter((item) => item.points > 0).sort((a, b) => b.points - a.points);

  return (
    <View style={styles.container}>
      <View style={[styles.pageHeader, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color="#26334D" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>Inter House Competition</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 24 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.arenaHeader}>
          <View style={styles.arenaTopRow}>
            <View style={styles.headerCopy}>
              <Text style={styles.arenaTitle}>🏆 Inter House Competition</Text>
              <Text style={styles.arenaSub}>Play solo games and earn verified house points.</Text>
            </View>
            <View style={styles.pointsChip}><Ionicons name="trophy" size={14} color="#6EE7B7" /><Text style={styles.pointsChipText}>{summary ? `${summary.points} pts` : "— pts"}</Text></View>
          </View>
          <Text style={styles.leaderLabel}>House points earned in games</Text>
          {rankedHouses.length ? <View style={styles.leaderboard}>
            {rankedHouses.slice(0, 4).map((item, index) => {
              const meta = HOUSE_META[item.house] ?? { color: "#64748B", emoji: "🏫" };
              const isUserHouse = item.house === house;
              const maxPoints = Math.max(...rankedHouses.map((row) => row.points), 1);
              return <View key={item.house} style={[styles.lbRow, isUserHouse && styles.lbRowHighlight]}>
                <Text style={styles.lbMedal}>{MEDALS[index]}</Text>
                <View style={[styles.lbDot, { backgroundColor: meta.color }]} />
                <View style={styles.lbInfo}>
                  <View style={styles.lbNameRow}><Text style={styles.lbName}>{item.house} {meta.emoji}{isUserHouse ? " (You)" : ""}</Text><Text style={styles.lbPoints}>{Number(item.points).toLocaleString()} pts</Text></View>
                  <View style={styles.barBg}><View style={[styles.barFill, { width: `${Math.min(100, (item.points / maxPoints) * 100)}%`, backgroundColor: meta.color }]} /></View>
                </View>
              </View>;
            })}
          </View> : <Text style={styles.emptyLeaderboard}>{summary ? "No verified game points have been earned yet." : "Sign in to view saved game points and rewards."}</Text>}
          {summaryError ? <Text style={styles.summaryError}>{summaryError}</Text> : null}
        </LinearGradient>

        <View style={styles.challengesSection}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.sectionTitle}>Games</Text>
            <View style={styles.practiceChip}><Text style={styles.practiceChipText}>SOLO PLAY</Text></View>
          </View>
          <Text style={styles.sectionSub}>Rewards are calculated and saved by the server. Chess practice has no tournament reward.</Text>
          {CHALLENGES.map((challenge) => {
            const status = challenge.status === "live" ? "LIVE · solo" : "Qualifying · no tournament open";
            return <View key={challenge.id} style={[styles.challengeCard, { borderLeftColor: challenge.color }]}>
              <View style={[styles.challengeIconWrap, { backgroundColor: challenge.bg }]}><Text style={styles.challengeEmoji}>{challenge.icon}</Text></View>
              <View style={styles.challengeInfo}>
                <Text style={styles.challengeTitle}>{challenge.title}</Text>
                <Text style={styles.challengeDesc}>{challenge.desc}</Text>
                <View style={styles.challengeMeta}>
                  <Text style={[styles.challengeStatus, { color: challenge.status === "live" ? "#10B981" : "#8B5CF6" }]}>{status}</Text>
                  <Text style={styles.challengePts}>+{challenge.points} pts{challenge.pointsNote ? ` · ${challenge.pointsNote}` : ""}</Text>
                </View>
              </View>
              <TouchableOpacity style={[styles.playBtn, { backgroundColor: challenge.color }]} onPress={() => setActiveChallenge(challenge)} accessibilityRole="button" accessibilityLabel={`${challenge.status === "qualifying" ? "Practice" : "Play"} ${challenge.title}`}>
                <Text style={styles.playBtnText}>{challenge.status === "qualifying" ? "Practice" : "Play"}</Text>
              </TouchableOpacity>
            </View>;
          })}
        </View>
      </ScrollView>

      <Modal visible={!!activeChallenge} animationType="slide" onRequestClose={() => setActiveChallenge(null)} presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}>
        <View style={styles.modalRoot}>
          <View style={[styles.modalHeader, { paddingTop: Platform.OS === "web" ? 10 : insets.top + 8 }]}>
            <Text style={styles.modalTitle}>{activeChallenge?.icon} {activeChallenge?.title}</Text>
            <TouchableOpacity style={styles.closeButton} onPress={() => setActiveChallenge(null)} accessibilityRole="button" accessibilityLabel="Close game"><Ionicons name="close" size={22} color="#18243B" /></TouchableOpacity>
          </View>
          {activeChallenge ? <GamePlayModal key={activeChallenge.gameId} gameId={activeChallenge.gameId} onComplete={() => { void refreshSummary(); }} onClose={() => setActiveChallenge(null)} /> : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  pageHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF3" },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F4F8" },
  pageTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#18243B" },
  headerSpacer: { width: 38 },
  arenaHeader: { marginHorizontal: 14, borderRadius: 22, padding: 18, marginTop: 14 },
  arenaTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, gap: 12 },
  headerCopy: { flex: 1 },
  arenaTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  arenaSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 3, lineHeight: 17 },
  pointsChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  pointsChipText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#6EE7B7" },
  leaderLabel: { fontSize: 11, color: "rgba(255,255,255,0.66)", fontFamily: "Inter_600SemiBold", marginBottom: 9 },
  leaderboard: { gap: 8 },
  lbRow: { flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 9 },
  lbRowHighlight: { backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  lbMedal: { fontSize: 18, width: 25, textAlign: "center" },
  lbDot: { width: 9, height: 9, borderRadius: 5 },
  lbInfo: { flex: 1, minWidth: 0 },
  lbNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5, gap: 6 },
  lbName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff", flexShrink: 1 },
  lbPoints: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  barBg: { height: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, overflow: "hidden" },
  barFill: { height: 4, borderRadius: 3 },
  emptyLeaderboard: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 5 },
  summaryError: { color: "#FDE68A", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 6 },
  challengesSection: { paddingHorizontal: 16, paddingTop: 20 },
  challengeHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 5, marginBottom: 14, lineHeight: 17 },
  practiceChip: { backgroundColor: "#F5F3FF", borderRadius: 18, paddingHorizontal: 9, paddingVertical: 4 },
  practiceChipText: { fontSize: 9, fontFamily: "Inter_700Bold", color: "#7C3AED", letterSpacing: 0.4 },
  challengeCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, backgroundColor: "#fff", padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  challengeIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  challengeEmoji: { fontSize: 22 },
  challengeInfo: { flex: 1, minWidth: 0 },
  challengeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 2 },
  challengeDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 4 },
  challengeMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  challengeStatus: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  challengePts: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#7C3AED", backgroundColor: "#F5F3FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: "hidden" },
  playBtn: { minWidth: 76, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 22, alignItems: "center" },
  playBtnText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  modalRoot: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 9, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF3" },
  modalTitle: { flex: 1, color: "#18243B", fontSize: 17, fontFamily: "Inter_700Bold" },
  closeButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F4F8" },
});
