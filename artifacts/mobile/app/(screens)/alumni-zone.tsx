import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";

const FEATURES = [
  { label: "Connect",        icon: "people-outline"           as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/alumni-connect"       },
  { label: "Mentorship",     icon: "school-outline"           as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/alumni-mentorship"     },
  { label: "Memories",       icon: "images-outline"           as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/alumni-memories"       },
  { label: "Achievements",   icon: "trophy-outline"           as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/alumni-achievements"   },
  { label: "Opportunities",  icon: "briefcase-outline"        as const, color: "#0891B2", bg: "#E0F2FE", route: "/(screens)/alumni-opportunities"  },
  { label: "Communities",    icon: "globe-outline"            as const, color: "#EC4899", bg: "#FDF2F8", route: "/(screens)/alumni-communities"    },
  { label: "Contributions",  icon: "ribbon-outline"           as const, color: "#D97706", bg: "#FFFBEB", route: "/(screens)/alumni-contributions"  },
  { label: "Support JNV",    icon: "heart-outline"            as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/alumni-support"        },
  { label: "Directory",      icon: "person-circle-outline"   as const, color: "#6366F1", bg: "#EEF2FF", route: "/(tabs)/alumni"                   },
  { label: "Events",         icon: "calendar-outline"         as const, color: "#16A34A", bg: "#F0FDF4", route: "/(tabs)/events"                  },
];

const MENTOR_REQUESTS = [
  { student: "Ananya S.", class: "Class 12 Sci A", goal: "JEE Preparation",      time: "2h ago"  },
  { student: "Dev P.",    class: "Class 11 Sci B", goal: "Career in CS/Tech",    time: "5h ago"  },
  { student: "Priya M.",  class: "Class 12 Sci A", goal: "NEET Preparation",     time: "Yesterday"},
];

const UPCOMING_EVENTS = [
  { title: "Annual Alumni Meet 2026",          date: "22 May",  attendees: 142, type: "Reunion"  },
  { title: "Career Guidance Webinar – IT",     date: "15 May",  attendees: 67,  type: "Webinar"  },
  { title: "JNV Scholarship Drive Workshop",   date: "18 May",  attendees: 89,  type: "Workshop" },
];

const RECENT_ACHIEVEMENTS = [
  { name: "Rahul Verma",    achievement: "Selected at Google as SWE",       year: "2018 Batch", badge: "🏆"  },
  { name: "Dr. Meera Iyer", achievement: "MBBS Completed – AIIMS Delhi",    year: "2015 Batch", badge: "⭐"  },
  { name: "Kavita Singh",   achievement: "UPSC AIR 47 – IAS Officer",       year: "2012 Batch", badge: "🎖️"  },
];

const OPPORTUNITIES = [
  { title: "Google Summer Internship – CS",   type: "Internship",  target: "Class 12",      urgent: true  },
  { title: "KVPY Scholarship 2026",           type: "Scholarship", target: "Class 11",      urgent: false },
  { title: "NTSE Preparation Workshop",       type: "Workshop",    target: "Class 10",      urgent: false },
];

export default function AlumniZoneScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";
  const isVerified = profile?.verificationStatus === "verified";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#10B981", "#059669"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreet}>{greeting}, {profile?.fullName?.split(" ")[0] || "Alumni"}</Text>
          <Text style={styles.headerTitle}>🎓 Alumni Zone</Text>
        </View>
        {isVerified && (
          <View style={styles.verifiedBadge}>
            <Ionicons name="checkmark-circle" size={14} color="#fff" />
            <Text style={styles.verifiedText}>Verified</Text>
          </View>
        )}
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/(screens)/notifications" as any)}>
          <Ionicons name="notifications-outline" size={20} color="#fff" />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Connections",    value: "48",  icon: "people-outline"   as const, color: "#3D5AF1", bg: "#EEF2FF" },
            { label: "Mentees",        value: "6",   icon: "school-outline"   as const, color: "#10B981", bg: "#ECFDF5" },
            { label: "Contributions",  value: "12",  icon: "ribbon-outline"   as const, color: "#8B5CF6", bg: "#F5F3FF" },
            { label: "Achievements",   value: "3",   icon: "trophy-outline"   as const, color: "#F59E0B", bg: "#FFFBEB" },
          ].map((s) => (
            <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* Mentor Requests */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Mentorship Requests</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/alumni-mentorship" as any)}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {MENTOR_REQUESTS.map((r, i) => (
            <TouchableOpacity key={i} style={styles.mentorRow} onPress={() => router.push("/(screens)/alumni-mentorship" as any)}>
              <View style={styles.mentorAvatar}><Text style={styles.mentorAvatarText}>{r.student[0]}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.mentorStudent}>{r.student} <Text style={styles.mentorClass}>· {r.class}</Text></Text>
                <Text style={styles.mentorGoal}>{r.goal}</Text>
                <Text style={styles.mentorTime}>{r.time}</Text>
              </View>
              <View style={styles.acceptBtn}><Text style={styles.acceptBtnText}>Accept</Text></View>
            </TouchableOpacity>
          ))}
        </View>

        {/* Upcoming Events */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Upcoming Events</Text>
            <TouchableOpacity onPress={() => router.push("/(tabs)/events" as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
            {UPCOMING_EVENTS.map((e, i) => (
              <View key={i} style={styles.eventCard}>
                <Text style={styles.eventType}>{e.type}</Text>
                <Text style={styles.eventTitle}>{e.title}</Text>
                <View style={styles.eventMeta}>
                  <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                  <Text style={styles.eventDate}>{e.date}</Text>
                  <Text style={styles.eventDivider}>·</Text>
                  <Ionicons name="people-outline" size={12} color="#6B7280" />
                  <Text style={styles.eventDate}>{e.attendees}</Text>
                </View>
                <View style={styles.rsvpBtn}><Text style={styles.rsvpBtnText}>RSVP</Text></View>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Recent Achievements */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Alumni Achievements</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/alumni-achievements" as any)}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {RECENT_ACHIEVEMENTS.map((a, i) => (
            <View key={i} style={styles.achieveRow}>
              <Text style={styles.achieveBadge}>{a.badge}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.achieveName}>{a.name} <Text style={styles.achieveYear}>· {a.year}</Text></Text>
                <Text style={styles.achieveText}>{a.achievement}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Opportunities */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Live Opportunities</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/alumni-opportunities" as any)}>
              <Text style={styles.seeAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {OPPORTUNITIES.map((o, i) => (
            <View key={i} style={styles.oppRow}>
              <View style={styles.oppIcon}><Ionicons name="briefcase-outline" size={18} color="#0891B2" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.oppTitle}>{o.title}</Text>
                <View style={{ flexDirection: "row", gap: 8, alignItems: "center", marginTop: 3 }}>
                  <View style={styles.oppTypePill}><Text style={styles.oppTypeText}>{o.type}</Text></View>
                  <Text style={styles.oppTarget}>{o.target}</Text>
                  {o.urgent && <View style={styles.urgentPill}><Text style={styles.urgentText}>Urgent</Text></View>}
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </View>
          ))}
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
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerGreet: { color: "rgba(255,255,255,0.8)", fontSize: 12, fontFamily: "Inter_400Regular" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  verifiedText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  notifBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginTop: 16 },
  statCard: { flex: 1, borderRadius: 14, padding: 10, alignItems: "center", gap: 3 },
  statVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  seeAll: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  mentorRow: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  mentorAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  mentorAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#10B981" },
  mentorStudent: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  mentorClass: { fontFamily: "Inter_400Regular", color: "#9CA3AF", fontSize: 12 },
  mentorGoal: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280", marginBottom: 2 },
  mentorTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  acceptBtn: { backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  acceptBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  eventCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 200, borderWidth: 1, borderColor: "#F0F0F0", gap: 5 },
  eventType: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#10B981", textTransform: "uppercase", letterSpacing: 0.5 },
  eventTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", lineHeight: 19 },
  eventMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  eventDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  eventDivider: { color: "#D1D5DB" },
  rsvpBtn: { backgroundColor: "#ECFDF5", borderRadius: 10, paddingVertical: 7, alignItems: "center", marginTop: 4 },
  rsvpBtnText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#10B981" },
  achieveRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  achieveBadge: { fontSize: 22 },
  achieveName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  achieveYear: { fontFamily: "Inter_400Regular", color: "#9CA3AF", fontSize: 12 },
  achieveText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  oppRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  oppIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E0F2FE", alignItems: "center", justifyContent: "center" },
  oppTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  oppTypePill: { backgroundColor: "#E0F2FE", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  oppTypeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#0891B2" },
  oppTarget: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  urgentPill: { backgroundColor: "#FEF2F2", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  urgentText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  featureCard: { width: "30%", backgroundColor: "#fff", borderRadius: 14, padding: 14, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  featureIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#111827", textAlign: "center" },
});
