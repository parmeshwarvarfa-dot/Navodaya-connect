import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
}

const SUGGESTIONS = [
  { emoji: "🎓", text: "Career guidance after JNV" },
  { emoji: "📚", text: "How to prepare for JEE?" },
  { emoji: "🧑‍🎓", text: "NEET preparation tips" },
  { emoji: "📝", text: "UPSC strategy for Navodayans" },
  { emoji: "💼", text: "Connect me with alumni mentors" },
  { emoji: "🏫", text: "Tell me about JNV ranking system" },
];

const MOCK_RESPONSES: Record<string, string> = {
  "career guidance after jnv": "After JNV, you have excellent opportunities ahead! Many Navodayans excel in IIT/NIT (engineering), AIIMS/medical colleges (medicine), UPSC (civil services), NDA (defence), and research institutes like IISc. Your JNV education gives you a strong foundation in all subjects. Focus on identifying your passion early — whether it's science, humanities, or arts — and plan your Class 11-12 accordingly. The JNV alumni network is a great resource for mentorship!",
  "how to prepare for jee": "JEE preparation from JNV:\n\n📌 Start early — Class 9-10 foundations matter\n📌 Master NCERT thoroughly (70% of JEE)\n📌 Practice previous year papers daily\n📌 Join a coaching or use online resources like PW, Unacademy\n📌 Focus on Physics, Chemistry & Maths equally\n📌 Solve at least 50 problems per day\n📌 Take mock tests every weekend\n\nMany JNV alumni have cracked JEE Advanced with AIR under 1000. You can too! 💪",
  "neet preparation tips": "NEET preparation guide for Navodayans:\n\n🏥 NCERT Biology is your bible — read it 3-4 times\n🏥 Practice 100+ MCQs daily\n🏥 Focus on Human Physiology, Genetics & Ecology\n🏥 Chemistry: NCERT + practise numericals\n🏥 Physics: understand concepts, not rote learning\n🏥 Attempt full mock tests every 2 weeks\n🏥 Revise weekly\n\nNEET cutoff for AIIMS is ~685/720. Set high targets!",
  "upsc strategy for navodayans": "UPSC is one of the most popular career choices for JNV alumni!\n\n🎯 Start reading newspapers from Class 11\n🎯 NCERT books (6th-12th) form the base\n🎯 Choose your optional subject wisely\n🎯 Develop answer-writing habits early\n🎯 Join the JNV alumni UPSC group in Chat Groups\n🎯 Many Navodayans have become IAS/IPS officers\n\nThe JNV system's multilingual exposure and discipline are huge advantages for UPSC!",
  "connect me with alumni mentors": "Great choice! The JNV alumni network is incredibly supportive. Here's how to connect:\n\n1. Go to the 'Ask Alumni' section on the home screen\n2. Browse mentors by field (Engineering, Medicine, IAS, Research)\n3. Send a mentorship request with your goals\n4. Join Chat Groups → Alumni groups for direct interaction\n\nOur mentors are available on weekends for 1-on-1 guidance sessions. Would you like me to show you available mentors in a specific field?",
  "tell me about jnv ranking system": "The JNV Ranking System evaluates schools across India on multiple parameters:\n\n📊 Academic Performance (40%) — Board exam results, JEE/NEET selections\n⚽ Sports Achievement (25%) — National/state level competitions\n🎭 Cultural Activities (20%) — Events, competitions, cultural programs\n🌱 Overall Development (15%) — Alumni success, community contribution\n\nRankings are updated annually. JNV Delhi, Bangalore Urban, and Pune are consistently top performers. Check the Rankings section for live standings!",
};

function getResponse(text: string): string {
  const lower = text.toLowerCase();
  for (const key of Object.keys(MOCK_RESPONSES)) {
    if (lower.includes(key.split(" ")[0]) || lower.includes(key.split(" ")[1] || "")) {
      return MOCK_RESPONSES[key];
    }
  }
  return "That's a great question! As PA₹AM AI, I'm here to help you with career guidance, exam preparation, JNV life, and connecting with alumni. Could you be more specific about what you'd like to know? You can also try one of the suggested topics above. 😊";
}

