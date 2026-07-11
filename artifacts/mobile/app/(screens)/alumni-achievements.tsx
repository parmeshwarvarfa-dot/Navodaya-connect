import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { Achievement } from "@/lib/api";

const CATEGORIES = ["All", "Placement", "College Admission", "UPSC/Gov", "Startup", "Research", "Sports", "Award", "Career"];
const CAT_COLOR: Record<string, string> = {
  "Placement": "#10B981", "College Admission": "#3D5AF1", "UPSC/Gov": "#8B5CF6",
  "Startup": "#F59E0B", "Research": "#0891B2", "Sports": "#EC4899", "Award": "#D97706",
  "Career": "#3D5AF1",
};

const FEATURED = [
  { name: "Kavita Singh",   achievement: "UPSC AIR 47",   category: "UPSC/Gov",         detail: "IAS Officer · 2012 Batch", emoji: "🎖️", jnv: "JNV Patna"   },
  { name: "Rahul Verma",    achievement: "Google SWE",     category: "Placement",         detail: "Engineer · 2018",          emoji: "🏆", jnv: "JNV Lucknow" },
  { name: "Dr. Meera Iyer", achievement: "AIIMS Delhi",    category: "College Admission", detail: "MBBS, AIIMS · 2015",       emoji: "⭐", jnv: "JNV Kochi"   },
];

export default function AlumniAchievementsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showShare,    setShowShare]    = useState(false);
  const [shareTitle,   setShareTitle]   = useState("");
  const [shareDesc,    setShareDesc]    = useState("");
  const [shareCat,     setShareCat]     = useState("Placement");
  const [toast,        setToast]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  useEffect(() => {
    api.achievements.list().then(setAchievements).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const shareAchievement = async () => {
    if (!shareTitle.trim() || !shareDesc.trim()) return;
    setSubmitting(true);
    try {
      const row = await api.achievements.create({ title: shareTitle.trim(), description: shareDesc.trim(), category: shareCat });
      setAchievements((p) => [row, ...p]);
      setShareTitle(""); setShareDesc(""); setShowShare(false);
      showToast("Achievement shared! Inspiring the community 🎉");
    } catch (e: any) { showToast(e?.message || "Failed to share."); }
    setSubmitting(false);
  };

  const filtered = activeFilter === "All" ? achievements : achievements.filter((a) => a.category === activeFilter);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements & Milestones</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowShare(true)}>
          <Ionicons name="add" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>

        {/* Featured Achievers */}
        <View style={styles.featuredSection}>
          <Text style={styles.sectionLabel}>⭐ Featured Achievers</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {FEATURED.map((f, i) => {
              const cc = CAT_COLOR[f.category] || "#6B7280";
              return (
                <View key={i} style={[styles.featuredCard, { borderTopColor: cc }]}>
                  <Text style={styles.featuredEmoji}>{f.emoji}</Text>
                  <Text style={styles.featuredName}>{f.name}</Text>
                  <Text style={[styles.featuredAch, { color: cc }]}>{f.achievement}</Text>
                  <Text style={styles.featuredDetail}>{f.detail}</Text>
                  <Text style={styles.featuredJnv}>{f.jnv}</Text>
                </View>
              );
            })}
          </ScrollView>
        </View>

        {/* Filter */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
          {CATEGORIES.map((c) => (
            <TouchableOpacity key={c} style={[styles.chip, activeFilter === c && styles.chipActive]} onPress={() => setActiveFilter(c)}>
              <Text style={[styles.chipText, activeFilter === c && styles.chipTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View style={{ paddingHorizontal: 16 }}>
          {loading ? (
            <Text style={{ textAlign: "center", color: "#9CA3AF", marginTop: 20 }}>Loading achievements…</Text>
          ) : filtered.length === 0 ? (
            <View style={{ alignItems: "center", paddingTop: 40 }}><Text style={{ fontSize: 40, marginBottom: 10 }}>🏆</Text><Text style={{ fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#6B7280" }}>No achievements yet. Be the first!</Text></View>
          ) : filtered.map((a) => {
            const cc = CAT_COLOR[a.category] || "#6B7280";
            return (
              <View key={a.id} style={styles.achCard}>
                <View style={styles.achHeader}>
                  <View style={styles.achAvatar}><Text style={styles.achAvatarText}>{(a.authorName || "A")[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.achNameRow}>
                      <Text style={styles.achName}>{a.authorName || "Alumni"}</Text>
                    </View>
                    <Text style={styles.achMeta}>{a.jnvName || "JNV"}{a.batch ? ` · ${a.batch} batch` : ""} · {new Date(a.createdAt).toLocaleDateString()}</Text>
                  </View>
                  <View style={[styles.catPill, { backgroundColor: cc + "18" }]}>
                    <Text style={[styles.catText, { color: cc }]}>{a.category}</Text>
                  </View>
                </View>
                <Text style={styles.achTitle}>{a.title}</Text>
                <Text style={styles.achDesc}>{a.description}</Text>
                <View style={styles.achFooter}>
                  <TouchableOpacity style={styles.inspireBtnWrap}>
                    <Text style={styles.inspireBtn}>🙌 Inspiring!</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Modal visible={showShare} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Share Your Achievement</Text>
              <TouchableOpacity onPress={() => setShowShare(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Category *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {CATEGORIES.filter((c) => c !== "All").map((c) => {
                  const cc = CAT_COLOR[c] || "#6B7280";
                  return (
                    <TouchableOpacity key={c} style={[styles.pill, shareCat === c && { borderColor: cc, backgroundColor: cc + "10" }]} onPress={() => setShareCat(c)}>
                      <Text style={[styles.pillText, shareCat === c && { color: cc }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.fieldLabel}>Achievement Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Cleared UPSC AIR 47" placeholderTextColor="#9CA3AF" value={shareTitle} onChangeText={setShareTitle} />
              <Text style={styles.fieldLabel}>Your Story *</Text>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Share your journey — inspire your JNV juniors!" placeholderTextColor="#9CA3AF" value={shareDesc} onChangeText={setShareDesc} multiline textAlignVertical="top" />
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={shareAchievement} disabled={submitting}>
                <Ionicons name="trophy-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>{submitting ? "Sharing…" : "Share Achievement"}</Text>
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
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#8B5CF6", alignItems: "center", justifyContent: "center" },
  featuredSection: { padding: 16 },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  featuredCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, width: 160, borderWidth: 1, borderColor: "#F0F0F0", borderTopWidth: 3, alignItems: "center", gap: 4 },
  featuredEmoji: { fontSize: 28, marginBottom: 4 },
  featuredName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", textAlign: "center" },
  featuredAch: { fontSize: 13, fontFamily: "Inter_700Bold", textAlign: "center" },
  featuredDetail: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  featuredJnv: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center" },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 14 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#8B5CF6", borderColor: "#8B5CF6" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  achCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  achHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 10 },
  achAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  achAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#8B5CF6" },
  achNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 3 },
  achName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  achMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  catPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  achTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  achDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 19, marginBottom: 12 },
  achFooter: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeCount: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  inspireBtnWrap: { marginLeft: "auto" },
  inspireBtn: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#8B5CF6", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
