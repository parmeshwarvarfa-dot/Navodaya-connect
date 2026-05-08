import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const CATEGORIES = ["JEE/IIT", "NEET", "UPSC", "Coding/Tech", "Startup", "Defence", "Law", "Research", "General Career"];
const CAT_COLOR: Record<string, string> = {
  "JEE/IIT": "#3D5AF1", "NEET": "#10B981", "UPSC": "#8B5CF6", "Coding/Tech": "#0891B2",
  "Startup": "#F59E0B", "Defence": "#6366F1", "Law": "#EC4899", "Research": "#D97706", "General Career": "#6B7280",
};

const MENTORS = [
  { id: "1", name: "Rahul Verma",     role: "SWE at Google",               category: "Coding/Tech",   available: true,  rating: 4.9, sessions: 24, jnv: "JNV Lucknow", year: "2018" },
  { id: "2", name: "Dr. Meera Iyer",  role: "MBBS, AIIMS Delhi",           category: "NEET",          available: true,  rating: 4.8, sessions: 18, jnv: "JNV Kochi",   year: "2015" },
  { id: "3", name: "Kavita Singh",    role: "IAS Officer – AIR 47",        category: "UPSC",          available: false, rating: 5.0, sessions: 31, jnv: "JNV Patna",   year: "2012" },
  { id: "4", name: "Arjun Sharma",    role: "JEE AIR 204, IIT Bombay CSE", category: "JEE/IIT",       available: true,  rating: 4.7, sessions: 15, jnv: "JNV Jaipur",  year: "2020" },
  { id: "5", name: "Vivek Nair",      role: "Captain, Indian Army",        category: "Defence",       available: false, rating: 4.6, sessions: 9,  jnv: "JNV Thrissur", year: "2014" },
];

const REQUESTS = [
  { id: "r1", student: "Ananya S.", class: "Class 12 Sci A", goal: "JEE Preparation",   category: "JEE/IIT",     time: "2h ago",    status: "pending"  },
  { id: "r2", student: "Dev P.",    class: "Class 11 Sci B", goal: "Career in Tech",    category: "Coding/Tech", time: "5h ago",    status: "pending"  },
  { id: "r3", student: "Priya M.",  class: "Class 12 Sci A", goal: "NEET Preparation",  category: "NEET",        time: "Yesterday", status: "accepted" },
];

