import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { Memory } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const POST_TAGS = ["Memory", "Achievement", "Advice", "Story", "Motivation"];
const TAG_COLOR: Record<string, string> = {
  Memory: "#8B5CF6", Achievement: "#10B981", Advice: "#3D5AF1", Story: "#F59E0B", Motivation: "#EC4899",
};

const INITIAL_POSTS = [
  { id: "1", author: "Rahul Verma",     jnv: "JNV Lucknow", year: "2018", tag: "Achievement", text: "Just joined Google as a Software Engineer! Grateful to JNV for the foundation. The hostel nights and study sessions shaped who I am today. 🙏", likes: 142, comments: 18, liked: false, time: "2h ago",    verified: true },
  { id: "2", author: "Dr. Meera Iyer",  jnv: "JNV Kochi",   year: "2015", tag: "Memory",      text: "Missing those rainy evenings at our JNV campus. The bond we built there is irreplaceable. Still have my hostel roommate as my best friend! ❤️", likes: 89,  comments: 24, liked: false, time: "Yesterday", verified: true },
  { id: "3", author: "Kavita Singh",    jnv: "JNV Patna",   year: "2012", tag: "Motivation",  text: "To all JNV students — your humble background is not a limitation, it's your superpower. I cleared UPSC from a village in Bihar. You can too. 💪", likes: 312, comments: 47, liked: true,  time: "3 days ago", verified: true },
  { id: "4", author: "Arjun Sharma",    jnv: "JNV Jaipur",  year: "2020", tag: "Advice",      text: "JEE preparation tip: Don't chase coaching centres. Use NCERT religiously, practice PYQs, and find a mentor. Happy to help anyone preparing for JEE!",  likes: 76, comments: 12, liked: false, time: "4 days ago", verified: true },
];

export default function AlumniMemoriesScreen() {
  const insets  = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const [posts,      setPosts]      = useState<Memory[]>([]);
  const [loading,    setLoading]    = useState(true);
  const [activeTag,  setActiveTag]  = useState("All");
  const [showCreate, setShowCreate] = useState(false);
  const [postText,   setPostText]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [toast,      setToast]      = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  useEffect(() => {
    api.memories.list().then(setPosts).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const toggleLike = async (id: string) => {
    try {
      const result = await api.memories.toggleLike(id);
      setPosts((p) => p.map((post) => post.id === id ? { ...post, liked: result.liked, likes: result.likes } : post));
    } catch { showToast("Failed to update like."); }
  };

  const createPost = async () => {
    if (!postText.trim()) return;
    setSubmitting(true);
    try {
      const row = await api.memories.create({ caption: postText.trim() });
      setPosts((p) => [row, ...p]);
      setPostText(""); setShowCreate(false);
      showToast("Post shared with your JNV community!");
    } catch (e: any) { showToast(e?.message || "Failed to post."); }
    setSubmitting(false);
  };

  const filtered = posts;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Memories & Updates</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {["All", ...POST_TAGS].map((t) => (
          <TouchableOpacity key={t} style={[styles.chip, activeTag === t && styles.chipActive]} onPress={() => setActiveTag(t)}>
            {activeTag === t && t !== "All" && <View style={[styles.chipDot, { backgroundColor: TAG_COLOR[t] || "#fff" }]} />}
            <Text style={[styles.chipText, activeTag === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>
        {loading ? (
          <Text style={{ textAlign: "center", color: "#9CA3AF", marginTop: 40 }}>Loading…</Text>
        ) : filtered.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 60 }}><Text style={{ fontSize: 40, marginBottom: 12 }}>📝</Text><Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" }}>No posts yet. Share your memory!</Text></View>
        ) : filtered.map((post) => (
            <View key={post.id} style={styles.postCard}>
              <View style={styles.postHeader}>
                <View style={styles.authorAvatar}><Text style={styles.authorAvatarText}>{(post.authorName || "A")[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <View style={styles.authorRow}>
                    <Text style={styles.authorName}>{post.authorName || "Alumni"}</Text>
                  </View>
                  <Text style={styles.authorMeta}>{post.jnvName || "JNV"} · {new Date(post.createdAt).toLocaleDateString()}</Text>
                </View>
              </View>

              {post.caption ? <Text style={styles.postText}>{post.caption}</Text> : null}

              <View style={styles.postActions}>
                <TouchableOpacity style={styles.actionBtn} onPress={() => toggleLike(post.id)}>
                  <Ionicons name={post.liked ? "heart" : "heart-outline"} size={18} color={post.liked ? "#EF4444" : "#9CA3AF"} />
                  <Text style={[styles.actionCount, post.liked && { color: "#EF4444" }]}>{post.likes}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn}>
                  <Ionicons name="share-social-outline" size={18} color="#9CA3AF" />
                  <Text style={styles.actionCount}>Share</Text>
                </TouchableOpacity>
                {post.authorId && post.authorId !== profile?.uid ? (
                  <TouchableOpacity style={styles.actionBtn} onPress={() => router.push({ pathname: "/(screens)/report-user", params: { userId: post.authorId! } })}>
                    <Ionicons name="flag-outline" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ))}
      </ScrollView>

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share with JNV Community</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Your Memory / Update *</Text>
              <TextInput style={[styles.input, { minHeight: 140 }]} placeholder="Share a memory, achievement, advice or story with your JNV community…" placeholderTextColor="#9CA3AF" value={postText} onChangeText={setPostText} multiline textAlignVertical="top" />
              <View style={styles.guideNote}>
                <Ionicons name="shield-checkmark-outline" size={14} color="#3D5AF1" />
                <Text style={styles.guideNoteText}>Posts are visible to your JNV community. Keep content educational and community-focused.</Text>
              </View>
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={createPost} disabled={submitting}>
                <Ionicons name="share-social-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>{submitting ? "Posting…" : "Share Post"}</Text>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F59E0B", alignItems: "center", justifyContent: "center" },
  chips: { paddingHorizontal: 14, gap: 8, paddingVertical: 12 },
  chip: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#111827", borderColor: "#111827" },
  chipDot: { width: 6, height: 6, borderRadius: 3 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  postCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  postHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  authorAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  authorAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  authorName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  authorMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  tagPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  tagText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  postText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 22, marginBottom: 14 },
  postActions: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionCount: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  tagGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  tagCard: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  tagCardText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 14 },
  guideNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#EEF2FF", borderRadius: 10, padding: 12, marginBottom: 16 },
  guideNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#3730A3" },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#F59E0B", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
