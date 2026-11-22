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

const SUGGESTIONS = [
  { emoji: "🎓", text: "Career guidance after Class 12 for Navodayans" },
  { emoji: "📚", text: "JEE Main & Advanced preparation strategy" },
  { emoji: "🏥", text: "NEET preparation tips & biology roadmap" },
  { emoji: "🏛️", text: "UPSC Civil Services guidance for JNV alumni" },
  { emoji: "🏠", text: "Hostel life, house competition memories & assemblies" },
  { emoji: "🌍", text: "National scholarship schemes for JNV students" },
  { emoji: "🇮🇳", text: "नवोदय विद्यालय की संस्कृति और जीवन पर बात करें" },
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
  const typingAnim = useRef(new Animated.Value(0)).current;

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

  // Typing indicator loop
  useEffect(() => {
    if (!loading) {
      typingAnim.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(typingAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(typingAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [loading, typingAnim]);

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
          text: error instanceof Error
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
    } catch (err: any) {
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

  // Handle messages received during Live Voice Mode
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
      "Clear Conversation",
      "Do you want to reset this conversation with PARAM AI?",
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

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── Header ── */}
      <LinearGradient
        colors={["#7C3AED", "#6366F1"]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <TouchableOpacity
          onPress={() => {
            voiceService.cancelSpeech();
            router.back();
          }}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.aiDot} />
          <Text style={styles.headerTitle}>PA₹AM AI 3.0</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Live Voice Button */}
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
            <Ionicons name="mic" size={17} color="#FFFFFF" />
            <Text style={styles.liveVoiceBtnText}>Voice</Text>
          </TouchableOpacity>

          {/* Settings Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSettingsModal(true)}
            accessibilityRole="button"
            accessibilityLabel="Param AI Settings"
          >
            <Ionicons name="settings-outline" size={18} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Clear Button */}
          {hasMessages && (
            <TouchableOpacity style={styles.iconBtn} onPress={handleClearChat}>
              <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.85)" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* ── Chat Messages Body ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: bottomPad + 90 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasMessages ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIconWrap}>
              <LinearGradient
                colors={["#7C3AED", "#6366F1"]}
                style={styles.iconGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="hardware-chip" size={38} color="#FFFFFF" />
              </LinearGradient>
            </View>

            <Text style={styles.welcomeTitle}>Your Navodaya AI Companion</Text>
            <Text style={styles.welcomeSubtitle}>PARAM AI 3.0 • Voice & Multimodal</Text>
            <Text style={styles.welcomeDesc}>
              Ask about competitive exams (JEE/NEET/UPSC), career guidance, JNV school & hostel traditions, scholarships, or start a natural voice conversation in English or Hindi.
            </Text>

            <View style={styles.voiceHighlightBox}>
              <Ionicons name="mic-circle" size={24} color="#7C3AED" />
              <View style={{ flex: 1 }}>
                <Text style={styles.voiceHighlightTitle}>Live Two-Way Voice Mode</Text>
                <Text style={styles.voiceHighlightDesc}>
                  Tap the Voice button to talk naturally with instant interruption support.
                </Text>
              </View>
              <TouchableOpacity
                style={styles.voiceHighlightBtn}
                onPress={() => setShowVoiceModal(true)}
              >
                <Text style={styles.voiceHighlightBtnText}>Start</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.tryLabel}>EXPLORE NAVODAYA TOPICS</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.text}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(suggestion.text)}
                  activeOpacity={0.75}
                  disabled={loading}
                >
                  <Text style={styles.suggestionEmoji}>{suggestion.emoji}</Text>
                  <Text style={styles.suggestionText}>{suggestion.text}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.messages}>
            {messages.map((msg) => (
              <View key={msg.id} style={msg.role === "user" ? styles.userRow : styles.aiRow}>
                {msg.role === "assistant" && (
                  <View style={styles.aiAvatar}>
                    <Ionicons name="hardware-chip" size={14} color="#7C3AED" />
                  </View>
                )}

                <View
                  style={[
                    styles.bubble,
                    msg.role === "user" ? styles.bubbleUser : styles.bubbleAI,
                  ]}
                >
                  {/* Assistant Header Row with Speaker Action */}
                  {msg.role === "assistant" && (
                    <View style={styles.aiHeaderRow}>
                      <View style={styles.aiLabelTag}>
                        <Text style={styles.aiLabel}>PA₹AM AI</Text>
                        {msg.detectedLanguage === "hi" && (
                          <View style={styles.langBadge}>
                            <Text style={styles.langBadgeText}>हिंदी</Text>
                          </View>
                        )}
                      </View>

                      {/* Text-to-Speech Play / Stop Button */}
                      <TouchableOpacity
                        style={styles.speakActionBtn}
                        onPress={() =>
                          handleToggleSpeakMessage(
                            msg.id,
                            msg.text,
                            msg.detectedLanguage || "en"
                          )
                        }
                        accessibilityRole="button"
                        accessibilityLabel={
                          speakingMsgId === msg.id ? "Pause spoken response" : "Listen aloud"
                        }
                      >
                        <Ionicons
                          name={
                            speakingMsgId === msg.id
                              ? "stop-circle"
                              : "volume-high-outline"
                          }
                          size={16}
                          color="#7C3AED"
                        />
                        <Text style={styles.speakActionText}>
                          {speakingMsgId === msg.id ? "Stop" : "Listen"}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Spoken voice message indicator for user */}
                  {msg.isVoiceMessage && (
                    <View style={styles.voiceNoteIndicator}>
                      <Ionicons
                        name="mic"
                        size={14}
                        color={msg.role === "user" ? "#FFFFFF" : "#7C3AED"}
                      />
                      <Text
                        style={[
                          styles.voiceNoteText,
                          msg.role === "user" && { color: "#FFFFFF" },
                        ]}
                      >
                        Voice Message {msg.audioDurationSeconds ? `(${msg.audioDurationSeconds}s)` : ""}
                      </Text>
                    </View>
                  )}

                  {/* Message Text Content */}
                  <Text
                    style={[
                      styles.bubbleText,
                      msg.role === "user" && styles.bubbleTextUser,
                    ]}
                  >
                    {msg.text}
                  </Text>

                  {/* Verified Links Cards */}
                  {msg.verifiedLinks && msg.verifiedLinks.length > 0 && (
                    <View style={styles.verifiedLinksSection}>
                      <Text style={styles.verifiedLinksHeader}>
                        Official & Verified Portals:
                      </Text>
                      {msg.verifiedLinks.map((link) => (
                        <TouchableOpacity
                          key={link.url}
                          style={styles.linkCard}
                          onPress={() => handleOpenVerifiedLink(link.url)}
                          activeOpacity={0.8}
                        >
                          <View style={styles.linkIconBox}>
                            <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.linkTitle} numberOfLines={1}>
                              {link.title}
                            </Text>
                            <Text style={styles.linkCategory}>
                              {link.badge || link.category}
                            </Text>
                          </View>
                          <Ionicons name="open-outline" size={15} color="#7C3AED" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                  <Text
                    style={[
                      styles.timeText,
                      msg.role === "user" && { color: "rgba(255,255,255,0.7)" },
                    ]}
                  >
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>
              </View>
            ))}

            {/* Typing Loader */}
            {loading && (
              <View style={styles.aiRow}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="hardware-chip" size={14} color="#7C3AED" />
                </View>
                <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
                  <View style={styles.typingWrap}>
                    {[0, 1, 2].map((i) => (
                      <Animated.View
                        key={i}
                        style={[
                          styles.typingDot,
                          {
                            opacity: typingAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0.3 + i * 0.2, 1 - i * 0.2],
                            }),
                            transform: [
                              {
                                translateY: typingAnim.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: [0, i === 1 ? -4 : -2],
                                }),
                              },
                            ],
                          },
                        ]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Bottom Composer ── */}
      <View style={[styles.inputRow, { paddingBottom: bottomPad + 8 }]}>
        {isRecordingVoiceMsg ? (
          /* Voice Message Recording Bar */
          <View style={styles.voiceRecordingBar}>
            <View style={styles.recDotRow}>
              <View style={styles.recDot} />
              <Text style={styles.recTimerText}>
                Recording {String(Math.floor(recordingSeconds / 60)).padStart(2, "0")}:
                {String(recordingSeconds % 60).padStart(2, "0")}
              </Text>
            </View>

            <View style={styles.recActions}>
              <TouchableOpacity
                onPress={handleCancelVoiceRecording}
                style={styles.cancelRecBtn}
                accessibilityRole="button"
                accessibilityLabel="Cancel recording"
              >
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleSendVoiceRecording}
                style={styles.sendRecBtn}
                accessibilityRole="button"
                accessibilityLabel="Send voice message"
              >
                <Ionicons name="send" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* Normal Composer */
          <>
            <TouchableOpacity
              style={styles.voiceInputBtn}
              onPress={handleStartVoiceRecording}
              accessibilityRole="button"
              accessibilityLabel="Record voice message"
              disabled={loading}
            >
              <Ionicons name="mic" size={20} color="#7C3AED" />
            </TouchableOpacity>

            <TextInput
              style={styles.inputBox}
              placeholder={
                voiceLang === "hi"
                  ? "परम एआई से कुछ भी पूछें..."
                  : "Ask PA₹AM AI anything..."
              }
              placeholderTextColor="#9CA3AF"
              value={input}
              onChangeText={setInput}
              onSubmitEditing={() => sendMessage(input)}
              returnKeyType="send"
              multiline={false}
              editable={!loading}
            />

            <TouchableOpacity
              style={[
                styles.sendBtn,
                (!input.trim() || loading) && styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage(input)}
              disabled={!input.trim() || loading}
            >
              <Ionicons name="send" size={17} color="#fff" />
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.disclaimer}>
        PA₹AM AI 3.0 provides Navodaya community guidance. Verify critical examination & official notices with authorities.
      </Text>

      {/* ── Live Voice Mode Full-Screen Experience ── */}
      <ParamVoiceModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSendMessageFromVoice={handleVoiceMessageFromModal}
        conversationHistory={messages.slice(-8).map((m) => ({
          role: m.role,
          text: m.text,
        }))}
        initialLanguage={voiceLang}
      />

      {/* ── Settings Modal ── */}
      <Modal
        visible={showSettingsModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSettingsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.settingsModalCard}>
            <View style={styles.settingsModalHeader}>
              <Text style={styles.settingsModalTitle}>PARAM AI Voice Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)}>
                <Ionicons name="close" size={22} color="#0F172A" />
              </TouchableOpacity>
            </View>

            {/* Language Selector */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Default Conversation Language</Text>
              <View style={styles.settingLangToggle}>
                <TouchableOpacity
                  style={[
                    styles.settingLangBtn,
                    voiceLang === "en" && styles.settingLangBtnActive,
                  ]}
                  onPress={() => {
                    setVoiceLang("en");
                    AsyncStorage.setItem(PREF_VOICE_LANG, "en");
                  }}
                >
                  <Text
                    style={[
                      styles.settingLangText,
                      voiceLang === "en" && styles.settingLangTextActive,
                    ]}
                  >
                    English (en-IN)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.settingLangBtn,
                    voiceLang === "hi" && styles.settingLangBtnActive,
                  ]}
                  onPress={() => {
                    setVoiceLang("hi");
                    AsyncStorage.setItem(PREF_VOICE_LANG, "hi");
                  }}
                >
                  <Text
                    style={[
                      styles.settingLangText,
                      voiceLang === "hi" && styles.settingLangTextActive,
                    ]}
                  >
                    हिंदी (hi-IN)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Speech Speed */}
            <View style={styles.settingItem}>
              <Text style={styles.settingLabel}>Speech Pacing Speed: {voiceSpeed}x</Text>
              <View style={styles.settingSpeedRow}>
                {[0.85, 1.0, 1.15, 1.3].map((spd) => (
                  <TouchableOpacity
                    key={`speed-${spd}`}
                    style={[
                      styles.settingSpeedBtn,
                      voiceSpeed === spd && styles.settingSpeedBtnActive,
                    ]}
                    onPress={() => {
                      setVoiceSpeed(spd);
                      AsyncStorage.setItem(PREF_VOICE_SPEED, String(spd));
                    }}
                  >
                    <Text
                      style={[
                        styles.settingSpeedText,
                        voiceSpeed === spd && styles.settingSpeedTextActive,
                      ]}
                    >
                      {spd}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Auto Play Spoken Answers Toggle */}
            <View style={styles.settingItem}>
              <View style={styles.settingToggleRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingLabel}>Auto-Play Spoken Answers</Text>
                  <Text style={styles.settingSubLabel}>
                    Automatically speak assistant replies aloud in chat
                  </Text>
                </View>
                <TouchableOpacity
                  style={[
                    styles.toggleSwitch,
                    autoPlayAudio && styles.toggleSwitchActive,
                  ]}
                  onPress={() => {
                    const next = !autoPlayAudio;
                    setAutoPlayAudio(next);
                    AsyncStorage.setItem(PREF_VOICE_AUTOPLAY, String(next));
                  }}
                >
                  <View
                    style={[
                      styles.toggleKnob,
                      autoPlayAudio && styles.toggleKnobActive,
                    ]}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.settingsDoneBtn}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.settingsDoneBtnText}>Save Preferences</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 8,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#34D399" },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  liveVoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#10B981",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: "#10B981",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
    }),
  },
  liveVoiceBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1 },
  welcome: { alignItems: "center", paddingHorizontal: 20, paddingTop: 24 },
  welcomeIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    overflow: "hidden",
    marginBottom: 12,
  },
  iconGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeTitle: {
    fontSize: 19,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    textAlign: "center",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
    marginBottom: 10,
  },
  welcomeDesc: {
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: "#4B5563",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 20,
  },
  voiceHighlightBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderColor: "#DDD6FE",
    borderWidth: 1.5,
    borderRadius: 16,
    padding: 14,
    width: "100%",
    marginBottom: 24,
    ...Platform.select({
      ios: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 3px 10px rgba(124, 58, 237, 0.08)" },
    }),
  },
  voiceHighlightTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  voiceHighlightDesc: {
    fontSize: 11.5,
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 16,
  },
  voiceHighlightBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
  },
  voiceHighlightBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  tryLabel: {
    fontSize: 11.5,
    fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF",
    letterSpacing: 0.8,
    marginBottom: 12,
    alignSelf: "flex-start",
  },
  suggestions: { gap: 8, width: "100%" },
  suggestionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  suggestionEmoji: { fontSize: 16 },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#1F2937",
  },
  messages: { padding: 14, gap: 10 },
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  aiRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  bubble: { maxWidth: "84%", borderRadius: 18, padding: 13 },
  bubbleUser: { backgroundColor: "#7C3AED", borderBottomRightRadius: 4 },
  bubbleAI: {
    backgroundColor: "#fff",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#EAEAEA",
    flex: 1,
  },
  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  aiLabelTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },
  langBadge: {
    backgroundColor: "#F3E8FF",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  langBadgeText: {
    fontSize: 9.5,
    color: "#7C3AED",
    fontWeight: "700",
  },
  speakActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 8,
  },
  speakActionText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#7C3AED",
  },
  voiceNoteIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 4,
  },
  voiceNoteText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#7C3AED",
  },
  bubbleText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#1F2937",
    lineHeight: 21,
  },
  bubbleTextUser: { color: "#fff" },
  timeText: {
    fontSize: 9.5,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    marginTop: 6,
    alignSelf: "flex-end",
  },
  verifiedLinksSection: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    gap: 6,
  },
  verifiedLinksHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#4B5563",
    marginBottom: 2,
  },
  linkCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderColor: "#E2E8F0",
    borderWidth: 1,
    borderRadius: 10,
    padding: 8,
  },
  linkIconBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#ECFDF5",
    alignItems: "center",
    justifyContent: "center",
  },
  linkTitle: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#0F172A",
  },
  linkCategory: {
    fontSize: 9.5,
    color: "#64748B",
  },
  typingBubble: { paddingVertical: 12, paddingHorizontal: 16, maxWidth: 80 },
  typingWrap: { flexDirection: "row", gap: 5, alignItems: "center", height: 16 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7C3AED" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 8,
  },
  voiceInputBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  inputBox: {
    flex: 1,
    backgroundColor: "#F8F7FF",
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 13.5,
    fontFamily: "Inter_400Regular",
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#CBD5E1" },
  voiceRecordingBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  recDotRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#EF4444",
  },
  recTimerText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#DC2626",
  },
  recActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cancelRecBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  sendRecBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  disclaimer: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#9CA3AF",
    textAlign: "center",
    paddingBottom: 6,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  settingsModalCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
    gap: 16,
  },
  settingsModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  settingsModalTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#0F172A",
  },
  settingItem: {
    gap: 8,
  },
  settingLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E293B",
  },
  settingSubLabel: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  settingLangToggle: {
    flexDirection: "row",
    backgroundColor: "#F1F5F9",
    borderRadius: 12,
    padding: 3,
  },
  settingLangBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 7,
    borderRadius: 10,
  },
  settingLangBtnActive: {
    backgroundColor: "#FFFFFF",
  },
  settingLangText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#64748B",
  },
  settingLangTextActive: {
    color: "#7C3AED",
    fontWeight: "700",
  },
  settingSpeedRow: {
    flexDirection: "row",
    gap: 8,
  },
  settingSpeedBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  settingSpeedBtnActive: {
    backgroundColor: "#7C3AED",
  },
  settingSpeedText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  settingSpeedTextActive: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  settingToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  toggleSwitch: {
    width: 44,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#E2E8F0",
    padding: 2,
    justifyContent: "center",
  },
  toggleSwitchActive: {
    backgroundColor: "#10B981",
  },
  toggleKnob: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#FFFFFF",
  },
  toggleKnobActive: {
    alignSelf: "flex-end",
  },
  settingsDoneBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  settingsDoneBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
