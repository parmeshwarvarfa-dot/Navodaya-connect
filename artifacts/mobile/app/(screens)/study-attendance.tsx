import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const MONTHS = ["January", "February", "March", "April", "May"];
const SUBJECT_DATA = [
  { subject: "Physics",   present: 28, total: 32, color: "#3D5AF1" },
  { subject: "Chemistry", present: 30, total: 32, color: "#10B981" },
  { subject: "Maths",     present: 26, total: 32, color: "#F59E0B" },
  { subject: "English",   present: 31, total: 32, color: "#8B5CF6" },
  { subject: "Biology",   present: 27, total: 30, color: "#EF4444" },
  { subject: "P.E.",      present: 18, total: 20, color: "#0891B2" },
];

const MONTHLY = [
  { month: "January",  present: 20, total: 22, days: [1,1,1,0,1,1,1,1,1,1,1,1,0,1,1,1,1,1,0,1,1,1] },
  { month: "February", present: 18, total: 20, days: [1,1,0,1,1,1,1,1,1,0,1,1,1,1,0,1,1,1,1,1] },
  { month: "March",    present: 23, total: 24, days: [1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1,1,1,1,1] },
  { month: "April",    present: 19, total: 22, days: [1,1,0,1,1,1,0,1,1,1,1,1,1,0,1,1,1,1,1,1,0,1] },
  { month: "May",      present: 7,  total: 8,  days: [1,1,1,1,0,1,1,1] },
];

function ProgressBar({ value, color }: { value: number; color: string }) {
  return (
    <View style={progressStyles.track}>
      <View style={[progressStyles.fill, { width: `${Math.min(100, value)}%`, backgroundColor: color }]} />
    </View>
  );
}
const progressStyles = StyleSheet.create({
  track: { height: 8, backgroundColor: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4 },
});

