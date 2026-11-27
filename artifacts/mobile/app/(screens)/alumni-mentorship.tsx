import React, { useEffect, useState } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, type MentorRequest, type MentorDirectoryEntry } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDateTimeInput, parseDateTimeInput } from "@/lib/date-formatting";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const CATEGORIES = ["JEE/IIT", "NEET", "UPSC", "Coding/Tech", "Startup", "Defence", "Law", "Research", "General Career"];
const CAT_COLOR: Record<string, string> = {
  "JEE/IIT": "#7C3AED", "NEET": "#10B981", "UPSC": "#8B5CF6", "Coding/Tech": "#0891B2",
  "Startup": "#F59E0B", "Defence": "#6366F1", "Law": "#EC4899", "Research": "#D97706", "General Career": "#6B7280",
};



export default function AlumniMentorshipScreen() {
  const insets   = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad   = Platform.OS === "web" ? 0 : insets.top;
  const [activeTab,  setActiveTab]  = useState<"requests" | "mentors" | "my">("requests");
  const [catFilter,  setCatFilter]  = useState("All");
  const [requests, setRequests] = useState<MentorRequest[]>([]);
  const [mentors, setMentors] = useState<MentorDirectoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAvail,  setShowAvail]  = useState(false);
  const [toast,      setToast]      = useState("");
  const [showBecome, setShowBecome] = useState(false);
  const [becomeNote, setBecomeNote] = useState("");
  const [becomeCat,  setBecomeCat]  = useState("");
  const [selectedMentor, setSelectedMentor] = useState<MentorDirectoryEntry | null>(null);
  const [mentorCategories, setMentorCategories] = useState<string[]>([]);
  const [mentorBio, setMentorBio] = useState("");
  const [mentorProfileLoaded, setMentorProfileLoaded] = useState(false);
  const [availabilityBusy, setAvailabilityBusy] = useState(false);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, string>>({});
  const [feedbackDrafts, setFeedbackDrafts] = useState<Record<string, string>>({});
  const [feedbackRatings, setFeedbackRatings] = useState<Record<string, number>>({});

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2600); };

  useEffect(() => {
    let active = true;
    Promise.all([api.mentorRequests.list(), profile?.role === "student" ? api.mentorRequests.mentors() : Promise.resolve([] as MentorDirectoryEntry[])])
      .then(([items, directory]) => { if (active) { setRequests(items); setMentors(directory); } })
      .catch((error) => showToast(error instanceof Error ? error.message : "Could not load mentorship data."))
      .finally(() => { if (active) setLoading(false); });
    if (profile?.role === "alumni") api.mentorRequests.availability().then((settings) => { if (active) { setShowAvail(settings.available); setMentorCategories(settings.categories); setMentorBio(settings.bio); setMentorProfileLoaded(true); } }).catch((error) => { if (active) showToast(error instanceof Error ? error.message : "Could not load mentor settings."); });
    return () => { active = false; };
  }, [profile?.uid, profile?.role]);

  const saveAvailability = async (available: boolean) => {
    if (available && !mentorCategories.length) { showToast("Choose at least one mentorship topic first."); return; }
    const categories = mentorCategories;
    setAvailabilityBusy(true);
    try {
      const saved = await api.mentorRequests.updateAvailability({ available, categories, bio: mentorBio });
      setShowAvail(saved.available); setMentorCategories(saved.categories); showToast(saved.available ? "Students can now find your mentor profile." : "You are hidden from mentor discovery.");
    } catch (error) { showToast(error instanceof Error ? error.message : "Could not save availability."); }
    finally { setAvailabilityBusy(false); }
  };
  const toggleMentorCategory = (category: string) => setMentorCategories((current) => current.includes(category) ? current.filter((item) => item !== category) : [...current, category]);
  const respond = async (id: string, status: "accepted" | "declined") => {
    try { const updated = await api.mentorRequests.respond(id, status); setRequests((rows) => rows.map((row) => row.id === id ? updated : row)); showToast(`Request ${status}.`); }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not update request."); }
  };
  const scheduleSession = async (request: MentorRequest) => {
    const raw = (scheduleDrafts[request.id] ?? "").trim();
    const when = parseDateTimeInput(raw);
    if (!when) { showToast("Enter a date and time as DD-MM-YYYY HH:mm, for example 05-11-2026 17:30."); return; }
    try { const saved = await api.mentorRequests.schedule(request.id, when.toISOString()); setRequests((rows) => rows.map((row) => row.id === saved.id ? saved : row)); showToast("Session time saved."); }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not schedule this session."); }
  };
  const completeSession = async (request: MentorRequest) => {
    try { const saved = await api.mentorRequests.complete(request.id); setRequests((rows) => rows.map((row) => row.id === saved.id ? saved : row)); showToast("Session marked complete."); }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not complete this session."); }
  };
  const submitFeedback = async (request: MentorRequest) => {
    try { const saved = await api.mentorRequests.feedback(request.id, feedbackRatings[request.id] ?? 5, feedbackDrafts[request.id] ?? ""); setRequests((rows) => rows.map((row) => row.id === saved.id ? saved : row)); showToast("Thank you for reviewing the session."); }
    catch (error) { showToast(error instanceof Error ? error.message : "Could not save feedback."); }
  };
  const filteredMentors = mentors.filter((person) => catFilter === "All" || person.categories.includes(catFilter));
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

      </View>

      {/* Availability toggle */}
      {profile?.role === "alumni" && <>
        <View style={styles.availRow}>
          <Ionicons name="radio-button-on" size={14} color={showAvail ? "#10B981" : "#9CA3AF"} />
          <Text style={styles.availLabel}>Available for mentorship</Text>
          <TouchableOpacity style={[styles.availToggle, showAvail && styles.availToggleOn]} onPress={() => void saveAvailability(!showAvail)} disabled={availabilityBusy || !mentorProfileLoaded}>
            <View style={[styles.availDot, showAvail && styles.availDotOn]} />
          </TouchableOpacity>
        </View>
        <View style={styles.mentorSettings}>
          <Text style={styles.fieldLabel}>Topics you can mentor</Text>
          <View style={styles.catGrid}>{CATEGORIES.map((category) => <TouchableOpacity key={category} style={[styles.catCard, mentorCategories.includes(category) && styles.mentorCategorySelected]} onPress={() => toggleMentorCategory(category)}><Text style={styles.catCardText}>{category}</Text></TouchableOpacity>)}</View>
          <TextInput style={styles.input} placeholder="Short bio about your experience and availability" value={mentorBio} onChangeText={setMentorBio} multiline />
          <TouchableOpacity style={styles.confirmBtn} onPress={() => void saveAvailability(showAvail)} disabled={availabilityBusy || !mentorProfileLoaded}><Text style={styles.confirmBtnText}>{availabilityBusy ? "Saving..." : "Save mentor profile"}</Text></TouchableOpacity>
        </View>
      </>}

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
            {loading && <Text style={styles.emptyText}>Loading mentorship requests�</Text>}
            {requests.map((r) => {
              const cfg = statusCfg[r.status] || statusCfg.pending;
              const catColor = CAT_COLOR[r.category || ""] || "#6B7280";
              return (
                <View key={r.id} style={styles.requestCard}>
                  <View style={styles.reqTop}>
                    <View style={styles.reqAvatar}><Text style={styles.reqAvatarText}>{(r.studentName || "?")[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reqStudent}>{r.studentName || "Student"}</Text>
                      <Text style={styles.reqGoal}>{r.message || "Mentorship request"}</Text>
                      <View style={styles.reqMeta}>
                        <View style={[styles.catPill, { backgroundColor: catColor + "18" }]}>
                          <Text style={[styles.catPillText, { color: catColor }]}>{r.category || "Mentorship"}</Text>
                        </View>
                        <Text style={styles.reqTime}>{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</Text>
                      </View>
                    </View>
                    <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.statusText, { color: cfg.color }]}>{r.status.charAt(0).toUpperCase() + r.status.slice(1)}</Text>
                    </View>
                  </View>
                  {r.status === "pending" && r.mentorId === profile?.uid && (
                    <View style={styles.reqActions}>
                      <TouchableOpacity style={styles.declineBtn} onPress={() => void respond(r.id, "declined")}><Text style={styles.declineBtnText}>Decline</Text></TouchableOpacity>
                      <TouchableOpacity style={styles.acceptBtn} onPress={() => void respond(r.id, "accepted")}><Text style={styles.acceptBtnText}>Accept</Text></TouchableOpacity>
                    </View>
                  )}
                  {r.status === "accepted" && <View style={styles.sessionBox}>
                    <Text style={styles.fieldLabel}>Schedule this mentoring session</Text>
                    <Text style={styles.sessionHint}>{r.scheduledAt ? `Current time: ${formatDateTimeInput(r.scheduledAt)}` : "Enter local date and time as DD-MM-YYYY HH:mm (24-hour). Agree on a call method in your chat."}</Text>
                    <TextInput style={styles.input} placeholder="DD-MM-YYYY HH:mm" value={scheduleDrafts[r.id] ?? (r.scheduledAt ? formatDateTimeInput(r.scheduledAt) : "")} onChangeText={(value) => setScheduleDrafts((items) => ({ ...items, [r.id]: value }))} />
                    <TouchableOpacity style={styles.sessionButton} onPress={() => void scheduleSession(r)}><Text style={styles.sessionButtonText}>{r.scheduledAt ? "Update session time" : "Save session time"}</Text></TouchableOpacity>
                    {profile?.role === "alumni" && r.mentorId === profile.uid && r.scheduledAt && <TouchableOpacity style={styles.completeButton} onPress={() => void completeSession(r)}><Text style={styles.completeButtonText}>Mark session complete</Text></TouchableOpacity>}
                  </View>}
                  {r.status === "completed" && r.studentId === profile?.uid && <View style={styles.sessionBox}>
                    {r.feedbackRating ? <Text style={styles.sessionHint}>Your feedback: {r.feedbackRating}/5{r.feedback ? ` � ${r.feedback}` : ""}</Text> : <>
                      <Text style={styles.fieldLabel}>How was this session?</Text>
                      <View style={styles.reqActions}>{[1, 2, 3, 4, 5].map((rating) => <TouchableOpacity key={rating} style={[styles.ratingButton, (feedbackRatings[r.id] ?? 5) === rating && styles.ratingButtonSelected]} onPress={() => setFeedbackRatings((items) => ({ ...items, [r.id]: rating }))}><Text style={styles.ratingText}>{rating}</Text></TouchableOpacity>)}</View>
                      <TextInput style={styles.input} placeholder="Optional feedback for your mentor" value={feedbackDrafts[r.id] ?? ""} onChangeText={(value) => setFeedbackDrafts((items) => ({ ...items, [r.id]: value }))} />
                      <TouchableOpacity style={styles.sessionButton} onPress={() => void submitFeedback(r)}><Text style={styles.sessionButtonText}>Send feedback</Text></TouchableOpacity>
                    </>}
                  </View>}
                </View>
              );
            })}
            {!loading && requests.length === 0 && <View style={styles.emptyState}><Text style={styles.emptyTitle}>No mentorship requests</Text><Text style={styles.emptyText}>Requests from your school will appear here.</Text></View>}
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

            {loading ? <View style={styles.emptyState}><Text style={styles.emptyText}>Loading verified alumni�</Text></View> : filteredMentors.length === 0 ? <View style={styles.emptyState}><Ionicons name="people-outline" size={42} color="#9BA6B8" /><Text style={styles.emptyTitle}>No verified alumni mentors listed</Text><Text style={styles.emptyText}>This school has no verified alumni profiles available for mentor discovery yet.</Text></View> : filteredMentors.map((m) => {
              return (
                <View key={m.id} style={styles.mentorCard}>
                  <View style={styles.mentorTop}>
                    <View style={styles.mentorAvatar}><Text style={styles.mentorAvatarText}>{m.fullName[0]}</Text></View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.mentorNameRow}>
                        <Text style={styles.mentorName}>{m.fullName}</Text>
                        <Ionicons name="checkmark-circle" size={14} color="#7C3AED" />
                      </View>
                      <Text style={styles.mentorRole}>{m.profession || "Verified alumni"}</Text>
                      <Text style={styles.mentorJnv}>{m.jnvName || profile?.jnvName}</Text>
                      {!!m.bio && <Text style={styles.mentorBio}>{m.bio}</Text>}
                      <Text style={styles.mentorCategories}>{m.categories.join(", ")}</Text>
                    </View>
                    <View style={[styles.availBadge, { backgroundColor: "#F5F3FF" }]}>
                      <Text style={[styles.availText, { color: "#7C3AED" }]}>Verified</Text>
                    </View>
                  </View>
                  <View style={styles.mentorStats}>
                    <TouchableOpacity style={styles.requestBtn} onPress={() => { setSelectedMentor(m); setShowBecome(true); }}>
                      <Text style={styles.requestBtnText}>Request</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </>
        )}

        {activeTab === "my" && (profile?.role === "alumni" ? requests.filter((request) => request.mentorId === profile.uid && ["accepted", "completed"].includes(request.status)).length ? requests.filter((request) => request.mentorId === profile.uid && ["accepted", "completed"].includes(request.status)).map((request) => <View key={request.id} style={styles.requestCard}><Text style={styles.reqStudent}>{request.studentName || "Student"}</Text><Text style={styles.reqGoal}>{request.category || "Mentorship"} - {request.status}</Text><Text style={styles.sessionHint}>{request.scheduledAt ? `Session: ${new Date(request.scheduledAt).toLocaleString()}` : "No session time set yet."}</Text>{request.status === "accepted" && request.scheduledAt && <TouchableOpacity style={styles.completeButton} onPress={() => void completeSession(request)}><Text style={styles.completeButtonText}>Mark session complete</Text></TouchableOpacity>}</View>) : <View style={styles.emptyState}><Ionicons name="people-outline" size={48} color="#D1D5DB" /><Text style={styles.emptyTitle}>No Active Mentees</Text><Text style={styles.emptyText}>Accepted mentorship requests will appear here.</Text></View> : <View style={styles.emptyState}><Ionicons name="people-outline" size={48} color="#D1D5DB" /><Text style={styles.emptyTitle}>Alumni mentees</Text><Text style={styles.emptyText}>This view is for alumni who mentor students.</Text></View>)}
      </ScrollView>

      {/* Become Mentor Modal */}
      <Modal visible={showBecome} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selectedMentor ? `Request ${selectedMentor.fullName}` : "Become a Mentor"}</Text>
              <TouchableOpacity onPress={() => setShowBecome(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              {selectedMentor ? <Text style={styles.fieldLabel}>Mentorship Category *</Text> : <Text style={styles.emptyText}>A public mentor registration workflow is not available yet. No profile has been submitted.</Text>}
              {selectedMentor && <>
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
              <TouchableOpacity style={styles.confirmBtn} onPress={async () => {
                if (selectedMentor && profile?.role === "student") {
                  try {
                    await api.mentorRequests.create({ mentorId: selectedMentor.id, mentorName: selectedMentor.fullName, category: becomeCat || "General Career", message: becomeNote.trim() });
                    setShowBecome(false); setSelectedMentor(null); showToast("Mentorship request sent.");
                  } catch (error) { showToast(error instanceof Error ? error.message : "Could not send request."); }
                } else {
                  showToast("Mentor profile registration is not available yet.");
                }
              }} disabled={!selectedMentor}>
                <Ionicons name="school-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>{selectedMentor ? "Send Request" : "Save Mentor Profile"}</Text>
              </TouchableOpacity></>}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
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
  mentorBio: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#475569", marginTop: 5 },
  mentorCategories: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#5261B8", marginTop: 5 },
  mentorSettings: { backgroundColor: "#fff", margin: 12, padding: 14, borderRadius: 14 },
  mentorCategorySelected: { borderColor: "#10B981", backgroundColor: "#ECFDF5" },
  sessionBox: { marginTop: 12, padding: 12, backgroundColor: "#F8FAFC", borderRadius: 12, gap: 8 },
  sessionHint: { fontSize: 12, color: "#667085", lineHeight: 18 },
  sessionButton: { padding: 11, backgroundColor: "#F5F3FF", borderRadius: 10, alignItems: "center" },
  sessionButtonText: { color: "#7C3AED", fontFamily: "Inter_600SemiBold" },
  completeButton: { padding: 10, marginTop: 8, backgroundColor: "#ECFDF5", borderRadius: 10, alignItems: "center" },
  completeButtonText: { color: "#059669", fontFamily: "Inter_600SemiBold" },
  ratingButton: { width: 38, height: 36, borderRadius: 10, borderWidth: 1, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  ratingButtonSelected: { borderColor: "#7C3AED", backgroundColor: "#F5F3FF" },
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
