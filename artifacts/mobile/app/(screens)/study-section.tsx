import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  { label: "Study Notes",    icon: "document-text-outline"  as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/study-notes"       },
  { label: "Assignments",    icon: "checkbox-outline"        as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/study-assignments"  },
  { label: "Announcements",  icon: "megaphone-outline"       as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/news"               },
  { label: "Ask Queries",    icon: "help-circle-outline"    as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/ask-senior"         },
  { label: "Attendance",     icon: "calendar-clear-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/study-attendance"   },
  { label: "Results",        icon: "stats-chart-outline"    as const, color: "#0891B2", bg: "#E0F2FE", route: "/(screens)/study-results"      },
  { label: "Chats",          icon: "chatbubbles-outline"    as const, color: "#6366F1", bg: "#EEF2FF", route: "/(tabs)/chats"                 },
  { label: "Clubs",          icon: "people-circle-outline"  as const, color: "#EC4899", bg: "#FDF2F8", route: "/(screens)/study-clubs"        },
  { label: "Feedback",       icon: "star-outline"            as const, color: "#D97706", bg: "#FFFBEB", route: "/(screens)/study-feedback"     },
];

const TODAY_CLASSES = [
  { subject: "Physics",  time: "08:00–09:00", teacher: "Mr. Ramesh Kumar",  room: "Lab 1" },
  { subject: "Maths",    time: "09:15–10:15", teacher: "Ms. Asha Sharma",   room: "C-12" },
  { subject: "English",  time: "10:30–11:30", teacher: "Mr. Sunil Tiwari",  room: "C-08" },
  { subject: "Chemistry",time: "12:00–13:00", teacher: "Ms. Pooja Devi",    room: "Lab 2" },
];

const PENDING_ASSIGNMENTS = [
  { title: "Newton's Laws Problems",   subject: "Physics",   due: "Tomorrow",   priority: "high"   },
  { title: "Quadratic Equations",      subject: "Maths",     due: "3 days",     priority: "medium" },
  { title: "Essay: Seasons",           subject: "English",   due: "5 days",     priority: "low"    },
];

const RECENT_NOTES = [
  { title: "Electromagnetic Waves",     subject: "Physics",   teacher: "Mr. Ramesh",  type: "PDF",  date: "Today"     },
  { title: "Trigonometry Formulas",     subject: "Maths",     teacher: "Ms. Asha",    type: "Notes","date": "Yesterday"},
  { title: "Organic Chemistry Notes",   subject: "Chemistry", teacher: "Ms. Pooja",   type: "PDF",  date: "2 days ago" },
];

const UPCOMING = [
  { title: "Unit Test – Physics",   date: "10 May",  icon: "create-outline"   as const, color: "#EF4444" },
  { title: "Practical – Chemistry", date: "14 May",  icon: "flask-outline"    as const, color: "#10B981" },
  { title: "Sports Day",            date: "18 May",  icon: "football-outline" as const, color: "#F59E0B" },
];

export default function StudySectionScreen() {
  const insets   = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const now      = new Date();
  const hour     = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const currentClass = TODAY_CLASSES.find((c) => {
    const [start] = c.time.split("–");
    const [h, m]  = start.split(":").map(Number);
    const diff    = hour * 60 + now.getMinutes() - (h * 60 + m);
    return diff >= 0 && diff < 60;
  });

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreet}>{greeting}, {profile?.fullName?.split(" ")[0] || "Student"}</Text>
          <Text style={styles.headerTitle}>📚 Study Hub</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/(screens)/notifications" as any)}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>

        {/* Stats row */}
        <View style={styles.statsRow}>
          {[
            { label: "Attendance",   value: "84%",  icon: "calendar-outline"  as const, color: "#10B981", bg: "#ECFDF5" },
            { label: "Pending",      value: String(PENDING_ASSIGNMENTS.length), icon: "checkbox-outline" as const, color: "#F59E0B", bg: "#FFFBEB" },
            { label: "Materials",    value: "12",   icon: "document-outline"  as const, color: "#3D5AF1", bg: "#EEF2FF" },
            { label: "Rank",         value: "#4",   icon: "trophy-outline"    as const, color: "#D97706", bg: "#FEF3C7" },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Today's class / now */}
        {currentClass ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🟢 Now in Class</Text>
            <LinearGradient colors={["#10B981", "#059669"]} style={styles.nowCard}>
              <Text style={styles.nowSubject}>{currentClass.subject}</Text>
              <Text style={styles.nowTeacher}>{currentClass.teacher}</Text>
              <Text style={styles.nowTime}>{currentClass.time} · {currentClass.room}</Text>
            </LinearGradient>
          </View>
        ) : null}

        {/* Today's timetable */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's Classes</Text>
            <TouchableOpacity><Text style={styles.seeAll}>Full Timetable</Text></TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {TODAY_CLASSES.map((cls, i) => (
              <View key={i} style={styles.classCard}>
                <Text style={styles.classTime}>{cls.time}</Text>
                <Text style={styles.classSubject}>{cls.subject}</Text>
                <Text style={styles.classTeacher}>{cls.teacher}</Text>
                <View style={styles.classRoom}><Ionicons name="location-outline" size={10} color="#6B7280" /><Text style={styles.classRoomText}>{cls.room}</Text></View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Pending assignments */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Pending Assignments</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/study-assignments" as any)}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {PENDING_ASSIGNMENTS.map((a, i) => (
            <TouchableOpacity key={i} style={styles.assignRow} activeOpacity={0.8} onPress={() => router.push("/(screens)/study-assignments" as any)}>
              <View style={[styles.priorityDot, { backgroundColor: a.priority === "high" ? "#EF4444" : a.priority === "medium" ? "#F59E0B" : "#10B981" }]} />
              <View style={{ flex: 1 }}>
                <Text style={styles.assignTitle}>{a.title}</Text>
                <Text style={styles.assignMeta}>{a.subject} · Due in {a.due}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {UPCOMING.map((u, i) => (
              <View key={i} style={[styles.upcomingCard, { borderLeftColor: u.color }]}>
                <Ionicons name={u.icon} size={20} color={u.color} />
                <Text style={styles.upcomingTitle}>{u.title}</Text>
                <Text style={styles.upcomingDate}>{u.date}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Recent Notes */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Materials</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/study-notes" as any)}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {RECENT_NOTES.map((n, i) => (
            <TouchableOpacity key={i} style={styles.noteRow} activeOpacity={0.8} onPress={() => router.push("/(screens)/study-notes" as any)}>
              <View style={styles.noteIcon}><Ionicons name="document-text-outline" size={18} color="#3D5AF1" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.noteTitle}>{n.title}</Text>
                <Text style={styles.noteMeta}>{n.subject} · {n.teacher} · {n.date}</Text>
              </View>
              <View style={styles.noteTypeBadge}><Text style={styles.noteTypeText}>{n.type}</Text></View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Feature Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Study Features</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <TouchableOpacity key={f.label} style={styles.featureCard} activeOpacity={0.75} onPress={() => router.push(f.route as any)}>
                <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon} size={24} color={f.color} />
                </View>
                <Text style={styles.featureLabel}>{f.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerGreet: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  notifBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 4 },
  statVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  nowCard: { borderRadius: 16, padding: 18 },
  nowSubject: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 4 },
  nowTeacher: { color: "rgba(255,255,255,0.8)", fontSize: 14, fontFamily: "Inter_500Medium", marginBottom: 4 },
  nowTime: { color: "rgba(255,255,255,0.65)", fontSize: 12, fontFamily: "Inter_400Regular" },
  classCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 160, borderWidth: 1, borderColor: "#F0F0F0", gap: 4 },
  classTime: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#3D5AF1", marginBottom: 2 },
  classSubject: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  classTeacher: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  classRoom: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  classRoomText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  assignRow: {
    flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff",
    borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0",
  },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  assignTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  assignMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  upcomingCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 150, borderWidth: 1, borderColor: "#F0F0F0", borderLeftWidth: 4, gap: 6 },
  upcomingTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", lineHeight: 18 },
  upcomingDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  noteRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  noteIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  noteTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  noteMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  noteTypeBadge: { backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  noteTypeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#374151" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  featureCard: { width: "30%", backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  featureIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#111827", textAlign: "center" },
});
