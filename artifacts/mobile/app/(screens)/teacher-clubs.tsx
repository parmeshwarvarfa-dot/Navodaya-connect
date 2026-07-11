import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { ClubWithMeta } from "@/lib/api";

export default function TeacherClubsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [clubs,      setClubs]      = useState<ClubWithMeta[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [toast,      setToast]      = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [name,    setName]    = useState("");
  const [desc,    setDesc]    = useState("");
  const [formErr, setFormErr] = useState("");

  const [annTarget, setAnnTarget] = useState<string | null>(null);
  const [annText,   setAnnText]   = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const fetchClubs = async () => {
    try { setClubs(await api.clubs.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchClubs(); }, []);

  const createClub = async () => {
    if (!name.trim() || !desc.trim()) { setFormErr("Name and description required."); return; }
    setSubmitting(true);
    try {
      const row = await api.clubs.create({ name: name.trim(), description: desc.trim() });
      setClubs((p) => [row, ...p]);
      setName(""); setDesc(""); setFormErr("");
      setShowCreate(false);
      showToast("Club created!");
    } catch (e: any) { setFormErr(e?.message || "Failed."); }
    setSubmitting(false);
  };

  const postAnnouncement = async (clubId: string) => {
    if (!annText.trim()) return;
    try {
      const row = await api.clubs.postAnnouncement(clubId, annText.trim());
      setClubs((p) => p.map((c) => c.id === clubId ? { ...c, announcements: [row, ...c.announcements] } : c));
      setAnnTarget(null); setAnnText("");
      showToast("Announcement posted to club!");
    } catch { showToast("Failed to post."); }
  };

  const takeOver = async (club: ClubWithMeta) => {
    try {
      await api.clubs.takeOver(club.id);
      setClubs((p) => p.map((c) => c.id === club.id ? { ...c, managed: true } : c));
      showToast(`Now managing ${club.name}`);
    } catch { showToast("Failed."); }
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
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Clubs</Text>
          <View style={styles.managedBadge}><Text style={styles.managedBadgeText}>{clubs.filter((c) => c.managed).length} managed</Text></View>
        </View>

        {loading ? <Text style={styles.loadingText}>Loading…</Text> : clubs.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>🏫</Text><Text style={styles.emptyText}>No clubs yet.</Text></View>
        ) : clubs.map((club) => {
          const isEx = expanded === club.id;
          return (
            <View key={club.id} style={[styles.clubCard, club.managed && styles.clubCardManaged]}>
              <TouchableOpacity onPress={() => setExpanded(isEx ? null : club.id)} activeOpacity={0.85}>
                <View style={styles.clubTop}>
                  <View style={[styles.clubIcon, { backgroundColor: club.bg }]}>
                    <Ionicons name={club.icon as any} size={24} color={club.color} />
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
                  {club.announcements.length > 0 && (
                    <>
                      <Text style={styles.annHeader}>Recent Announcements</Text>
                      {club.announcements.map((a) => (
                        <View key={a.id} style={styles.annRow}>
                          <Ionicons name="megaphone-outline" size={14} color={club.color} />
                          <View style={{ flex: 1 }}>
                            <Text style={styles.annText}>{a.text}</Text>
                            <Text style={styles.annTime}>{new Date(a.createdAt).toLocaleDateString()}</Text>
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
                    <TouchableOpacity style={styles.manageBtn} onPress={() => takeOver(club)}>
                      <Text style={styles.manageBtnText}>Take Over Management</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

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
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={createClub} disabled={submitting}>
                <Ionicons name="add-circle-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>{submitting ? "Creating…" : "Create Club"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

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
  loadingText: { textAlign: "center", color: "#9CA3AF", marginTop: 40 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
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