export default function StudyAttendanceScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [activeMonth, setActiveMonth] = useState("May");
  const [view, setView] = useState<"overview" | "subject" | "calendar">("overview");

  const totalPresent = MONTHLY.reduce((s, m) => s + m.present, 0);
  const totalDays    = MONTHLY.reduce((s, m) => s + m.total, 0);
  const overallPct   = Math.round((totalPresent / totalDays) * 100);

  const monthData = MONTHLY.find((m) => m.month === activeMonth)!;
  const monthPct  = Math.round((monthData.present / monthData.total) * 100);

  const statusColor = overallPct >= 85 ? "#10B981" : overallPct >= 75 ? "#F59E0B" : "#EF4444";
  const statusLabel = overallPct >= 85 ? "Excellent" : overallPct >= 75 ? "Good (75% min required)" : "⚠️ Low — Action Needed";

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Attendance</Text>
      </View>

      {/* View toggle */}
      <View style={styles.viewToggle}>
        {(["overview", "subject", "calendar"] as const).map((v) => (
          <TouchableOpacity key={v} style={[styles.viewBtn, view === v && styles.viewBtnActive]} onPress={() => setView(v)}>
            <Text style={[styles.viewBtnText, view === v && styles.viewBtnTextActive]}>
              {v === "overview" ? "Overview" : v === "subject" ? "Subject-wise" : "Calendar"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>

        {/* Overall attendance card */}
        <View style={[styles.overallCard, { borderLeftColor: statusColor }]}>
          <View style={styles.overallMain}>
            <View>
              <Text style={styles.overallLabel}>Overall Attendance</Text>
              <Text style={[styles.overallPct, { color: statusColor }]}>{overallPct}%</Text>
              <Text style={styles.overallDays}>{totalPresent} / {totalDays} days</Text>
            </View>
            <View style={[styles.circleWrap, { borderColor: statusColor }]}>
              <Text style={[styles.circlePct, { color: statusColor }]}>{overallPct}%</Text>
              <Text style={styles.circleLabel}>Present</Text>
            </View>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
          </View>
        </View>

        {/* OVERVIEW */}
        {view === "overview" && (
          <>
            <Text style={styles.sectionTitle}>Monthly Summary</Text>
            {MONTHLY.map((m) => {
              const pct = Math.round((m.present / m.total) * 100);
              const col = pct >= 85 ? "#10B981" : pct >= 75 ? "#F59E0B" : "#EF4444";
              return (
                <View key={m.month} style={styles.monthRow}>
                  <Text style={styles.monthName}>{m.month.slice(0, 3)}</Text>
                  <View style={{ flex: 1, gap: 4 }}>
                    <ProgressBar value={pct} color={col} />
                    <Text style={styles.monthSub}>{m.present}/{m.total} days</Text>
                  </View>
                  <Text style={[styles.monthPct, { color: col }]}>{pct}%</Text>
                </View>
              );
            })}
          </>
        )}

        {/* SUBJECT WISE */}
        {view === "subject" && (
          <>
            <Text style={styles.sectionTitle}>Subject-wise Breakdown</Text>
            {SUBJECT_DATA.map((s) => {
              const pct = Math.round((s.present / s.total) * 100);
              return (
                <View key={s.subject} style={styles.subjectCard}>
                  <View style={styles.subjectTop}>
                    <View style={[styles.subjectDot, { backgroundColor: s.color }]} />
                    <Text style={styles.subjectName}>{s.subject}</Text>
                    <Text style={[styles.subjectPct, { color: s.color }]}>{pct}%</Text>
                  </View>
                  <ProgressBar value={pct} color={s.color} />
                  <Text style={styles.subjectDays}>{s.present} present · {s.total - s.present} absent · {s.total} total classes</Text>
                </View>
              );
            })}
          </>
        )}

        {/* CALENDAR */}
        {view === "calendar" && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16, paddingBottom: 4 }} style={{ flexGrow: 0 }}>
              {MONTHS.map((m) => (
                <TouchableOpacity key={m} style={[styles.monthChip, activeMonth === m && styles.monthChipActive]} onPress={() => setActiveMonth(m)}>
                  <Text style={[styles.monthChipText, activeMonth === m && styles.monthChipTextActive]}>{m.slice(0, 3)}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.calCard}>
              <View style={styles.calHeader}>
                <Text style={styles.calMonth}>{monthData.month}</Text>
                <View style={[styles.calPctBadge, { backgroundColor: (monthPct >= 85 ? "#10B981" : monthPct >= 75 ? "#F59E0B" : "#EF4444") + "18" }]}>
                  <Text style={[styles.calPctText, { color: monthPct >= 85 ? "#10B981" : monthPct >= 75 ? "#F59E0B" : "#EF4444" }]}>{monthPct}% · {monthData.present}/{monthData.total}</Text>
                </View>
              </View>
              <View style={styles.calGrid}>
                {monthData.days.map((d, i) => (
                  <View key={i} style={[styles.calDay, { backgroundColor: d ? "#ECFDF5" : "#FEF2F2" }]}>
                    <Text style={[styles.calDayNum, { color: d ? "#10B981" : "#EF4444" }]}>{i + 1}</Text>
                    <Ionicons name={d ? "checkmark" : "close"} size={10} color={d ? "#10B981" : "#EF4444"} />
                  </View>
                ))}
              </View>
              <View style={styles.calLegend}>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#10B981" }]} /><Text style={styles.legendText}>Present</Text></View>
                <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: "#EF4444" }]} /><Text style={styles.legendText}>Absent</Text></View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  viewToggle: { flexDirection: "row", marginHorizontal: 16, marginVertical: 14, backgroundColor: "#F3F4F6", borderRadius: 12, padding: 4 },
  viewBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  viewBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  viewBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
  viewBtnTextActive: { color: "#111827", fontFamily: "Inter_600SemiBold" },
  overallCard: { backgroundColor: "#fff", borderRadius: 16, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: "#F0F0F0", borderLeftWidth: 4 },
  overallMain: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  overallLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 4 },
  overallPct: { fontSize: 36, fontFamily: "Inter_700Bold", marginBottom: 4 },
  overallDays: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  circleWrap: { width: 80, height: 80, borderRadius: 40, borderWidth: 6, alignItems: "center", justifyContent: "center" },
  circlePct: { fontSize: 18, fontFamily: "Inter_700Bold" },
  circleLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },
  statusBadge: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  statusText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  monthName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", width: 32 },
  monthSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  monthPct: { fontSize: 15, fontFamily: "Inter_700Bold", width: 44, textAlign: "right" },
  subjectCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0", gap: 8 },
  subjectTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  subjectDot: { width: 10, height: 10, borderRadius: 5 },
  subjectName: { flex: 1, fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  subjectPct: { fontSize: 16, fontFamily: "Inter_700Bold" },
  subjectDays: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  monthChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  monthChipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  monthChipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  monthChipTextActive: { color: "#fff" },
  calCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  calHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  calMonth: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  calPctBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  calPctText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  calGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  calDay: { width: 40, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  calDayNum: { fontSize: 11, fontFamily: "Inter_600SemiBold", marginBottom: 1 },
  calLegend: { flexDirection: "row", gap: 16, marginTop: 14, justifyContent: "center" },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
});
