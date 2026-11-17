import React, { useCallback, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { api, type DigitalCredential } from "@/lib/api";
import DigitalIdCard from "@/components/DigitalIdCard";
import { useAuth } from "@/context/AuthContext";

export default function DigitalIdScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [credential, setCredential] = useState<DigitalCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingCredential, setMissingCredential] = useState(false);
  const [needsVerification, setNeedsVerification] = useState(false);
  const [error, setError] = useState("");

  const loadCredential = useCallback(async () => {
    setLoading(true);
    setError("");
    setMissingCredential(false);
    setNeedsVerification(false);
    try {
      setCredential(await api.verification.myCredential());
    } catch (err) {
      const requestError = err as Error & { status?: number };
      if (requestError.status === 404) setMissingCredential(true);
      else if (requestError.status === 403) setNeedsVerification(true);
      else setError(requestError.message || "Your Navodaya Connect ID could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadCredential(); }, [loadCredential]));

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Navodaya Digital ID</Text>
      </View>
      {loading ? <ActivityIndicator style={styles.loading} size="large" color="#3D5AF1" /> : error || missingCredential || needsVerification ? (
        <View style={styles.empty}>
          <Ionicons name={missingCredential || needsVerification ? "shield-checkmark-outline" : "cloud-offline-outline"} size={42} color={missingCredential || needsVerification ? "#3D5AF1" : "#9CA3AF"} />
          <Text style={styles.emptyTitle}>{needsVerification ? "Verification required" : missingCredential ? "Your Digital ID is not available yet" : "Could not load your Digital ID"}</Text>
          <Text style={styles.emptyText}>
            {needsVerification
              ? profile?.role === "alumni" ? "Your Digital ID appears after a same-JNV alumni peer confirms your community status." : "Your Digital ID appears after your school verification is approved."
              : missingCredential
              ? "No matching approved verification record was found for this account. Your verification status is unchanged. Open the Verification Center to check your approval status."
              : error}
          </Text>
          {missingCredential || needsVerification ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push((profile?.role === "alumni" ? "/(screens)/alumni-peer-verification" : "/(screens)/verification-center") as any)}>
              <Text style={styles.actionText}>{profile?.role === "alumni" ? "Open Alumni Verification" : "Open Verification Center"}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionButton} onPress={() => void loadCredential()}>
              <Text style={styles.actionText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : credential ? (
        <View style={styles.body}>
          <DigitalIdCard credential={credential} />
          <TouchableOpacity style={styles.profileLink} onPress={() => router.push({ pathname: "/(screens)/user-profile" as any, params: { userId: credential.userId } })}>
            <Ionicons name="person-outline" size={17} color="#355BE5" /><Text style={styles.profileLinkText}>View profile</Text>
          </TouchableOpacity>
          {credential.publicVerificationUrl ? <TouchableOpacity onPress={() => router.push({ pathname: "/verify/[token]" as any, params: { token: credential.publicVerificationUrl!.split("/").pop() || "" } })}>
            <Text style={styles.verifyLink}>Open credential verification page</Text>
          </TouchableOpacity> : <Text style={styles.domainHint}>Set PUBLIC_APP_URL on the API to enable public web verification links.</Text>}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  back: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  title: { color: "#111827", fontSize: 18, fontFamily: "Inter_700Bold" },
  loading: { marginTop: 60 },
  empty: { alignItems: "center", gap: 12, padding: 32, marginTop: 70 },
  emptyTitle: { color: "#111827", textAlign: "center", fontSize: 17, fontFamily: "Inter_700Bold" },
  emptyText: { color: "#6B7280", textAlign: "center", fontSize: 14, lineHeight: 21 },
  actionButton: { minHeight: 46, marginTop: 6, paddingHorizontal: 20, borderRadius: 14, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  actionText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  body: { padding: 16, gap: 14, alignItems: "center" },
  profileLink: { minHeight: 44, width: "100%", maxWidth: 560, borderRadius: 13, backgroundColor: "#EEF2FF", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  profileLinkText: { color: "#355BE5", fontFamily: "Inter_600SemiBold", fontSize: 14 },
  verifyLink: { textAlign: "center", color: "#3D5AF1", fontFamily: "Inter_600SemiBold", fontSize: 13, padding: 8 },
  domainHint: { color: "#748198", textAlign: "center", fontFamily: "Inter_400Regular", fontSize: 11, lineHeight: 16 },
});
