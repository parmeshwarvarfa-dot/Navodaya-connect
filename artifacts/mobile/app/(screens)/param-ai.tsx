import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Linking,
  Modal,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApiOrigin, getToken } from "@/lib/api";
import { voiceService } from "@/lib/voiceService";
import ParamVoiceModal from "@/components/param/ParamVoiceModal";
import ParamAiOrb from "@/components/param/ParamAiOrb";

interface VerifiedLink {
  title: string;
  url: string;
  category: string;
  badge?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
  isVoiceMessage?: boolean;
  audioDurationSeconds?: number;
  verifiedLinks?: VerifiedLink[];
  detectedLanguage?: "en" | "hi";
}

// 7 Quick Action categories
const QUICK_ACTIONS = [
  { id: "all", label: "All Topics", icon: "sparkles" as const, color: "#A855F7" },
  { id: "jee-neet", label: "JEE / NEET", icon: "school" as const, color: "#3B82F6" },
  { id: "competitive", label: "UPSC / Exams", icon: "trophy" as const, color: "#F59E0B" },
  { id: "career", label: "Career Guide", icon: "compass" as const, color: "#10B981" },
  { id: "navodaya", label: "Navodaya Life", icon: "home" as const, color: "#EC4899" },
  { id: "scholarships", label: "Scholarships", icon: "ribbon" as const, color: "#8B5CF6" },
  { id: "study", label: "Study Assistance", icon: "book" as const, color: "#06B6D4" },
];

// Rich Suggested Prompts across categories
const DISCOVERY_PROMPTS = [
  {
    category: "jee-neet",
    tag: "JEE Main & Advanced",
    icon: "calculator-outline",
    prompt: "Create a 6-month JEE preparation strategy with daily routine for a Navodayan student.",
  },
  {
    category: "jee-neet",
    tag: "NEET UG",
    icon: "medkit-outline",
    prompt: "What is the best NCERT-focused biology and physics revision roadmap for NEET?",
  },
  {
    category: "competitive",
    tag: "Civil Services",
    icon: "shield-checkmark-outline",
    prompt: "How can JNV alumni prepare for UPSC Civil Services alongside college or job?",
  },
  {
    category: "career",
    tag: "Career Pathways",
    icon: "briefcase-outline",
    prompt: "Help me explore top engineering and non-engineering career options after Class 12.",
  },
  {
    category: "scholarships",
    tag: "National Scholarships",
    icon: "cash-outline",
    prompt: "List all government and private scholarship opportunities available for Navodaya students.",
  },
  {
    category: "navodaya",
    tag: "JNV Culture",
    icon: "heart-outline",
    prompt: "नवोदय विद्यालय की अनूठी परंपराओं, हाउस व्यवस्था और माइग्रेशन एक्सचेंज के बारे में बताएं।",
  },
  {
    category: "study",
    tag: "Concept Clarification",
    icon: "bulb-outline",
    prompt: "Explain Quantum Entanglement simply with everyday examples and thought experiments.",
  },
  {
    category: "navodaya",
    tag: "Hostel Life",
    icon: "time-outline",
    prompt: "How to balance morning PT, sports, academics, and hostel life effectively in JNV?",
  },
];

