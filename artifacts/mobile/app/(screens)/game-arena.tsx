import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

const GAMES = [
  { id: "tictactoe", title: "Tic Tac Toe",     emoji: "⭕", desc: "Classic 3×3 strategy game", color: "#3D5AF1", bg: "#EEF2FF",  players: "2 Players", category: "Strategy"  },
  { id: "quiz",      title: "JNV Quiz",          emoji: "🧠", desc: "Test your GK & academic knowledge", color: "#10B981", bg: "#ECFDF5", players: "Solo",     category: "Knowledge" },
  { id: "wordguess", title: "Word Guess",        emoji: "📝", desc: "Guess the hidden word (Wordle-style)", color: "#8B5CF6", bg: "#F5F3FF", players: "Solo",     category: "Word"      },
  { id: "memory",    title: "Memory Match",      emoji: "🃏", desc: "Find matching pairs before time runs out", color: "#F59E0B", bg: "#FFFBEB", players: "Solo",  category: "Memory"    },
  { id: "math",      title: "Math Sprint",       emoji: "🔢", desc: "Solve math problems as fast as you can", color: "#EF4444", bg: "#FEF2F2", players: "Solo",   category: "Math"      },
  { id: "riddle",    title: "JNV Riddles",       emoji: "🤔", desc: "Tricky riddles from Navodayan life", color: "#0891B2", bg: "#E0F2FE",  players: "Solo",     category: "Fun"       },
];

