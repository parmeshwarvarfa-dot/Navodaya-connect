import React, { useState, useEffect } from "react";
import {
  View, StyleSheet, ScrollView, TouchableOpacity, Platform,
  Modal, KeyboardAvoidingView, Image, ActivityIndicator, Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { Achievement } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatPublishDateTime } from "@/lib/date-formatting";
import ImageAdjustmentModal from "@/components/media/ImageAdjustmentModal";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const CATEGORIES = ["All", "Placement", "College Admission", "UPSC/Gov", "Startup", "Research", "Sports", "Award", "Career", "Other"];
const CAT_COLOR: Record<string, string> = {
  "Placement": "#10B981", "College Admission": "#7C3AED", "UPSC/Gov": "#8B5CF6",
  "Startup": "#F59E0B", "Research": "#0891B2", "Sports": "#EC4899", "Award": "#D97706",
  "Career": "#7C3AED", "Other": "#6B7280",
};

const FEATURED = [
  { name: "Kavita Singh",   achievement: "UPSC AIR 47",   category: "UPSC/Gov",         detail: "IAS Officer · 2012 Batch", emoji: "🎖️", jnv: "JNV Patna"   },
  { name: "Rahul Verma",    achievement: "Google SWE",     category: "Placement",         detail: "Engineer · 2018",          emoji: "🏆", jnv: "JNV Lucknow" },
  { name: "Dr. Meera Iyer", achievement: "AIIMS Delhi",    category: "College Admission", detail: "MBBS, AIIMS · 2015",       emoji: "⭐", jnv: "JNV Kochi"   },
];

