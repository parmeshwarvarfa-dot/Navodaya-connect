import React, { useState, useEffect } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, type DailyPuzzleItem } from "@/lib/api";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const PUZZLE_ICONS: Record<string, { icon: string; emoji: string; color: string; desc: string }> = {
  word_of_day: { icon: "book-outline", emoji: "🔤", color: "#8B5CF6", desc: "Guess the hidden 5-letter word in 6 tries" },
  connections: { icon: "grid-outline", emoji: "🧩", color: "#3B82F6", desc: "Find four groups of four related items" },
  number_ninja: { icon: "calculator-outline", emoji: "🔢", color: "#10B981", desc: "Speed mathematics and number sequences" },
  mini_crossword: { icon: "create-outline", emoji: "📝", color: "#F59E0B", desc: "Daily 5×5 crossword with across & down clues" },
  daily_gk: { icon: "school-outline", emoji: "🧠", color: "#EC4899", desc: "5 curated GK questions on India & science" },
  pattern_master: { icon: "shapes-outline", emoji: "🔷", color: "#6366F1", desc: "Visual shape and logical sequence reasoning" },
};

interface DailyPuzzleSectionProps {
  userHouse?: string;
  onPointsEarned: () => void;
}

export default function DailyPuzzleSection({ userHouse, onPointsEarned }: DailyPuzzleSectionProps) {
  const [puzzles, setPuzzles] = useState<DailyPuzzleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activePuzzle, setActivePuzzle] = useState<DailyPuzzleItem | null>(null);

  // Play modal state
  const [isPracticeMode, setIsPracticeMode] = useState(false);
  const [wordleGuess, setWordleGuess] = useState("");
  const [wordleRows, setWordleRows] = useState<any[]>([]);
  const [selectedConnectionsWords, setSelectedConnectionsWords] = useState<string[]>([]);
  const [connectionsSolvedGroups, setConnectionsSolvedGroups] = useState<any[]>([]);
  const [choiceSelection, setChoiceSelection] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [puzzleOutcome, setPuzzleOutcome] = useState<any>(null);

  const fetchPuzzles = async () => {
    try {
      setLoading(true);
      const res = await api.competition.dailyPuzzles();
      setPuzzles(res.puzzles);
    } catch (err) {
      console.warn("[DailyPuzzles] fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchPuzzles();
  }, []);

  const openPuzzleModal = (p: DailyPuzzleItem, practice = false) => {
    setActivePuzzle(p);
    setIsPracticeMode(practice);
    setWordleGuess("");
    setWordleRows([]);
    setSelectedConnectionsWords([]);
    setConnectionsSolvedGroups([]);
    setChoiceSelection(null);
    setPuzzleOutcome(null);
  };

  const closePuzzleModal = () => {
    setActivePuzzle(null);
    setPuzzleOutcome(null);
  };

  // Wordle Guess Submission
  const handleWordleSubmit = async () => {
    if (!activePuzzle || wordleGuess.length !== 5 || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.competition.submitDailyPuzzle(activePuzzle.id, wordleGuess, isPracticeMode);
      const newRow = res.feedback?.letters || [];
      setWordleRows((prev) => [...prev, newRow]);
      setWordleGuess("");

      if (res.isCorrect || wordleRows.length >= 5) {
        setPuzzleOutcome({
          isCorrect: res.isCorrect,
          pointsAwarded: res.pointsAwarded,
          message: res.isCorrect ? "Splendid! Word of the Day Solved!" : "Nice try! Come back tomorrow for the next puzzle.",
        });
        if (res.isCorrect && !isPracticeMode) onPointsEarned();
        void fetchPuzzles();
      }
    } catch (err: any) {
      Alert.alert("Puzzle Attempt", err?.message || "Failed to submit word");
    } finally {
      setSubmitting(false);
    }
  };

  // Connections Word Tile Press
  const toggleConnectionWord = (word: string) => {
    if (selectedConnectionsWords.includes(word)) {
      setSelectedConnectionsWords((prev) => prev.filter((w) => w !== word));
    } else {
      if (selectedConnectionsWords.length < 4) {
        setSelectedConnectionsWords((prev) => [...prev, word]);
      }
    }
  };

  const handleConnectionsSubmit = async () => {
    if (!activePuzzle || selectedConnectionsWords.length !== 4 || submitting) return;
    setSubmitting(true);
    try {
      const res = await api.competition.submitDailyPuzzle(activePuzzle.id, selectedConnectionsWords, isPracticeMode);
      if (res.feedback?.matchedGroup) {
        setConnectionsSolvedGroups((prev) => [...prev, res.feedback.matchedGroup]);
        setSelectedConnectionsWords([]);

        if (connectionsSolvedGroups.length + 1 >= 4) {
          setPuzzleOutcome({
            isCorrect: true,
            pointsAwarded: res.pointsAwarded,
            message: "Outstanding! All 4 categories linked!",
          });
          if (!isPracticeMode) onPointsEarned();
          void fetchPuzzles();
        }
      } else {
        Alert.alert("Not Quite", "Those 4 words don't form a complete category group. Try again!");
        setSelectedConnectionsWords([]);
      }
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to submit group");
    } finally {
      setSubmitting(false);
    }
  };

  // Choice Puzzle Submit (Number Ninja, Daily GK, Pattern Master)
  const handleChoiceSubmit = async (ansIdx: number) => {
    if (!activePuzzle || submitting) return;
    setChoiceSelection(ansIdx);
    setSubmitting(true);
    try {
      const res = await api.competition.submitDailyPuzzle(activePuzzle.id, ansIdx, isPracticeMode);
      setPuzzleOutcome({
        isCorrect: res.isCorrect,
        pointsAwarded: res.pointsAwarded,
        message: res.isCorrect ? "Correct! Challenge successfully passed." : "Good attempt! Solution recorded.",
      });
      if (res.isCorrect && !isPracticeMode) onPointsEarned();
      void fetchPuzzles();
    } catch (err: any) {
      Alert.alert("Error", err?.message || "Failed to submit answer");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <View>
          <Text style={styles.title}>🧩 Daily Puzzle Zone</Text>
          <Text style={styles.subtitle}>
            6 new challenges released daily at midnight • 1 scored attempt
          </Text>
        </View>
        <TouchableOpacity onPress={fetchPuzzles} style={styles.refreshBtn}>
          <Ionicons name="refresh" size={16} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color="#7C3AED" />
          <Text style={styles.loadingText}>Fetching today's brain games...</Text>
        </View>
      ) : (
        <View style={styles.puzzleGrid}>
          {puzzles.map((p) => {
            const meta = PUZZLE_ICONS[p.puzzleType] || {
              icon: "bulb-outline",
              emoji: "🎯",
              color: "#7C3AED",
              desc: "Solve today's puzzle challenge",
            };
            const isCompleted = p.isCompleted;

            return (
              <View key={p.id} style={styles.puzzleCard}>
                <View style={styles.cardHeader}>
                  <View style={[styles.iconBox, { backgroundColor: `${meta.color}18` }]}>
                    <Text style={{ fontSize: 24 }}>{meta.emoji}</Text>
                  </View>
                  <View style={styles.pointsBadge}>
                    <Text style={styles.pointsBadgeText}>+{p.maxRewardPoints} pts</Text>
                  </View>
                </View>

                <Text style={styles.puzzleTitle}>{p.title}</Text>
                <Text style={styles.puzzleDesc}>{meta.desc}</Text>

                {/* Status or Streak */}
                <View style={styles.cardMetaRow}>
                  {isCompleted ? (
                    <View style={styles.completedPill}>
                      <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                      <Text style={styles.completedText}>Completed (+{p.scoreAwarded} pts)</Text>
                    </View>
                  ) : (
                    <View style={styles.streakPill}>
                      <Ionicons name="flame" size={14} color="#F59E0B" />
                      <Text style={styles.streakText}>Streak: {p.streakCount}d</Text>
                    </View>
                  )}
                </View>

                {/* Actions */}
                <View style={styles.cardActionsRow}>
                  {isCompleted ? (
                    <TouchableOpacity
                      style={styles.practiceBtn}
                      onPress={() => openPuzzleModal(p, true)}
                    >
                      <Text style={styles.practiceBtnText}>Practice Mode</Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        style={styles.playOfficialBtn}
                        onPress={() => openPuzzleModal(p, false)}
                      >
                        <Text style={styles.playOfficialBtnText}>Play (Scored)</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.practiceMiniBtn}
                        onPress={() => openPuzzleModal(p, true)}
                      >
                        <Text style={styles.practiceMiniText}>Practice</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* ── PUZZLE GAMEPLAY MODAL ── */}
      <Modal visible={!!activePuzzle} transparent animationType="slide" onRequestClose={closePuzzleModal}>
        <View style={styles.modalBackdrop}>
          <View style={styles.puzzleModalContainer}>
            {activePuzzle && (
              <>
                <View style={styles.modalHeader}>
                  <View>
                    <Text style={styles.modalTitle}>{activePuzzle.title}</Text>
                    <Text style={styles.modeSubtitle}>
                      {isPracticeMode ? "Unscored Practice Mode (0 pts)" : `Official Daily Attempt (+${activePuzzle.maxRewardPoints} pts)`}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={closePuzzleModal} style={styles.closeBtn}>
                    <Ionicons name="close" size={24} color="#1E1B4B" />
                  </TouchableOpacity>
                </View>

                <ScrollView contentContainerStyle={styles.puzzleModalBody}>
                  {puzzleOutcome ? (
                    <View style={styles.outcomeCard}>
                      <Text style={{ fontSize: 44 }}>
                        {puzzleOutcome.isCorrect ? "🎉" : "💡"}
                      </Text>
                      <Text style={styles.outcomeTitle}>
                        {puzzleOutcome.isCorrect ? "PUZZLE SOLVED!" : "COMPLETED"}
                      </Text>
                      <Text style={styles.outcomeMessage}>{puzzleOutcome.message}</Text>
                      {!isPracticeMode && puzzleOutcome.isCorrect && (
                        <View style={styles.rewardBox}>
                          <Text style={styles.rewardText}>+{puzzleOutcome.pointsAwarded} House Points</Text>
                          <Text style={styles.rewardSub}>Added to your verified contribution ledger</Text>
                        </View>
                      )}
                      <TouchableOpacity style={styles.closeModalBtn} onPress={closePuzzleModal}>
                        <Text style={styles.closeModalBtnText}>Continue</Text>
                      </TouchableOpacity>
                    </View>
                  ) : activePuzzle.puzzleType === "word_of_day" ? (
                    /* ── WORD OF THE DAY GAME ── */
                    <View style={styles.wordleGameContainer}>
                      <Text style={styles.wordleHint}>
                        💡 Hint: {activePuzzle.puzzleData.hint}
                      </Text>

                      {/* Previous Rows */}
                      <View style={styles.wordleGrid}>
                        {wordleRows.map((row, rIdx) => (
                          <View key={rIdx} style={styles.wordleRow}>
                            {row.map((cell: any, cIdx: number) => {
                              const isGreen = cell.status === "correct";
                              const isYellow = cell.status === "present";
                              const bg = isGreen ? "#10B981" : isYellow ? "#F59E0B" : "#6B7280";
                              return (
                                <View key={cIdx} style={[styles.wordleCell, { backgroundColor: bg, borderColor: bg }]}>
                                  <Text style={styles.wordleCellText}>{cell.letter}</Text>
                                </View>
                              );
                            })}
                          </View>
                        ))}
                      </View>

                      {/* Input */}
                      <View style={styles.wordleInputBox}>
                        <TextInput
                          style={styles.wordleInput}
                          maxLength={5}
                          autoCapitalize="characters"
                          placeholder="ENTER 5 LETTERS"
                          placeholderTextColor="#9CA3AF"
                          value={wordleGuess}
                          onChangeText={setWordleGuess}
                        />
                        <TouchableOpacity
                          style={[styles.wordleSubmitBtn, wordleGuess.length !== 5 && { opacity: 0.5 }]}
                          onPress={handleWordleSubmit}
                          disabled={wordleGuess.length !== 5 || submitting}
                        >
                          <Text style={styles.wordleSubmitText}>GUESS</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : activePuzzle.puzzleType === "connections" ? (
                    /* ── CONNECTIONS 16-WORD GAME ── */
                    <View style={styles.connectionsContainer}>
                      <Text style={styles.connectionsInstruction}>
                        Select 4 related words and submit your group:
                      </Text>

                      {/* Solved Groups */}
                      {connectionsSolvedGroups.map((g, idx) => (
                        <View key={idx} style={[styles.solvedGroupCard, { backgroundColor: g.color || "#10B981" }]}>
                          <Text style={styles.solvedCategory}>{g.category}</Text>
                          <Text style={styles.solvedWords}>{g.words.join(", ")}</Text>
                        </View>
                      ))}

                      {/* Words Grid */}
                      <View style={styles.connectionsGrid}>
                        {(activePuzzle.puzzleData.words || []).map((w: string) => {
                          const isSolved = connectionsSolvedGroups.some((g) =>
                            g.words.map((item: string) => item.toLowerCase()).includes(w.toLowerCase())
                          );
                          if (isSolved) return null;
                          const isSelected = selectedConnectionsWords.includes(w);

                          return (
                            <TouchableOpacity
                              key={w}
                              style={[styles.connectionTile, isSelected && styles.connectionTileSelected]}
                              onPress={() => toggleConnectionWord(w)}
                              activeOpacity={0.7}
                            >
                              <Text style={[styles.connectionTileText, isSelected && styles.connectionTileTextSelected]}>
                                {w}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>

                      {/* Submit */}
                      <TouchableOpacity
                        style={[
                          styles.submitConnectionsBtn,
                          selectedConnectionsWords.length !== 4 && { opacity: 0.5 },
                        ]}
                        onPress={handleConnectionsSubmit}
                        disabled={selectedConnectionsWords.length !== 4 || submitting}
                      >
                        <Text style={styles.submitConnectionsBtnText}>
                          SUBMIT GROUP ({selectedConnectionsWords.length}/4)
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    /* ── GENERAL CHOICE / MULTI-QUESTION PUZZLE ── */
                    <View style={styles.choicePuzzleContainer}>
                      {activePuzzle.puzzleData.questions ? (
                        activePuzzle.puzzleData.questions.map((q: any) => (
                          <View key={q.id} style={styles.choiceQCard}>
                            <Text style={styles.choiceQPrompt}>{q.prompt}</Text>
                            <View style={styles.choiceOptionsList}>
                              {q.options.map((opt: string, idx: number) => (
                                <TouchableOpacity
                                  key={idx}
                                  style={[
                                    styles.choiceOptBtn,
                                    choiceSelection === idx && styles.choiceOptBtnSelected,
                                  ]}
                                  onPress={() => handleChoiceSubmit(idx)}
                                  disabled={submitting}
                                >
                                  <Text style={styles.choiceOptText}>{opt}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))
                      ) : activePuzzle.puzzleData.challenges ? (
                        activePuzzle.puzzleData.challenges.slice(0, 1).map((c: any) => (
                          <View key={c.id} style={styles.choiceQCard}>
                            <Text style={styles.choiceQPrompt}>{c.prompt}</Text>
                            <View style={styles.choiceOptionsList}>
                              {c.options.map((opt: any, idx: number) => (
                                <TouchableOpacity
                                  key={idx}
                                  style={[
                                    styles.choiceOptBtn,
                                    choiceSelection === idx && styles.choiceOptBtnSelected,
                                  ]}
                                  onPress={() => handleChoiceSubmit(idx)}
                                  disabled={submitting}
                                >
                                  <Text style={styles.choiceOptText}>{String(opt)}</Text>
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        ))
                      ) : (
                        <ActivityIndicator color="#7C3AED" />
                      )}
                    </View>
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
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 10,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_800ExtraBold",
    color: "#1E1B4B",
  },
  subtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 3,
    maxWidth: 280,
    lineHeight: 16,
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
  puzzleGrid: {
    gap: 12,
  },
  puzzleCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  pointsBadge: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  pointsBadgeText: {
    color: "#7C3AED",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  puzzleTitle: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    marginBottom: 2,
  },
  puzzleDesc: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 16,
    marginBottom: 12,
  },
  cardMetaRow: {
    marginBottom: 12,
  },
  completedPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
    gap: 4,
  },
  completedText: {
    color: "#059669",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  streakPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFBEB",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    alignSelf: "flex-start",
    gap: 4,
  },
  streakText: {
    color: "#D97706",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  cardActionsRow: {
    flexDirection: "row",
    gap: 8,
  },
  playOfficialBtn: {
    flex: 1,
    backgroundColor: "#7C3AED",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  playOfficialBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  practiceMiniBtn: {
    backgroundColor: "#F3F4F6",
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  practiceMiniText: {
    color: "#4B5563",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  practiceBtn: {
    flex: 1,
    backgroundColor: "#EDE9FE",
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  practiceBtnText: {
    color: "#7C3AED",
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },

  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  puzzleModalContainer: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "90%",
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: "Inter_800ExtraBold",
    color: "#1E1B4B",
  },
  modeSubtitle: {
    fontSize: 11,
    color: "#7C3AED",
    fontFamily: "Inter_600SemiBold",
    marginTop: 2,
  },
  closeBtn: {
    padding: 4,
  },
  puzzleModalBody: {
    padding: 20,
    paddingBottom: 36,
  },
  outcomeCard: {
    backgroundColor: "#FAF5FF",
    borderRadius: 20,
    padding: 24,
    alignItems: "center",
  },
  outcomeTitle: {
    fontSize: 20,
    fontFamily: "Inter_800ExtraBold",
    color: "#1E1B4B",
    marginTop: 10,
  },
  outcomeMessage: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
  },
  rewardBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    alignItems: "center",
    marginVertical: 16,
    width: "100%",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  rewardText: {
    fontSize: 16,
    fontFamily: "Inter_800ExtraBold",
    color: "#7C3AED",
  },
  rewardSub: {
    fontSize: 11,
    color: "#9CA3AF",
    marginTop: 2,
  },
  closeModalBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  closeModalBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },

  // Wordle Styles
  wordleGameContainer: {
    alignItems: "center",
  },
  wordleHint: {
    fontSize: 13,
    color: "#4B5563",
    fontFamily: "Inter_500Medium",
    marginBottom: 20,
    textAlign: "center",
  },
  wordleGrid: {
    gap: 8,
    marginBottom: 24,
  },
  wordleRow: {
    flexDirection: "row",
    gap: 8,
  },
  wordleCell: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  wordleCellText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_800ExtraBold",
  },
  wordleInputBox: {
    flexDirection: "row",
    gap: 8,
    width: "100%",
  },
  wordleInput: {
    flex: 1,
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    textAlign: "center",
    letterSpacing: 2,
  },
  wordleSubmitBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  wordleSubmitText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
  },

  // Connections Styles
  connectionsContainer: {
    alignItems: "center",
  },
  connectionsInstruction: {
    fontSize: 13,
    color: "#4B5563",
    fontFamily: "Inter_500Medium",
    marginBottom: 16,
    textAlign: "center",
  },
  solvedGroupCard: {
    width: "100%",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    marginBottom: 10,
  },
  solvedCategory: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
    textTransform: "uppercase",
  },
  solvedWords: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 12,
    marginTop: 2,
  },
  connectionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 20,
  },
  connectionTile: {
    width: "48%",
    backgroundColor: "#F3F4F6",
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  connectionTileSelected: {
    backgroundColor: "#1E1B4B",
  },
  connectionTileText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#1E1B4B",
  },
  connectionTileTextSelected: {
    color: "#FDE047",
    fontFamily: "Inter_700Bold",
  },
  submitConnectionsBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 14,
    borderRadius: 14,
    width: "100%",
    alignItems: "center",
  },
  submitConnectionsBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_800ExtraBold",
    letterSpacing: 0.5,
  },

  // Choice Styles
  choicePuzzleContainer: {
    gap: 14,
  },
  choiceQCard: {
    gap: 12,
  },
  choiceQPrompt: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    lineHeight: 22,
  },
  choiceOptionsList: {
    gap: 8,
  },
  choiceOptBtn: {
    backgroundColor: "#F9FAFB",
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  choiceOptBtnSelected: {
    borderColor: "#7C3AED",
    backgroundColor: "#F5F3FF",
  },
  choiceOptText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#374151",
  },
});

