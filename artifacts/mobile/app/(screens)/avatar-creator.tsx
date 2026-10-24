import React, { useMemo, useState } from "react";
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { AVATAR_PRESETS } from "@/components/avatar/avatarConfig";

export default function AvatarCreatorScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { profile, refreshProfile } = useAuth();
  const savedPreset = AVATAR_PRESETS.find((item) => item.id === profile?.avatarConfig?.presetId) ?? AVATAR_PRESETS[0];
  const [selectedId, setSelectedId] = useState(savedPreset.id);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [useAsProfileImage, setUseAsProfileImage] = useState(() =>
    profile?.profileImageType === "avatar" ||
    (!profile?.profileImageType && !profile?.photoURL && !profile?.uploadedPhotoURL),
  );
  const selectedPreset = useMemo(() => AVATAR_PRESETS.find((item) => item.id === selectedId) ?? AVATAR_PRESETS[0], [selectedId]);
  const columns = width >= 520 ? 4 : 3;
  const horizontalPadding = width >= 520 ? 24 : 16;
  const cardWidth = (Math.min(width, 900) - horizontalPadding * 2 - 12 * (columns - 1)) / columns;

  const saveAvatar = async () => {
    setSaving(true);
    setSaveError("");
    try {
      const restoreImageType = profile?.profileImageType === "avatar"
        ? (profile.uploadedPhotoURL ? "photo" : "default")
        : profile?.profileImageType;
      await api.users.updateMe({
        avatarConfig: selectedPreset.config,
        avatarThumbnailURL: selectedPreset.imageUri,
        profileImageType: useAsProfileImage ? "avatar" : restoreImageType,
      });
      await refreshProfile();
      router.back();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Could not save your avatar. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  return <View style={[styles.screen, { paddingTop: insets.top }]}>
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Cancel avatar selection">
        <Ionicons name="arrow-back" size={22} color="#182033" />
      </TouchableOpacity>
      <View style={styles.headerCopy}>
        <Text style={styles.title}>Choose your avatar</Text>
        <Text style={styles.subtitle}>Select one of the illustrated portraits</Text>
      </View>
      <TouchableOpacity onPress={() => { setSelectedId(AVATAR_PRESETS[0].id); setSaveError(""); }} style={styles.resetButton} accessibilityRole="button" accessibilityLabel="Reset selection">
        <Ionicons name="refresh-outline" size={17} color="#3D5AF1" />
        <Text style={styles.resetText}>Reset</Text>
      </TouchableOpacity>
    </View>

    <ScrollView contentContainerStyle={[styles.content, { paddingHorizontal: horizontalPadding, paddingBottom: insets.bottom + 28 }]} keyboardShouldPersistTaps="handled">
      <View style={styles.previewCard}>
        <Image source={{ uri: selectedPreset.imageUri }} style={styles.previewImage} resizeMode="contain" accessibilityLabel={selectedPreset.name} />
        <Text style={styles.previewName}>{selectedPreset.name}</Text>
        <Text style={styles.previewHint}>Your selected portrait</Text>
      </View>

      <View style={styles.sectionHeading}>
        <Text style={styles.sectionTitle}>Choose a portrait</Text>
        <Text style={styles.count}>{AVATAR_PRESETS.length} portraits</Text>
      </View>
      <View style={styles.grid}>
        {AVATAR_PRESETS.map((item) => {
          const selected = selectedId === item.id;
          return <TouchableOpacity
            key={item.id}
            onPress={() => { setSelectedId(item.id); setSaveError(""); }}
            accessibilityRole="button"
            accessibilityLabel={`Select ${item.name}`}
            accessibilityState={{ selected }}
            style={[styles.presetCard, { width: cardWidth }, selected && styles.presetSelected]}
          >
            <Image source={{ uri: item.imageUri }} style={styles.presetImage} resizeMode="contain" accessibilityLabel={item.name} />
            <View style={styles.presetLabelRow}>
              <Text style={[styles.presetName, selected && styles.presetNameSelected]}>{item.name}</Text>
              {selected && <Ionicons name="checkmark-circle" size={16} color="#3D5AF1" />}
            </View>
          </TouchableOpacity>;
        })}
      </View>

      <TouchableOpacity onPress={() => setUseAsProfileImage((value) => !value)} style={styles.useAvatarRow} accessibilityRole="checkbox" accessibilityState={{ checked: useAsProfileImage }}>
        <View style={[styles.checkbox, useAsProfileImage && styles.checkboxChecked]}>{useAsProfileImage && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
        <View style={{ flex: 1 }}>
          <Text style={styles.useAvatarTitle}>Use this avatar as my profile image</Text>
          <Text style={styles.useAvatarDesc}>Your saved profile photo stays available.</Text>
        </View>
      </TouchableOpacity>

      {saveError ? <View style={styles.errorBox}><Ionicons name="alert-circle-outline" size={18} color="#B42318" /><Text style={styles.errorText}>{saveError}</Text></View> : null}
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => router.back()} style={styles.cancelButton}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity onPress={saveAvatar} disabled={saving} style={[styles.saveButton, saving && styles.disabledButton]}>
          {saving ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="checkmark-circle-outline" size={19} color="#fff" />}
          <Text style={styles.saveText}>{saving ? "Saving…" : "Save Avatar"}</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { minHeight: 70, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E7E9EF" },
  backButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F1F3F8", alignItems: "center", justifyContent: "center" },
  headerCopy: { flex: 1, minWidth: 0, marginLeft: 9 },
  title: { fontSize: 17, fontWeight: "800", color: "#182033" },
  subtitle: { marginTop: 2, color: "#748097", fontSize: 10 },
  resetButton: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 8 },
  resetText: { color: "#3D5AF1", fontWeight: "700", fontSize: 11 },
  content: { paddingTop: 14, gap: 14, alignSelf: "center", width: "100%", maxWidth: 900 },
  previewCard: { width: "100%", backgroundColor: "#fff", borderRadius: 22, borderWidth: 1, borderColor: "#E8EAF1", padding: 12, alignItems: "center" },
  previewImage: { width: "100%", height: 300, borderRadius: 17, backgroundColor: "#EAE7FF" },
  previewName: { color: "#1B2440", fontWeight: "800", fontSize: 16, marginTop: 8 },
  previewHint: { color: "#8992A4", fontSize: 12, marginTop: 2 },
  sectionHeading: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  sectionTitle: { fontSize: 17, fontWeight: "800", color: "#182033" },
  count: { color: "#758097", fontSize: 12, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, justifyContent: "flex-start" },
  presetCard: { borderRadius: 15, padding: 5, backgroundColor: "#fff", borderWidth: 1.5, borderColor: "#ECEEF3", alignItems: "center", overflow: "hidden" },
  presetSelected: { borderColor: "#3D5AF1", backgroundColor: "#F3F5FF" },
  presetImage: { width: "100%", aspectRatio: 0.72, backgroundColor: "#EAE7FF", borderRadius: 10 },
  presetLabelRow: { minHeight: 28, width: "100%", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 3 },
  presetName: { color: "#58647B", fontSize: 10, fontWeight: "700" },
  presetNameSelected: { color: "#3D5AF1" },
  useAvatarRow: { flexDirection: "row", gap: 11, alignItems: "center", backgroundColor: "#fff", borderRadius: 15, padding: 13, borderWidth: 1, borderColor: "#E9EBF1" },
  checkbox: { width: 23, height: 23, borderWidth: 1.5, borderColor: "#A8B0C0", borderRadius: 7, alignItems: "center", justifyContent: "center" },
  checkboxChecked: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  useAvatarTitle: { fontSize: 13, color: "#202A3D", fontWeight: "700" },
  useAvatarDesc: { fontSize: 11, color: "#818BA0", marginTop: 3 },
  errorBox: { flexDirection: "row", gap: 8, alignItems: "center", padding: 12, backgroundColor: "#FFF1F0", borderRadius: 12 },
  errorText: { flex: 1, color: "#8C2E2B", fontSize: 12 },
  actions: { flexDirection: "row", gap: 10 },
  cancelButton: { flex: 1, minHeight: 50, borderRadius: 15, backgroundColor: "#fff", borderColor: "#DDE1EA", borderWidth: 1, alignItems: "center", justifyContent: "center" },
  cancelText: { fontWeight: "700", color: "#576278" },
  saveButton: { flex: 1.3, minHeight: 50, borderRadius: 15, backgroundColor: "#3D5AF1", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" },
  disabledButton: { opacity: 0.55 },
  saveText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