export default function ParamAIScreen() {
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 16 : insets.bottom;

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);
    setTimeout(() => {
      const reply = getResponse(text);
      setMessages((prev) => [...prev, { id: Date.now().toString() + "r", role: "assistant", text: reply }]);
      setLoading(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }, 1200);
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
        <View style={{ width: 36 }} />
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
              Ask me anything about career guidance, exam prep, JNV life, mentorship, or just chat!
            </Text>

            <Text style={styles.tryLabel}>TRY ASKING ABOUT</Text>
            <View style={styles.suggestions}>
              {SUGGESTIONS.map((s) => (
                <TouchableOpacity
                  key={s.text}
                  style={styles.suggestionChip}
                  onPress={() => sendMessage(s.text)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.suggestionText}>{s.emoji}  {s.text}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.messages}>
            {messages.map((msg) => (
              <View
                key={msg.id}
                style={[styles.bubble, msg.role === "user" ? styles.bubbleUser : styles.bubbleAI]}
              >
                {msg.role === "assistant" && (
                  <View style={styles.aiBubbleHeader}>
                    <View style={styles.aiIcon}>
                      <Ionicons name="hardware-chip" size={14} color="#6D5FFA" />
                    </View>
                    <Text style={styles.aiLabel}>PA₹AM AI</Text>
                  </View>
                )}
                <Text style={[styles.bubbleText, msg.role === "user" && styles.bubbleTextUser]}>
                  {msg.text}
                </Text>
              </View>
            ))}
            {loading && (
              <View style={[styles.bubble, styles.bubbleAI]}>
                <View style={styles.typingWrap}>
                  <View style={styles.typingDot} />
                  <View style={[styles.typingDot, { opacity: 0.6 }]} />
                  <View style={[styles.typingDot, { opacity: 0.3 }]} />
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
        />
        <TouchableOpacity
          style={[styles.sendBtn, !input.trim() && styles.sendBtnDisabled]}
          onPress={() => sendMessage(input)}
          disabled={!input.trim() || loading}
        >
          <Ionicons name="send" size={18} color="#fff" />
        </TouchableOpacity>
      </View>
      <Text style={styles.disclaimer}>PA₹AM AI can make mistakes. Verify important info.</Text>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  aiDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#A3E635" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff", textAlign: "center" },
  body: { flex: 1 },
  bodyContent: { flexGrow: 1 },
  welcome: { alignItems: "center", paddingHorizontal: 24, paddingTop: 28 },
  welcomeIconWrap: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "#EDE9FE",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16,
  },
  welcomeTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B", textAlign: "center", marginBottom: 4 },
  welcomeSubtitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6D5FFA", marginBottom: 10 },
  welcomeDesc: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    color: "#374151", textAlign: "center", lineHeight: 22, marginBottom: 28,
  },
  tryLabel: {
    fontSize: 12, fontFamily: "Inter_600SemiBold",
    color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 14,
  },
  suggestions: { gap: 10, width: "100%" },
  suggestionChip: {
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  suggestionText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#111827" },
  messages: { padding: 16, gap: 12 },
  bubble: {
    maxWidth: "85%",
    borderRadius: 16,
    padding: 14,
    marginBottom: 4,
  },
  bubbleUser: {
    backgroundColor: "#6D5FFA",
    alignSelf: "flex-end",
    borderBottomRightRadius: 4,
  },
  bubbleAI: {
    backgroundColor: "#fff",
    alignSelf: "flex-start",
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    minWidth: 60, minHeight: 44,
    justifyContent: "center",
  },
  aiBubbleHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  aiIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center",
  },
  aiLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6D5FFA" },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", lineHeight: 22 },
  bubbleTextUser: { color: "#fff" },
  typingWrap: { flexDirection: "row", gap: 5, padding: 4, alignItems: "center" },
  typingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#6D5FFA" },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 10,
  },
  inputBox: {
    flex: 1,
    backgroundColor: "#F5F6FA",
    borderRadius: 24,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#111827",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#6D5FFA",
    alignItems: "center", justifyContent: "center",
  },
  sendBtnDisabled: { backgroundColor: "#9CA3AF" },
  disclaimer: {
    fontSize: 11, fontFamily: "Inter_400Regular",
    color: "#9CA3AF", textAlign: "center",
    paddingBottom: 8, backgroundColor: "#fff",
  },
});