export default function AlumniMentorshipScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [activeTab,  setActiveTab]  = useState<"requests" | "mentors" | "my">("requests");
  const [catFilter,  setCatFilter]  = useState("All");
  const [requests,   setRequests]   = useState(REQUESTS);
  const [showAvail,  setShowAvail]  = useState(false);
  const [toast,      setToast]      = useState("");
  const [showBecome, setShowBecome] = useState(false);
  const [becomeNote, setBecomeNote] = useState("");
  const [becomeCat,  setBecomeCat]  = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const accept  = (id: string) => { setRequests((p) => p.map((r) => r.id === id ? { ...r, status: "accepted"  } : r)); showToast("Request accepted! Student notified."); };
  const decline = (id: string) => { setRequests((p) => p.map((r) => r.id === id ? { ...r, status: "declined"  } : r)); showToast("Request declined."); };

  const filteredMentors = catFilter === "All" ? MENTORS : MENTORS.filter((m) => m.category === catFilter);

  const statusCfg: Record<string, { color: string; bg: string }> = {
    pending:  { color: "#F59E0B", bg: "#FFFBEB" },
    accepted: { color: "#10B981", bg: "#ECFDF5" },
    declined: { color: "#EF4444", bg: "#FEF2F2" },
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Mentorship Program</Text>
        <TouchableOpacity style={styles.becomeBtn} onPress={() => setShowBecome(true)}>
          <Text style={styles.becomeBtnText}>Become Mentor</Text>
        </TouchableOpacity>
      </View>

      {/* Availability toggle */}
      <View style={styles.availRow}>
        <Ionicons name="radio-button-on" size={14} color={showAvail ? "#10B981" : "#9CA3AF"} />
        <Text style={styles.availLabel}>Available for mentorship</Text>
        <TouchableOpacity style={[styles.availToggle, showAvail && styles.availToggleOn]} onPress={() => { setShowAvail(!showAvail); showToast(showAvail ? "You're now unavailable." : "You're now available for mentorship!"); }}>
          <View style={[styles.availDot, showAvail && styles.availDotOn]} />
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {([["requests", "Requests"], ["mentors", "Find Mentors"], ["my", "My Mentees"]] as const).map(([key, label]) => (
          <TouchableOpacity key={key} style={[styles.tabBtn, activeTab === key && styles.tabBtnActive]} onPress={() => setActiveTab(key)}>
            <Text style={[styles.tabBtnText, activeTab === key && styles.tabBtnTextActive]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom, paddingTop: 16 }}>

        {activeTab === "requests" && (
          <>
            {requests.map((r) => {
              const cfg = statusCfg[r.status];
              const catColor = CAT_COLOR[r.category] || "#6B7280";
              return (
                <View key={r.id} style={styles.requestCard}>
                  <View style={styles.reqTop}>
                    <View style={styles.reqAvatar}><Text style={styles.reqAvatarText}>{r.student[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqStudent}>{r.student} · {r.class}</Text>
                      <Text style={styles.reqGoal}>{r.goal}</Text>
                      <View style={styles.reqMeta}>
                        <View style={[styles.catPill, { backgroundColor: catColor + "18" }]}>
                          <Text style={[styles.catPillText, { color: catColor }]}>{r.category}</Text>
                        </View>
                        <Text style={styles.reqTime}>{r.time}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.statusText, { color: cfg.color }]}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</Text>
                    </View>
                  </View>
                  {r.status === "pending" && (
                    <View style={styles.reqActions}>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => decline(r.id)}><Text style={styles.declineBtnText}>Decline</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => accept(r.id)}><Text style={styles.acceptBtnText}>Accept</Text></TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}

        {activeTab === "mentors" && (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 14 }}>
              {["All", ...CATEGORIES].map((c) => (
                <TouchableOpacity key={c} style={[styles.chip, catFilter === c && styles.chipActive]} onPress={() => setCatFilter(c)}>
                  <Text style={[styles.chipText, catFilter === c && styles.chipTextActive]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {filteredMentors.map((m) => {
              const catColor = CAT_COLOR[m.category] || "#6B7280";
              return (
                <View key={m.id} style={styles.mentorCard}>
                  <View style={styles.mentorTop}>
                    <View style={styles.mentorAvatar}><Text style={styles.mentorAvatarText}>{m.name[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.mentorNameRow}>
                        <Text style={styles.mentorName}>{m.name}</Text>
                        <Ionicons name="checkmark-circle" size={14} color="#3D5AF1" />
                      </View>
                      <Text style={styles.mentorRole}>{m.role}</Text>
                      <Text style={styles.mentorJnv}>{m.jnv} · {m.year} batch</Text>
                    </View>
                    <View style={[styles.availBadge, { backgroundColor: m.available ? "#ECFDF5" : "#F3F4F6" }]}>
                      <View style={[styles.availDotSmall, { backgroundColor: m.available ? "#10B981" : "#9CA3AF" }]} />
                      <Text style={[styles.availText, { color: m.available ? "#10B981" : "#9CA3AF" }]}>{m.available ? "Available" : "Busy"}</Text>
                    </View>
                  </View>
                  <View style={styles.mentorStats}>
                    <View style={[styles.catPill, { backgroundColor: catColor + "18" }]}>
                      <Text style={[styles.catPillText, { color: catColor }]}>{m.category}</Text>
                    </View>
                    <View style={styles.ratingRow}>
                      <Ionicons name="star" size={12} color="#F59E0B" />
                      <Text style={styles.ratingText}>{m.rating}</Text>
                    </View>
                    <Text style={styles.sessionsText}>{m.sessions} sessions</Text>
                    <TouchableOpacity style={[styles.requestBtn, !m.available && styles.requestBtnDisabled]} disabled={!m.available}>
                      <Text style={[styles.requestBtnText, !m.available && { color: "#9CA3AF" }]}>{m.available ? "Request" : "Unavailable"}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {activeTab === "my" && (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#D1D5DB" />
            <Text style={styles.emptyTitle}>No Active Mentees</Text>
            <Text style={styles.emptyText}>Accept mentorship requests to start guiding students.</Text>
          </View>
        )}
      </ScrollView>

      {/* Become Mentor Modal */}
      <Modal visible={showBecome} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Become a Mentor</Text>
              <TouchableOpacity onPress={() => setShowBecome(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Mentorship Category *</Text>
              <View style={styles.catGrid}>
                {CATEGORIES.map((c) => {
                  const cc = CAT_COLOR[c] || "#6B7280";
                  return (
                    <TouchableOpacity key={c} style={[styles.catCard, becomeCat === c && { borderColor: cc, backgroundColor: cc + "10" }]} onPress={() => setBecomeCat(c)}>
                      <Text style={[styles.catCardText, becomeCat === c && { color: cc }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Short Bio / Why Mentor?</Text>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Share your experience and how you can help JNV juniors…" placeholderTextColor="#9CA3AF" value={becomeNote} onChangeText={setBecomeNote} multiline textAlignVertical="top" />
              <TouchableOpacity style={styles.confirmBtn} onPress={() => { setShowBecome(false); showToast("Mentor request submitted! Admin will verify soon."); }}>
                <Ionicons name="school-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Submit Mentor Profile</Text>
              </TouchableOpacity>
            </ScrollView>
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
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  becomeBtn: { backgroundColor: "#ECFDF5", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: "#A7F3D0" },
  becomeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  availRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  availLabel: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  availToggle: { width: 44, height: 24, borderRadius: 12, backgroundColor: "#E5E7EB", justifyContent: "center", padding: 2 },
  availToggleOn: { backgroundColor: "#10B981" },
  availDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  availDotOn: { alignSelf: "flex-end" },
  tabBar: { flexDirection: "row", backgroundColor: "#F3F4F6", margin: 12, borderRadius: 12, padding: 3 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: "center" },
  tabBtnActive: { backgroundColor: "#fff" },
  tabBtnText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
  tabBtnTextActive: { color: "#111827", fontFamily: "Inter_600SemiBold" },
  requestCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  reqTop: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  reqAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  reqAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#10B981" },
  reqStudent: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  reqGoal: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 5 },
  reqMeta: { flexDirection: "row", alignItems: "center", gap: 8 },
  catPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reqTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  reqActions: { flexDirection: "row", gap: 10, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 10 },
  declineBtn: { flex: 1, borderRadius: 10, paddingVertical: 9, borderWidth: 1, borderColor: "#E5E7EB", alignItems: "center" },
  declineBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  acceptBtn: { flex: 2, borderRadius: 10, paddingVertical: 9, backgroundColor: "#10B981", alignItems: "center" },
  acceptBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  chip: { borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#10B981", borderColor: "#10B981" },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  mentorCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  mentorTop: { flexDirection: "row", gap: 12, marginBottom: 12 },
  mentorAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  mentorAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#10B981" },
  mentorNameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3 },
  mentorName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" },
  mentorRole: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 2 },
  mentorJnv: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  availBadge: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, height: 26 },
  availDotSmall: { width: 6, height: 6, borderRadius: 3 },
  availText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  mentorStats: { flexDirection: "row", alignItems: "center", gap: 8 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151" },
  sessionsText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  requestBtn: { marginLeft: "auto", backgroundColor: "#ECFDF5", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  requestBtnDisabled: { backgroundColor: "#F3F4F6" },
  requestBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  emptyState: { alignItems: "center", paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#374151" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", paddingHorizontal: 20 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 20 },
  catCard: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  catCardText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 20 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#10B981", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
