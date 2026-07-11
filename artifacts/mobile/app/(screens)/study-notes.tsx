import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { StudyMaterial } from "@/lib/api";

const SUBJECTS = ["All", "Physics", "Chemistry", "Maths", "English", "Biology", "History"];
const TYPES    = ["All", "PDF", "Notes", "PYQ", "Slides", "Link"];

const TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
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
  const [materials,   setMaterials]   = useState<StudyMaterial[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [search,      setSearch]      = useState("");
  const [activeSubj,  setActiveSubj]  = useState("All");
  const [activeType,  setActiveType]  = useState("All");
  const [toast,       setToast]       = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2000); };

  const fetchMaterials = async () => {
    try { setMaterials(await api.studyMaterials.list()); } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchMaterials(); }, []);

  const toggleBM = async (id: string, title: string, bookmarked: boolean) => {
    try {
      const result = await api.studyMaterials.toggleBookmark(id);
      setMaterials((p) => p.map((m) => m.id === id ? { ...m, bookmarked: result.bookmarked } : m));
      showToast(result.bookmarked ? `"${title}" bookmarked!` : "Bookmark removed");
    } catch { showToast("Failed to update bookmark."); }
  };

  const filtered = materials.filter((n) => {
    const matchS    = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.subject.toLowerCase().includes(search.toLowerCase());
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
        <TouchableOpacity style={styles.bookmarkToggle} onPress={() => { setActiveSubj("All"); setActiveType("All"); setSearch(""); }}>
          <Ionicons name="refresh-outline" size={20} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search by title, subject…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
        {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {SUBJECTS.map((s) => (
          <TouchableOpacity key={s} style={[styles.chip, activeSubj === s && styles.chipActive]} onPress={() => setActiveSubj(s)}>
            <Text style={[styles.chipText, activeSubj === s && styles.chipTextActive]}>{s}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]} style={{ flexGrow: 0 }}>
        {TYPES.map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, activeType === t && { ...styles.chipActive, backgroundColor: TYPE_COLOR[t] || "#3D5AF1" }]} onPress={() => setActiveType(t)}>
            <Text style={[styles.chipText, activeType === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        {loading ? (
          <Text style={styles.resultCount}>Loading materials…</Text>
        ) : (
          <Text style={styles.resultCount}>{filtered.length} materials found</Text>
        )}

        {!loading && filtered.length === 0 ? (
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
              <Text style={styles.noteMeta}>{note.subject} · {note.authorName || "Teacher"}</Text>
              <View style={styles.noteFooter}>
                <View style={[styles.typePill, { backgroundColor: (TYPE_COLOR[note.type] || "#3D5AF1") + "18" }]}>
                  <Text style={[styles.typePillText, { color: TYPE_COLOR[note.type] || "#3D5AF1" }]}>{note.type}</Text>
                </View>
                {note.size ? <Text style={styles.noteSize}>{note.size}</Text> : null}
                <Text style={styles.noteDate}>{new Date(note.createdAt).toLocaleDateString()}</Text>
              </View>
            </View>
            <View style={styles.noteActions}>
              <TouchableOpacity onPress={() => toggleBM(note.id, note.title, note.bookmarked)} style={styles.actionBtn}>
                <Ionicons name={note.bookmarked ? "bookmark" : "bookmark-outline"} size={18} color={note.bookmarked ? "#3D5AF1" : "#9CA3AF"} />
              </TouchableOpacity>
              {note.url ? (
                <TouchableOpacity style={[styles.downloadBtn, { backgroundColor: (TYPE_COLOR[note.type] || "#3D5AF1") + "18" }]}>
                  <Ionicons name="open-outline" size={16} color={TYPE_COLOR[note.type] || "#3D5AF1"} />
                </TouchableOpacity>
              ) : (
                <View style={[styles.downloadBtn, { backgroundColor: "#F3F4F6" }]}>
                  <Ionicons name="document-outline" size={16} color="#9CA3AF" />
                </View>
              )}
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
