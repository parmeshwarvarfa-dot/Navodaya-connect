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

const SUGGESTED_PROMPTS = [
  { icon: "school-outline", label: "Help me with JEE / NEET preparation", prompt: "Create a focused preparation and revision strategy for JEE and NEET for Navodaya students." },
  { icon: "compass-outline", label: "Explore career opportunities after Class 12", prompt: "Help me explore top career opportunities, competitive exams, and college options after Class 12." },
  { icon: "ribbon-outline", label: "Find scholarship opportunities", prompt: "List national and state scholarship schemes available for Navodaya students and alumni." },
  { icon: "people-outline", label: "Navodaya culture & migration exchange", prompt: "Tell me about the Class 9 migration exchange program, JNV traditions, and hostel life." },
  { icon: "bulb-outline", label: "Study roadmap & revision guidance", prompt: "How can I build an effective daily study roadmap for tough science and math concepts?" },
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
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showMenuModal, setShowMenuModal] = useState(false);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  // Settings
  const [autoPlayAudio, setAutoPlayAudio] = useState(false);
  const [voiceSpeed, setVoiceSpeed] = useState(1.0);
  const [voiceLang, setVoiceLang] = useState<"en" | "hi">("en");

  const scrollRef = useRef<ScrollView>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const typingPulse = useRef(new Animated.Value(0.3)).current;

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 12 : Math.max(insets.bottom, 12);

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

  // Subtle typing animation
  useEffect(() => {
    if (!loading) {
      typingPulse.setValue(0.3);
      return;
    }

    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(typingPulse, { toValue: 1, duration: 550, useNativeDriver: true }),
        Animated.timing(typingPulse, { toValue: 0.3, duration: 550, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [loading, typingPulse]);

  const scrollToBottom = () => {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
  };

  // Text-to-speech
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
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null),
    });
  };

  // Copy response
  const handleCopy = async (msgId: string, text: string) => {
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

  // Stop Generation
  const handleStopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
  };

  // Send message
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

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const token = await getToken();
      const response = await fetch(`${getApiOrigin()}/api/param-ai/chat`, {
        method: "POST",
        signal: controller.signal,
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

      if (autoPlayAudio) {
        handleToggleSpeakMessage(assistantMsgId, replyText, detectedLang);
      }
    } catch (error: any) {
      if (error?.name === "AbortError") {
        return;
      }
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text:
            error instanceof Error
              ? error.message
              : "Unable to reach PARAM AI service right now. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      abortControllerRef.current = null;
      scrollToBottom();
    }
  };

  // Regenerate last response
  const handleRegenerate = () => {
    if (loading || messages.length === 0) return;
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser) return;

    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.role === "assistant") {
        copy.pop();
      }
      return copy;
    });

    sendMessage(lastUser.text);
  };

  // Voice recording handlers
  const handleStartRecording = async () => {
    voiceService.cancelSpeech();
    setSpeakingMsgId(null);

    const started = await voiceService.startRecordingVoiceMessage();
    if (!started) {
      Alert.alert("Microphone Access", "Please allow microphone access to record voice queries.");
      return;
    }

    setIsRecordingVoice(true);
    setRecordingSeconds(0);
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleCancelRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    voiceService.cancelRecordingVoiceMessage();
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  };

  const handleSendVoiceRecording = async () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    const duration = recordingSeconds;
    setIsRecordingVoice(false);
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
        text: "🎙️ Spoken voice query",
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

  // Clear conversation
  const handleClearChat = () => {
    Alert.alert(
      "Clear Conversation",
      "Are you sure you want to start a fresh chat with PARAM AI?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: () => {
            voiceService.cancelSpeech();
            setSpeakingMsgId(null);
            setMessages([]);
            setShowMenuModal(false);
          },
        },
      ]
    );
  };

  // Open verified link
  const handleOpenLink = async (url: string) => {
    try {
      const validUrl = new URL(url);
      if (["http:", "https:"].includes(validUrl.protocol)) {
        await Linking.openURL(validUrl.toString());
      }
    } catch {
      Alert.alert("Link Unavailable", "Unable to open this portal link.");
    }
  };

  // Simple Markdown / Formatted Text Renderer
  const renderFormattedText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, index) => {
      const trimmed = line.trim();

      // Heading 3: ### Heading
      if (trimmed.startsWith("### ")) {
        return (
          <Text key={`line-${index}`} style={styles.mdHeading}>
            {trimmed.replace(/^###\s+/, "")}
          </Text>
        );
      }

      // Heading 2 / 1: ## or #
      if (trimmed.startsWith("## ") || trimmed.startsWith("# ")) {
        return (
          <Text key={`line-${index}`} style={styles.mdHeadingLarge}>
            {trimmed.replace(/^#+\s+/, "")}
          </Text>
        );
      }

      // Bullet list item
      if (trimmed.startsWith("- ") || trimmed.startsWith("* ") || trimmed.startsWith("• ")) {
        const itemText = trimmed.replace(/^[-*•]\s+/, "");
        return (
          <View key={`line-${index}`} style={styles.mdBulletRow}>
            <Text style={styles.mdBulletDot}>•</Text>
            <Text style={styles.mdBulletText}>{renderInlineFormatting(itemText)}</Text>
          </View>
        );
      }

      // Numbered list item
      const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <View key={`line-${index}`} style={styles.mdBulletRow}>
            <Text style={styles.mdNumberLabel}>{numMatch[1]}.</Text>
            <Text style={styles.mdBulletText}>{renderInlineFormatting(numMatch[2])}</Text>
          </View>
        );
      }

      // Empty line / paragraph break
      if (!trimmed) {
        return <View key={`line-${index}`} style={{ height: 8 }} />;
      }

      // Normal paragraph
      return (
        <Text key={`line-${index}`} style={styles.mdParagraph}>
          {renderInlineFormatting(line)}
        </Text>
      );
    });
  };

  // Helper for inline bold **text**
  const renderInlineFormatting = (str: string) => {
    const parts = str.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <Text key={`part-${i}`} style={styles.mdBold}>
            {part.slice(2, -2)}
          </Text>
        );
      }
      return part;
    });
  };

  const hasMessages = messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ── 1. Minimal Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity
          onPress={() => {
            voiceService.cancelSpeech();
            router.back();
          }}
          style={styles.headerBackBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <View style={styles.headerAvatarBadge}>
              <Text style={{ fontSize: 13 }}>🤖</Text>
            </View>
            <Text style={styles.headerTitleText}>PARAM AI</Text>
            <View style={styles.onlineDot} />
          </View>
        </View>

        {/* Clean Menu Action */}
        <TouchableOpacity
          style={styles.headerMenuBtn}
          onPress={() => setShowMenuModal(true)}
          accessibilityRole="button"
          accessibilityLabel="Options"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color="#475569" />
        </TouchableOpacity>
      </View>

      {/* ── 2. Chat Conversation Body ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.scrollArea}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomPad + 84 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasMessages ? (
          /* ── Minimal, Elegant Welcome State ── */
          <View style={styles.welcomeContainer}>
            <View style={styles.welcomeIconCircle}>
              <Text style={{ fontSize: 26 }}>🤖</Text>
            </View>
            <Text style={styles.welcomeGreeting}>What can I help you with today?</Text>
            <Text style={styles.welcomeSub}>
              Ask questions on JEE/NEET, career paths, scholarships, or Navodaya life.
            </Text>

            {/* Clean Suggested Prompt Chips */}
            <View style={styles.promptList}>
              {SUGGESTED_PROMPTS.map((item, idx) => (
                <TouchableOpacity
                  key={`prompt-${idx}`}
                  style={styles.promptChip}
                  onPress={() => sendMessage(item.prompt)}
                  activeOpacity={0.7}
                  disabled={loading}
                >
                  <Ionicons name={item.icon as any} size={15} color="#7C3AED" style={{ marginRight: 8 }} />
                  <Text style={styles.promptChipText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={14} color="#94A3B8" style={{ marginLeft: "auto" }} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          /* ── Natural Conversation Messages ── */
          <View style={styles.messagesContainer}>
            {messages.map((msg, index) => {
              const isUser = msg.role === "user";
              const isSpeaking = speakingMsgId === msg.id;

              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    isUser ? styles.userMessageRow : styles.assistantMessageRow,
                  ]}
                >
                  {/* Assistant Avatar */}
                  {!isUser && (
                    <View style={styles.assistantAvatar}>
                      <Text style={{ fontSize: 12 }}>🤖</Text>
                    </View>
                  )}

                  <View style={[styles.messageContentWrap, isUser && styles.userContentWrap]}>
                    {/* Message Bubble or Plain Text */}
                    {isUser ? (
                      <View style={styles.userBubble}>
                        <Text style={styles.userText}>{msg.text}</Text>
                        <Text style={styles.userTimestamp}>
                          {formatTime(new Date(msg.timestamp))}
                        </Text>
                      </View>
                    ) : (
                      <View style={styles.assistantDirectTextWrap}>
                        {/* Formatted Markdown Content directly on clean background */}
                        {renderFormattedText(msg.text)}

                        {/* Compact Verified Sources Section */}
                        {msg.verifiedLinks && msg.verifiedLinks.length > 0 && (
                          <View style={styles.sourcesContainer}>
                            <Text style={styles.sourcesHeading}>Official sources</Text>
                            <View style={styles.sourcesRow}>
                              {msg.verifiedLinks.map((link) => (
                                <TouchableOpacity
                                  key={link.url}
                                  style={styles.sourcePill}
                                  onPress={() => handleOpenLink(link.url)}
                                  activeOpacity={0.75}
                                >
                                  <Ionicons name="link-outline" size={12} color="#7C3AED" />
                                  <Text style={styles.sourcePillText} numberOfLines={1}>
                                    {link.title}
                                  </Text>
                                  <Ionicons name="open-outline" size={11} color="#64748B" />
                                </TouchableOpacity>
                              ))}
                            </View>
                          </View>
                        )}

                        {/* Unobtrusive Assistant Actions */}
                        <View style={styles.assistantActionsBar}>
                          {/* Copy */}
                          <TouchableOpacity
                            onPress={() => handleCopy(msg.id, msg.text)}
                            style={styles.subtleActionBtn}
                            accessibilityLabel="Copy response"
                          >
                            <Ionicons
                              name={copiedId === msg.id ? "checkmark" : "copy-outline"}
                              size={15}
                              color={copiedId === msg.id ? "#10B981" : "#64748B"}
                            />
                            {copiedId === msg.id && (
                              <Text style={styles.copiedHint}>Copied</Text>
                            )}
                          </TouchableOpacity>

                          {/* Read Aloud */}
                          <TouchableOpacity
                            onPress={() =>
                              handleToggleSpeakMessage(
                                msg.id,
                                msg.text,
                                msg.detectedLanguage
                              )
                            }
                            style={styles.subtleActionBtn}
                            accessibilityLabel={isSpeaking ? "Stop speaking" : "Read aloud"}
                          >
                            <Ionicons
                              name={isSpeaking ? "volume-mute-outline" : "volume-medium-outline"}
                              size={16}
                              color={isSpeaking ? "#7C3AED" : "#64748B"}
                            />
                          </TouchableOpacity>

                          {/* Regenerate (if last message) */}
                          {index === messages.length - 1 && !loading && (
                            <TouchableOpacity
                              onPress={handleRegenerate}
                              style={styles.subtleActionBtn}
                              accessibilityLabel="Regenerate"
                            >
                              <Ionicons name="refresh-outline" size={15} color="#64748B" />
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </View>
              );
            })}

            {/* Subtle Typing / Thinking Indicator */}
            {loading && (
              <View style={[styles.messageRow, styles.assistantMessageRow]}>
                <View style={styles.assistantAvatar}>
                  <Text style={{ fontSize: 12 }}>🤖</Text>
                </View>
                <Animated.View style={[styles.typingWrap, { opacity: typingPulse }]}>
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                  <View style={styles.typingDot} />
                </Animated.View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── 3. Clean Message Composer ── */}
      <View style={[styles.composerWrap, { paddingBottom: bottomPad }]}>
        {isRecordingVoice ? (
          /* Voice Recording Active Bar */
          <View style={styles.recordingBar}>
            <View style={styles.recordingRedDot} />
            <Text style={styles.recordingTimerText}>Listening... {recordingSeconds}s</Text>
            <TouchableOpacity onPress={handleCancelRecording} style={styles.recordingIconBtn}>
              <Ionicons name="close" size={18} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSendVoiceRecording} style={styles.recordingSendBtn}>
              <Ionicons name="arrow-up" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Modern Floating Input Field */
          <View style={styles.composerBar}>
            <TextInput
              style={styles.composerInput}
              placeholder="Ask PARAM AI anything..."
              placeholderTextColor="#94A3B8"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={2500}
              editable={!loading}
            />

            {/* Microphone Button (Tap to record or hold) */}
            {!input.trim() && (
              <TouchableOpacity
                onPress={handleStartRecording}
                onLongPress={() => setShowVoiceModal(true)}
                style={styles.composerMicBtn}
                accessibilityLabel="Speak"
              >
                <Ionicons name="mic-outline" size={20} color="#64748B" />
              </TouchableOpacity>
            )}

            {/* Send or Stop Generation Button */}
            {loading ? (
              <TouchableOpacity
                onPress={handleStopGeneration}
                style={styles.composerStopBtn}
                accessibilityLabel="Stop generation"
              >
                <View style={styles.stopSquare} />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => sendMessage(input)}
                disabled={!input.trim()}
                style={[
                  styles.composerSendBtn,
                  input.trim() ? styles.composerSendBtnActive : styles.composerSendBtnDisabled,
                ]}
                accessibilityLabel="Send"
              >
                <Ionicons
                  name="arrow-up"
                  size={16}
                  color={input.trim() ? "#FFFFFF" : "#CBD5E1"}
                />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* ── 4. Full Voice Mode (Modal) ── */}
      <ParamVoiceModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSendMessageFromVoice={(u, a) => {
          const now = new Date();
          setMessages((prev) => [
            ...prev,
            { id: `${Date.now()}-u`, role: "user", text: u, timestamp: now },
            { id: `${Date.now()}-a`, role: "assistant", text: a, timestamp: new Date(now.getTime() + 100) },
          ]);
          scrollToBottom();
        }}
        conversationHistory={messages.map((m) => ({ role: m.role, text: m.text }))}
        initialLanguage={voiceLang}
      />

      {/* ── 5. Clean Settings & Menu Modal ── */}
      <Modal
        visible={showMenuModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowMenuModal(false)}
      >
        <TouchableOpacity
          style={styles.menuOverlay}
          activeOpacity={1}
          onPress={() => setShowMenuModal(false)}
        >
          <View style={styles.menuCard}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>PARAM AI Options</Text>
              <TouchableOpacity onPress={() => setShowMenuModal(false)}>
                <Ionicons name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {/* Launch Full Screen Voice Mode */}
            <TouchableOpacity
              style={styles.menuItemRow}
              onPress={() => {
                setShowMenuModal(false);
                setShowVoiceModal(true);
              }}
            >
              <Ionicons name="mic-circle-outline" size={20} color="#7C3AED" />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.menuItemTitle}>Live Two-Way Voice Mode</Text>
                <Text style={styles.menuItemSub}>Hands-free continuous conversation</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
            </TouchableOpacity>

            {/* Language Selection */}
            <View style={styles.menuDivider} />
            <Text style={styles.menuSectionHeading}>Language</Text>
            <View style={styles.langSelectionRow}>
              {(["en", "hi"] as const).map((l) => (
                <TouchableOpacity
                  key={l}
                  style={[styles.langBtn, voiceLang === l && styles.langBtnActive]}
                  onPress={() => {
                    setVoiceLang(l);
                    AsyncStorage.setItem(PREF_VOICE_LANG, l);
                  }}
                >
                  <Text style={[styles.langBtnText, voiceLang === l && styles.langBtnTextActive]}>
                    {l === "en" ? "English" : "हिंदी"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Auto Read Aloud Toggle */}
            <View style={styles.menuDivider} />
            <View style={styles.menuToggleRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.menuItemTitle}>Read responses aloud</Text>
                <Text style={styles.menuItemSub}>Automatically speak answers</Text>
              </View>
              <TouchableOpacity
                style={[styles.togglePill, autoPlayAudio && styles.togglePillActive]}
                onPress={() => {
                  const next = !autoPlayAudio;
                  setAutoPlayAudio(next);
                  AsyncStorage.setItem(PREF_VOICE_AUTOPLAY, String(next));
                }}
              >
                <View style={[styles.toggleThumb, autoPlayAudio && styles.toggleThumbActive]} />
              </TouchableOpacity>
            </View>

            {/* Clear Conversation */}
            {hasMessages && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.clearChatRow} onPress={handleClearChat}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                  <Text style={styles.clearChatText}>Clear Conversation History</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  // 1. Header
  header: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    zIndex: 10,
  },
  headerBackBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
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
  headerAvatarBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  onlineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  headerMenuBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },

  // 2. Scroll Area
  scrollArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // Welcome State
  welcomeContainer: {
    alignItems: "center",
    paddingTop: 40,
    paddingHorizontal: 12,
  },
  welcomeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  welcomeGreeting: {
    fontSize: 20,
    fontWeight: "600",
    color: "#0F172A",
    textAlign: "center",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  welcomeSub: {
    fontSize: 13.5,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
    marginBottom: 28,
  },
  promptList: {
    width: "100%",
    maxWidth: 420,
    gap: 10,
  },
  promptChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: "#F1F5F9",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  promptChipText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#1E293B",
  },

  // Messages
  messagesContainer: {
    gap: 20,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  userMessageRow: {
    justifyContent: "flex-end",
  },
  assistantMessageRow: {
    justifyContent: "flex-start",
  },
  assistantAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  messageContentWrap: {
    flex: 1,
  },
  userContentWrap: {
    flex: 0,
    maxWidth: "80%",
    alignSelf: "flex-end",
  },

  // User Bubble
  userBubble: {
    backgroundColor: "#7C3AED",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  userText: {
    fontSize: 14.5,
    color: "#FFFFFF",
    lineHeight: 21,
  },
  userTimestamp: {
    fontSize: 10,
    color: "rgba(255, 255, 255, 0.65)",
    alignSelf: "flex-end",
    marginTop: 4,
  },

  // Assistant Direct Text (No heavy card background!)
  assistantDirectTextWrap: {
    paddingRight: 6,
  },

  // Markdown Typography
  mdHeadingLarge: {
    fontSize: 16.5,
    fontWeight: "700",
    color: "#0F172A",
    marginTop: 10,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  mdHeading: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
    marginTop: 8,
    marginBottom: 4,
  },
  mdParagraph: {
    fontSize: 14.5,
    color: "#334155",
    lineHeight: 22.5,
  },
  mdBold: {
    fontWeight: "600",
    color: "#0F172A",
  },
  mdBulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 2.5,
    paddingLeft: 4,
  },
  mdBulletDot: {
    fontSize: 14,
    color: "#7C3AED",
    marginRight: 8,
    lineHeight: 22,
  },
  mdNumberLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7C3AED",
    marginRight: 6,
    lineHeight: 22,
  },
  mdBulletText: {
    flex: 1,
    fontSize: 14.5,
    color: "#334155",
    lineHeight: 22,
  },

  // Sources
  sourcesContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  sourcesHeading: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sourcesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  sourcePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
    maxWidth: 220,
  },
  sourcePillText: {
    fontSize: 11.5,
    color: "#334155",
    fontWeight: "500",
  },

  // Assistant Action Bar
  assistantActionsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 10,
  },
  subtleActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 4,
    gap: 4,
  },
  copiedHint: {
    fontSize: 11,
    color: "#10B981",
    fontWeight: "500",
  },

  // Typing
  typingWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7C3AED",
  },

  // 3. Composer
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 8,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  composerBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 24,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minHeight: 46,
  },
  composerInput: {
    flex: 1,
    fontSize: 14.5,
    color: "#0F172A",
    maxHeight: 120,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  composerMicBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  composerSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  composerSendBtnActive: {
    backgroundColor: "#7C3AED",
  },
  composerSendBtnDisabled: {
    backgroundColor: "#F1F5F9",
  },
  composerStopBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#1E293B",
    alignItems: "center",
    justifyContent: "center",
  },
  stopSquare: {
    width: 10,
    height: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 2,
  },

  // Recording Bar
  recordingBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 7,
    gap: 8,
  },
  recordingRedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#EF4444",
  },
  recordingTimerText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "500",
    color: "#B91C1C",
  },
  recordingIconBtn: {
    padding: 4,
  },
  recordingSendBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },

  // 5. Menu Modal
  menuOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
    paddingBottom: 32,
  },
  menuHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0F172A",
  },
  menuItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  menuItemTitle: {
    fontSize: 14,
    fontWeight: "500",
    color: "#0F172A",
  },
  menuItemSub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  menuDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    marginVertical: 10,
  },
  menuSectionHeading: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    textTransform: "uppercase",
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  langSelectionRow: {
    flexDirection: "row",
    gap: 8,
  },
  langBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
  },
  langBtnActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#7C3AED",
  },
  langBtnText: {
    fontSize: 13,
    color: "#475569",
    fontWeight: "500",
  },
  langBtnTextActive: {
    color: "#7C3AED",
    fontWeight: "600",
  },
  menuToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  togglePill: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#E2E8F0",
    padding: 2,
    justifyContent: "center",
  },
  togglePillActive: {
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
  clearChatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },
  clearChatText: {
    fontSize: 13.5,
    fontWeight: "500",
    color: "#EF4444",
  },
});
