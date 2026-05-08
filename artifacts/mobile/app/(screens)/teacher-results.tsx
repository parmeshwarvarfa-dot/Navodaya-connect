import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const CLASSES  = ["Class 11 Sci A", "Class 12 Sci B", "Class 10 A"];
const SUBJECTS = ["Physics", "Chemistry", "Maths", "English", "Biology"];

const PUBLISHED_RESULTS = [
  {
    id: "1", exam: "Unit Test – Term I", class: "Class 11 Sci A", subject: "Physics",
    date: "15 Feb 2026", totalMarks: 50, published: true,
    students: [
      { name: "Ananya Sharma", marks: 44, grade: "A+" },
      { name: "Rohit Kumar",   marks: 38, grade: "A"  },
      { name: "Priya Mehta",   marks: 36, grade: "B+" },
      { name: "Rahul Singh",   marks: 29, grade: "B"  },
      { name: "Kavya Nair",    marks: 41, grade: "A"  },
    ],
  },
  {
    id: "2", exam: "Mid-Term", class: "Class 12 Sci B", subject: "Physics",
    date: "20 Mar 2026", totalMarks: 100, published: true,
    students: [
      { name: "Meera Iyer",   marks: 88, grade: "A+" },
      { name: "Karan Verma",  marks: 74, grade: "A"  },
      { name: "Tanya Singh",  marks: 61, grade: "B"  },
    ],
  },
];

const gradeFromPct = (pct: number) => pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : "C";
const GRADE_COLOR: Record<string, string> = { "A+": "#10B981", "A": "#3D5AF1", "B+": "#8B5CF6", "B": "#F59E0B", "C": "#EF4444" };