export default function AlumniAchievementsScreen() {
  const insets   = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad   = Platform.OS === "web" ? 0 : insets.top;
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [activeFilter, setActiveFilter] = useState("All");
  const [showShare,    setShowShare]    = useState(false);
  const [shareTitle,   setShareTitle]   = useState("");
  const [shareDesc,    setShareDesc]    = useState("");
  const [shareCat,     setShareCat]     = useState("Placement");
  const [toast,        setToast]        = useState("");
  const [submitting,   setSubmitting]   = useState(false);
  const [sharePhoto, setSharePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [photoToAdjust, setPhotoToAdjust] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [adjustmentVisible, setAdjustmentVisible] = useState(false);
  const [shareError, setShareError] = useState("");
  const [editingAchievement, setEditingAchievement] = useState<Achievement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const openNewAchievement = () => {
    setEditingAchievement(null);
    setShareTitle(""); setShareDesc(""); setShareCat("Placement"); setSharePhoto(null); setShareError("");
    setShowShare(true);
  };

  const openEditAchievement = (achievement: Achievement) => {
    setEditingAchievement(achievement);
    setShareTitle(achievement.title); setShareDesc(achievement.description); setShareCat(achievement.category);
    setSharePhoto(null); setShareError(""); setShowShare(true);
  };

  const closeShareForm = () => {
    if (submitting) return;
    setShowShare(false); setEditingAchievement(null); setSharePhoto(null); setShareError("");
  };

  useEffect(() => {
    api.achievements.list().then(setAchievements).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const choosePhoto = async (camera = false) => {
    setShareError("");
    try {
      if (Platform.OS !== "web") {
        const permission = camera
          ? await ImagePicker.requestCameraPermissionsAsync()
          : await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          setShareError(camera ? "Allow camera access to take a photo." : "Allow photo library access to choose a photo.");
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ["images"], quality: 0.85, allowsMultipleSelection: false };
      const result = camera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets?.[0]) return;
      const photo = result.assets[0];
      if ((photo.fileSize ?? 0) > 10 * 1024 * 1024) {
        setShareError("Choose a photo under 10 MB.");
        return;
      }
      setPhotoToAdjust(photo);
      setAdjustmentVisible(true);
    } catch {
      setShareError("The photo could not be opened. Please try again.");
    }
  };

  const shareAchievement = async () => {
    if (submitting) return;
    setShareError("");
    if (!shareTitle.trim() || !shareDesc.trim()) {
      setShareError("Add an achievement title and your story before sharing.");
      return;
    }
    setSubmitting(true);
    let imageKey: string | undefined;
    try {
      if (sharePhoto) {
        const uploaded = await api.achievements.uploadImage(sharePhoto.uri, sharePhoto.fileName || "achievement-photo.jpg", sharePhoto.mimeType);
        imageKey = uploaded.key;
      }
      const row = editingAchievement
        ? await api.achievements.update(editingAchievement.id, { title: shareTitle.trim(), description: shareDesc.trim(), category: shareCat, imageKey })
        : await api.achievements.create({ title: shareTitle.trim(), description: shareDesc.trim(), category: shareCat, imageKey });
      setAchievements((items) => editingAchievement
        ? items.map((item) => item.id === row.id ? row : item)
        : [row, ...items]);
      setShareTitle(""); setShareDesc(""); setSharePhoto(null); setShareCat("Placement"); setEditingAchievement(null); setActiveFilter("All"); setShowShare(false);
      showToast(editingAchievement ? "Achievement updated." : "Achievement shared! Inspiring the community 🎉");
    } catch (e: any) {
      if (imageKey) {
        try { await api.achievements.cleanupImage(imageKey); } catch { /* Referenced uploads cannot be removed. */ }
      }
      setShareError(e?.message || "Failed to share. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const deleteAchievement = async (achievement: Achievement) => {
    if (deletingId) return;
    setDeletingId(achievement.id);
    try {
      await api.achievements.delete(achievement.id);
      setAchievements((items) => items.filter((item) => item.id !== achievement.id));
      showToast("Achievement deleted.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete this achievement.");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDeleteAchievement = (achievement: Achievement) => {
    Alert.alert("Delete achievement?", "This will permanently remove your achievement post.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => void deleteAchievement(achievement) },
    ]);
  };

  const filtered = activeFilter === "All" ? achievements : achievements.filter((a) => a.category === activeFilter);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Achievements & Milestones</Text>
        <TouchableOpacity style={styles.addBtn} onPress={openNewAchievement}>
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
                    <Text style={styles.achMeta}>{a.jnvName || "JNV"}{a.batch ? ` · ${a.batch} batch` : ""} · {formatPublishDateTime(a.createdAt)}</Text>
                  </View>
                  <View style={[styles.catPill, { backgroundColor: cc + "18" }]}>
                    <Text style={[styles.catText, { color: cc }]}>{a.category}</Text>
                  </View>
                  {a.authorId === profile?.uid ? (
                    <View style={styles.achievementOwnerActions}>
                      <TouchableOpacity style={styles.cardAction} onPress={() => openEditAchievement(a)} disabled={!!deletingId || submitting} accessibilityRole="button" accessibilityLabel={`Edit ${a.title}`}>
                        <Ionicons name="create-outline" size={16} color="#5B4BC4" />
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.cardAction, styles.deleteCardAction]} onPress={() => confirmDeleteAchievement(a)} disabled={!!deletingId || submitting} accessibilityRole="button" accessibilityLabel={`Delete ${a.title}`}>
                        {deletingId === a.id ? <ActivityIndicator size="small" color="#B42318" /> : <Ionicons name="trash-outline" size={16} color="#B42318" />}
                      </TouchableOpacity>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.achTitle}>{a.title}</Text>
                <Text style={styles.achDesc}>{a.description}</Text>
                {a.imageUrl ? <Image source={{ uri: a.imageUrl }} style={styles.achievementImage} resizeMode="contain" accessibilityLabel={`Photo for ${a.title}`} /> : null}
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

      <Modal visible={showShare} animationType="slide" presentationStyle="formSheet" onRequestClose={closeShareForm}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingAchievement ? "Edit Your Achievement" : "Share Your Achievement"}</Text>
              <TouchableOpacity disabled={submitting} onPress={closeShareForm} accessibilityLabel="Close achievement form"><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Category *</Text>
              <View style={styles.categoryOptions}>
                {CATEGORIES.filter((c) => c !== "All").map((c) => {
                  const cc = CAT_COLOR[c] || "#6B7280";
                  return (
                    <TouchableOpacity key={c} disabled={submitting} style={[styles.pill, shareCat === c && { borderColor: cc, backgroundColor: cc + "10" }]} onPress={() => setShareCat(c)}>
                      <Text style={[styles.pillText, shareCat === c && { color: cc }]}>{c}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <Text style={styles.fieldLabel}>Achievement Title *</Text>
              <TextInput style={styles.input} placeholder="e.g. Cleared UPSC AIR 47" placeholderTextColor="#9CA3AF" value={shareTitle} onChangeText={setShareTitle} editable={!submitting} />
              <Text style={styles.fieldLabel}>Your Story *</Text>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Share your journey — inspire your JNV juniors!" placeholderTextColor="#9CA3AF" value={shareDesc} onChangeText={setShareDesc} multiline textAlignVertical="top" editable={!submitting} />
              <Text style={styles.fieldLabel}>Photo (optional)</Text>
              {sharePhoto ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: sharePhoto.uri }} style={styles.previewImage} resizeMode="contain" accessibilityLabel="Selected achievement photo" />
                  <TouchableOpacity style={styles.removePhoto} disabled={submitting} onPress={() => setSharePhoto(null)} accessibilityLabel="Remove selected photo">
                    <Ionicons name="close-circle" size={28} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : editingAchievement?.imageUrl ? (
                <View style={styles.photoPreview}>
                  <Image source={{ uri: editingAchievement.imageUrl }} style={styles.previewImage} resizeMode="contain" accessibilityLabel="Current achievement photo" />
                  <View style={styles.currentPhotoLabel}><Text style={styles.currentPhotoText}>Current photo · choose another to replace</Text></View>
                </View>
              ) : null}
              <View style={styles.photoActions}>
                <TouchableOpacity style={styles.photoButton} disabled={submitting} onPress={() => choosePhoto()} accessibilityRole="button">
                  <Ionicons name="image-outline" size={20} color="#8B5CF6" />
                  <Text style={styles.photoButtonText}>{sharePhoto ? "Change photo" : "Choose photo"}</Text>
                </TouchableOpacity>
                {Platform.OS !== "web" ? <TouchableOpacity style={styles.photoButton} disabled={submitting} onPress={() => choosePhoto(true)} accessibilityRole="button">
                  <Ionicons name="camera-outline" size={20} color="#8B5CF6" />
                  <Text style={styles.photoButtonText}>Take photo</Text>
                </TouchableOpacity> : null}
              </View>
              <Text style={styles.photoHint}>{editingAchievement ? "Choose a new photo to replace the current one (optional)." : "Add one photo up to 10 MB to celebrate your achievement."}</Text>
              {shareError ? <Text style={styles.formError} accessibilityRole="alert">{shareError}</Text> : null}
              <TouchableOpacity style={[styles.confirmBtn, submitting && { opacity: 0.6 }]} onPress={shareAchievement} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="trophy-outline" size={18} color="#fff" />}
                <Text style={styles.confirmBtnText}>{submitting ? (editingAchievement ? "Saving…" : "Sharing…") : (editingAchievement ? "Save changes" : "Share Achievement")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <ImageAdjustmentModal
        visible={adjustmentVisible}
        asset={photoToAdjust}
        title="Adjust achievement photo"
        defaultAspect="original"
        onCancel={() => {
          setAdjustmentVisible(false);
          setPhotoToAdjust(null);
        }}
        onDone={(asset) => {
          setSharePhoto(asset);
          setAdjustmentVisible(false);
          setPhotoToAdjust(null);
        }}
      />

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
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
  achievementOwnerActions: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: -3 },
  cardAction: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F0FF" },
  deleteCardAction: { backgroundColor: "#FFF1F0" },
  catPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  achTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  achDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 19, marginBottom: 12 },
  achievementImage: { width: "100%", height: 230, borderRadius: 12, backgroundColor: "#F8F7FF", marginBottom: 12 },
  achFooter: { flexDirection: "row", alignItems: "center", gap: 16, paddingTop: 10, borderTopWidth: 1, borderTopColor: "#F0F0F0" },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeCount: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  inspireBtnWrap: { marginLeft: "auto" },
  inspireBtn: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20, paddingBottom: 40 },
  categoryOptions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 },
  photoPreview: { borderRadius: 12, overflow: "hidden", backgroundColor: "#F8F7FF", marginBottom: 12 },
  previewImage: { width: "100%", height: 200 },
  currentPhotoLabel: { position: "absolute", bottom: 0, left: 0, right: 0, paddingVertical: 7, paddingHorizontal: 10, backgroundColor: "rgba(17,24,39,0.6)" },
  currentPhotoText: { color: "#fff", fontSize: 11, fontFamily: "Inter_500Medium", textAlign: "center" },
  removePhoto: { position: "absolute", top: 8, right: 8, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 18, padding: 3 },
  photoActions: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  photoButton: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#DDD6FE", borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#F5F3FF" },
  photoButtonText: { color: "#8B5CF6", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  photoHint: { color: "#6B7280", fontFamily: "Inter_400Regular", fontSize: 12, marginTop: 8, marginBottom: 18 },
  formError: { color: "#B91C1C", fontFamily: "Inter_500Medium", fontSize: 13, marginBottom: 14 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 6 },
  pill: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB" },
  pillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#8B5CF6", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
