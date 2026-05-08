import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const ASSIGNED_CLASSES = [
  {
    id: "1", name: "Class 11 Sci A", subject: "Physics", room: "Lab 1", strength: 34,
    students: [
      { name: "Ananya Sharma", roll: "01", attendance: 92, lastResult: "A+"  },
      { name: "Rohit Kumar",   roll: "02", attendance: 84, lastResult: "A"   },
      { name: "Priya Mehta",   roll: "03", attendance: 78, lastResult: "B+"  },
      { name: "Rahul Singh",   roll: "04", attendance: 69, lastResult: "B"   },
      { name: "Kavya Nair",    roll: "05", attendance: 95, lastResult: "A+"  },
      { name: "Dev Patel",     roll: "06", attendance: 88, lastResult: "A"   },
    ],
    pendingAssignments: 2, nextClass: "Tomorrow 08:00 AM",
  },
  {
    id: "2", name: "Class 12 Sci B", subject: "Physics", room: "Lab 2", strength: 28,
    students: [
      { name: "Meera Iyer",   roll: "01", attendance: 90, lastResult: "A+"  },
      { name: "Karan Verma",  roll: "02", attendance: 76, lastResult: "A"   },
      { name: "Tanya Singh",  roll: "03", attendance: 82, lastResult: "B+"  },
      { name: "Vikas Rao",    roll: "04", attendance: 65, lastResult: "B"   },
    ],
    pendingAssignments: 1, nextClass: "Today 09:15 AM",
  },
  {
    id: "3", name: "Class 10 A", subject: "Chemistry", room: "C-09", strength: 38,
    students: [
      { name: "Simran Kaur",  roll: "01", attendance: 88, lastResult: "A"   },
      { name: "Raj Malhotra", roll: "02", attendance: 73, lastResult: "B+"  },
      { name: "Neha Sharma",  roll: "03", attendance: 91, lastResult: "A+"  },
    ],
    pendingAssignments: 3, nextClass: "Tomorrow 11:30 AM",
  },
];

const GRADE_COLOR: Record<string, string> = { "A+": "#10B981", "A": "#3D5AF1", "B+": "#8B5CF6", "B": "#F59E0B", "C": "#EF4444" };
const ATT_COLOR = (pct: number) => pct >= 85 ? "#10B981" : pct >= 75 ? "#F59E0B" : "#EF4444";

