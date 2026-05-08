import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const INITIAL_CLUBS = [
  { id: "1", name: "Coding Club",    icon: "code-slash-outline"     as const, color: "#3D5AF1", bg: "#EEF2FF", members: 42, description: "Programming, hackathons, projects.",      managed: true,  nextEvent: "Hackathon Prep — 12 May"  },
  { id: "2", name: "Science Club",   icon: "flask-outline"          as const, color: "#0891B2", bg: "#E0F2FE", members: 35, description: "Experiments, Olympiad preparation.",       managed: true,  nextEvent: "Olympiad Mock — 11 May"   },
  { id: "3", name: "Debate Society", icon: "mic-outline"            as const, color: "#8B5CF6", bg: "#F5F3FF", members: 28, description: "Parliamentary debates, MUN, public speaking.",managed: false, nextEvent: "Debate on AI — 15 May"    },
  { id: "4", name: "Robotics Club",  icon: "hardware-chip-outline"  as const, color: "#F59E0B", bg: "#FFFBEB", members: 19, description: "Arduino, robotics competitions.",           managed: false, nextEvent: "Arduino Workshop — 18 May" },
];

const ANNOUNCEMENTS = [
  { clubId: "1", text: "Hackathon prep session this Saturday 10AM in Computer Lab.", time: "2h ago" },
  { clubId: "2", text: "Olympiad mock test materials uploaded. Check study notes.", time: "Yesterday" },
];

export default function TeacherClubsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [clubs,     setClubs]     = useState(INITIAL_CLUBS);
  const [expanded,  setExpanded]  = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast,     setToast]     = useState("");

  // Create form
  const [name,    setName]    = useState("");
  const [desc,    setDesc]    = useState("");
  const [formErr, setFormErr] = useState("");

  // Post announcement
  const [annTarget,  setAnnTarget]  = useState<string | null>(null);
  const [annText,    setAnnText]    = useState("");
  const [announcements, setAnnouncements] = useState(ANNOUNCEMENTS);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const createClub = () => {
    if (!name.trim() || !desc.trim()) { setFormErr("Name and description required."); return; }
    setClubs((p) => [...p, { id: Date.now().toString(), name, icon: "star-outline" as const, color: "#EC4899", bg: "#FDF2F8", members: 0, description: desc, managed: true, nextEvent: "No events yet" }]);
    setName(""); setDesc(""); setFormErr("");
    setShowCreate(false);
    showToast("Club created!");
  };

  const postAnnouncement = (clubId: string) => {
    if (!annText.trim()) return;
    setAnnouncements((p) => [{ clubId, text: annText, time: "Just now" }, ...p]);
    setAnnTarget(null); setAnnText("");
    showToast("Announcement posted to club!");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Clubs</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>

        {/* Managed clubs */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Clubs</Text>
          <View style={styles.managedBadge}><Text style={styles.managedBadgeText}>{clubs.filter((c) => c.managed).length} managed</Text></View>
        </View>

        {clubs.map((club) => {
          const isEx     = expanded === club.id;
          const clubAnns = announcements.filter((a) => a.clubId === club.id);
          return (
            <View key={club.id} style={[styles.clubCard, club.managed && styles.clubCardManaged]}>
              <TouchableOpacity onPress={() => setExpanded(isEx ? null : club.id)} activeOpacity={0.85}>
                <View style={styles.clubTop}>
                  <View style={[styles.clubIcon, { backgroundColor: club.bg }]}>
                    <Ionicons name={club.icon} size={24} color={club.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.clubNameRow}>
                      <Text style={styles.clubName}>{club.name}</Text>
                      {club.managed && <View style={styles.managedPill}><Text style={styles.managedPillText}>Managing</Text></View>}
                    </View>
                    <Text style={styles.clubDesc}>{club.description}</Text>
                    <View style={styles.clubMeta}>
                      <Ionicons name="people-outline" size={12} color="#9CA3AF" />
                      <Text style={styles.memberCount}>{club.members} members</Text>
                      <Text style={styles.divider}>·</Text>
                      <Ionicons name="calendar-outline" size={12} color="#3D5AF1" />
                      <Text style={styles.nextEvent}>{club.nextEvent}</Text>
                    </View>
                  </View>
                  <Ionicons name={isEx ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
                </View>
              </TouchableOpacity>

              {isEx && (
                <View style={styles.expandedBody}>
                  {/* Recent announcements */}
                  {clubAnns.length > 0 && (
                    <>
                      <Text style={styles.annHeader}>Recent Announcements</Text>
                      {clubAnns.map((a, i) => (
                        <View key={i} style={styles.annRow}>
                          <Ionicons name="megaphone-outline" size={14} color={club.color} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.annText}>{a.text}</Text>
                            <Text style={styles.annTime}>{a.time}</Text>
                          </View>
                        </View>
                      ))}
                    </>
                  )}

                  {club.managed && (
                    <TouchableOpacity style={[styles.postAnnBtn, { backgroundColor: club.color }]} onPress={() => { setAnnTarget(club.id); setAnnText(""); }}>
                      <Ionicons name="megaphone-outline" size={16} color="#fff" />
                      <Text style={styles.postAnnBtnText}>Post Announcement</Text>
                    </TouchableOpacity>
                  )}

                  {!club.managed && (
                    <TouchableOpacity style={styles.manageBtn} onPress={() => { setClubs((p) => p.map((c) => c.id === club.id ? { ...c, managed: true } : c)); showToast(`Now managing ${club.name}`); }}>
                      <Text style={styles.manageBtnText}>Take Over Management</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Create Club Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create New Club</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <Text style={styles.fieldLabel}>Club Name *</Text>
              <TextInput style={styles.input} placeholder="e.g. Photography Club" placeholderTextColor="#9CA3AF" value={name} onChangeText={setName} />
              <Text style={styles.fieldLabel}>Description *</Text>
              <TextInput style={[styles.input, { minHeight: 80 }]} placeholder="What is this club about?" placeholderTextColor="#9CA3AF" value={desc} onChangeText={setDesc} multiline textAlignVertical="top" />
              {formErr ? <Text style={styles.errText}>{formErr}</Text> : null}
              <TouchableOpacity style={styles.confirmBtn} onPress={createClub}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Create Club</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Post Announcement Modal */}
      <Modal visible={!!annTarget} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Club Announcement</Text>
              <TouchableOpacity onPress={() => setAnnTarget(null)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Announcement message for club members…" placeholderTextColor="#9CA3AF" value={annText} onChangeText={setAnnText} multiline textAlignVertical="top" />
              <TouchableOpacity style={styles.confirmBtn} onPress={() => annTarget && postAnnouncement(annTarget)}>
                <Ionicons name="megaphone-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Post to Club</Text>
              </TouchableOpacity>
            </View>
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
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EC4899", alignItems: "center", justifyContent: "center" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  managedBadge: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  managedBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  clubCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  clubCardManaged: { borderColor: "#C7D2FE", borderWidth: 1.5 },
  clubTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  clubIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  clubNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" },
  clubName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  managedPill: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  managedPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  clubDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 6 },
  clubMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  memberCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  divider: { color: "#D1D5DB" },
  nextEvent: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  expandedBody: { marginTop: 14, borderTopWidth: 1, borderTopColor: "#F0F0F0", paddingTop: 14, gap: 10 },
  annHeader: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#374151", marginBottom: 4 },
  annRow: { flexDirection: "row", gap: 8, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10 },
  annText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 18 },
  annTime: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 2 },
  postAnnBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 12, paddingVertical: 11 },
  postAnnBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  manageBtn: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingVertical: 10, alignItems: "center" },
  manageBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  errText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
