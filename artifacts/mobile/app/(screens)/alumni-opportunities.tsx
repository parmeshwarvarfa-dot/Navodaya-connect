import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const TYPES = ["All", "Internship", "Scholarship", "Referral", "Workshop", "Contest", "Webinar"];
const TYPE_COLOR: Record<string, string> = {
  Internship: "#10B981", Scholarship: "#3D5AF1", Referral: "#8B5CF6",
  Workshop: "#F59E0B", Contest: "#EF4444", Webinar: "#0891B2",
};
const TARGETS = ["All Students", "Class 12", "Class 11", "Class 10", "Class 9", "All Streams", "Science Stream", "Commerce Stream"];

const INITIAL_OPPS = [
  { id: "1", title: "Google STEP Internship 2026",            type: "Internship",  postedBy: "Rahul Verma",     target: "Class 12",      deadline: "25 May 2026", description: "Google's software engineering internship for final-year students pursuing CS. I can refer strong candidates directly.", saved: false, urgent: true,  verified: true,  applicants: 24 },
  { id: "2", title: "KVPY Scholarship – Science Students",    type: "Scholarship", postedBy: "Dr. Meera Iyer", target: "Class 11",      deadline: "30 May 2026", description: "KVPY fellowship for science students. Stipend of ₹5,000/month + mentorship. Application form available online.",      saved: true,  urgent: false, verified: true,  applicants: 67 },
  { id: "3", title: "NTSE Preparation Workshop – Free",       type: "Workshop",    postedBy: "Arjun Sharma",   target: "Class 10",      deadline: "20 May 2026", description: "Free NTSE prep workshop conducted online. Covers MAT + SAT sections with previous year questions.",                    saved: false, urgent: false, verified: true,  applicants: 41 },
  { id: "4", title: "Microsoft Explore Program Referral",     type: "Referral",    postedBy: "Manish Kumar",   target: "Science Stream", deadline: "15 Jun 2026", description: "Referring JNV students for Microsoft's Explore internship program. Must know basic programming.",                   saved: false, urgent: false, verified: true,  applicants: 12 },
  { id: "5", title: "Coding Contest – HackerEarth JNV Cup",  type: "Contest",     postedBy: "Vivek R.",       target: "All Students",  deadline: "18 May 2026", description: "Exclusive coding contest for all JNV students. Prizes worth ₹50,000. Beginner-friendly problems included.",          saved: false, urgent: true,  verified: false, applicants: 89 },
  { id: "6", title: "NEET Guidance Webinar",                  type: "Webinar",     postedBy: "Dr. Meera Iyer", target: "Class 12",      deadline: "14 May 2026", description: "Free NEET guidance webinar covering strategy, timetable, and Biology scoring tips.",                                   saved: false, urgent: true,  verified: true,  applicants: 103 },
];

