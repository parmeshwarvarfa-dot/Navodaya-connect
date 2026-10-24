import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Linking,
  TextInput, RefreshControl, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { AlumniBatchPreview, AlumniBatchProcessResult, CredentialReconcilePreview, ManagedUser, VerificationAssignment, VerificationAuditEvent, VerificationRequest } from "@/lib/api";
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

function getEvidenceLinks(raw?: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string" && /^https:\/\//i.test(value)) : [];
  } catch { return []; }
}

export default function UserManagementScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const { profile } = useAuth();

  const [users, setUsers]                 = useState<ManagedUser[]>([]);
  const [requests, setRequests]           = useState<VerificationRequest[]>([]);
  const [assignments, setAssignments]     = useState<VerificationAssignment[]>([]);
  const [auditHistory, setAuditHistory]   = useState<VerificationAuditEvent[]>([]);
  const [canDecide, setCanDecide]           = useState(false);
  const [loading, setLoading]             = useState(true);
  const [refreshing, setRefreshing]       = useState(false);
  const [search, setSearch]               = useState("");
  const [roleTab, setRoleTab]             = useState("All");
  const [statusTab, setStatusTab]         = useState("All");
  const [page, setPage]                   = useState(1);
  const [selected, setSelected]           = useState<ManagedUser | null>(null);
  const [rejectTarget, setRejectTarget]   = useState<ManagedUser | null>(null);
  const [reviewReason, setReviewReason]   = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast]                 = useState("");
  const [graduationYear, setGraduationYear] = useState(String(new Date().getFullYear()));
  const [batchPreview, setBatchPreview] = useState<AlumniBatchPreview | null>(null);
  const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([]);
  const [batchConfirmed, setBatchConfirmed] = useState(false);
  const [batchResult, setBatchResult] = useState<AlumniBatchProcessResult | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [reconcilePreview, setReconcilePreview] = useState<CredentialReconcilePreview | null>(null);
  const [selectedCredentialIds, setSelectedCredentialIds] = useState<string[]>([]);
  const [reconcileConfirmed, setReconcileConfirmed] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchData = useCallback(async () => {
    try {
      const permissions = await api.verification.permissions();
      const [u, r, a] = await Promise.all([
        api.users.manage(),
        api.verification.requests(),
        permissions.canManageReviewers ? api.verification.assignments() : Promise.resolve([]),
      ]);
      setUsers(u);
      setRequests(r);
      setAssignments(a);
      setCanDecide(permissions.canDecide);
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
      await api.verification.review(req.id, canDecide ? "approved" : "recommend_approval", canDecide ? "Approved after school review" : "Recommended for approval after school review");
      showToast(canDecide ? "Verification approved" : "Approval recommendation sent to the JNV official");
      fetchData();
    } catch (e: any) { showToast(e.message || "Failed to approve"); }
    setActionLoading(null);
  };

  const handleReject = async (userId: string, notes?: string) => {
    const req = getRequestForUser(userId);
    if (!req) return showToast("No verification request found");
    if (!notes?.trim() || notes.trim().length < 10) return showToast("Provide a review reason of at least 10 characters.");
    setActionLoading(`reject-${userId}`);
    try {
      await api.verification.review(req.id, canDecide ? "rejected" : "recommend_rejection", notes.trim());
      showToast(canDecide ? "Verification rejected" : "Rejection recommendation sent to the JNV official");
      fetchData();
      setRejectTarget(null);
      setReviewReason("");
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

  const handleToggleReviewer = async (user: ManagedUser) => {
    const assignment = assignments.find((item) => item.userId === user.id && item.assignmentRole === "admin" && item.active);
    setActionLoading(`reviewer-${user.id}`);
    try {
      if (assignment) {
        await api.verification.removeReviewer(assignment.id);
        showToast("Reviewer permissions removed");
      } else {
        await api.verification.appointReviewer(user.id);
        showToast("School verification reviewer appointed");
      }
      await fetchData();
    } catch (e: any) { showToast(e.message || "Could not update reviewer assignment"); }
    setActionLoading(null);
  };

  const prepareBatch = async () => {
    if (!/^\d{4}$/.test(graduationYear)) return showToast("Enter a four-digit graduation year");
    setBatchBusy(true);
    try {
      const preview = await api.verification.previewAlumniBatch(graduationYear);
      setBatchPreview(preview);
      setSelectedBatchIds([]);
      setBatchConfirmed(false);
      setBatchResult(null);
    } catch (e: any) { showToast(e.message || "Could not prepare the graduating batch"); }
    finally { setBatchBusy(false); }
  };

  const toggleBatchStudent = (userId: string) => {
    setBatchConfirmed(false);
    setSelectedBatchIds((current) => current.includes(userId) ? current.filter((id) => id !== userId) : [...current, userId]);
  };

  const processBatch = async (retry = false) => {
    if (!batchPreview || !selectedBatchIds.length || (!retry && !batchConfirmed)) return showToast("Select students and confirm their graduation eligibility first");
    setBatchBusy(true);
    try {
      const result = await api.verification.processAlumniBatch(batchPreview.batchId, selectedBatchIds, batchPreview.confirmationText);
      setBatchResult(result);
      setBatchConfirmed(false);
      showToast(`Batch update: ${result.summary.succeeded} transitioned, ${result.summary.skipped} skipped, ${result.summary.failed} failed`);
      await fetchData();
    } catch (e: any) { showToast(e.message || "Could not process the graduating batch"); }
    finally { setBatchBusy(false); }
  };

  const prepareCredentialReconciliation = async () => {
    setBatchBusy(true);
    try {
      const preview = await api.verification.credentialReconcilePreview();
      setReconcilePreview(preview);
      setSelectedCredentialIds([]);
      setReconcileConfirmed(false);
    } catch (e: any) { showToast(e.message || "Could not inspect older approved credentials"); }
    finally { setBatchBusy(false); }
  };

  const reconcileCredentials = async () => {
    if (!reconcileConfirmed || !selectedCredentialIds.length) return showToast("Select approved records and confirm reconciliation");
    setBatchBusy(true);
    try {
      const result = await api.verification.reconcileCredentials(selectedCredentialIds);
      showToast(`${result.issued} IDs issued from existing approvals; ${result.skipped} records need review`);
      setReconcilePreview(null);
      setSelectedCredentialIds([]);
      setReconcileConfirmed(false);
    } catch (e: any) { showToast(e.message || "Could not reconcile the selected credentials"); }
    finally { setBatchBusy(false); }
  };

  const counts: Record<string, number> = {};
  users.forEach((u) => { counts[u.verificationStatus ?? "pending"] = (counts[u.verificationStatus ?? "pending"] || 0) + 1; });
  const pendingCount = counts["pending"] || 0;

  const selectedRequest = selected ? getRequestForUser(selected.id) : null;
  const selectedCanRecommend = !canDecide && !!selectedRequest && ["pending", "info_requested"].includes(selectedRequest.status);
  const selectedCanFinalize = canDecide && selectedRequest?.status === "awaiting_official_decision";
  const roleCfg = selected ? (ROLE_COLORS[selected.role] || ROLE_COLORS.student) : ROLE_COLORS.student;

  useEffect(() => {
    if (!selectedRequest?.id) { setAuditHistory([]); return; }
    api.verification.requestAudit(selectedRequest.id).then(setAuditHistory).catch(() => setAuditHistory([]));
  }, [selectedRequest?.id]);

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
        {canDecide && (
          <View style={s.transitionCard}>
            <Text style={s.transitionTitle}>Student Batch & Alumni Transition</Text>
            <Text style={s.transitionHelp}>Uses existing Class XII student accounts at {profile?.jnvName}. No new account is created. Students without a recorded graduation year require your individual review; records with a conflicting year are excluded.</Text>
            <View style={s.yearRow}>
              <TextInput style={s.yearInput} keyboardType="number-pad" maxLength={4} value={graduationYear} onChangeText={(value) => { setGraduationYear(value); setBatchPreview(null); setBatchResult(null); setSelectedBatchIds([]); setBatchConfirmed(false); }} placeholder="Graduation year" />
              <TouchableOpacity style={s.smallPrimaryButton} onPress={prepareBatch} disabled={batchBusy}>
                <Text style={s.smallPrimaryText}>{batchBusy ? "Loading…" : "Preview batch"}</Text>
              </TouchableOpacity>
            </View>
            {batchPreview && (
              <View style={s.transitionInner}>
                <Text style={s.transitionSummary}>{batchPreview.totalClass12Accounts} Class XII accounts · {batchPreview.alreadyTransitioned} already Alumni · {batchPreview.reviewRequired} need review · {batchPreview.excluded} excluded</Text>
                {batchPreview.students.map((student) => {
                  const selectedStudent = selectedBatchIds.includes(student.id);
                  return (
                    <TouchableOpacity key={student.id} style={[s.batchStudent, !student.selectable && s.batchStudentExcluded]} disabled={!student.selectable || batchBusy} onPress={() => toggleBatchStudent(student.id)}>
                      <Ionicons name={selectedStudent ? "checkbox" : student.selectable ? "square-outline" : "remove-circle-outline"} size={21} color={selectedStudent ? "#3D5AF1" : student.selectable ? "#9CA3AF" : "#D1D5DB"} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.batchStudentName}>{student.fullName}</Text>
                        <Text style={s.batchStudentMeta}>{student.class} · {student.verificationStatus || "unverified"} · {student.reason}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
                {!!selectedBatchIds.length && (
                  <TouchableOpacity style={s.confirmRow} onPress={() => setBatchConfirmed((value) => !value)}>
                    <Ionicons name={batchConfirmed ? "checkbox" : "square-outline"} size={21} color={batchConfirmed ? "#3D5AF1" : "#9CA3AF"} />
                    <Text style={s.confirmText}>I reviewed these students and confirm their graduation eligibility for {batchPreview.graduationYear}.</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.primaryButton, (!batchConfirmed || !selectedBatchIds.length || batchBusy) && s.buttonDisabled]} onPress={() => processBatch()} disabled={!batchConfirmed || !selectedBatchIds.length || batchBusy}>
                  <Text style={s.primaryButtonText}>{batchBusy ? "Processing…" : `Confirm & transition ${selectedBatchIds.length} students`}</Text>
                </TouchableOpacity>
                {batchResult && (
                  <View style={s.resultBox}>
                    <Text style={s.transitionSummary}>Result: {batchResult.summary.succeeded} successful · {batchResult.summary.alreadyTransitioned} already transitioned · {batchResult.summary.skipped} skipped · {batchResult.summary.failed} failed</Text>
                    {batchResult.results.filter((item) => item.result === "failed" || item.result === "skipped").map((item) => <Text key={item.id} style={s.batchStudentMeta}>{item.reason}</Text>)}
                    {batchResult.summary.failed > 0 && <TouchableOpacity style={s.retryButton} onPress={() => processBatch(true)} disabled={batchBusy}><Text style={s.retryText}>Retry failed batch records</Text></TouchableOpacity>}
                  </View>
                )}
              </View>
            )}
            <View style={s.transitionDivider} />
            <Text style={s.transitionTitleSmall}>Existing approved users without a Digital ID</Text>
            <Text style={s.transitionHelp}>Reconciliation only issues IDs when the verified account has a matching official approval record and complete evidence. Other records remain unchanged for review.</Text>
            <TouchableOpacity style={s.secondaryButton} onPress={prepareCredentialReconciliation} disabled={batchBusy}>
              <Text style={s.secondaryButtonText}>{batchBusy ? "Checking…" : "Review approved records"}</Text>
            </TouchableOpacity>
            {reconcilePreview && (
              <View style={s.transitionInner}>
                <Text style={s.transitionSummary}>{reconcilePreview.candidates.length} approved records can be reconciled · {reconcilePreview.reviewRequired} require manual review</Text>
                {reconcilePreview.candidates.map((candidate) => {
                  const chosen = selectedCredentialIds.includes(candidate.id);
                  return <TouchableOpacity key={candidate.id} style={s.batchStudent} onPress={() => { setReconcileConfirmed(false); setSelectedCredentialIds((current) => chosen ? current.filter((id) => id !== candidate.id) : [...current, candidate.id]); }}>
                    <Ionicons name={chosen ? "checkbox" : "square-outline"} size={21} color={chosen ? "#3D5AF1" : "#9CA3AF"} />
                    <Text style={s.batchStudentName}>{candidate.fullName} · {candidate.role}</Text>
                  </TouchableOpacity>;
                })}
                {!!selectedCredentialIds.length && <TouchableOpacity style={s.confirmRow} onPress={() => setReconcileConfirmed((value) => !value)}><Ionicons name={reconcileConfirmed ? "checkbox" : "square-outline"} size={21} color={reconcileConfirmed ? "#3D5AF1" : "#9CA3AF"} /><Text style={s.confirmText}>Issue IDs using the existing approved verification decisions.</Text></TouchableOpacity>}
                <TouchableOpacity style={[s.primaryButton, (!reconcileConfirmed || !selectedCredentialIds.length || batchBusy) && s.buttonDisabled]} onPress={reconcileCredentials} disabled={!reconcileConfirmed || !selectedCredentialIds.length || batchBusy}><Text style={s.primaryButtonText}>Reconcile {selectedCredentialIds.length} IDs</Text></TouchableOpacity>
              </View>
            )}
          </View>
        )}
        {loading ? (
          <Text style={s.emptyText}>Loading users...</Text>
        ) : paginated.length === 0 ? (
          <View style={s.emptyWrap}><Ionicons name="people-outline" size={36} color="#D1D5DB" /><Text style={s.emptyText}>No users found</Text></View>
        ) : (
          paginated.map((u) => {
            const rc = ROLE_COLORS[u.role] || ROLE_COLORS.student;
            const isPending = u.verificationStatus === "pending";
            const isSuspended = u.verificationStatus === "suspended";
            const userRequest = getRequestForUser(u.id);
            const canActOnRequest = !!userRequest && (canDecide
              ? userRequest.status === "awaiting_official_decision"
              : ["pending", "info_requested"].includes(userRequest.status));
            const canApproveRequest = canActOnRequest;
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
                {isPending && canActOnRequest && (
                  <View style={s.quickActions}>
                    {canApproveRequest && <TouchableOpacity
                      style={[s.qBtn, s.qBtnApprove]}
                      onPress={(e) => { e.stopPropagation?.(); handleApprove(u.id); }}
                      disabled={!!appBusy}
                    >
                      <Ionicons name="checkmark" size={14} color="#fff" />
                    </TouchableOpacity>}
                    <TouchableOpacity
                      style={[s.qBtn, s.qBtnReject]}
                      onPress={(e) => { e.stopPropagation?.(); setRejectTarget(u); setReviewReason(""); }}
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
                    <Text style={s.detailValue}>{selectedRequest.status.replaceAll("_", " ")}</Text>
                  </View>
                  {selectedRequest.adminRecommendation ? (
                    <View style={s.detailRow}>
                      <Text style={s.detailLabel}>School recommendation</Text>
                      <Text style={s.detailValue}>{selectedRequest.adminRecommendation}</Text>
                    </View>
                  ) : null}
                  {selectedRequest.evidenceSummary ? (
                    <View style={s.reqNotes}><Text style={s.sectionTitle}>APPLICANT EVIDENCE SUMMARY</Text><Text style={s.reqNotesText}>{selectedRequest.evidenceSummary}</Text></View>
                  ) : null}
                  {getEvidenceLinks(selectedRequest.documentUrls).map((url, index) => (
                    <TouchableOpacity key={`${index}-${url}`} style={s.evidenceLink} onPress={() => Linking.openURL(url).catch(() => showToast("Could not open evidence link"))}>
                      <Ionicons name="document-text-outline" size={16} color="#3D5AF1" />
                      <Text style={s.evidenceLinkText}>Open supporting document {index + 1}</Text>
                    </TouchableOpacity>
                  ))}
                  {selectedRequest.adminNotes ? (
                    <View style={s.reqNotes}><Text style={s.sectionTitle}>ADMIN REVIEW NOTES</Text><Text style={s.reqNotesText}>{selectedRequest.adminNotes}</Text></View>
                  ) : null}
                  {selectedRequest.officialNotes ? (
                    <View style={s.reqNotes}><Text style={s.sectionTitle}>OFFICIAL DECISION NOTES</Text><Text style={s.reqNotesText}>{selectedRequest.officialNotes}</Text></View>
                  ) : null}
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
              {selectedRequest && auditHistory.length > 0 && (
                <View style={s.reqCard}>
                  <Text style={s.sectionTitle}>REVIEW HISTORY</Text>
                  {auditHistory.map((event) => (
                    <View key={event.id} style={s.auditRow}>
                      <Text style={s.auditAction}>{event.action.replaceAll("_", " ")}</Text>
                      <Text style={s.auditMeta}>{event.actorName || "System"} · {new Date(event.createdAt).toLocaleString("en-IN")}</Text>
                      {event.reason ? <Text style={s.reqNotesText}>{event.reason}</Text> : null}
                    </View>
                  ))}
                </View>
              )}

              {/* Actions */}
              <View style={s.actionsCard}>
                <Text style={s.sectionTitle}>ACTIONS</Text>
                {canDecide && selected.role !== "official" && selected.verificationStatus === "verified" && (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}
                    onPress={() => handleToggleReviewer(selected)}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name={assignments.some((item) => item.userId === selected.id && item.assignmentRole === "admin" && item.active) ? "person-remove-outline" : "person-add-outline"} size={20} color="#3D5AF1" />
                    <Text style={[s.actionBtnText, { color: "#3D5AF1" }]}>{assignments.some((item) => item.userId === selected.id && item.assignmentRole === "admin" && item.active) ? "Remove Verification Admin" : "Appoint Verification Admin"}</Text>
                  </TouchableOpacity>
                )}
                {(selectedCanRecommend || selectedCanFinalize) && (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}
                    onPress={() => handleApprove(selected.id)}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name="checkmark-circle-outline" size={20} color="#10B981" />
                    <Text style={[s.actionBtnText, { color: "#10B981" }]}>{canDecide ? "Approve & Issue ID" : "Recommend Approval"}</Text>
                  </TouchableOpacity>
                )}
                {(selectedCanRecommend || selectedCanFinalize) && (
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
                    onPress={() => { setRejectTarget(selected); setReviewReason(""); }}
                    disabled={!!actionLoading}
                  >
                    <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                    <Text style={[s.actionBtnText, { color: "#EF4444" }]}>{canDecide ? "Reject Request" : "Recommend Rejection"}</Text>
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

      <Modal visible={!!rejectTarget} animationType="fade" transparent onRequestClose={() => setRejectTarget(null)}>
        <View style={s.reasonOverlay}>
          <View style={s.reasonCard}>
            <Text style={s.modalTitle}>{canDecide ? "Reject verification" : "Recommend rejection"}</Text>
            <Text style={s.reasonHint}>Give the applicant a clear reason they can act on.</Text>
            <TextInput
              style={s.reasonInput}
              value={reviewReason}
              onChangeText={setReviewReason}
              placeholder="Explain the review decision..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={2000}
            />
            <View style={s.reasonActions}>
              <TouchableOpacity style={s.reasonCancel} onPress={() => setRejectTarget(null)}><Text style={s.reasonCancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity
                style={s.reasonSubmit}
                disabled={!rejectTarget || !!actionLoading || reviewReason.trim().length < 10}
                onPress={() => rejectTarget && handleReject(rejectTarget.id, reviewReason)}
              ><Text style={s.reasonSubmitText}>Submit reason</Text></TouchableOpacity>
            </View>
          </View>
        </View>
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
  transitionCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 8, gap: 10, borderWidth: 1, borderColor: "#E5E7EB" },
  transitionTitle: { color: "#111827", fontSize: 16, fontFamily: "Inter_700Bold" },
  transitionTitleSmall: { color: "#111827", fontSize: 14, fontFamily: "Inter_700Bold" },
  transitionHelp: { color: "#6B7280", fontSize: 12, lineHeight: 18 },
  yearRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  yearInput: { flex: 1, minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, color: "#111827", fontFamily: "Inter_500Medium" },
  smallPrimaryButton: { minHeight: 42, paddingHorizontal: 12, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#3D5AF1" },
  smallPrimaryText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  transitionInner: { gap: 8, paddingTop: 4 },
  transitionSummary: { color: "#374151", fontSize: 12, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  batchStudent: { flexDirection: "row", alignItems: "center", gap: 9, padding: 10, borderRadius: 10, backgroundColor: "#F9FAFB" },
  batchStudentExcluded: { opacity: 0.62 },
  batchStudentName: { color: "#111827", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  batchStudentMeta: { color: "#6B7280", fontSize: 11, lineHeight: 16, marginTop: 2 },
  confirmRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 6 },
  confirmText: { flex: 1, color: "#374151", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  primaryButton: { minHeight: 44, borderRadius: 12, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  primaryButtonText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  buttonDisabled: { opacity: 0.45 },
  resultBox: { backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, gap: 4 },
  retryButton: { paddingVertical: 8 },
  retryText: { color: "#3D5AF1", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  transitionDivider: { height: 1, backgroundColor: "#E5E7EB", marginVertical: 4 },
  secondaryButton: { minHeight: 42, borderRadius: 10, borderWidth: 1, borderColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { color: "#3D5AF1", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  modalWrap: { flex: 1, backgroundColor: "#F5F6FA" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  reasonOverlay: { flex: 1, justifyContent: "center", padding: 20, backgroundColor: "rgba(17,24,39,0.45)" },
  reasonCard: { backgroundColor: "#fff", padding: 18, borderRadius: 18, gap: 10 },
  reasonHint: { color: "#6B7280", fontSize: 13, lineHeight: 18 },
  reasonInput: { minHeight: 100, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#F9FAFB", color: "#111827", textAlignVertical: "top", fontFamily: "Inter_400Regular" },
  reasonActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
  reasonCancel: { paddingHorizontal: 14, paddingVertical: 10 },
  reasonCancelText: { color: "#6B7280", fontFamily: "Inter_600SemiBold" },
  reasonSubmit: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: "#EF4444" },
  reasonSubmitText: { color: "#fff", fontFamily: "Inter_600SemiBold" },
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
  evidenceLink: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 9 },
  evidenceLinkText: { color: "#3D5AF1", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  auditRow: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F3F4F6", gap: 3 },
  auditAction: { color: "#111827", fontSize: 12, fontFamily: "Inter_600SemiBold", textTransform: "capitalize" },
  auditMeta: { color: "#9CA3AF", fontSize: 10, fontFamily: "Inter_400Regular" },
  actionsCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", gap: 10 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 12, borderWidth: 1.5 },
  actionBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
