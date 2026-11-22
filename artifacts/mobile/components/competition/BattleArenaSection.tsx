import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, type HouseBattleItem } from "@/lib/api";
import { getHouseMeta } from "@/constants/HouseTheme";
import LiveIndicator from "./LiveIndicator";

interface BattleArenaSectionProps {
  userHouse: string;
  onPointsEarned: () => void;
}

export default function BattleArenaSection({ userHouse, onPointsEarned }: BattleArenaSectionProps) {
  const [battles, setBattles] = useState<HouseBattleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [matchmaking, setMatchmaking] = useState(false);
  const [activeBattle, setActiveBattle] = useState<HouseBattleItem | null>(null);

  // Active match play state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerFeedback, setAnswerFeedback] = useState<string | null>(null);
  const [submittingAnswer, setSubmittingAnswer] = useState(false);
  const [battleScore, setBattleScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(90);
  const [battleFinished, setBattleFinished] = useState(false);
  const [battleResult, setBattleResult] = useState<any>(null);

  const fetchBattles = async () => {
    try {
      setLoading(true);
      const res = await api.competition.battles();
      setBattles(res.battles);
    } catch (err) {
      console.warn("[BattleArena] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchBattles();
  }, []);

  // Timer countdown during live battle
  useEffect(() => {
    if (!activeBattle || battleFinished || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          void handleFinishBattle();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBattle, battleFinished, timeLeft]);

  const handleRandomMatch = async () => {
    setMatchmaking(true);
    try {
      const res = await api.competition.randomMatch();
      setActiveBattle(res.battle);
      setCurrentQIndex(0);
      setBattleScore(0);
      setTimeLeft(res.battle.durationSeconds || 90);
      setBattleFinished(false);
      setBattleResult(null);
    } catch (err: any) {
      Alert.alert("Matchmaking Error", err?.message || "Failed to find random match");
    } finally {
      setMatchmaking(false);
    }
  };

  const handleJoinBattle = async (battle: HouseBattleItem) => {
    try {
      const res = await api.competition.joinBattle(battle.id);
      setActiveBattle(res.battle);
      setCurrentQIndex(0);
      setBattleScore(0);
      setTimeLeft(res.battle.durationSeconds || 90);
      setBattleFinished(false);
      setBattleResult(null);
    } catch (err: any) {
      Alert.alert("Battle Access", err?.message || "Unable to join battle");
    }
  };

  const handleAnswer = async (ansIndex: number) => {
    if (!activeBattle || submittingAnswer || selectedAnswer !== null) return;
    setSelectedAnswer(ansIndex);
    setSubmittingAnswer(true);

    const questions = activeBattle.questions || [];
    const currQ = questions[currentQIndex];

    try {
      const res = await api.competition.submitBattleAnswer(activeBattle.id, currQ.id, ansIndex);
      setBattleScore(res.currentScore);
      setAnswerFeedback(res.explanation || (res.correct ? "Correct! +points" : "Incorrect!"));

      setTimeout(() => {
        setAnswerFeedback(null);
        setSelectedAnswer(null);
        setSubmittingAnswer(false);

        if (currentQIndex + 1 < questions.length) {
          setCurrentQIndex((prev) => prev + 1);
        } else {
          void handleFinishBattle();
        }
      }, 1200);
    } catch {
      setSubmittingAnswer(false);
      setSelectedAnswer(null);
    }
  };

  const handleFinishBattle = async () => {
    if (!activeBattle || battleFinished) return;
    setBattleFinished(true);
    try {
      const res = await api.competition.finishBattle(activeBattle.id);
      setBattleResult(res);
      onPointsEarned();
      void fetchBattles();
    } catch (err) {
      console.warn("[BattleArena] finish error:", err);
    }
  };

  const closeBattleModal = () => {
    setActiveBattle(null);
    setBattleFinished(false);
    setBattleResult(null);
  };

  return (
    <View style={styles.container}>
      {/* ── Random Matchmaking Banner ── */}
      <LinearGradient
        colors={["#1E1B4B", "#312E81", "#4338CA"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.matchmakingBanner}
      >
        <View style={styles.matchmakingHeader}>
          <View>
            <Text style={styles.matchmakingTitle}>⚡ Battle Arena 2.0</Text>
            <Text style={styles.matchmakingSubtitle}>
              Multiplayer battles between Aravali, Nilgiri, Shiwalik & Udaygiri
            </Text>
          </View>
          <LiveIndicator status="LIVE" />
        </View>

        <TouchableOpacity
          style={[styles.findMatchBtn, matchmaking && { opacity: 0.7 }]}
          onPress={handleRandomMatch}
          disabled={matchmaking}
          activeOpacity={0.85}
        >
          {matchmaking ? (
            <ActivityIndicator color="#1E1B4B" size="small" />
          ) : (
            <>
              <Ionicons name="flash" size={18} color="#1E1B4B" />
              <Text style={styles.findMatchBtnText}>FIND RANDOM MATCHUP</Text>
            </>
          )}
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Active & Scheduled Battles ── */}
      <View style={styles.battlesHeaderRow}>
        <Text style={styles.sectionHeading}>Live & Upcoming Battles</Text>
        <TouchableOpacity onPress={fetchBattles} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={16} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#7C3AED" />
          <Text style={styles.loadingText}>Loading arena battles...</Text>
        </View>
      ) : battles.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyText}>No battles currently active. Start one above!</Text>
        </View>
      ) : (
        <View style={styles.battlesList}>
          {battles.map((b) => {
            const houseAMeta = getHouseMeta(b.houseA);
            const houseBMeta = getHouseMeta(b.houseB);
            const isLive = b.status === "live";

            return (
              <View key={b.id} style={styles.battleCard}>
                <View style={styles.cardTopRow}>
                  <Text style={styles.battleTitle}>{b.title}</Text>
                  <View style={[styles.statusBadge, isLive && styles.statusBadgeLive]}>
                    <Text style={[styles.statusBadgeText, isLive && styles.statusBadgeTextLive]}>
                      {b.status.toUpperCase()}
                    </Text>
                  </View>
                </View>

                {/* VS Visualizer */}
                <View style={styles.vsContainer}>
                  {/* House A */}
                  <View style={[styles.houseSide, { borderColor: houseAMeta.borderColor, backgroundColor: houseAMeta.bgColor }]}>
                    <Text style={{ fontSize: 24 }}>{houseAMeta.emoji}</Text>
                    <Text style={[styles.houseNameText, { color: houseAMeta.textColor }]}>
                      {houseAMeta.displayName}
                    </Text>
                    <Text style={[styles.scoreText, { color: houseAMeta.textColor }]}>
                      {b.scoreA} pts
                    </Text>
                  </View>

                  {/* VS Badge */}
                  <View style={styles.vsPill}>
                    <Text style={styles.vsPillText}>VS</Text>
                  </View>

                  {/* House B */}
                  <View style={[styles.houseSide, { borderColor: houseBMeta.borderColor, backgroundColor: houseBMeta.bgColor }]}>
                    <Text style={{ fontSize: 24 }}>{houseBMeta.emoji}</Text>
                    <Text style={[styles.houseNameText, { color: houseBMeta.textColor }]}>
                      {houseBMeta.displayName}
                    </Text>
                    <Text style={[styles.scoreText, { color: houseBMeta.textColor }]}>
                      {b.scoreB} pts
                    </Text>
                  </View>
                </View>

                {/* Action CTA */}
                <TouchableOpacity
                  style={[styles.enterBattleBtn, !isLive && { backgroundColor: "#6D28D9" }]}
                  onPress={() => handleJoinBattle(b)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.enterBattleBtnText}>
                    {isLive ? "ENTER BATTLE →" : "VIEW DETAILS"}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      )}

      {/* ── LIVE BATTLE ROOM MODAL ── */}
      <Modal visible={!!activeBattle} transparent animationType="slide" onRequestClose={closeBattleModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.battleRoomContainer}>
            {activeBattle && (
              <>
                {/* Battle Header */}
                <LinearGradient
                  colors={["#1E1B4B", "#312E81"]}
                  style={styles.roomHeader}
                >
                  <View style={styles.roomHeaderTop}>
                    <View style={styles.timerChip}>
                      <Ionicons name="time-outline" size={16} color="#FBBF24" />
                      <Text style={styles.timerText}>{timeLeft}s</Text>
                    </View>
                    <Text style={styles.roomTitle} numberOfLines={1}>
                      {activeBattle.title}
                    </Text>
                    <TouchableOpacity onPress={closeBattleModal} style={styles.closeBtn}>
                      <Ionicons name="close" size={22} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>

                  {/* Opponents Ribbon */}
                  <View style={styles.opponentsRibbon}>
                    <View style={styles.ribbonSide}>
                      <Text style={{ fontSize: 18 }}>{getHouseMeta(activeBattle.houseA).emoji}</Text>
                      <Text style={styles.ribbonHouseName}>{activeBattle.houseA}</Text>
                    </View>
                    <View style={styles.ribbonVs}>
                      <Text style={styles.ribbonVsText}>VS</Text>
                    </View>
                    <View style={styles.ribbonSide}>
                      <Text style={{ fontSize: 18 }}>{getHouseMeta(activeBattle.houseB).emoji}</Text>
                      <Text style={styles.ribbonHouseName}>{activeBattle.houseB}</Text>
                    </View>
                  </View>
                </LinearGradient>

                {/* Battle Content */}
                <ScrollView contentContainerStyle={styles.roomContent}>
                  {battleFinished ? (
                    <View style={styles.victoryCard}>
                      <Text style={{ fontSize: 44 }}>🏆</Text>
                      <Text style={styles.victoryHeading}>BATTLE COMPLETED!</Text>
                      <Text style={styles.winnerSub}>
                        Winner: <Text style={{ fontFamily: "Inter_700Bold", color: "#7C3AED" }}>{battleResult?.winnerHouse || "Draw"}</Text>
                      </Text>

                      <View style={styles.pointsEarnedBox}>
                        <Text style={styles.pointsEarnedLabel}>Your Verified Contribution</Text>
                        <Text style={styles.pointsEarnedVal}>+{battleScore || 30} pts</Text>
                        <Text style={styles.pointsEarnedNote}>Authoritatively recorded in Central House Ledger</Text>
                      </View>

                      <TouchableOpacity style={styles.doneBtn} onPress={closeBattleModal}>
                        <Text style={styles.doneBtnText}>Return to Arena</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <>
                      {/* Round Tracker */}
                      <View style={styles.roundTrackerRow}>
                        <Text style={styles.roundLabel}>
                          Question {currentQIndex + 1} of {(activeBattle.questions || []).length}
                        </Text>
                        <Text style={styles.currentScoreChip}>Score: {battleScore} pts</Text>
                      </View>

                      {/* Question Card */}
                      {activeBattle.questions && activeBattle.questions[currentQIndex] ? (
                        <View style={styles.questionCard}>
                          <Text style={styles.questionPrompt}>
                            {activeBattle.questions[currentQIndex].prompt}
                          </Text>

                          {/* Options */}
                          <View style={styles.optionsList}>
                            {activeBattle.questions[currentQIndex].options.map((opt, idx) => {
                              const isSelected = selectedAnswer === idx;
                              return (
                                <TouchableOpacity
                                  key={idx}
                                  style={[
                                    styles.optionBtn,
                                    isSelected && styles.optionBtnSelected,
                                  ]}
                                  onPress={() => handleAnswer(idx)}
                                  disabled={submittingAnswer}
                                  activeOpacity={0.8}
                                >
                                  <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
                                    {opt}
                                  </Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>

                          {/* Immediate Server Feedback */}
                          {answerFeedback && (
                            <View style={styles.feedbackBanner}>
                              <Text style={styles.feedbackText}>{answerFeedback}</Text>
                            </View>
                          )}
                        </View>
                      ) : (
                        <ActivityIndicator color="#7C3AED" />
                      )}
                    </>
                  )}
                </ScrollView>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  matchmakingBanner: {
    borderRadius: 24,
    padding: 18,
    marginTop: 10,
    shadowColor: "#4338CA",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 6,
  },
  matchmakingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  matchmakingTitle: {
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold",
    color: "#FFFFFF",
  },
  matchmakingSubtitle: {
    fontSize: 12,
    color: "#C7D2FE",
    marginTop: 3,
    maxWidth: 240,
    lineHeight: 16,
  },
  findMatchBtn: {
    backgroundColor: "#FDE047",
    paddingVertical: 13,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  findMatchBtnText: {
    color: "#1E1B4B",
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: 0.6,
  },
  battlesHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 22,
    marginBottom: 12,
  },
  sectionHeading: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
  },
  refreshBtn: {
    padding: 6,
  },
  loadingBox: {
    paddingVertical: 30,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 12,
    color: "#6B7280",
  },
  emptyBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    fontSize: 13,
    color: "#6B7280",
  },
  battlesList: {
    gap: 12,
  },
  battleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  battleTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusBadgeLive: {
    backgroundColor: "#ECFDF5",
  },
  statusBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#6B7280",
  },
  statusBadgeTextLive: {
    color: "#059669",
  },
  vsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  houseSide: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRadius: 16,
    borderWidth: 1,
  },
  houseNameText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginTop: 4,
  },
  scoreText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  vsPill: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1E1B4B",
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: 8,
  },
  vsPillText: {
    color: "#FDE047",
    fontSize: 11,
    fontFamily: "Inter_800ExtraBold",
  },
  enterBattleBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  enterBattleBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.5,
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  battleRoomContainer: {
    backgroundColor: "#F8F7FF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "92%",
    overflow: "hidden",
  },
  roomHeader: {
    padding: 18,
    paddingBottom: 16,
  },
  roomHeaderTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  timerChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  timerText: {
    color: "#FBBF24",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  roomTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
    flex: 1,
    marginHorizontal: 8,
    textAlign: "center",
  },
  closeBtn: {
    padding: 4,
  },
  opponentsRibbon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    paddingVertical: 8,
  },
  ribbonSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  ribbonHouseName: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  ribbonVs: {
    backgroundColor: "#FDE047",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  ribbonVsText: {
    color: "#1E1B4B",
    fontSize: 10,
    fontFamily: "Inter_800ExtraBold",
  },
  roomContent: {
    padding: 20,
    paddingBottom: 36,
  },
  roundTrackerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  roundLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#4B5563",
  },
  currentScoreChip: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },
  questionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  questionPrompt: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    lineHeight: 24,
    marginBottom: 20,
  },
  optionsList: {
    gap: 10,
  },
  optionBtn: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  optionBtnSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  optionText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
  },
  optionTextSelected: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },
  feedbackBanner: {
    marginTop: 14,
    backgroundColor: "#FEF3C7",
    padding: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  feedbackText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#92400E",
  },
  victoryCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
  },
  victoryHeading: {
    fontSize: 20,
    fontFamily: "Inter_800ExtraBold",
    color: "#1E1B4B",
    marginTop: 10,
  },
  winnerSub: {
    fontSize: 14,
    color: "#4B5563",
    marginTop: 4,
  },
  pointsEarnedBox: {
    backgroundColor: "#F5F3FF",
    borderRadius: 16,
    padding: 16,
    alignItems: "center",
    width: "100%",
    marginVertical: 20,
  },
  pointsEarnedLabel: {
    fontSize: 12,
    color: "#6D28D9",
    fontFamily: "Inter_600SemiBold",
  },
  pointsEarnedVal: {
    fontSize: 28,
    fontFamily: "Inter_800ExtraBold",
    color: "#7C3AED",
    marginVertical: 4,
  },
  pointsEarnedNote: {
    fontSize: 11,
    color: "#6B7280",
    textAlign: "center",
  },
  doneBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: "100%",
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
});