export default function AlumniOpportunitiesScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [opps,      setOpps]      = useState(INITIAL_OPPS);
  const [typeFilter, setTypeFilter] = useState("All");
  const [search,    setSearch]    = useState("");
  const [showPost,  setShowPost]  = useState(false);
  const [toast,     setToast]     = useState("");

  // Post form
  const [pTitle,  setPTitle]  = useState("");
  const [pType,   setPType]   = useState("Internship");
  const [pTarget, setPTarget] = useState("All Students");
  const [pDesc,   setPDesc]   = useState("");
  const [pDeadline, setPDeadline] = useState("");
  const [formErr, setFormErr] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const toggleSave = (id: string) => setOpps((p) => p.map((o) => o.id === id ? { ...o, saved: !o.saved } : o));

  const handlePost = () => {
    if (!pTitle.trim() || !pDesc.trim() || !pDeadline.trim()) { setFormErr("Fill all required fields."); return; }
    setOpps((p) => [{ id: Date.now().toString(), title: pTitle, type: pType, postedBy: "You", target: pTarget, deadline: pDeadline, description: pDesc, saved: false, urgent: false, verified: false, applicants: 0 }, ...p]);
    setPTitle(""); setPDesc(""); setPDeadline(""); setFormErr("");
    setShowPost(false);
    showToast("Opportunity posted! Students will be notified.");
  };

  const filtered = opps.filter((o) => {
    const matchT = typeFilter === "All" || o.type === typeFilter;
    const matchS = !search || o.title.toLowerCase().includes(search.toLowerCase()) || o.postedBy.toLowerCase().includes(search.toLowerCase());
    return matchT && matchS;
  }).sort((a, b) => (b.urgent ? 1 : 0) - (a.urgent ? 1 : 0));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Opportunities</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowPost(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Trusted banner */}
      <View style={styles.trustBanner}>
        <Ionicons name="shield-checkmark-outline" size={14} color="#0891B2" />
        <Text style={styles.trustText}>Only verified alumni can post opportunities. All posts are moderated for student safety.</Text>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search opportunities…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {TYPES.map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, typeFilter === t && styles.chipActive, typeFilter === t && t !== "All" && { backgroundColor: TYPE_COLOR[t] + "E0", borderColor: TYPE_COLOR[t] }]} onPress={() => setTypeFilter(t)}>
            <Text style={[styles.chipText, typeFilter === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        <Text style={styles.resultCount}>{filtered.length} opportunities</Text>

        {filtered.map((o) => {
          const tc = TYPE_COLOR[o.type] || "#6B7280";
          return (
            <View key={o.id} style={[styles.oppCard, o.urgent && styles.oppCardUrgent]}>
              {o.urgent && <View style={styles.urgentBanner}><Ionicons name="flame" size={12} color="#fff" /><Text style={styles.urgentBannerText}>Deadline Soon</Text></View>}
              <View style={styles.oppTop}>
                <View style={[styles.oppTypeIcon, { backgroundColor: tc + "18" }]}>
                  <Ionicons name="briefcase-outline" size={22} color={tc} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.oppTitle}>{o.title}</Text>
                  <View style={styles.oppMetaRow}>
                    <View style={[styles.typePill, { backgroundColor: tc + "18" }]}>
                      <Text style={[styles.typePillText, { color: tc }]}>{o.type}</Text>
                    </View>
                    <Text style={styles.oppTarget}>→ {o.target}</Text>
                  </View>
                </View>
                <TouchableOpacity onPress={() => toggleSave(o.id)} style={styles.saveBtn}>
                  <Ionicons name={o.saved ? "bookmark" : "bookmark-outline"} size={20} color={o.saved ? "#3D5AF1" : "#9CA3AF"} />
                </TouchableOpacity>
              </View>

              <Text style={styles.oppDesc} numberOfLines={2}>{o.description}</Text>

              <View style={styles.oppFooter}>
                <View style={styles.postedByRow}>
                  {o.verified && <Ionicons name="checkmark-circle" size={12} color="#3D5AF1" />}
                  <Text style={styles.postedByText}>{o.postedBy}</Text>
                </View>
                <View style={styles.deadlineRow}>
                  <Ionicons name="calendar-outline" size={12} color={o.urgent ? "#EF4444" : "#9CA3AF"} />
                  <Text style={[styles.deadlineText, o.urgent && { color: "#EF4444" }]}>{o.deadline}</Text>
                </View>
                <View style={styles.appCountRow}>
                  <Ionicons name="people-outline" size={12} color="#9CA3AF" />
                  <Text style={styles.appCountText}>{o.applicants}</Text>
                </View>
              </View>

              <TouchableOpacity style={[styles.applyBtn, { backgroundColor: tc }]} onPress={() => { showToast("Interest registered! Alumni will reach out."); }}>
                <Text style={styles.applyBtnText}>I'm Interested</Text>
                <Ionicons name="arrow-forward" size={14} color="#fff" />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showPost} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Opportunity</Text>
              <TouchableOpacity onPress={() => setShowPost(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Opportunity Type *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {TYPES.filter((t) => t !== "All").map((t) => {
                  const tc = TYPE_COLOR[t] || "#6B7280";
                  return (
                    <TouchableOpacity key={t} style={[styles.pill, pType === t && { borderColor: tc, backgroundColor: tc + "10" }]} onPress={() => setPType(t)}>
                      <Text style={[styles.pillText, pType === t && { color: tc }]}>{t}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Google STEP Internship Referral" placeholderTextColor="#9CA3AF" value={pTitle} onChangeText={setPTitle} />

              <Text style={styles.fieldLabel}>Target Audience *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {TARGETS.map((t) => (
                  <TouchableOpacity key={t} style={[styles.pill, pTarget === t && styles.pillActive]} onPress={() => setPTarget(t)}>
                    <Text style={[styles.pillText, pTarget === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Describe the opportunity, eligibility, and how to apply…" placeholderTextColor="#9CA3AF" value={pDesc} onChangeText={setPDesc} multiline textAlignVertical="top" />

              <Text style={styles.fieldLabel}>Deadline *</Text>
              <TextInput style={styles.input} placeholder="e.g. 30 May 2026" placeholderTextColor="#9CA3AF" value={pDeadline} onChangeText={setPDeadline} />

              {formErr ? <Text style={styles.errText}>{formErr}</Text> : null}
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePost}>
                <Ionicons name="briefcase-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Post Opportunity</Text>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#0891B2", alignItems: "center", justifyContent: "center" },
  trustBanner: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#E0F2FE", paddingHorizontal: 16, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#BAE6FD" },
  trustText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#0369A1" },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 14, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 12 },
  chip: { borderRadius: 20, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 12 },
  oppCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0", overflow: "hidden" },
  oppCardUrgent: { borderColor: "#FCA5A5", borderWidth: 1.5 },
  urgentBanner: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#EF4444", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, alignSelf: "flex-start", marginBottom: 10 },
  urgentBannerText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#fff" },
  oppTop: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 10 },
  oppTypeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  oppTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 5 },
  oppMetaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  typePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  oppTarget: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
  saveBtn: { padding: 4 },
  oppDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 19, marginBottom: 12 },
  oppFooter: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 12 },
  postedByRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  postedByText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6B7280" },
  deadlineRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  deadlineText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  appCountRow: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  appCountText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  applyBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 11 },
  applyBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  pillActive: { backgroundColor: "#0891B2", borderColor: "#0891B2" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  pillTextActive: { color: "#fff" },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  errText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#0891B2", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
