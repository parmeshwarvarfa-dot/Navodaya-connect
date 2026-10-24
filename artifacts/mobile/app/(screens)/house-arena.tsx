import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
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
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

const HOUSE_META: Record<string, { color: string; emoji: string }> = {
  Aravali: { color: "#1D6ADE", emoji: "💙" },
  Nilgiri: { color: "#16A34A", emoji: "💚" },
  Shivalik: { color: "#DC2626", emoji: "❤️" },
  Udaygiri: { color: "#D97706", emoji: "💛" },
};
const RANK_MEDALS = ["🥇", "🥈", "🥉", "4️⃣"];
type HouseScore = { name: string; points: number; delta: number };
const INITIAL_SCORES: HouseScore[] = [
  { name: "Shivalik", points: 2840, delta: 0 },
  { name: "Aravali", points: 2710, delta: 0 },
  { name: "Nilgiri", points: 2590, delta: 0 },
  { name: "Udaygiri", points: 2420, delta: 0 },
];
type Challenge = {
  id: string;
  title: string;
  desc: string;
  icon: string;
  color: string;
  bg: string;
  status: "live" | "upcoming" | "qualifying";
  players: number;
  points: number;
};
const CHALLENGES: Challenge[] = [
  { id: "gk-blitz", title: "GK Blitz Quiz", desc: "2-min rapid-fire general knowledge", icon: "🧠", color: "#3D5AF1", bg: "#EEF2FF", status: "live", players: 63, points: 50 },
  { id: "chess-cup", title: "House Chess Cup", desc: "Round-robin chess tournament", icon: "♟️", color: "#374151", bg: "#F3F4F6", status: "qualifying", players: 24, points: 120 },
  { id: "word-master", title: "Word Master", desc: "Speed spelling showdown", icon: "🔤", color: "#8B5CF6", bg: "#F5F3FF", status: "upcoming", players: 0, points: 60 },
  { id: "math-ninja", title: "Number Ninja", desc: "Mental maths speed round", icon: "🔢", color: "#10B981", bg: "#ECFDF5", status: "live", players: 41, points: 70 },
  { id: "art-battle", title: "Art Battle", desc: "Draw your JNV memory in 60 sec", icon: "🎨", color: "#EF4444", bg: "#FEF2F2", status: "upcoming", players: 0, points: 80 },
];
type QuizQuestion = { q: string; options: string[]; answer: number };
const QUIZ_QUESTIONS: QuizQuestion[] = [
  { q: "In which year were Jawahar Navodaya Vidyalayas established?", options: ["1977", "1986", "1992", "2000"], answer: 1 },
  { q: "Which is the largest JNV state by number of schools?", options: ["UP", "Rajasthan", "MP", "Bihar"], answer: 0 },
  { q: "What is the full form of JNV?", options: ["Junior Navodaya Vidyalaya", "Jawahar Navodaya Vidyalaya", "Jan Navodaya Vidyalaya", "Jeevan Navodaya Vidyalaya"], answer: 1 },
  { q: "Who is known as the father of the Navodaya concept?", options: ["Dr. APJ Kalam", "Rajiv Gandhi", "Dr. Ambedkar", "Mahatma Gandhi"], answer: 1 },
  { q: "JNV schools are residential from which class?", options: ["Class 1", "Class 5", "Class 6", "Class 8"], answer: 2 },
];

