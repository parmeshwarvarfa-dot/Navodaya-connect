import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, RefreshControl, Platform, Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { Problem, ProblemWithComments, ProblemComment } from "@/lib/api";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap }> = {
  submitted:   { label: "Pending",      color: "#F59E0B", bg: "#FFFBEB", icon: "time-outline" },
  seen:        { label: "Under Review", color: "#3D5AF1", bg: "#EEF2FF", icon: "eye-outline" },
  in_progress: { label: "In Progress",  color: "#8B5CF6", bg: "#F5F3FF", icon: "sync-outline" },
  solved:      { label: "Resolved",     color: "#10B981", bg: "#ECFDF5", icon: "checkmark-circle-outline" },
  rejected:    { label: "Rejected",     color: "#EF4444", bg: "#FEF2F2", icon: "close-circle-outline" },
};

const PRIORITY_CONFIG: Record<string, { color: string; label: string }> = {
  low:    { color: "#10B981", label: "Low" },
  medium: { color: "#F59E0B", label: "Medium" },
  high:   { color: "#EF4444", label: "High" },
};

const CATEGORY_ICONS: Record<string, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  Academic:       "book-outline",
  Infrastructure: "business-outline",
  Hostel:         "home-outline",
  Food:           "restaurant-outline",
  Health:         "medkit-outline",
  Safety:         "shield-outline",
  Disciplinary:   "hand-left-outline",
  Other:          "ellipsis-horizontal-outline",
};

const STATUS_ACTIONS = [
  { status: "submitted",   label: "Mark Pending" },
  { status: "seen",        label: "Under Review" },
  { status: "in_progress", label: "In Progress" },
  { status: "solved",      label: "Resolve" },
  { status: "rejected",    label: "Reject" },
];

const FILTER_TABS = ["All", "Pending", "Under Review", "In Progress", "Resolved", "Rejected"];

