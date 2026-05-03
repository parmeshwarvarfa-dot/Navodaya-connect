import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
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
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out", style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
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
    { icon: "alert-circle-outline" as const, label: "Report a Problem", onPress: () => router.push("/(screens)/community" as any) },
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
          <View style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initials}</Text>
              </View>
            </View>
          </View>
          <Text style={styles.profileName}>{profile.fullName}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleBadgeText}>{roleLabel}</Text>
          </View>
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
  avatarWrap: { marginBottom: 12 },
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
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  roleBadge: {
    backgroundColor: "#EEF2FF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  roleBadgeText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
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
});
