import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const METRICS = [
  { label: "Teaching Clarity",       avg: 4.5, count: 28, icon: "school-outline"         as const, color: "#3D5AF1" },
  { label: "Student Interaction",    avg: 4.2, count: 28, icon: "people-outline"          as const, color: "#10B981" },
  { label: "Content Coverage",       avg: 4.7, count: 28, icon: "book-outline"            as const, color: "#8B5CF6" },
  { label: "Classroom Behaviour",    avg: 4.6, count: 28, icon: "star-outline"            as const, color: "#F59E0B" },
  { label: "Accessibility",          avg: 4.0, count: 28, icon: "chatbubble-outline"      as const, color: "#0891B2" },
  { label: "Assignment Quality",     avg: 4.3, count: 28, icon: "checkbox-outline"        as const, color: "#EC4899" },
];

const DISTRIBUTION = [5, 4, 3, 2, 1];
const DIST_COUNTS  = [14, 8, 4, 1, 1]; // total = 28

const THEMES = [
  { theme: "Positive: Clear explanations",           count: 18, positive: true  },
  { theme: "Positive: Makes complex topics easy",    count: 15, positive: true  },
  { theme: "Positive: Always available for doubts",  count: 12, positive: true  },
  { theme: "Improvement: More practice problems needed", count: 7, positive: false },
  { theme: "Improvement: Slightly fast-paced",       count: 5,  positive: false },
];

function StarRow({ avg, max = 5 }: { avg: number; max?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Ionicons key={i} name={avg >= i ? "star" : avg >= i - 0.5 ? "star-half" : "star-outline"} size={14} color="#F59E0B" />
      ))}
    </View>
  );
}

export default function TeacherFeedbackScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const [activeClass, setActiveClass] = useState("Class 11 Sci A");
  const CLASSES = ["Class 11 Sci A", "Class 12 Sci B", "Class 10 A"];

  const overall = METRICS.reduce((s, m) => s + m.avg, 0) / METRICS.length;
  const total   = DIST_COUNTS.reduce((s, c) => s + c, 0);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Feedback Analytics</Text>
      </View>

      {/* Privacy notice */}
      <View style={styles.privacyBanner}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#3D5AF1" />
        <Text style={styles.privacyText}>All feedback is anonymous. Student identities are never revealed to teachers.</Text>
      </View>

      {/* Class selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.classTabs} style={{ flexGrow: 0 }}>
        {CLASSES.map((c) => (
          <TouchableOpacity key={c} style={[styles.classTab, activeClass === c && styles.classTabActive]} onPress={() => setActiveClass(c)}>
            <Text style={[styles.classTabText, activeClass === c && styles.classTabTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>

        {/* Overall score card */}
        <View style={styles.overallCard}>
          <View style={styles.overallLeft}>
            <Text style={styles.overallLabel}>Overall Rating</Text>
            <Text style={styles.overallScore}>{overall.toFixed(1)}</Text>
            <StarRow avg={overall} />
            <Text style={styles.responseCount}>{total} responses · {activeClass}</Text>
          </View>
          <View style={styles.distColumn}>
            {DISTRIBUTION.map((star, i) => {
              const pct = Math.round((DIST_COUNTS[i] / total) * 100);
              return (
                <View key={star} style={styles.distRow}>
                  <Text style={styles.distStar}>{star}</Text>
                  <Ionicons name="star" size={10} color="#F59E0B" />
                  <View style={styles.distTrack}>
                    <View style={[styles.distFill, { width: `${pct}%` }]} />
                  </View>
                  <Text style={styles.distCount}>{DIST_COUNTS[i]}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Metric cards */}
        <Text style={styles.sectionTitle}>Category Breakdown</Text>
        <View style={styles.metricGrid}>
          {METRICS.map((m) => (
            <View key={m.label} style={styles.metricCard}>
              <View style={[styles.metricIcon, { backgroundColor: m.color + "18" }]}>
                <Ionicons name={m.icon} size={20} color={m.color} />
              </View>
              <Text style={styles.metricLabel}>{m.label}</Text>
              <Text style={[styles.metricAvg, { color: m.color }]}>{m.avg.toFixed(1)}</Text>
              <StarRow avg={m.avg} />
              <View style={styles.metricTrack}>
                <View style={[styles.metricFill, { width: `${(m.avg / 5) * 100}%`, backgroundColor: m.color }]} />
              </View>
            </View>
          ))}
        </View>

        {/* Themes / insights */}
        <Text style={styles.sectionTitle}>Common Themes</Text>
        <View style={styles.themesCard}>
          {THEMES.map((t, i) => (
            <View key={i} style={styles.themeRow}>
              <View style={[styles.themeDot, { backgroundColor: t.positive ? "#10B981" : "#F59E0B" }]} />
              <Text style={styles.themeText}>{t.theme}</Text>
              <View style={[styles.themeCount, { backgroundColor: t.positive ? "#ECFDF5" : "#FFFBEB" }]}>
                <Text style={[styles.themeCountText, { color: t.positive ? "#10B981" : "#F59E0B" }]}>{t.count}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Improvement tip */}
        <View style={styles.tipCard}>
          <View style={styles.tipHeader}>
            <Ionicons name="bulb-outline" size={18} color="#F59E0B" />
            <Text style={styles.tipTitle}>Improvement Insight</Text>
          </View>
          <Text style={styles.tipText}>
            Students appreciate your teaching clarity (4.5/5). Consider adding more practice problems and slightly reducing pace — both scored under 4.5. Your overall rating of {overall.toFixed(1)}/5 is above the school average of 4.1.
          </Text>
        </View>

      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  privacyBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#EEF2FF", paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#C7D2FE" },
  privacyText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#3730A3" },
  classTabs: { paddingHorizontal: 16, gap: 8, paddingVertical: 12 },
  classTab: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  classTabActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  classTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  classTabTextActive: { color: "#fff" },
  overallCard: { backgroundColor: "#fff", borderRadius: 18, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: "#F0F0F0", flexDirection: "row", gap: 16 },
  overallLeft: { flex: 1, gap: 6 },
  overallLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", textTransform: "uppercase", letterSpacing: 0.5 },
  overallScore: { fontSize: 48, fontFamily: "Inter_700Bold", color: "#111827", lineHeight: 54 },
  responseCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 4 },
  distColumn: { flex: 1, gap: 5, justifyContent: "center" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  distStar: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151", width: 10 },
  distTrack: { flex: 1, height: 6, backgroundColor: "#F3F4F6", borderRadius: 3, overflow: "hidden" },
  distFill: { height: "100%", backgroundColor: "#F59E0B", borderRadius: 3 },
  distCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", width: 18, textAlign: "right" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  metricCard: { width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", gap: 6 },
  metricIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  metricLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151" },
  metricAvg: { fontSize: 22, fontFamily: "Inter_700Bold" },
  metricTrack: { height: 4, backgroundColor: "#F3F4F6", borderRadius: 2, overflow: "hidden", marginTop: 4 },
  metricFill: { height: "100%", borderRadius: 2 },
  themesCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 16 },
  themeRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  themeDot: { width: 8, height: 8, borderRadius: 4 },
  themeText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151" },
  themeCount: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  themeCountText: { fontSize: 12, fontFamily: "Inter_700Bold" },
  tipCard: { backgroundColor: "#FFFBEB", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#FDE68A", marginBottom: 8 },
  tipHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  tipTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#92400E" },
  tipText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#78350F", lineHeight: 20 },
});
