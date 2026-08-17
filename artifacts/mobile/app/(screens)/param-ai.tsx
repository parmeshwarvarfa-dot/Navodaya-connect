import React, { useState, useRef, useEffect } from "react";
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
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { getToken } from "@/lib/api";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

const SUGGESTIONS = [
  { emoji: "🎓", text: "Career guidance after JNV" },
  { emoji: "📚", text: "How to prepare for JEE?" },
  { emoji: "🏥", text: "NEET preparation tips" },
  { emoji: "🏛️", text: "UPSC strategy for Navodayans" },
  { emoji: "💼", text: "Best career options after Class 12" },
  { emoji: "🌍", text: "Scholarships for JNV students" },
];

function getApiUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN?.replace(/^https?:\/\//, "");
  return domain ? `https://${domain}/api/param-ai/chat` : "http://localhost:80/api/param-ai/chat";
}

function formatTime(date: Date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function ParamAIScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom;
  const typingAnim = useRef(new Animated.Value(0)).current;

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

  const sendMessage = async (text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText || loading) return;

    const userMsg: Message = {
      id: `${Date.now()}-user`,
      role: "user",
      text: trimmedText,
      timestamp: new Date(),
    };
    const history = messages.slice(-10).map(({ role, text: messageText }) => ({
      role,
      text: messageText,
    }));

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    scrollToBottom();

    try {
      const token = await getToken();
      const response = await fetch(getApiUrl(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: trimmedText, history }),
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || typeof payload.reply !== "string" || !payload.reply.trim()) {
        throw new Error("Param AI did not return a reply");
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-assistant`,
          role: "assistant",
          text: payload.reply.trim(),
          timestamp: new Date(),
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `${Date.now()}-error`,
          role: "assistant",
          text: "I’m having trouble connecting right now. Please check your connection and try again in a moment.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
      scrollToBottom();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <LinearGradient colors={["#6D5FFA", "#4B6EF5"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.aiDot} />
          <Text style={styles.headerTitle}>PA₹AM AI</Text>
        </View>
        {hasMessages ? (
          <TouchableOpacity style={styles.clearBtn} onPress={() => setMessages([])}>
            <Ionicons name="refresh" size={18} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </LinearGradient>

      <ScrollView
        ref={scrollRef}
        style={styles.body}
        contentContainerStyle={[styles.bodyContent, { paddingBottom: bottomPad + 80 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {!hasMessages ? (
          <View style={styles.welcome}>
            <View style={styles.welcomeIconWrap}>
              <Ionicons name="hardware-chip-outline" size={40} color="#6D5FFA" />
            </View>
            <Text style={styles.welcomeTitle}>Your Personal AI Advisor</Text>
            <Text style={styles.welcomeSubtitle}>Powered by PA₹AM AI</Text>
            <Text style={styles.welcomeDesc}>
              Ask me anything about career guidance, exam preparation, JNV life, scholarships, or just talk. I'm here to help!
            </Text>

            <Text style={styles.tryLabel}>TRY ASKING ABOUT</Text>
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
                    <Ionicons name="hardware-chip" size={14} color="#6D5FFA" />
                  </View>
                )}
                <View style={[styles.bubble, msg.role === "user" ? styles.bubbleUser : styles.bubbleAI]}>
                  {msg.role === "assistant" && (
                    <Text style={styles.aiLabel}>PA₹AM AI</Text>
                  )}
                  <Text style={[styles.bubbleText, msg.role === "user" && styles.bubbleTextUser]}>
                    {msg.text}
                  </Text>
                  <Text style={[styles.timeText, msg.role === "user" && { color: "rgba(255,255,255,0.6)" }]}>
                    {formatTime(msg.timestamp)}
                  </Text>
                </View>
              </View>
            ))}
            {loading && (
              <View style={styles.aiRow}>
                <View style={styles.aiAvatar}>
                  <Ionicons name="hardware-chip" size={14} color="#6D5FFA" />
                </View>
                <View style={[styles.bubble, styles.bubbleAI, styles.typingBubble]}>
                  <View style={styles.typingWrap}>
                    {[0, 1, 2].map((i) => (
                      <Animated.View
                        key={i}
                        style={[styles.typingDot, {
                          opacity: typingAnim.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.3 + i * 0.2, 1 - i * 0.2],
                          }),
                          transform: [{
                            translateY: typingAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [0, i === 1 ? -4 : -2],
                            }),
                          }],
                        }]}
                      />
                    ))}
                  </View>
                </View>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <View style={[styles.inputRow, { paddingBottom: bottomPad + 8 }]}>
        <TextInput
          style={styles.inputBox}
          placeholder="Ask PA₹AM AI anything..."
          placeholderTextColor="#9CA3AF"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={() => sendMessage(input)}
          returnKeyType="send"
          multiline={false}
          editable={!loading}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || loading) && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>PA₹AM AI is designed for JNV community guidance. Verify important decisions with qualified professionals.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  clearBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#A3E635" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1 },
  welcome: { alignItems: "center", paddingHorizontal: 24, paddingTop: 28 },
  welcomeIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center", marginBottom: 16 },
  welcomeTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B", textAlign: "center", marginBottom: 4 },
  welcomeSubtitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6D5FFA", marginBottom: 10 },
  welcomeDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  tryLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 14 },
  suggestions: { gap: 10, width: "100%" },
  suggestionChip: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 13, paddingHorizontal: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  suggestionEmoji: { fontSize: 18 },
  suggestionText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#111827" },
  messages: { padding: 16, gap: 10 },
  userRow: { flexDirection: "row", justifyContent: "flex-end" },
  aiRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  aiAvatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center", marginBottom: 4 },
  bubble: { maxWidth: "80%", borderRadius: 18, padding: 14 },
  bubbleUser: { backgroundColor: "#6D5FFA", borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: "#fff", borderBottomLeftRadius: 4, borderWidth: 1, borderColor: "#F0F0F0", flex: 1 },
  typingBubble: { paddingVertical: 14, paddingHorizontal: 18, maxWidth: 80 },
  aiLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6D5FFA", marginBottom: 6 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 6, alignSelf: "flex-end" },
  typingWrap: { flexDirection: "row", gap: 5, alignItems: "center", height: 16 },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6D5FFA" },
  inputRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 12, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F0F0F0", gap: 10 },
  inputBox: { flex: 1, backgroundColor: "#F5F6FA", borderRadius: 24, paddingHorizontal: 18, paddingVertical: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", borderWidth: 1, borderColor: "#E5E7EB" },
  sendBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#6D5FFA", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#9CA3AF" },
  disclaimer: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", paddingBottom: 8, backgroundColor: "#fff", paddingHorizontal: 16 },
});