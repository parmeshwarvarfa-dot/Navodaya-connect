import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, type GameDifficulty, type GameId, type GameQuestion, type GameResult, type StartedGame } from "@/lib/api";
import FadeIn from "@/components/motion/FadeIn";
import MotionPressable from "@/components/motion/MotionPressable";
import { useReducedMotion } from "@/components/motion/MotionProvider";

type Props = { gameId: Exclude<GameId, "chess-cup" | "art-battle">; onComplete: (result: GameResult) => void };

const CONFIG: Record<Props["gameId"], { title: string; intro: string; seconds: number }> = {
  "gk-blitz": { title: "GK Blitz Quiz", intro: "Answer as many different general knowledge questions as you can in two minutes. The server checks each answer. Points = floor(50 × correct answers ÷ 20 questions), awarded once for this session.", seconds: 120 },
  "word-master": { title: "Word Master", intro: "Use each definition to spell the word. Complete 10 rounds before the 90-second timer ends. Points = floor(60 × correct answers ÷ 10 questions), awarded once for this session.", seconds: 90 },
  "math-ninja": { title: "Number Ninja", intro: "Solve 12 mental maths questions before the 90-second timer ends. Division answers are whole numbers. Points = floor(70 × correct answers ÷ 12 questions), awarded once for this session.", seconds: 90 },
};

