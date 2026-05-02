import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { RoleBadge } from "@/components/RoleBadge";

const HOUSE_COLORS: Record<string, string> = {
  Aravali: "#EF4444",
  Nilgiri: "#10B981",
  Shivalik: "#F59E0B",
  Udaygiri: "#8B5CF6",
};

export default function ProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, signOut } = useAuth();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          router.replace("/(auth)/sign-in");
        },
      },
    ]);
  };

  if (!profile) return null;

  const houseColor = HOUSE_COLORS[profile.house] || colors.primary;

  const menuItems = [
    {
      icon: "person-outline",
      label: "Edit Profile",
      onPress: () => router.push("/(screens)/edit-profile" as any),
    },
    {
      icon: "trophy-outline",
      label: "Rankings",
      onPress: () => router.push("/(screens)/rankings" as any),
    },
    {
      icon: "calendar-outline",
      label: "Events",
      onPress: () => router.push("/(screens)/events" as any),
    },
    {
      icon: "bag-outline",
      label: "Store",
      onPress: () => router.push("/(screens)/store" as any),
    },
    ...(profile.role === "alumni"
      ? [
          {
            icon: "shield-checkmark-outline",
            label: "Alumni Verification",
            onPress: () => router.push("/(screens)/alumni-verify" as any),
          },
        ]
      : []),
    {
      icon: "globe-outline",
      label: "Community Groups",
      onPress: () => router.push("/(screens)/community" as any),
    },
    {
      icon: "notifications-outline",
      label: "Notifications",
      onPress: () => router.push("/(screens)/notifications" as any),
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profile.fullName?.charAt(0).toUpperCase()}
            </Text>
          </View>
          <Text style={styles.profileName}>{profile.fullName}</Text>
          <View style={styles.badgesRow}>
            <RoleBadge role={profile.role} />
            <View style={[styles.houseBadge, { backgroundColor: houseColor + "30" }]}>
              <View style={[styles.houseDot, { backgroundColor: houseColor }]} />
              <Text style={[styles.houseText, { color: houseColor }]}>
                {profile.house}
              </Text>
            </View>
          </View>
          <Text style={styles.jnvName}>{profile.jnvName}</Text>
          <Text style={styles.jnvState}>{profile.jnvState}</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 100 + insets.bottom },
        ]}
      >
        {profile.role === "alumni" && (
          <PremiumCard style={styles.alumniCard}>
            <View style={styles.alumniRow}>
              <View>
                <Text style={[styles.alumniProfession, { color: colors.foreground }]}>
                  {profile.profession || "Alumni"}
                </Text>
                {profile.company && (
                  <Text style={[styles.alumniCompany, { color: colors.mutedForeground }]}>
                    {profile.company}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.verifyBadge,
                  {
                    backgroundColor:
                      profile.verificationStatus === "verified"
                        ? "#D1FAE5"
                        : profile.verificationStatus === "pending"
                        ? "#FEF3C7"
                        : "#F1F5F9",
                  },
                ]}
              >
                <Ionicons
                  name={
                    profile.verificationStatus === "verified"
                      ? "checkmark-circle"
                      : "time-outline"
                  }
                  size={14}
                  color={
                    profile.verificationStatus === "verified"
                      ? "#059669"
                      : profile.verificationStatus === "pending"
                      ? "#D97706"
                      : "#64748B"
                  }
                />
                <Text
                  style={[
                    styles.verifyText,
                    {
                      color:
                        profile.verificationStatus === "verified"
                          ? "#059669"
                          : profile.verificationStatus === "pending"
                          ? "#D97706"
                          : "#64748B",
                    },
                  ]}
                >
                  {profile.verificationStatus === "verified"
                    ? "Verified"
                    : profile.verificationStatus === "pending"
                    ? "Pending"
                    : "Unverified"}
                </Text>
              </View>
            </View>
            {profile.skills && profile.skills.length > 0 && (
              <View style={styles.skillsRow}>
                {profile.skills.slice(0, 4).map((s) => (
                  <View key={s} style={[styles.skillChip, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.skillText, { color: colors.primary }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </PremiumCard>
        )}

        {profile.role === "student" && profile.class && (
          <PremiumCard style={{ marginBottom: 16 }}>
            <View style={styles.infoRow}>
              <Ionicons name="school-outline" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {profile.class}
              </Text>
            </View>
          </PremiumCard>
        )}

        {profile.role === "teacher" && profile.subject && (
          <PremiumCard style={{ marginBottom: 16 }}>
            <View style={styles.infoRow}>
              <Ionicons name="book-outline" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {profile.subject}
              </Text>
            </View>
          </PremiumCard>
        )}

        {profile.role === "official" && profile.designation && (
          <PremiumCard style={{ marginBottom: 16 }}>
            <View style={styles.infoRow}>
              <Ionicons name="ribbon-outline" size={18} color={colors.primary} />
              <Text style={[styles.infoText, { color: colors.foreground }]}>
                {profile.designation}
              </Text>
            </View>
          </PremiumCard>
        )}

        <PremiumCard noPadding style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.label}
              style={[
                styles.menuItem,
                index < menuItems.length - 1 && {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                },
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={[styles.menuIconBg, { backgroundColor: colors.muted }]}>
                <Ionicons name={item.icon as any} size={18} color={colors.primary} />
              </View>
              <Text style={[styles.menuLabel, { color: colors.foreground }]}>
                {item.label}
              </Text>
              <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          ))}
        </PremiumCard>

        <TouchableOpacity
          style={[
            styles.signOutBtn,
            {
              backgroundColor: colors.card,
              borderColor: colors.destructive,
              borderRadius: colors.radius,
            },
          ]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 28 },
  avatarSection: { alignItems: "center", gap: 8 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  avatarText: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#fff" },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  badgesRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  houseBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
    gap: 4,
  },
  houseDot: { width: 6, height: 6, borderRadius: 3 },
  houseText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  jnvName: {
    color: "rgba(255,255,255,0.9)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  jnvState: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  scrollContent: { padding: 16 },
  alumniCard: { marginBottom: 16 },
  alumniRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  alumniProfession: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginBottom: 2 },
  alumniCompany: { fontSize: 13, fontFamily: "Inter_400Regular" },
  verifyBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  verifyText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  skillText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  menuCard: { marginBottom: 16, overflow: "hidden" },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
