import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  ActivityIndicator,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import {
  api,
  type TeacherClassAssignment,
  type AcademicStudent,
  type ClassAttendanceRecord,
} from "@/lib/api";
import { ThemedText as Text } from "@/components/ThemedNative";

type AttStatus = "present" | "absent" | "leave";

const STATUS_CFG: Record<AttStatus, { color: string; bg: string; icon: keyof typeof Ionicons.glyphMap }> = {
  present: { color: "#10B981", bg: "#ECFDF5", icon: "checkmark-circle" },
  absent: { color: "#EF4444", bg: "#FEF2F2", icon: "close-circle" },
  leave: { color: "#F59E0B", bg: "#FFFBEB", icon: "time" },
};

const TODAY = new Date().toISOString().split("T")[0];

export default function TeacherAttendanceScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [classes, setClasses] = useState<TeacherClassAssignment[]>([]);
  const [selectedClass, setSelectedClass] = useState<TeacherClassAssignment | null>(null);
  const [students, setStudents] = useState<AcademicStudent[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({});
  const [history, setHistory] = useState<ClassAttendanceRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [toast, setToast] = useState("");

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
      showToast("Unable to fetch assigned classes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClasses();
  }, [fetchClasses]);

  const fetchClassStudents = useCallback(async (classItem: TeacherClassAssignment) => {
    setStudentsLoading(true);
    setSaved(false);
    try {
      const [roster, attHistory] = await Promise.all([
        api.academicClasses.roster(classItem.id),
        api.academicClasses.attendance(classItem.id),
      ]);

      setStudents(roster);
      setHistory(attHistory);

      // Check if attendance already recorded today
      const todayRecord = attHistory.find((r) => r.date === TODAY);
      if (todayRecord) {
        const existingMap: Record<string, AttStatus> = {};
        todayRecord.students.forEach((s) => {
          existingMap[s.studentId] = s.status;
        });
        setAttendance(existingMap);
        setSaved(true);
      } else {
        // Default all students to present
        const defaultMap: Record<string, AttStatus> = {};
        roster.forEach((s) => {
          defaultMap[s.id] = "present";
        });
        setAttendance(defaultMap);
      }
    } catch {
      showToast("Could not load class roster.");
    } finally {
      setStudentsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClass) {
      fetchClassStudents(selectedClass);
    }
  }, [selectedClass, fetchClassStudents]);

  const markStudent = (studentId: string, status: AttStatus) => {
    setSaved(false);
    setAttendance((prev) => ({ ...prev, [studentId]: status }));
  };

  const markAll = (status: AttStatus) => {
    setSaved(false);
    const updates: Record<string, AttStatus> = {};
    students.forEach((s) => {
      updates[s.id] = status;
    });
    setAttendance(updates);
  };

  const handleSave = async () => {
    if (!selectedClass) return showToast("Select a class first.");
    if (students.length === 0) return showToast("No students enrolled in this class.");

    setSaving(true);
    try {
      const payload = students.map((s) => ({
        studentId: s.id,
        studentName: s.fullName,
        status: attendance[s.id] || "present",
      }));

      await api.academicClasses.recordAttendance(selectedClass.id, {
        date: TODAY,
        students: payload,
      });

      setSaved(true);
      showToast("Attendance saved successfully!");
      // Reload history
      const updatedHistory = await api.academicClasses.attendance(selectedClass.id);
      setHistory(updatedHistory);
    } catch (err: any) {
      showToast(err?.message || "Failed to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const presentCount = students.filter((s) => (attendance[s.id] || "present") === "present").length;
  const absentCount = students.filter((s) => attendance[s.id] === "absent").length;
  const leaveCount = students.filter((s) => attendance[s.id] === "leave").length;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#1E293B" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Daily Attendance</Text>
          <Text style={styles.headerDate}>
            {new Date().toLocaleDateString("en-IN", {
              weekday: "short",
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
        {saved && (
          <View style={styles.savedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#059669" />
            <Text style={styles.savedText}>Saved</Text>
          </View>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 40, gap: 14 }}
      >
        {/* Class Selector Tabs */}
        {loading ? (
          <ActivityIndicator color="#7C3AED" />
        ) : classes.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons name="school-outline" size={32} color="#94A3B8" />
            <Text style={styles.emptyTitle}>No Assigned Classes</Text>
            <Text style={styles.emptyDesc}>Ask your JNV Principal to assign your classes.</Text>
          </View>
        ) : (
          <>
            <View>
              <Text style={styles.sectionHeading}>Select Class Section</Text>
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

            {/* Attendance Overview Stats */}
            <View style={styles.statsRow}>
              <View style={[styles.statBox, { backgroundColor: "#ECFDF5" }]}>
                <Text style={[styles.statVal, { color: "#059669" }]}>{presentCount}</Text>
                <Text style={styles.statLabel}>Present</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: "#FEF2F2" }]}>
                <Text style={[styles.statVal, { color: "#DC2626" }]}>{absentCount}</Text>
                <Text style={styles.statLabel}>Absent</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: "#FFFBEB" }]}>
                <Text style={[styles.statVal, { color: "#D97706" }]}>{leaveCount}</Text>
                <Text style={styles.statLabel}>Leave</Text>
              </View>
              <View style={[styles.statBox, { backgroundColor: "#F8FAFC" }]}>
                <Text style={[styles.statVal, { color: "#334155" }]}>{students.length}</Text>
                <Text style={styles.statLabel}>Total Roll</Text>
              </View>
            </View>

            {/* Quick Actions Row */}
            <View style={styles.quickBar}>
              <Text style={styles.quickBarTitle}>Mark Roster</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TouchableOpacity style={styles.quickBtn} onPress={() => markAll("present")}>
                  <Text style={styles.quickBtnText}>All Present</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.quickBtn, { borderColor: "#FECACA" }]}
                  onPress={() => markAll("absent")}
                >
                  <Text style={[styles.quickBtnText, { color: "#DC2626" }]}>All Absent</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Students List */}
            {studentsLoading ? (
              <ActivityIndicator color="#7C3AED" style={{ paddingVertical: 20 }} />
            ) : students.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={28} color="#94A3B8" />
                <Text style={styles.emptyTitle}>No students enrolled</Text>
                <Text style={styles.emptyDesc}>No students recorded in this class section.</Text>
              </View>
            ) : (
              <View style={styles.studentList}>
                {students.map((student, idx) => {
                  const status = attendance[student.id] || "present";
                  return (
                    <View key={student.id} style={styles.studentRow}>
                      <View style={styles.rollIndex}>
                        <Text style={styles.rollIndexText}>#{idx + 1}</Text>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{student.fullName}</Text>
                        <Text style={styles.studentMeta}>
                          {student.house ? `${student.house} House · ` : ""}
                          {student.class || selectedClass?.className}
                        </Text>
                      </View>

                      {/* Status Toggle Buttons */}
                      <View style={styles.statusGroup}>
                        <TouchableOpacity
                          style={[styles.statusPill, status === "present" && styles.pillPresent]}
                          onPress={() => markStudent(student.id, "present")}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              status === "present" && styles.pillTextActive,
                            ]}
                          >
                            P
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.statusPill, status === "absent" && styles.pillAbsent]}
                          onPress={() => markStudent(student.id, "absent")}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              status === "absent" && styles.pillTextActive,
                            ]}
                          >
                            A
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[styles.statusPill, status === "leave" && styles.pillLeave]}
                          onPress={() => markStudent(student.id, "leave")}
                        >
                          <Text
                            style={[
                              styles.statusPillText,
                              status === "leave" && styles.pillTextActive,
                            ]}
                          >
                            L
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Save Button */}
            {students.length > 0 && (
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleSave}
                disabled={saving}
                activeOpacity={0.8}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <>
                    <Ionicons name="checkmark-done" size={18} color="#FFFFFF" />
                    <Text style={styles.saveBtnText}>Save Today's Attendance</Text>
                  </>
                )}
              </TouchableOpacity>
            )}

            {/* Past History */}
            {history.length > 0 && (
              <View style={styles.historyCard}>
                <Text style={styles.historyCardTitle}>Recent Attendance Logs</Text>
                {history.slice(0, 4).map((h) => {
                  const p = h.students.filter((s) => s.status === "present").length;
                  const pct = h.students.length > 0 ? Math.round((p / h.students.length) * 100) : 0;
                  return (
                    <View key={h.id} style={styles.historyRow}>
                      <View>
                        <Text style={styles.historyDateText}>{h.date}</Text>
                        <Text style={styles.historyMetaText}>
                          {p}/{h.students.length} present · By {h.markedByName}
                        </Text>
                      </View>
                      <View style={styles.pctBadge}>
                        <Text style={styles.pctBadgeText}>{pct}%</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
          </>
        )}
      </ScrollView>

      {/* Toast Notification */}
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
  headerDate: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  savedText: {
    color: "#059669",
    fontSize: 11,
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
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statBox: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statVal: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    marginTop: 2,
  },
  quickBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  quickBarTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  quickBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  quickBtnText: {
    color: "#059669",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  studentList: {
    gap: 8,
  },
  studentRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  rollIndex: {
    width: 24,
  },
  rollIndexText: {
    color: "#94A3B8",
    fontSize: 10.5,
    fontFamily: "Inter_600SemiBold",
  },
  studentName: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  studentMeta: {
    color: "#64748B",
    fontSize: 11,
    fontFamily: "Inter_400Regular",
  },
  statusGroup: {
    flexDirection: "row",
    gap: 4,
  },
  statusPill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  pillPresent: {
    backgroundColor: "#10B981",
  },
  pillAbsent: {
    backgroundColor: "#EF4444",
  },
  pillLeave: {
    backgroundColor: "#F59E0B",
  },
  statusPillText: {
    color: "#475569",
    fontSize: 11,
    fontFamily: "Inter_700Bold",
  },
  pillTextActive: {
    color: "#FFFFFF",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 4,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 13.5,
    fontFamily: "Inter_600SemiBold",
  },
  historyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 8,
  },
  historyCardTitle: {
    color: "#0F172A",
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    marginBottom: 2,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  historyDateText: {
    color: "#0F172A",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  historyMetaText: {
    color: "#64748B",
    fontSize: 10.5,
    fontFamily: "Inter_400Regular",
  },
  pctBadge: {
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  pctBadgeText: {
    color: "#059669",
    fontSize: 11,
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
