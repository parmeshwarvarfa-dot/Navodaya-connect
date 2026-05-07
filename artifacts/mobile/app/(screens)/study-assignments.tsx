import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const STATUS_TABS = ["All", "Pending", "Submitted", "Reviewed"];

const ASSIGNMENTS = [
  { id: "1", title: "Newton's Laws — 10 Problems",     subject: "Physics",   teacher: "Mr. Ramesh Kumar", dueDate: "08 May 2026", status: "pending",   priority: "high",   remarks: null, submittedAt: null },
  { id: "2", title: "Quadratic Equations Practice",    subject: "Maths",     teacher: "Ms. Asha Sharma",  dueDate: "10 May 2026", status: "pending",   priority: "medium", remarks: null, submittedAt: null },
  { id: "3", title: "Essay: The Impact of Technology", subject: "English",   teacher: "Mr. Sunil Tiwari", dueDate: "12 May 2026", status: "pending",   priority: "low",    remarks: null, submittedAt: null },
  { id: "4", title: "Periodic Table — Element Groups", subject: "Chemistry", teacher: "Ms. Pooja Devi",   dueDate: "05 May 2026", status: "submitted", priority: "medium", remarks: null, submittedAt: "5 May 2026, 3:20 PM" },
  { id: "5", title: "Cell Division — Diagram + Notes", subject: "Biology",   teacher: "Dr. Meera Verma",  dueDate: "30 Apr 2026", status: "reviewed",  priority: "high",   remarks: "Excellent work! Very detailed diagrams. Grade: A", submittedAt: "28 Apr 2026, 10:00 AM" },
  { id: "6", title: "Freedom Struggle Timeline",       subject: "History",   teacher: "Mr. Arjun Das",    dueDate: "28 Apr 2026", status: "reviewed",  priority: "medium", remarks: "Good effort. Could improve on dates accuracy. Grade: B+", submittedAt: "27 Apr 2026, 4:45 PM" },
  { id: "7", title: "Organic Chemistry Reactions",     subject: "Chemistry", teacher: "Ms. Pooja Devi",   dueDate: "25 Apr 2026", status: "submitted", priority: "high",   remarks: null, submittedAt: "26 Apr 2026, 11:30 AM" },
];

const STATUS_CFG: Record<string, { color: string; bg: string; label: string; icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap }> = {
  pending:   { color: "#F59E0B", bg: "#FFFBEB", label: "Pending",   icon: "time-outline"            },
  submitted: { color: "#3D5AF1", bg: "#EEF2FF", label: "Submitted", icon: "cloud-upload-outline"    },
  late:      { color: "#EF4444", bg: "#FEF2F2", label: "Late",      icon: "alert-circle-outline"    },
  reviewed:  { color: "#10B981", bg: "#ECFDF5", label: "Reviewed",  icon: "checkmark-circle-outline"},
};
const PRIORITY_COLOR: Record<string, string> = { high: "#EF4444", medium: "#F59E0B", low: "#10B981" };