// ── Tic Tac Toe ────────────────────────────────────────────────────────────────
function TicTacToe({ onClose }: { onClose: () => void }) {
  const [board,   setBoard]   = useState<(string | null)[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);
  const [score,   setScore]   = useState({ X: 0, O: 0 });

  const lines = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
  const winner = (() => { for (const [a,b,c] of lines) { if (board[a] && board[a]===board[b] && board[a]===board[c]) return board[a]; } return null; })();
  const isDraw = !winner && board.every(Boolean);
  const status = winner ? `🎉 ${winner} Wins!` : isDraw ? "🤝 Draw!" : `${xIsNext ? "✕" : "◯"}'s Turn`;

  const handlePress = (i: number) => {
    if (board[i] || winner) return;
    const next = [...board];
    next[i] = xIsNext ? "X" : "O";
    setBoard(next);
    setXIsNext(!xIsNext);
    const w = (() => { for (const [a,b,c] of lines) { if (next[a] && next[a]===next[b] && next[a]===next[c]) return next[a]; } return null; })();
    if (w) setScore((s) => ({ ...s, [w]: s[w as "X"|"O"] + 1 }));
  };

  const reset = () => { setBoard(Array(9).fill(null)); setXIsNext(true); };

  return (
    <View style={game.container}>
      <View style={game.scoreRow}>
        <View style={game.scoreBox}><Text style={game.scoreLabel}>✕ You</Text><Text style={game.scoreVal}>{score.X}</Text></View>
        <Text style={game.status}>{status}</Text>
        <View style={game.scoreBox}><Text style={game.scoreLabel}>◯ CPU</Text><Text style={game.scoreVal}>{score.O}</Text></View>
      </View>
      <View style={game.tttGrid}>
        {board.map((cell, i) => (
          <TouchableOpacity key={i} style={[game.tttCell, cell && { backgroundColor: cell==="X" ? "#EEF2FF" : "#ECFDF5" }]} onPress={() => handlePress(i)}>
            <Text style={[game.tttCellText, { color: cell==="X" ? "#3D5AF1" : "#10B981" }]}>{cell === "X" ? "✕" : cell === "O" ? "◯" : ""}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity style={game.resetBtn} onPress={reset}><Text style={game.resetBtnText}>New Game</Text></TouchableOpacity>
    </View>
  );
}

// ── JNV Quiz ─────────────────────────────────────────────────────────────────
const QUIZ_QS = [
  { q: "JNV stands for?", opts: ["Jawahar Navodaya Vidyalaya","Junior Naval Vidyalaya","Jawaharlal National Vidyalaya","Junior Navodaya Vidyalaya"], ans: 0 },
  { q: "How many JNVs are there in India?", opts: ["550","611","661","700"], ans: 2 },
  { q: "JNV schools are governed by?", opts: ["CBSE","NVS","NCERT","HRD Ministry"], ans: 1 },
  { q: "The lateral entry test for JNV Class 9 is conducted by?", opts: ["NTA","NVS","CBSE","State Board"], ans: 1 },
  { q: "In which year was NVS established?", opts: ["1986","1990","1976","1985"], ans: 0 },
];

function JNVQuiz({ onClose }: { onClose: () => void }) {
  const [qi, setQi]       = useState(0);
  const [score, setScore] = useState(0);
  const [selected, setSel] = useState<number | null>(null);
  const [done, setDone]   = useState(false);

  const q = QUIZ_QS[qi];
  const answer = (idx: number) => {
    if (selected !== null) return;
    setSel(idx);
    if (idx === q.ans) setScore((s) => s + 1);
    setTimeout(() => {
      if (qi + 1 >= QUIZ_QS.length) { setDone(true); }
      else { setQi((q) => q + 1); setSel(null); }
    }, 900);
  };

  const restart = () => { setQi(0); setScore(0); setSel(null); setDone(false); };

  if (done) return (
    <View style={game.container}>
      <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>{score >= 4 ? "🏆" : score >= 2 ? "🌟" : "📚"}</Text>
      <Text style={[game.status, { fontSize: 22, marginBottom: 6 }]}>{score}/{QUIZ_QS.length} Correct!</Text>
      <Text style={{ color: "#6B7280", fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 20 }}>
        {score >= 4 ? "Excellent! You really know your JNV!" : score >= 2 ? "Good job! Keep learning!" : "Keep studying — you'll do better!"}
      </Text>
      <TouchableOpacity style={game.resetBtn} onPress={restart}><Text style={game.resetBtnText}>Play Again</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={game.container}>
      <View style={game.quizTop}><Text style={game.quizProgress}>Q{qi+1}/{QUIZ_QS.length}</Text><Text style={game.quizScore}>Score: {score}</Text></View>
      <Text style={game.quizQ}>{q.q}</Text>
      <View style={game.quizOpts}>
        {q.opts.map((opt, i) => {
          const isRight = selected !== null && i === q.ans;
          const isWrong = selected === i && i !== q.ans;
          return (
            <TouchableOpacity key={i} style={[game.quizOpt, isRight && game.quizOptRight, isWrong && game.quizOptWrong]} onPress={() => answer(i)}>
              <Text style={[game.quizOptText, (isRight || isWrong) && { color: "#fff" }]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ── Math Sprint ───────────────────────────────────────────────────────────────
function MathSprint({ onClose }: { onClose: () => void }) {
  const gen = useCallback(() => {
    const a = Math.floor(Math.random() * 20) + 1;
    const b = Math.floor(Math.random() * 20) + 1;
    const op = ["+", "-", "×"][Math.floor(Math.random() * 3)];
    const ans = op === "+" ? a + b : op === "-" ? a - b : a * b;
    return { q: `${a} ${op} ${b} = ?`, ans };
  }, []);

  const [cur, setCur]     = useState(gen);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);
  const [time,  setTime]  = useState(30);
  const [done,  setDone]  = useState(false);
  const [flash, setFlash] = useState<"right"|"wrong"|null>(null);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setTime((s) => { if (s <= 1) { setDone(true); return 0; } return s - 1; }), 1000);
    return () => clearInterval(t);
  }, [done]);

  const submit = () => {
    if (!input.trim()) return;
    if (parseInt(input) === cur.ans) { setScore((s) => s + 1); setFlash("right"); }
    else { setFlash("wrong"); }
    setTimeout(() => { setCur(gen()); setInput(""); setFlash(null); }, 400);
  };

  if (done) return (
    <View style={game.container}>
      <Text style={{ fontSize: 48, textAlign: "center", marginBottom: 12 }}>{score >= 15 ? "🔥" : score >= 8 ? "⭐" : "🔢"}</Text>
      <Text style={[game.status, { fontSize: 22 }]}>{score} solved!</Text>
      <Text style={{ color: "#6B7280", fontFamily: "Inter_400Regular", textAlign: "center", margin: 12 }}>{score >= 15 ? "Math genius!" : score >= 8 ? "Great speed!" : "Keep practicing!"}</Text>
      <TouchableOpacity style={game.resetBtn} onPress={() => { setScore(0); setTime(30); setDone(false); setCur(gen()); setInput(""); }}><Text style={game.resetBtnText}>Try Again</Text></TouchableOpacity>
    </View>
  );

  return (
    <View style={[game.container, flash === "right" && { backgroundColor: "#ECFDF5" }, flash === "wrong" && { backgroundColor: "#FEF2F2" }]}>
      <View style={game.quizTop}><Text style={game.quizScore}>⏱ {time}s</Text><Text style={game.quizScore}>✅ {score}</Text></View>
      <Text style={[game.quizQ, { fontSize: 32, marginVertical: 24 }]}>{cur.q}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <View style={[game.mathInput, flash === "right" && { borderColor: "#10B981" }, flash === "wrong" && { borderColor: "#EF4444" }]}>
          <Text style={game.mathInputText}>{input || "_"}</Text>
        </View>
      </View>
      <View style={game.numPad}>
        {["1","2","3","4","5","6","7","8","9","⌫","0","✓"].map((k) => (
          <TouchableOpacity key={k} style={[game.numKey, k==="✓" && game.numKeyEnter, k==="⌫" && game.numKeyBack]} onPress={() => {
            if (k==="⌫") setInput((p) => p.slice(0,-1));
            else if (k==="✓") submit();
            else if (input.length < 4) setInput((p) => (p.startsWith("-") && p.length === 1 ? p + k : p + k));
          }}>
            <Text style={[game.numKeyText, k==="✓" && { color: "#fff" }]}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={() => setInput((p) => p.startsWith("-") ? p.slice(1) : "-" + p)}>
        <Text style={{ color: "#6B7280", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center", marginTop: 6 }}>±  Toggle Negative</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────
export default function GameArenaScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [activeGame, setActiveGame] = useState<string | null>(null);
  const [scores] = useState<Record<string, number>>({});

  const open = (id: string) => setActiveGame(id);
  const close = () => setActiveGame(null);

  const GameComponent = activeGame === "tictactoe" ? <TicTacToe onClose={close} />
    : activeGame === "quiz"  ? <JNVQuiz onClose={close} />
    : activeGame === "math"  ? <MathSprint onClose={close} />
    : null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#3D5AF1", "#6D28D9"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>🎮 Game Arena</Text>
          <Text style={styles.headerSub}>Play & challenge fellow Navodayans</Text>
        </View>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>

        <View style={styles.leaderNote}>
          <Ionicons name="trophy-outline" size={16} color="#F59E0B" />
          <Text style={styles.leaderNoteText}>Games are local only — invite classmates to play together in the same room!</Text>
        </View>

        <Text style={styles.sectionLabel}>Choose a Game</Text>
        <View style={styles.grid}>
          {GAMES.map((g) => (
            <TouchableOpacity key={g.id} style={styles.gameCard} activeOpacity={0.8} onPress={() => open(g.id)}>
              <View style={[styles.gameIconWrap, { backgroundColor: g.bg }]}>
                <Text style={styles.gameEmoji}>{g.emoji}</Text>
              </View>
              <Text style={styles.gameTitle}>{g.title}</Text>
              <Text style={styles.gameDesc}>{g.desc}</Text>
              <View style={styles.gameFooter}>
                <View style={[styles.gameCatPill, { backgroundColor: g.color + "18" }]}>
                  <Text style={[styles.gameCatText, { color: g.color }]}>{g.category}</Text>
                </View>
                <View style={styles.gamePlayersPill}>
                  <Ionicons name="people-outline" size={10} color="#9CA3AF" />
                  <Text style={styles.gamePlayersText}>{g.players}</Text>
                </View>
              </View>
              {g.id !== "tictactoe" && g.id !== "quiz" && g.id !== "math" && (
                <View style={styles.comingSoon}><Text style={styles.comingSoonText}>Coming Soon</Text></View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Game Modal */}
      <Modal visible={!!activeGame} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.gameModal}>
          <View style={styles.gameModalHeader}>
            <Text style={styles.gameModalTitle}>{GAMES.find((g) => g.id === activeGame)?.emoji} {GAMES.find((g) => g.id === activeGame)?.title}</Text>
            <TouchableOpacity style={styles.closeBtn} onPress={close}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>
          {activeGame && !GameComponent && (
            <View style={game.container}>
              <Text style={{ fontSize: 48, textAlign: "center" }}>🚧</Text>
              <Text style={[game.status, { marginTop: 12 }]}>Coming Soon!</Text>
              <Text style={{ color: "#9CA3AF", fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 8 }}>This game is being prepared for you.</Text>
            </View>
          )}
          {GameComponent}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },
  leaderNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#FFFBEB", borderRadius: 12, padding: 12, marginBottom: 18, borderWidth: 1, borderColor: "#FDE68A" },
  leaderNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#92400E" },
  sectionLabel: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gameCard: { width: "47%", backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", gap: 6, overflow: "hidden" },
  gameIconWrap: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  gameEmoji: { fontSize: 26 },
  gameTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827" },
  gameDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 15 },
  gameFooter: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4 },
  gameCatPill: { borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  gameCatText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  gamePlayersPill: { flexDirection: "row", alignItems: "center", gap: 3 },
  gamePlayersText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  comingSoon: { position: "absolute", top: 8, right: 8, backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 3 },
  comingSoonText: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: "#9CA3AF" },
  gameModal: { flex: 1, backgroundColor: "#fff" },
  gameModalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  gameModalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
});

const game = StyleSheet.create({
  container: { flex: 1, padding: 20, alignItems: "center", justifyContent: "center" },
  scoreRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginBottom: 20 },
  scoreBox: { alignItems: "center", gap: 4 },
  scoreLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  scoreVal: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  status: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center" },
  tttGrid: { flexDirection: "row", flexWrap: "wrap", width: 270, gap: 6, marginBottom: 24 },
  tttCell: { width: 83, height: 83, backgroundColor: "#F3F4F6", borderRadius: 14, alignItems: "center", justifyContent: "center" },
  tttCellText: { fontSize: 36, fontFamily: "Inter_700Bold" },
  resetBtn: { backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 40 },
  resetBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  quizTop: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginBottom: 10 },
  quizProgress: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#9CA3AF" },
  quizScore: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  quizQ: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center", marginBottom: 20, lineHeight: 26 },
  quizOpts: { width: "100%", gap: 10 },
  quizOpt: { backgroundColor: "#F3F4F6", borderRadius: 12, padding: 14 },
  quizOptRight: { backgroundColor: "#10B981" },
  quizOptWrong: { backgroundColor: "#EF4444" },
  quizOptText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  mathInput: { backgroundColor: "#F3F4F6", borderRadius: 14, borderWidth: 2, borderColor: "#E5E7EB", paddingHorizontal: 30, paddingVertical: 14, minWidth: 120, alignItems: "center", marginBottom: 16 },
  mathInputText: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center" },
  numPad: { flexDirection: "row", flexWrap: "wrap", width: 240, gap: 8 },
  numKey: { width: 68, height: 54, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  numKeyEnter: { backgroundColor: "#10B981" },
  numKeyBack: { backgroundColor: "#FEF2F2" },
  numKeyText: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
});
