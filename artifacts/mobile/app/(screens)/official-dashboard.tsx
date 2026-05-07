import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { LinearGradient } from "expo-linear-gradient";

const TABS = ["Overview", "Students", "Teachers", "Alumni", "Pending"];

const MOCK_STUDENTS = [
  { id: "s1", name: "Ravi Kumar",     class: "Class 9 B",           jnvName: "JNV Jaipur", house: "Aravali"  },
  { id: "s2", name: "Priya Singh",    class: "Class 9 A",           jnvName: "JNV Jaipur", house: "Nilgiri"  },
  { id: "s3", name: "Arjun Sharma",   class: "Class 11 Science A",  jnvName: "JNV Jaipur", house: "Shivalik" },
  { id: "s4", name: "Meena Yadav",    class: "Class 12 Commerce B", jnvName: "JNV Jaipur", house: "Udaygiri" },
  { id: "s5", name: "Kiran Patel",    class: "Class 7 B",           jnvName: "JNV Jaipur", house: "Aravali"  },
  { id: "s6", name: "Sneha Gupta",    class: "Class 11 Science B",  jnvName: "JNV Jaipur", house: "Nilgiri"  },
  { id: "s7", name: "Amit Verma",     class: "Class 8 A",           jnvName: "JNV Jaipur", house: "Shivalik" },
  { id: "s8", name: "Pooja Joshi",    class: "Class 12 Arts A",     jnvName: "JNV Jaipur", house: "Udaygiri" },
];

const MOCK_TEACHERS = [
  { id: "t1", name: "Mr. Ramesh Kumar", subject: "Physics",    assignedClass: "Class 11 Science", status: "verified" },
  { id: "t2", name: "Ms. Asha Devi",    subject: "Chemistry",  assignedClass: "Class 12 Science", status: "verified" },
  { id: "t3", name: "Mr. Sunil Tiwari", subject: "Maths",      assignedClass: "Class 10",         status: "verified" },
  { id: "t4", name: "Ms. Pooja Gupta",  subject: "English",    assignedClass: "Class 9",          status: "pending"  },
  { id: "t5", name: "Mr. Ajay Singh",   subject: "History",    assignedClass: "Class 8",          status: "unverified"},
];

const MOCK_ALUMNI = [
  { id: "a1", name: "Priya Sharma",   profession: "Software Engineer",  batch: "2019", status: "verified"   },
  { id: "a2", name: "Amit Kumar",     profession: "MBBS Doctor",         batch: "2016", status: "verified"   },
  { id: "a3", name: "Neha Gupta",     profession: "IAS Officer",         batch: "2015", status: "verified"   },
  { id: "a4", name: "Raj Mehta",      profession: "CA",                  batch: "2018", status: "unverified" },
  { id: "a5", name: "Sunita Devi",    profession: "Army Officer",        batch: "2014", status: "pending"    },
];

const MOCK_PENDING = [
  { id: "p1", name: "Ms. Pooja Gupta",  role: "teacher", claim: "Teacher at JNV Jaipur", submitted: "2 days ago" },
  { id: "p2", name: "Sunita Devi",      role: "alumni",  claim: "JNV Jaipur Batch 2014 · Indian Army", submitted: "5 days ago" },
  { id: "p3", name: "Vivek Sharma",     role: "alumni",  claim: "JNV Jaipur Batch 2020 · Engineer at TCS", submitted: "1 week ago" },
];

const CLASS_GROUPS: Record<string, typeof MOCK_STUDENTS> = {};
MOCK_STUDENTS.forEach((s) => {
  const key = s.class.split(" ").slice(0, 2).join(" ");
  if (!CLASS_GROUPS[key]) CLASS_GROUPS[key] = [];
  CLASS_GROUPS[key].push(s);
});

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const HOUSE_COLORS: Record<string, string> = {
  Aravali: "#1D6ADE", Nilgiri: "#16A34A", Shivalik: "#DC2626", Udaygiri: "#D97706",
};

