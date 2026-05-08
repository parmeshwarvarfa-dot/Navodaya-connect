import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const SUBJECTS = ["Physics", "Chemistry", "Maths", "English", "Biology", "History", "Geography", "Computer Science"];
const CLASSES  = ["Class 6 A", "Class 6 B", "Class 7 A", "Class 7 B", "Class 8 A", "Class 8 B", "Class 9 A", "Class 9 B", "Class 10 A", "Class 10 B", "Class 11 Sci A", "Class 11 Sci B", "Class 11 Com A", "Class 12 Sci A", "Class 12 Sci B", "Class 12 Com A"];
const TYPES    = ["PDF", "Notes", "PYQ", "Slides", "Link", "Assignment"];

const TYPE_COLOR: Record<string, string> = {
  PDF: "#EF4444", Notes: "#3D5AF1", PYQ: "#8B5CF6",
  Slides: "#F59E0B", Link: "#10B981", Assignment: "#EC4899",
};

const INITIAL_UPLOADS = [
  { id: "1", title: "Electromagnetic Waves — Chapter Notes", subject: "Physics",   class: "Class 11 Sci A", type: "PDF",   date: "Today",     pinned: true  },
  { id: "2", title: "Organic Chemistry — Hydrocarbons",      subject: "Chemistry", class: "Class 12 Sci B", type: "PDF",   date: "Yesterday", pinned: false },
  { id: "3", title: "JEE PYQs — Physics 2020–2024",         subject: "Physics",   class: "Class 12 Sci A", type: "PYQ",   date: "3 days ago",pinned: true  },
  { id: "4", title: "Trigonometry Identities Slides",         subject: "Maths",    class: "Class 10 A",     type: "Slides",date: "1 week ago", pinned: false },
  { id: "5", title: "Essay Writing Guide",                   subject: "English",   class: "Class 9 A",      type: "Notes", date: "2 weeks ago",pinned: false },
];

