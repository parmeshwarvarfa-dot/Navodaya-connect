import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { StudentQueryWithAnswers } from "@/lib/api";

const CATEGORIES = ["All", "Academics", "Exams", "Career", "School Help"];
const CATEGORY_COLOR: Record<string, string> = {
  "Academics": "#3D5AF1", "Exams": "#EF4444", "Career": "#10B981", "School Help": "#8B5CF6",
};

export default function TeacherQueriesScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [queries,    setQueries]    = useState<StudentQueryWithAnswers[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTab,  setActiveTab]  = useState("All");
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [toast,      setToast]      = useState("");
  const [search,     setSearch]     = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const fetchQueries = async () => {
    try { setQueries(await api.studentQueries.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchQueries(); }, []);

  const submitAnswer = async (id: string) => {
    if (!answerText.trim()) return;
    try {
      await api.studentQueries.answer(id, answerText.trim());
      setQueries((p) => p.map((q) => q.id === id
        ? { ...q, solved: true, answers: [...q.answers, { id: Date.now().toString(), queryId: id, answer: answerText, createdAt: new Date().toISOString() }] }
        : q
      ));
      setAnswerText("");
      showToast("Answer posted! Query marked as solved.");
    } catch (e: any) { showToast(e?.message || "Failed to post answer."); }
  };

  const filtered = queries.filter((q) => {
    const matchCat = activeTab === "All" || q.category === activeTab;
    const matchS   = !search || q.question.toLowerCase().includes(search.toLowerCase()) || (q.studentName || "").toLowerCase().includes(search.toLowerCase());
    return matchCat && matchS;
  });

  const unsolved = queries.filter((q) => !q.solved).length;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Student Queries</Text>
          </View>
          {unsolved > 0 && (
            <View style={styles.unsolvedBadge}><Text style={styles.unsolvedText}>{unsolved} pending</Text></View>
          )}
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
          <TextInput style={styles.searchInput} placeholder="Search queries…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.tab, activeTab === c && styles.tabActive]} onPress={() => setActiveTab(c)}>
              <Text style={[styles.tabText, activeTab === c && styles.tabTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
          {loading ? <Text style={styles.loadingText}>Loading…</Text> : filtered.length === 0 ? (
            <View style={styles.empty}><Text style={styles.emptyIcon}>🙋</Text><Text style={styles.emptyText}>No queries found</Text></View>
          ) : filtered.map((q) => {
            const catColor = CATEGORY_COLOR[q.category] || "#6B7280";
            const isEx     = expanded === q.id;
            return (
              <View key={q.id} style={[styles.card, q.solved && styles.cardSolved]}>
                <TouchableOpacity onPress={() => setExpanded(isEx ? null : q.id)} activeOpacity={0.85}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{(q.studentName || "?")[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={styles.studentName}>{q.studentName || "Student"}</Text>
                        {q.solved && <View style={styles.solvedBadge}><Ionicons name="checkmark-circle" size={12} color="#10B981" /><Text style={styles.solvedText}>Solved</Text></View>}
                      </View>
                      <Text style={styles.classMeta}>{q.studentClass || ""} · {q.subject}</Text>
                    </View>
                    <View style={[styles.catPill, { backgroundColor: catColor + "18" }]}>
                      <Text style={[styles.catPillText, { color: catColor }]}>{q.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.question} numberOfLines={isEx ? undefined : 2}>{q.question}</Text>
                  <Text style={styles.timeText}>{new Date(q.createdAt).toLocaleDateString()} · {q.answers.length} answer{q.answers.length !== 1 ? "s" : ""}</Text>
                </TouchableOpacity>

                {isEx && (
                  <View style={styles.expanded}>
                    {q.answers.map((ans) => (
                      <View key={ans.id} style={styles.answerBox}>
                        <View style={styles.answerHeader}>
                          <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                          <Text style={styles.answerLabel}>{ans.answeredByName || "Teacher"}'s Answer</Text>
                        </View>
                        <Text style={styles.answerText}>{ans.answer}</Text>
                      </View>
                    ))}

                    {!q.solved && (
                      <View style={styles.replySection}>
                        <TextInput
                          style={styles.replyInput}
                          placeholder="Type your answer here…"
                          placeholderTextColor="#9CA3AF"
                          value={answerText}
                          onChangeText={setAnswerText}
                          multiline
                          numberOfLines={3}
                          textAlignVertical="top"
                        />
                        <TouchableOpacity style={styles.replyBtn} onPress={() => submitAnswer(q.id)}>
                          <Ionicons name="send" size={16} color="#fff" />
                          <Text style={styles.replyBtnText}>Post Answer & Mark Solved</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>

        {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  unsolvedBadge: { backgroundColor: "#FFFBEB", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "#FDE68A" },
  unsolvedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F59E0B" },
  loadingText: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 14, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  tabActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  tabTextActive: { color: "#fff" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  cardSolved: { borderColor: "#D1FAE5" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  solvedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  solvedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  classMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  catPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  catPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  question: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20, marginBottom: 8 },
  timeText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  expanded: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14 },
  answerBox: { backgroundColor: "#F0FDF4", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#D1FAE5" },
  answerHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  answerLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  answerText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 19 },
  replySection: { gap: 10 },
  replyInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 90 },
  replyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 12 },
  replyBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
