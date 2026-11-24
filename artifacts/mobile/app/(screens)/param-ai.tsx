import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import { getApiOrigin, getToken } from "@/lib/api";
import { voiceService } from "@/lib/voiceService";
import ParamVoiceModal from "@/components/param/ParamVoiceModal";
import ParamAiOrb from "@/components/param/ParamAiOrb";

// ── Types ───────────────────────────────────────────────────────────────────
interface VerifiedLink {
  title: string;
  url: string;
  category: string;
  badge?: string;
}

interface SelectedAttachment {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  base64: string;
  uri?: string;
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
  attachments?: Array<{ name: string; size: number; mimeType: string }>;
}

// ── Categories & Discovery Prompts ──────────────────────────────────────────
const QUICK_ACTIONS = [
  { id: "all", label: "All Topics", icon: "sparkles" as const },
  { id: "jee-neet", label: "JEE / NEET", icon: "school-outline" as const },
  { id: "competitive", label: "UPSC / Exams", icon: "trophy-outline" as const },
  { id: "career", label: "Career Guide", icon: "compass-outline" as const },
  { id: "scholarships", label: "Scholarships", icon: "ribbon-outline" as const },
  { id: "navodaya", label: "Navodaya Life", icon: "heart-outline" as const },
  { id: "study", label: "Study & Notes", icon: "book-outline" as const },
];

const DISCOVERY_PROMPTS = [
  {
    category: "jee-neet",
    tag: "JEE Main & Advanced",
    icon: "calculator-outline" as const,
    prompt: "Create a 6-month JEE preparation strategy with a realistic daily routine for a Navodaya student.",
  },
  {
    category: "jee-neet",
    tag: "NEET UG",
    icon: "medkit-outline" as const,
    prompt: "What is the best NCERT-focused biology and physics revision roadmap for NEET UG?",
  },
  {
    category: "competitive",
    tag: "Civil Services",
    icon: "shield-checkmark-outline" as const,
    prompt: "How can JNV alumni prepare for UPSC Civil Services alongside college or a full-time job?",
  },
  {
    category: "career",
    tag: "Career Pathways",
    icon: "briefcase-outline" as const,
    prompt: "Help me explore top engineering, medical, and emerging career opportunities after Class 12.",
  },
  {
    category: "scholarships",
    tag: "Scholarships & Grants",
    icon: "cash-outline" as const,
    prompt: "List all major national and private scholarships available for Navodaya students.",
  },
  {
    category: "navodaya",
    tag: "JNV Culture",
    icon: "people-outline" as const,
    prompt: "नवोदय विद्यालय की अनूठी परंपराओं, हाउस व्यवस्था और माइग्रेशन एक्सचेंज के बारे में बताएं।",
  },
  {
    category: "study",
    tag: "Conceptual Clarity",
    icon: "bulb-outline" as const,
    prompt: "Explain Quantum Entanglement and wave-particle duality simply with everyday examples.",
  },
];

const DOCUMENT_SUGGESTIONS = [
  { label: "Summarize this document", prompt: "Please provide a comprehensive summary of this document with key takeaways and structured points." },
  { label: "Explain key concepts", prompt: "Explain the main concepts and terminology from this file in simple, easy-to-understand language." },
  { label: "Generate study notes", prompt: "Convert this document into concise revision notes and bulleted highlights for exam preparation." },
  { label: "Create practice questions", prompt: "Generate 5 conceptual practice questions with detailed answers based on this uploaded material." },
];

const PREF_VOICE_AUTOPLAY = "@param_voice_autoplay";
const PREF_VOICE_SPEED = "@param_voice_speed";
const PREF_VOICE_LANG = "@param_voice_lang";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getFileIcon(name: string, mime: string): keyof typeof Ionicons.glyphMap {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf" || mime.includes("pdf")) return "document-text";
  if (["jpg", "jpeg", "png", "webp", "gif"].includes(ext) || mime.startsWith("image/")) return "image";
  if (["doc", "docx"].includes(ext) || mime.includes("word")) return "document";
  if (["xls", "xlsx", "csv"].includes(ext) || mime.includes("sheet") || mime.includes("csv")) return "grid";
  if (["ppt", "pptx"].includes(ext) || mime.includes("presentation")) return "easel";
  if (["mp3", "wav", "m4a", "webm"].includes(ext) || mime.startsWith("audio/")) return "musical-notes";
  return "document-attach";
}

