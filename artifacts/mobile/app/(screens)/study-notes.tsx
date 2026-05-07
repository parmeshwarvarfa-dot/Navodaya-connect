import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const SUBJECTS = ["All", "Physics", "Chemistry", "Maths", "English", "Biology", "History"];
const TYPES    = ["All", "PDF", "Notes", "PYQ", "Slides", "Link"];

const NOTES = [
  { id: "1", title: "Electromagnetic Waves — Complete Chapter",  subject: "Physics",   type: "PDF",   teacher: "Mr. Ramesh Kumar",  date: "Today",     class: "Class 11 Science A", size: "2.4 MB",  bookmarked: true  },
  { id: "2", title: "Trigonometry Identities & Formulas",        subject: "Maths",     type: "Notes", teacher: "Ms. Asha Sharma",   date: "Yesterday", class: "Class 11 Science A", size: "450 KB",  bookmarked: false },
  { id: "3", title: "Organic Chemistry — Hydrocarbons",          subject: "Chemistry", type: "PDF",   teacher: "Ms. Pooja Devi",    date: "2 days ago",class: "Class 11 Science A", size: "3.1 MB",  bookmarked: true  },
  { id: "4", title: "Essay Writing — Structure & Examples",      subject: "English",   type: "Notes", teacher: "Mr. Sunil Tiwari",  date: "3 days ago",class: "Class 11 Science A", size: "320 KB",  bookmarked: false },
  { id: "5", title: "JEE PYQs — Physics 2018–2024",             subject: "Physics",   type: "PYQ",   teacher: "Mr. Ramesh Kumar",  date: "4 days ago",class: "Class 11 Science A", size: "5.7 MB",  bookmarked: false },
  { id: "6", title: "Calculus — Differential Equations",         subject: "Maths",     type: "PDF",   teacher: "Ms. Asha Sharma",   date: "5 days ago",class: "Class 11 Science A", size: "1.8 MB",  bookmarked: false },
  { id: "7", title: "Cell Biology — NCERT + Extra Notes",        subject: "Biology",   type: "Notes", teacher: "Dr. Meera Verma",   date: "1 week ago",class: "Class 11 Science A", size: "900 KB",  bookmarked: true  },
  { id: "8", title: "Modern History — Freedom Movement Slides",  subject: "History",   type: "Slides",teacher: "Mr. Arjun Das",     date: "1 week ago",class: "Class 11 Science A", size: "3.8 MB",  bookmarked: false },
  { id: "9", title: "NEET Biology PYQs 2015–2024",              subject: "Biology",   type: "PYQ",   teacher: "Dr. Meera Verma",   date: "2 weeks ago",class: "Class 11 Science A", size: "6.2 MB",  bookmarked: false },
];

const TYPE_ICON: Record<string, keyof typeof import("@expo/vector-icons").Ionicons.glyphMap> = {
  PDF: "document-outline", Notes: "document-text-outline",
  PYQ: "school-outline",   Slides: "easel-outline",
  Link: "link-outline",
};
const TYPE_COLOR: Record<string, string> = {
  PDF: "#EF4444", Notes: "#3D5AF1", PYQ: "#8B5CF6", Slides: "#F59E0B", Link: "#10B981",
};