export default function TeacherClassesScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [expanded, setExpanded] = useState<string | null>(ASSIGNED_CLASSES[0].id);
  const [activeTab, setActiveTab] = useState<"students" | "actions">("students");

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Assigned Classes</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
        {ASSIGNED_CLASSES.map((cls) => {
          const isEx = expanded === cls.id;
          const avgAtt = Math.round(cls.students.reduce((s, st) => s + st.attendance, 0) / cls.students.length);

          return (
            <View key={cls.id} style={styles.classCard}>
              <TouchableOpacity onPress={() => setExpanded(isEx ? null : cls.id)} activeOpacity={0.85}>
                <View style={styles.classTop}>
                  <View style={styles.classIconWrap}><Ionicons name="school-outline" size={22} color="#3D5AF1" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.className}>{cls.name}</Text>
                    <Text style={styles.classMeta}>{cls.subject} · {cls.room} · {cls.strength} students</Text>
                  </View>
                  <View style={styles.nextClassBadge}>
                    <Text style={styles.nextClassText}>{cls.nextClass.split(" ")[0]}</Text>
                  </View>
                  <Ionicons name={isEx ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                </View>

                <View style={styles.classStats}>
                  {[
                    { label: "Strength",  value: String(cls.strength),         color: "#3D5AF1" },
                    { label: "Avg Att.",  value: `${avgAtt}%`,                  color: ATT_COLOR(avgAtt) },
                    { label: "Pending",   value: String(cls.pendingAssignments), color: "#F59E0B" },
                    { label: "Next",      value: cls.nextClass.split(" ")[0],   color: "#10B981" },
                  ].map((s) => (
                    <View key={s.label} style={styles.statChip}>
                      <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                      <Text style={styles.statLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>

              {isEx && (
                <View style={styles.expanded}>
                  {/* Tab toggle */}
                  <View style={styles.tabToggle}>
                    {(["students", "actions"] as const).map((t) => (
                      <TouchableOpacity key={t} style={[styles.toggleBtn, activeTab === t && styles.toggleBtnActive]} onPress={() => setActiveTab(t)}>
                        <Text style={[styles.toggleBtnText, activeTab === t && styles.toggleBtnTextActive]}>
                          {t === "students" ? "Student List" : "Quick Actions"}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {activeTab === "students" && (
                    <>
                      <Text style={styles.subTitle}>{cls.students.length} of {cls.strength} shown</Text>
                      {cls.students.map((st) => {
                        const attColor = ATT_COLOR(st.attendance);
                        const gradeColor = GRADE_COLOR[st.lastResult] || "#6B7280";
                        return (
                          <View key={st.name} style={styles.studentRow}>
                            <View style={styles.studentAvatar}><Text style={styles.studentAvatarText}>{st.name[0]}</Text></View>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.studentName}>{st.name}</Text>
                              <View style={styles.studentMeta}>
                                <Text style={styles.rollText}>Roll {st.roll}</Text>
                                <View style={[styles.attPill, { backgroundColor: attColor + "18" }]}>
                                  <Text style={[styles.attText, { color: attColor }]}>{st.attendance}% att.</Text>
                                </View>
                              </View>
                            </View>
                            <View style={[styles.gradePill, { backgroundColor: gradeColor + "18" }]}>
                              <Text style={[styles.gradeText, { color: gradeColor }]}>{st.lastResult}</Text>
                            </View>
                          </View>
                        );
                      })}
                    </>
                  )}

                  {activeTab === "actions" && (
                    <View style={styles.actionsGrid}>
                      {[
                        { label: "Mark Attendance", icon: "calendar-clear-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/teacher-attendance" },
                        { label: "Upload Notes",    icon: "cloud-upload-outline"   as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/teacher-upload" },
                        { label: "Assignments",     icon: "checkbox-outline"        as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/teacher-assignments" },
                        { label: "Announcements",   icon: "megaphone-outline"       as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/teacher-announcements" },
                        { label: "Results",         icon: "stats-chart-outline"    as const, color: "#0891B2", bg: "#E0F2FE", route: "/(screens)/teacher-results" },
                        { label: "Queries",         icon: "help-circle-outline"    as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/teacher-queries" },
                      ].map((a) => (
                        <TouchableOpacity key={a.label} style={styles.actionCard} onPress={() => router.push(a.route as any)}>
                          <View style={[styles.actionIcon, { backgroundColor: a.bg }]}>
                            <Ionicons name={a.icon} size={22} color={a.color} />
                          </View>
                          <Text style={styles.actionLabel}>{a.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  classCard: { backgroundColor: "#fff", borderRadius: 18, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: "#F0F0F0" },
  classTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  classIconWrap: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  className: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 3 },
  classMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  nextClassBadge: { backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  nextClassText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  classStats: { flexDirection: "row", gap: 8 },
  statChip: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 8, alignItems: "center" },
  statVal: { fontSize: 14, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  expanded: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14 },
  tabToggle: { flexDirection: "row", backgroundColor: "#F3F4F6", borderRadius: 12, padding: 3, marginBottom: 14 },
  toggleBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#fff" },
  toggleBtnText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  toggleBtnTextActive: { color: "#111827", fontFamily: "Inter_600SemiBold" },
  subTitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 10 },
  studentRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  studentAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  studentAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  studentMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  rollText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  attPill: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  attText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  gradePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  gradeText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  actionCard: { width: "30%", backgroundColor: "#F9FAFB", borderRadius: 14, padding: 12, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  actionIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#374151", textAlign: "center" },
});
