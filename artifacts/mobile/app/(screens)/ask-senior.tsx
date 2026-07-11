import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { QaQuestion, QaAnswer } from "@/lib/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";

const CATEGORIES = ["All", "JEE/NEET", "College Life", "Career", "Hostel Life", "Coding & Tech", "UPSC/Civics"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AskSeniorScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [questions,        setQuestions]        = useState<QaQuestion[]>([]);
  const [loading,          setLoading]          = useState(true);
  const [activeCategory,   setActiveCategory]   = useState("All");
  const [searchQ,          setSearchQ]          = useState("");
  const [showAskModal,     setShowAskModal]      = useState(false);
  const [question,         setQuestion]         = useState("");
  const [questionCategory, setQuestionCategory] = useState("Career");
  const [expandedId,       setExpandedId]       = useState<string | null>(null);
  const [answerTexts,      setAnswerTexts]       = useState<Record<string, string>>({});
  const [toast,            setToast]            = useState("");
  const [submitting,       setSubmitting]        = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const isStudent  = profile?.role === "student";
  const canAnswer  = profile?.verificationStatus === "verified" || profile?.role === "teacher" || profile?.role === "official";

  const fetchQuestions = async () => {
    try { setQuestions(await api.qa.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchQuestions(); }, []);

  const filtered = questions.filter((q) => {
    const matchCat    = activeCategory === "All" || q.category === activeCategory;
    const matchSearch = !searchQ || q.question.toLowerCase().includes(searchQ.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleSubmit = async () => {
    if (!question.trim()) return;
    setSubmitting(true);
    try {
      const row = await api.qa.ask({ question: question.trim(), category: questionCategory });
      setQuestions((p) => [row, ...p]);
      setShowAskModal(false);
      setQuestion("");
      showToast("Your question was submitted! Verified seniors will answer soon.");
    } catch (e: any) { showToast(e?.message || "Failed to submit."); }
    setSubmitting(false);
  };

  const handleAnswer = async (id: string) => {
    const text = answerTexts[id] || "";
    if (!text.trim()) return;
    try {
      const ans = await api.qa.answer(id, text.trim());
      setQuestions((p) => p.map((q) => q.id === id ? { ...q, answers: [...q.answers, ans] } : q));
      setAnswerTexts((p) => ({ ...p, [id]: "" }));
      showToast("Answer posted!");
    } catch (e: any) { showToast(e?.message || "Failed to post answer."); }
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

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search questions..." placeholderTextColor="#9CA3AF" value={searchQ} onChangeText={setSearchQ} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, activeCategory === c && styles.chipActive]} onPress={() => setActiveCategory(c)}>
            <Text style={[styles.chipText, activeCategory === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {loading ? (
          <Text style={styles.loadingText}>Loading questions…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤔</Text>
            <Text style={styles.emptyText}>No questions yet</Text>
            <Text style={styles.emptySub}>Be the first to ask in this category!</Text>
          </View>
        ) : filtered.map((item) => {
          const expanded = expandedId === item.id;
          return (
            <TouchableOpacity key={item.id} style={styles.qaCard} activeOpacity={0.85} onPress={() => setExpandedId(expanded ? null : item.id)}>
              <View style={styles.qaTop}>
                <View style={styles.catPill}><Text style={styles.catPillText}>{item.category}</Text></View>
                <Text style={styles.askedAt}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.questionText}>{item.question}</Text>
              <Text style={styles.askedBy}>{item.askedByName || "Student"}{item.askedByClass ? ` · ${item.askedByClass}` : ""}</Text>
              <View style={styles.answerCountRow}>
                <Ionicons name="chatbubble-outline" size={14} color="#3D5AF1" />
                <Text style={styles.answerCount}>{item.answers.length} {item.answers.length === 1 ? "Answer" : "Answers"}</Text>
                <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color="#9CA3AF" style={{ marginLeft: "auto" }} />
              </View>

              {expanded && (
                <View style={styles.answersWrap}>
                  {item.answers.map((ans) => (
                    <View key={ans.id} style={styles.answerCard}>
                      <View style={styles.answerHeader}>
                        <View style={[styles.answerAvatar, { backgroundColor: ans.answeredByRole === "teacher" ? "#ECFDF5" : "#EEF2FF" }]}>
                          <Text style={[styles.answerInitial, { color: ans.answeredByRole === "teacher" ? "#10B981" : "#3D5AF1" }]}>
                            {getInitials(ans.answeredByName || "A")}
                          </Text>
                        </View>
                        <View style={styles.answerMeta}>
                          <Text style={styles.answerName}>{ans.answeredByName || "Mentor"}</Text>
                          <Text style={styles.answerRole}>
                            {ans.answeredByRole === "teacher" ? `${ans.subject || ""} Teacher` : ans.batch ? `Alumni · Batch ${ans.batch}` : "Alumni"}
                          </Text>
                        </View>
                        <Text style={styles.answerTime}>{new Date(ans.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <Text style={styles.answerText}>{ans.answer}</Text>
                    </View>
                  ))}

                  {canAnswer && (
                    <View style={styles.replyBox}>
                      <TextInput
                        style={styles.replyInput}
                        placeholder="Share your experience or advice…"
                        placeholderTextColor="#9CA3AF"
                        value={answerTexts[item.id] || ""}
                        onChangeText={(t) => setAnswerTexts((p) => ({ ...p, [item.id]: t }))}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                      />
                      <TouchableOpacity style={styles.replyBtn} onPress={() => handleAnswer(item.id)}>
                        <Ionicons name="send" size={15} color="#fff" />
                        <Text style={styles.replyBtnText}>Post Answer</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

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
                  <TouchableOpacity key={c} style={[styles.chip, questionCategory === c && styles.chipActive]} onPress={() => setQuestionCategory(c)}>
                    <Text style={[styles.chipText, questionCategory === c && styles.chipTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <Text style={styles.modalLabel}>Your Question</Text>
              <TextInput style={styles.questionInput} placeholder="Type your question here..." placeholderTextColor="#9CA3AF" value={question} onChangeText={setQuestion} multiline numberOfLines={5} textAlignVertical="top" />
              <Text style={styles.modalHint}>💡 Verified alumni and teachers will answer. Usually within 24 hours.</Text>
              <TouchableOpacity style={[styles.submitBtn, (!question.trim() || submitting) && { opacity: 0.5 }]} onPress={handleSubmit} disabled={!question.trim() || submitting}>
                <Ionicons name="send-outline" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>{submitting ? "Submitting…" : "Submit Question"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  askBtn: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#3D5AF1", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  askBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  loadingText: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 14, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 14 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  qaCard: { backgroundColor: "#fff", marginHorizontal: 14, marginBottom: 12, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
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
  answerName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  answerRole: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  answerTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  answerText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 21 },
  replyBox: { gap: 8 },
  replyInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 80 },
  replyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#3D5AF1", borderRadius: 10, paddingVertical: 10 },
  replyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  modalContainer: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  modalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10 },
  questionInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 15, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 120, marginBottom: 12 },
  modalHint: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 24, lineHeight: 19 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15 },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
