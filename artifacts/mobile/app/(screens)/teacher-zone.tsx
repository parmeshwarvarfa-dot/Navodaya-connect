import React from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";

const FEATURES = [
  { label: "My Classes",       icon: "school-outline"         as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/teacher-classes"       },
  { label: "Upload Notes",     icon: "cloud-upload-outline"   as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/teacher-upload"        },
  { label: "Assignments",      icon: "checkbox-outline"        as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/teacher-assignments"    },
  { label: "Announcements",    icon: "megaphone-outline"       as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/teacher-announcements"  },
  { label: "Queries",          icon: "help-circle-outline"    as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/teacher-queries"        },
  { label: "Attendance",       icon: "calendar-clear-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/teacher-attendance"     },
  { label: "Results",          icon: "stats-chart-outline"    as const, color: "#0891B2", bg: "#E0F2FE", route: "/(screens)/teacher-results"        },
  { label: "Clubs",            icon: "people-circle-outline"  as const, color: "#EC4899", bg: "#FDF2F8", route: "/(screens)/teacher-clubs"          },
  { label: "Feedback",         icon: "star-half-outline"      as const, color: "#D97706", bg: "#FFFBEB", route: "/(screens)/teacher-feedback"       },
];

export default function TeacherZoneScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [realCounts, setRealCounts] = React.useState({ reviews: "—", queries: "—", materials: "—", classes: "—" });
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const now    = new Date();
  const hour   = now.getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  React.useEffect(() => {
    let active = true;
    Promise.allSettled([
      api.assignments.list(),
      api.studentQueries.list(),
      api.studyMaterials.list(),
      api.academicClasses.list(),
    ]).then((results) => {
      if (!active) return;
      const [assignmentsResult, queriesResult, materialsResult, classesResult] = results;
      setRealCounts({
        reviews: assignmentsResult.status === "fulfilled"
          ? String(assignmentsResult.value.reduce((count, assignment) => count + assignment.submissions.filter((submission) => submission.status === "submitted").length, 0))
          : "—",
        queries: queriesResult.status === "fulfilled"
          ? String(queriesResult.value.filter((query) => !query.solved).length)
          : "—",
        materials: materialsResult.status === "fulfilled"
          ? String(materialsResult.value.filter((material) => material.authorId === profile?.uid).length)
          : "—",
        classes: classesResult.status === "fulfilled"
          ? String(classesResult.value.filter((c) => c.active).length)
          : "—",
      });
    });
    return () => { active = false; };
  }, [profile?.uid]);

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#1A3C6E", "#2A5298"]} style={[styles.header, { paddingTop: topPad + 10 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerGreet}>{greeting}, {profile?.fullName?.split(" ")[0] || "Teacher"}</Text>
          <Text style={styles.headerTitle}>Teacher Zone</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/(screens)/notifications" as any)}>
          <Ionicons name="notifications-outline" size={19} color="#fff" />
          <View style={styles.notifDot} />
        </TouchableOpacity>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: "Assigned Classes", value: realCounts.classes, icon: "school-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/teacher-classes" },
            { label: "To Review",        value: realCounts.reviews, icon: "checkbox-outline" as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/teacher-assignments" },
            { label: "Queries",          value: realCounts.queries, icon: "help-circle-outline" as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/teacher-queries" },
            { label: "Uploaded",         value: realCounts.materials, icon: "document-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/teacher-upload" },
          ].map((s) => (
            <TouchableOpacity
              key={s.label}
              style={[styles.statCard, { backgroundColor: s.bg }]}
              onPress={() => s.route && router.push(s.route as any)}
              activeOpacity={0.8}
            >
              <Ionicons name={s.icon} size={16} color={s.color} />
              <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Assigned Classes Shortcut */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>My Classes</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/teacher-classes" as any)}>
              <Text style={styles.seeAll}>Manage Classes</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={styles.classesBannerCard}
            onPress={() => router.push("/(screens)/teacher-classes" as any)}
            activeOpacity={0.8}
          >
            <View style={styles.classesBannerIcon}>
              <Ionicons name="school" size={22} color="#1A3C6E" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.classesBannerTitle}>Classrooms & Student Rolls</Text>
              <Text style={styles.classesBannerSubtitle}>
                {realCounts.classes !== "—" ? `${realCounts.classes} classes assigned` : "View rosters, attendance & marks"}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
          </TouchableOpacity>
        </View>

        {/* Pending Reviews */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Pending Reviews</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/teacher-assignments" as any)}>
              <Text style={styles.seeAll}>Review All</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.classGroup}>Assignment review counts are available in Assignments.</Text>
        </View>

        {/* Recent Queries */}
        <View style={styles.section}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Recent Queries</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/teacher-queries" as any)}>
              <Text style={styles.seeAll}>Answer All</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.classGroup}>Open Queries to view current questions from your school.</Text>
        </View>

        {/* Feature Grid */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>All Teaching Tools</Text>
          <View style={styles.featureGrid}>
            {FEATURES.map((f) => (
              <TouchableOpacity key={f.label} style={styles.featureCard} activeOpacity={0.75} onPress={() => router.push(f.route as any)}>
                <View style={[styles.featureIcon, { backgroundColor: f.bg }]}>
                  <Ionicons name={f.icon} size={22} color={f.color} />
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  headerGreet: { color: "rgba(255,255,255,0.8)", fontSize: 11.5, fontFamily: "Inter_400Regular" },
  headerTitle: { color: "#fff", fontSize: 19, fontFamily: "Inter_700Bold" },
  notifBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "rgba(255,255,255,0.3)" },
  statsRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginTop: 14 },
  statCard: { flex: 1, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", gap: 3 },
  statVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 9.5, fontFamily: "Inter_500Medium", color: "#64748B", textAlign: "center" },
  section: { paddingHorizontal: 16, marginTop: 18 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#0F172A", marginBottom: 2 },
  seeAll: { fontSize: 12.5, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  classesBannerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  classesBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  classesBannerTitle: {
    color: "#0F172A",
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
  },
  classesBannerSubtitle: {
    color: "#64748B",
    fontSize: 11.5,
    fontFamily: "Inter_400Regular",
    marginTop: 1,
  },
  classGroup: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  featureGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 6 },
  featureCard: {
    width: "31%",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F172A",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  featureIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  featureLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#1E293B", textAlign: "center" },
});