export default function OfficialDashboardScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [activeTab, setActiveTab] = useState("Overview");
  const [search, setSearch] = useState("");
  const [pendingActions, setPendingActions] = useState<Record<string, "approved" | "rejected" | null>>({});
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const handleVerify = (id: string, action: "approved" | "rejected", name: string) => {
    setPendingActions((p) => ({ ...p, [id]: action }));
    showToast(action === "approved" ? `✅ ${name} verified!` : `❌ ${name} request rejected.`);
  };

  const stats = [
    { label: "Total Students", value: "247", icon: "school-outline" as const, color: "#3D5AF1", bg: "#EEF2FF" },
    { label: "Teachers",       value: "18",  icon: "book-outline"   as const, color: "#10B981", bg: "#ECFDF5" },
    { label: "Alumni",         value: "534", icon: "people-outline" as const, color: "#F59E0B", bg: "#FFFBEB" },
    { label: "Pending",        value: String(MOCK_PENDING.length), icon: "time-outline" as const, color: "#EF4444", bg: "#FEF2F2" },
  ];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>School Dashboard</Text>
          <Text style={styles.headerSub}>{profile?.jnvName || "JNV India"}</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} onPress={() => router.push("/(screens)/notifications" as any)}>
          <Ionicons name="notifications-outline" size={20} color="#3D5AF1" />
          {MOCK_PENDING.length > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar} style={{ flexGrow: 0 }}>
        {TABS.map((tab) => (
          <TouchableOpacity key={tab} style={[styles.tab, activeTab === tab && styles.tabActive]} onPress={() => setActiveTab(tab)}>
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab}{tab === "Pending" && MOCK_PENDING.filter((p) => !pendingActions[p.id]).length > 0 ? ` (${MOCK_PENDING.filter((p) => !pendingActions[p.id]).length})` : ""}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* ─── OVERVIEW ─── */}
        {activeTab === "Overview" && (
          <>
            <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.overviewCard}>
              <Text style={styles.overviewJnv}>{profile?.jnvName || "JNV India"}</Text>
              <Text style={styles.overviewRole}>JNV Official Dashboard</Text>
              <View style={styles.overviewStatsRow}>
                {stats.map((s) => (
                  <View key={s.label} style={styles.overviewStat}>
                    <Text style={styles.overviewStatVal}>{s.value}</Text>
                    <Text style={styles.overviewStatLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </LinearGradient>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Stats</Text>
              <View style={styles.statsGrid}>
                {stats.map((s) => (
                  <View key={s.label} style={[styles.statCard, { backgroundColor: s.bg }]}>
                    <View style={[styles.statIcon, { backgroundColor: s.color + "22" }]}>
                      <Ionicons name={s.icon} size={22} color={s.color} />
                    </View>
                    <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                    <Text style={styles.statLabel}>{s.label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pending Actions</Text>
              {MOCK_PENDING.filter((p) => !pendingActions[p.id]).slice(0, 2).map((item) => (
                <View key={item.id} style={styles.pendingCard}>
                  <View style={styles.pendingAvatar}>
                    <Text style={styles.pendingAvatarText}>{getInitials(item.name)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pendingName}>{item.name}</Text>
                    <Text style={styles.pendingClaim}>{item.claim}</Text>
                  </View>
                  <View style={styles.pendingBtns}>
                    <TouchableOpacity style={styles.approveSmBtn} onPress={() => handleVerify(item.id, "approved", item.name)}>
                      <Ionicons name="checkmark" size={14} color="#10B981" />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.rejectSmBtn} onPress={() => handleVerify(item.id, "rejected", item.name)}>
                      <Ionicons name="close" size={14} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
              {MOCK_PENDING.filter((p) => !pendingActions[p.id]).length === 0 && (
                <View style={styles.allClear}>
                  <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                  <Text style={styles.allClearText}>All verification requests handled</Text>
                </View>
              )}
            </View>
          </>
        )}

        {/* ─── STUDENTS ─── */}
        {activeTab === "Students" && (
          <View style={styles.section}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} placeholder="Search students..." placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
            </View>
            {Object.entries(CLASS_GROUPS).map(([cls, students]) => {
              const shown = search ? students.filter((s) => s.name.toLowerCase().includes(search.toLowerCase())) : students;
              if (shown.length === 0) return null;
              return (
                <View key={cls} style={styles.classGroup}>
                  <View style={styles.classGroupHeader}>
                    <Text style={styles.classGroupTitle}>{cls}</Text>
                    <View style={styles.classCountBadge}><Text style={styles.classCountText}>{shown.length}</Text></View>
                  </View>
                  {shown.map((s) => (
                    <View key={s.id} style={styles.studentRow}>
                      <View style={[styles.studentAvatar, { backgroundColor: (HOUSE_COLORS[s.house] || "#3D5AF1") + "22" }]}>
                        <Text style={[styles.studentAvatarText, { color: HOUSE_COLORS[s.house] || "#3D5AF1" }]}>{getInitials(s.name)}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.studentName}>{s.name}</Text>
                        <Text style={styles.studentClass}>{s.class} · {s.house} House</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                    </View>
                  ))}
                </View>
              );
            })}
          </View>
        )}

        {/* ─── TEACHERS ─── */}
        {activeTab === "Teachers" && (
          <View style={styles.section}>
            {MOCK_TEACHERS.map((t) => (
              <View key={t.id} style={styles.teacherCard}>
                <View style={styles.teacherAvatarWrap}>
                  <View style={styles.teacherAvatar}>
                    <Text style={styles.teacherAvatarText}>{getInitials(t.name)}</Text>
                  </View>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.teacherNameRow}>
                    <Text style={styles.teacherName}>{t.name}</Text>
                    <VerifiedBadge status={t.status} role="teacher" size="sm" />
                  </View>
                  <Text style={styles.teacherSubject}>{t.subject}</Text>
                  <Text style={styles.teacherClass}>Assigned: {t.assignedClass}</Text>
                </View>
                <View style={[styles.statusPill, { backgroundColor: t.status === "verified" ? "#ECFDF5" : t.status === "pending" ? "#FFFBEB" : "#F3F4F6" }]}>
                  <Text style={[styles.statusPillText, { color: t.status === "verified" ? "#10B981" : t.status === "pending" ? "#D97706" : "#6B7280" }]}>
                    {t.status === "verified" ? "Verified" : t.status === "pending" ? "Pending" : "Unverified"}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── ALUMNI ─── */}
        {activeTab === "Alumni" && (
          <View style={styles.section}>
            <View style={styles.searchWrap}>
              <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
              <TextInput style={styles.searchInput} placeholder="Search alumni..." placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
            </View>
            {MOCK_ALUMNI.filter((a) => !search || a.name.toLowerCase().includes(search.toLowerCase())).map((a) => (
              <View key={a.id} style={styles.alumniCard}>
                <View style={styles.alumniAvatar}>
                  <Text style={styles.alumniAvatarText}>{getInitials(a.name)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.alumniNameRow}>
                    <Text style={styles.alumniName}>{a.name}</Text>
                    <VerifiedBadge status={a.status} role="alumni" size="sm" />
                  </View>
                  <Text style={styles.alumniProf}>{a.profession}</Text>
                  <Text style={styles.alumniBatch}>Batch {a.batch}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* ─── PENDING ─── */}
        {activeTab === "Pending" && (
          <View style={styles.section}>
            <Text style={styles.pendingInfo}>Review and verify teacher & alumni accounts for your JNV.</Text>
            {MOCK_PENDING.map((item) => {
              const action = pendingActions[item.id];
              return (
                <View key={item.id} style={[styles.pendingFullCard, action && { opacity: 0.6 }]}>
                  <View style={styles.pendingFullTop}>
                    <View style={styles.pendingAvatar}>
                      <Text style={styles.pendingAvatarText}>{getInitials(item.name)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pendingName}>{item.name}</Text>
                      <Text style={styles.pendingRole}>{item.role === "teacher" ? "Teacher" : "Alumni"} · Submitted {item.submitted}</Text>
                    </View>
                    <View style={[styles.roleBadge, { backgroundColor: item.role === "teacher" ? "#ECFDF5" : "#EEF2FF" }]}>
                      <Text style={[styles.roleBadgeText, { color: item.role === "teacher" ? "#10B981" : "#3D5AF1" }]}>{item.role}</Text>
                    </View>
                  </View>
                  <View style={styles.pendingClaimRow}>
                    <Ionicons name="information-circle-outline" size={15} color="#6B7280" />
                    <Text style={styles.pendingClaimText}>{item.claim}</Text>
                  </View>
                  {action ? (
                    <View style={[styles.actionDoneRow, { backgroundColor: action === "approved" ? "#ECFDF5" : "#FEF2F2" }]}>
                      <Ionicons name={action === "approved" ? "checkmark-circle" : "close-circle"} size={16} color={action === "approved" ? "#10B981" : "#EF4444"} />
                      <Text style={[styles.actionDoneText, { color: action === "approved" ? "#10B981" : "#EF4444" }]}>
                        {action === "approved" ? "Approved & Verified" : "Request Rejected"}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.pendingFullBtns}>
                      <TouchableOpacity style={styles.approveBtn} onPress={() => handleVerify(item.id, "approved", item.name)}>
                        <Ionicons name="checkmark-circle-outline" size={16} color="#fff" />
                        <Text style={styles.approveBtnText}>Approve & Verify</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={styles.rejectBtn} onPress={() => handleVerify(item.id, "rejected", item.name)}>
                        <Ionicons name="close-circle-outline" size={16} color="#EF4444" />
                        <Text style={styles.rejectBtnText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
            {MOCK_PENDING.filter((p) => !pendingActions[p.id]).length === 0 && (
              <View style={styles.allClear}>
                <Ionicons name="checkmark-circle" size={24} color="#10B981" />
                <Text style={styles.allClearText}>All pending requests have been reviewed!</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

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
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  notifBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  notifDot: { position: "absolute", top: 7, right: 7, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#EEF2FF" },
  tabBar: { paddingHorizontal: 14, gap: 8, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  tab: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F3F4F6" },
  tabActive: { backgroundColor: "#3D5AF1" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  tabTextActive: { color: "#fff", fontFamily: "Inter_600SemiBold" },
  overviewCard: { margin: 16, borderRadius: 18, padding: 20 },
  overviewJnv: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 4 },
  overviewRole: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 20 },
  overviewStatsRow: { flexDirection: "row" },
  overviewStat: { flex: 1, alignItems: "center" },
  overviewStatVal: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  overviewStatLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular", textAlign: "center" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginBottom: 8 },
  statCard: { width: "47%", borderRadius: 16, padding: 16, gap: 6 },
  statIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  statVal: { fontSize: 26, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 14,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  classGroup: { marginBottom: 16 },
  classGroupHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  classGroupTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827" },
  classCountBadge: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  classCountText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  studentRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 6,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  studentAvatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  studentAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold" },
  studentName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  studentClass: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  teacherCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  teacherAvatarWrap: {},
  teacherAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  teacherAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#10B981" },
  teacherNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  teacherName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  teacherSubject: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 2 },
  teacherClass: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  statusPill: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  alumniCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  alumniAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  alumniAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  alumniNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  alumniName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  alumniProf: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 2 },
  alumniBatch: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  pendingInfo: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 16, lineHeight: 19 },
  pendingCard: {
    flexDirection: "row", alignItems: "center", gap: 10,
    backgroundColor: "#fff", borderRadius: 12, padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: "#FEF3C7",
  },
  pendingFullCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  pendingFullTop: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  pendingAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFBEB", alignItems: "center", justifyContent: "center" },
  pendingAvatarText: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#D97706" },
  pendingName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  pendingRole: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  pendingClaim: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  pendingClaimRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, backgroundColor: "#F9FAFB", borderRadius: 8, padding: 10, marginBottom: 14 },
  pendingClaimText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151" },
  roleBadge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  roleBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  pendingBtns: { flexDirection: "row", gap: 6 },
  approveSmBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  rejectSmBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  pendingFullBtns: { flexDirection: "row", gap: 10 },
  approveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#10B981", borderRadius: 10, paddingVertical: 10,
  },
  approveBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  rejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#EF4444", borderRadius: 10, paddingVertical: 10,
  },
  rejectBtnText: { color: "#EF4444", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  actionDoneRow: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 10, padding: 10 },
  actionDoneText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  allClear: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16, backgroundColor: "#ECFDF5", borderRadius: 14 },
  allClearText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#065F46" },
  toast: {
    position: "absolute", bottom: 36, left: 24, right: 24,
    backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