function timeSince(ts: string) {
  const secs = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (secs < 60) return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

function statusFromFilter(filter: string): string | null {
  const map: Record<string, string> = {
    "Pending":      "submitted",
    "Under Review": "seen",
    "In Progress":  "in_progress",
    "Resolved":     "solved",
    "Rejected":     "rejected",
  };
  return map[filter] || null;
}

export default function ViewProblemsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [problems, setProblems]         = useState<Problem[]>([]);
  const [loading, setLoading]           = useState(true);
  const [refreshing, setRefreshing]     = useState(false);
  const [search, setSearch]             = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [selected, setSelected]         = useState<ProblemWithComments | null>(null);
  const [comment, setComment]           = useState("");
  const [submitting, setSubmitting]     = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [toast, setToast]               = useState("");
  const [showStatusMenu, setShowStatusMenu] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchProblems = useCallback(async () => {
    try {
      const data = await api.problems.list();
      setProblems(data);
    } catch {
      showToast("Failed to load reports");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const openDetail = async (p: Problem) => {
    try {
      const detail = await api.problems.get(p.id);
      setSelected(detail);
    } catch { showToast("Failed to load details"); }
  };

  const handleStatusUpdate = async (status: string) => {
    if (!selected) return;
    setUpdatingStatus(status);
    setShowStatusMenu(false);
    try {
      const updated = await api.problems.updateStatus(selected.id, status);
      setProblems((prev) => prev.map((p) => p.id === updated.id ? updated : p));
      setSelected((prev) => prev ? { ...prev, ...updated } : prev);
      showToast(`Status updated to "${STATUS_CONFIG[status]?.label || status}"`);
    } catch (e: any) { showToast(e.message || "Failed to update status"); }
    setUpdatingStatus(null);
  };

  const handleComment = async () => {
    if (!selected || !comment.trim()) return;
    setSubmitting(true);
    try {
      const c = await api.problems.addComment(selected.id, comment.trim());
      setSelected((prev) => prev ? { ...prev, comments: [...(prev.comments || []), c] } : prev);
      setComment("");
      showToast("Comment added");
    } catch (e: any) { showToast(e.message || "Failed to add comment"); }
    setSubmitting(false);
  };

  useEffect(() => { fetchProblems(); }, [fetchProblems]);

  const filteredProblems = problems.filter((p) => {
    const filterStatus = statusFromFilter(activeFilter);
    if (filterStatus && p.status !== filterStatus) return false;
    if (search && !p.title.toLowerCase().includes(search.toLowerCase()) &&
        !p.submittedByName?.toLowerCase().includes(search.toLowerCase()) &&
        !p.category.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const counts: Record<string, number> = {};
  problems.forEach((p) => { counts[p.status] = (counts[p.status] || 0) + 1; });

  const statusCfg = selected ? (STATUS_CONFIG[selected.status] || STATUS_CONFIG.submitted) : STATUS_CONFIG.submitted;
  const priorityCfg = selected ? (PRIORITY_CONFIG[selected.priority] || PRIORITY_CONFIG.medium) : PRIORITY_CONFIG.medium;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Problem Reports</Text>
          <Text style={styles.headerSub}>{problems.length} total · {counts["submitted"] || 0} pending action</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={() => { setRefreshing(true); fetchProblems(); }}>
          <Ionicons name="refresh" size={20} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      {/* Stats row */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statsRow} contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingVertical: 10 }}>
        {Object.entries(STATUS_CONFIG).map(([status, cfg]) => (
          <View key={status} style={[styles.statChip, { backgroundColor: cfg.bg, borderColor: cfg.color + "40" }]}>
            <Ionicons name={cfg.icon} size={14} color={cfg.color} />
            <Text style={[styles.statChipCount, { color: cfg.color }]}>{counts[status] || 0}</Text>
            <Text style={[styles.statChipLabel, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, reporter, category..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
      </View>

      {/* Filter tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 8, paddingBottom: 10 }}>
        {FILTER_TABS.map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.filterTab, activeFilter === tab && styles.filterTabActive]}
            onPress={() => setActiveFilter(tab)}
          >
            <Text style={[styles.filterTabText, activeFilter === tab && styles.filterTabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Problem List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 20, gap: 10 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchProblems(); }} />}
      >
        {loading ? (
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>Loading reports...</Text>
          </View>
        ) : filteredProblems.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="clipboard-outline" size={40} color="#D1D5DB" />
            <Text style={styles.emptyText}>{search ? "No matching reports" : "No reports in this category"}</Text>
          </View>
        ) : (
          filteredProblems.map((p) => {
            const cfg = STATUS_CONFIG[p.status] || STATUS_CONFIG.submitted;
            const pri = PRIORITY_CONFIG[p.priority] || PRIORITY_CONFIG.medium;
            const catIcon = CATEGORY_ICONS[p.category] || "alert-circle-outline";
            return (
              <TouchableOpacity key={p.id} style={styles.card} onPress={() => openDetail(p)} activeOpacity={0.8}>
                <View style={styles.cardTop}>
                  <View style={[styles.catIcon, { backgroundColor: cfg.bg }]}>
                    <Ionicons name={catIcon} size={18} color={cfg.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{p.title}</Text>
                    <Text style={styles.cardMeta}>
                      {p.anonymous ? "Anonymous" : p.submittedByName || "Unknown"} · {p.category} · {timeSince(p.createdAt)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  <View style={[styles.priorityDot, { backgroundColor: pri.color }]} />
                  <Text style={[styles.priorityText, { color: pri.color }]}>{pri.label} Priority</Text>
                  {p.jnvName ? <Text style={styles.jnvText}>· {p.jnvName}</Text> : null}
                  <Ionicons name="chevron-forward" size={16} color="#D1D5DB" style={{ marginLeft: "auto" }} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* Detail Modal */}
      <Modal visible={!!selected} animationType="slide" presentationStyle="pageSheet">
        {selected && (() => {
          const cfg = STATUS_CONFIG[selected.status] || STATUS_CONFIG.submitted;
          const pri = PRIORITY_CONFIG[selected.priority] || PRIORITY_CONFIG.medium;
          return (
            <View style={styles.modalWrap}>
              <View style={styles.modalHeader}>
                <TouchableOpacity style={styles.backBtn} onPress={() => setSelected(null)}>
                  <Ionicons name="close" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.modalTitle}>Problem Detail</Text>
                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: cfg.bg, borderColor: cfg.color + "60" }]}
                  onPress={() => setShowStatusMenu(true)}
                >
                  <Ionicons name={cfg.icon} size={14} color={cfg.color} />
                  <Text style={[styles.statusActionText, { color: cfg.color }]}>{cfg.label}</Text>
                  <Ionicons name="chevron-down" size={12} color={cfg.color} />
                </TouchableOpacity>
              </View>

              <ScrollView contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: insets.bottom + 40 }} keyboardShouldPersistTaps="handled">
                {/* Problem info */}
                <View style={styles.detailCard}>
                  <Text style={styles.detailTitle}>{selected.title}</Text>
                  <View style={styles.detailMetaRow}>
                    <View style={[styles.priorityChip, { backgroundColor: pri.color + "18" }]}>
                      <View style={[styles.priorityDot, { backgroundColor: pri.color }]} />
                      <Text style={[styles.priorityText, { color: pri.color }]}>{pri.label} Priority</Text>
                    </View>
                    <View style={[styles.categoryChip]}>
                      <Ionicons name={CATEGORY_ICONS[selected.category] || "alert-circle-outline"} size={13} color="#6B7280" />
                      <Text style={styles.categoryChipText}>{selected.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.detailDesc}>{selected.description}</Text>
                </View>

                {/* Reporter info */}
                <View style={styles.reporterCard}>
                  <Text style={styles.sectionLabel}>REPORTED BY</Text>
                  <View style={styles.reporterRow}>
                    <View style={styles.reporterAvatar}>
                      <Text style={styles.reporterAvatarText}>
                        {selected.anonymous ? "?" : (selected.submittedByName?.[0] || "?")}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.reporterName}>
                        {selected.anonymous ? "Anonymous" : selected.submittedByName || "Unknown"}
                      </Text>
                      {selected.jnvName ? <Text style={styles.reporterJnv}>{selected.jnvName}</Text> : null}
                      <Text style={styles.reporterTime}>{timeSince(selected.createdAt)}</Text>
                    </View>
                  </View>
                </View>

                {/* Status update actions */}
                <View style={styles.statusActionsCard}>
                  <Text style={styles.sectionLabel}>UPDATE STATUS</Text>
                  <View style={styles.statusActionsGrid}>
                    {STATUS_ACTIONS.map(({ status, label }) => {
                      const c = STATUS_CONFIG[status];
                      const isActive = selected.status === status;
                      const isLoading = updatingStatus === status;
                      return (
                        <TouchableOpacity
                          key={status}
                          style={[styles.statusActionTile, { backgroundColor: isActive ? c.bg : "#F9FAFB", borderColor: isActive ? c.color : "#E5E7EB" }]}
                          onPress={() => handleStatusUpdate(status)}
                          disabled={isActive || !!updatingStatus}
                        >
                          <Ionicons name={c.icon} size={18} color={isActive ? c.color : "#9CA3AF"} />
                          <Text style={[styles.statusActionTileText, { color: isActive ? c.color : "#6B7280" }]}>
                            {isLoading ? "..." : label}
                          </Text>
                          {isActive && <View style={[styles.activeDot, { backgroundColor: c.color }]} />}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>

                {/* Comments */}
                <View style={styles.commentsCard}>
                  <Text style={styles.sectionLabel}>COMMENTS ({selected.comments?.length || 0})</Text>
                  {(selected.comments || []).length === 0 ? (
                    <Text style={styles.noComments}>No comments yet. Add an official note below.</Text>
                  ) : (
                    (selected.comments || []).map((c: ProblemComment) => (
                      <View key={c.id} style={styles.commentRow}>
                        <View style={[styles.commentAvatar, c.role === "official" && { backgroundColor: "#EEF2FF" }]}>
                          <Text style={[styles.commentAvatarText, c.role === "official" && { color: "#3D5AF1" }]}>
                            {c.authorName?.[0] || "?"}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={styles.commentNameRow}>
                            <Text style={styles.commentName}>{c.authorName}</Text>
                            {c.role === "official" && <View style={styles.officialBadge}><Text style={styles.officialBadgeText}>Official</Text></View>}
                          </View>
                          <Text style={styles.commentText}>{c.text}</Text>
                          <Text style={styles.commentTime}>{timeSince(c.createdAt || "")}</Text>
                        </View>
                      </View>
                    ))
                  )}
                  <View style={styles.addCommentRow}>
                    <TextInput
                      style={styles.commentInput}
                      placeholder="Add an official note or update..."
                      placeholderTextColor="#9CA3AF"
                      value={comment}
                      onChangeText={setComment}
                      multiline
                      maxLength={500}
                      textAlignVertical="top"
                    />
                    <TouchableOpacity
                      style={[styles.commentSendBtn, !comment.trim() && { opacity: 0.4 }]}
                      onPress={handleComment}
                      disabled={!comment.trim() || submitting}
                    >
                      <Ionicons name={submitting ? "hourglass-outline" : "send"} size={18} color="#fff" />
                    </TouchableOpacity>
                  </View>
                </View>
              </ScrollView>
            </View>
          );
        })()}
      </Modal>

      {/* Status quick-pick menu */}
      <Modal visible={showStatusMenu} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} onPress={() => setShowStatusMenu(false)} activeOpacity={1}>
          <View style={styles.menuCard}>
            <Text style={styles.menuTitle}>Change Status</Text>
            {STATUS_ACTIONS.map(({ status, label }) => {
              const c = STATUS_CONFIG[status];
              return (
                <TouchableOpacity key={status} style={styles.menuRow} onPress={() => { setShowStatusMenu(false); handleStatusUpdate(status); }}>
                  <Ionicons name={c.icon} size={20} color={c.color} />
                  <Text style={[styles.menuRowText, { color: c.color }]}>{label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  statsRow: { backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  statChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  statChipCount: { fontSize: 15, fontFamily: "Inter_700Bold" },
  statChipLabel: { fontSize: 11, fontFamily: "Inter_500Medium" },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", marginHorizontal: 16, marginVertical: 10, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  filterTab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F3F4F6" },
  filterTabActive: { backgroundColor: "#1A3C6E" },
  filterTabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  filterTabTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  emptyWrap: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", gap: 10 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  catIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", flex: 1, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },
  statusBadge: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  statusBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold" },
  cardBottom: { flexDirection: "row", alignItems: "center", gap: 6 },
  priorityDot: { width: 6, height: 6, borderRadius: 3 },
  priorityText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  jnvText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  priorityChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  categoryChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F9FAFB", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  categoryChipText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6B7280" },
  modalWrap: { flex: 1, backgroundColor: "#F5F6FA" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  statusActionBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  statusActionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  detailCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", gap: 10 },
  detailTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", lineHeight: 24 },
  detailMetaRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 22 },
  reporterCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", gap: 12 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 4 },
  reporterRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  reporterAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#FFFBEB", alignItems: "center", justifyContent: "center" },
  reporterAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#D97706" },
  reporterName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  reporterJnv: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  reporterTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  statusActionsCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", gap: 12 },
  statusActionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusActionTile: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 10, borderWidth: 1.5, position: "relative" },
  statusActionTileText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  activeDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 2 },
  commentsCard: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", gap: 12 },
  noComments: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", paddingVertical: 8 },
  commentRow: { flexDirection: "row", gap: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  commentAvatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  commentAvatarText: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#10B981" },
  commentNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  commentName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  officialBadge: { backgroundColor: "#EEF2FF", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  officialBadgeText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  commentText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 19 },
  commentTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 2 },
  addCommentRow: { flexDirection: "row", gap: 10, alignItems: "flex-end", paddingTop: 4 },
  commentInput: { flex: 1, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 60 },
  commentSendBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#1A3C6E", alignItems: "center", justifyContent: "center" },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  menuCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, width: "100%", gap: 6 },
  menuTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  menuRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderTopWidth: 1, borderTopColor: "#F9FAFB" },
  menuRowText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
