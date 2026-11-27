import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  api,
  type TeacherClassAssignment,
  type AcademicStudent,
  type ClassAssessmentRecord,
} from "@/lib/api";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const GRADE_COLOR: Record<string, string> = {
  "A+": "#10B981",
  A: "#7C3AED",
  "B+": "#8B5CF6",
  B: "#F59E0B",
  C: "#EF4444",
  D: "#F97316",
  E: "#DC2626",
};

export default function TeacherResultsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [classes, setClasses] = useState<TeacherClassAssignment[]>([]);
  const [selectedClass, setSelectedClass] = useState<TeacherClassAssignment | null>(null);
  const [students, setStudents] = useState<AcademicStudent[]>([]);
  const [assessments, setAssessments] = useState<ClassAssessmentRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState("");

  // Create Assessment Modal
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [maxMarks, setMaxMarks] = useState("50");
  const [examDate, setExamDate] = useState(new Date().toISOString().split("T")[0]);
  const [studentMarks, setStudentMarks] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.academicClasses.list();
      const active = list.filter((c) => c.active);
      setClasses(active);
      if (active.length > 0) {
        setSelectedClass(active[0]);
      }
    } catch {
      showToast("Unable to load assigned classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const loadClassAssessments = useCallback(async (classItem: TeacherClassAssignment) => {
    setDataLoading(true);
    try {
      const [roster, resultsList] = await Promise.all([
        api.academicClasses.roster(classItem.id),
        api.academicClasses.results(classItem.id),
      ]);
      setStudents(roster);
      setAssessments(resultsList);
    } catch {
      showToast("Could not load class marks.");
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadClassAssessments(selectedClass);
    }
  }, [selectedClass, loadClassAssessments]);

  const handleSaveAssessment = async () => {
    if (!selectedClass) return showToast("Select a class first.");
    if (!title.trim() || !maxMarks) return showToast("Enter title and max marks.");
    const total = Number(maxMarks);
    if (isNaN(total) || total <= 0) return showToast("Enter a valid maximum marks number.");

    setSubmitting(true);
    try {
      const scoresPayload = students.map((s) => {
        const raw = studentMarks[s.id];
        const marksObtained = raw !== undefined && raw.trim() !== "" ? Number(raw) : 0;
        return {
          studentId: s.id,
          studentName: s.fullName,
          marksObtained: Math.min(Math.max(0, marksObtained), total),
        };
      });

      await api.academicClasses.recordAssessment(selectedClass.id, {
        title: title.trim(),
        subject: selectedClass.subject,
        totalMarks: total,
        date: examDate,
        scores: scoresPayload,
        published: true,
      });

      showToast("Results recorded and published!");
      setShowCreate(false);
      setTitle("");
      setStudentMarks({});

      // Reload
      const updated = await api.academicClasses.results(selectedClass.id);
      setAssessments(updated);
    } catch (err: any) {
      showToast(err?.message || "Failed to save results.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Academic Results & Tests</Text>
          <Text style={styles.headerSubtitle}>Record assessments, unit marks and term grading</Text>
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => setShowCreate(true)}
          disabled={!selectedClass}
        >
          <Ionicons name="add" size={18} color="#FFFFFF" />
          <Text style={styles.addBtnText}>New Test</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
      >
        {/* Class Selection Tabs */}
        {loading ? (
          <ActivityIndicator color="#7C3AED" />
        ) : classes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="school-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Classes Assigned</Text>
            <Text style={styles.emptyDesc}>Contact your JNV Principal to assign your academic classes.</Text>
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.sectionHeading}>Class Section</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.classTabs}
              >
                {classes.map((c) => {
                  const isSelected = selectedClass?.id === c.id;
                  return (
                    <TouchableOpacity
                      key={c.id}
                      style={[styles.classTab, isSelected && styles.classTabActive]}
                      onPress={() => setSelectedClass(c)}
                    >
                      <Text style={[styles.classTabText, isSelected && styles.classTabTextActive]}>
                        {c.className} {c.section && c.section !== "Unspecified" ? `(${c.section})` : ""}
                      </Text>
                      <Text style={[styles.classTabSub, isSelected && styles.classTabSubActive]}>
                        {c.subject}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {/* Assessment Records */}
            {dataLoading ? (
              <ActivityIndicator color="#7C3AED" style={{ paddingVertical: 20 }} />
            ) : assessments.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="stats-chart-outline" size={32} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No Assessments Recorded Yet</Text>
                <Text style={styles.emptyDesc}>
                  Tap "+ New Test" above to record marks and grade your students for{" "}
                  {selectedClass?.className}.
                </Text>
              </View>
            ) : (
              <View style={{ gap: 12 }}>
                {assessments.map((ass) => {
                  const passCount = ass.scores.filter(
                    (s) => ass.totalMarks > 0 && (s.marksObtained / ass.totalMarks) >= 0.4
                  ).length;
                  const passRate =
                    ass.scores.length > 0 ? Math.round((passCount / ass.scores.length) * 100) : 0;

                  return (
                    <View key={ass.id} style={styles.assessmentCard}>
                      <View style={styles.cardTop}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.cardTitle}>{ass.title}</Text>
                          <Text style={styles.cardMeta}>
                            {ass.subject} · Total Marks: {ass.totalMarks} · Date: {ass.date}
                          </Text>
                        </View>
                        <View style={styles.passChip}>
                          <Text style={styles.passChipText}>{passRate}% Passed</Text>
                        </View>
                      </View>

                      {/* Score Roll */}
                      <View style={styles.scoresWrap}>
                        <Text style={styles.scoresHeading}>
                          Student Marks Roll ({ass.scores.length})
                        </Text>
                        {ass.scores.map((score, idx) => {
                          const gradeColor = GRADE_COLOR[score.grade || "A"] || "#7C3AED";
                          return (
                            <View key={score.studentId} style={styles.scoreRow}>
                              <Text style={styles.scoreIndex}>#{idx + 1}</Text>
                              <Text style={styles.scoreStudentName}>{score.studentName}</Text>
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                                <Text style={styles.scoreValue}>
                                  {score.marksObtained}/{ass.totalMarks}
                                </Text>
                                <View style={[styles.gradeBadge, { backgroundColor: `${gradeColor}18` }]}>
                                  <Text style={[styles.gradeBadgeText, { color: gradeColor }]}>
                                    {score.grade || "A"}
                                  </Text>
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Modal: Create Assessment */}
      <Modal visible={showCreate} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: "90%" }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Record New Assessment</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <Ionicons name="close" size={22} color="#1E293B" />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={{ gap: 12 }}>
              <View>
                <Text style={styles.inputLabel}>Assessment Title *</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Unit Test 1 / Mid-Term Exam"
                  value={title}
                  onChangeText={setTitle}
                />
              </View>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Maximum Marks *</Text>
                  <TextInput
                    style={styles.textInput}
                    keyboardType="numeric"
                    value={maxMarks}
                    onChangeText={setMaxMarks}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.inputLabel}>Exam Date</Text>
                  <TextInput
                    style={styles.textInput}
                    value={examDate}
                    onChangeText={setExamDate}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabel, { marginTop: 6 }]}>Student Marks Entry</Text>
              <View style={{ gap: 8 }}>
                {students.map((student) => (
                  <View key={student.id} style={styles.scoreInputRow}>
                    <Text style={styles.scoreInputName}>{student.fullName}</Text>
                    <TextInput
                      style={styles.scoreInputBox}
                      placeholder="0"
                      keyboardType="numeric"
                      value={studentMarks[student.id] || ""}
                      onChangeText={(val) =>
                        setStudentMarks((prev) => ({ ...prev, [student.id]: val }))
                      }
                    />
                  </View>
                ))}
              </View>

              <TouchableOpacity
                style={styles.modalPrimaryBtn}
                onPress={handleSaveAssessment}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.modalPrimaryBtnText}>Save & Publish Marks</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Floating Toast */}
      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F7FB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  headerSubtitle: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  addBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  sectionHeading: {
    color: "#334155",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 6,
  },
  classTabs: {
    gap: 8,
  },
  classTab: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  classTabActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  classTabText: {
    color: "#334155",
    fontSize: 12.5,
    fontFamily: "Inter_600SemiBold",
  },
  classTabTextActive: {
    color: "#FFFFFF",
  },
  classTabSub: {
    color: "#64748B",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
  classTabSubActive: {
    color: "rgba(255, 255, 255, 0.8)",
  },
  assessmentCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 10,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  cardTitle: {
    color: "#0F172A",
    fontSize: 14.5,
    fontFamily: "Inter_700Bold",
  },
  cardMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  passChip: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  passChipText: {
    color: "#059669",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  scoresWrap: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    paddingTop: 8,
    gap: 6,
  },
  scoresHeading: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 2,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 3,
  },
  scoreIndex: {
    width: 24,
    color: "#94A3B8",
    fontSize: 10.5,
    fontFamily: "Inter_500Medium",
  },
  scoreStudentName: {
    flex: 1,
    color: "#0F172A",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
  },
  scoreValue: {
    color: "#334155",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  gradeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 6,
  },
  gradeBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  emptyCard: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 24,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  emptyTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  emptyDesc: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.6)",
    justifyContent: "center",
    padding: 16,
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 10,
  },
  modalTitle: {
    color: "#0F172A",
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  inputLabel: {
    color: "#334155",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    marginBottom: 4,
  },
  textInput: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
  },
  scoreInputRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  scoreInputName: {
    color: "#0F172A",
    fontSize: 12.5,
    fontFamily: "Inter_500Medium",
    flex: 1,
  },
  scoreInputBox: {
    width: 60,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    textAlign: "center",
  },
  modalPrimaryBtn: {
    backgroundColor: "#7C3AED",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
  },
  modalPrimaryBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  toast: {
    position: "absolute",
    bottom: 32,
    left: 20,
    right: 20,
    backgroundColor: "rgba(15, 23, 42, 0.92)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toastText: {
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 13,
  },
});