export default function HouseArenaScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const house = profile?.house ?? "";
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const [scores, setScores] = useState<HouseScore[]>(INITIAL_SCORES);
  const [livePlayers, setLivePlayers] = useState({ "gk-blitz": 63, "math-ninja": 41 });
  const pulse = useRef(new Animated.Value(1)).current;
  const [activeChallenge, setActiveChallenge] = useState<Challenge | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizDone, setQuizDone] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const advanceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1.4, duration: 700, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse]);

  useEffect(() => {
    const interval = setInterval(() => {
      setScores((previous) => previous
        .map((item) => {
          const delta = Math.random() < 0.6 ? Math.floor(Math.random() * 18) + 3 : 0;
          return { ...item, points: item.points + delta, delta };
        })
        .sort((a, b) => b.points - a.points));
      setLivePlayers((previous) => ({
        "gk-blitz": Math.max(0, previous["gk-blitz"] + (Math.random() < 0.5 ? 1 : -1)),
        "math-ninja": Math.max(0, previous["math-ninja"] + (Math.random() < 0.5 ? 1 : -1)),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const finishQuestion = (picked: number | null) => {
    if (timer.current) clearInterval(timer.current);
    if (picked !== null && picked === QUIZ_QUESTIONS[questionIndex].answer) setScore((value) => value + 10);
    setSelectedOption(picked);
    advanceTimer.current = setTimeout(() => {
      if (questionIndex + 1 >= QUIZ_QUESTIONS.length) setQuizDone(true);
      else {
        setQuestionIndex((value) => value + 1);
        setSelectedOption(null);
      }
    }, 900);
  };

  useEffect(() => {
    if (!activeChallenge || quizDone) return;
    setTimeLeft(15);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setTimeLeft((value) => {
        if (value <= 1) {
          if (timer.current) clearInterval(timer.current);
          finishQuestion(null);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [questionIndex, activeChallenge, quizDone]);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
  }, []);

  const openChallenge = (challenge: Challenge) => {
    setActiveChallenge(challenge);
    setQuestionIndex(0);
    setSelectedOption(null);
    setScore(0);
    setQuizDone(false);
  };
  const closeChallenge = () => {
    if (timer.current) clearInterval(timer.current);
    if (advanceTimer.current) clearTimeout(advanceTimer.current);
    setActiveChallenge(null);
  };
  const maxPoints = scores[0]?.points ?? 1;

  return (
    <View style={styles.container}>
      <View style={[styles.pageHeader, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={22} color="#26334D" />
        </TouchableOpacity>
        <Text style={styles.pageTitle}>House Arena</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 24 }} showsVerticalScrollIndicator={false}>
        <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.arenaHeader}>
          <View style={styles.arenaTopRow}>
            <View>
              <Text style={styles.arenaTitle}>🏆 House Arena</Text>
              <Text style={styles.arenaSub}>Compete. Earn points. Rule the board.</Text>
            </View>
            <View style={styles.liveChip}><Animated.View style={[styles.liveDot, { transform: [{ scale: pulse }] }]} /><Text style={styles.liveText}>LIVE</Text></View>
          </View>
          <View style={styles.leaderboard}>
            {scores.map((item, index) => {
              const meta = HOUSE_META[item.name];
              const barWidth = Math.min(100, (item.points / maxPoints) * 100);
              const isUserHouse = item.name === house;
              return (
                <View key={item.name} style={[styles.lbRow, isUserHouse && styles.lbRowHighlight]}>
                  <Text style={styles.lbMedal}>{RANK_MEDALS[index]}</Text>
                  <View style={[styles.lbDot, { backgroundColor: meta.color }]} />
                  <View style={styles.lbInfo}>
                    <View style={styles.lbNameRow}>
                      <Text style={styles.lbName}>{item.name} {meta.emoji}{isUserHouse ? " (You)" : ""}</Text>
                      <View style={styles.lbRight}>
                        {item.delta > 0 && <Text style={styles.lbDelta}>+{item.delta}</Text>}
                        <Text style={styles.lbPoints}>{item.points.toLocaleString()} pts</Text>
                      </View>
                    </View>
                    <View style={styles.barBg}><View style={[styles.barFill, { width: `${barWidth}%`, backgroundColor: meta.color }]} /></View>
                  </View>
                </View>
              );
            })}
          </View>
        </LinearGradient>

        <View style={styles.challengesSection}>
          <View style={styles.challengeHeaderRow}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            <View style={styles.liveChipSmall}><Animated.View style={[styles.liveDotSmall, { transform: [{ scale: pulse }] }]} /><Text style={styles.liveTextSmall}>LIVE</Text></View>
          </View>
          <Text style={styles.sectionSub}>Play to earn points for your house</Text>
          {CHALLENGES.map((challenge) => {
            const players = challenge.id === "gk-blitz" ? livePlayers["gk-blitz"] : challenge.id === "math-ninja" ? livePlayers["math-ninja"] : challenge.players;
            const status = challenge.status === "live" ? `🔴 LIVE · ${players} playing` : challenge.status === "upcoming" ? "⏳ Upcoming" : "🏁 Qualifying";
            return (
              <View key={challenge.id} style={[styles.challengeCard, { borderLeftColor: challenge.color }]}>
                <View style={[styles.challengeIconWrap, { backgroundColor: challenge.bg }]}><Text style={styles.challengeEmoji}>{challenge.icon}</Text></View>
                <View style={styles.challengeInfo}>
                  <Text style={styles.challengeTitle}>{challenge.title}</Text>
                  <Text style={styles.challengeDesc}>{challenge.desc}</Text>
                  <View style={styles.challengeMeta}><Text style={[styles.challengeStatus, { color: challenge.status === "live" ? "#10B981" : challenge.status === "upcoming" ? "#F59E0B" : "#8B5CF6" }]}>{status}</Text><Text style={styles.challengePts}>+{challenge.points} pts</Text></View>
                </View>
                <TouchableOpacity style={[styles.playBtn, { backgroundColor: challenge.status === "upcoming" ? "#E5E7EB" : challenge.color }]} onPress={() => challenge.status !== "upcoming" && openChallenge(challenge)} disabled={challenge.status === "upcoming"}>
                  <Text style={[styles.playBtnText, { color: challenge.status === "upcoming" ? "#9CA3AF" : "#fff" }]}>{challenge.status === "upcoming" ? "Soon" : "Play"}</Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={!!activeChallenge} animationType="slide" onRequestClose={closeChallenge}>
        <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.quizModal}>
          <View style={[styles.quizHeader, { paddingTop: topPad + 8 }]}>
            <TouchableOpacity onPress={closeChallenge} accessibilityLabel="Close challenge"><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
            <Text style={styles.quizHeaderTitle}>{activeChallenge?.title}</Text>
            <View style={styles.quizScoreBadge}><Text style={styles.quizScoreText}>{score} pts</Text></View>
          </View>
          {!quizDone ? (
            <ScrollView contentContainerStyle={styles.quizBody}>
              <View style={styles.quizProgressRow}>{QUIZ_QUESTIONS.map((_, index) => <View key={index} style={[styles.quizProgressDot, { backgroundColor: index < questionIndex ? "#6EE7B7" : index === questionIndex ? "#fff" : "rgba(255,255,255,0.25)" }]} />)}</View>
              <View style={styles.timerRow}><View style={[styles.timerCircle, { borderColor: timeLeft <= 5 ? "#EF4444" : "#6EE7B7" }]}><Text style={[styles.timerText, { color: timeLeft <= 5 ? "#EF4444" : "#6EE7B7" }]}>{timeLeft}</Text></View></View>
              <Text style={styles.quizQ}>{QUIZ_QUESTIONS[questionIndex].q}</Text>
              <View style={styles.optList}>{QUIZ_QUESTIONS[questionIndex].options.map((option, index) => {
                const correct = index === QUIZ_QUESTIONS[questionIndex].answer;
                const selected = selectedOption === index;
                let backgroundColor = "rgba(255,255,255,0.1)";
                let borderColor = "rgba(255,255,255,0.2)";
                if (selectedOption !== null) {
                  if (correct) { backgroundColor = "rgba(110,231,183,0.25)"; borderColor = "#6EE7B7"; }
                  else if (selected) { backgroundColor = "rgba(239,68,68,0.25)"; borderColor = "#EF4444"; }
                }
                return <TouchableOpacity key={index} style={[styles.optBtn, { backgroundColor, borderColor }]} onPress={() => selectedOption === null && finishQuestion(index)} disabled={selectedOption !== null}>
                  <View style={styles.optLabel}><Text style={styles.optLetter}>{["A", "B", "C", "D"][index]}</Text></View>
                  <Text style={styles.optText}>{option}</Text>
                  {selectedOption !== null && correct && <Ionicons name="checkmark-circle" size={18} color="#6EE7B7" />}
                  {selected && !correct && <Ionicons name="close-circle" size={18} color="#EF4444" />}
                </TouchableOpacity>;
              })}</View>
              <Text style={styles.quizCounter}>Question {questionIndex + 1} of {QUIZ_QUESTIONS.length}</Text>
            </ScrollView>
          ) : (
            <View style={styles.quizDoneWrap}>
              <Text style={styles.quizDoneEmoji}>{score >= 40 ? "🏆" : score >= 20 ? "🎉" : "💪"}</Text>
              <Text style={styles.quizDoneTitle}>{score >= 40 ? "Outstanding!" : score >= 20 ? "Well done!" : "Keep practising!"}</Text>
              <Text style={styles.quizDoneSub}>You scored</Text>
              <Text style={styles.quizDoneScore}>{score} / 50 pts</Text>
              {house ? <Text style={styles.quizDoneHouse}>+{score} points added to {house} House {HOUSE_META[house]?.emoji}</Text> : null}
              <TouchableOpacity style={styles.quizDoneBtn} onPress={closeChallenge}><Text style={styles.quizDoneBtnText}>Back to Arena</Text></TouchableOpacity>
            </View>
          )}
        </LinearGradient>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  pageHeader: { minHeight: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF3" },
  backButton: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F2F4F8" },
  pageTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#18243B" },
  headerSpacer: { width: 38 },
  arenaHeader: { marginHorizontal: 14, borderRadius: 22, padding: 18, marginTop: 14 },
  arenaTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  arenaTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  arenaSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginTop: 2 },
  liveChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444" },
  liveText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  leaderboard: { gap: 12 },
  lbRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 12, padding: 10 },
  lbRowHighlight: { backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  lbMedal: { fontSize: 20, width: 28, textAlign: "center" },
  lbDot: { width: 10, height: 10, borderRadius: 5 },
  lbInfo: { flex: 1, minWidth: 0 },
  lbNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 5, gap: 6 },
  lbName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff", flexShrink: 1 },
  lbRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  lbDelta: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6EE7B7", backgroundColor: "rgba(110,231,183,0.15)", paddingHorizontal: 6, paddingVertical: 1, borderRadius: 8 },
  lbPoints: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  barBg: { height: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 3, overflow: "hidden" },
  barFill: { height: 5, borderRadius: 3 },
  challengesSection: { paddingHorizontal: 16, paddingTop: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 5, marginBottom: 14 },
  challengeHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveChipSmall: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF2F2", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  liveDotSmall: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" },
  liveTextSmall: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#EF4444", letterSpacing: 0.5 },
  challengeCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 14, backgroundColor: "#fff", padding: 14, marginBottom: 10, borderLeftWidth: 4 },
  challengeIconWrap: { width: 46, height: 46, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  challengeEmoji: { fontSize: 22 },
  challengeInfo: { flex: 1, minWidth: 0 },
  challengeTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 2 },
  challengeDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 4 },
  challengeMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  challengeStatus: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  challengePts: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1", backgroundColor: "#EEF2FF", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  playBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  playBtnText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  quizModal: { flex: 1 },
  quizHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingBottom: 16 },
  quizHeaderTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff", flex: 1, textAlign: "center" },
  quizScoreBadge: { backgroundColor: "rgba(110,231,183,0.2)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4 },
  quizScoreText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#6EE7B7" },
  quizBody: { paddingHorizontal: 20, paddingBottom: 40 },
  quizProgressRow: { flexDirection: "row", gap: 6, justifyContent: "center", marginBottom: 20 },
  quizProgressDot: { width: 8, height: 8, borderRadius: 4 },
  timerRow: { alignItems: "center", marginBottom: 20 },
  timerCircle: { width: 56, height: 56, borderRadius: 28, borderWidth: 2.5, alignItems: "center", justifyContent: "center" },
  timerText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  quizQ: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center", lineHeight: 26, marginBottom: 24 },
  optList: { gap: 12 },
  optBtn: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1.5, borderRadius: 14, padding: 14 },
  optLabel: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  optLetter: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#fff" },
  optText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#fff" },
  quizCounter: { textAlign: "center", marginTop: 24, fontSize: 13, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.5)" },
  quizDoneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  quizDoneEmoji: { fontSize: 72, marginBottom: 16 },
  quizDoneTitle: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 8, textAlign: "center" },
  quizDoneSub: { fontSize: 16, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.65)", marginBottom: 4 },
  quizDoneScore: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#6EE7B7", marginBottom: 8 },
  quizDoneHouse: { fontSize: 14, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.7)", marginBottom: 32, textAlign: "center" },
  quizDoneBtn: { backgroundColor: "#fff", borderRadius: 28, paddingHorizontal: 40, paddingVertical: 15 },
  quizDoneBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#312E81" },
});