export default function TimedChallenge({ gameId, onComplete }: Props) {
  const config = CONFIG[gameId];
  const [difficulty, setDifficulty] = useState<GameDifficulty>("medium");
  const [session, setSession] = useState<StartedGame | null>(null);
  const [question, setQuestion] = useState<GameQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [timeLeft, setTimeLeft] = useState(config.seconds);
  const [feedback, setFeedback] = useState<{ correct: boolean; answer: string } | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const requestLock = useRef(false);
  const nextTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (!session || result) return;
    const interval = setInterval(() => setTimeLeft((time) => Math.max(0, time - 1)), 1000);
    return () => clearInterval(interval);
  }, [session, result]);

  useEffect(() => {
    if (!session || !question || result || timeLeft > 0 || requestLock.current) return;
    requestLock.current = true;
    api.games.finish(session.sessionId)
      .then(({ result: finalResult }) => {
        setResult(finalResult);
        onComplete(finalResult);
      })
      .catch((e: Error) => setError(e.message || "Could not save this result. Please retry."))
      .finally(() => { requestLock.current = false; });
  }, [session, question, result, timeLeft, onComplete]);

  useEffect(() => () => { if (nextTimer.current) clearTimeout(nextTimer.current); }, []);

  useEffect(() => {
    if (!question) return;
    const animation = Animated.timing(progress, {
      toValue: Math.min(1, question.round / question.total),
      duration: reducedMotion === false ? 180 : 0,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, question?.round, question?.total, reducedMotion]);

  const progressWidth = progress.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const started = await api.games.start(gameId, difficulty);
      setSession(started);
      setQuestion(started.question);
      setTimeLeft(started.seconds);
      setScore(0);
      setAnswered(0);
      setAnswer("");
      setFeedback(null);
      setResult(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in to start a scored game.");
    } finally {
      setStarting(false);
    }
  };

  const submit = async (choice?: number) => {
    if (!session || !question || busy || feedback || result) return;
    if (question.type !== "choice" && !answer.trim()) return;
    setBusy(true);
    setError("");
    try {
      const response = await api.games.answer(session.sessionId, question.round, choice ?? answer);
      const currentFeedback = { correct: Boolean(response.correct), answer: String(response.correctAnswer ?? "") };
      setFeedback(currentFeedback);
      setAnswered(response.answered ?? (answered + 1));
      setScore(response.score ?? score + (currentFeedback.correct ? 1 : 0));
      setAnswer("");
      if (response.completed && response.result) {
        nextTimer.current = setTimeout(() => {
          setResult(response.result!);
          setQuestion(null);
          onComplete(response.result!);
        }, 600);
      } else if (response.question) {
        nextTimer.current = setTimeout(() => {
          setQuestion(response.question!);
          setFeedback(null);
        }, 650);
      }
      if (response.expired && response.result) {
        setResult(response.result);
        setQuestion(null);
        onComplete(response.result);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your answer.");
    } finally {
      setBusy(false);
    }
  };

  const restart = () => {
    setSession(null);
    setQuestion(null);
    setAnswer("");
    setScore(0);
    setAnswered(0);
    setTimeLeft(config.seconds);
    setFeedback(null);
    setResult(null);
    setError("");
  };

  return (
    <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.root}>
      {!session ? (
        <ScrollView contentContainerStyle={styles.intro} keyboardShouldPersistTaps="handled">
          <Text style={styles.emoji}>{gameId === "gk-blitz" ? "🧠" : gameId === "word-master" ? "🔤" : "🔢"}</Text>
          <Text style={styles.title}>{config.title}</Text>
          <Text style={styles.copy}>{config.intro}</Text>
          {gameId !== "gk-blitz" && <View style={styles.levels}>
            {(["easy", "medium", "hard"] as const).map((level) => <TouchableOpacity key={level} accessibilityRole="button" accessibilityState={{ selected: difficulty === level }} style={[styles.level, difficulty === level && styles.levelSelected]} onPress={() => setDifficulty(level)}><Text style={[styles.levelText, difficulty === level && styles.levelTextSelected]}>{level[0].toUpperCase() + level.slice(1)}</Text></TouchableOpacity>)}
          </View>}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={start} disabled={starting} accessibilityRole="button" accessibilityLabel={`Start ${config.title}`}>
            {starting ? <ActivityIndicator color="#312E81" /> : <Text style={styles.primaryText}>Start {config.seconds === 120 ? "2-minute" : "90-second"} round</Text>}
          </TouchableOpacity>
        </ScrollView>
      ) : result ? (
      <FadeIn style={styles.resultWrap}>
          <Text style={styles.emoji}>{result.accuracy >= 80 ? "🏆" : result.accuracy >= 40 ? "⭐" : "📘"}</Text>
          <Text style={styles.title}>Round complete</Text>
          <Text style={styles.score}>{result.correct}/{result.answered} correct</Text>
          <Text style={styles.copy}>Accuracy {result.accuracy}% · average response {((result.averageResponseMs ?? 0) / 1000).toFixed(1)}s</Text>
          <View style={styles.rewardBox}><Text style={styles.rewardValue}>+{result.rewardPoints} points</Text><Text style={styles.rewardCopy}>Verified · up to {result.maxRewardPoints} per round</Text></View>
          <TouchableOpacity style={styles.primaryButton} onPress={restart} accessibilityRole="button"><Text style={styles.primaryText}>Play Again</Text></TouchableOpacity>
      </FadeIn>
      ) : question ? (
        <KeyboardAvoidingView style={styles.playArea} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.topLine}>
            <View style={styles.progressPill}><Text style={styles.progressText}>{question.round}/{question.total}</Text></View>
            <Text style={[styles.clock, timeLeft <= 10 && styles.clockUrgent]}>⏱ {timeLeft}s</Text>
            <View style={styles.progressPill}><Text style={styles.progressText}>✓ {score}</Text></View>
          </View>
          <View style={styles.progressTrack}><Animated.View style={[styles.progressFill, { width: progressWidth }]} /></View>
          <FadeIn key={question.round}>
          {question.category ? <Text style={styles.category}>{question.category}</Text> : null}
          <Text style={styles.question}>{question.prompt}</Text>
          {question.type === "choice" ? (
            <View style={styles.options}>
              {(question.options ?? []).map((option, index) => {
                const chosen = feedback?.answer === option;
                return <MotionPressable key={index} disabled={busy || !!feedback} onPress={() => submit(index)} accessibilityRole="button" accessibilityLabel={`Option ${index + 1}: ${option}`} style={[styles.option, chosen && (feedback?.correct ? styles.optionCorrect : styles.optionWrong)]}>
                  <Text style={styles.optionLetter}>{String.fromCharCode(65 + index)}</Text><Text style={styles.optionText}>{option}</Text>
                </MotionPressable>;
              })}
            </View>
          ) : (
            <View style={styles.answerArea}>
              {question.type === "spelling" && question.definition ? <Text style={styles.definition}>{question.definition}</Text> : null}
              <TextInput value={answer} onChangeText={setAnswer} onSubmitEditing={() => submit()} keyboardType={question.type === "number" ? "numeric" : "default"} returnKeyType="done" autoCapitalize="none" autoCorrect={false} editable={!busy && !feedback} placeholder={question.type === "number" ? "Type the answer" : "Spell the word"} placeholderTextColor="#A5A3B8" style={styles.input} accessibilityLabel={question.type === "number" ? "Math answer" : "Spelling answer"} />
              <TouchableOpacity style={[styles.primaryButton, styles.submitButton]} onPress={() => submit()} disabled={busy || !!feedback || !answer.trim()} accessibilityRole="button"><Text style={styles.primaryText}>{busy ? "Checking…" : "Submit answer"}</Text></TouchableOpacity>
            </View>
          )}
          </FadeIn>
          {feedback ? <Text style={[styles.feedback, feedback.correct ? styles.feedbackRight : styles.feedbackWrong]}>{feedback.correct ? "Correct!" : `Not quite. Answer: ${feedback.answer}`}</Text> : null}
          {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        </KeyboardAvoidingView>
      ) : (
        <View style={styles.resultWrap}><ActivityIndicator color="#fff" /><Text style={styles.copy}>Preparing your round…</Text>{error ? <Text style={styles.error}>{error}</Text> : null}</View>
      )}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: { flexGrow: 1, padding: 24, justifyContent: "center", alignItems: "center" },
  resultWrap: { flex: 1, padding: 24, justifyContent: "center", alignItems: "center" },
  playArea: { flex: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  emoji: { fontSize: 54, marginBottom: 12 },
  title: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 10 },
  copy: { color: "rgba(255,255,255,0.76)", fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 20 },
  levels: { flexDirection: "row", gap: 8, marginBottom: 18, flexWrap: "wrap", justifyContent: "center" },
  level: { borderRadius: 20, borderColor: "rgba(255,255,255,0.35)", borderWidth: 1, paddingVertical: 8, paddingHorizontal: 14 },
  levelSelected: { backgroundColor: "#fff", borderColor: "#fff" },
  levelText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  levelTextSelected: { color: "#312E81" },
  primaryButton: { minHeight: 48, minWidth: 190, paddingHorizontal: 22, paddingVertical: 13, alignItems: "center", justifyContent: "center", borderRadius: 26, backgroundColor: "#fff", marginTop: 6 },
  primaryText: { color: "#312E81", fontFamily: "Inter_700Bold", fontSize: 15 },
  topLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 13 },
  progressPill: { minWidth: 52, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center" },
  progressText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 13 },
  clock: { color: "#6EE7B7", fontFamily: "Inter_700Bold", fontSize: 18 },
  clockUrgent: { color: "#FCA5A5" },
  progressTrack: { height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.16)", marginBottom: 24, overflow: "hidden" },
  progressFill: { height: 5, backgroundColor: "#6EE7B7" },
  category: { color: "#C4B5FD", fontFamily: "Inter_600SemiBold", textAlign: "center", marginBottom: 8 },
  question: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 20, lineHeight: 28, textAlign: "center", marginBottom: 20 },
  options: { gap: 10 },
  option: { minHeight: 54, flexDirection: "row", gap: 12, alignItems: "center", borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", backgroundColor: "rgba(255,255,255,0.09)", paddingHorizontal: 13, paddingVertical: 10 },
  optionCorrect: { backgroundColor: "rgba(16,185,129,0.28)", borderColor: "#6EE7B7" },
  optionWrong: { backgroundColor: "rgba(239,68,68,0.28)", borderColor: "#FCA5A5" },
  optionLetter: { width: 28, height: 28, borderRadius: 14, textAlign: "center", textAlignVertical: "center", backgroundColor: "rgba(255,255,255,0.14)", color: "#fff", fontFamily: "Inter_700Bold", overflow: "hidden", paddingTop: 5 },
  optionText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 15 },
  answerArea: { gap: 12, alignItems: "stretch" },
  definition: { color: "#DDD6FE", fontFamily: "Inter_400Regular", fontSize: 14, textAlign: "center", lineHeight: 21 },
  input: { minHeight: 54, borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 16, fontSize: 17, color: "#17152B", fontFamily: "Inter_500Medium" },
  submitButton: { alignSelf: "center", marginTop: 2 },
  feedback: { textAlign: "center", marginTop: 16, fontFamily: "Inter_700Bold", fontSize: 15 },
  feedbackRight: { color: "#6EE7B7" },
  feedbackWrong: { color: "#FCA5A5" },
  score: { color: "#6EE7B7", fontSize: 36, fontFamily: "Inter_700Bold", marginVertical: 6 },
  rewardBox: { alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 16, paddingHorizontal: 24, paddingVertical: 14, marginVertical: 10 },
  rewardValue: { color: "#6EE7B7", fontFamily: "Inter_700Bold", fontSize: 23 },
  rewardCopy: { color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 4 },
  error: { color: "#FCA5A5", fontFamily: "Inter_500Medium", textAlign: "center", marginVertical: 12 },
});
