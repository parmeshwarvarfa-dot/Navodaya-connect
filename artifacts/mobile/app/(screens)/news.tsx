import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { NewsItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";

const NEWS_CATEGORIES    = ["General", "Academic", "Sports", "Cultural", "Achievement"];
const ANNOUNCE_CATEGORIES = ["Announcement", "Circular", "Notice", "Holiday", "Exam"];
const ALL_CATEGORIES     = [...NEWS_CATEGORIES, ...ANNOUNCE_CATEGORIES];

const ANNOUNCEMENT_KEYS = new Set(ANNOUNCE_CATEGORIES.map((c) => c.toLowerCase()));

const isAnnouncement = (item: NewsItem) =>
  ANNOUNCEMENT_KEYS.has(item.category?.toLowerCase() ?? "");

type Tab = "news" | "announcements";

const TAB_CONFIG: { id: Tab; label: string; icon: React.ComponentProps<typeof Ionicons>["name"] }[] = [
  { id: "news",          label: "JNV News",      icon: "newspaper-outline"   },
  { id: "announcements", label: "Announcements", icon: "megaphone-outline"   },
];

export default function NewsScreen() {
  const colors   = useColors();
  const insets   = useSafeAreaInsets();
  const { profile } = useAuth();
  const [news, setNews]         = useState<NewsItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("news");
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle]       = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const [postError, setPostError]   = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<NewsItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const topPad   = Platform.OS === "web" ? 67 : insets.top;
  const canPost  = profile?.role === "teacher" || profile?.role === "official";

  const fetchNews = async () => {
    try {
      const data = await api.news.list();
      setNews(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNews(); }, []);

  const handlePost = async () => {
    if (!title.trim() || !description.trim()) {
      setPostError("Please fill in the title and description.");
      return;
    }
    setPostError("");
    setSubmitting(true);
    try {
      await api.news.create({ title: title.trim(), description: description.trim(), category });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setCategory("General");
      fetchNews();
    } catch {
      setPostError("Failed to post. Please try again.");
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    setDeleting(true);
    try {
      await api.news.delete(id);
      fetchNews();
    } catch {}
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const newsItems         = news.filter((n) => !isAnnouncement(n));
  const announcementItems = news.filter((n) =>  isAnnouncement(n));
  const displayItems      = activeTab === "news" ? newsItems : announcementItems;

  const isAnnouncementMode = activeTab === "announcements";

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* ── Header ── */}
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {activeTab === "news" ? "JNV News" : "Announcements"}
          </Text>
          {canPost && (
            <TouchableOpacity style={styles.addBtn} onPress={() => {
              setCategory(isAnnouncementMode ? "Announcement" : "General");
              setShowCreate(true);
            }}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabRow}>
          {TAB_CONFIG.map((tab) => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tab, activeTab === tab.id && styles.tabActive]}
              onPress={() => setActiveTab(tab.id)}
              activeOpacity={0.8}
            >
              <Ionicons name={tab.icon} size={14} color={activeTab === tab.id ? "#fff" : "rgba(255,255,255,0.65)"} />
              <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
              <View style={[styles.countBadge, { backgroundColor: activeTab === tab.id ? "rgba(255,255,255,0.25)" : "rgba(255,255,255,0.12)" }]}>
                <Text style={styles.countBadgeText}>
                  {tab.id === "news" ? newsItems.length : announcementItems.length}
                </Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* ── List ── */}
      <FlatList
        data={displayItems}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={isAnnouncementMode ? "megaphone-outline" : "newspaper-outline"}
                size={48}
                color={colors.mutedForeground}
              />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>
                {isAnnouncementMode ? "No announcements yet" : "No news yet"}
              </Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
                {canPost
                  ? `Tap + to post a ${isAnnouncementMode ? "new announcement" : "news update"}`
                  : `${isAnnouncementMode ? "Announcements" : "News updates"} from teachers & officials will appear here`}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <PremiumCard style={[styles.newsCard, isAnnouncement(item) && styles.announceCard]}>
            {isAnnouncement(item) && <View style={styles.announceStripe} />}
            <View style={styles.cardMeta}>
              <View style={[styles.catBadge, {
                backgroundColor: isAnnouncement(item) ? "#FEF2F2" : colors.accent,
              }]}>
                <Ionicons
                  name={isAnnouncement(item) ? "megaphone-outline" : "newspaper-outline"}
                  size={10}
                  color={isAnnouncement(item) ? "#EF4444" : colors.primary}
                />
                <Text style={[styles.catText, { color: isAnnouncement(item) ? "#EF4444" : colors.primary }]}>
                  {item.category}
                </Text>
              </View>
              {canPost && (
                <TouchableOpacity onPress={() => setDeleteConfirm(item)}>
                  <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.newsTitle, { color: colors.foreground }]}>{item.title}</Text>
            <Text style={[styles.newsDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
            <View style={styles.cardFooter}>
              <Ionicons name="person-circle-outline" size={14} color={colors.mutedForeground} />
              <Text style={[styles.newsAuthor, { color: colors.mutedForeground }]}>{item.authorName}</Text>
            </View>
          </PremiumCard>
        )}
      />

      {/* ── Create Modal ── */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {isAnnouncementMode ? "Post Announcement" : "Post News"}
            </Text>
            <TouchableOpacity onPress={() => { setShowCreate(false); setPostError(""); }}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            {isAnnouncementMode && (
              <View style={styles.announceNotice}>
                <Ionicons name="megaphone" size={16} color="#EF4444" />
                <Text style={styles.announceNoticeText}>Announcements are highlighted for all users and sent as priority notices.</Text>
              </View>
            )}

            <PremiumInput label="Title" value={title} onChangeText={setTitle} placeholder={isAnnouncementMode ? "Announcement headline" : "News headline"} icon="newspaper-outline" />
            <PremiumInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Write the full content here..."
              multiline
              numberOfLines={5}
              style={{ minHeight: 100, textAlignVertical: "top" }}
              icon="create-outline"
            />

            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {(isAnnouncementMode ? ANNOUNCE_CATEGORIES : NEWS_CATEGORIES).map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, { backgroundColor: category === c ? colors.primary : colors.muted, borderRadius: 20 }]}
                >
                  <Text style={[styles.chipText, { color: category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {postError ? (
              <View style={styles.errorBanner}>
                <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
                <Text style={styles.errorText}>{postError}</Text>
              </View>
            ) : null}

            <PremiumButton
              title={isAnnouncementMode ? "Post Announcement" : "Post News"}
              onPress={handlePost}
              loading={submitting}
              style={{ marginTop: 8 }}
            />
          </ScrollView>
        </View>
      </Modal>

      {/* ── Delete Confirm Modal ── */}
      <Modal visible={!!deleteConfirm} transparent animationType="fade" onRequestClose={() => setDeleteConfirm(null)}>
        <View style={styles.confirmOverlay}>
          <View style={styles.confirmBox}>
            <View style={styles.confirmIcon}>
              <Ionicons name="trash-outline" size={28} color="#EF4444" />
            </View>
            <Text style={styles.confirmTitle}>Delete Post?</Text>
            <Text style={styles.confirmText}>"{deleteConfirm?.title}" will be permanently removed.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setDeleteConfirm(null)}>
                <Text style={styles.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmDelete}
                onPress={() => deleteConfirm && handleDelete(deleteConfirm.id)}
                disabled={deleting}
              >
                <Text style={styles.confirmDeleteText}>{deleting ? "Deleting…" : "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 14 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold", flex: 1, textAlign: "center" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  tabRow: { flexDirection: "row", gap: 8 },
  tab: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 9, borderRadius: 12, backgroundColor: "rgba(255,255,255,0.12)" },
  tabActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.65)" },
  tabTextActive: { color: "#fff", fontFamily: "Inter_700Bold" },
  countBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  countBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff" },
  listContent: { padding: 16 },
  newsCard: { marginBottom: 12 },
  announceCard: { borderLeftWidth: 3, borderLeftColor: "#EF4444", overflow: "hidden" },
  announceStripe: { position: "absolute", left: 0, top: 0, bottom: 0, width: 3, backgroundColor: "#EF4444" },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  catBadge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  newsTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8, lineHeight: 22 },
  newsDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, marginBottom: 10 },
  cardFooter: { flexDirection: "row", alignItems: "center", gap: 6 },
  newsAuthor: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", lineHeight: 20 },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
  announceNotice: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: "#FECACA" },
  announceNoticeText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#B91C1C", lineHeight: 18 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  chipScroll: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  errorBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 10, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#EF4444" },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 24 },
  confirmBox: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%", maxWidth: 320, alignItems: "center", gap: 10 },
  confirmIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  confirmTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  confirmText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 20 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 6, width: "100%" },
  confirmCancel: { flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", alignItems: "center" },
  confirmCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#374151" },
  confirmDelete: { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center" },
  confirmDeleteText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
