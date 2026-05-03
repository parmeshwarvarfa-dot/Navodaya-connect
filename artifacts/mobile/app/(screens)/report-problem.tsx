import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { Problem } from "@/lib/api";

const CATEGORIES = [
  { id: "Academic", label: "Academic", icon: "book-outline" },
  { id: "Hostel", label: "Hostel", icon: "bed-outline" },
  { id: "Food", label: "Food & Mess", icon: "restaurant-outline" },
  { id: "Ragging", label: "Ragging / Bullying", icon: "warning-outline" },
  { id: "Health", label: "Health", icon: "medkit-outline" },
  { id: "Infrastructure", label: "Infrastructure", icon: "construct-outline" },
  { id: "Staff", label: "Staff Behaviour", icon: "person-outline" },
  { id: "Other", label: "Other", icon: "ellipsis-horizontal-outline" },
];

const PRIORITIES = [
  { id: "low", label: "Low", color: "#22C55E" },
  { id: "medium", label: "Medium", color: "#F59E0B" },
  { id: "high", label: "High", color: "#EF4444" },
  { id: "urgent", label: "Urgent", color: "#7C3AED" },
];

const STATUS_COLORS: Record<string, string> = {
  submitted: "#64748B",
  seen: "#2563EB",
  in_progress: "#D97706",
  solved: "#22C55E",
};
const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  seen: "Seen",
  in_progress: "In Progress",
  solved: "Solved",
};

