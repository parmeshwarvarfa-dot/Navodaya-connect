import React, { useState } from "react";
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListBlockedUsersQueryKey,
  useListBlockedUsers,
  useUnblockUser,
  useUpdateProfilePrivacy,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";

export default function PrivacySettingsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const [visibility, setVisibility] = useState<"public" | "private">(profile?.profileVisibility || "public");
  const [toast, setToast] = useState("");
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const blocked = useListBlockedUsers({
    query: { queryKey: getListBlockedUsersQueryKey() },
  });
  const updatePrivacy = useUpdateProfilePrivacy();
  const unblock = useUnblockUser({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListBlockedUsersQueryKey() }),
    },
  });

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2600);
  };

  const selectVisibility = async (next: "public" | "private") => {
    if (next === visibility || updatePrivacy.isPending) return;
    try {
      await updatePrivacy.mutateAsync({ data: { profileVisibility: next } });
      setVisibility(next);
      showToast(next === "private" ? "Your profile is now private." : "Your profile is now public.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update profile privacy.");
    }
  };

  const handleUnblock = async (id: string, name: string) => {
    try {
      await unblock.mutateAsync({ id });
      showToast(`${name} was unblocked.`);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not unblock this profile.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Privacy & requests</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.bottom + 36 }}>
        <Text style={styles.sectionHeading}>Profile visibility</Text>
        <Text style={styles.intro}>Choose who can see your profile details and Memories. Your name and JNV affiliation remain visible so Navodayans can find the right profile.</Text>
        {([
          { value: "public" as const, title: "Public profile", detail: "Anyone can view your profile and public Memories.", icon: "globe-outline" as const },
          { value: "private" as const, title: "Private profile", detail: "Only approved followers can view your details and follower-only Memories.", icon: "lock-closed-outline" as const },
        ]).map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[styles.choice, visibility === option.value && styles.choiceSelected]}
            onPress={() => selectVisibility(option.value)}
            disabled={updatePrivacy.isPending}
            activeOpacity={0.75}
          >
            <View style={[styles.choiceIcon, visibility === option.value && styles.choiceIconSelected]}>
              <Ionicons name={option.icon} size={19} color={visibility === option.value ? "#fff" : "#6B7280"} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.choiceTitle}>{option.title}</Text>
              <Text style={styles.choiceDetail}>{option.detail}</Text>
            </View>
            {updatePrivacy.isPending && visibility !== option.value
              ? <ActivityIndicator size="small" color="#3D5AF1" />
              : <Ionicons name={visibility === option.value ? "radio-button-on" : "radio-button-off"} size={20} color={visibility === option.value ? "#3D5AF1" : "#9CA3AF"} />
            }
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.inboxLink} onPress={() => router.push("/(screens)/social-inbox" as any)}>
          <View style={styles.inboxIcon}><Ionicons name="mail-unread-outline" size={20} color="#3D5AF1" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.inboxTitle}>Social inbox</Text>
            <Text style={styles.inboxDetail}>Review follow and message requests, and manage direct conversations.</Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
        </TouchableOpacity>

        <View style={styles.blockedSection}>
          <Text style={styles.sectionHeading}>Blocked profiles</Text>
          {blocked.isLoading ? (
            <ActivityIndicator color="#3D5AF1" style={{ paddingVertical: 18 }} />
          ) : blocked.isError ? (
            <Text style={styles.empty}>Blocked profiles couldn’t be loaded. Try again later.</Text>
          ) : !blocked.data?.length ? (
            <Text style={styles.empty}>You haven’t blocked anyone.</Text>
          ) : blocked.data.map((person) => (
            <View key={person.id} style={styles.blockedRow}>
              <View style={styles.personAvatar}>
                <Text style={styles.personInitial}>{person.fullName?.slice(0, 1).toUpperCase() || "?"}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.personName}>{person.fullName}</Text>
                {person.jnvName ? <Text style={styles.personSchool}>{person.jnvName}</Text> : null}
              </View>
              <TouchableOpacity
                style={styles.unblockButton}
                onPress={() => handleUnblock(person.id, person.fullName)}
                disabled={unblock.isPending}
              >
                <Text style={styles.unblockText}>{unblock.isPending ? "…" : "Unblock"}</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      </ScrollView>
      {toast ? <View style={[styles.toast, { top: topPad + 58 }]} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  sectionHeading: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 7 },
  intro: { color: "#6B7280", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 13 },
  choice: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#E5E7EB", padding: 13, marginBottom: 9 },
  choiceSelected: { borderColor: "#9C8AFF", backgroundColor: "#FBFAFF" },
  choiceIcon: { width: 38, height: 38, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  choiceIconSelected: { backgroundColor: "#3D5AF1" },
  choiceTitle: { color: "#111827", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  choiceDetail: { color: "#6B7280", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 3 },
  inboxLink: { flexDirection: "row", alignItems: "center", gap: 11, padding: 14, marginTop: 12, backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#F0F0F0" },
  inboxIcon: { width: 38, height: 38, borderRadius: 13, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  inboxTitle: { color: "#111827", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  inboxDetail: { color: "#6B7280", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 3 },
  blockedSection: { marginTop: 24 },
  empty: { color: "#7B8492", backgroundColor: "#fff", borderRadius: 12, padding: 14, fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  blockedRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, marginBottom: 8, backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  personAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  personInitial: { color: "#3D5AF1", fontSize: 16, fontFamily: "Inter_700Bold" },
  personName: { color: "#111827", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  personSchool: { color: "#7B8492", fontSize: 11, marginTop: 3 },
  unblockButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 9, borderWidth: 1, borderColor: "#D1D5DB" },
  unblockText: { color: "#4B5563", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  toast: { position: "absolute", left: 20, right: 20, padding: 12, borderRadius: 12, backgroundColor: "#1F2937" },
  toastText: { color: "#fff", fontSize: 13, textAlign: "center", fontFamily: "Inter_500Medium" },
});
