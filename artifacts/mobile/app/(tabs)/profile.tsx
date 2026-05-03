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
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const STAT_ITEMS = [
  { label: "Connections", value: "342", icon: "people" },
  { label: "Events", value: "8", icon: "calendar" },
  { label: "Posts", value: "24", icon: "newspaper" },
];

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

  const initials = getInitials(profile.fullName || "N");

  const menuGroups = [
    {
      title: "Account",
      items: [
        {
          icon: "person-outline",
          label: "Edit Profile",
          description: "Update your photo and details",
          onPress: () => router.push("/(screens)/edit-profile" as any),
        },
        ...(profile.role === "alumni"
          ? [
              {
                icon: "shield-checkmark-outline",
                label: "Alumni Verification",
                description: "Get your alumni badge",
                onPress: () => router.push("/(screens)/alumni-verify" as any),
              },
            ]
          : []),
        {
          icon: "notifications-outline",
          label: "Notifications",
          description: "Manage your alerts",
          onPress: () => router.push("/(screens)/notifications" as any),
        },
      ],
    },
    {
      title: "Community",
      items: [
        {
          icon: "chatbubbles-outline",
          label: "Groups",
          description: "Study & interest groups",
          onPress: () => router.push("/(tabs)/groups" as any),
        },
        {
          icon: "star-outline",
          label: "Mentorship",
          description: "Connect with mentors",
          onPress: () => router.push("/(tabs)/mentorship" as any),
        },
        {
          icon: "trophy-outline",
          label: "Rankings",
          description: "See leaderboards",
          onPress: () => router.push("/(screens)/rankings" as any),
        },
        {
          icon: "newspaper-outline",
          label: "News & Announcements",
          description: "Latest updates",
          onPress: () => router.push("/(screens)/news" as any),
        },
      ],
    },
    {
      title: "Problems & Support",
      items: [
        {
          icon: "alert-circle-outline",
          label: "Report a Problem",
          description: "Flag issues at your JNV",
          onPress: () => router.push("/(tabs)/problems" as any),
        },
        {
          icon: "globe-outline",
          label: "Community Forum",
          description: "Discuss with Navodayans",
          onPress: () => router.push("/(screens)/community" as any),
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.avatarSection}>
          <View style={[styles.avatarRing, { borderColor: colors.saffron }]}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          </View>
          <Text style={styles.profileName}>{profile.fullName}</Text>
          <View style={styles.metaRow}>
            {profile.jnvName && (
              <View style={styles.metaChip}>
                <Ionicons name="school-outline" size={11} color="rgba(255,255,255,0.75)" />
                <Text style={styles.metaChipText}>{profile.jnvName}</Text>
              </View>
            )}
            {profile.role && (
              <View style={[styles.roleChip, { backgroundColor: colors.saffron }]}>
                <Text style={styles.roleChipText}>{profile.role.charAt(0).toUpperCase() + profile.role.slice(1)}</Text>
              </View>
            )}
          </View>
          {(profile.role === "alumni" && profile.profession) && (
            <Text style={styles.professionText}>
              {profile.profession}{profile.company ? ` · ${profile.company}` : ""}
            </Text>
          )}
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
            onPress={() => router.push("/(screens)/edit-profile" as any)}
          >
            <Ionicons name="create-outline" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: colors.saffron }]}
          >
            <Ionicons name="share-social-outline" size={14} color="#fff" />
            <Text style={styles.actionBtnText}>Share</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={[styles.statsRow, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {STAT_ITEMS.map((stat, i) => (
          <View key={stat.label} style={[styles.statItem, i < STAT_ITEMS.length - 1 && { borderRightWidth: 1, borderRightColor: colors.border }]}>
            <Text style={[styles.statValue, { color: colors.saffron }]}>{stat.value}</Text>
            <Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 100 + insets.bottom }]}
      >
        {profile.role === "alumni" && profile.verificationStatus && (
          <View style={[styles.verifyCard, {
            backgroundColor: profile.verificationStatus === "verified" ? "#F0FDF4" : "#FFFBEB",
            borderColor: profile.verificationStatus === "verified" ? "#BBF7D0" : "#FDE68A",
          }]}>
            <Ionicons
              name={profile.verificationStatus === "verified" ? "checkmark-circle" : "time-outline"}
              size={18}
              color={profile.verificationStatus === "verified" ? "#16A34A" : "#D97706"}
            />
            <Text style={[styles.verifyText, {
              color: profile.verificationStatus === "verified" ? "#15803D" : "#92400E",
            }]}>
              {profile.verificationStatus === "verified"
                ? "Alumni Verified — You have a verified badge!"
                : profile.verificationStatus === "pending"
                ? "Verification pending — We're reviewing your details"
                : "Verify your alumni status to unlock all features"}
            </Text>
          </View>
        )}

        {profile.skills && profile.skills.length > 0 && (
          <View style={[styles.skillsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.cardSectionTitle, { color: colors.foreground }]}>Skills</Text>
            <View style={styles.skillsWrap}>
              {profile.skills.map((s) => (
                <View key={s} style={[styles.skillChip, { backgroundColor: colors.saffronLight }]}>
                  <Text style={[styles.skillText, { color: colors.saffron }]}>{s}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {menuGroups.map((group) => (
          <View key={group.title} style={styles.menuGroup}>
            <Text style={[styles.menuGroupTitle, { color: colors.mutedForeground }]}>{group.title.toUpperCase()}</Text>
            <View style={[styles.menuCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              {group.items.map((item, index) => (
                <TouchableOpacity
                  key={item.label}
                  style={[
                    styles.menuItem,
                    index < group.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                  ]}
                  onPress={item.onPress}
                  activeOpacity={0.7}
                >
                  <View style={[styles.menuIconBg, { backgroundColor: colors.primary + "15" }]}>
                    <Ionicons name={item.icon as any} size={18} color={colors.primary} />
                  </View>
                  <View style={styles.menuTextBlock}>
                    <Text style={[styles.menuLabel, { color: colors.foreground }]}>{item.label}</Text>
                    <Text style={[styles.menuDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}

        <TouchableOpacity
          style={[styles.signOutBtn, { borderColor: colors.destructive, backgroundColor: colors.card }]}
          onPress={handleSignOut}
          activeOpacity={0.8}
        >
          <Ionicons name="log-out-outline" size={18} color={colors.destructive} />
          <Text style={[styles.signOutText, { color: colors.destructive }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  avatarSection: { alignItems: "center", gap: 6, marginBottom: 14 },
  avatarRing: { width: 86, height: 86, borderRadius: 43, borderWidth: 3, alignItems: "center", justifyContent: "center", marginBottom: 4 },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 28, fontFamily: "Inter_700Bold", color: "#fff" },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaChipText: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" },
  roleChip: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  roleChipText: { color: "#fff", fontSize: 11, fontFamily: "Inter_700Bold" },
  professionText: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular" },
  headerActions: { flexDirection: "row", gap: 10, justifyContent: "center" },
  actionBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, gap: 5 },
  actionBtnText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  statsRow: { flexDirection: "row", borderBottomWidth: 1 },
  statItem: { flex: 1, paddingVertical: 14, alignItems: "center", gap: 2 },
  statValue: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statLabel: { fontSize: 11, fontFamily: "Inter_400Regular" },
  scrollContent: { padding: 16 },
  verifyCard: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, marginBottom: 14 },
  verifyText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  skillsCard: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 14 },
  cardSectionTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 10 },
  skillsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  skillText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  menuGroup: { marginBottom: 16 },
  menuGroupTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 8, paddingHorizontal: 4 },
  menuCard: { borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  menuItem: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 },
  menuIconBg: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  menuTextBlock: { flex: 1 },
  menuLabel: { fontSize: 14, fontFamily: "Inter_500Medium" },
  menuDesc: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderWidth: 1.5, borderRadius: 12, marginBottom: 8 },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
