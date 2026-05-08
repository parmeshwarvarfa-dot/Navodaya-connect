import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const CLASSES = ["Class 11 Sci A", "Class 12 Sci B", "Class 10 A"];
const SUBJECTS = ["Physics", "Chemistry", "Maths"];

const STUDENTS_BY_CLASS: Record<string, string[]> = {
  "Class 11 Sci A": ["Ananya Sharma", "Rohit Kumar", "Priya Mehta", "Rahul Singh", "Kavya Nair", "Dev Patel", "Sneha Gupta", "Arjun Das"],
  "Class 12 Sci B": ["Meera Iyer", "Karan Verma", "Tanya Singh", "Vikas Rao", "Pooja Joshi", "Aditya Mishra"],
  "Class 10 A":     ["Simran Kaur", "Raj Malhotra", "Neha Sharma", "Amit Dubey", "Ritika Gupta", "Suresh Yadav"],
};

type AttStatus = "present" | "absent" | "late";
const STATUS_CFG: Record<AttStatus, { color: string; bg: string; icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap }> = {
  present: { color: "#10B981", bg: "#ECFDF5", icon: "checkmark-circle"  },
  absent:  { color: "#EF4444", bg: "#FEF2F2", icon: "close-circle"      },
  late:    { color: "#F59E0B", bg: "#FFFBEB", icon: "time"              },
};

const TODAY = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });

export default function TeacherAttendanceScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [activeClass,   setActiveClass]   = useState(CLASSES[0]);
  const [attendance,    setAttendance]    = useState<Record<string, AttStatus>>({});
  const [saved,         setSaved]         = useState(false);
  const [toast,         setToast]         = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const students = STUDENTS_BY_CLASS[activeClass] || [];

  const mark = (name: string, status: AttStatus) => {
    setSaved(false);
    setAttendance((p) => ({ ...p, [`${activeClass}__${name}`]: status }));
  };

  const getStatus = (name: string): AttStatus | null =>
    attendance[`${activeClass}__${name}`] || null;

  const markAll = (status: AttStatus) => {
    setSaved(false);
    const updates: Record<string, AttStatus> = {};
    students.forEach((s) => { updates[`${activeClass}__${s}`] = status; });
    setAttendance((p) => ({ ...p, ...updates }));
  };

  const handleSave = () => {
    const unmarked = students.filter((s) => !getStatus(s));
    if (unmarked.length > 0) { showToast(`${unmarked.length} student(s) not marked yet.`); return; }
    setSaved(true);
    showToast("Attendance saved successfully!");
  };

  const presentCount = students.filter((s) => getStatus(s) === "present").length;
  const absentCount  = students.filter((s) => getStatus(s) === "absent").length;
  const lateCount    = students.filter((s) => getStatus(s) === "late").length;
  const markedCount  = students.filter((s) => !!getStatus(s)).length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Mark Attendance</Text>
          <Text style={styles.headerDate}>{TODAY}</Text>
        </View>
        {saved && <View style={styles.savedBadge}><Ionicons name="checkmark-circle" size={14} color="#10B981" /><Text style={styles.savedText}>Saved</Text></View>}
      </View>

      {/* Class selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classTabs} style={{ flexGrow: 0 }}>
        {CLASSES.map((c) => (
          <TouchableOpacity key={c} style={[styles.classTab, activeClass === c && styles.classTabActive]} onPress={() => { setActiveClass(c); setSaved(false); }}>
            <Text style={[styles.classTabText, activeClass === c && styles.classTabTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Present", value: presentCount, color: "#10B981", bg: "#ECFDF5" },
          { label: "Absent",  value: absentCount,  color: "#EF4444", bg: "#FEF2F2" },
          { label: "Late",    value: lateCount,     color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Total",   value: students.length, color: "#6B7280", bg: "#F3F4F6" },
        ].map((s) => (
          <View key={s.label} style={[styles.statBox, { backgroundColor: s.bg }]}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Quick mark all */}
      <View style={styles.quickMarkRow}>
        <Text style={styles.quickMarkLabel}>Mark all:</Text>
        {(["present", "absent", "late"] as AttStatus[]).map((status) => {
          const cfg = STATUS_CFG[status];
          return (
            <TouchableOpacity key={status} style={[styles.quickMarkBtn, { backgroundColor: cfg.bg, borderColor: cfg.color + "40" }]} onPress={() => markAll(status)}>
              <Ionicons name={cfg.icon} size={14} color={cfg.color} />
              <Text style={[styles.quickMarkText, { color: cfg.color }]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        <Text style={styles.sectionTitle}>{activeClass} · {markedCount}/{students.length} marked</Text>

        {students.map((student, i) => {
          const status = getStatus(student);
          return (
            <View key={student} style={styles.studentRow}>
              <View style={styles.studentLeft}>
                <View style={[styles.studentAvatar, status && { backgroundColor: STATUS_CFG[status].bg }]}>
                  <Text style={[styles.studentAvatarText, status && { color: STATUS_CFG[status].color }]}>{student[0]}</Text>
                </View>
                <View>
                  <Text style={styles.studentName}>{student}</Text>
                  <Text style={styles.studentRoll}>Roll No. {String(i + 1).padStart(2, "0")}</Text>
                </View>
              </View>
              <View style={styles.markBtns}>
                {(["present", "absent", "late"] as AttStatus[]).map((s) => {
                  const cfg = STATUS_CFG[s];
                  const isActive = status === s;
                  return (
                    <TouchableOpacity
                      key={s}
                      style={[styles.markBtn, isActive && { backgroundColor: cfg.bg, borderColor: cfg.color }]}
                      onPress={() => mark(student, s)}
                    >
                      <Ionicons name={cfg.icon} size={18} color={isActive ? cfg.color : "#D1D5DB"} />
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          );
        })}

        <TouchableOpacity style={[styles.saveBtn, saved && styles.saveBtnDone]} onPress={handleSave}>
          <Ionicons name={saved ? "checkmark-circle" : "save-outline"} size={18} color="#fff" />
          <Text style={styles.saveBtnText}>{saved ? "Attendance Saved" : "Save Attendance"}</Text>
        </TouchableOpacity>
      </ScrollView>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  headerDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  savedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  savedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  classTabs: { paddingHorizontal: 16, gap: 8, paddingVertical: 12 },
  classTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  classTabActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  classTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  classTabTextActive: { color: "#fff" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginBottom: 12 },
  statBox: { flex: 1, borderRadius: 12, padding: 10, alignItems: "center", gap: 2 },
  statVal: { fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },
  quickMarkRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 14 },
  quickMarkLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  quickMarkBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  quickMarkText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 12 },
  studentRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  studentLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  studentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  studentAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#9CA3AF" },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  studentRoll: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  markBtns: { flexDirection: "row", gap: 6 },
  markBtn: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB" },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15, marginTop: 8 },
  saveBtnDone: { backgroundColor: "#10B981" },
  saveBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
