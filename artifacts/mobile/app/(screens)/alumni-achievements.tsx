import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const CATEGORIES = ["All", "Placement", "College Admission", "UPSC/Gov", "Startup", "Research", "Sports", "Award"];
const CAT_COLOR: Record<string, string> = {
  "Placement": "#10B981", "College Admission": "#3D5AF1", "UPSC/Gov": "#8B5CF6",
  "Startup": "#F59E0B", "Research": "#0891B2", "Sports": "#EC4899", "Award": "#D97706",
};

const FEATURED = [
  { name: "Kavita Singh",   achievement: "UPSC AIR 47",        category: "UPSC/Gov",         detail: "IAS Officer · 2012 Batch",   emoji: "🎖️", jnv: "JNV Patna"    },
  { name: "Rahul Verma",    achievement: "Google SWE",          category: "Placement",         detail: "Software Engineer · 2018",   emoji: "🏆", jnv: "JNV Lucknow"  },
  { name: "Dr. Meera Iyer", achievement: "AIIMS Delhi",         category: "College Admission", detail: "MBBS, AIIMS · 2015 Batch",   emoji: "⭐", jnv: "JNV Kochi"    },
];

const ACHIEVEMENTS = [
  { id: "1", name: "Arjun Sharma",    year: "2020", jnv: "JNV Jaipur",   category: "College Admission", title: "JEE Advanced AIR 204 – IIT Bombay CSE",   description: "Cleared JEE Advanced with AIR 204 after one year of self-study at JNV!", likes: 89,  liked: false, time: "2 days ago",  verified: true  },
  { id: "2", name: "Sneha Dubey",     year: "2021", jnv: "JNV Varanasi", category: "Research",          title: "PhD Scholarship at IISc Bangalore",        description: "Awarded full scholarship for PhD in Computational Biology at IISc!",       likes: 56,  liked: false, time: "3 days ago",  verified: false },
  { id: "3", name: "Vivek Nair",      year: "2014", jnv: "JNV Thrissur", category: "Award",             title: "Gallantry Award – Indian Army Captain",    description: "Honoured with Sena Medal for outstanding service in Siachen Glacier.",    likes: 213, liked: true,  time: "1 week ago",  verified: true  },
  { id: "4", name: "Priti Gupta",     year: "2016", jnv: "JNV Bhopal",   category: "Placement",        title: "Selected as Public Prosecutor – Govt of MP", description: "Cleared MPPSC Law exam and appointed as District Public Prosecutor.",    likes: 74,  liked: false, time: "2 weeks ago", verified: false },
  { id: "5", name: "Manish Kumar",    year: "2013", jnv: "JNV Ranchi",   category: "Startup",           title: "EdTech Startup reaches 50,000 Students",   description: "My EdTech startup Shiksha.ai now serves 50K+ students across 12 states!", likes: 167, liked: false, time: "3 weeks ago", verified: true  },
];

export default function AlumniAchievementsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [achievements, setAchievements] = useState(ACHIEVEMENTS);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showShare,    setShowShare]    = useState(false);
  const [shareTitle,   setShareTitle]   = useState("");
  const [shareDesc,    setShareDesc]    = useState("");
  const [shareCat,     setShareCat]     = useState("Placement");
  const [toast,        setToast]        = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const toggleLike = (id: string) => {
    setAchievements((p) => p.map((a) => a.id === id ? { ...a, liked: !a.liked, likes: a.liked ? a.likes - 1 : a.likes + 1 } : a));
  };

  const shareAchievement = () => {
    if (!shareTitle.trim() || !shareDesc.trim()) return;
    setAchievements((p) => [{ id: Date.now().toString(), name: "You", year: "Alumni", jnv: "Your JNV", category: shareCat, title: shareTitle, description: shareDesc, likes: 0, liked: false, time: "Just now", verified: false }, ...p]);
    setShareTitle(""); setShareDesc(""); setShowShare(false);
    showToast("Achievement shared! Inspiring the community 🎉");
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
          {filtered.map((a) => {
            const cc = CAT_COLOR[a.category] || "#6B7280";
            return (
              <View key={a.id} style={styles.achCard}>
                <View style={styles.achHeader}>
                  <View style={styles.achAvatar}><Text style={styles.achAvatarText}>{a.name[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.achNameRow}>
                      <Text style={styles.achName}>{a.name}</Text>
                      {a.verified && <Ionicons name="checkmark-circle" size={14} color="#3D5AF1" />}
                    </View>
                    <Text style={styles.achMeta}>{a.jnv} · {a.year} · {a.time}</Text>
                  </View>
                  <View style={[styles.catPill, { backgroundColor: cc + "18" }]}>
                    <Text style={[styles.catText, { color: cc }]}>{a.category}</Text>
                  </View>
                </View>
                <Text style={styles.achTitle}>{a.title}</Text>
                <Text style={styles.achDesc}>{a.description}</Text>
                <View style={styles.achFooter}>
                  <TouchableOpacity style={styles.likeBtn} onPress={() => toggleLike(a.id)}>
                    <Ionicons name={a.liked ? "heart" : "heart-outline"} size={16} color={a.liked ? "#EF4444" : "#9CA3AF"} />
                    <Text style={[styles.likeCount, a.liked && { color: "#EF4444" }]}>{a.likes}</Text>
                  </TouchableOpacity>
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
              <TouchableOpacity style={styles.confirmBtn} onPress={shareAchievement}>
                <Ionicons name="trophy-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Share Achievement</Text>
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
