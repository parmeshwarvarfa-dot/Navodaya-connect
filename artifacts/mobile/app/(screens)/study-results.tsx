import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const EXAMS = [
  {
    id: "1", name: "Unit Test – Term I",   date: "15 Feb 2026", type: "Unit Test",
    subjects: [
      { name: "Physics",   marks: 38, total: 50, grade: "A"  },
      { name: "Chemistry", marks: 44, total: 50, grade: "A+" },
      { name: "Maths",     marks: 36, total: 50, grade: "B+" },
      { name: "English",   marks: 42, total: 50, grade: "A"  },
      { name: "Biology",   marks: 40, total: 50, grade: "A"  },
    ],
    rank: 4, classRank: 4, classSize: 34,
  },
  {
    id: "2", name: "Mid-Term Exam",         date: "20 Mar 2026", type: "Mid-Term",
    subjects: [
      { name: "Physics",   marks: 74, total: 100, grade: "A"  },
      { name: "Chemistry", marks: 88, total: 100, grade: "A+" },
      { name: "Maths",     marks: 71, total: 100, grade: "B+" },
      { name: "English",   marks: 84, total: 100, grade: "A"  },
      { name: "Biology",   marks: 79, total: 100, grade: "A"  },
    ],
    rank: 5, classRank: 5, classSize: 34,
  },
];

const GRADE_COLOR: Record<string, string> = {
  "A+": "#10B981", "A": "#3D5AF1", "B+": "#8B5CF6", "B": "#F59E0B", "C": "#EF4444",
};

function ScoreBar({ marks, total, color }: { marks: number; total: number; color: string }) {
  const pct = (marks / total) * 100;
  return (
    <View style={{ height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" }}>
      <View style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
    </View>
  );
}

export default function StudyResultsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [activeExam, setActiveExam] = useState("1");

  const exam = EXAMS.find((e) => e.id === activeExam)!;
  const total  = exam.subjects.reduce((s, sub) => s + sub.marks, 0);
  const maxTotal = exam.subjects.reduce((s, sub) => s + sub.total, 0);
  const pct    = Math.round((total / maxTotal) * 100);
  const grade  = pct >= 90 ? "A+" : pct >= 80 ? "A" : pct >= 70 ? "B+" : pct >= 60 ? "B" : "C";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Results & Performance</Text>
      </View>

      {/* Exam selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.examChips} style={{ flexGrow: 0 }}>
        {EXAMS.map((e) => (
          <TouchableOpacity key={e.id} style={[styles.examChip, activeExam === e.id && styles.examChipActive]} onPress={() => setActiveExam(e.id)}>
            <Text style={[styles.examChipText, activeExam === e.id && styles.examChipTextActive]}>{e.name}</Text>
            <Text style={[styles.examChipDate, activeExam === e.id && { color: "rgba(255,255,255,0.7)" }]}>{e.date}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>

        {/* Score card */}
        <View style={styles.scoreCard}>
          <View style={styles.scoreLeft}>
            <Text style={styles.examType}>{exam.type}</Text>
            <Text style={styles.examName}>{exam.name}</Text>
            <Text style={styles.examDate}>{exam.date}</Text>
          </View>
          <View style={styles.scoreRight}>
            <View style={[styles.gradeCircle, { borderColor: GRADE_COLOR[grade] || "#3D5AF1" }]}>
              <Text style={[styles.gradeText, { color: GRADE_COLOR[grade] || "#3D5AF1" }]}>{grade}</Text>
            </View>
            <Text style={[styles.scorePct, { color: GRADE_COLOR[grade] || "#3D5AF1" }]}>{pct}%</Text>
          </View>
        </View>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: "Total Marks",  value: `${total}/${maxTotal}`, color: "#3D5AF1" },
            { label: "Percentage",   value: `${pct}%`,              color: pct >= 75 ? "#10B981" : "#F59E0B" },
            { label: "Class Rank",   value: `#${exam.rank}`,        color: "#8B5CF6" },
            { label: "Class Size",   value: `${exam.classSize}`,    color: "#6B7280" },
          ].map((s) => (
            <View key={s.label} style={styles.statBox}>
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Subject-wise */}
        <Text style={styles.sectionTitle}>Subject-wise Performance</Text>
        {exam.subjects.map((sub) => {
          const subPct = Math.round((sub.marks / sub.total) * 100);
          const col = GRADE_COLOR[sub.grade] || "#3D5AF1";
          return (
            <View key={sub.name} style={styles.subjectCard}>
              <View style={styles.subjectTop}>
                <Text style={styles.subjectName}>{sub.name}</Text>
                <View style={[styles.gradePill, { backgroundColor: col + "18" }]}>
                  <Text style={[styles.gradePillText, { color: col }]}>{sub.grade}</Text>
                </View>
                <Text style={[styles.subjectScore, { color: col }]}>{sub.marks}/{sub.total}</Text>
              </View>
              <ScoreBar marks={sub.marks} total={sub.total} color={col} />
              <Text style={styles.subjectPct}>{subPct}%</Text>
            </View>
          );
        })}

        {/* Progress note */}
        <View style={styles.progressNote}>
          <Ionicons name="trending-up" size={18} color="#10B981" />
          <Text style={styles.progressNoteText}>
            {pct >= 80 ? "Great performance! You're consistently above 80%. Keep it up!" : pct >= 70 ? "Good performance. Focus on Maths to push past 80%." : "Work on weak subjects. Aim for 75%+ to stay on track."}
          </Text>
        </View>

        {/* Download report card */}
        <TouchableOpacity style={styles.downloadBtn}>
          <Ionicons name="download-outline" size={18} color="#fff" />
          <Text style={styles.downloadBtnText}>Download Report Card (PDF)</Text>
        </TouchableOpacity>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  examChips: { paddingHorizontal: 16, gap: 10, paddingVertical: 14 },
  examChip: { backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E5E7EB", minWidth: 160 },
  examChipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  examChipText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  examChipTextActive: { color: "#fff" },
  examChipDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  scoreCard: { backgroundColor: "#fff", borderRadius: 18, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: "#F0F0F0", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  scoreLeft: {},
  examType: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  examName: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },
  examDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  scoreRight: { alignItems: "center", gap: 6 },
  gradeCircle: { width: 64, height: 64, borderRadius: 32, borderWidth: 4, alignItems: "center", justifyContent: "center" },
  gradeText: { fontSize: 22, fontFamily: "Inter_700Bold" },
  scorePct: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", gap: 10, marginBottom: 20 },
  statBox: { flex: 1, backgroundColor: "#fff", borderRadius: 14, padding: 12, alignItems: "center", gap: 4, borderWidth: 1, borderColor: "#F0F0F0" },
  statVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  subjectCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0", gap: 8 },
  subjectTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  gradePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  gradePillText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  subjectScore: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  subjectPct: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  progressNote: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#ECFDF5", borderRadius: 14, padding: 14, marginBottom: 14, marginTop: 4 },
  progressNoteText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#065F46", lineHeight: 19 },
  downloadBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15, marginBottom: 8 },
  downloadBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