export default function StudyAssignmentsScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [activeTab,  setActiveTab]  = useState("All");
  const [search,     setSearch]     = useState("");
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [submitted,  setSubmitted]  = useState<Set<string>>(new Set());
  const [showSubmit, setShowSubmit] = useState<string | null>(null);
  const [note,       setNote]       = useState("");
  const [toast,      setToast]      = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const filtered = ASSIGNMENTS.filter((a) => {
    const matchTab = activeTab === "All" || a.status === activeTab.toLowerCase();
    const matchS   = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.subject.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchS;
  });

  const pending   = ASSIGNMENTS.filter((a) => a.status === "pending").length;
  const submitted_count = ASSIGNMENTS.filter((a) => a.status === "submitted").length;
  const reviewed  = ASSIGNMENTS.filter((a) => a.status === "reviewed").length;

  const handleSubmit = (id: string) => {
    setSubmitted((p) => { const n = new Set(p); n.add(id); return n; });
    setShowSubmit(null);
    setNote("");
    showToast("Assignment submitted successfully!");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignments</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        {[
          { label: "Pending",   value: pending,          color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Submitted", value: submitted_count,  color: "#3D5AF1", bg: "#EEF2FF" },
          { label: "Reviewed",  value: reviewed,         color: "#10B981", bg: "#ECFDF5" },
          { label: "Total",     value: ASSIGNMENTS.length, color: "#6B7280", bg: "#F3F4F6" },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search assignments…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
      </View>

      {/* Status tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        {filtered.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>✅</Text><Text style={styles.emptyText}>All clear here!</Text></View>
        ) : filtered.map((a) => {
          const cfg  = STATUS_CFG[submitted.has(a.id) ? "submitted" : a.status] || STATUS_CFG.pending;
          const isEx = expanded === a.id;
          const isDone = a.status === "reviewed" || a.status === "submitted" || submitted.has(a.id);
          return (
            <TouchableOpacity key={a.id} style={styles.card} activeOpacity={0.85} onPress={() => setExpanded(isEx ? null : a.id)}>
              <View style={styles.cardTop}>
                <View style={[styles.statusIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={isEx ? undefined : 1}>{a.title}</Text>
                  <Text style={styles.cardMeta}>{a.subject} · {a.teacher}</Text>
                </View>
                <View style={[styles.priorityPill, { backgroundColor: PRIORITY_COLOR[a.priority] + "18" }]}>
                  <Text style={[styles.priorityText, { color: PRIORITY_COLOR[a.priority] }]}>{a.priority}</Text>
                </View>
              </View>

              <View style={styles.cardDueRow}>
                <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                <Text style={styles.cardDue}>Due: {a.dueDate}</Text>
                <View style={{ marginLeft: "auto" }}>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusPillText, { color: cfg.color }]}>{submitted.has(a.id) ? "Submitted" : cfg.label}</Text>
                  </View>
                </View>
              </View>

              {isEx && (
                <View style={styles.expandedBody}>
                  {a.submittedAt && <Text style={styles.submittedAt}>Submitted: {a.submittedAt}</Text>}
                  {a.remarks && (
                    <View style={styles.remarksBox}>
                      <View style={styles.remarkHeader}><Ionicons name="chatbubble-outline" size={14} color="#3D5AF1" /><Text style={styles.remarkLabel}>Teacher Remarks</Text></View>
                      <Text style={styles.remarkText}>{a.remarks}</Text>
                    </View>
                  )}
                  {!isDone && (
                    <TouchableOpacity style={styles.submitBtn} onPress={() => setShowSubmit(a.id)}>
                      <Ionicons name="cloud-upload-outline" size={16} color="#fff" />
                      <Text style={styles.submitBtnText}>Submit Assignment</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Submit Modal */}
      <Modal visible={!!showSubmit} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Submit Assignment</Text>
              <TouchableOpacity onPress={() => setShowSubmit(null)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalLabel}>Add a note to teacher (optional)</Text>
              <TextInput style={styles.noteInput} placeholder="e.g. Attached handwritten solution…" placeholderTextColor="#9CA3AF" value={note} onChangeText={setNote} multiline numberOfLines={4} textAlignVertical="top" />
              <TouchableOpacity style={styles.uploadBox}>
                <Ionicons name="attach-outline" size={24} color="#3D5AF1" />
                <Text style={styles.uploadText}>Attach File / Photo</Text>
                <Text style={styles.uploadHint}>PDF, Image, or Document</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={() => showSubmit && handleSubmit(showSubmit)}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Confirm Submission</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? <View style={styles.toast} pointerEvents="none"><Ionicons name="checkmark-circle" size={14} color="#fff" /><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  statsRow: { flexDirection: "row", gap: 10, paddingHorizontal: 16, marginVertical: 14 },
  statCard: { flex: 1, borderRadius: 14, padding: 12, alignItems: "center", gap: 2 },
  statVal: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },
  searchWrap: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, marginBottom: 10, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  tabs: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  tabActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  tabTextActive: { color: "#fff" },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  statusIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  priorityPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  priorityText: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  cardDueRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  cardDue: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  expandedBody: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14 },
  submittedAt: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 10 },
  remarksBox: { backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginBottom: 14 },
  remarkHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 },
  remarkLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  remarkText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 19 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 12 },
  submitBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  modalLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10 },
  noteInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 100, marginBottom: 16 },
  uploadBox: { borderWidth: 2, borderColor: "#C7D2FE", borderStyle: "dashed", borderRadius: 14, padding: 20, alignItems: "center", gap: 8, marginBottom: 20, backgroundColor: "#FAFBFF" },
  uploadText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  uploadHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
