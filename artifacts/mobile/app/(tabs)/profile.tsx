import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Image,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  alumni: "Alumni",
  teacher: "Teacher",
  official: "JNV Official",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const handleSignOut = () => setShowSignOutModal(true);

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setShowSignOutModal(false);
    }
  };

  if (!profile) return null;

  const initials = getInitials(profile.fullName || "N");
  const roleLabel = ROLE_LABEL[profile.role] || profile.role;

  const infoItems = [
    { icon: "mail-outline" as const, label: "Email", value: profile.email || "—" },
    { icon: "location-outline" as const, label: "JNV Location", value: profile.jnvName || "—" },
    ...(profile.role === "student" && profile.class
      ? [{ icon: "school-outline" as const, label: "Class", value: profile.class }]
      : []),
    ...(profile.house
      ? [{ icon: "ribbon-outline" as const, label: "House", value: profile.house }]
      : []),
    ...(profile.role === "alumni" && profile.passoutYear
      ? [{ icon: "calendar-outline" as const, label: "Batch", value: profile.passoutYear }]
      : []),
    ...(profile.role === "alumni" && profile.profession
      ? [{ icon: "briefcase-outline" as const, label: "Profession", value: profile.profession }]
      : []),
    ...(profile.role === "teacher" && profile.subject
      ? [{ icon: "book-outline" as const, label: "Subject", value: profile.subject }]
      : []),
    ...(profile.jnvState
      ? [{ icon: "map-outline" as const, label: "State", value: profile.jnvState }]
      : []),
  ];

  const menuItems = [
    { icon: "person-outline" as const, label: "Edit Profile", onPress: () => router.push("/(screens)/edit-profile" as any) },
    { icon: "notifications-outline" as const, label: "Notifications", onPress: () => router.push("/(screens)/notifications" as any) },
    { icon: "chatbubbles-outline" as const, label: "Chat Groups", onPress: () => router.push("/(tabs)/chats" as any) },
    ...(profile.role !== "student"
      ? [{ icon: "newspaper-outline" as const, label: "News & Announcements", onPress: () => router.push("/(screens)/news" as any) }]
      : []),
    { icon: "alert-circle-outline" as const, label: "Report a Problem", onPress: () => router.push("/(screens)/report-problem" as any) },
    { icon: "trophy-outline" as const, label: "Rankings", onPress: () => router.push("/(screens)/rankings" as any) },
    ...(profile.role === "alumni"
      ? [{ icon: "shield-checkmark-outline" as const, label: "Alumni Verification", onPress: () => router.push("/(screens)/alumni-verify" as any) }]
      : []),
  ];

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <TouchableOpacity onPress={() => router.push("/(screens)/edit-profile" as any)}>
          <Ionicons name="create-outline" size={22} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom, paddingHorizontal: 16 }}
      >
        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => router.push("/(screens)/edit-profile" as any)}
            activeOpacity={0.85}
          >
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatarPhoto} />
            ) : (
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>
            )}
            <View style={styles.editPhotoBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{profile.fullName}</Text>
          {(profile as any).bio ? (
            <Text style={styles.profileBio} numberOfLines={2}>{(profile as any).bio}</Text>
          ) : null}
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
          {((profile as any).linkedinUrl || (profile as any).twitterUrl) && (
            <View style={styles.socialRow}>
              {(profile as any).linkedinUrl && (
                <View style={styles.socialPill}>
                  <Ionicons name="logo-linkedin" size={14} color="#0077B5" />
                  <Text style={styles.socialPillText}>LinkedIn</Text>
                </View>
              )}
              {(profile as any).twitterUrl && (
                <View style={styles.socialPill}>
                  <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
                  <Text style={styles.socialPillText}>Twitter</Text>
                </View>
              )}
            </View>
          )}
        </View>

        <View style={styles.infoCard}>
          {infoItems.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.infoRow,
                index < infoItems.length - 1 && styles.infoRowBorder,
              ]}
            >
              <View style={styles.infoIconWrap}>
                <Ionicons name={item.icon} size={18} color="#3D5AF1" />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            </View>
          ))}
        </View>

        {profile.skills && profile.skills.length > 0 && (
          <View style={styles.skillsCard}>
            <Text style={styles.cardTitle}>Skills</Text>
            <View style={styles.skillsWrap}>
              {profile.skills.map((s) => (
                <View key={s} style={styles.skillChip}>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <View style={styles.aboutCard}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.aboutText}>
            {profile.role === "student"
              ? `${roleLabel} at ${profile.jnvName || "JNV"}`
              : profile.role === "alumni"
              ? `${profile.profession || "Alumni"} · ${profile.jnvName || "JNV"} Graduate`
              : profile.role === "teacher"
              ? `${profile.subject || "Teacher"} at ${profile.jnvName || "JNV"}`
              : `JNV Official at ${profile.jnvName || "JNV"}`}
          </Text>
        </View>

        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[styles.menuRow, index < menuItems.length - 1 && styles.menuRowBorder]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconWrap}>
                <Ionicons name={item.icon} size={18} color="#3D5AF1" />
              </View>
              <Text style={styles.menuLabel}>{item.label}</Text>
              <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalMessage}>Are you sure you want to sign out of Navodaya Connect?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowSignOutModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmSignOut}
                activeOpacity={0.8}
                disabled={signingOut}
              >
                <Text style={styles.modalConfirmText}>{signingOut ? "Signing out…" : "Sign Out"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  profileCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 16,
    paddingVertical: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  avatarWrap: { marginBottom: 12, position: "relative" },
  avatarPhoto: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: "#3D5AF1",
  },
  avatarRing: {
    width: 96, height: 96, borderRadius: 48,
    borderWidth: 3, borderColor: "#3D5AF1",
    alignItems: "center", justifyContent: "center",
  },
  avatar: {
    width: 84, height: 84, borderRadius: 42,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 30, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  editPhotoBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: "#3D5AF1", borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },
  profileBio: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280",
    textAlign: "center", marginHorizontal: 24, marginBottom: 8, lineHeight: 19,
  },
  roleBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
    marginTop: 4,
  },
  roleBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  socialRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  socialPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F3F4F6", borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#E5E7EB",
  },
  socialPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151" },
  infoCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  infoIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  skillsCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  skillsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: {
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  skillText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  aboutCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  aboutText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 22 },
  menuCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "#F0F0F0",
    overflow: "hidden",
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F5F5F5" },
  menuIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#111827" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#EF4444",
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  modalMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#374151" },
  modalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  modalConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
});
