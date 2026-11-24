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
import { voiceService } from "@/lib/voiceService";
import { getApiOrigin, getToken } from "@/lib/api";
import ParamAiOrb from "./ParamAiOrb";

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

  // Waveform bars animation
  const waveHeights = useRef([
    new Animated.Value(12),
    new Animated.Value(20),
    new Animated.Value(32),
    new Animated.Value(44),
    new Animated.Value(32),
    new Animated.Value(20),
    new Animated.Value(12),
  ]).current;

  const topPad = Platform.OS === "web" ? 16 : insets.top + 8;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom + 16;

  // Animate waveform bars during listening or speaking
  useEffect(() => {
    let interval: any = null;
    if (voiceState === "speaking" || voiceState === "listening") {
      interval = setInterval(() => {
        waveHeights.forEach((anim, i) => {
          const target =
            voiceState === "speaking"
              ? 16 + Math.random() * (i === 3 ? 38 : 28)
              : 10 + Math.random() * (i === 3 ? 24 : 16);
          Animated.timing(anim, {
            toValue: target,
            duration: 120,
            useNativeDriver: false,
          }).start();
        });
      }, 130);
    } else {
      waveHeights.forEach((anim) => {
        Animated.timing(anim, {
          toValue: 6,
          duration: 200,
          useNativeDriver: false,
        }).start();
      });
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [voiceState, waveHeights]);

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
            setStatusMessage(lang === "hi" ? "आपकी बात सुन रहे हैं..." : "Listening... Speak naturally");
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

  // Interrupt / Barge-in
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

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <LinearGradient
        colors={["#0B061E", "#150A36", "#1E0F4D"]}
        style={styles.modalContainer}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Ambient Top Glow */}
        <View style={styles.topAmbientLight} />

        {/* ── 1. Header ── */}
        <View style={[styles.topBar, { paddingTop: topPad }]}>
          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={handleClose}
            accessibilityRole="button"
            accessibilityLabel="Close voice mode"
          >
            <Ionicons name="close" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.topCenter}>
            <View style={styles.brandingRow}>
              <View
                style={[
                  styles.pulsingIndicator,
                  {
                    backgroundColor:
                      voiceState === "listening"
                        ? "#10B981"
                        : voiceState === "speaking"
                        ? "#06B6D4"
                        : voiceState === "processing"
                        ? "#F59E0B"
                        : "#A855F7",
                  },
                ]}
              />
              <Text style={styles.topTitle}>PARAM AI 🤖 LIVE</Text>
            </View>
            <Text style={styles.topSubtitle}>
              {lang === "hi" ? "नवोदय वॉइस कंपैनियन" : "Navodaya Voice Companion"}
            </Text>
          </View>

          <TouchableOpacity
            style={styles.topIconBtn}
            onPress={() => setShowSettings(!showSettings)}
            accessibilityRole="button"
            accessibilityLabel="Voice settings"
          >
            <Ionicons name="settings-outline" size={19} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* ── 2. Language Selector Capsule ── */}
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

        {/* Settings Drawer */}
        {showSettings && (
          <View style={styles.settingsDrawer}>
            <Text style={styles.settingsLabel}>Speech Speed</Text>
            <View style={styles.speedRow}>
              {[0.85, 1.0, 1.25].map((spd) => (
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

        {/* ── 3. Central Futuristic AI Orb & Waveform ── */}
        <View style={styles.visualizerContainer}>
          <ParamAiOrb
            size={160}
            state={
              isMuted
                ? "idle"
                : voiceState === "processing"
                ? "thinking"
                : voiceState === "error"
                ? "idle"
                : voiceState
            }
            audioLevel={voiceState === "speaking" ? 0.8 : voiceState === "listening" ? 0.5 : 0}
          />

          {/* Real-time 7-Bar Audio Waveform */}
          <View style={styles.waveformContainer}>
            {waveHeights.map((anim, idx) => (
              <Animated.View
                key={`bar-${idx}`}
                style={[
                  styles.waveformBar,
                  {
                    height: anim,
                    backgroundColor:
                      voiceState === "speaking"
                        ? "#06B6D4"
                        : voiceState === "listening"
                        ? "#10B981"
                        : "rgba(196, 181, 253, 0.4)",
                  },
                ]}
              />
            ))}
          </View>

          {/* Dynamic Status Capsule */}
          <View style={styles.statusCapsule}>
            {voiceState === "processing" ? (
              <ActivityIndicator size="small" color="#F59E0B" style={{ marginRight: 6 }} />
            ) : (
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor:
                      voiceState === "listening"
                        ? "#10B981"
                        : voiceState === "speaking"
                        ? "#06B6D4"
                        : isMuted
                        ? "#EF4444"
                        : "#A855F7",
                  },
                ]}
              />
            )}
            <Text style={styles.statusText}>{statusMessage}</Text>
          </View>
        </View>

        {/* ── 4. Live Speech Transcription Cards ── */}
        <View style={styles.transcriptContainer}>
          {!!liveUserTranscript && (
            <View style={styles.userBubble}>
              <View style={styles.bubbleTagRow}>
                <Ionicons name="person" size={11} color="#C4B5FD" />
                <Text style={styles.userTranscriptLabel}>You</Text>
              </View>
              <Text style={styles.userTranscriptText}>{liveUserTranscript}</Text>
            </View>
          )}

          {!!liveAssistantTranscript && voiceState === "speaking" && (
            <View style={styles.assistantBubble}>
              <View style={styles.bubbleTagRow}>
                <Text style={styles.assistantEmoji}>🤖</Text>
                <Text style={styles.assistantTranscriptLabel}>PARAM AI</Text>
              </View>
              <Text style={styles.assistantTranscriptText} numberOfLines={4}>
                {liveAssistantTranscript}
              </Text>
            </View>
          )}
        </View>

        {/* ── 5. Spatial Glassmorphic Bottom Controls ── */}
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

          {/* Interrupt / Barge-in Button */}
          <TouchableOpacity
            style={[styles.actionBtn, styles.interruptBtn]}
            onPress={handleInterrupt}
            accessibilityRole="button"
            accessibilityLabel="Interrupt speech"
          >
            <Ionicons name="hand-right-outline" size={22} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>
              {lang === "hi" ? "रोकें" : "Interrupt"}
            </Text>
          </TouchableOpacity>

          {/* Return to Text Chat */}
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
    position: "relative",
  },
  topAmbientLight: {
    position: "absolute",
    top: -60,
    left: "20%",
    width: "60%",
    height: 140,
    borderRadius: 70,
    backgroundColor: "#6D28D9",
    opacity: 0.25,
    ...Platform.select({
      web: { filter: "blur(40px)" } as any,
    }),
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  topIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  topCenter: {
    alignItems: "center",
  },
  brandingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  pulsingIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  topTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.5,
  },
  topSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    color: "#C4B5FD",
    marginTop: 2,
  },
  langBar: {
    flexDirection: "row",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.07)",
    borderRadius: 20,
    padding: 3,
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    marginTop: 8,
  },
  langChoice: {
    paddingHorizontal: 16,
    paddingVertical: 5,
    borderRadius: 16,
  },
  langChoiceActive: {
    backgroundColor: "#7C3AED",
  },
  langChoiceText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#C4B5FD",
  },
  langChoiceTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  settingsDrawer: {
    alignSelf: "center",
    backgroundColor: "rgba(18, 10, 44, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
    borderRadius: 16,
    padding: 12,
    marginTop: 8,
    width: "84%",
    alignItems: "center",
    zIndex: 20,
  },
  settingsLabel: {
    fontSize: 11,
    color: "#E9D5FF",
    fontWeight: "500",
    marginBottom: 8,
  },
  speedRow: {
    flexDirection: "row",
    gap: 8,
  },
  speedBtn: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
  },
  speedBtnActive: {
    backgroundColor: "#7C3AED",
  },
  speedBtnText: {
    fontSize: 11,
    color: "#C4B5FD",
  },
  speedBtnTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  visualizerContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
  },
  waveformContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 52,
    marginTop: 18,
  },
  waveformBar: {
    width: 4,
    borderRadius: 2,
  },
  statusCapsule: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 18,
    marginTop: 14,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    marginRight: 8,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#F3E8FF",
    textAlign: "center",
  },
  transcriptContainer: {
    paddingHorizontal: 22,
    minHeight: 120,
    justifyContent: "center",
    gap: 10,
  },
  userBubble: {
    backgroundColor: "rgba(124, 58, 237, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.35)",
    borderRadius: 16,
    padding: 12,
  },
  bubbleTagRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  userTranscriptLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#C4B5FD",
    letterSpacing: 0.5,
  },
  userTranscriptText: {
    fontSize: 14,
    color: "#FFFFFF",
    lineHeight: 20,
    fontWeight: "400",
  },
  assistantBubble: {
    backgroundColor: "rgba(30, 27, 75, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    borderRadius: 16,
    padding: 12,
  },
  assistantEmoji: {
    fontSize: 12,
  },
  assistantTranscriptLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "#A78BFA",
    letterSpacing: 0.5,
  },
  assistantTranscriptText: {
    fontSize: 13.5,
    color: "#E2E8F0",
    lineHeight: 19,
    fontWeight: "400",
  },
  bottomControls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 24,
    paddingTop: 10,
  },
  actionBtn: {
    alignItems: "center",
    justifyContent: "center",
    width: 84,
    height: 70,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    gap: 5,
  },
  actionBtnMuted: {
    backgroundColor: "rgba(239, 68, 68, 0.25)",
    borderColor: "#EF4444",
  },
  interruptBtn: {
    backgroundColor: "rgba(109, 40, 217, 0.35)",
    borderColor: "rgba(167, 139, 250, 0.4)",
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#E2E8F0",
  },
});