// ── Lightweight Rich Markdown & Content Formatter ───────────────────────────
function RenderMarkdownContent({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <View style={styles.markdownContainer}>
      {lines.map((line, idx) => {
        const trimmed = line.trim();

        // Empty line
        if (!trimmed) {
          return <View key={idx} style={{ height: 8 }} />;
        }

        // Heading 1 / 2 / 3
        if (trimmed.startsWith("### ")) {
          return (
            <Text key={idx} style={styles.mdHeading3}>
              {trimmed.replace(/^###\s+/, "")}
            </Text>
          );
        }
        if (trimmed.startsWith("## ")) {
          return (
            <Text key={idx} style={styles.mdHeading2}>
              {trimmed.replace(/^##\s+/, "")}
            </Text>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <Text key={idx} style={styles.mdHeading1}>
              {trimmed.replace(/^#\s+/, "")}
            </Text>
          );
        }

        // Bullet point
        if (trimmed.startsWith("* ") || trimmed.startsWith("- ") || trimmed.startsWith("• ")) {
          const content = trimmed.replace(/^[\*\-•]\s+/, "");
          return (
            <View key={idx} style={styles.bulletRow}>
              <View style={styles.bulletDot} />
              <Text style={styles.bulletText}>{renderFormattedSpans(content)}</Text>
            </View>
          );
        }

        // Numbered list
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)/);
        if (numMatch) {
          return (
            <View key={idx} style={styles.numberedRow}>
              <Text style={styles.numberedIndex}>{numMatch[1]}.</Text>
              <Text style={styles.numberedText}>{renderFormattedSpans(numMatch[2])}</Text>
            </View>
          );
        }

        // Blockquote
        if (trimmed.startsWith("> ")) {
          return (
            <View key={idx} style={styles.blockquote}>
              <Text style={styles.blockquoteText}>
                {renderFormattedSpans(trimmed.replace(/^>\s+/, ""))}
              </Text>
            </View>
          );
        }

        // Standard Paragraph
        return (
          <Text key={idx} style={styles.mdParagraph} selectable>
            {renderFormattedSpans(trimmed)}
          </Text>
        );
      })}
    </View>
  );
}

function renderFormattedSpans(text: string) {
  // Simple bold and inline code span formatting
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);

  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={styles.boldText}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <Text key={i} style={styles.inlineCode}>
          {part.slice(1, -1)}
        </Text>
      );
    }
    return part;
  });
}