const PREF_VOICE_AUTOPLAY = "@param_voice_autoplay";
const PREF_VOICE_SPEED = "@param_voice_speed";
const PREF_VOICE_LANG = "@param_voice_lang";

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ParamAIScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Voice recording state in composer
  const [isRecordingVoiceMsg, setIsRecordingVoiceMsg] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // Settings
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceLang, setVoiceLang] = useState<"en" | "hi">("en");

  const scrollRef = useRef<ScrollView>(null);
  const typingPulse = useRef(new Animated.Value(0.4)).current;

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom;

  // Restore preferences
  useEffect(() => {
    AsyncStorage.getItem(PREF_VOICE_AUTOPLAY).then((val) => {
      if (val !== null) setAutoPlayAudio(val === "true");
    });
    AsyncStorage.getItem(PREF_VOICE_SPEED).then((val) => {
      if (val) setVoiceSpeed(parseFloat(val) || 1.0);
    });
    AsyncStorage.getItem(PREF_VOICE_LANG).then((val) => {
      if (val === "hi" || val === "en") setVoiceLang(val);
    });
  }, []);

  // Typing pulse animation
  useEffect(() => {
    if (!loading) {
      typingPulse.setValue(0.4);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(typingPulse, { toValue: 1, duration: 600, useNativeDriver: true }),
        Animated.timing(typingPulse, { toValue: 0.3, duration: 600, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [loading, typingPulse]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Speak message aloud
  const handleToggleSpeakMessage = (msgId: string, text: string, lang = "en") => {
    if (speakingMsgId === msgId) {
      voiceService.cancelSpeech();
      setSpeakingMsgId(null);
      return;
    }

    voiceService.cancelSpeech();
    setSpeakingMsgId(msgId);

    voiceService.speak(text, {
      lang: lang === "hi" ? "hi-IN" : "en-IN",
      rate: voiceSpeed,
      onEnd: () => {
        setSpeakingMsgId(null);
      },
      onError: () => {
        setSpeakingMsgId(null);
      },
    });
  };

  // Copy message text
  const handleCopyMessage = async (msgId: string, text: string) => {
    try {
      if (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
      }
      setCopiedId(msgId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  };

  // Send text message
  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    voiceService.cancelSpeech();
    setSpeakingMsgId(null);

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text: trimmed,
      timestamp: new Date(),
    };

    const historyPayload = messages.slice(-8).map(({ role, text: msgText }) => ({
      role,
      text: msgText,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const token = await getToken();
      const response = await fetch(`${getApiOrigin()}/api/param-ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          message: trimmed,
          history: historyPayload,
          language: voiceLang,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error(data.error || `PARAM AI request failed (${response.status})`);
      }

      const replyText = data.reply.trim();
      const detectedLang = data.detectedLanguage || (voiceLang === "hi" ? "hi" : "en");
      const assistantMsgId = `${Date.now()}-assistant`;

      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        text: replyText,
        timestamp: new Date(),
        verifiedLinks: data.verifiedLinks || [],
        detectedLanguage: detectedLang,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Auto-play audio response if user enabled it in settings
      if (autoPlayAudio) {
        handleToggleSpeakMessage(assistantMsgId, replyText, detectedLang);
      }
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "I am having trouble connecting right now. Please try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  // Regenerate last response
  const handleRegenerate = async () => {
    if (loading || messages.length === 0) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;

    // Remove last assistant message
    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.role === "assistant") {
        copy.pop();
      }
      return copy;
    });

    await sendMessage(lastUserMsg.text);
  };

  // Start recording voice message
  const handleStartVoiceRecording = async () => {
    voiceService.cancelSpeech();
    setSpeakingMsgId(null);

    const started = await voiceService.startRecordingVoiceMessage();
    if (!started) {
      Alert.alert(
        "Microphone Required",
        "Please allow microphone access to record voice messages."
      );
      return;
    }

    setIsRecordingVoiceMsg(true);
    setRecordingSeconds(0);

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  // Cancel voice recording
  const handleCancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    voiceService.cancelRecordingVoiceMessage();
    setIsRecordingVoiceMsg(false);
    setRecordingSeconds(0);
  };

  // Finish and send voice message
  const handleSendVoiceRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds;
    setIsRecordingVoiceMsg(false);
    setRecordingSeconds(0);
    setLoading(true);

    try {
      const audioResult = await voiceService.stopRecordingVoiceMessage();
      if (!audioResult || !audioResult.base64) {
        throw new Error("Could not capture voice audio");
      }

      const userMsg: Message = {
        id: `${Date.now()}-user-voice`,
        role: "user",
        text: "🎙️ Spoken voice message",
        isVoiceMessage: true,
        audioDurationSeconds: duration || 1,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      scrollToBottom();

      const token = await getToken();
      const historyPayload = messages.slice(-8).map(({ role, text: msgText }) => ({
        role,
        text: msgText,
      }));

      const response = await fetch(`${getApiOrigin()}/api/param-ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          audioBase64: audioResult.base64,
          mimeType: audioResult.mimeType,
          history: historyPayload,
          language: voiceLang,
        }),
      });

      const data = await response.json();
      const replyText = data.reply || "";
      const assistantMsgId = `${Date.now()}-assistant`;

      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        text: replyText || "I listened to your voice message.",
        timestamp: new Date(),
        verifiedLinks: data.verifiedLinks || [],
        detectedLanguage: data.detectedLanguage || voiceLang,
      };

      setMessages((prev) => [...prev, assistantMsg]);

      // Automatically speak answer to voice message
      handleToggleSpeakMessage(assistantMsgId, assistantMsg.text, assistantMsg.detectedLanguage);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: "I was unable to process the voice audio. Please try speaking clearly or send as text.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  // Handle messages from Voice Modal
  const handleVoiceMessageFromModal = useCallback(
    (userText: string, assistantReply: string) => {
      const now = new Date();
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-user-voice-live`,
          role: "user",
          text: userText,
          isVoiceMessage: true,
          timestamp: now,
        },
        {
          id: `${Date.now()}-assistant-voice-live`,
          role: "assistant",
          text: assistantReply,
          timestamp: new Date(now.getTime() + 100),
          detectedLanguage: /[\u0900-\u097F]/.test(assistantReply) ? "hi" : "en",
        },
      ]);
      scrollToBottom();
    },
    []
  );

  // Open verified link safely
  const handleOpenVerifiedLink = async (url: string) => {
    try {
      const validUrl = new URL(url);
      if (["http:", "https:"].includes(validUrl.protocol)) {
        await Linking.openURL(validUrl.toString());
      }
    } catch {
      Alert.alert("Link Unavailable", "Unable to open this portal link.");
    }
  };

  // Clear chat with confirm
  const handleClearChat = () => {
    Alert.alert(
      "Reset Conversation",
      "Do you want to clear your current conversation with PARAM AI?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            voiceService.cancelSpeech();
            setSpeakingMsgId(null);
            setMessages([]);
          },
        },
      ]
    );
  };

  const hasMessages = messages.length > 0;
  const filteredPrompts =
    selectedCategory === "all"
      ? DISCOVERY_PROMPTS
      : DISCOVERY_PROMPTS.filter((p) => p.category === selectedCategory);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Background Ambient Violet Lighting */}
      <View style={styles.ambientTopGlow} />

      {/* ── 1. Compact Premium Header ── */}
      <LinearGradient
        colors={["#0D0722", "#160A38", "#1F0F4E"]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <TouchableOpacity
          onPress={() => {
            voiceService.cancelSpeech();
            router.back();
          }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#E2E8F0" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <View style={styles.statusPulseDot} />
            <Text style={styles.headerTitle}>PARAM AI 🤖</Text>
          </View>
          <Text style={styles.headerStatusSub}>Neural Engine • Active</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Live Voice Mode Launch Button */}
          <TouchableOpacity
            style={styles.liveVoiceBtn}
            onPress={() => {
              voiceService.cancelSpeech();
              setSpeakingMsgId(null);
              setShowVoiceModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Launch Live Voice Mode"
          >
            <Ionicons name="mic" size={15} color="#FFFFFF" />
            <Text style={styles.liveVoiceBtnText}>Live Voice</Text>
          </TouchableOpacity>

          {/* Settings Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSettingsModal(true)}
            accessibilityRole="button"
            accessibilityLabel="PARAM AI Settings"
          >
            <Ionicons name="settings-outline" size={18} color="#C4B5FD" />
          </TouchableOpacity>

          {/* Clear Chat Button */}
          {hasMessages && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleClearChat}
              accessibilityRole="button"
              accessibilityLabel="Reset conversation"
            >
              <Ionicons name="refresh" size={18} color="#C4B5FD" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── 2. Scrollable Body (AI Identity, Prompts & Chat) ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: bottomPad + 96 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasMessages ? (
          <View style={styles.welcomeSection}>
            {/* Animated 3D AI Orb Section */}
            <View style={styles.orbWrapper}>
              <ParamAiOrb
                size={104}
                state={loading ? "thinking" : isRecordingVoiceMsg ? "listening" : "idle"}
              />
            </View>

            {/* Intro Heading & Description */}
            <Text style={styles.welcomeHeading}>Intelligent Companion for Navodayans</Text>
            <Text style={styles.welcomeSubtitle}>
              Empowering students and alumni across India with instant guidance on competitive exams, career roadmaps, and JNV traditions.
            </Text>

            {/* Capabilities Badge Row */}
            <View style={styles.capabilityPillRow}>
              <View style={styles.capabilityPill}>
                <Ionicons name="flash" size={11} color="#F59E0B" />
                <Text style={styles.capabilityPillText}>Gemini AI</Text>
              </View>
              <View style={styles.capabilityPill}>
                <Ionicons name="mic" size={11} color="#10B981" />
                <Text style={styles.capabilityPillText}>Dual Voice Mode</Text>
              </View>
              <View style={styles.capabilityPill}>
                <Ionicons name="language" size={11} color="#3B82F6" />
                <Text style={styles.capabilityPillText}>English & हिंदी</Text>
              </View>
            </View>

            {/* Live Voice Mode Banner */}
            <TouchableOpacity
              style={styles.voiceHeroCard}
              onPress={() => setShowVoiceModal(true)}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={["rgba(124, 58, 237, 0.35)", "rgba(99, 102, 241, 0.2)"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.voiceHeroGradient}
              >
                <View style={styles.voiceHeroIconWrap}>
                  <Ionicons name="mic-circle" size={28} color="#A78BFA" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.voiceHeroTitle}>Experience Live Two-Way Voice</Text>
                  <Text style={styles.voiceHeroDesc}>
                    Talk naturally in Hindi or English with real-time audio visualization.
                  </Text>
                </View>
                <View style={styles.voiceHeroStartPill}>
                  <Text style={styles.voiceHeroStartText}>Start 🎙️</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Quick Action Category Filter Tabs */}
            <Text style={styles.sectionLabel}>QUICK SHORTCUTS</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoryScroll}
            >
              {QUICK_ACTIONS.map((cat) => {
                const isActive = selectedCategory === cat.id;
                return (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.categoryChip, isActive && styles.categoryChipActive]}
                    onPress={() => setSelectedCategory(cat.id)}
                    activeOpacity={0.75}
                  >
                    <Ionicons
                      name={cat.icon}
                      size={13}
                      color={isActive ? "#FFFFFF" : cat.color}
                      style={{ marginRight: 5 }}
                    />
                    <Text
                      style={[
                        styles.categoryChipText,
                        isActive && styles.categoryChipTextActive,
                      ]}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Discovery Prompt Cards */}
            <Text style={styles.sectionLabel}>SUGGESTED EXPLORATIONS</Text>
            <View style={styles.promptCardsGrid}>
              {filteredPrompts.map((item, idx) => (
                <TouchableOpacity
                  key={`prompt-${idx}`}
                  style={styles.promptCard}
                  onPress={() => sendMessage(item.prompt)}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <View style={styles.promptCardTop}>
                    <View style={styles.promptTagPill}>
                      <Ionicons
                        name={item.icon as any}
                        size={12}
                        color="#C4B5FD"
                        style={{ marginRight: 4 }}
                      />
                      <Text style={styles.promptTagText}>{item.tag}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={13} color="#A78BFA" />
                  </View>
                  <Text style={styles.promptText}>{item.prompt}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* ── Conversation Messages ── */
          <View style={styles.messagesList}>
            {messages.map((msg) => {
              const isUser = msg.role === "user";
              const isSpeaking = speakingMsgId === msg.id;

              return (
                <View
                  key={msg.id}
                  style={[styles.messageRow, isUser ? styles.userRow : styles.aiRow]}
                >
                  {/* AI Avatar */}
                  {!isUser && (
                    <View style={styles.aiOrbAvatar}>
                      <Text style={{ fontSize: 13 }}>🤖</Text>
                    </View>
                  )}

                  {/* Message Bubble */}
                  <View
                    style={[
                      styles.bubble,
                      isUser ? styles.bubbleUser : styles.bubbleAI,
                    ]}
                  >
                    {/* Assistant Message Header Actions */}
                    {!isUser && (
                      <View style={styles.aiMessageHeader}>
                        <View style={styles.aiLabelRow}>
                          <Text style={styles.aiLabelText}>PARAM AI 🤖</Text>
                          {msg.detectedLanguage === "hi" && (
                            <View style={styles.langPill}>
                              <Text style={styles.langPillText}>हिंदी</Text>
                            </View>
                          )}
                        </View>

                        {/* Top Action Icons: Listen, Copy */}
                        <View style={styles.aiActionsRow}>
                          <TouchableOpacity
                            onPress={() =>
                              handleToggleSpeakMessage(
                                msg.id,
                                msg.text,
                                msg.detectedLanguage
                              )
                            }
                            style={[
                              styles.bubbleActionBtn,
                              isSpeaking && styles.bubbleActionBtnActive,
                            ]}
                            accessibilityLabel={isSpeaking ? "Stop speaking" : "Listen aloud"}
                          >
                            <Ionicons
                              name={isSpeaking ? "volume-mute" : "volume-medium"}
                              size={14}
                              color={isSpeaking ? "#EC4899" : "#C4B5FD"}
                            />
                          </TouchableOpacity>

                          <TouchableOpacity
                            onPress={() => handleCopyMessage(msg.id, msg.text)}
                            style={styles.bubbleActionBtn}
                            accessibilityLabel="Copy response"
                          >
                            <Ionicons
                              name={copiedId === msg.id ? "checkmark" : "copy-outline"}
                              size={13}
                              color={copiedId === msg.id ? "#10B981" : "#C4B5FD"}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    )}

                    {/* Message Body Content */}
                    <Text
                      style={[
                        styles.messageText,
                        isUser ? styles.userMessageText : styles.aiMessageText,
                      ]}
                      selectable
                    >
                      {msg.text}
                    </Text>

                    {/* Verified Official Links */}
                    {msg.verifiedLinks && msg.verifiedLinks.length > 0 && (
                      <View style={styles.verifiedLinksSection}>
                        <Text style={styles.verifiedLinksHeading}>
                          VERIFIED OFFICIAL PORTALS
                        </Text>
                        {msg.verifiedLinks.map((link) => (
                          <TouchableOpacity
                            key={link.url}
                            style={styles.verifiedLinkItem}
                            onPress={() => handleOpenVerifiedLink(link.url)}
                            activeOpacity={0.8}
                          >
                            <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                            <View style={{ flex: 1, marginLeft: 6 }}>
                              <Text style={styles.verifiedLinkTitle} numberOfLines={1}>
                                {link.title}
                              </Text>
                              <Text style={styles.verifiedLinkCategory}>
                                {link.badge || link.category}
                              </Text>
                            </View>
                            <Ionicons name="open-outline" size={13} color="#C4B5FD" />
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}

                    {/* Message Footer: Timestamp */}
                    <View style={styles.messageFooter}>
                      <Text style={styles.messageTimestamp}>
                        {formatTime(new Date(msg.timestamp))}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {/* Thinking / Neural Indicator */}
            {loading && (
              <View style={[styles.messageRow, styles.aiRow]}>
                <View style={styles.aiOrbAvatar}>
                  <Text style={{ fontSize: 13 }}>🤖</Text>
                </View>
                <Animated.View
                  style={[
                    styles.thinkingBubble,
                    { opacity: typingPulse },
                  ]}
                >
                  <View style={styles.thinkingDot} />
                  <View style={[styles.thinkingDot, { animationDelay: "150ms" } as any]} />
                  <View style={[styles.thinkingDot, { animationDelay: "300ms" } as any]} />
                  <Text style={styles.thinkingText}>PARAM AI is formulating your response...</Text>
                </Animated.View>
              </View>
            )}

            {/* Regenerate Action Button at bottom of chat */}
            {hasMessages && !loading && (
              <TouchableOpacity
                style={styles.regenerateBtn}
                onPress={handleRegenerate}
                activeOpacity={0.75}
              >
                <Ionicons name="sync-outline" size={13} color="#A78BFA" />
                <Text style={styles.regenerateBtnText}>Regenerate Response</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── 3. Futuristic Glassmorphic Message Composer ── */}
      <View
        style={[
          styles.composerContainer,
          { paddingBottom: Math.max(bottomPad, 12) },
        ]}
      >
        {isRecordingVoiceMsg ? (
          /* Active Voice Recording UI */
          <View style={styles.recordingBar}>
            <View style={styles.recordingPulseDot} />
            <Text style={styles.recordingTimerText}>
              Recording Voice... {recordingSeconds}s
            </Text>
            <TouchableOpacity
              onPress={handleCancelVoiceRecording}
              style={styles.cancelRecBtn}
            >
              <Ionicons name="trash-outline" size={17} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSendVoiceRecording}
              style={styles.sendRecBtn}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Normal Message Input Box */
          <View style={styles.inputInnerRow}>
            {/* Quick Live Voice Mode Trigger */}
            <TouchableOpacity
              style={styles.composerMicBtn}
              onPress={() => setShowVoiceModal(true)}
              accessibilityLabel="Open Live Voice Mode"
            >
              <Ionicons name="mic-outline" size={20} color="#A78BFA" />
            </TouchableOpacity>

            <TextInput
              style={styles.inputField}
              placeholder="Ask PARAM AI about JEE/NEET, career, JNV life..."
              placeholderTextColor="#94A3B8"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2000}
              editable={!loading}
            />

            {/* Quick Voice Message Recorder */}
            {!input.trim() && (
              <TouchableOpacity
                style={styles.composerRecordBtn}
                onPress={handleStartVoiceRecording}
                accessibilityLabel="Record voice message"
              >
                <Ionicons name="radio-outline" size={18} color="#C4B5FD" />
              </TouchableOpacity>
            )}

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendBtn,
                input.trim() ? styles.sendBtnActive : styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              accessibilityLabel="Send message"
            >
              <LinearGradient
                colors={
                  input.trim()
                    ? ["#8B5CF6", "#6D28D9"]
                    : ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.03)"]
                }
                style={styles.sendGradient}
              >
                <Ionicons
                  name="arrow-up"
                  size={18}
                  color={input.trim() ? "#FFFFFF" : "#64748B"}
                />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── 4. Immersive Two-Way Voice Modal ── */}
      <ParamVoiceModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSendMessageFromVoice={handleVoiceMessageFromModal}
        conversationHistory={messages.map((m) => ({ role: m.role, text: m.text }))}
        initialLanguage={voiceLang}
      />

      {/* ── 5. Settings Modal ── */}
      <Modal
        visible={showSettingsModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.settingsModalOverlay}>
          <View style={styles.settingsModalCard}>
            <View style={styles.settingsModalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={{ fontSize: 18 }}>🤖</Text>
                <Text style={styles.settingsModalTitle}>PARAM AI Settings</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSettingsModal(false)}
                style={styles.settingsCloseBtn}
              >
                <Ionicons name="close" size={20} color="#E2E8F0" />
              </TouchableOpacity>
            </View>

            {/* Language Selection */}
            <Text style={styles.settingSectionLabel}>Preferred Language</Text>
            <View style={styles.settingToggleRow}>
              {(["en", "hi"] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[
                    styles.settingChoiceBtn,
                    voiceLang === l && styles.settingChoiceBtnActive,
                  ]}
                  onPress={() => {
                    setVoiceLang(l);
                    AsyncStorage.setItem(PREF_VOICE_LANG, l);
                  }}
                >
                  <Text
                    style={[
                      styles.settingChoiceText,
                      voiceLang === l && styles.settingChoiceTextActive,
                    ]}
                  >
                    {l === "en" ? "English" : "हिंदी (Hindi)"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Speech Speed */}
            <Text style={styles.settingSectionLabel}>Voice Speech Speed</Text>
            <View style={styles.settingToggleRow}>
              {[0.85, 1.0, 1.25].map((spd) => (
                <TouchableOpacity
                  key={`spd-${spd}`}
                  style={[
                    styles.settingChoiceBtn,
                    voiceSpeed === spd && styles.settingChoiceBtnActive,
                  ]}
                  onPress={() => {
                    setVoiceSpeed(spd);
                    AsyncStorage.setItem(PREF_VOICE_SPEED, String(spd));
                  }}
                >
                  <Text
                    style={[
                      styles.settingChoiceText,
                      voiceSpeed === spd && styles.settingChoiceTextActive,
                    ]}
                  >
                    {spd}x
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Auto Read Answers Aloud */}
            <View style={styles.settingSwitchRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.settingSwitchTitle}>Read Answers Aloud</Text>
                <Text style={styles.settingSwitchSubtitle}>
                  Automatically speak assistant responses
                </Text>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleTrack,
                  autoPlayAudio && styles.toggleTrackActive,
                ]}
                onPress={() => {
                  const next = !autoPlayAudio;
                  setAutoPlayAudio(next);
                  AsyncStorage.setItem(PREF_VOICE_AUTOPLAY, String(next));
                }}
              >
                <View
                  style={[
                    styles.toggleThumb,
                    autoPlayAudio && styles.toggleThumbActive,
                  ]}
                />
              </TouchableOpacity>
            </View>

            {/* Clear History Button */}
            <TouchableOpacity
              style={styles.clearHistoryModalBtn}
              onPress={() => {
                setShowSettingsModal(false);
                handleClearChat();
              }}
            >
              <Ionicons name="trash-outline" size={16} color="#EF4444" style={{ marginRight: 6 }} />
              <Text style={styles.clearHistoryModalBtnText}>Clear Conversation History</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080417",
    position: "relative",
  },
  ambientTopGlow: {
    position: "absolute",
    top: -40,
    left: "15%",
    width: "70%",
    height: 120,
    borderRadius: 60,
    backgroundColor: "#6D28D9",
    opacity: 0.18,
    ...Platform.select({
      web: { filter: "blur(50px)" } as any,
    }),
  },

  // Header
  header: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.15)",
    zIndex: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.4,
  },
  headerStatusSub: {
    fontSize: 10,
    color: "#C4B5FD",
    marginTop: 1,
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveVoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124, 58, 237, 0.4)",
    borderWidth: 1,
    borderColor: "#A78BFA",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    gap: 4,
  },
  liveVoiceBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Body
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  // Welcome / AI Identity Section
  welcomeSection: {
    alignItems: "center",
  },
  orbWrapper: {
    marginVertical: 10,
  },
  welcomeHeading: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    letterSpacing: -0.2,
    marginTop: 6,
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 12,
    color: "#CBD5E1",
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 340,
    marginBottom: 12,
  },
  capabilityPillRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  capabilityPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  capabilityPillText: {
    fontSize: 10,
    fontWeight: "500",
    color: "#E2E8F0",
  },

  // Voice Hero Card
  voiceHeroCard: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.35)",
    marginBottom: 18,
  },
  voiceHeroGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 10,
  },
  voiceHeroIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(124, 58, 237, 0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceHeroTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  voiceHeroDesc: {
    fontSize: 11,
    color: "#CBD5E1",
    marginTop: 2,
  },
  voiceHeroStartPill: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  voiceHeroStartText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  // Section Labels
  sectionLabel: {
    alignSelf: "flex-start",
    fontSize: 10,
    fontWeight: "700",
    color: "#A78BFA",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginTop: 4,
  },

  // Category Shortcuts
  categoryScroll: {
    gap: 8,
    paddingBottom: 14,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  categoryChipActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#A78BFA",
  },
  categoryChipText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#CBD5E1",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },

  // Discovery Prompt Cards
  promptCardsGrid: {
    width: "100%",
    gap: 10,
  },
  promptCard: {
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.18)",
    borderRadius: 16,
    padding: 12,
  },
  promptCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  promptTagPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(124, 58, 237, 0.25)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  promptTagText: {
    fontSize: 10,
    fontWeight: "600",
    color: "#DDD6FE",
  },
  promptText: {
    fontSize: 12.5,
    color: "#F1F5F9",
    lineHeight: 18,
    fontWeight: "400",
  },

  // Chat Messages
  messagesList: {
    gap: 14,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
  },
  userRow: {
    justifyContent: "flex-end",
  },
  aiRow: {
    justifyContent: "flex-start",
  },
  aiOrbAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(124, 58, 237, 0.4)",
    borderWidth: 1,
    borderColor: "#A78BFA",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  bubble: {
    maxWidth: "84%",
    borderRadius: 18,
    padding: 12,
  },
  bubbleUser: {
    backgroundColor: "#6D28D9",
    borderBottomRightRadius: 4,
    ...Platform.select({
      web: { boxShadow: "0 4px 12px rgba(109, 40, 217, 0.3)" } as any,
    }),
  },
  bubbleAI: {
    backgroundColor: "rgba(19, 9, 43, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    borderBottomLeftRadius: 4,
    ...Platform.select({
      web: { boxShadow: "0 4px 14px rgba(0, 0, 0, 0.25)" } as any,
    }),
  },
  aiMessageHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.15)",
  },
  aiLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiLabelText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#DDD6FE",
    letterSpacing: 0.3,
  },
  langPill: {
    backgroundColor: "rgba(124, 58, 237, 0.3)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  langPillText: {
    fontSize: 9,
    color: "#C4B5FD",
    fontWeight: "600",
  },
  aiActionsRow: {
    flexDirection: "row",
    gap: 6,
  },
  bubbleActionBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleActionBtnActive: {
    backgroundColor: "rgba(236, 72, 153, 0.2)",
  },
  messageText: {
    fontSize: 13.5,
    lineHeight: 20,
  },
  userMessageText: {
    color: "#FFFFFF",
    fontWeight: "400",
  },
  aiMessageText: {
    color: "#F8FAFC",
    fontWeight: "400",
  },
  verifiedLinksSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(167, 139, 250, 0.15)",
    gap: 6,
  },
  verifiedLinksHeading: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#10B981",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  verifiedLinkItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    padding: 8,
    borderRadius: 10,
  },
  verifiedLinkTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  verifiedLinkCategory: {
    fontSize: 10,
    color: "#A78BFA",
  },
  messageFooter: {
    alignSelf: "flex-end",
    marginTop: 4,
  },
  messageTimestamp: {
    fontSize: 9.5,
    color: "rgba(255, 255, 255, 0.45)",
  },

  // Thinking Bubble
  thinkingBubble: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(19, 9, 43, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 5,
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#A855F7",
  },
  thinkingText: {
    fontSize: 11.5,
    color: "#C4B5FD",
    marginLeft: 4,
  },

  // Regenerate Button
  regenerateBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
    marginVertical: 4,
  },
  regenerateBtnText: {
    fontSize: 11,
    fontWeight: "500",
    color: "#C4B5FD",
  },

  // Message Composer
  composerContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 6, 26, 0.95)",
    borderTopWidth: 1,
    borderTopColor: "rgba(167, 139, 250, 0.18)",
    paddingHorizontal: 14,
    paddingTop: 10,
    ...Platform.select({
      web: { backdropFilter: "blur(16px)" } as any,
    }),
  },
  inputInnerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.25)",
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  composerMicBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  inputField: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    maxHeight: 90,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  composerRecordBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    overflow: "hidden",
  },
  sendBtnActive: {},
  sendBtnDisabled: {
    opacity: 0.45,
  },
  sendGradient: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  // Recording Bar
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "#EF4444",
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  recordingPulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  recordingTimerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#FCA5A5",
  },
  cancelRecBtn: {
    padding: 4,
  },
  sendRecBtn: {
    backgroundColor: "#10B981",
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  // Settings Modal
  settingsModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  settingsModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#13092E",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.3)",
    borderRadius: 22,
    padding: 18,
  },
  settingsModalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(167, 139, 250, 0.15)",
  },
  settingsModalTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  settingsCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  settingSectionLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#C4B5FD",
    marginBottom: 8,
    marginTop: 8,
  },
  settingToggleRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  settingChoiceBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderWidth: 1,
    borderColor: "rgba(167, 139, 250, 0.2)",
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
  },
  settingChoiceBtnActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#A78BFA",
  },
  settingChoiceText: {
    fontSize: 12,
    color: "#CBD5E1",
    fontWeight: "500",
  },
  settingChoiceTextActive: {
    color: "#FFFFFF",
    fontWeight: "600",
  },
  settingSwitchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(167, 139, 250, 0.15)",
    marginVertical: 4,
  },
  settingSwitchTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  settingSwitchSubtitle: {
    fontSize: 10.5,
    color: "#94A3B8",
    marginTop: 2,
  },
  toggleTrack: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    padding: 2,
    justifyContent: "center",
  },
  toggleTrackActive: {
    backgroundColor: "#7C3AED",
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#FFFFFF",
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
  clearHistoryModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.4)",
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 14,
  },
  clearHistoryModalBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#FCA5A5",
  },
});
