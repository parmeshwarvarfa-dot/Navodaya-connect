import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { AssignmentWithSubs } from "@/lib/api";

const CLASSES  = ["Class 11 Sci A", "Class 12 Sci B", "Class 10 A", "Class 9 A", "Class 8 B"];
const SUBJECTS = ["Physics", "Chemistry", "Maths", "English", "Biology"];

const STATUS_CFG: Record<string, { color: string; bg: string; label: string }> = {
  pending:   { color: "#F59E0B", bg: "#FFFBEB", label: "Pending"   },
  submitted: { color: "#3D5AF1", bg: "#EEF2FF", label: "Submitted" },
  reviewed:  { color: "#10B981", bg: "#ECFDF5", label: "Reviewed"  },
  late:      { color: "#EF4444", bg: "#FEF2F2", label: "Late"      },
};

export default function TeacherAssignmentsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const [assignments, setAssignments] = useState<AssignmentWithSubs[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [expanded,    setExpanded]    = useState<string | null>(null);
  const [showCreate,  setShowCreate]  = useState(false);
  const [toast,       setToast]       = useState("");
  const [remarkTarget, setRemarkTarget] = useState<{ aId: string; subId: string; name: string } | null>(null);
  const [remarkText,  setRemarkText]  = useState("");
  const [submitting,  setSubmitting]  = useState(false);

  const [title,    setTitle]    = useState("");
  const [subject,  setSubject]  = useState("");
  const [cls,      setCls]      = useState("");
  const [dueDate,  setDueDate]  = useState("");
  const [formErr,  setFormErr]  = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const fetchAssignments = async () => {
    try {
      const data = await api.assignments.list();
      setAssignments(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchAssignments(); }, []);

  const handleCreate = async () => {
    if (!title.trim() || !subject || !cls || !dueDate.trim()) { setFormErr("Fill all fields."); return; }
    setSubmitting(true);
    try {
      const row = await api.assignments.create({ title: title.trim(), subject, targetClass: cls, dueDate: dueDate.trim() });
      setAssignments((p) => [row, ...p]);
      setTitle(""); setSubject(""); setCls(""); setDueDate(""); setFormErr("");
      setShowCreate(false);
      showToast("Assignment created!");
    } catch (e: any) {
      setFormErr(e?.message || "Failed to create.");
    }
    setSubmitting(false);
  };

  const markReviewed = async () => {
    if (!remarkText.trim() || !remarkTarget) { showToast("Enter a remark first."); return; }
    try {
      await api.assignments.review(remarkTarget.aId, remarkTarget.subId, remarkText);
      setAssignments((prev) => prev.map((a) =>
        a.id !== remarkTarget.aId ? a : {
          ...a,
          submissions: a.submissions.map((s) =>
            s.id === remarkTarget.subId ? { ...s, status: "reviewed", remarks: remarkText } : s
          ),
        }
      ));
      setRemarkTarget(null); setRemarkText("");
      showToast("Marked as reviewed!");
    } catch { showToast("Failed to review."); }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Assignments</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
        {loading ? <Text style={styles.loadingText}>Loading…</Text> : assignments.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>📋</Text><Text style={styles.emptyText}>No assignments yet.</Text></View>
        ) : assignments.map((a) => {
          const submitted = a.submissions.filter((s) => s.status !== "pending").length;
          const reviewed  = a.submissions.filter((s) => s.status === "reviewed").length;
          const isEx = expanded === a.id;
          return (
            <View key={a.id} style={styles.card}>
              <TouchableOpacity onPress={() => setExpanded(isEx ? null : a.id)} activeOpacity={0.85}>
                <View style={styles.cardTop}>
                  <View style={styles.cardIcon}><Ionicons name="checkbox-outline" size={20} color="#F59E0B" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle}>{a.title}</Text>
                    <Text style={styles.cardMeta}>{a.subject} · {a.targetClass} · Due {a.dueDate}</Text>
                  </View>
                  <Ionicons name={isEx ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                </View>
                <View style={styles.cardStats}>
                  {[
                    { label: "Total",     value: a.submissions.length, color: "#6B7280" },
                    { label: "Submitted", value: submitted,            color: "#3D5AF1" },
                    { label: "Reviewed",  value: reviewed,             color: "#10B981" },
                    { label: "Pending",   value: a.submissions.length - submitted, color: "#F59E0B" },
                  ].map((s) => (
                    <View key={s.label} style={styles.statChip}>
                      <Text style={[styles.statChipVal, { color: s.color }]}>{s.value}</Text>
                      <Text style={styles.statChipLabel}>{s.label}</Text>
                    </View>
                  ))}
                </View>
              </TouchableOpacity>

              {isEx && (
                <View style={styles.submissionList}>
                  <Text style={styles.submissionHeader}>Submissions</Text>
                  {a.submissions.length === 0 ? (
                    <Text style={styles.noSub}>No submissions yet.</Text>
                  ) : a.submissions.map((s) => {
                    const cfg = STATUS_CFG[s.status] || STATUS_CFG.pending;
                    return (
                      <View key={s.id} style={styles.subRow}>
                        <View style={styles.subAvatar}><Text style={styles.subAvatarText}>{(s.studentName || "?")[0]}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.subName}>{s.studentName || "Student"}</Text>
                          {s.submittedAt ? <Text style={styles.subTime}>{new Date(s.submittedAt).toLocaleString()}</Text> : null}
                          {s.remarks ? <Text style={styles.subRemarks}>"{s.remarks}"</Text> : null}
                          {s.note ? <Text style={styles.subTime}>Note: {s.note}</Text> : null}
                        </View>
                        <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                          <Text style={[styles.statusPillText, { color: cfg.color }]}>{cfg.label}</Text>
                        </View>
                        {s.status === "submitted" && (
                          <TouchableOpacity style={styles.reviewBtn} onPress={() => { setRemarkTarget({ aId: a.id, subId: s.id, name: s.studentName || "Student" }); setRemarkText(""); }}>
                            <Text style={styles.reviewBtnText}>Review</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Assignment</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Assignment Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Newton's Laws Problems" placeholderTextColor="#9CA3AF" value={title} onChangeText={setTitle} />

              <Text style={styles.fieldLabel}>Subject *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {SUBJECTS.map((s) => (
                  <TouchableOpacity key={s} style={[styles.pill, subject === s && styles.pillActive]} onPress={() => setSubject(s)}>
                    <Text style={[styles.pillText, subject === s && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Target Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {CLASSES.map((c) => (
                  <TouchableOpacity key={c} style={[styles.pill, cls === c && styles.pillActive]} onPress={() => setCls(c)}>
                    <Text style={[styles.pillText, cls === c && styles.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Due Date *</Text>
              <TextInput style={styles.input} placeholder="e.g. 15 May 2026" placeholderTextColor="#9CA3AF" value={dueDate} onChangeText={setDueDate} />

              {formErr ? <Text style={styles.errText}>{formErr}</Text> : null}
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={handleCreate} disabled={submitting}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>{submitting ? "Creating…" : "Create Assignment"}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={!!remarkTarget} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Remark</Text>
              <TouchableOpacity onPress={() => setRemarkTarget(null)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Remark for {remarkTarget?.name}</Text>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="e.g. Excellent work! Grade: A" placeholderTextColor="#9CA3AF" value={remarkText} onChangeText={setRemarkText} multiline textAlignVertical="top" />
              <TouchableOpacity style={styles.confirmBtn} onPress={markReviewed}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Mark as Reviewed</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  loadingText: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
  cardIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#FFFBEB", alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 4 },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  cardStats: { flexDirection: "row", gap: 8 },
  statChip: { flex: 1, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 8, alignItems: "center" },
  statChipVal: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statChipLabel: { fontSize: 9, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  submissionList: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14 },
  submissionHeader: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#374151", marginBottom: 10 },
  noSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", paddingVertical: 10 },
  subRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  subAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  subAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  subName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  subTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  subRemarks: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#10B981", marginTop: 2 },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reviewBtn: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  reviewBtnText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 4 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  pillActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  pillTextActive: { color: "#fff" },
  errText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
