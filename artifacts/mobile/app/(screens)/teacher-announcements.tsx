import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const TARGETS = ["Whole School", "Class 11 Sci A", "Class 12 Sci B", "Class 10 A", "Class 9 A", "Class 8 B"];
const PRIORITIES = ["normal", "important", "urgent"] as const;
const PRIORITY_CFG: Record<string, { color: string; bg: string; label: string }> = {
  normal:    { color: "#6B7280", bg: "#F3F4F6", label: "Normal"    },
  important: { color: "#F59E0B", bg: "#FFFBEB", label: "Important" },
  urgent:    { color: "#EF4444", bg: "#FEF2F2", label: "Urgent"    },
};

const INITIAL = [
  { id: "1", title: "Unit Test – Physics", body: "Unit test for Class 11 Sci A will be held on 10 May. Syllabus: Chapters 1–4.", target: "Class 11 Sci A", priority: "important", date: "Today",     pinned: true  },
  { id: "2", title: "Holiday Notice",      body: "School will remain closed on 15 May for regional festival. Resume 16 May.", target: "Whole School",  priority: "normal",    date: "Yesterday", pinned: false },
  { id: "3", title: "Practical Schedule",  body: "Chemistry practicals for Class 12 Sci B scheduled for 14 May. Report by 8 AM.", target: "Class 12 Sci B", priority: "urgent",    date: "2 days ago", pinned: false },
  { id: "4", title: "Parent Meeting",      body: "Parent-Teacher meeting on 17 May at 10 AM in the school auditorium.", target: "Whole School",  priority: "important", date: "3 days ago", pinned: false },
];

export default function TeacherAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const [items,     setItems]     = useState(INITIAL);
  const [showModal, setShowModal] = useState(false);
  const [toast,     setToast]     = useState("");
  const [title,     setTitle]     = useState("");
  const [body,      setBody]      = useState("");
  const [target,    setTarget]    = useState("Whole School");
  const [priority,  setPriority]  = useState<typeof PRIORITIES[number]>("normal");
  const [pinned,    setPinned]    = useState(false);
  const [formErr,   setFormErr]   = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const handlePost = () => {
    if (!title.trim() || !body.trim()) { setFormErr("Title and body are required."); return; }
    setItems((p) => [{ id: Date.now().toString(), title, body, target, priority, date: "Just now", pinned }, ...p]
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
    setTitle(""); setBody(""); setTarget("Whole School"); setPriority("normal"); setPinned(false); setFormErr("");
    setShowModal(false);
    showToast("Announcement posted!");
  };

  const deleteItem = (id: string) => { setItems((p) => p.filter((i) => i.id !== id)); showToast("Deleted."); };
  const togglePin  = (id: string) => {
    setItems((p) => p.map((i) => i.id === id ? { ...i, pinned: !i.pinned } : i).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)));
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Announcements</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
        {items.map((item) => {
          const cfg = PRIORITY_CFG[item.priority];
          return (
            <View key={item.id} style={[styles.card, item.pinned && styles.cardPinned]}>
              <View style={styles.cardTop}>
                <View style={[styles.priorityDot, { backgroundColor: cfg.color }]} />
                <View style={{ flex: 1 }}>
                  {item.pinned && (
                    <View style={styles.pinnedRow}><Ionicons name="pin" size={10} color="#3D5AF1" /><Text style={styles.pinnedText}>Pinned</Text></View>
                  )}
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <Text style={styles.cardBody}>{item.body}</Text>
                  <View style={styles.cardMeta}>
                    <View style={[styles.targetPill, { backgroundColor: "#F3F4F6" }]}>
                      <Ionicons name="people-outline" size={10} color="#6B7280" />
                      <Text style={styles.targetText}>{item.target}</Text>
                    </View>
                    <View style={[styles.priorityPill, { backgroundColor: cfg.bg }]}>
                      <Text style={[styles.priorityText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                    <Text style={styles.dateText}>{item.date}</Text>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => togglePin(item.id)} style={styles.actionBtn}>
                    <Ionicons name={item.pinned ? "pin" : "pin-outline"} size={16} color={item.pinned ? "#3D5AF1" : "#9CA3AF"} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteItem(item.id)} style={styles.actionBtn}>
                    <Ionicons name="trash-outline" size={16} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Post Announcement</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Title *</Text>
              <TextInput style={styles.input} placeholder="Announcement title…" placeholderTextColor="#9CA3AF" value={title} onChangeText={setTitle} />

              <Text style={styles.fieldLabel}>Body *</Text>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Announcement details…" placeholderTextColor="#9CA3AF" value={body} onChangeText={setBody} multiline textAlignVertical="top" />

              <Text style={styles.fieldLabel}>Target Audience</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {TARGETS.map((t) => (
                  <TouchableOpacity key={t} style={[styles.pill, target === t && styles.pillActive]} onPress={() => setTarget(t)}>
                    <Text style={[styles.pillText, target === t && styles.pillTextActive]}>{t}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <Text style={styles.fieldLabel}>Priority</Text>
              <View style={styles.priorityRow}>
                {PRIORITIES.map((p) => {
                  const cfg = PRIORITY_CFG[p];
                  return (
                    <TouchableOpacity key={p} style={[styles.prioCard, priority === p && { borderColor: cfg.color, backgroundColor: cfg.bg }]} onPress={() => setPriority(p)}>
                      <Text style={[styles.prioCardText, priority === p && { color: cfg.color }]}>{cfg.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.pinToggle} onPress={() => setPinned(!pinned)}>
                <Ionicons name={pinned ? "checkmark-square" : "square-outline"} size={22} color={pinned ? "#3D5AF1" : "#9CA3AF"} />
                <Text style={styles.pinToggleText}>Pin this announcement</Text>
              </TouchableOpacity>

              {formErr ? <Text style={styles.errText}>{formErr}</Text> : null}
              <TouchableOpacity style={styles.confirmBtn} onPress={handlePost}>
                <Ionicons name="megaphone-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Post Announcement</Text>
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
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  cardPinned: { borderColor: "#C7D2FE", borderWidth: 1.5 },
  cardTop: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  priorityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 5 },
  pinnedRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  pinnedText: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  cardBody: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 19, marginBottom: 10 },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  targetPill: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  targetText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#6B7280" },
  priorityPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  priorityText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  dateText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginLeft: "auto" },
  cardActions: { gap: 8 },
  actionBtn: { padding: 4 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  pillActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  pillTextActive: { color: "#fff" },
  priorityRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  prioCard: { flex: 1, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", paddingVertical: 10, alignItems: "center" },
  prioCardText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  pinToggle: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  pinToggleText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  errText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 12 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
