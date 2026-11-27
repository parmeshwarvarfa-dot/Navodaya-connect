import React, { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, PanResponder, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, type DrawingStroke, type GameResult } from "@/lib/api";
import { ThemedText as Text } from "@/components/ThemedNative";

const COLORS = ["#1F2937", "#EF4444", "#F59E0B", "#10B981", "#3B82F6", "#8B5CF6", "#EC4899", "#FFFFFF"];
type Phase = "intro" | "drawing" | "preview" | "complete";
type Point = { x: number; y: number };

export default function ArtBattle({ onComplete }: { onComplete: (result: GameResult) => void }) {
  const [phase, setPhase] = useState<Phase>("intro");
  const [prompt, setPrompt] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [timeLeft, setTimeLeft] = useState(60);
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(5);
  const [eraser, setEraser] = useState(false);
  const [strokes, setStrokes] = useState<DrawingStroke[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<GameResult | null>(null);
  const strokesRef = useRef<DrawingStroke[]>([]);
  const currentRef = useRef<Point[]>([]);
  const sizeRef = useRef(canvasSize);
  const toolRef = useRef({ color, size, eraser, phase });
  sizeRef.current = canvasSize;
  toolRef.current = { color, size, eraser, phase };

  useEffect(() => {
    if (phase !== "drawing") return;
    const timer = setInterval(() => setTimeLeft((time) => Math.max(0, time - 1)), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => { if (phase === "drawing" && timeLeft === 0) setPhase("preview"); }, [phase, timeLeft]);

  const addPoint = (locationX: number, locationY: number) => {
    const { width, height } = sizeRef.current;
    if (!width || !height) return;
    const point = { x: Math.max(0, Math.min(1, locationX / width)), y: Math.max(0, Math.min(1, locationY / height)) };
    const points = [...currentRef.current, point];
    currentRef.current = points;
    setCurrentPoints(points);
  };

  const finishStroke = () => {
    const points = currentRef.current;
    if (points.length) {
      const tool = toolRef.current;
      const stroke: DrawingStroke = { color: tool.eraser ? "#FFFFFF" : tool.color, size: tool.eraser ? Math.max(tool.size * 3, 16) : tool.size, points };
      const next = [...strokesRef.current, stroke].slice(-160);
      strokesRef.current = next;
      setStrokes(next);
    }
    currentRef.current = [];
    setCurrentPoints([]);
  };

  const panHandlers = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => toolRef.current.phase === "drawing",
    onMoveShouldSetPanResponder: () => toolRef.current.phase === "drawing",
    onPanResponderGrant: (event) => { currentRef.current = []; addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY); },
    onPanResponderMove: (event) => addPoint(event.nativeEvent.locationX, event.nativeEvent.locationY),
    onPanResponderRelease: finishStroke,
    onPanResponderTerminate: finishStroke,
  }), []);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError("");
    try {
      const session = await api.games.start("art-battle");
      setSessionId(session.sessionId);
      setPrompt(session.prompt ?? "A favourite JNV memory");
      setTimeLeft(60);
      setPhase("drawing");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in to save an Art Battle submission.");
    } finally { setStarting(false); }
  };

  const undo = () => {
    const next = strokesRef.current.slice(0, -1);
    strokesRef.current = next;
    setStrokes(next);
  };

  const clear = () => {
    strokesRef.current = [];
    currentRef.current = [];
    setStrokes([]);
    setCurrentPoints([]);
  };

  const submit = async () => {
    if (!sessionId || submitting) {
      setError("Sign in and start a saved game session before submitting this drawing.");
      return;
    }
    if (strokesRef.current.length === 0) {
      setError("Add a few strokes to your drawing before submitting.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const response = await api.games.submitArtwork(sessionId, strokesRef.current);
      setResult(response.result);
      setPhase("complete");
      onComplete(response.result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the drawing. Please retry.");
    } finally { setSubmitting(false); }
  };

  const restart = () => {
    setStrokes([]);
    strokesRef.current = [];
    setCurrentPoints([]);
    currentRef.current = [];
    setResult(null);
    setSessionId("");
    setPrompt("");
    setTimeLeft(60);
    setError("");
    setPhase("intro");
  };

  const svgPaths = [...strokes, ...(currentPoints.length ? [{ color: eraser ? "#FFFFFF" : color, size: eraser ? Math.max(size * 3, 16) : size, points: currentPoints }] : [])];
  const pathFor = (stroke: DrawingStroke) => stroke.points.map((point, index) => `${index ? "L" : "M"} ${point.x * canvasSize.width} ${point.y * canvasSize.height}`).join(" ");

  if (phase === "intro") return (
    <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.root}>
      <View style={styles.intro}>
        <Text style={styles.emoji}>🎨</Text>
        <Text style={styles.title}>Art Battle</Text>
        <Text style={styles.copy}>Draw a JNV memory in 60 seconds. Choose a prompt, use the color palette, and preview before submitting. This is solo drawing practice; there are no live opponents or votes.</Text>
        <Text style={styles.reward}>Submit a non-empty drawing after the 60-second round to earn one verified +80 point participation reward for this session.</Text>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <TouchableOpacity style={styles.primaryButton} onPress={start} disabled={starting} accessibilityRole="button" accessibilityLabel="Start Art Battle drawing">
          {starting ? <ActivityIndicator color="#312E81" /> : <Text style={styles.primaryText}>Start 60-second drawing</Text>}
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );

  return (
    <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.root}>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <View style={styles.headingRow}><Text style={styles.titleSmall}>{phase === "complete" ? "Drawing submitted" : phase === "preview" ? "Preview your drawing" : "Draw your memory"}</Text>{phase === "drawing" ? <Text style={[styles.clock, timeLeft <= 10 && styles.clockUrgent]}>⏱ {timeLeft}s</Text> : null}</View>
        <Text style={styles.prompt}>{prompt}</Text>
        <View style={styles.canvasFrame} onLayout={(event) => setCanvasSize({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} {...(phase === "drawing" ? panHandlers.panHandlers : {})}>
          <Svg width={canvasSize.width} height={canvasSize.height}>
            {svgPaths.map((stroke, index) => <Path key={index} d={pathFor(stroke)} fill="none" stroke={stroke.color} strokeWidth={stroke.size} strokeLinecap="round" strokeLinejoin="round" />)}
          </Svg>
          {!strokes.length && !currentPoints.length && phase !== "complete" ? <Text pointerEvents="none" style={styles.canvasHint}>{phase === "drawing" ? "Draw here with your finger or mouse" : "No strokes to preview"}</Text> : null}
        </View>
        {phase === "drawing" ? <>
          <View style={styles.toolbar}>
            {COLORS.map((choice) => <TouchableOpacity key={choice} accessibilityRole="button" accessibilityLabel={`Choose ${choice} brush color`} accessibilityState={{ selected: color === choice && !eraser }} onPress={() => { setColor(choice); setEraser(false); }} style={[styles.swatch, { backgroundColor: choice, borderColor: choice === "#FFFFFF" ? "#CBD5E1" : choice, borderWidth: color === choice && !eraser ? 3 : 1 }]} />)}
            <TouchableOpacity style={[styles.toolButton, eraser && styles.toolSelected]} onPress={() => setEraser((value) => !value)} accessibilityRole="button" accessibilityLabel="Toggle eraser"><Ionicons name="bandage-outline" size={18} color={eraser ? "#312E81" : "#fff"} /></TouchableOpacity>
          </View>
          <View style={styles.controlsRow}><Text style={styles.controlLabel}>Brush</Text>{[3, 6, 10].map((choice) => <TouchableOpacity key={choice} onPress={() => setSize(choice)} style={[styles.sizeButton, size === choice && styles.sizeSelected]} accessibilityRole="button" accessibilityState={{ selected: size === choice }}><Text style={[styles.sizeText, size === choice && styles.sizeTextSelected]}>{choice}px</Text></TouchableOpacity>)}<View style={{ flex: 1 }} /><TouchableOpacity onPress={undo} disabled={!strokes.length} style={styles.textButton}><Text style={[styles.textButtonLabel, !strokes.length && styles.disabledText]}>Undo</Text></TouchableOpacity><TouchableOpacity onPress={clear} disabled={!strokes.length} style={styles.textButton}><Text style={[styles.textButtonLabel, !strokes.length && styles.disabledText]}>Clear</Text></TouchableOpacity></View>
        </> : null}
        {phase === "preview" ? <View style={styles.actionRow}><TouchableOpacity style={styles.secondaryButton} onPress={() => { setTimeLeft(60); setPhase("drawing"); }}><Text style={styles.secondaryText}>Keep drawing</Text></TouchableOpacity><TouchableOpacity style={styles.primaryButton} onPress={submit} disabled={submitting}>{submitting ? <ActivityIndicator color="#312E81" /> : <Text style={styles.primaryText}>Submit drawing</Text>}</TouchableOpacity></View> : null}
        {phase === "complete" && result ? <View style={styles.completed}><Text style={styles.success}>Drawing saved to your game history.</Text><Text style={styles.rewardValue}>+{result.rewardPoints} points</Text><Text style={styles.reward}>Participation reward · one claim for this session</Text><TouchableOpacity style={styles.primaryButton} onPress={restart}><Text style={styles.primaryText}>Play Again</Text></TouchableOpacity></View> : null}
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  intro: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  body: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 28 },
  emoji: { fontSize: 56, marginBottom: 12 },
  title: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 10 },
  titleSmall: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", flex: 1 },
  copy: { color: "rgba(255,255,255,0.76)", fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular", textAlign: "center", marginBottom: 14 },
  reward: { color: "rgba(255,255,255,0.64)", fontFamily: "Inter_400Regular", fontSize: 12, textAlign: "center", lineHeight: 18, marginVertical: 10 },
  primaryButton: { minHeight: 46, minWidth: 145, paddingHorizontal: 18, paddingVertical: 12, alignItems: "center", justifyContent: "center", borderRadius: 24, backgroundColor: "#fff" },
  primaryText: { color: "#312E81", fontFamily: "Inter_700Bold", fontSize: 14, textAlign: "center" },
  headingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  clock: { color: "#6EE7B7", fontFamily: "Inter_700Bold", fontSize: 18 },
  clockUrgent: { color: "#FCA5A5" },
  prompt: { color: "#DDD6FE", fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 18, marginTop: 7, marginBottom: 12 },
  canvasFrame: { width: "100%", height: 300, borderRadius: 14, overflow: "hidden", backgroundColor: "#fff", position: "relative", alignItems: "center", justifyContent: "center", touchAction: "none" as any },
  canvasHint: { position: "absolute", color: "#9CA3AF", fontFamily: "Inter_400Regular", fontSize: 13, textAlign: "center", top: "48%", left: 0, right: 0 },
  toolbar: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, flexWrap: "wrap" },
  swatch: { width: 26, height: 26, borderRadius: 13 },
  toolButton: { width: 32, height: 30, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)", marginLeft: 2 },
  toolSelected: { backgroundColor: "#fff" },
  controlsRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 9, flexWrap: "wrap" },
  controlLabel: { color: "rgba(255,255,255,0.7)", fontFamily: "Inter_500Medium", fontSize: 11 },
  sizeButton: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: "rgba(255,255,255,0.25)" },
  sizeSelected: { backgroundColor: "#fff", borderColor: "#fff" },
  sizeText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium" },
  sizeTextSelected: { color: "#312E81" },
  textButton: { paddingHorizontal: 5, paddingVertical: 5 },
  textButtonLabel: { color: "#DDD6FE", fontFamily: "Inter_600SemiBold", fontSize: 12 },
  disabledText: { color: "rgba(255,255,255,0.35)" },
  actionRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 16, flexWrap: "wrap" },
  secondaryButton: { minHeight: 46, paddingHorizontal: 17, justifyContent: "center", borderRadius: 24, borderWidth: 1, borderColor: "rgba(255,255,255,0.45)" },
  secondaryText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  completed: { alignItems: "center", paddingTop: 18 },
  success: { color: "#6EE7B7", fontFamily: "Inter_600SemiBold", textAlign: "center" },
  rewardValue: { color: "#6EE7B7", fontSize: 30, fontFamily: "Inter_700Bold", marginTop: 7 },
  error: { color: "#FCA5A5", fontFamily: "Inter_500Medium", fontSize: 12, textAlign: "center", marginTop: 12 },
});
