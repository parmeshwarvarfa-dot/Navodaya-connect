import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";

// ─── Data ─────────────────────────────────────────────────────────────────────
const SUBJECTS = [
  { name: "Mathematics", icon: "calculator-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", chapters: 15, class: "All" },
  { name: "Science", icon: "flask-outline" as const, color: "#10B981", bg: "#ECFDF5", chapters: 16, class: "6–10" },
  { name: "Physics", icon: "nuclear-outline" as const, color: "#8B5CF6", bg: "#F5F3FF", chapters: 14, class: "11–12" },
  { name: "Chemistry", icon: "beaker-outline" as const, color: "#F59E0B", bg: "#FFFBEB", chapters: 16, class: "11–12" },
  { name: "Biology", icon: "leaf-outline" as const, color: "#059669", bg: "#D1FAE5", chapters: 22, class: "11–12" },
  { name: "English", icon: "language-outline" as const, color: "#EF4444", bg: "#FEF2F2", chapters: 10, class: "All" },
  { name: "Social Science", icon: "earth-outline" as const, color: "#F97316", bg: "#FFF7ED", chapters: 20, class: "6–10" },
  { name: "Hindi", icon: "text-outline" as const, color: "#EC4899", bg: "#FDF2F8", chapters: 12, class: "All" },
];

const RESOURCES = [
  { title: "NCERT Textbooks (Free PDF)", desc: "Official NCERT books for Class 6–12 in Hindi & English", icon: "document-text-outline" as const, color: "#3D5AF1", tag: "Official" },
  { title: "Previous Year Question Papers", desc: "CBSE board papers from 2015–2024 with solutions", icon: "archive-outline" as const, color: "#8B5CF6", tag: "Board Prep" },
  { title: "CBSE Sample Papers 2024–25", desc: "Latest sample papers with marking scheme", icon: "copy-outline" as const, color: "#10B981", tag: "CBSE" },
  { title: "NCERT Exemplar Problems", desc: "Higher-order problems for Maths & Science", icon: "bulb-outline" as const, color: "#F59E0B", tag: "Advanced" },
  { title: "Revision Notes – All Subjects", desc: "Concise chapter-wise notes contributed by toppers", icon: "create-outline" as const, color: "#EF4444", tag: "Notes" },
  { title: "Formula Sheets", desc: "Quick-reference formula sheets for Maths, Physics & Chemistry", icon: "calculator-outline" as const, color: "#F97316", tag: "Reference" },
];

const QUICK_QUIZ: { q: string; options: string[]; ans: number; subject: string }[] = [
  { q: "What is the SI unit of electric current?", options: ["Volt", "Ampere", "Ohm", "Watt"], ans: 1, subject: "Physics" },
  { q: "Which element has atomic number 8?", options: ["Nitrogen", "Carbon", "Oxygen", "Fluorine"], ans: 2, subject: "Chemistry" },
  { q: "What is the value of sin 90°?", options: ["0", "1", "√2", "0.5"], ans: 1, subject: "Maths" },
  { q: "The powerhouse of the cell is the ___", options: ["Nucleus", "Ribosome", "Mitochondria", "Golgi Body"], ans: 2, subject: "Biology" },
  { q: "When did India gain independence?", options: ["1945", "1947", "1950", "1952"], ans: 1, subject: "History" },
];

const STUDY_TIPS = [
  { tip: "Study in 45-minute focused sessions with a 10-minute break (Pomodoro).", icon: "timer-outline" as const, color: "#3D5AF1" },
  { tip: "Write notes in your own words — it boosts retention by up to 70%.", icon: "create-outline" as const, color: "#10B981" },
  { tip: "Teach what you've learned to a friend to identify your weak spots.", icon: "people-outline" as const, color: "#8B5CF6" },
  { tip: "Solve at least 5 previous year questions per chapter before board exams.", icon: "checkmark-done-outline" as const, color: "#F59E0B" },
];

const CLASS_FILTERS = ["All", "6", "7", "8", "9", "10", "11", "12"];