export default function StudyNotesScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [search,      setSearch]      = useState("");
  const [activeSubj,  setActiveSubj]  = useState("All");
  const [activeType,  setActiveType]  = useState("All");
  const [bookmarks,   setBookmarks]   = useState<Set<string>>(new Set(NOTES.filter((n) => n.bookmarked).map((n) => n.id)));
  const [toast,       setToast]       = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000); };
  const toggleBM  = (id: string, title: string) => {
    setBookmarks((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
    showToast(bookmarks.has(id) ? "Bookmark removed" : `"${title}" bookmarked!`);
  };

  const filtered = NOTES.filter((n) => {
    const matchS = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.subject.toLowerCase().includes(search.toLowerCase());
    const matchSubj = activeSubj === "All" || n.subject === activeSubj;
    const matchType = activeType === "All" || n.type === activeType;
    return matchS && matchSubj && matchType;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Study Notes</Text>
        <TouchableOpacity style={styles.bookmarkToggle} onPress={() => { setActiveSubj("All"); setActiveType("All"); }}>
          <Ionicons name="bookmark-outline" size={20} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search by title, subject…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
      </View>

      {/* Subject chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {SUBJECTS.map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, activeSubj === s && styles.chipActive]} onPress={() => setActiveSubj(s)}>
            <Text style={[styles.chipText, activeSubj === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Type chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]} style={{ flexGrow: 0 }}>
        {TYPES.map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, activeType === t && { ...styles.chipActive, backgroundColor: TYPE_COLOR[t] || "#3D5AF1" }]} onPress={() => setActiveType(t)}>
            <Text style={[styles.chipText, activeType === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        <Text style={styles.resultCount}>{filtered.length} materials found</Text>

        {filtered.length === 0 ? (
          <View style={styles.empty}><Text style={styles.emptyIcon}>📂</Text><Text style={styles.emptyText}>No materials found</Text></View>
        ) : filtered.map((note) => (
          <View key={note.id} style={styles.noteCard}>
            <View style={styles.noteLeft}>
              <View style={[styles.typeIconWrap, { backgroundColor: (TYPE_COLOR[note.type] || "#3D5AF1") + "18" }]}>
                <Ionicons name={TYPE_ICON[note.type] || "document-outline"} size={22} color={TYPE_COLOR[note.type] || "#3D5AF1"} />
              </View>
            </View>
            <View style={styles.noteBody}>
              <View style={styles.noteTitleRow}>
                <Text style={styles.noteTitle} numberOfLines={2}>{note.title}</Text>
              </View>
              <Text style={styles.noteMeta}>{note.subject} · {note.teacher}</Text>
              <View style={styles.noteFooter}>
                <View style={[styles.typePill, { backgroundColor: (TYPE_COLOR[note.type] || "#3D5AF1") + "18" }]}>
                  <Text style={[styles.typePillText, { color: TYPE_COLOR[note.type] || "#3D5AF1" }]}>{note.type}</Text>
                </View>
                <Text style={styles.noteSize}>{note.size}</Text>
                <Text style={styles.noteDate}>{note.date}</Text>
              </View>
            </View>
            <View style={styles.noteActions}>
              <TouchableOpacity onPress={() => toggleBM(note.id, note.title)} style={styles.actionBtn}>
                <Ionicons name={bookmarks.has(note.id) ? "bookmark" : "bookmark-outline"} size={18} color={bookmarks.has(note.id) ? "#3D5AF1" : "#9CA3AF"} />
              </TouchableOpacity>
              <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: (TYPE_COLOR[note.type] || "#3D5AF1") + "18" }]}>
                <Ionicons name="download-outline" size={16} color={TYPE_COLOR[note.type] || "#3D5AF1"} />
              </TouchableOpacity>
            </View>
          </View>
        ))}
      </ScrollView>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  bookmarkToggle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 14, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 10, paddingTop: 4 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 12, marginTop: 8 },
  empty: { alignItems: "center", paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  noteCard: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0", gap: 12 },
  noteLeft: { justifyContent: "flex-start", paddingTop: 2 },
  typeIconWrap: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  noteBody: { flex: 1 },
  noteTitleRow: { marginBottom: 4 },
  noteTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", lineHeight: 20 },
  noteMeta: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 8 },
  noteFooter: { flexDirection: "row", alignItems: "center", gap: 8 },
  typePill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  typePillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  noteSize: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  noteDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginLeft: "auto" },
  noteActions: { justifyContent: "space-between", alignItems: "flex-end" },
  actionBtn: { padding: 4 },
  downloadBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginTop: 8 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
