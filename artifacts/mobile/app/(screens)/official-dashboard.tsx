import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform, Modal, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { VerificationRequest, TeacherFeedbackItem } from "@/lib/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";

const ROLE_COLORS: Record<string, string> = {
  student: "#3D5AF1", teacher: "#10B981", alumni: "#8B5CF6", official: "#D97706",
};

const STATUS_COLORS: Record<string, { color: string; bg: string; label: string }> = {
  pending:        { color: "#F59E0B", bg: "#FFFBEB", label: "Pending" },
  approved:       { color: "#10B981", bg: "#ECFDF5", label: "Approved" },
  rejected:       { color: "#EF4444", bg: "#FEF2F2", label: "Rejected" },
  info_requested: { color: "#3D5AF1", bg: "#EEF2FF", label: "Info Needed" },
};

const QUICK_ACTIONS = [
  { label: "Verify Users",  icon: "shield-checkmark-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/user-management" },
  { label: "View Problems", icon: "alert-circle-outline"     as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/view-problems"   },
  { label: "Post Update",   icon: "megaphone-outline"        as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/create-news"     },
  { label: "Create Event",  icon: "calendar-outline"         as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(tabs)/events"             },
];

function timeSince(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (d === 0) return "Today"; if (d === 1) return "Yesterday"; return `${d}d ago`;
}

export default function OfficialDashboardScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const { profile } = useAuth();

  const [requests, setRequests]           = useState<VerificationRequest[]>([]);
  const [feedback, setFeedback]           = useState<TeacherFeedbackItem[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [activeTab, setActiveTab]         = useState<"pending" | "history" | "feedback">("pending");
  const [selected, setSelected]           = useState<VerificationRequest | null>(null);
  const [notes, setNotes]                 = useState("");
  const [infoReq, setInfoReq]             = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast]                 = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchData = useCallback(async () => {
    try {
      const [r, f] = await Promise.all([
        api.verification.requests(),
        api.teacherFeedback.list().catch(() => [] as TeacherFeedbackItem[]),
      ]);
      setRequests(r);
      setFeedback(f);
    } catch { showToast("Failed to load data"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const pendingReqs = requests.filter((r) => r.status === "pending");
  const historyReqs = requests.filter((r) => r.status !== "pending");

  const handleReview = async (status: "approved" | "rejected" | "info_requested") => {
    if (!selected) return;
    setActionLoading(status);
    try {
      await api.verification.review(selected.id, status, notes || undefined, infoReq || undefined);
      showToast(status === "approved" ? "User verified!" : status === "rejected" ? "Request rejected" : "Info requested");
      setSelected(null);
      setNotes(""); setInfoReq("");
      fetchData();
    } catch (e: any) { showToast(e.message || "Action failed"); }
    setActionLoading(null);
  };

  const verifiedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;
  const avgRating     = feedback.length > 0 ? (feedback.reduce((a, f) => a + f.rating, 0) / feedback.length).toFixed(1) : "—";

  return (
    <View style={s.container}>
      <LinearGradient colors={["#1A3C6E", "#2D5A9E"]} style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headerTop}>
          <TouchableOpacity style={s.iconBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Official Dashboard</Text>
            <Text style={s.headerSub}>{profile?.jnvName} · {profile?.jnvState}</Text>
          </View>
          <TouchableOpacity style={s.iconBtn} onPress={() => { setRefreshing(true); fetchData(); }}>
            <Ionicons name="refresh" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={s.statRow}>
          {[
            { label: "Pending",  value: pendingReqs.length, icon: "time-outline" as const,             color: "#FBBF24" },
            { label: "Verified", value: verifiedCount,       icon: "checkmark-circle-outline" as const, color: "#34D399" },
            { label: "Rejected", value: rejectedCount,       icon: "close-circle-outline" as const,     color: "#F87171" },
            { label: "Feedback", value: feedback.length,     icon: "star-outline" as const,             color: "#A78BFA" },
          ].map((stat) => (
            <View key={stat.label} style={s.statItem}>
              <Ionicons name={stat.icon} size={16} color={stat.color} />
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Quick actions */}
      <View style={s.quickSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingVertical: 10 }}>
          {QUICK_ACTIONS.map((qa) => (
            <TouchableOpacity key={qa.label} style={[s.quickChip, { backgroundColor: qa.bg }]} onPress={() => router.push(qa.route as any)}>
              <Ionicons name={qa.icon} size={16} color={qa.color} />
              <Text style={[s.quickChipText, { color: qa.color }]}>{qa.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Tabs */}
      <View style={s.tabs}>
        {[
          { key: "pending",  label: `Pending (${pendingReqs.length})` },
          { key: "history",  label: `History (${historyReqs.length})` },
          { key: "feedback", label: `Feedback (${feedback.length})` },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[s.tab, activeTab === tab.key && s.tabActive]}
            onPress={() => setActiveTab(tab.key as typeof activeTab)}
          >
            <Text style={[s.tabText, activeTab === tab.key && s.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 14, gap: 10, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {activeTab === "pending" && (
          loading ? <Text style={s.emptyText}>Loading...</Text>
          : pendingReqs.length === 0 ? (
            <View style={s.emptyWrap}>
              <Ionicons name="checkmark-circle-outline" size={48} color="#10B981" />
              <Text style={s.emptyTitle}>All caught up!</Text>
              <Text style={s.emptyText}>No pending verification requests.</Text>
            </View>
          ) : pendingReqs.map((req) => (
            <TouchableOpacity key={req.id} style={s.reqCard} onPress={() => { setSelected(req); setNotes(""); setInfoReq(""); }} activeOpacity={0.8}>
              <View style={[s.reqAvatar, { backgroundColor: (ROLE_COLORS[req.role] || "#9CA3AF") + "22" }]}>
                <Text style={[s.reqAvatarText, { color: ROLE_COLORS[req.role] || "#9CA3AF" }]}>{req.userFullName[0]}</Text>
              </View>
              <View style={{ flex: 1, gap: 3 }}>
                <Text style={s.reqName}>{req.userFullName}</Text>
                <Text style={s.reqEmail}>{req.userEmail}</Text>
                <View style={s.reqMetaRow}>
                  <View style={[s.roleChip, { backgroundColor: (ROLE_COLORS[req.role] || "#9CA3AF") + "22" }]}>
                    <Text style={[s.roleChipText, { color: ROLE_COLORS[req.role] || "#9CA3AF" }]}>{req.role}</Text>
                  </View>
                  <Text style={s.reqTime}>{timeSince(req.createdAt)}</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#D1D5DB" />
            </TouchableOpacity>
          ))
        )}

        {activeTab === "history" && (
          historyReqs.length === 0 ? (
            <View style={s.emptyWrap}><Text style={s.emptyText}>No history yet.</Text></View>
          ) : historyReqs.map((req) => {
            const sc = STATUS_COLORS[req.status] || STATUS_COLORS.pending;
            return (
              <View key={req.id} style={s.histCard}>
                <View style={[s.reqAvatar, { backgroundColor: (ROLE_COLORS[req.role] || "#9CA3AF") + "22" }]}>
                  <Text style={[s.reqAvatarText, { color: ROLE_COLORS[req.role] || "#9CA3AF" }]}>{req.userFullName[0]}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.reqName}>{req.userFullName}</Text>
                  <Text style={s.reqEmail}>{req.userEmail} · {req.role}</Text>
                  {req.reviewedAt && <Text style={s.histDate}>Reviewed {timeSince(req.reviewedAt)}</Text>}
                  {req.notes && <Text style={s.histNote}>{req.notes}</Text>}
                </View>
                <View style={[s.statusBadge, { backgroundColor: sc.bg }]}>
                  <Text style={[s.statusBadgeText, { color: sc.color }]}>{sc.label}</Text>
                </View>
              </View>
            );
          })
        )}

        {activeTab === "feedback" && (
          feedback.length === 0 ? (
            <View style={s.emptyWrap}><Text style={s.emptyText}>No teacher feedback received yet.</Text></View>
          ) : feedback.map((f) => (
            <View key={f.id} style={s.fbCard}>
              <View style={s.fbHeader}>
                <View style={s.fbTeacherInfo}>
                  <Text style={s.fbTeacherName}>{f.teacherName}</Text>
                  {f.subject && <Text style={s.fbSubject}>{f.subject}</Text>}
                </View>
                <View style={s.fbStars}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Ionicons key={i} name={i < f.rating ? "star" : "star-outline"} size={13} color="#F59E0B" />
                  ))}
                  <Text style={s.fbRatingText}>{f.rating}/5</Text>
                </View>
              </View>
              <Text style={s.fbComment}>{f.comment}</Text>
              <View style={s.fbFooter}>
                <Text style={s.fbStudent}>{f.anonymous ? "Anonymous Student" : f.studentName}</Text>
                <Text style={s.fbTime}>{timeSince(f.createdAt || "")}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* Review Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={s.reviewModal}>
            <View style={s.reviewHeader}>
              <TouchableOpacity style={s.backBtnSm} onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={s.reviewTitle}>Review Request</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
              <View style={s.reviewUserCard}>
                <View style={[s.profileAvatar, { backgroundColor: (ROLE_COLORS[selected.role] || "#9CA3AF") + "22" }]}>
                  <Text style={[s.profileAvatarText, { color: ROLE_COLORS[selected.role] || "#9CA3AF" }]}>{selected.userFullName[0]}</Text>
                </View>
                <Text style={s.reviewUserName}>{selected.userFullName}</Text>
                <Text style={s.reviewUserEmail}>{selected.userEmail}</Text>
                <View style={[s.roleChip, { backgroundColor: (ROLE_COLORS[selected.role] || "#9CA3AF") + "22", alignSelf: "center" }]}>
                  <Text style={[s.roleChipText, { color: ROLE_COLORS[selected.role] || "#9CA3AF" }]}>{selected.role.charAt(0).toUpperCase() + selected.role.slice(1)}</Text>
                </View>
              </View>

              <View style={s.reviewInfoCard}>
                {[
                  { label: "JNV",       value: `${selected.jnvName}, ${selected.jnvState}` },
                  { label: "Method",    value: selected.method === "official" ? "Official Review" : selected.method },
                  { label: "Submitted", value: new Date(selected.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) },
                ].map((row) => (
                  <View key={row.label} style={s.infoRow}>
                    <Text style={s.infoLabel}>{row.label}</Text>
                    <Text style={s.infoValue}>{row.value}</Text>
                  </View>
                ))}
              </View>

              <View style={s.inputSection}>
                <Text style={s.inputLabel}>Notes (optional)</Text>
                <TextInput
                  style={s.textArea}
                  placeholder="Add a note for this user..."
                  placeholderTextColor="#9CA3AF"
                  value={notes}
                  onChangeText={setNotes}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={s.inputSection}>
                <Text style={s.inputLabel}>Request More Information (optional)</Text>
                <TextInput
                  style={s.textArea}
                  placeholder="Describe what additional info you need from this user..."
                  placeholderTextColor="#9CA3AF"
                  value={infoReq}
                  onChangeText={setInfoReq}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={s.reviewActions}>
                <TouchableOpacity
                  style={[s.reviewBtn, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}
                  onPress={() => handleReview("approved")}
                  disabled={!!actionLoading}
                >
                  <Ionicons name="checkmark-circle-outline" size={22} color="#10B981" />
                  <Text style={[s.reviewBtnText, { color: "#10B981" }]}>
                    {actionLoading === "approved" ? "Approving..." : "Approve & Verify"}
                  </Text>
                </TouchableOpacity>

                {infoReq.trim() ? (
                  <TouchableOpacity
                    style={[s.reviewBtn, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}
                    onPress={() => handleReview("info_requested")}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name="information-circle-outline" size={22} color="#3D5AF1" />
                    <Text style={[s.reviewBtnText, { color: "#3D5AF1" }]}>
                      {actionLoading === "info_requested" ? "Sending..." : "Request More Info"}
                    </Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[s.reviewBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                  onPress={() => handleReview("rejected")}
                  disabled={!!actionLoading}
                >
                  <Ionicons name="close-circle-outline" size={22} color="#EF4444" />
                  <Text style={[s.reviewBtnText, { color: "#EF4444" }]}>
                    {actionLoading === "rejected" ? "Rejecting..." : "Reject Request"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        )}
      </Modal>

      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { paddingHorizontal: 14, paddingBottom: 16 },
  headerTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  statRow: { flexDirection: "row", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 14, padding: 10 },
  statItem: { flex: 1, alignItems: "center", gap: 3 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.7)" },
  quickSection: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  quickChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  quickChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  tab: { flex: 1, paddingVertical: 12, alignItems: "center", borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: "#1A3C6E" },
  tabText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  tabTextActive: { color: "#1A3C6E", fontFamily: "Inter_700Bold" },
  emptyWrap: { alignItems: "center", paddingTop: 50, gap: 10 },
  emptyTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center" },
  reqCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  histCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  reqAvatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  reqAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  reqName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  reqEmail: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  reqMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  reqTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#D1D5DB" },
  histDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 2 },
  histNote: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 3 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, alignSelf: "flex-start" },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  fbCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  fbHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  fbTeacherInfo: { flex: 1 },
  fbTeacherName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  fbSubject: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 1 },
  fbStars: { flexDirection: "row", alignItems: "center", gap: 2 },
  fbRatingText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#F59E0B", marginLeft: 4 },
  fbComment: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20 },
  fbFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  fbStudent: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  fbTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#D1D5DB" },
  reviewModal: { flex: 1, backgroundColor: "#F5F6FA" },
  reviewHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtnSm: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  reviewTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  reviewUserCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  profileAvatar: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 24, fontFamily: "Inter_700Bold" },
  reviewUserName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  reviewUserEmail: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  reviewInfoCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0" },
  infoRow: { flexDirection: "row", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  infoLabel: { width: 80, fontSize: 12, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  infoValue: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#111827" },
  inputSection: { gap: 6 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  textArea: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 80 },
  reviewActions: { gap: 10 },
  reviewBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, borderRadius: 14, borderWidth: 1.5 },
  reviewBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
