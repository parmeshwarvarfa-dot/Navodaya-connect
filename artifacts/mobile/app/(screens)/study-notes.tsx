import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, getApiOrigin } from "@/lib/api";
import type { StudyMaterial } from "@/lib/api";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const BASE_SUBJECTS = ["All", "Physics", "Chemistry", "Maths", "English", "Biology", "History", "Geography", "Computer Science", "Economics", "Hindi"];
const TYPES = ["All", "PDF", "Notes", "PYQ", "Slides", "Link", "Assignment"];

const TYPE_ICON: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  PDF: "document-text-outline",
  Notes: "book-outline",
  PYQ: "school-outline",
  Slides: "easel-outline",
  Link: "link-outline",
  Assignment: "newspaper-outline",
};

const TYPE_COLOR: Record<string, string> = {
  PDF: "#EF4444",
  Notes: "#7C3AED",
  PYQ: "#8B5CF6",
  Slides: "#F59E0B",
  Link: "#10B981",
  Assignment: "#EC4899",
};

export default function StudyNotesScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const [materials, setMaterials] = useState<StudyMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [activeSubj, setActiveSubj] = useState("All");
  const [activeType, setActiveType] = useState("All");
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2000);
  };

  const fetchMaterials = async () => {
    setLoading(true);
    setLoadError("");
    try {
      setMaterials(await api.studyMaterials.list());
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Study materials could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  // Compute dynamic subjects including any custom subjects added by teachers
  const allSubjects = useMemo(() => {
    const list = new Set(BASE_SUBJECTS);
    materials.forEach((m) => {
      if (m.subject) list.add(m.subject);
    });
    return Array.from(list);
  }, [materials]);

  const toggleBM = async (id: string, title: string, bookmarked: boolean) => {
    try {
      const result = await api.studyMaterials.toggleBookmark(id);
      setMaterials((p) => p.map((m) => (m.id === id ? { ...m, bookmarked: result.bookmarked } : m)));
      showToast(result.bookmarked ? `"${title}" bookmarked!` : "Bookmark removed");
    } catch {
      showToast("Failed to update bookmark.");
    }
  };

  const openMaterial = async (url?: string) => {
    if (!url) return;
    try {
      const fullUrl = url.startsWith("/") ? `${getApiOrigin()}${url}` : url;
      if (Platform.OS === "web") {
        window.open(fullUrl, "_blank");
      } else {
        await Linking.openURL(fullUrl);
      }
    } catch {
      showToast("Could not open this material.");
    }
  };

  const filtered = materials.filter((n) => {
    const matchS =
      !search ||
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.subject.toLowerCase().includes(search.toLowerCase());
    const matchSubj = activeSubj === "All" || n.subject.toLowerCase() === activeSubj.toLowerCase();
    const matchType = activeType === "All" || n.type === activeType;
    return matchS && matchSubj && matchType;
  });

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} accessibilityLabel="Back">
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Study Notes & Materials</Text>
          <Text style={styles.headerSub}>Read notes, practice question sets & download resources</Text>
        </View>
        <TouchableOpacity
          style={styles.bookmarkToggle}
          onPress={() => {
            setActiveSubj("All");
            setActiveType("All");
            setSearch("");
            fetchMaterials();
          }}
          accessibilityLabel="Refresh"
        >
          <Ionicons name="refresh-outline" size={19} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, subject, chapter…"
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
        />
        {search ? (
          <TouchableOpacity onPress={() => setSearch("")}>
            <Ionicons name="close-circle" size={16} color="#9CA3AF" />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Dynamic Subject Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={{ flexGrow: 0 }}
      >
        {allSubjects.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, activeSubj.toLowerCase() === s.toLowerCase() && styles.chipActive]}
            onPress={() => setActiveSubj(s)}
          >
            <Text
              style={[
                styles.chipText,
                activeSubj.toLowerCase() === s.toLowerCase() && styles.chipTextActive,
              ]}
            >
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Type Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={[styles.chips, { paddingTop: 0 }]}
        style={{ flexGrow: 0 }}
      >
        {TYPES.map((t) => (
          <TouchableOpacity
            key={t}
            style={[
              styles.chip,
              activeType === t && { ...styles.chipActive, backgroundColor: TYPE_COLOR[t] || "#7C3AED" },
            ]}
            onPress={() => setActiveType(t)}
          >
            <Text style={[styles.chipText, activeType === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Materials List */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}
      >
        {loading ? (
          <Text style={styles.resultCount}>Loading study materials…</Text>
        ) : (
          <Text style={styles.resultCount}>{filtered.length} resources available</Text>
        )}

        {!loading && loadError ? (
          <TouchableOpacity
            style={styles.empty}
            onPress={() => void fetchMaterials()}
            accessibilityRole="button"
          >
            <Ionicons name="cloud-offline-outline" size={36} color="#9CA3AF" />
            <Text style={styles.emptyText}>{loadError}</Text>
            <Text style={styles.resultCount}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}

        {!loading && !loadError && filtered.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="folder-open-outline" size={44} color="#94A3B8" />
            <Text style={styles.emptyText}>No materials found for this selection</Text>
          </View>
        ) : (
          filtered.map((note) => {
            const isDirectFile = note.url?.includes("/api/study-materials/files/");
            return (
              <TouchableOpacity
                key={note.id}
                style={styles.noteCard}
                onPress={() => openMaterial(note.url)}
                activeOpacity={0.8}
              >
                <View style={styles.noteLeft}>
                  <View
                    style={[
                      styles.typeIconWrap,
                      { backgroundColor: (TYPE_COLOR[note.type] || "#7C3AED") + "18" },
                    ]}
                  >
                    <Ionicons
                      name={TYPE_ICON[note.type] || "document-text-outline"}
                      size={20}
                      color={TYPE_COLOR[note.type] || "#7C3AED"}
                    />
                  </View>
                </View>

                <View style={styles.noteBody}>
                  <View style={styles.noteTitleRow}>
                    <Text style={styles.noteTitle} numberOfLines={2}>
                      {note.title}
                    </Text>
                  </View>
                  <Text style={styles.noteMeta}>
                    {note.subject} · {note.authorName || "Faculty"}
                  </Text>
                  <View style={styles.noteFooter}>
                    <View
                      style={[
                        styles.typePill,
                        { backgroundColor: (TYPE_COLOR[note.type] || "#7C3AED") + "18" },
                      ]}
                    >
                      <Text
                        style={[
                          styles.typePillText,
                          { color: TYPE_COLOR[note.type] || "#7C3AED" },
                        ]}
                      >
                        {note.type}
                      </Text>
                    </View>

                    {isDirectFile ? (
                      <View style={styles.directBadge}>
                        <Ionicons name="cloud-done-outline" size={11} color="#059669" />
                        <Text style={styles.directBadgeText}>Direct File</Text>
                      </View>
                    ) : null}

                    {note.size ? <Text style={styles.noteSize}>{note.size}</Text> : null}
                    <Text style={styles.noteDate}>{new Date(note.createdAt).toLocaleDateString()}</Text>
                  </View>
                </View>

                <View style={styles.noteActions}>
                  <TouchableOpacity
                    onPress={(e) => {
                      e.stopPropagation();
                      toggleBM(note.id, note.title, note.bookmarked);
                    }}
                    style={styles.actionBtn}
                    accessibilityLabel="Bookmark note"
                  >
                    <Ionicons
                      name={note.bookmarked ? "bookmark" : "bookmark-outline"}
                      size={18}
                      color={note.bookmarked ? "#7C3AED" : "#9CA3AF"}
                    />
                  </TouchableOpacity>

                  {note.url ? (
                    <View
                      style={[
                        styles.downloadBtn,
                        { backgroundColor: (TYPE_COLOR[note.type] || "#7C3AED") + "18" },
                      ]}
                    >
                      <Ionicons
                        name={isDirectFile ? "download-outline" : "open-outline"}
                        size={15}
                        color={TYPE_COLOR[note.type] || "#7C3AED"}
                      />
                    </View>
                  ) : null}
                </View>
              </TouchableOpacity>
            );
          })
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
  container: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
  },
  headerSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 1,
  },
  bookmarkToggle: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 40,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#0F172A",
    outlineStyle: "none" as any,
  },
  chips: {
    paddingHorizontal: 16,
    gap: 8,
    paddingBottom: 8,
    paddingTop: 4,
  },
  chip: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#7C3AED",
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#475569",
  },
  chipTextActive: {
    color: "#FFFFFF",
    fontFamily: "Inter_700Bold",
  },
  resultCount: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
    marginBottom: 10,
    marginTop: 6,
  },
  empty: {
    alignItems: "center",
    paddingTop: 50,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
  },
  noteCard: {
    flexDirection: "row",
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.02,
    shadowRadius: 2,
    elevation: 1,
  },
  noteLeft: {
    justifyContent: "flex-start",
    paddingTop: 2,
  },
  typeIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  noteBody: {
    flex: 1,
    gap: 2,
  },
  noteTitleRow: {
    marginBottom: 2,
  },
  noteTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0F172A",
    lineHeight: 18,
  },
  noteMeta: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
  },
  noteFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  typePill: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  typePillText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
  },
  directBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  directBadgeText: {
    color: "#059669",
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  noteSize: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
  },
  noteDate: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
    marginLeft: "auto",
  },
  noteActions: {
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  actionBtn: {
    padding: 4,
  },
  downloadBtn: {
    width: 30,
    height: 30,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  toast: {
    position: "absolute",
    bottom: 30,
    left: 20,
    right: 20,
    backgroundColor: "#0F172A",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toastText: {
    color: "#FFFFFF",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
});
