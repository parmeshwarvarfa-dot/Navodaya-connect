import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  { label: "Upload Notes",     icon: "cloud-upload-outline"   as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/teacher-upload"        },
  { label: "Assignments",      icon: "checkbox-outline"        as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/teacher-assignments"    },
  { label: "Announcements",    icon: "megaphone-outline"       as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/teacher-announcements"  },
  { label: "Queries",          icon: "help-circle-outline"    as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/teacher-queries"        },
  { label: "Attendance",       icon: "calendar-clear-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/teacher-attendance"     },
  { label: "Results",          icon: "stats-chart-outline"    as const, color: "#0891B2", bg: "#E0F2FE", route: "/(screens)/teacher-results"        },
  { label: "Chats",            icon: "chatbubbles-outline"    as const, color: "#6366F1", bg: "#EEF2FF", route: "/(tabs)/chats"                     },
  { label: "Clubs",            icon: "people-circle-outline"  as const, color: "#EC4899", bg: "#FDF2F8", route: "/(screens)/teacher-clubs"          },
  { label: "Feedback",         icon: "star-half-outline"      as const, color: "#D97706", bg: "#FFFBEB", route: "/(screens)/teacher-feedback"       },
  { label: "My Classes",       icon: "school-outline"         as const, color: "#16A34A", bg: "#F0FDF4", route: "/(screens)/teacher-classes"        },
];

const TODAY_CLASSES = [
  { subject: "Physics",   class: "Class 11 Sci A", time: "08:00–09:00", room: "Lab 1"  },
  { subject: "Physics",   class: "Class 12 Sci B", time: "09:15–10:15", room: "Lab 2"  },
  { subject: "Chemistry", class: "Class 10 A",     time: "11:30–12:30", room: "C-09"   },
];

const PENDING_REVIEWS = [
  { title: "Newton's Laws Problems", class: "Class 11 Sci A", submitted: 18, total: 32 },
  { title: "Organic Chemistry",       class: "Class 12 Sci B", submitted: 12, total: 28 },
];

const RECENT_QUERIES = [
  { student: "Ananya S.", question: "Can you explain electromagnetic induction again?", subject: "Physics",   time: "2h ago"  },
  { student: "Rohit K.",  question: "What is the difference between NPN and PNP?",       subject: "Physics",   time: "5h ago"  },
  { student: "Priya M.",  question: "How to solve quadratic equations with complex roots?",subject: "Maths",    time: "Yesterday"},
];

const UPCOMING_TASKS = [
  { title: "Mid-Term Results Due",     date: "10 May", icon: "stats-chart-outline" as const, color: "#EF4444" },
  { title: "Practical Exam — Chem",   date: "14 May", icon: "flask-outline"       as const, color: "#10B981" },
  { title: "Parent-Teacher Meeting",   date: "17 May", icon: "people-outline"      as const, color: "#8B5CF6" },
];

export default function TeacherZoneScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const now    = new Date();
  const hour   = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  const pendingReviewCount = PENDING_REVIEWS.reduce((s, r) => s + r.submitted, 0);
  const unansweredQueries  = RECENT_QUERIES.length;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreet}>{greeting}, {profile?.fullName?.split(" ")[0] || "Teacher"}</Text>
          <Text style={styles.headerTitle}>👨‍🏫 Teacher Zone</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/(screens)/notifications" as any)}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Classes Today", value: String(TODAY_CLASSES.length), icon: "school-outline"      as const, color: "#3D5AF1", bg: "#EEF2FF" },
            { label: "To Review",     value: String(pendingReviewCount),    icon: "checkbox-outline"    as const, color: "#F59E0B", bg: "#FFFBEB" },
            { label: "Queries",       value: String(unansweredQueries),     icon: "help-circle-outline" as const, color: "#8B5CF6", bg: "#F5F3FF" },
            { label: "Uploaded",      value: "24",                          icon: "document-outline"    as const, color: "#10B981", bg: "#ECFDF5" },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Today's classes */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Today's Classes</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/teacher-classes" as any)}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {TODAY_CLASSES.map((cls, i) => (
              <View key={i} style={styles.classCard}>
                <Text style={styles.classTime}>{cls.time}</Text>
                <Text style={styles.classSubject}>{cls.subject}</Text>
                <Text style={styles.classGroup}>{cls.class}</Text>
                <View style={styles.classRoom}>
                  <Ionicons name="location-outline" size={10} color="#6B7280" />
                  <Text style={styles.classRoomText}>{cls.room}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Pending Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Pending Reviews</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/teacher-assignments" as any)}>
              <Text style={styles.seeAll}>Review All</Text>
            </TouchableOpacity>
          </View>
          {PENDING_REVIEWS.map((r, i) => {
            const pct = Math.round((r.submitted / r.total) * 100);
            return (
              <TouchableOpacity key={i} style={styles.reviewRow} onPress={() => router.push("/(screens)/teacher-assignments" as any)}>
                <View style={styles.reviewIcon}><Ionicons name="document-text-outline" size={18} color="#F59E0B" /></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.reviewTitle}>{r.title}</Text>
                  <Text style={styles.reviewMeta}>{r.class} · {r.submitted}/{r.total} submitted</Text>
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` }]} />
                  </View>
                </View>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Recent Queries */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Queries</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/teacher-queries" as any)}>
              <Text style={styles.seeAll}>Answer All</Text>
            </TouchableOpacity>
          </View>
          {RECENT_QUERIES.map((q, i) => (
            <TouchableOpacity key={i} style={styles.queryRow} onPress={() => router.push("/(screens)/teacher-queries" as any)}>
              <View style={styles.queryAvatar}><Text style={styles.queryAvatarText}>{q.student[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.queryStudent}>{q.student} <Text style={styles.querySubject}>· {q.subject}</Text></Text>
                <Text style={styles.queryText} numberOfLines={1}>{q.question}</Text>
                <Text style={styles.queryTime}>{q.time}</Text>
              </View>
              <View style={styles.answerBtn}><Text style={styles.answerBtnText}>Answer</Text></View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Tasks</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {UPCOMING_TASKS.map((u, i) => (
              <View key={i} style={[styles.upcomingCard, { borderLeftColor: u.color }]}>
                <Ionicons name={u.icon} size={20} color={u.color} />
                <Text style={styles.upcomingTitle}>{u.title}</Text>
                <Text style={styles.upcomingDate}>{u.date}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Feature Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Features</Text>
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
  statCard: { flex: 1, borderRadius: 14, padding: 10, alignItems: "center", gap: 3 },
  statVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  classCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 160, borderWidth: 1, borderColor: "#F0F0F0", gap: 3 },
  classTime: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#3D5AF1", marginBottom: 2 },
  classSubject: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  classGroup: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
  classRoom: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 4 },
  classRoomText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  reviewRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  reviewIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFBEB", alignItems: "center", justifyContent: "center" },
  reviewTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  reviewMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 6 },
  progressTrack: { height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#F59E0B", borderRadius: 2 },
  queryRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  queryAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  queryAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  queryStudent: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  querySubject: { fontFamily: "Inter_400Regular", color: "#9CA3AF", fontSize: 12 },
  queryText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 2 },
  queryTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  answerBtn: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  answerBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  upcomingCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 150, borderWidth: 1, borderColor: "#F0F0F0", borderLeftWidth: 4, gap: 6 },
  upcomingTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", lineHeight: 18 },
  upcomingDate: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  featureCard: { width: "30%", backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  featureIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#111827", textAlign: "center" },
});
