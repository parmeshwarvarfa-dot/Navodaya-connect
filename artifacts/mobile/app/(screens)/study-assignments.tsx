import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { AssignmentWithSubs } from "@/lib/api";

const STATUS_TABS = ["All", "Pending", "Submitted", "Reviewed"];

const STATUS_CFG: Record<string, { color: string; bg: string; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }> = {
  pending:   { color: "#F59E0B", bg: "#FFFBEB", label: "Pending",   icon: "time-outline"             },
  submitted: { color: "#3D5AF1", bg: "#EEF2FF", label: "Submitted", icon: "cloud-upload-outline"     },
  late:      { color: "#EF4444", bg: "#FEF2F2", label: "Late",      icon: "alert-circle-outline"     },
  reviewed:  { color: "#10B981", bg: "#ECFDF5", label: "Reviewed",  icon: "checkmark-circle-outline" },
};

export default function StudyAssignmentsScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const { profile } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithSubs[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeTab,   setActiveTab]   = useState("All");
  const [search,      setSearch]      = useState("");
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [showSubmit,  setShowSubmit]  = useState<string | null>(null);
  const [note,        setNote]        = useState("");
  const [toast,       setToast]       = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchAssignments = async () => {
    try { setAssignments(await api.assignments.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAssignments(); }, []);

  const getMyStatus = (a: AssignmentWithSubs) => {
    if (!profile) return "pending";
    const mySub = a.submissions.find((s) => s.studentId === profile.uid);
    return mySub ? mySub.status : "pending";
  };

  const getMySubmission = (a: AssignmentWithSubs) => {
    if (!profile) return undefined;
    return a.submissions.find((s) => s.studentId === profile.uid);
  };

  const filtered = assignments.filter((a) => {
    const status = getMyStatus(a);
    const matchTab = activeTab === "All" || status === activeTab.toLowerCase();
    const matchS   = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.subject.toLowerCase().includes(search.toLowerCase());
    return matchTab && matchS;
  });

  const pending   = assignments.filter((a) => getMyStatus(a) === "pending").length;
  const submitted = assignments.filter((a) => getMyStatus(a) === "submitted").length;
  const reviewed  = assignments.filter((a) => getMyStatus(a) === "reviewed").length;

  const handleSubmit = async (id: string) => {
    setSubmitting(true);
    try {
      await api.assignments.submit(id, note.trim() || undefined);
      await fetchAssignments();
      setShowSubmit(null);
      setNote("");
      showToast("Assignment submitted successfully!");
    } catch (e: any) {
      showToast(e?.message || "Failed to submit.");
    }
    setSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignments</Text>
      </View>

      <View style={styles.statsRow}>
        {[
          { label: "Pending",   value: pending,             color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Submitted", value: submitted,           color: "#3D5AF1", bg: "#EEF2FF" },
          { label: "Reviewed",  value: reviewed,            color: "#10B981", bg: "#ECFDF5" },
          { label: "Total",     value: assignments.length,  color: "#6B7280", bg: "#F3F4F6" },
        ].map((s) => (
          <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
            <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
            <Text style={styles.statLabel}>{s.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search assignments…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={{ flexGrow: 0 }}>
        {STATUS_TABS.map((t) => (
          <TouchableOpacity key={t} style={[styles.tab, activeTab === t && styles.tabActive]} onPress={() => setActiveTab(t)}>
            <Text style={[styles.tabText, activeTab === t && styles.tabTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        {loading ? (
          <Text style={styles.loadingText}>Loading…</Text>
        ) : filtered.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>✅</Text><Text style={styles.emptyText}>All clear here!</Text></View>
        ) : filtered.map((a) => {
          const status = getMyStatus(a);
          const mySub  = getMySubmission(a);
          const cfg    = STATUS_CFG[status] || STATUS_CFG.pending;
          const isEx   = expanded === a.id;
          const isDone = status === "reviewed" || status === "submitted";
          return (
            <TouchableOpacity key={a.id} style={styles.card} activeOpacity={0.85} onPress={() => setExpanded(isEx ? null : a.id)}>
              <View style={styles.cardTop}>
                <View style={[styles.statusIcon, { backgroundColor: cfg.bg }]}>
                  <Ionicons name={cfg.icon} size={18} color={cfg.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle} numberOfLines={isEx ? undefined : 1}>{a.title}</Text>
                  <Text style={styles.cardMeta}>{a.subject} · {a.authorName || "Teacher"}</Text>
                </View>
              </View>

              <View style={styles.cardDueRow}>
                <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                <Text style={styles.cardDue}>Due: {a.dueDate}</Text>
                <View style={{ marginLeft: "auto" }}>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
              </View>

              {isEx && (
                <View style={styles.expandedBody}>
                  {mySub?.submittedAt && <Text style={styles.submittedAt}>Submitted: {new Date(mySub.submittedAt).toLocaleString()}</Text>}
                  {mySub?.remarks && (
                    <View style={styles.remarksBox}>
                      <View style={styles.remarkHeader}><Ionicons name="chatbubble-outline" size={14} color="#3D5AF1" /><Text style={styles.remarkLabel}>Teacher Remarks</Text></View>
                      <Text style={styles.remarkText}>{mySub.remarks}</Text>
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
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={() => showSubmit && handleSubmit(showSubmit)} disabled={submitting}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>{submitting ? "Submitting…" : "Confirm Submission"}</Text>
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
  loadingText: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
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
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
