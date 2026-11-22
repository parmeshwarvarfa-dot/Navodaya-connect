import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { voiceService, type AudioVisualizerLevels } from "@/lib/voiceService";
import { getApiOrigin, getToken } from "@/lib/api";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export type VoiceState = "idle" | "listening" | "processing" | "speaking" | "error";

interface ParamVoiceModalProps {
  visible: boolean;
  onClose: () => void;
  onSendMessageFromVoice: (userText: string, assistantReply: string) => void;
  conversationHistory: Array<{ role: "user" | "assistant"; text: string }>;
  initialLanguage?: "en" | "hi";
}

export default function ParamVoiceModal({
  visible,
  onClose,
  onSendMessageFromVoice,
  conversationHistory,
  initialLanguage = "en",
}: ParamVoiceModalProps) {
  const insets = useSafeAreaInsets();
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [lang, setLang] = useState<"en" | "hi">(initialLanguage);
  const [liveUserTranscript, setLiveUserTranscript] = useState<string>("");
  const [liveAssistantTranscript, setLiveAssistantTranscript] = useState<string>("");
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [speechSpeed, setSpeechSpeed] = useState<number>(1.0);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  // Animation values for the visualizer orb
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const waveAnim1 = useRef(new Animated.Value(1)).current;
  const waveAnim2 = useRef(new Animated.Value(1)).current;

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 16;

  // Visualizer pulsating loop
  useEffect(() => {
    let animLoop: Animated.CompositeAnimation | null = null;

    if (voiceState === "listening") {
      animLoop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.25,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0.95,
            duration: 900,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      animLoop.start();
    } else if (voiceState === "processing") {
      rotateAnim.setValue(0);
      animLoop = Animated.loop(
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animLoop.start();
    } else if (voiceState === "speaking") {
      animLoop = Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(waveAnim1, {
              toValue: 1.4,
              duration: 600,
              useNativeDriver: true,
            }),
            Animated.timing(waveAnim1, {
              toValue: 1.0,
              duration: 600,
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(waveAnim2, {
              toValue: 1.6,
              duration: 800,
              useNativeDriver: true,
            }),
            Animated.timing(waveAnim2, {
              toValue: 1.0,
              duration: 800,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
      animLoop.start();
    } else {
      pulseAnim.setValue(1);
      waveAnim1.setValue(1);
      waveAnim2.setValue(1);
      rotateAnim.setValue(0);
    }

    return () => {
      animLoop?.stop();
    };
  }, [voiceState, pulseAnim, rotateAnim, waveAnim1, waveAnim2]);

  // Request AI response
  const queryAI = useCallback(
    async (spokenQuestion: string) => {
      if (!spokenQuestion.trim()) return;

      setVoiceState("processing");
      setStatusMessage(lang === "hi" ? "परम एआई विचार कर रहा है..." : "PARAM AI is thinking...");

      try {
        const token = await getToken();
        const historyPayload = conversationHistory.slice(-8);

        const response = await fetch(`${getApiOrigin()}/api/param-ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            message: spokenQuestion,
            history: historyPayload,
            language: lang,
          }),
        });

        const data = await response.json();
        const replyText = data.reply || "";

        if (!replyText) {
          throw new Error("No response from AI");
        }

        setLiveAssistantTranscript(replyText);
        onSendMessageFromVoice(spokenQuestion, replyText);

        // Start speaking response
        setVoiceState("speaking");
        setStatusMessage(lang === "hi" ? "परम एआई बोल रहा है..." : "PARAM AI is speaking...");

        voiceService.speak(replyText, {
          lang: lang === "hi" ? "hi-IN" : "en-IN",
          rate: speechSpeed,
          onEnd: () => {
            // Once assistant finishes speaking, resume listening
            setStatusMessage(lang === "hi" ? "आपकी बात सुन रहे हैं..." : "Listening to you...");
            startListeningSession();
          },
          onError: () => {
            startListeningSession();
          },
        });
      } catch (err: any) {
        console.warn("[ParamVoiceModal] AI query error:", err);
        setVoiceState("error");
        setStatusMessage(
          lang === "hi"
            ? "कनेक्ट करने में असमर्थ। पुनः प्रयास करें।"
            : "Connection error. Please try speaking again."
        );
        setTimeout(() => startListeningSession(), 2500);
      }
    },
    [conversationHistory, lang, onSendMessageFromVoice, speechSpeed]
  );

  // Start speech recognition listening
  const startListeningSession = useCallback(() => {
    if (isMuted) return;

    setVoiceState("listening");
    setStatusMessage(lang === "hi" ? "बोलिए, मैं सुन रहा हूँ..." : "Listening... Speak naturally");
    setLiveUserTranscript("");

    const success = voiceService.startListening({
      lang: lang === "hi" ? "hi-IN" : "en-IN",
      continuous: false,
      interimResults: true,
      onResult: (transcript, isFinal) => {
        setLiveUserTranscript(transcript);
        if (isFinal && transcript.trim().length > 1) {
          voiceService.stopListening();
          void queryAI(transcript);
        }
      },
      onError: (err) => {
        if (err !== "no-speech") {
          setStatusMessage(lang === "hi" ? "माइक तक पहुँचने में समस्या" : "Microphone error");
        }
      },
      onEnd: () => {
        // If ended without final, gently restart listening if we're still in listening mode
        setVoiceState((currentState) => {
          if (currentState === "listening") {
            setTimeout(() => {
              startListeningSession();
            }, 600);
          }
          return currentState;
        });
      },
    });

    if (!success) {
      setVoiceState("error");
      setStatusMessage(
        lang === "hi"
          ? "माइक की अनुमति दें या ब्राउज़र में टेस्ट करें"
          : "Please allow microphone access to speak"
      );
    }
  }, [isMuted, lang, queryAI]);

  // Launch voice session when modal opens
  useEffect(() => {
    if (visible) {
      startListeningSession();
    } else {
      voiceService.stopListening();
      voiceService.cancelSpeech();
      setVoiceState("idle");
    }
    return () => {
      voiceService.stopListening();
      voiceService.cancelSpeech();
    };
  }, [visible, startListeningSession]);

  // Interrupt / Stop speaking (Barge-in)
  const handleInterrupt = () => {
    voiceService.cancelSpeech();
    voiceService.stopListening();
    setStatusMessage(lang === "hi" ? "रोका गया। आपकी बात सुन रहे हैं..." : "Interrupted. Listening...");
    startListeningSession();
  };

  // Toggle Mute
  const handleToggleMute = () => {
    if (isMuted) {
      setIsMuted(false);
      startListeningSession();
    } else {
      setIsMuted(true);
      voiceService.stopListening();
      setVoiceState("idle");
      setStatusMessage(lang === "hi" ? "माइक म्यूट है" : "Microphone is muted");
    }
  };

  // Switch Language
  const handleSwitchLanguage = (newLang: "en" | "hi") => {
    if (newLang === lang) return;
    voiceService.cancelSpeech();
    voiceService.stopListening();
    setLang(newLang);
    setStatusMessage(newLang === "hi" ? "हिंदी मोड सक्रिय" : "English mode active");
    setTimeout(() => {
      startListeningSession();
    }, 400);
  };

  // Close voice mode safely
  const handleClose = () => {
    voiceService.cancelSpeech();
    voiceService.stopListening();
    onClose();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <LinearGradient
        colors={["#2E1065", "#4C1D95", "#1E1B4B"]}
        style={styles.modalContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* ── Top Bar ── */}
        <View style={[styles.topBar, { paddingTop: topPad }]}>
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close voice mode"
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.topCenter}>
            <View style={styles.brandingRow}>
              <View style={styles.pulsingIndicator} />
              <Text style={styles.topTitle}>PA₹AM AI LIVE</Text>
            </View>
            <Text style={styles.topSubtitle}>
              {lang === "hi" ? "नवोदय वॉइस असिस्टेंट" : "Navodaya Voice Companion"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => setShowSettings(!showSettings)}
            accessibilityRole="button"
            accessibilityLabel="Voice settings"
          >
            <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── Language Switcher Bar ── */}
        <View style={styles.langBar}>
          <TouchableOpacity
            style={[styles.langChoice, lang === "en" && styles.langChoiceActive]}
            onPress={() => handleSwitchLanguage("en")}
          >
            <Text style={[styles.langChoiceText, lang === "en" && styles.langChoiceTextActive]}>
              English
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.langChoice, lang === "hi" && styles.langChoiceActive]}
            onPress={() => handleSwitchLanguage("hi")}
          >
            <Text style={[styles.langChoiceText, lang === "hi" && styles.langChoiceTextActive]}>
              हिंदी
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Settings Dropdown Drawer ── */}
        {showSettings && (
          <View style={styles.settingsDrawer}>
            <Text style={styles.settingsLabel}>Speech Speed</Text>
            <View style={styles.speedRow}>
              {[0.85, 1.0, 1.2].map((spd) => (
                <TouchableOpacity
                  key={`spd-${spd}`}
                  onPress={() => setSpeechSpeed(spd)}
                  style={[styles.speedBtn, speechSpeed === spd && styles.speedBtnActive]}
                >
                  <Text style={[styles.speedBtnText, speechSpeed === spd && styles.speedBtnTextActive]}>
                    {spd}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* ── Center: Animated Orb Visualizer ── */}
        <View style={styles.visualizerContainer}>
          {/* Radiating wave 2 (speaking) */}
          <Animated.View
            style={[
              styles.waveRing,
              styles.waveRing2,
              { transform: [{ scale: waveAnim2 }] },
              voiceState !== "speaking" && { opacity: 0 },
            ]}
          />

          {/* Radiating wave 1 (speaking) */}
          <Animated.View
            style={[
              styles.waveRing,
              styles.waveRing1,
              { transform: [{ scale: waveAnim1 }] },
              voiceState !== "speaking" && { opacity: 0 },
            ]}
          />

          {/* Core Pulsing Orb */}
          <Animated.View
            style={[
              styles.coreOrb,
              voiceState === "listening" && { transform: [{ scale: pulseAnim }] },
              voiceState === "processing" && { transform: [{ rotate: spin }] },
            ]}
          >
            <LinearGradient
              colors={
                voiceState === "speaking"
                  ? ["#EC4899", "#8B5CF6", "#6366F1"]
                  : voiceState === "processing"
                  ? ["#F59E0B", "#7C3AED", "#10B981"]
                  : isMuted
                  ? ["#64748B", "#475569"]
                  : ["#7C3AED", "#6366F1", "#3B82F6"]
              }
              style={styles.orbGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              {voiceState === "processing" ? (
                <ActivityIndicator size="large" color="#FFFFFF" />
              ) : (
                <Ionicons
                  name={
                    isMuted
                      ? "mic-off"
                      : voiceState === "speaking"
                      ? "volume-high"
                      : "mic"
                  }
                  size={52}
                  color="#FFFFFF"
                />
              )}
            </LinearGradient>
          </Animated.View>

          {/* Status Message */}
          <Text style={styles.statusText}>{statusMessage}</Text>
        </View>

        {/* ── Live Transcripts Area ── */}
        <View style={styles.transcriptContainer}>
          {!!liveUserTranscript && (
            <View style={styles.userBubble}>
              <Text style={styles.userTranscriptLabel}>You:</Text>
              <Text style={styles.userTranscriptText}>{liveUserTranscript}</Text>
            </View>
          )}

          {!!liveAssistantTranscript && voiceState === "speaking" && (
            <View style={styles.assistantBubble}>
              <Text style={styles.assistantTranscriptLabel}>PARAM AI:</Text>
              <Text style={styles.assistantTranscriptText} numberOfLines={4}>
                {liveAssistantTranscript}
              </Text>
            </View>
          )}
        </View>

        {/* ── Bottom Controls ── */}
        <View style={[styles.bottomControls, { paddingBottom: bottomPad }]}>
          {/* Mute Button */}
          <TouchableOpacity
            style={[styles.actionBtn, isMuted && styles.actionBtnMuted]}
            onPress={handleToggleMute}
            accessibilityRole="button"
            accessibilityLabel={isMuted ? "Unmute" : "Mute"}
          >
            <Ionicons name={isMuted ? "mic-off" : "mic"} size={22} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>{isMuted ? "Unmute" : "Mute"}</Text>
          </TouchableOpacity>

          {/* Barge-in / Interrupt Button (Active during speech) */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.interruptBtn]}
            onPress={handleInterrupt}
            accessibilityRole="button"
            accessibilityLabel="Interrupt PARAM AI"
          >
            <Ionicons name="hand-right-outline" size={22} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>
              {lang === "hi" ? "रोकें" : "Interrupt"}
            </Text>
          </TouchableOpacity>

          {/* Switch to Text Chat */}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Switch to text chat"
          >
            <Ionicons name="chatbubble-ellipses-outline" size={22} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Text Chat</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  topIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    alignItems: "center",
  },
  brandingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pulsingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
  },
  topTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  topSubtitle: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.75)",
    marginTop: 1,
  },
  langBar: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 20,
    padding: 3,
    marginTop: 4,
  },
  langChoice: {
    paddingVertical: 5,
    paddingHorizontal: 16,
    borderRadius: 18,
  },
  langChoiceActive: {
    backgroundColor: "#FFFFFF",
  },
  langChoiceText: {
    fontSize: 12,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.8)",
  },
  langChoiceTextActive: {
    color: "#6D28D9",
    fontWeight: "700",
  },
  settingsDrawer: {
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginTop: 8,
    alignItems: "center",
  },
  settingsLabel: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    fontWeight: "600",
    marginBottom: 6,
  },
  speedRow: {
    flexDirection: "row",
    gap: 10,
  },
  speedBtn: {
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  speedBtnActive: {
    backgroundColor: "#7C3AED",
  },
  speedBtnText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  speedBtnTextActive: {
    fontWeight: "700",
  },
  visualizerContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 20,
    height: 240,
  },
  waveRing: {
    position: "absolute",
    width: 170,
    height: 170,
    borderRadius: 85,
    borderWidth: 2,
  },
  waveRing1: {
    borderColor: "rgba(168, 85, 247, 0.45)",
  },
  waveRing2: {
    borderColor: "rgba(236, 72, 153, 0.3)",
  },
  coreOrb: {
    width: 140,
    height: 140,
    borderRadius: 70,
    overflow: "hidden",
    ...Platform.select({
      ios: {
        shadowColor: "#8B5CF6",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
        shadowRadius: 18,
      },
      android: { elevation: 12 },
      web: { boxShadow: "0 8px 32px rgba(139, 92, 246, 0.6)" },
    }),
  },
  orbGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  statusText: {
    marginTop: 22,
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  transcriptContainer: {
    paddingHorizontal: 24,
    minHeight: 120,
    justifyContent: "center",
    gap: 10,
  },
  userBubble: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-end",
    maxWidth: "85%",
  },
  userTranscriptLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#C4B5FD",
    marginBottom: 2,
  },
  userTranscriptText: {
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
  },
  assistantBubble: {
    backgroundColor: "rgba(124, 58, 237, 0.25)",
    borderRadius: 14,
    borderColor: "rgba(167, 139, 250, 0.4)",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignSelf: "flex-start",
    maxWidth: "88%",
  },
  assistantTranscriptLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "#E9D5FF",
    marginBottom: 2,
  },
  assistantTranscriptText: {
    fontSize: 13,
    color: "#FFFFFF",
    lineHeight: 18,
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-evenly",
    paddingHorizontal: 16,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 18,
    minWidth: 80,
    gap: 4,
  },
  actionBtnMuted: {
    backgroundColor: "rgba(239, 68, 68, 0.35)",
  },
  interruptBtn: {
    backgroundColor: "rgba(245, 158, 11, 0.35)",
    borderWidth: 1,
    borderColor: "rgba(245, 158, 11, 0.6)",
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
});