export default function TeacherUploadScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [uploads,    setUploads]    = useState(INITIAL_UPLOADS);
  const [showModal,  setShowModal]  = useState(false);
  const [search,     setSearch]     = useState("");
  const [filterSubj, setFilterSubj] = useState("All");
  const [toast,      setToast]      = useState("");

  // New upload form state
  const [title,    setTitle]    = useState("");
  const [subject,  setSubject]  = useState("");
  const [cls,      setCls]      = useState("");
  const [type,     setType]     = useState("");
  const [formErr,  setFormErr]  = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const handleUpload = () => {
    if (!title.trim() || !subject || !cls || !type) { setFormErr("Please fill all fields."); return; }
    setUploads((p) => [{ id: Date.now().toString(), title, subject, class: cls, type, date: "Just now", pinned: false }, ...p]);
    setTitle(""); setSubject(""); setCls(""); setType(""); setFormErr("");
    setShowModal(false);
    showToast("Material uploaded successfully!");
  };

  const togglePin = (id: string) => {
    setUploads((p) => p.map((u) => u.id === id ? { ...u, pinned: !u.pinned } : u));
  };

  const deleteUpload = (id: string) => {
    setUploads((p) => p.filter((u) => u.id !== id));
    showToast("Material deleted.");
  };

  const filtered = uploads
    .filter((u) => (filterSubj === "All" || u.subject === filterSubj) && (!search || u.title.toLowerCase().includes(search.toLowerCase())))
    .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

  const allSubjects = ["All", ...SUBJECTS];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Upload Notes / Materials</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search materials…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {allSubjects.map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, filterSubj === s && styles.chipActive]} onPress={() => setFilterSubj(s)}>
            <Text style={[styles.chipText, filterSubj === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        <Text style={styles.resultCount}>{filtered.length} materials · {uploads.filter((u) => u.pinned).length} pinned</Text>

        {filtered.map((u) => (
          <View key={u.id} style={[styles.card, u.pinned && styles.cardPinned]}>
            <View style={styles.cardLeft}>
              <View style={[styles.typeIcon, { backgroundColor: (TYPE_COLOR[u.type] || "#3D5AF1") + "18" }]}>
                <Ionicons name="document-text-outline" size={20} color={TYPE_COLOR[u.type] || "#3D5AF1"} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              {u.pinned && <View style={styles.pinnedBadge}><Ionicons name="pin" size={10} color="#3D5AF1" /><Text style={styles.pinnedText}>Pinned</Text></View>}
              <Text style={styles.cardTitle} numberOfLines={2}>{u.title}</Text>
              <Text style={styles.cardMeta}>{u.subject} · {u.class}</Text>
              <View style={styles.cardFooter}>
                <View style={[styles.typePill, { backgroundColor: (TYPE_COLOR[u.type] || "#3D5AF1") + "18" }]}>
                  <Text style={[styles.typePillText, { color: TYPE_COLOR[u.type] || "#3D5AF1" }]}>{u.type}</Text>
                </View>
                <Text style={styles.cardDate}>{u.date}</Text>
              </View>
            </View>
            <View style={styles.cardActions}>
              <TouchableOpacity onPress={() => togglePin(u.id)} style={styles.actionBtn}>
                <Ionicons name={u.pinned ? "pin" : "pin-outline"} size={18} color={u.pinned ? "#3D5AF1" : "#9CA3AF"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteUpload(u.id)} style={styles.actionBtn}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Upload Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Upload New Material</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Chapter 5 – Electromagnetic Waves" placeholderTextColor="#9CA3AF" value={title} onChangeText={setTitle} />

              <Text style={styles.fieldLabel}>Subject *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {SUBJECTS.map((s) => (
                  <TouchableOpacity key={s} style={[styles.pill, subject === s && styles.pillActive]} onPress={() => setSubject(s)}>
                    <Text style={[styles.pillText, subject === s && styles.pillTextActive]}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Target Class *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {CLASSES.slice(0, 8).map((c) => (
                  <TouchableOpacity key={c} style={[styles.pill, cls === c && styles.pillActive]} onPress={() => setCls(c)}>
                    <Text style={[styles.pillText, cls === c && styles.pillTextActive]}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Material Type *</Text>
              <View style={styles.typeGrid}>
                {TYPES.map((t) => (
                  <TouchableOpacity key={t} style={[styles.typeCard, type === t && { borderColor: TYPE_COLOR[t], backgroundColor: TYPE_COLOR[t] + "10" }]} onPress={() => setType(t)}>
                    <Text style={[styles.typeCardText, type === t && { color: TYPE_COLOR[t] }]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity style={styles.uploadBox}>
                <Ionicons name="cloud-upload-outline" size={28} color="#3D5AF1" />
                <Text style={styles.uploadBoxText}>Tap to attach file</Text>
                <Text style={styles.uploadBoxHint}>PDF, PPT, DOC, Image</Text>
              </TouchableOpacity>

              {formErr ? <Text style={styles.errText}>{formErr}</Text> : null}

              <TouchableOpacity style={styles.confirmBtn} onPress={handleUpload}>
                <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Upload Material</Text>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 14, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 12 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 12, marginTop: 4 },
  card: { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  cardPinned: { borderColor: "#C7D2FE", borderWidth: 1.5 },
  cardLeft: {},
  typeIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  pinnedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  pinnedText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  cardTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3, lineHeight: 20 },
  cardMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 6 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  typePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  cardDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginLeft: "auto" },
  cardActions: { justifyContent: "space-between" },
  actionBtn: { padding: 4 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 8 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  pillActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  pillTextActive: { color: "#fff" },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  typeCard: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  typeCardText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  uploadBox: { borderWidth: 2, borderColor: "#C7D2FE", borderStyle: "dashed", borderRadius: 14, padding: 20, alignItems: "center", gap: 6, marginBottom: 20, backgroundColor: "#FAFBFF" },
  uploadBoxText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  uploadBoxHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  errText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
