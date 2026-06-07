import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { ManagedUser, VerificationRequest } from "@/lib/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useAuth } from "@/context/AuthContext";

const ROLE_COLORS: Record<string, { color: string; bg: string }> = {
  student:  { color: "#3D5AF1", bg: "#EEF2FF" },
  teacher:  { color: "#10B981", bg: "#ECFDF5" },
  alumni:   { color: "#8B5CF6", bg: "#F5F3FF" },
  official: { color: "#D97706", bg: "#FFFBEB" },
};

const ROLE_TABS = ["All", "Students", "Teachers", "Alumni", "Officials"];
const STATUS_TABS = ["All", "Verified", "Pending", "Rejected", "Suspended"];
const PER_PAGE = 20;

function timeSince(ts: string) {
  const days = Math.floor((Date.now() - new Date(ts).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

function roleFromTab(tab: string): string | null {
  return { Students: "student", Teachers: "teacher", Alumni: "alumni", Officials: "official" }[tab] ?? null;
}

export default function UserManagementScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const { profile } = useAuth();

  const [users, setUsers]                 = useState<ManagedUser[]>([]);
  const [requests, setRequests]           = useState<VerificationRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState("");
  const [roleTab, setRoleTab]             = useState("All");
  const [statusTab, setStatusTab]         = useState("All");
  const [page, setPage]                   = useState(1);
  const [selected, setSelected]           = useState<ManagedUser | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast]                 = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchData = useCallback(async () => {
    try {
      const [u, r] = await Promise.all([api.users.manage(), api.verification.requests()]);
      setUsers(u);
      setRequests(r);
    } catch { showToast("Failed to load users"); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filtered = users.filter((u) => {
    const roleF = roleFromTab(roleTab);
    if (roleF && u.role !== roleF) return false;
    const statusF = statusTab !== "All" ? statusTab.toLowerCase() : null;
    if (statusF && u.verificationStatus !== statusF) return false;
    if (search && !u.fullName.toLowerCase().includes(search.toLowerCase()) && !u.email.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const paginated = filtered.slice(0, page * PER_PAGE);
  const hasMore = paginated.length < filtered.length;

  const getRequestForUser = (userId: string) => requests.find((r) => r.userId === userId);

  const handleApprove = async (userId: string) => {
    const req = getRequestForUser(userId);
    if (!req) return showToast("No verification request found");
    setActionLoading(`approve-${userId}`);
    try {
      await api.verification.review(req.id, "approved", "Approved by JNV Official");
      showToast("User verified successfully");
      fetchData();
    } catch (e: any) { showToast(e.message || "Failed to approve"); }
    setActionLoading(null);
  };

  const handleReject = async (userId: string, notes?: string) => {
    const req = getRequestForUser(userId);
    if (!req) return showToast("No verification request found");
    setActionLoading(`reject-${userId}`);
    try {
      await api.verification.review(req.id, "rejected", notes || "Rejected by JNV Official");
      showToast("User rejected");
      fetchData();
    } catch (e: any) { showToast(e.message || "Failed to reject"); }
    setActionLoading(null);
  };

  const handleSuspend = async (user: ManagedUser) => {
    const isSuspended = user.verificationStatus === "suspended";
    setActionLoading(`suspend-${user.id}`);
    try {
      await api.users.suspend(user.id, !isSuspended);
      showToast(isSuspended ? "User reactivated" : "User suspended");
      fetchData();
      setSelected(null);
    } catch (e: any) { showToast(e.message || "Failed to update"); }
    setActionLoading(null);
  };

  const counts: Record<string, number> = {};
  users.forEach((u) => { counts[u.verificationStatus ?? "pending"] = (counts[u.verificationStatus ?? "pending"] || 0) + 1; });
  const pendingCount = counts["pending"] || 0;

  const selectedRequest = selected ? getRequestForUser(selected.id) : null;
  const roleCfg = selected ? (ROLE_COLORS[selected.role] || ROLE_COLORS.student) : ROLE_COLORS.student;

  return (
    <View style={s.container}>
      <View style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>User Management</Text>
          <Text style={s.headerSub}>{users.length} users · {profile?.jnvName}</Text>
        </View>
        {pendingCount > 0 && (
          <View style={s.pendingBadge}>
            <Text style={s.pendingBadgeText}>{pendingCount} pending</Text>
          </View>
        )}
        <TouchableOpacity style={s.refreshBtn} onPress={() => { setRefreshing(true); fetchData(); }}>
          <Ionicons name="refresh" size={18} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      {/* Stat chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.statRow} contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingVertical: 10 }}>
        {[
          { label: "Total",     count: users.length,       color: "#3D5AF1", bg: "#EEF2FF" },
          { label: "Verified",  count: counts.verified || 0, color: "#10B981", bg: "#ECFDF5" },
          { label: "Pending",   count: counts.pending || 0,  color: "#F59E0B", bg: "#FFFBEB" },
          { label: "Rejected",  count: counts.rejected || 0, color: "#EF4444", bg: "#FEF2F2" },
          { label: "Suspended", count: counts.suspended || 0,color: "#6B7280", bg: "#F3F4F6" },
        ].map((chip) => (
          <View key={chip.label} style={[s.statChip, { backgroundColor: chip.bg }]}>
            <Text style={[s.statChipCount, { color: chip.color }]}>{chip.count}</Text>
            <Text style={[s.statChipLabel, { color: chip.color }]}>{chip.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={s.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput style={s.searchInput} placeholder="Search by name or email..." placeholderTextColor="#9CA3AF" value={search} onChangeText={(v) => { setSearch(v); setPage(1); }} />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
      </View>

      {/* Role tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 6 }}>
        {ROLE_TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, roleTab === tab && s.tabActive]} onPress={() => { setRoleTab(tab); setPage(1); }}>
            <Text style={[s.tabText, roleTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Status tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, gap: 6, paddingBottom: 10 }}>
        {STATUS_TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[s.tab, s.tabSm, statusTab === tab && s.tabActive]} onPress={() => { setStatusTab(tab); setPage(1); }}>
            <Text style={[s.tabText, s.tabTextSm, statusTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* User list */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: insets.bottom + 24, gap: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} />}
      >
        {loading ? (
          <Text style={s.emptyText}>Loading users...</Text>
        ) : paginated.length === 0 ? (
          <View style={s.emptyWrap}><Ionicons name="people-outline" size={36} color="#D1D5DB" /><Text style={s.emptyText}>No users found</Text></View>
        ) : (
          paginated.map((u) => {
            const rc = ROLE_COLORS[u.role] || ROLE_COLORS.student;
            const isPending = u.verificationStatus === "pending";
            const isSuspended = u.verificationStatus === "suspended";
            const appBusy = actionLoading?.endsWith(u.id);
            return (
              <TouchableOpacity key={u.id} style={[s.userCard, isPending && s.userCardHighlight]} onPress={() => setSelected(u)} activeOpacity={0.8}>
                <View style={[s.avatar, { backgroundColor: rc.bg }]}>
                  <Text style={[s.avatarText, { color: rc.color }]}>{u.fullName[0]}</Text>
                </View>
                <View style={{ flex: 1, gap: 3 }}>
                  <View style={s.nameRow}>
                    <Text style={s.userName} numberOfLines={1}>{u.fullName}</Text>
                    <VerifiedBadge status={u.verificationStatus} size="sm" showLabel={false} />
                  </View>
                  <Text style={s.userEmail} numberOfLines={1}>{u.email}</Text>
                  <View style={s.userMetaRow}>
                    <View style={[s.roleChip, { backgroundColor: rc.bg }]}>
                      <Text style={[s.roleChipText, { color: rc.color }]}>{u.role.charAt(0).toUpperCase() + u.role.slice(1)}</Text>
                    </View>
                    {u.class && <Text style={s.classMeta}>{u.class}</Text>}
                    <Text style={s.joinDate}>{timeSince(u.createdAt)}</Text>
                  </View>
                </View>
                {isPending && (
                  <View style={s.quickActions}>
                    <TouchableOpacity
                      style={[s.qBtn, s.qBtnApprove]}
                      onPress={(e) => { e.stopPropagation?.(); handleApprove(u.id); }}
                      disabled={!!appBusy}
                    >
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.qBtn, s.qBtnReject]}
                      onPress={(e) => { e.stopPropagation?.(); handleReject(u.id); }}
                      disabled={!!appBusy}
                    >
                      <Ionicons name="close" size={14} color="#fff" />
                    </TouchableOpacity>
                  </View>
                )}
              </TouchableOpacity>
            );
          })
        )}
        {hasMore && (
          <TouchableOpacity style={s.loadMoreBtn} onPress={() => setPage((p) => p + 1)}>
            <Text style={s.loadMoreText}>Load More ({filtered.length - paginated.length} remaining)</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* User Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (
          <View style={s.modalWrap}>
            <View style={s.modalHeader}>
              <TouchableOpacity style={s.backBtn} onPress={() => setSelected(null)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
              <Text style={s.modalTitle}>User Profile</Text>
            </View>
            <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 32 }}>
              {/* Avatar + name */}
              <View style={s.profileCard}>
                <View style={[s.profileAvatar, { backgroundColor: roleCfg.bg }]}>
                  <Text style={[s.profileAvatarText, { color: roleCfg.color }]}>{selected.fullName[0]}</Text>
                </View>
                <Text style={s.profileName}>{selected.fullName}</Text>
                <Text style={s.profileEmail}>{selected.email}</Text>
                <View style={[s.roleChip, { backgroundColor: roleCfg.bg, alignSelf: "center" }]}>
                  <Text style={[s.roleChipText, { color: roleCfg.color }]}>{selected.role.charAt(0).toUpperCase() + selected.role.slice(1)}</Text>
                </View>
                <VerifiedBadge status={selected.verificationStatus} size="md" />
              </View>

              {/* Details */}
              <View style={s.detailCard}>
                {[
                  { label: "JNV",      value: `${selected.jnvName}, ${selected.jnvState}` },
                  { label: "Class",    value: selected.class || "—" },
                  { label: "Subject",  value: selected.subject || "—" },
                  { label: "Role",     value: selected.role },
                  { label: "Joined",   value: new Date(selected.createdAt).toLocaleDateString("en-IN") },
                ].map((row) => (
                  <View key={row.label} style={s.detailRow}>
                    <Text style={s.detailLabel}>{row.label}</Text>
                    <Text style={s.detailValue}>{row.value}</Text>
                  </View>
                ))}
              </View>

              {/* Verification request */}
              {selectedRequest && (
                <View style={s.reqCard}>
                  <Text style={s.sectionTitle}>VERIFICATION REQUEST</Text>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Method</Text>
                    <Text style={s.detailValue}>{selectedRequest.method === "official" ? "Official Review" : selectedRequest.method}</Text>
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Status</Text>
                    <VerifiedBadge status={selectedRequest.status === "approved" ? "verified" : selectedRequest.status} size="sm" />
                  </View>
                  <View style={s.detailRow}>
                    <Text style={s.detailLabel}>Submitted</Text>
                    <Text style={s.detailValue}>{new Date(selectedRequest.createdAt).toLocaleDateString("en-IN")}</Text>
                  </View>
                  {selectedRequest.notes ? (
                    <View style={s.reqNotes}>
                      <Text style={s.sectionTitle}>NOTES</Text>
                      <Text style={s.reqNotesText}>{selectedRequest.notes}</Text>
                    </View>
                  ) : null}
                </View>
              )}

              {/* Actions */}
              <View style={s.actionsCard}>
                <Text style={s.sectionTitle}>ACTIONS</Text>
                {(selected.verificationStatus === "pending" || selected.verificationStatus === "rejected") && (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}
                    onPress={() => handleApprove(selected.id)}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                    <Text style={[s.actionBtnText, { color: "#10B981" }]}>Approve & Verify</Text>
                  </TouchableOpacity>
                )}
                {(selected.verificationStatus === "pending" || selected.verificationStatus === "verified") && (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                    onPress={() => handleReject(selected.id)}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                    <Text style={[s.actionBtnText, { color: "#EF4444" }]}>Reject</Text>
                  </TouchableOpacity>
                )}
                {selected.verificationStatus !== "pending" && selected.role !== "official" && (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#F3F4F6", borderColor: "#E5E7EB" }]}
                    onPress={() => handleSuspend(selected)}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name={selected.verificationStatus === "suspended" ? "play-circle-outline" : "ban-outline"} size={20} color="#6B7280" />
                    <Text style={[s.actionBtnText, { color: "#6B7280" }]}>
                      {selected.verificationStatus === "suspended" ? "Reactivate User" : "Suspend User"}
                    </Text>
                  </TouchableOpacity>
                )}
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
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  pendingBadge: { backgroundColor: "#FEF3C7", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3 },
  pendingBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  statRow: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  statChip: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20 },
  statChipCount: { fontSize: 16, fontFamily: "Inter_700Bold" },
  statChipLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", margin: 12, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F3F4F6" },
  tabSm: { paddingHorizontal: 11, paddingVertical: 5 },
  tabActive: { backgroundColor: "#1A3C6E" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  tabTextSm: { fontSize: 12 },
  tabTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  emptyWrap: { alignItems: "center", paddingTop: 50, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", marginTop: 16 },
  userCard: { backgroundColor: "#fff", borderRadius: 14, padding: 12, flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  userCardHighlight: { borderColor: "#FDE68A", borderWidth: 1.5 },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", flex: 1 },
  userEmail: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  userMetaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  roleChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 },
  roleChipText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  classMeta: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  joinDate: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#D1D5DB" },
  quickActions: { flexDirection: "row", gap: 6 },
  qBtn: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  qBtnApprove: { backgroundColor: "#10B981" },
  qBtnReject: { backgroundColor: "#EF4444" },
  loadMoreBtn: { paddingVertical: 14, alignItems: "center", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  loadMoreText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  modalWrap: { flex: 1, backgroundColor: "#F5F6FA" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  profileCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  profileAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  profileAvatarText: { fontSize: 28, fontFamily: "Inter_700Bold" },
  profileName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  profileEmail: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  detailCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", gap: 0 },
  reqCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0" },
  detailRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  detailLabel: { width: 80, fontSize: 12, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  detailValue: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#111827" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 10 },
  reqNotes: { marginTop: 10 },
  reqNotesText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 19 },
  actionsCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