// ── Main PARAM AI Screen Component ──────────────────────────────────────────
export default function ParamAIScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [showVoiceModal, setShowVoiceModal] = useState(false);
  const [speakingMsgId, setSpeakingMsgId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [feedbackState, setFeedbackState] = useState<Record<string, "up" | "down">>({});

  // Multimodal file upload state
  const [selectedAttachments, setSelectedAttachments] = useState<SelectedAttachment[]>([]);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

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

  const topPad = Platform.OS === "web" ? 12 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom;

  // Restore voice preferences
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

  // Save voice preferences
  const updateSettings = async (autoPlay: boolean, speed: number, lang: "en" | "hi") => {
    setAutoPlayAudio(autoPlay);
    setVoiceSpeed(speed);
    setVoiceLang(lang);
    await AsyncStorage.setItem(PREF_VOICE_AUTOPLAY, autoPlay ? "true" : "false");
    await AsyncStorage.setItem(PREF_VOICE_SPEED, speed.toString());
    await AsyncStorage.setItem(PREF_VOICE_LANG, lang);
  };

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
      onEnd: () => setSpeakingMsgId(null),
      onError: () => setSpeakingMsgId(null),
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

  // Feedback thumb action
  const handleFeedback = (msgId: string, type: "up" | "down") => {
    setFeedbackState((prev) => ({
      ...prev,
      [msgId]: prev[msgId] === type ? undefined! : type,
    }));
  };

  // Native Multimodal File Picker
  const handlePickDocument = async () => {
    try {
      setIsProcessingFile(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "image/*",
          "text/*",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          "*/*",
        ],
        copyToCacheDirectory: true,
        multiple: true,
      });

      if (result.canceled || !result.assets?.length) {
        setIsProcessingFile(false);
        return;
      }

      const newAttachments: SelectedAttachment[] = [];
      for (const file of result.assets) {
        if (file.size && file.size > 25 * 1024 * 1024) {
          Alert.alert("File Too Large", `"${file.name}" exceeds the 25 MB limit.`);
          continue;
        }

        try {
          const res = await fetch(file.uri);
          const blob = await res.blob();
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              const dataUrl = reader.result as string;
              resolve(dataUrl.split(",")[1] || "");
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });

          if (base64) {
            newAttachments.push({
              id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
              name: file.name,
              size: file.size || 0,
              mimeType: file.mimeType || "application/octet-stream",
              base64,
              uri: file.uri,
            });
          }
        } catch (err) {
          console.warn("Base64 reading error for file:", file.name, err);
        }
      }

      if (newAttachments.length > 0) {
        setSelectedAttachments((prev) => [...prev, ...newAttachments].slice(0, 5));
      }
    } catch {
      Alert.alert("File Picker", "Could not open document picker. Please try again.");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleRemoveAttachment = (id: string) => {
    setSelectedAttachments((prev) => prev.filter((a) => a.id !== id));
  };

  // Send message with optional multimodal attachments
  const sendMessage = async (text: string, overrideAttachments?: SelectedAttachment[]) => {
    const trimmed = text.trim();
    const attachmentsToSend = overrideAttachments || selectedAttachments;

    if ((!trimmed && attachmentsToSend.length === 0) || loading) return;

    voiceService.cancelSpeech();
    setSpeakingMsgId(null);

    const userMsgText = trimmed || `Please analyze this attached ${attachmentsToSend.length > 1 ? "collection of files" : "file"}.`;

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text: userMsgText,
      timestamp: new Date(),
      attachments: attachmentsToSend.map((a) => ({
        name: a.name,
        size: a.size,
        mimeType: a.mimeType,
      })),
    };

    const historyPayload = messages.slice(-8).map(({ role, text: msgText }) => ({
      role,
      text: msgText,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setSelectedAttachments([]);
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
          attachments: attachmentsToSend.map((a) => ({
            name: a.name,
            mimeType: a.mimeType,
            size: a.size,
            base64: a.base64,
          })),
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

    setMessages((prev) => {
      const copy = [...prev];
      if (copy[copy.length - 1]?.role === "assistant") {
        copy.pop();
      }
      return copy;
    });

    await sendMessage(lastUserMsg.text);
  };

  // Start recording voice message in composer
  const handleStartVoiceRecording = async () => {
    voiceService.cancelSpeech();
    setSpeakingMsgId(null);

    const started = await voiceService.startRecordingVoiceMessage();
    if (!started) {
      Alert.alert("Microphone Required", "Please allow microphone access to record voice messages.");
      return;
    }

    setIsRecordingVoiceMsg(true);
    setRecordingSeconds(0);

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const handleCancelVoiceRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    voiceService.cancelRecordingVoiceMessage();
    setIsRecordingVoiceMsg(false);
    setRecordingSeconds(0);
  };

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

  const handleClearChat = () => {
    Alert.alert(
      "New Conversation",
      "Do you want to reset your conversation with PARAM AI?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Start New",
          style: "destructive",
          onPress: () => {
            voiceService.cancelSpeech();
            setSpeakingMsgId(null);
            setMessages([]);
            setSelectedAttachments([]);
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
      {/* ── 1. Compact, Modern Navodaya Header ── */}
      <View style={[styles.header, { paddingTop: topPad + 6 }]}>
        <TouchableOpacity
          onPress={() => {
            voiceService.cancelSpeech();
            router.back();
          }}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={20} color="#1E1B4B" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>PARAM AI 🤖</Text>
            <View style={styles.onlineDot} />
          </View>
          <Text style={styles.headerSubtitle}>Navodaya AI Companion</Text>
        </View>

        <View style={styles.headerRightActions}>
          {/* Live Voice Launch Button */}
          <TouchableOpacity
            style={styles.liveVoiceBtn}
            onPress={() => {
              voiceService.cancelSpeech();
              setSpeakingMsgId(null);
              setShowVoiceModal(true);
            }}
            accessibilityRole="button"
            accessibilityLabel="Launch Live Voice"
          >
            <Ionicons name="mic" size={14} color="#7C3AED" />
            <Text style={styles.liveVoiceBtnText}>Voice</Text>
          </TouchableOpacity>

          {/* New Chat Button */}
          {hasMessages && (
            <TouchableOpacity
              style={styles.iconBtn}
              onPress={handleClearChat}
              accessibilityRole="button"
              accessibilityLabel="New conversation"
            >
              <Ionicons name="create-outline" size={19} color="#7C3AED" />
            </TouchableOpacity>
          )}

          {/* Settings Button */}
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => setShowSettingsModal(true)}
            accessibilityRole="button"
            accessibilityLabel="PARAM AI Settings"
          >
            <Ionicons name="settings-outline" size={19} color="#64748B" />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── 2. Scrollable Body ── */}
      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[
          styles.bodyContent,
          { paddingBottom: bottomPad + 120 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasMessages ? (
          /* ── Welcome Screen ── */
          <View style={styles.welcomeSection}>
            <View style={styles.orbWrapper}>
              <ParamAiOrb size={82} state={loading ? "thinking" : isRecordingVoiceMsg ? "listening" : "idle"} />
            </View>

            <Text style={styles.welcomeHeading}>PARAM AI 🤖</Text>
            <Text style={styles.welcomeTagline}>Your Navodaya AI Companion</Text>
            <Text style={styles.welcomeDescription}>
              Your companion for learning, competitive exam guidance, document analysis, and exploring the Navodaya community.
            </Text>

            {/* Quick Action Filter Chips */}
            <View style={styles.sectionHeadingRow}>
              <Text style={styles.sectionHeading}>Explore Topics</Text>
            </View>
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
                      size={14}
                      color={isActive ? "#FFFFFF" : "#7C3AED"}
                      style={{ marginRight: 6 }}
                    />
                    <Text style={[styles.categoryChipText, isActive && styles.categoryChipTextActive]}>
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Discovery Prompt Cards */}
            <View style={styles.promptCardsContainer}>
              {filteredPrompts.map((item, idx) => (
                <TouchableOpacity
                  key={`prompt-${idx}`}
                  style={styles.promptCard}
                  onPress={() => sendMessage(item.prompt)}
                  activeOpacity={0.8}
                  disabled={loading}
                >
                  <View style={styles.promptCardTop}>
                    <View style={styles.promptBadge}>
                      <Ionicons name={item.icon} size={13} color="#7C3AED" style={{ marginRight: 5 }} />
                      <Text style={styles.promptBadgeText}>{item.tag}</Text>
                    </View>
                    <Ionicons name="arrow-forward" size={15} color="#7C3AED" />
                  </View>
                  <Text style={styles.promptText}>{item.prompt}</Text>
                </TouchableOpacity>
              ))}

              {/* Upload Document Highlight Card */}
              <TouchableOpacity
                style={[styles.promptCard, styles.uploadPromptCard]}
                onPress={handlePickDocument}
                activeOpacity={0.8}
              >
                <View style={styles.promptCardTop}>
                  <View style={[styles.promptBadge, { backgroundColor: "#F5F3FF" }]}>
                    <Ionicons name="document-attach" size={14} color="#7C3AED" style={{ marginRight: 5 }} />
                    <Text style={styles.promptBadgeText}>Multimodal Document Analysis</Text>
                  </View>
                  <Ionicons name="cloud-upload-outline" size={16} color="#7C3AED" />
                </View>
                <Text style={styles.promptText}>
                  Upload PDFs, Word docs, spreadsheets, or problem photos for instant step-by-step solutions and revision notes.
                </Text>
              </TouchableOpacity>
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
                  style={[styles.messageWrapper, isUser ? styles.userWrapper : styles.aiWrapper]}
                >
                  {/* User message: Right-aligned lavender card */}
                  {isUser ? (
                    <View style={styles.userBubble}>
                      {msg.attachments && msg.attachments.length > 0 && (
                        <View style={styles.attachedPillGroup}>
                          {msg.attachments.map((att, attIdx) => (
                            <View key={attIdx} style={styles.attachedUserPill}>
                              <Ionicons
                                name={getFileIcon(att.name, att.mimeType)}
                                size={12}
                                color="#7C3AED"
                                style={{ marginRight: 4 }}
                              />
                              <Text style={styles.attachedUserPillText} numberOfLines={1}>
                                {att.name} ({formatFileSize(att.size)})
                              </Text>
                            </View>
                          ))}
                        </View>
                      )}
                      <Text style={styles.userMessageText} selectable>
                        {msg.text}
                      </Text>
                      <Text style={styles.userTimestamp}>{formatTime(new Date(msg.timestamp))}</Text>
                    </View>
                  ) : (
                    /* AI message: Clean natural layout without heavy borders */
                    <View style={styles.aiContentContainer}>
                      <View style={styles.aiMetaRow}>
                        <View style={styles.aiIdentityRow}>
                          <View style={styles.aiAvatarSmall}>
                            <Text style={{ fontSize: 11 }}>🤖</Text>
                          </View>
                          <Text style={styles.aiAuthorName}>PARAM AI</Text>
                          {msg.detectedLanguage === "hi" && (
                            <View style={styles.langBadge}>
                              <Text style={styles.langBadgeText}>हिंदी</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.aiTimestamp}>{formatTime(new Date(msg.timestamp))}</Text>
                      </View>

                      {/* Render formatted markdown content */}
                      <RenderMarkdownContent text={msg.text} />

                      {/* Verified Sources */}
                      {msg.verifiedLinks && msg.verifiedLinks.length > 0 && (
                        <View style={styles.sourcesContainer}>
                          <View style={styles.sourcesHeader}>
                            <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                            <Text style={styles.sourcesTitle}>Verified Official Sources</Text>
                          </View>
                          {msg.verifiedLinks.map((link) => (
                            <TouchableOpacity
                              key={link.url}
                              style={styles.sourceItem}
                              onPress={() => handleOpenVerifiedLink(link.url)}
                              activeOpacity={0.7}
                            >
                              <View style={{ flex: 1 }}>
                                <Text style={styles.sourceItemTitle} numberOfLines={1}>
                                  {link.title}
                                </Text>
                                <Text style={styles.sourceItemBadge}>{link.badge || link.category}</Text>
                              </View>
                              <Ionicons name="open-outline" size={14} color="#7C3AED" />
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      {/* Message Actions */}
                      <View style={styles.messageActionsBar}>
                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleCopyMessage(msg.id, msg.text)}
                          accessibilityLabel="Copy response"
                        >
                          <Ionicons
                            name={copiedId === msg.id ? "checkmark" : "copy-outline"}
                            size={14}
                            color={copiedId === msg.id ? "#10B981" : "#64748B"}
                          />
                          <Text style={[styles.actionBtnText, copiedId === msg.id && { color: "#10B981" }]}>
                            {copiedId === msg.id ? "Copied" : "Copy"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleToggleSpeakMessage(msg.id, msg.text, msg.detectedLanguage)}
                          accessibilityLabel={isSpeaking ? "Stop speaking" : "Listen aloud"}
                        >
                          <Ionicons
                            name={isSpeaking ? "volume-mute" : "volume-medium-outline"}
                            size={14}
                            color={isSpeaking ? "#EC4899" : "#64748B"}
                          />
                          <Text style={[styles.actionBtnText, isSpeaking && { color: "#EC4899" }]}>
                            {isSpeaking ? "Stop" : "Read"}
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleFeedback(msg.id, "up")}
                          accessibilityLabel="Helpful"
                        >
                          <Ionicons
                            name={feedbackState[msg.id] === "up" ? "thumbs-up" : "thumbs-up-outline"}
                            size={14}
                            color={feedbackState[msg.id] === "up" ? "#7C3AED" : "#64748B"}
                          />
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.actionBtn}
                          onPress={() => handleFeedback(msg.id, "down")}
                          accessibilityLabel="Not helpful"
                        >
                          <Ionicons
                            name={feedbackState[msg.id] === "down" ? "thumbs-down" : "thumbs-down-outline"}
                            size={14}
                            color={feedbackState[msg.id] === "down" ? "#EF4444" : "#64748B"}
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* Thinking Indicator */}
            {loading && (
              <View style={styles.thinkingRow}>
                <View style={styles.aiAvatarSmall}>
                  <Text style={{ fontSize: 11 }}>🤖</Text>
                </View>
                <Animated.View style={[styles.thinkingCard, { opacity: typingPulse }]}>
                  <View style={styles.thinkingDot} />
                  <View style={[styles.thinkingDot, { animationDelay: "150ms" } as any]} />
                  <View style={[styles.thinkingDot, { animationDelay: "300ms" } as any]} />
                  <Text style={styles.thinkingText}>PARAM AI is formulating your response...</Text>
                </Animated.View>
              </View>
            )}

            {/* Regenerate Response Action */}
            {hasMessages && !loading && (
              <TouchableOpacity
                style={styles.regenerateContainer}
                onPress={handleRegenerate}
                activeOpacity={0.75}
              >
                <Ionicons name="refresh-outline" size={14} color="#7C3AED" />
                <Text style={styles.regenerateText}>Regenerate Response</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── 3. Modern, Minimal Message Composer ── */}
      <View style={[styles.composerContainer, { paddingBottom: Math.max(bottomPad, 12) }]}>
        {/* Selected Attachments Tray */}
        {selectedAttachments.length > 0 && (
          <View style={styles.attachmentTray}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.attachmentScroll}>
              {selectedAttachments.map((att) => (
                <View key={att.id} style={styles.attachmentChip}>
                  <Ionicons name={getFileIcon(att.name, att.mimeType)} size={15} color="#7C3AED" />
                  <View style={styles.attachmentInfo}>
                    <Text style={styles.attachmentName} numberOfLines={1}>
                      {att.name}
                    </Text>
                    <Text style={styles.attachmentSize}>{formatFileSize(att.size)}</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRemoveAttachment(att.id)}
                    style={styles.removeAttBtn}
                    accessibilityLabel={`Remove ${att.name}`}
                  >
                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>

            {/* Quick Document Action Suggestions */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.docSuggestionsScroll}>
              {DOCUMENT_SUGGESTIONS.map((sug, sIdx) => (
                <TouchableOpacity
                  key={sIdx}
                  style={styles.docSuggestionPill}
                  onPress={() => sendMessage(sug.prompt)}
                  disabled={loading}
                >
                  <Ionicons name="sparkles" size={11} color="#7C3AED" style={{ marginRight: 4 }} />
                  <Text style={styles.docSuggestionText}>{sug.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {isRecordingVoiceMsg ? (
          /* Voice recording active state */
          <View style={styles.recordingRow}>
            <View style={styles.recordingRedDot} />
            <Text style={styles.recordingTimerText}>Recording voice... {recordingSeconds}s</Text>
            <TouchableOpacity onPress={handleCancelVoiceRecording} style={styles.recActionBtn}>
              <Ionicons name="trash-outline" size={19} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSendVoiceRecording} style={styles.recSendBtn}>
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        ) : (
          /* Normal Composer Row */
          <View style={styles.composerRow}>
            {/* Attachment Button */}
            <TouchableOpacity
              style={styles.composerIconBtn}
              onPress={handlePickDocument}
              disabled={loading || isProcessingFile}
              accessibilityLabel="Attach document or image"
            >
              {isProcessingFile ? (
                <ActivityIndicator size="small" color="#7C3AED" />
              ) : (
                <Ionicons name="attach" size={22} color="#7C3AED" />
              )}
            </TouchableOpacity>

            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder={
                selectedAttachments.length > 0
                  ? "Ask anything about this document..."
                  : "Ask PARAM AI anything..."
              }
              placeholderTextColor="#94A3B8"
              value={input}
              onChangeText={setInput}
              multiline
              maxLength={4000}
              editable={!loading}
            />

            {/* Voice Message Recorder (if input empty) */}
            {!input.trim() && selectedAttachments.length === 0 && (
              <TouchableOpacity
                style={styles.composerIconBtn}
                onPress={handleStartVoiceRecording}
                disabled={loading}
                accessibilityLabel="Record voice message"
              >
                <Ionicons name="mic-outline" size={21} color="#64748B" />
              </TouchableOpacity>
            )}

            {/* Send Button */}
            <TouchableOpacity
              style={[
                styles.sendBtn,
                (input.trim() || selectedAttachments.length > 0) && !loading
                  ? styles.sendBtnActive
                  : styles.sendBtnDisabled,
              ]}
              onPress={() => sendMessage(input)}
              disabled={(!input.trim() && selectedAttachments.length === 0) || loading}
              accessibilityLabel="Send message"
            >
              <Ionicons
                name="arrow-up"
                size={18}
                color={(input.trim() || selectedAttachments.length > 0) && !loading ? "#FFFFFF" : "#94A3B8"}
              />
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* ── 4. Voice Modal ── */}
      <ParamVoiceModal
        visible={showVoiceModal}
        onClose={() => setShowVoiceModal(false)}
        onSendMessageFromVoice={handleVoiceMessageFromModal}
        conversationHistory={messages.slice(-8).map((m) => ({ role: m.role, text: m.text }))}
        initialLanguage={voiceLang}
      />

      {/* ── 5. Settings Modal ── */}
      <Modal visible={showSettingsModal} animationType="fade" transparent onRequestClose={() => setShowSettingsModal(false)}>
        <View style={styles.modalScrim}>
          <View style={styles.settingsCard}>
            <View style={styles.settingsHeader}>
              <Text style={styles.settingsTitle}>PARAM AI Settings</Text>
              <TouchableOpacity onPress={() => setShowSettingsModal(false)} accessibilityLabel="Close settings">
                <Ionicons name="close" size={22} color="#64748B" />
              </TouchableOpacity>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingLabel}>Response Language</Text>
              <View style={styles.settingChoiceRow}>
                <TouchableOpacity
                  style={[styles.settingChoiceBtn, voiceLang === "en" && styles.settingChoiceBtnActive]}
                  onPress={() => updateSettings(autoPlayAudio, voiceSpeed, "en")}
                >
                  <Text style={[styles.settingChoiceText, voiceLang === "en" && styles.settingChoiceTextActive]}>
                    English
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.settingChoiceBtn, voiceLang === "hi" && styles.settingChoiceBtnActive]}
                  onPress={() => updateSettings(autoPlayAudio, voiceSpeed, "hi")}
                >
                  <Text style={[styles.settingChoiceText, voiceLang === "hi" && styles.settingChoiceTextActive]}>
                    हिंदी (Hindi)
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.settingsSection}>
              <Text style={styles.settingLabel}>Speech Playback Speed</Text>
              <View style={styles.settingChoiceRow}>
                {[0.8, 1.0, 1.25].map((speed) => (
                  <TouchableOpacity
                    key={speed}
                    style={[styles.settingChoiceBtn, voiceSpeed === speed && styles.settingChoiceBtnActive]}
                    onPress={() => updateSettings(autoPlayAudio, speed, voiceLang)}
                  >
                    <Text style={[styles.settingChoiceText, voiceSpeed === speed && styles.settingChoiceTextActive]}>
                      {speed}x
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.settingsSection}>
              <TouchableOpacity
                style={styles.settingToggleRow}
                onPress={() => updateSettings(!autoPlayAudio, voiceSpeed, voiceLang)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingToggleTitle}>Auto-play voice responses</Text>
                  <Text style={styles.settingToggleSubtitle}>Automatically read AI replies aloud</Text>
                </View>
                <Ionicons
                  name={autoPlayAudio ? "checkbox" : "square-outline"}
                  size={22}
                  color={autoPlayAudio ? "#7C3AED" : "#94A3B8"}
                />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.closeSettingsBtn}
              onPress={() => setShowSettingsModal(false)}
            >
              <Text style={styles.closeSettingsBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ── Styles: Clean, Light, Navodaya Connect Theme ────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(233, 213, 255, 0.7)",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.8)",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
  },
  onlineDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: "#10B981",
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
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
    gap: 4,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.9)",
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  liveVoiceBtnText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8F7FF",
    alignItems: "center",
    justifyContent: "center",
  },
  body: {
    flex: 1,
  },
  bodyContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
  },

  // ── Welcome Screen ──
  welcomeSection: {
    alignItems: "center",
    paddingTop: 12,
  },
  orbWrapper: {
    width: 82,
    height: 82,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  welcomeHeading: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    marginBottom: 4,
    textAlign: "center",
  },
  welcomeTagline: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
    marginBottom: 8,
    textAlign: "center",
  },
  welcomeDescription: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 20,
  },
  sectionHeadingRow: {
    width: "100%",
    marginBottom: 10,
  },
  sectionHeading: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  categoryScroll: {
    gap: 8,
    paddingBottom: 16,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.8)",
  },
  categoryChipActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  categoryChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#475569",
  },
  categoryChipTextActive: {
    color: "#FFFFFF",
  },
  promptCardsContainer: {
    width: "100%",
    gap: 10,
    marginTop: 4,
  },
  promptCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  uploadPromptCard: {
    backgroundColor: "#FAF8FF",
    borderColor: "#DDD6FE",
  },
  promptCardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  promptBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  promptBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  promptText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: "#334155",
  },

  // ── Messages ──
  messagesList: {
    gap: 16,
  },
  messageWrapper: {
    width: "100%",
  },
  userWrapper: {
    alignItems: "flex-end",
  },
  userBubble: {
    maxWidth: "82%",
    backgroundColor: "#EDE9FE",
    borderRadius: 18,
    borderBottomRightRadius: 4,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  attachedPillGroup: {
    gap: 4,
    marginBottom: 6,
  },
  attachedUserPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  attachedUserPillText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#1E1B4B",
  },
  userMessageText: {
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_500Medium",
    color: "#1E1B4B",
  },
  userTimestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#6D28D9",
    marginTop: 4,
    alignSelf: "flex-end",
  },
  aiWrapper: {
    alignItems: "flex-start",
  },
  aiContentContainer: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 1,
  },
  aiMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  aiIdentityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  aiAvatarSmall: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  aiAuthorName: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },
  langBadge: {
    backgroundColor: "#EDE9FE",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  langBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#6D28D9",
  },
  aiTimestamp: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },

  // ── Markdown Styles ──
  markdownContainer: {
    width: "100%",
  },
  mdHeading1: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    marginTop: 10,
    marginBottom: 6,
  },
  mdHeading2: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
    marginTop: 8,
    marginBottom: 4,
  },
  mdHeading3: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#1E1B4B",
    marginTop: 6,
    marginBottom: 3,
  },
  mdParagraph: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: "Inter_400Regular",
    color: "#334155",
  },
  boldText: {
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
  },
  inlineCode: {
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    backgroundColor: "#F1F5F9",
    color: "#6D28D9",
    fontSize: 12,
    paddingHorizontal: 4,
    borderRadius: 4,
  },
  bulletRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 2,
    paddingLeft: 4,
  },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "#7C3AED",
    marginTop: 8,
    marginRight: 8,
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
    color: "#334155",
  },
  numberedRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginVertical: 2,
  },
  numberedIndex: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
    width: 22,
  },
  numberedText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: "Inter_400Regular",
    color: "#334155",
  },
  blockquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#7C3AED",
    paddingLeft: 10,
    marginVertical: 6,
    backgroundColor: "#FAF8FF",
    paddingVertical: 4,
    borderRadius: 4,
  },
  blockquoteText: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: "Inter_400Regular",
    color: "#475569",
    fontStyle: "italic",
  },

  // ── Sources ──
  sourcesContainer: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  sourcesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  sourcesTitle: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
  },
  sourceItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F8F7FF",
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 6,
  },
  sourceItemTitle: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#1E1B4B",
  },
  sourceItemBadge: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#6D28D9",
    marginTop: 1,
  },

  // ── Message Actions ──
  messageActionsBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
  },

  // ── Thinking State ──
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  thinkingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
  },
  thinkingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#7C3AED",
  },
  thinkingText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    marginLeft: 4,
  },
  regenerateContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    alignSelf: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.9)",
    marginVertical: 10,
  },
  regenerateText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },

  // ── Composer ──
  composerContainer: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "rgba(233, 213, 255, 0.8)",
    paddingHorizontal: 14,
    paddingTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 3,
  },
  attachmentTray: {
    paddingBottom: 8,
  },
  attachmentScroll: {
    gap: 8,
    paddingBottom: 6,
  },
  attachmentChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 8,
    maxWidth: 220,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#1E1B4B",
  },
  attachmentSize: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#6D28D9",
  },
  removeAttBtn: {
    padding: 2,
  },
  docSuggestionsScroll: {
    gap: 6,
    paddingTop: 4,
    paddingBottom: 2,
  },
  docSuggestionPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  docSuggestionText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  composerRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F7FF",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 4,
    gap: 6,
  },
  composerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#1E1B4B",
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnActive: {
    backgroundColor: "#7C3AED",
  },
  sendBtnDisabled: {
    backgroundColor: "#F1F5F9",
  },
  recordingRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 14,
    paddingVertical: 6,
    gap: 10,
  },
  recordingRedDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: "#EF4444",
  },
  recordingTimerText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#991B1B",
  },
  recActionBtn: {
    padding: 6,
  },
  recSendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EF4444",
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Settings Modal ──
  modalScrim: {
    flex: 1,
    backgroundColor: "rgba(15, 12, 35, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  settingsCard: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
  },
  settingsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  settingsTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#1E1B4B",
  },
  settingsSection: {
    marginBottom: 16,
  },
  settingLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#475569",
    marginBottom: 8,
  },
  settingChoiceRow: {
    flexDirection: "row",
    gap: 8,
  },
  settingChoiceBtn: {
    flex: 1,
    minHeight: 38,
    borderRadius: 10,
    backgroundColor: "#F8F7FF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  settingChoiceBtnActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#7C3AED",
  },
  settingChoiceText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
  },
  settingChoiceTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_700Bold",
  },
  settingToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
  settingToggleTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#1E1B4B",
  },
  settingToggleSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 2,
  },
  closeSettingsBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  closeSettingsBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
});