// ─── Quiz Modal ────────────────────────────────────────────────────────────────
function QuizModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  const q = QUICK_QUIZ[idx];

  const handleOption = (i: number) => {
    if (selected !== null) return;
    setSelected(i);
    if (i === q.ans) setScore((s) => s + 1);
  };

  const handleNext = () => {
    if (idx < QUICK_QUIZ.length - 1) {
      setIdx((i) => i + 1);
      setSelected(null);
    } else {
      setDone(true);
    }
  };

  const handleRestart = () => {
    setIdx(0); setSelected(null); setScore(0); setDone(false);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <View style={quiz.container}>
        <View style={quiz.header}>
          <Text style={quiz.headerTitle}>Quick Quiz</Text>
          <TouchableOpacity onPress={onClose} style={quiz.closeBtn}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
        </View>

        {done ? (
          <View style={quiz.doneWrap}>
            <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={quiz.doneIcon}>
              <Ionicons name="trophy" size={40} color="#FFD700" />
            </LinearGradient>
            <Text style={quiz.doneScore}>{score} / {QUICK_QUIZ.length}</Text>
            <Text style={quiz.doneTitle}>{score >= 4 ? "Excellent!" : score >= 3 ? "Good Job!" : "Keep Practising!"}</Text>
            <Text style={quiz.doneDesc}>You answered {score} out of {QUICK_QUIZ.length} questions correctly.</Text>
            <TouchableOpacity style={quiz.restartBtn} onPress={handleRestart}>
              <Ionicons name="refresh-outline" size={18} color="#fff" />
              <Text style={quiz.restartBtnText}>Try Again</Text>
            </TouchableOpacity>
            <TouchableOpacity style={quiz.closeFullBtn} onPress={onClose}>
              <Text style={quiz.closeFullBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <ScrollView contentContainerStyle={quiz.body} keyboardShouldPersistTaps="handled">
            <View style={quiz.progress}>
              {QUICK_QUIZ.map((_, i) => (
                <View key={i} style={[quiz.dot, i <= idx && quiz.dotActive, i < idx && quiz.dotDone]} />
              ))}
            </View>
            <Text style={quiz.qNum}>Question {idx + 1} of {QUICK_QUIZ.length}</Text>
            <View style={quiz.subjectTag}>
              <Text style={quiz.subjectTagText}>{q.subject}</Text>
            </View>
            <Text style={quiz.question}>{q.q}</Text>
            {q.options.map((opt, i) => {
              let bg = "#F9FAFB";
              let border = "#E5E7EB";
              let textColor = "#111827";
              if (selected !== null) {
                if (i === q.ans) { bg = "#ECFDF5"; border = "#10B981"; textColor = "#059669"; }
                else if (i === selected && i !== q.ans) { bg = "#FEF2F2"; border = "#EF4444"; textColor = "#DC2626"; }
              }
              return (
                <TouchableOpacity key={i} style={[quiz.option, { backgroundColor: bg, borderColor: border }]} onPress={() => handleOption(i)} activeOpacity={0.8}>
                  <View style={[quiz.optionLetter, { borderColor: border }]}>
                    <Text style={[quiz.optionLetterText, { color: textColor }]}>{["A", "B", "C", "D"][i]}</Text>
                  </View>
                  <Text style={[quiz.optionText, { color: textColor }]}>{opt}</Text>
                  {selected !== null && i === q.ans && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                  {selected !== null && i === selected && i !== q.ans && <Ionicons name="close-circle" size={20} color="#EF4444" />}
                </TouchableOpacity>
              );
            })}
            {selected !== null && (
              <TouchableOpacity style={quiz.nextBtn} onPress={handleNext}>
                <Text style={quiz.nextBtnText}>{idx < QUICK_QUIZ.length - 1 ? "Next Question →" : "See Results"}</Text>
              </TouchableOpacity>
            )}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Main Screen ───────────────────────────────────────────────────────────────
export default function StudyScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const [classFilter, setClassFilter] = useState("All");
  const [showQuiz, setShowQuiz] = useState(false);

  const filteredSubjects = classFilter === "All"
    ? SUBJECTS
    : SUBJECTS.filter((s) => s.class === "All" || s.class.includes(classFilter));

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#10B981", "#059669"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Study Hub</Text>
          <Text style={styles.headerSub}>Notes, syllabus & practice — all in one place</Text>
        </View>
        <TouchableOpacity style={styles.quizBtn} onPress={() => setShowQuiz(true)}>
          <Ionicons name="flash" size={16} color="#10B981" />
          <Text style={styles.quizBtnText}>Quiz</Text>
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        {/* Class filter */}
        <View style={styles.filterWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {CLASS_FILTERS.map((f) => (
              <TouchableOpacity
                key={f}
                style={[styles.filterChip, classFilter === f && styles.filterChipActive]}
                onPress={() => setClassFilter(f)}
              >
                <Text style={[styles.filterChipText, classFilter === f && styles.filterChipTextActive]}>
                  {f === "All" ? "All Classes" : `Class ${f}`}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Banner CTA */}
        <TouchableOpacity activeOpacity={0.88} onPress={() => setShowQuiz(true)} style={styles.bannerWrap}>
          <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.banner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.bannerTitle}>Test Your Knowledge</Text>
              <Text style={styles.bannerDesc}>5 quick questions across Science, Maths & Social Science. Ready?</Text>
              <View style={styles.bannerBtn}>
                <Text style={styles.bannerBtnText}>Start Quick Quiz →</Text>
              </View>
            </View>
            <View style={styles.bannerIllustration}>
              <Ionicons name="school" size={48} color="rgba(255,255,255,0.25)" />
            </View>
          </LinearGradient>
        </TouchableOpacity>

        {/* Subjects grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Subjects</Text>
          <View style={styles.subjectsGrid}>
            {filteredSubjects.map((sub) => (
              <TouchableOpacity key={sub.name} style={styles.subjectCard} activeOpacity={0.8}>
                <View style={[styles.subjectIconBox, { backgroundColor: sub.bg }]}>
                  <Ionicons name={sub.icon} size={28} color={sub.color} />
                </View>
                <Text style={styles.subjectName}>{sub.name}</Text>
                <Text style={styles.subjectChapters}>{sub.chapters} chapters</Text>
                <View style={[styles.subjectTag, { backgroundColor: sub.bg }]}>
                  <Text style={[styles.subjectTagText, { color: sub.color }]}>Class {sub.class}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Study Resources */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Resources</Text>
          {RESOURCES.map((res) => (
            <TouchableOpacity key={res.title} style={styles.resourceCard} activeOpacity={0.8}>
              <View style={[styles.resourceIcon, { backgroundColor: res.color + "18" }]}>
                <Ionicons name={res.icon} size={22} color={res.color} />
              </View>
              <View style={styles.resourceBody}>
                <View style={styles.resourceTopRow}>
                  <Text style={styles.resourceTitle} numberOfLines={1}>{res.title}</Text>
                  <View style={[styles.resourceTag, { backgroundColor: res.color + "18" }]}>
                    <Text style={[styles.resourceTagText, { color: res.color }]}>{res.tag}</Text>
                  </View>
                </View>
                <Text style={styles.resourceDesc} numberOfLines={2}>{res.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Study Tips */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Study Tips</Text>
          {STUDY_TIPS.map((tip, i) => (
            <View key={i} style={styles.tipCard}>
              <View style={[styles.tipIcon, { backgroundColor: tip.color + "18" }]}>
                <Ionicons name={tip.icon} size={20} color={tip.color} />
              </View>
              <Text style={styles.tipText}>{tip.tip}</Text>
            </View>
          ))}
        </View>

        {/* Exam Countdown */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Exams</Text>
          {[
            { name: "CBSE Class 10 Board Exams", date: "Feb 2026", daysLeft: 273, color: "#3D5AF1" },
            { name: "CBSE Class 12 Board Exams", date: "Feb 2026", daysLeft: 270, color: "#8B5CF6" },
            { name: "JNV Selection Test (Class 6)", date: "Jan 2026", daysLeft: 243, color: "#10B981" },
            { name: "Mid-Term Examinations", date: "Aug 2025", daysLeft: 90, color: "#F59E0B" },
          ].map((exam) => (
            <View key={exam.name} style={styles.examCard}>
              <View style={[styles.examAccent, { backgroundColor: exam.color }]} />
              <View style={styles.examBody}>
                <Text style={styles.examName}>{exam.name}</Text>
                <Text style={styles.examDate}>{exam.date}</Text>
              </View>
              <View style={[styles.examCountdown, { backgroundColor: exam.color + "18" }]}>
                <Text style={[styles.examDays, { color: exam.color }]}>{exam.daysLeft}</Text>
                <Text style={[styles.examDaysLabel, { color: exam.color }]}>days</Text>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <QuizModal visible={showQuiz} onClose={() => setShowQuiz(false)} />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingBottom: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#fff" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", marginTop: 2 },
  quizBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8,
  },
  quizBtnText: { color: "#10B981", fontSize: 13, fontFamily: "Inter_700Bold" },
  filterWrap: { paddingVertical: 14 },
  filterRow: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB" },
  filterChipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  filterChipTextActive: { color: "#fff" },
  bannerWrap: { marginHorizontal: 16, marginBottom: 6, borderRadius: 18, overflow: "hidden" },
  banner: { flexDirection: "row", alignItems: "center", padding: 20 },
  bannerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#fff", marginBottom: 4 },
  bannerDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.85)", lineHeight: 18, marginBottom: 14 },
  bannerBtn: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, alignSelf: "flex-start" },
  bannerBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  bannerIllustration: { paddingLeft: 10 },
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  subjectsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  subjectCard: {
    width: "47%", backgroundColor: "#fff", borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  subjectIconBox: { width: 52, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  subjectName: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 2 },
  subjectChapters: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 8 },
  subjectTag: { alignSelf: "flex-start", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  subjectTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  resourceCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  resourceIcon: { width: 44, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  resourceBody: { flex: 1 },
  resourceTopRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  resourceTitle: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  resourceTag: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  resourceTagText: { fontSize: 10, fontFamily: "Inter_700Bold" },
  resourceDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 18 },
  tipCard: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  tipIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20 },
  examCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#fff", borderRadius: 14, marginBottom: 10, overflow: "hidden",
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  examAccent: { width: 5, alignSelf: "stretch" },
  examBody: { flex: 1, padding: 14 },
  examName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  examDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  examCountdown: { alignItems: "center", justifyContent: "center", paddingHorizontal: 16, paddingVertical: 12, marginRight: 8, borderRadius: 12 },
  examDays: { fontSize: 22, fontFamily: "Inter_700Bold" },
  examDaysLabel: { fontSize: 10, fontFamily: "Inter_500Medium" },
});

const quiz = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  body: { padding: 20, paddingBottom: 40 },
  progress: { flexDirection: "row", gap: 6, marginBottom: 20 },
  dot: { flex: 1, height: 5, borderRadius: 3, backgroundColor: "#E5E7EB" },
  dotActive: { backgroundColor: "#3D5AF1" },
  dotDone: { backgroundColor: "#10B981" },
  qNum: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#9CA3AF", marginBottom: 8 },
  subjectTag: { alignSelf: "flex-start", backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4, marginBottom: 14 },
  subjectTagText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  question: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", lineHeight: 27, marginBottom: 24 },
  option: {
    flexDirection: "row", alignItems: "center", gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 14, marginBottom: 10,
  },
  optionLetter: {
    width: 32, height: 32, borderRadius: 16, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  optionLetterText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  optionText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium" },
  nextBtn: {
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 16,
    alignItems: "center", marginTop: 8,
  },
  nextBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  doneWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  doneIcon: { width: 90, height: 90, borderRadius: 28, alignItems: "center", justifyContent: "center", marginBottom: 20 },
  doneScore: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  doneTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  doneDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 28 },
  restartBtn: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12, width: "100%", justifyContent: "center",
  },
  restartBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
  closeFullBtn: {
    borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32,
    borderWidth: 1.5, borderColor: "#E5E7EB", width: "100%", alignItems: "center",
  },
  closeFullBtnText: { color: "#374151", fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
