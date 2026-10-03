import React, { useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type PublicUserProfile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  alumni: "Alumni",
  teacher: "Teacher",
  official: "JNV Official",
};

function getInitials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile: currentUser } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const [user, setUser] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const isOwnProfile = !!user && user.id === currentUser?.uid;

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setError("User profile not found.");
      setLoading(false);
      return;
    }
    api.users.get(userId)
      .then((result) => { if (!cancelled) setUser(result); })
      .catch(() => { if (!cancelled) setError("Unable to load this profile."); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      {loading ? (
        <View style={styles.state}><ActivityIndicator color="#3D5AF1" /></View>
      ) : !user ? (
        <View style={styles.state}>
          <Text style={styles.stateText}>{error || "User profile not found."}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
          <View style={styles.profileCard}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(user.fullName || "N")}</Text></View>
            )}
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.fullName}</Text>
              <VerifiedBadge status={user.verificationStatus} role={user.role} size="sm" />
            </View>
            <Text style={styles.role}>{ROLE_LABELS[user.role] || user.role}</Text>
            <View style={styles.schoolRow}>
              <Ionicons name="school-outline" size={16} color="#6B7280" />
              <Text style={styles.schoolText}>{user.jnvName}{user.jnvState ? ` · ${user.jnvState}` : ""}</Text>
            </View>
            {(user.profession || user.subject || user.designation) ? (
              <Text style={styles.detail}>{user.profession || user.designation || user.subject}{user.company ? ` · ${user.company}` : ""}</Text>
            ) : null}
            {user.class ? <Text style={styles.detail}>{user.class}</Text> : null}
            {user.passoutYear ? <Text style={styles.detail}>Batch {user.passoutYear}</Text> : null}
            {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
          </View>

          {!isOwnProfile ? (
            <TouchableOpacity
              style={styles.reportAction}
              onPress={() => router.push({ pathname: "/(screens)/report-user", params: { userId: user.id } })}
              activeOpacity={0.75}
            >
              <Ionicons name="flag-outline" size={17} color="#6B7280" />
              <Text style={styles.reportText}>Report</Text>
            </TouchableOpacity>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  stateText: { color: "#6B7280", fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  profileCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 22, borderWidth: 1, borderColor: "#F0F0F0" },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarImage: { width: 76, height: 76, borderRadius: 38, marginBottom: 12 },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" },
  name: { color: "#111827", fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  role: { marginTop: 4, color: "#6B7280", fontSize: 14, fontFamily: "Inter_500Medium" },
  schoolRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  schoolText: { color: "#4B5563", fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  detail: { marginTop: 7, color: "#6B7280", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  bio: { marginTop: 14, color: "#4B5563", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, textAlign: "center" },
  reportAction: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, alignSelf: "center", marginTop: 14, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  reportText: { color: "#4B5563", fontSize: 13, fontFamily: "Inter_500Medium" },
});