export default function TeacherResultsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [results,    setResults]    = useState(PUBLISHED_RESULTS);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast,      setToast]      = useState("");

  // Form state
  const [examName,  setExamName]  = useState("");
  const [cls,       setCls]       = useState("");
  const [subject,   setSubject]   = useState("");
  const [maxMarks,  setMaxMarks]  = useState("50");
  const [studentMarks, setStudentMarks] = useState<Record<string, string>>({});
  const [formErr,   setFormErr]   = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const handlePublish = () => {
    if (!examName.trim() || !cls || !subject) { setFormErr("Fill exam name, class and subject."); return; }
    const newResult = {
      id: Date.now().toString(), exam: examName, class: cls, subject,
      date: new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }),
      totalMarks: parseInt(maxMarks) || 50, published: true,
      students: Object.entries(studentMarks).map(([name, m]) => {
        const marks = parseInt(m) || 0;
        const pct   = (marks / (parseInt(maxMarks) || 50)) * 100;
        return { name, marks, grade: gradeFromPct(pct) };
      }),
    };
    setResults((p) => [newResult, ...p]);
    setExamName(""); setCls(""); setSubject(""); setMaxMarks("50"); setStudentMarks({}); setFormErr("");
    setShowCreate(false);
    showToast("Results published!");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Publish Results</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
        {results.map((r) => {
          const isEx   = expanded === r.id;
          const avg    = r.students.length ? Math.round(r.students.reduce((s, st) => s + st.marks, 0) / r.students.length) : 0;
          const avgPct = Math.round((avg / r.totalMarks) * 100);
          const highest = r.students.reduce((max, s) => s.marks > max ? s.marks : max, 0);
          return (
            <View key={r.id} style={styles.card}>
              <TouchableOpacity onPress={() => setExpanded(isEx ? null : r.id)} activeOpacity={0.85}>
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}><Ionicons name="stats-chart-outline" size={20} color="#0891B2" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{r.exam}</Text>
                    <Text style={styles.cardMeta}>{r.subject} · {r.class} · {r.date}</Text>
                  </View>
                  <View style={styles.publishedBadge}><Ionicons name="checkmark-circle" size={12} color="#10B981" /><Text style={styles.publishedText}>Published</Text></View>
                  <Ionicons name={isEx ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                </View>
                <View style={styles.statsRow}>
                  {[
                    { label: "Students",   value: String(r.students.length), color: "#6B7280" },
                    { label: "Avg Marks",  value: String(avg),              color: "#3D5AF1" },
                    { label: "Avg %",      value: `${avgPct}%`,             color: avgPct >= 75 ? "#10B981" : "#F59E0B" },
                    { label: "Highest",    value: String(highest),          color: "#8B5CF6" },
                  ].map((s) => (
                    <View key={s.label} style={styles.statChip}>
                      <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                      <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>

              {isEx && (
                <View style={styles.studentList}>
                  <Text style={styles.studentListTitle}>Student Marks</Text>
                  {r.students.map((s) => {
                    const pct = Math.round((s.marks / r.totalMarks) * 100);
                    const gColor = GRADE_COLOR[s.grade] || "#6B7280";
                    return (
                      <View key={s.name} style={styles.studentRow}>
                        <View style={styles.studentAvatar}><Text style={styles.studentAvatarText}>{s.name[0]}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.studentName}>{s.name}</Text>
                          <View style={styles.progressTrack}>
                            <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: gColor }]} />
                          </View>
                        </View>
                        <Text style={styles.marksText}>{s.marks}/{r.totalMarks}</Text>
                        <View style={[styles.gradePill, { backgroundColor: gColor + "18" }]}>
                          <Text style={[styles.gradeText, { color: gColor }]}>{s.grade}</Text>
                        </View>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Create Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Publish Results</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Exam Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Unit Test – Physics" placeholderTextColor="#9CA3AF" value={examName} onChangeText={setExamName} />

              <Text style={styles.fieldLabel}>Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {CLASSES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.pill, cls === c && styles.pillActive]} onPress={() => setCls(c)}>
                    <Text style={[styles.pillText, cls === c && styles.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Subject *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {SUBJECTS.map((s) => (
                  <TouchableOpacity key={s} style={[styles.pill, subject === s && styles.pillActive]} onPress={() => setSubject(s)}>
                    <Text style={[styles.pillText, subject === s && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Max Marks</Text>
              <TextInput style={styles.input} placeholder="50" placeholderTextColor="#9CA3AF" value={maxMarks} onChangeText={setMaxMarks} keyboardType="numeric" />

              <Text style={styles.fieldLabel}>Enter Student Marks</Text>
              {(cls ? (["Ananya Sharma", "Rohit Kumar", "Priya Mehta", "Rahul Singh", "Kavya Nair"]) : []).map((name) => (
                <View key={name} style={styles.markRow}>
                  <Text style={styles.markStudentName}>{name}</Text>
                  <TextInput
                    style={styles.markInput}
                    placeholder="0"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="numeric"
                    value={studentMarks[name] || ""}
                    onChangeText={(v) => setStudentMarks((p) => ({ ...p, [name]: v }))}
                  />
                  <Text style={styles.markMax}>/ {maxMarks}</Text>
                </View>
              ))}

              {formErr ? <Text style={styles.errText}>{formErr}</Text> : null}
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePublish}>
                <Ionicons name="stats-chart-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Publish Results</Text>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0891B2", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  publishedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  publishedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  statsRow: { flexDirection: "row", gap: 8 },
  statChip: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 8, alignItems: "center" },
  statVal: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  studentList: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14 },
  studentListTitle: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#374151", marginBottom: 10 },
  studentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  studentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  studentAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  studentName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 4 },
  progressTrack: { height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 2 },
  marksText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", width: 50, textAlign: "right" },
  gradePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, marginLeft: 4 },
  gradeText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  pillActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  pillTextActive: { color: "#fff" },
  markRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  markStudentName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  markInput: { width: 60, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 8, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", textAlign: "center" },
  markMax: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9CA3AF", width: 30 },
  errText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12, marginTop: 8 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0891B2", borderRadius: 14, paddingVertical: 15, marginTop: 10 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
