import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type Event, type EventRegistrationItem, type EventRegistrationsDashboardResponse } from "@/lib/api";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

interface Props {
  event: Event | null;
  visible: boolean;
  onClose: () => void;
}

const ROLE_FILTERS = [
  { value: "", label: "All Roles" },
  { value: "student", label: "Student" },
  { value: "alumni", label: "Alumni" },
  { value: "teacher", label: "Teacher" },
  { value: "official", label: "Official" },
];

const STATUS_FILTERS = [
  { value: "", label: "All Status" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

const ATTENDANCE_FILTERS = [
  { value: "", label: "All Attendance" },
  { value: "checked_in", label: "Checked In" },
  { value: "not_checked_in", label: "Not Checked In" },
];

const SORT_OPTIONS: Array<{ value: "newest" | "oldest" | "name_asc" | "name_desc"; label: string }> = [
  { value: "newest", label: "Newest" },
  { value: "oldest", label: "Oldest" },
  { value: "name_asc", label: "Name A–Z" },
  { value: "name_desc", label: "Name Z–A" },
];

function formatShortDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function EventRegistrationsModal({ event, visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "name_asc" | "name_desc">("newest");
  const [page, setPage] = useState(1);
  const [dashboard, setDashboard] = useState<EventRegistrationsDashboardResponse | null>(null);
  const [items, setItems] = useState<EventRegistrationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [search]);

  const loadRegistrations = useCallback(
    async (targetPage = 1, append = false) => {
      if (!event?.id || !visible) return;
      if (!append) setLoading(true);
      setError("");
      try {
        const res = await api.events.registrations(event.id, {
          ...(debouncedSearch ? { search: debouncedSearch } : {}),
          ...(roleFilter ? { role: roleFilter } : {}),
          ...(statusFilter ? { status: statusFilter } : {}),
          ...(attendanceFilter ? { attendanceStatus: attendanceFilter } : {}),
          sort,
          page: targetPage,
          limit: 30,
        });
        setDashboard(res);
        setItems((prev) => (append ? [...prev, ...res.items] : res.items));
        setPage(targetPage);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load registrations.");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [event?.id, visible, debouncedSearch, roleFilter, statusFilter, attendanceFilter, sort],
  );

  useEffect(() => {
    if (visible && event?.id) {
      void loadRegistrations(1, false);
    } else if (!visible) {
      setSearch("");
      setRoleFilter("");
      setStatusFilter("");
      setAttendanceFilter("");
      setSort("newest");
      setItems([]);
      setDashboard(null);
    }
  }, [visible, event?.id, loadRegistrations]);

  const handleToggleCheckIn = async (item: EventRegistrationItem) => {
    if (!event?.id || item.status !== "confirmed" || busyId) return;
    const nextCheckedIn = item.attendanceStatus !== "checked_in";
    setBusyId(item.id);
    try {
      const updated = await api.events.checkIn(event.id, item.id, nextCheckedIn);
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                attendanceStatus: updated.attendanceStatus as "checked_in" | "not_checked_in",
                checkedInAt: updated.checkedInAt,
              }
            : row,
        ),
      );
      setDashboard((prev) =>
        prev
          ? {
              ...prev,
              summary: {
                ...prev.summary,
                checkedIn: Math.max(0, prev.summary.checkedIn + (nextCheckedIn ? 1 : -1)),
              },
            }
          : prev,
      );
    } catch (e) {
      Alert.alert("Check-in failed", e instanceof Error ? e.message : "Could not update attendance.");
    } finally {
      setBusyId(null);
    }
  };

  const handleExportCsv = async () => {
    if (!event?.id || exporting) return;
    setExporting(true);
    try {
      const csv = await api.events.exportRegistrationsCsv(event.id);
      if (Platform.OS === "web" && typeof document !== "undefined") {
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `${(event.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-registrations.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        await Share.share({
          title: `${event.title} Registrations`,
          message: csv,
        });
      }
    } catch (e) {
      Alert.alert("Export failed", e instanceof Error ? e.message : "Could not export attendee list.");
    } finally {
      setExporting(false);
    }
  };

  const summary = dashboard?.summary;
  const maxActivity = Math.max(1, ...(summary?.activityByDay.map((d) => d.count) ?? [1]));

  const renderAttendee = ({ item }: { item: EventRegistrationItem }) => {
    const isCheckedIn = item.attendanceStatus === "checked_in";
    const isCancelled = item.status === "cancelled";
    const extraAnswers = Object.entries(item.customAnswers || {});
    return (
      <View style={styles.attendeeCard}>
        <View style={styles.attendeeTop}>
          <TouchableOpacity
            style={styles.avatarWrap}
            disabled={!item.canOpenProfile}
            onPress={() => {
              onClose();
              router.push({ pathname: "/(screens)/user-profile" as any, params: { userId: item.userId } });
            }}
          >
            {item.photoUrl ? (
              <Image source={{ uri: item.photoUrl }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarText}>{item.fullName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={styles.nameRow}>
              <TouchableOpacity
                disabled={!item.canOpenProfile}
                onPress={() => {
                  onClose();
                  router.push({ pathname: "/(screens)/user-profile" as any, params: { userId: item.userId } });
                }}
              >
                <Text style={[styles.attendeeName, item.canOpenProfile && styles.attendeeNameLink]} numberOfLines={1}>
                  {item.fullName}
                </Text>
              </TouchableOpacity>
              <View style={styles.roleBadge}>
                <Text style={styles.roleBadgeText}>{item.role.toUpperCase()}</Text>
              </View>
            </View>
            <Text style={styles.attendeeMeta} numberOfLines={1}>
              {[item.jnvName, item.passoutBatch ? `Batch ${item.passoutBatch}` : null, item.class ? `Class ${item.class}` : null]
                .filter(Boolean)
                .join(" · ") || "Navodaya Connect Member"}
            </Text>
            <Text style={styles.attendeeTime}>
              Registered {formatShortDate(item.createdAt)} · {item.attendingInPerson ? "In-person" : "Online"}
            </Text>
          </View>
        </View>

        <View style={styles.badgesRow}>
          <View style={[styles.statusBadge, isCancelled ? styles.statusCancelled : styles.statusConfirmed]}>
            <Ionicons
              name={isCancelled ? "close-circle" : "checkmark-circle"}
              size={13}
              color={isCancelled ? "#B42318" : "#059669"}
            />
            <Text style={[styles.statusBadgeText, isCancelled ? styles.statusCancelledText : styles.statusConfirmedText]}>
              {isCancelled ? "CANCELLED" : "CONFIRMED"}
            </Text>
          </View>

          {!isCancelled ? (
            <View style={[styles.statusBadge, isCheckedIn ? styles.checkedInBadge : styles.notCheckedInBadge]}>
              <Ionicons name={isCheckedIn ? "qr-code" : "time-outline"} size={13} color={isCheckedIn ? "#6D28D9" : "#64748B"} />
              <Text style={[styles.statusBadgeText, isCheckedIn ? styles.checkedInText : styles.notCheckedInText]}>
                {isCheckedIn ? `Checked In ${formatShortDate(item.checkedInAt)}` : "Not Checked In"}
              </Text>
            </View>
          ) : null}
        </View>

        {(item.contribution || (item.dietaryPreference && item.dietaryPreference !== "No Preference") || item.feedback || extraAnswers.length > 0) ? (
          <View style={styles.answersBox}>
            {item.contribution ? <Text style={styles.answerLine}>Profession/Role: {item.contribution}</Text> : null}
            {item.dietaryPreference && item.dietaryPreference !== "No Preference" ? (
              <Text style={styles.answerLine}>Dietary: {item.dietaryPreference}</Text>
            ) : null}
            {item.feedback ? <Text style={styles.answerLine}>Note: {item.feedback}</Text> : null}
            {extraAnswers.map(([q, a]) => (
              <Text key={q} style={styles.answerLine}>{q}: {a}</Text>
            ))}
          </View>
        ) : null}

        {!isCancelled ? (
          <View style={styles.cardActions}>
            <TouchableOpacity
              style={[styles.checkInBtn, isCheckedIn && styles.undoCheckInBtn]}
              onPress={() => void handleToggleCheckIn(item)}
              disabled={busyId === item.id}
            >
              {busyId === item.id ? (
                <ActivityIndicator size="small" color={isCheckedIn ? "#6D28D9" : "#fff"} />
              ) : (
                <>
                  <Ionicons name={isCheckedIn ? "arrow-undo-outline" : "checkmark-done-outline"} size={16} color={isCheckedIn ? "#6D28D9" : "#fff"} />
                  <Text style={[styles.checkInBtnText, isCheckedIn && styles.undoCheckInBtnText]}>
                    {isCheckedIn ? "Undo Check-In" : "Mark Checked In"}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 8 : insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close registrations dashboard">
            <Ionicons name="arrow-back" size={21} color="#1E1B4B" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Manage Registrations</Text>
            <Text style={styles.headerSub} numberOfLines={1}>{event?.title || "Event"}</Text>
          </View>
          <TouchableOpacity style={styles.exportBtn} onPress={() => void handleExportCsv()} disabled={exporting}>
            {exporting ? (
              <ActivityIndicator size="small" color="#7C3AED" />
            ) : (
              <>
                <Ionicons name="download-outline" size={16} color="#7C3AED" />
                <Text style={styles.exportBtnText}>CSV</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={renderAttendee}
          contentContainerStyle={[styles.listContent, { paddingBottom: Math.max(insets.bottom, 20) + 24 }]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadRegistrations(1, false);
              }}
              tintColor="#7C3AED"
            />
          }
          ListHeaderComponent={
            <View>
              {summary ? (
                <View style={styles.summarySection}>
                  <View style={styles.summaryGrid}>
                    <View style={styles.statCard}>
                      <Text style={styles.statValue}>{summary.total}</Text>
                      <Text style={styles.statLabel}>Total</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" }]}>
                      <Text style={[styles.statValue, { color: "#059669" }]}>{summary.confirmed}</Text>
                      <Text style={styles.statLabel}>Confirmed</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                      <Text style={[styles.statValue, { color: "#6D28D9" }]}>{summary.checkedIn}</Text>
                      <Text style={styles.statLabel}>Checked In</Text>
                    </View>
                    <View style={[styles.statCard, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
                      <Text style={[styles.statValue, { color: "#B42318" }]}>{summary.cancelled}</Text>
                      <Text style={styles.statLabel}>Cancelled</Text>
                    </View>
                  </View>

                  {summary.maxCapacity != null ? (
                    <View style={styles.capacityBarWrap}>
                      <Text style={styles.capacityText}>
                        Capacity: {summary.confirmed} / {summary.maxCapacity} · {summary.remainingCapacity} spots remaining
                      </Text>
                    </View>
                  ) : null}

                  {summary.activityByDay.length > 0 ? (
                    <View style={styles.activityCard}>
                      <Text style={styles.activityTitle}>Registration Activity</Text>
                      <View style={styles.activityBars}>
                        {summary.activityByDay.map((d) => (
                          <View key={d.date} style={styles.activityCol}>
                            <View style={[styles.activityBar, { height: Math.max(6, Math.round((d.count / maxActivity) * 34)) }]} />
                            <Text style={styles.activityDate}>{d.date.slice(5)}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ) : null}
                </View>
              ) : null}

              <View style={styles.searchBox}>
                <Ionicons name="search-outline" size={17} color="#7C3AED" />
                <TextInput
                  style={styles.searchInput}
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search name, Digital ID, JNV, batch..."
                  placeholderTextColor="#94A3B8"
                />
                {search ? (
                  <TouchableOpacity onPress={() => setSearch("")}>
                    <Ionicons name="close-circle" size={17} color="#94A3B8" />
                  </TouchableOpacity>
                ) : null}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {ROLE_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={`role-${f.value}`}
                    style={[styles.filterChip, roleFilter === f.value && styles.filterChipActive]}
                    onPress={() => { setRoleFilter(f.value); setPage(1); }}
                  >
                    <Text style={[styles.filterText, roleFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {STATUS_FILTERS.map((f) => (
                  <TouchableOpacity
                    key={`status-${f.value}`}
                    style={[styles.filterChip, statusFilter === f.value && styles.filterChipActive]}
                    onPress={() => { setStatusFilter(f.value); setPage(1); }}
                  >
                    <Text style={[styles.filterText, statusFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
                {ATTENDANCE_FILTERS.filter((f) => f.value !== "").map((f) => (
                  <TouchableOpacity
                    key={`att-${f.value}`}
                    style={[styles.filterChip, attendanceFilter === f.value && styles.filterChipActive]}
                    onPress={() => { setAttendanceFilter(attendanceFilter === f.value ? "" : f.value); setPage(1); }}
                  >
                    <Text style={[styles.filterText, attendanceFilter === f.value && styles.filterTextActive]}>{f.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {SORT_OPTIONS.map((s) => (
                  <TouchableOpacity
                    key={`sort-${s.value}`}
                    style={[styles.sortChip, sort === s.value && styles.sortChipActive]}
                    onPress={() => { setSort(s.value); setPage(1); }}
                  >
                    <Text style={[styles.sortText, sort === s.value && styles.sortTextActive]}>Sort: {s.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}
            </View>
          }
          ListEmptyComponent={
            loading ? (
              <View style={styles.emptyWrap}>
                <ActivityIndicator size="small" color="#7C3AED" />
                <Text style={styles.emptyText}>Loading participants...</Text>
              </View>
            ) : (
              <View style={styles.emptyWrap}>
                <Ionicons name="people-outline" size={34} color="#A78BFA" />
                <Text style={styles.emptyTitle}>No matching participants</Text>
                <Text style={styles.emptyText}>Confirmed and cancelled registrations will appear here.</Text>
              </View>
            )
          }
          ListFooterComponent={
            dashboard?.pagination.hasMore ? (
              <TouchableOpacity style={styles.loadMoreBtn} onPress={() => void loadRegistrations(page + 1, true)}>
                <Text style={styles.loadMoreText}>Load more participants</Text>
              </TouchableOpacity>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EDE9FE",
  },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 1 },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  exportBtnText: { color: "#7C3AED", fontSize: 12, fontFamily: "Inter_700Bold" },
  listContent: { padding: 16 },
  summarySection: { marginBottom: 14, gap: 10 },
  summaryGrid: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  statValue: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  statLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#64748B", marginTop: 2 },
  capacityBarWrap: { backgroundColor: "#F5F3FF", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#DDD6FE" },
  capacityText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#6D28D9" },
  activityCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#EDE9FE" },
  activityTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 8 },
  activityBars: { flexDirection: "row", alignItems: "flex-end", gap: 8, minHeight: 48 },
  activityCol: { alignItems: "center", gap: 4 },
  activityBar: { width: 14, borderRadius: 4, backgroundColor: "#7C3AED" },
  activityDate: { fontSize: 9, color: "#64748B", fontFamily: "Inter_500Medium" },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 10,
  },
  searchInput: { flex: 1, fontSize: 13, color: "#1E1B4B", fontFamily: "Inter_400Regular", paddingVertical: 0 },
  filterRow: { gap: 8, paddingBottom: 8 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E2E8F0" },
  filterChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  filterText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#475569" },
  filterTextActive: { color: "#FFFFFF" },
  sortChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 12, backgroundColor: "#F1F5F9" },
  sortChipActive: { backgroundColor: "#EDE9FE" },
  sortText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#475569" },
  sortTextActive: { color: "#6D28D9" },
  errorText: { color: "#B42318", fontSize: 12, fontFamily: "Inter_600SemiBold", marginVertical: 8 },
  attendeeCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    gap: 10,
  },
  attendeeTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrap: {},
  avatar: { width: 44, height: 44, borderRadius: 22 },
  avatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#EDE9FE", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#6D28D9" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  attendeeName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  attendeeNameLink: { color: "#6D28D9", textDecorationLine: "underline" },
  roleBadge: { backgroundColor: "#F5F3FF", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  roleBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#7C3AED" },
  attendeeMeta: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#475569", marginTop: 2 },
  attendeeTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },
  badgesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  statusBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusConfirmed: { backgroundColor: "#ECFDF5" },
  statusConfirmedText: { color: "#059669" },
  statusCancelled: { backgroundColor: "#FEF2F2" },
  statusCancelledText: { color: "#B42318" },
  checkedInBadge: { backgroundColor: "#F5F3FF" },
  checkedInText: { color: "#6D28D9" },
  notCheckedInBadge: { backgroundColor: "#F1F5F9" },
  notCheckedInText: { color: "#64748B" },
  statusBadgeText: { fontSize: 11, fontFamily: "Inter_700Bold" },
  answersBox: { backgroundColor: "#F8FAFC", borderRadius: 10, padding: 10, gap: 4 },
  answerLine: { fontSize: 12, color: "#334155", fontFamily: "Inter_400Regular" },
  cardActions: { flexDirection: "row", justifyContent: "flex-end" },
  checkInBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
  },
  undoCheckInBtn: { backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#DDD6FE" },
  checkInBtnText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_700Bold" },
  undoCheckInBtnText: { color: "#6D28D9" },
  emptyWrap: { alignItems: "center", paddingVertical: 42, gap: 8 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  emptyText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", textAlign: "center" },
  loadMoreBtn: { alignSelf: "center", paddingHorizontal: 18, paddingVertical: 10, borderRadius: 14, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#DDD6FE", marginTop: 6 },
  loadMoreText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#7C3AED" },
});