export default function ReportProblemScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [tab, setTab] = useState<"new" | "my">("new");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Academic");
  const [priority, setPriority] = useState("medium");
  const [anonymous, setAnonymous] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState(false);
  const [myReports, setMyReports] = useState<Problem[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);

  const fetchMyReports = async () => {
    setLoadingReports(true);
    try {
      const all = await api.problems.list();
      const mine = all.filter((p) => p.submittedBy === profile?.uid);
      setMyReports(mine);
    } catch {}
    setLoadingReports(false);
  };

  useEffect(() => {
    if (tab === "my") fetchMyReports();
  }, [tab]);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    if (!description.trim()) return;
    setSubmitting(true);
    try {
      await api.problems.create({ title: title.trim(), description: description.trim(), category, priority, anonymous });
      setTitle("");
      setDescription("");
      setCategory("Academic");
      setPriority("medium");
      setAnonymous(false);
      setSuccessModal(true);
    } catch {}
    setSubmitting(false);
  };

  const canSubmit = title.trim().length > 0 && description.trim().length >= 10;

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Report a Problem</Text>
          <View style={{ width: 36 }} />
        </View>
        <Text style={styles.headerSub}>Help us improve your JNV experience</Text>

        <View style={styles.tabs}>
          {[
            { key: "new", label: "New Report" },
            { key: "my", label: "My Reports" },
          ].map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, tab === t.key && styles.tabActive]}
              onPress={() => setTab(t.key as "new" | "my")}
            >
              <Text style={[styles.tabText, tab === t.key && styles.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {tab === "new" ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.anonBanner}>
              <View style={styles.anonBannerIcon}>
                <Ionicons name="shield-checkmark" size={20} color="#3D5AF1" />
              </View>
              <Text style={styles.anonBannerText}>
                You can report anonymously — your identity will be completely hidden from everyone.
              </Text>
            </View>

            <Text style={styles.label}>Problem Title <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.input}
              placeholder="Brief title of the issue..."
              placeholderTextColor="#9CA3AF"
              value={title}
              onChangeText={setTitle}
              maxLength={120}
            />

            <Text style={styles.label}>Category <Text style={styles.required}>*</Text></Text>
            <View style={styles.chipGrid}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={[styles.chip, category === c.id && styles.chipActive]}
                  onPress={() => setCategory(c.id)}
                >
                  <Ionicons name={c.icon as any} size={14} color={category === c.id ? "#fff" : "#6B7280"} />
                  <Text style={[styles.chipText, category === c.id && styles.chipTextActive]}>{c.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Priority <Text style={styles.required}>*</Text></Text>
            <View style={styles.priorityRow}>
              {PRIORITIES.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[styles.priorityChip, priority === p.id && { backgroundColor: p.color, borderColor: p.color }]}
                  onPress={() => setPriority(p.id)}
                >
                  <Text style={[styles.priorityText, priority === p.id && { color: "#fff" }]}>{p.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Description <Text style={styles.required}>*</Text></Text>
            <TextInput
              style={styles.textarea}
              placeholder="Describe the problem in detail — what happened, when it happened, and how it's affecting you..."
              placeholderTextColor="#9CA3AF"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <Text style={styles.charHint}>{description.length} characters (minimum 10)</Text>

            <View style={styles.anonRow}>
              <View style={styles.anonLeft}>
                <View style={styles.anonIconWrap}>
                  <Ionicons name="eye-off-outline" size={22} color="#3D5AF1" />
                </View>
                <View style={styles.anonTextWrap}>
                  <Text style={styles.anonTitle}>Submit Anonymously</Text>
                  <Text style={styles.anonDesc}>
                    {anonymous
                      ? "Your name will NOT be shown to anyone, including teachers and officials."
                      : "Your name will be visible to teachers and officials handling this report."}
                  </Text>
                </View>
              </View>
              <Switch
                value={anonymous}
                onValueChange={setAnonymous}
                trackColor={{ false: "#E5E7EB", true: "#3D5AF1" }}
                thumbColor="#fff"
              />
            </View>

            {anonymous && (
              <View style={styles.anonNote}>
                <Ionicons name="lock-closed" size={14} color="#7C3AED" />
                <Text style={styles.anonNoteText}>
                  Anonymous report — your identity is fully protected. Even system admins cannot link this to your account.
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit || submitting}
              activeOpacity={0.85}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="send-outline" size={18} color="#fff" />
                  <Text style={styles.submitText}>Submit Report</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.disclaimer}>
              <Ionicons name="information-circle-outline" size={16} color="#9CA3AF" />
              <Text style={styles.disclaimerText}>
                Reports are reviewed by teachers and JNV officials. Genuine reports help improve your school. False or
                frivolous reports may have consequences.
              </Text>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {loadingReports ? (
            <ActivityIndicator color="#3D5AF1" style={{ marginTop: 40 }} />
          ) : myReports.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="document-text-outline" size={40} color="#D1D5DB" />
              </View>
              <Text style={styles.emptyTitle}>No Reports Yet</Text>
              <Text style={styles.emptyDesc}>
                You haven't submitted any problem reports. Use the "New Report" tab to report an issue.
              </Text>
            </View>
          ) : (
            <>
              <Text style={styles.reportsCount}>{myReports.length} report{myReports.length !== 1 ? "s" : ""} submitted</Text>
              {myReports.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.reportCard}
                  onPress={() => router.push({ pathname: "/(screens)/problem-detail", params: { id: r.id } } as any)}
                  activeOpacity={0.8}
                >
                  <View style={styles.reportCardTop}>
                    <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[r.status] || "#64748B") + "18" }]}>
                      <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[r.status] || "#64748B" }]} />
                      <Text style={[styles.statusText, { color: STATUS_COLORS[r.status] || "#64748B" }]}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Text>
                    </View>
                    <View style={[styles.priorityBadge, { backgroundColor: PRIORITIES.find((p) => p.id === r.priority)?.color + "18" || "#F59E0B18" }]}>
                      <Text style={[styles.priorityBadgeText, { color: PRIORITIES.find((p) => p.id === r.priority)?.color || "#F59E0B" }]}>
                        {r.priority}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.reportTitle} numberOfLines={2}>{r.title}</Text>
                  <View style={styles.reportMeta}>
                    <View style={styles.reportMetaItem}>
                      <Ionicons name="folder-outline" size={13} color="#9CA3AF" />
                      <Text style={styles.reportMetaText}>{r.category}</Text>
                    </View>
                    {r.anonymous && (
                      <View style={styles.reportMetaItem}>
                        <Ionicons name="eye-off-outline" size={13} color="#9CA3AF" />
                        <Text style={styles.reportMetaText}>Anonymous</Text>
                      </View>
                    )}
                    <View style={styles.reportMetaItem}>
                      <Ionicons name="time-outline" size={13} color="#9CA3AF" />
                      <Text style={styles.reportMetaText}>
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </Text>
                    </View>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={styles.reportArrow} />
                </TouchableOpacity>
              ))}
            </>
          )}
        </ScrollView>
      )}

      <Modal visible={successModal} transparent animationType="fade" onRequestClose={() => setSuccessModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.modalIconWrap}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.modalTitle}>Report Submitted!</Text>
            <Text style={styles.modalDesc}>
              Your report has been submitted successfully.{"\n"}
              {anonymous
                ? "Your identity is fully protected — this report is completely anonymous."
                : "The concerned authorities will review and respond to your report."}
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalSecondary}
                onPress={() => { setSuccessModal(false); setTab("my"); }}
              >
                <Text style={styles.modalSecondaryText}>View My Reports</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalPrimary} onPress={() => setSuccessModal(false)}>
                <Text style={styles.modalPrimaryText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { paddingHorizontal: 20, paddingBottom: 0 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  tabs: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, padding: 3, marginBottom: 0 },
  tab: { flex: 1, paddingVertical: 9, alignItems: "center", borderRadius: 10 },
  tabActive: { backgroundColor: "#fff" },
  tabText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "rgba(255,255,255,0.8)" },
  tabTextActive: { color: "#3D5AF1" },
  content: { padding: 16, paddingBottom: 40 },
  anonBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 12,
    backgroundColor: "#EEF2FF", borderRadius: 14, padding: 14, marginBottom: 20,
    borderWidth: 1, borderColor: "#C7D2FE",
  },
  anonBannerIcon: { width: 36, height: 36, borderRadius: 10, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  anonBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#3730A3", lineHeight: 19 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 8, marginTop: 4 },
  required: { color: "#EF4444" },
  input: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827",
    borderWidth: 1.5, borderColor: "#E5E7EB", marginBottom: 18,
  },
  chipGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 18 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  chipTextActive: { color: "#fff" },
  priorityRow: { flexDirection: "row", gap: 8, marginBottom: 18 },
  priorityChip: {
    flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 10,
    backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  priorityText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  textarea: {
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827",
    borderWidth: 1.5, borderColor: "#E5E7EB", minHeight: 120, marginBottom: 4,
  },
  charHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 18, textAlign: "right" },
  anonRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    borderWidth: 1.5, borderColor: "#E5E7EB", marginBottom: 12,
  },
  anonLeft: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, marginRight: 12 },
  anonIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  anonTextWrap: { flex: 1 },
  anonTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  anonDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 17 },
  anonNote: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#F5F3FF", borderRadius: 10, padding: 12, marginBottom: 20,
    borderWidth: 1, borderColor: "#DDD6FE",
  },
  anonNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#6D28D9", lineHeight: 18 },
  submitBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 16, marginBottom: 16,
  },
  submitBtnDisabled: { backgroundColor: "#A5B4FC" },
  submitText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  disclaimer: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#F3F4F6",
  },
  disclaimerText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", lineHeight: 18 },
  emptyState: { alignItems: "center", paddingTop: 60 },
  emptyIcon: {
    width: 80, height: 80, borderRadius: 24, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  emptyDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 21 },
  reportsCount: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#9CA3AF", marginBottom: 12 },
  reportCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  reportCardTop: { flexDirection: "row", gap: 8, marginBottom: 10 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  priorityBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  priorityBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  reportTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", lineHeight: 22, marginBottom: 10 },
  reportMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  reportMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  reportMetaText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  reportArrow: { position: "absolute", right: 16, top: "50%" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  modalBox: {
    backgroundColor: "#fff", borderRadius: 20, padding: 28, width: "100%", maxWidth: 340, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  modalIconWrap: { width: 72, height: 72, borderRadius: 24, alignItems: "center", justifyContent: "center", marginBottom: 16 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  modalDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 21, marginBottom: 24 },
  modalActions: { flexDirection: "row", gap: 10, width: "100%" },
  modalSecondary: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center",
  },
  modalSecondaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151" },
  modalPrimary: { flex: 1, paddingVertical: 13, borderRadius: 12, backgroundColor: "#3D5AF1", alignItems: "center" },
  modalPrimaryText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
