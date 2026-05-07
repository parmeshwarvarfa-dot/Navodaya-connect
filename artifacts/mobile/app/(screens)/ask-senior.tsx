import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";

const CATEGORIES = ["All", "JEE/NEET", "College Life", "Career", "Hostel Life", "Coding & Tech", "UPSC/Civics"];

const MOCK_QA = [
  {
    id: "1", category: "JEE/NEET",
    question: "How did you manage Physics and Maths together in Class 12 while staying in hostel?",
    askedBy: "Ravi (Class 11, JNV Rajasthan)",
    askedAt: "2 days ago",
    answers: [
      { id: "a1", text: "Focus on NCERT first — 70% of JEE Main comes directly from it. For hostel, wake up at 5 AM before study hall, that 90 mins of silence is gold.", answeredBy: "Priya Sharma", role: "alumni", verified: true, batch: "2019", time: "1 day ago" },
      { id: "a2", text: "Create a weekly timetable and stick to it. Don't skip self-study hours — that consistency across 2 years is what matters.", answeredBy: "Mr. Ramesh Kumar", role: "teacher", verified: true, subject: "Physics", time: "20h ago" },
    ],
  },
  {
    id: "2", category: "Career",
    question: "Is it worth doing CA after Class 12 Commerce from JNV? What's the job scope?",
    askedBy: "Sneha (Class 12, JNV MP)",
    askedAt: "5 days ago",
    answers: [
      { id: "a3", text: "Absolutely worth it. CA has excellent scope — Big 4 firms, MNC finance roles, and even entrepreneurship. Clear Foundation early, it gets tougher at Inter.", answeredBy: "Amit Verma", role: "alumni", verified: true, batch: "2015", time: "4 days ago" },
    ],
  },
  {
    id: "3", category: "Hostel Life",
    question: "How do you deal with homesickness in the first year at JNV?",
    askedBy: "Arjun (Class 6, JNV UP)",
    askedAt: "1 week ago",
    answers: [
      { id: "a4", text: "It's completely normal! Join a sport or hobby group quickly — the friends you make in the first month will be your family for 7 years. Trust me, it gets much better.", answeredBy: "Neha Gupta", role: "alumni", verified: true, batch: "2020", time: "6 days ago" },
      { id: "a5", text: "Write letters home, it helps. And remember why you're here — the opportunity JNV gives is priceless. You'll cherish these years forever.", answeredBy: "Ms. Priya Devi", role: "teacher", verified: true, subject: "English", time: "5 days ago" },
    ],
  },
  {
    id: "4", category: "UPSC/Civics",
    question: "Can a JNV student crack UPSC? Any tips from alumni who made it?",
    askedBy: "Meena (Class 12, JNV Bihar)",
    askedAt: "2 weeks ago",
    answers: [
      { id: "a6", text: "Yes — JNV gives you an incredible edge: discipline, rural background (important for GS Paper 3), Hindi medium option, and national exposure. I cleared UPSC Prelims in my first attempt. Start reading The Hindu from Class 11.", answeredBy: "IAS Suresh Yadav", role: "alumni", verified: true, batch: "2014", time: "10 days ago" },
    ],
  },
  {
    id: "5", category: "Coding & Tech",
    question: "Best way to start learning to code while in JNV without a personal laptop?",
    askedBy: "Kiran (Class 10, JNV Karnataka)",
    askedAt: "3 days ago",
    answers: [
      { id: "a7", text: "Use the computer lab in your free hours. Start with Python — it's simple and powerful. Apps like Sololearn work on any Android phone too. Consistency of even 30 mins daily will compound massively.", answeredBy: "Rajat Singh", role: "alumni", verified: true, batch: "2018", time: "2 days ago" },
    ],
  },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const AVATAR_BG: Record<string, string> = {
  alumni: "#EEF2FF", teacher: "#ECFDF5",
};

export default function AskSeniorScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [activeCategory, setActiveCategory] = useState("All");
  const [searchQ, setSearchQ] = useState("");
  const [showAskModal, setShowAskModal] = useState(false);
  const [question, setQuestion] = useState("");
  const [questionCategory, setQuestionCategory] = useState("Career");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const isStudent  = profile?.role === "student";
  const canAnswer  = profile?.verificationStatus === "verified";

  const filtered = MOCK_QA.filter((q) => {
    const matchCat = activeCategory === "All" || q.category === activeCategory;
    const matchSearch = !searchQ || q.question.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSubmit = () => {
    if (!question.trim()) return;
    setSubmitted(true);
    setShowAskModal(false);
    setQuestion("");
    setTimeout(() => setSubmitted(false), 3000);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ask Senior</Text>
        {isStudent && (
          <TouchableOpacity style={styles.askBtn} onPress={() => setShowAskModal(true)}>
            <Ionicons name="add" size={20} color="#fff" />
            <Text style={styles.askBtnText}>Ask</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search questions..."
          placeholderTextColor="#9CA3AF"
          value={searchQ}
          onChangeText={setSearchQ}
        />
      </View>

      {/* Category chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity
            key={c}
            style={[styles.chip, activeCategory === c && styles.chipActive]}
            onPress={() => setActiveCategory(c)}
          >
            <Text style={[styles.chipText, activeCategory === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Q&A List */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {submitted && (
          <View style={styles.successBanner}>
            <Ionicons name="checkmark-circle" size={16} color="#10B981" />
            <Text style={styles.successText}>Your question was submitted! Verified seniors will answer soon.</Text>
          </View>
        )}

        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤔</Text>
            <Text style={styles.emptyText}>No questions found</Text>
            <Text style={styles.emptySub}>Be the first to ask in this category!</Text>
          </View>
        ) : filtered.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={styles.qaCard}
              activeOpacity={0.85}
              onPress={() => setExpandedId(expanded ? null : item.id)}
            >
              {/* Category + meta */}
              <View style={styles.qaTop}>
                <View style={styles.catPill}>
                  <Text style={styles.catPillText}>{item.category}</Text>
                </View>
                <Text style={styles.askedAt}>{item.askedAt}</Text>
              </View>

              {/* Question */}
              <Text style={styles.questionText}>{item.question}</Text>
              <Text style={styles.askedBy}>{item.askedBy}</Text>

              {/* Answer count */}
              <View style={styles.answerCountRow}>
                <Ionicons name="chatbubble-outline" size={14} color="#3D5AF1" />
                <Text style={styles.answerCount}>{item.answers.length} {item.answers.length === 1 ? "Answer" : "Answers"}</Text>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#9CA3AF" style={{ marginLeft: "auto" }} />
              </View>

              {/* Answers (expanded) */}
              {expanded && (
                <View style={styles.answersWrap}>
                  {item.answers.map((ans) => (
                    <View key={ans.id} style={styles.answerCard}>
                      <View style={styles.answerHeader}>
                        <View style={[styles.answerAvatar, { backgroundColor: AVATAR_BG[ans.role] || "#EEF2FF" }]}>
                          <Text style={[styles.answerInitial, { color: ans.role === "teacher" ? "#10B981" : "#3D5AF1" }]}>
                            {getInitials(ans.answeredBy)}
                          </Text>
                        </View>
                        <View style={styles.answerMeta}>
                          <View style={styles.answerNameRow}>
                            <Text style={styles.answerName}>{ans.answeredBy}</Text>
                            {ans.verified && <VerifiedBadge status="verified" role={ans.role} size="sm" />}
                          </View>
                          <Text style={styles.answerRole}>
                            {ans.role === "teacher" ? `${ans.subject} Teacher` : `Alumni · Batch ${ans.batch}`}
                          </Text>
                        </View>
                        <Text style={styles.answerTime}>{ans.time}</Text>
                      </View>
                      <Text style={styles.answerText}>{ans.text}</Text>
                    </View>
                  ))}

                  {canAnswer && (
                    <TouchableOpacity style={styles.replyBtn}>
                      <Ionicons name="create-outline" size={15} color="#3D5AF1" />
                      <Text style={styles.replyBtnText}>Add Your Answer</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Ask Question Modal */}
      <Modal visible={showAskModal} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask a Senior</Text>
              <TouchableOpacity onPress={() => setShowAskModal(false)}>
                <Ionicons name="close" size={24} color="#111" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 20 }}>
                {CATEGORIES.filter((c) => c !== "All").map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.chip, questionCategory === c && styles.chipActive]}
                    onPress={() => setQuestionCategory(c)}
                  >
                    <Text style={[styles.chipText, questionCategory === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.modalLabel}>Your Question</Text>
              <TextInput
                style={styles.questionInput}
                placeholder="Type your question here... Be specific so seniors can answer better."
                placeholderTextColor="#9CA3AF"
                value={question}
                onChangeText={setQuestion}
                multiline
                numberOfLines={5}
                textAlignVertical="top"
              />
              <Text style={styles.modalHint}>
                💡 Verified alumni and teachers will answer. Usually within 24 hours.
              </Text>

              <TouchableOpacity style={[styles.submitBtn, !question.trim() && { opacity: 0.5 }]} onPress={handleSubmit} disabled={!question.trim()}>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>Submit Question</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  askBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#3D5AF1", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  askBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  searchWrap: {
    flexDirection: "row", alignItems: "center", margin: 14,
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 14 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  successBanner: {
    flexDirection: "row", alignItems: "center", gap: 8,
    margin: 14, backgroundColor: "#ECFDF5", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12, borderWidth: 1, borderColor: "#A7F3D0",
  },
  successText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#065F46" },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  qaCard: {
    backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 12,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0",
  },
  qaTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  catPill: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  catPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  askedAt: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  questionText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", lineHeight: 22, marginBottom: 6 },
  askedBy: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 12 },
  answerCountRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  answerCount: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  answersWrap: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14, gap: 12 },
  answerCard: { backgroundColor: "#F9FAFB", borderRadius: 12, padding: 12 },
  answerHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 8 },
  answerAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  answerInitial: { fontSize: 14, fontFamily: "Inter_700Bold" },
  answerMeta: { flex: 1 },
  answerNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  answerName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  answerRole: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  answerTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  answerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 21 },
  replyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center",
    borderWidth: 1, borderColor: "#3D5AF1", borderRadius: 10, paddingVertical: 10,
  },
  replyBtnText: { color: "#3D5AF1", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  // Modal
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  modalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10 },
  questionInput: {
    borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12,
    padding: 14, fontSize: 15, fontFamily: "Inter_400Regular",
    color: "#111827", minHeight: 120, marginBottom: 12,
  },
  modalHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 24, lineHeight: 19 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15,
  },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});
