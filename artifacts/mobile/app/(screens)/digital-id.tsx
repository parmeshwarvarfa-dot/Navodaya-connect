import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Platform, Share } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, type DigitalCredential } from "@/lib/api";

const ROLE_LABEL: Record<string, string> = { student: "Student", alumni: "Alumni", teacher: "Teacher", official: "JNV Official" };

export default function DigitalIdScreen() {
  const insets = useSafeAreaInsets();
  const [credential, setCredential] = useState<DigitalCredential | null>(null);
  const [loading, setLoading] = useState(true);
  const [missingCredential, setMissingCredential] = useState(false);
  const [error, setError] = useState("");

  const loadCredential = async () => {
    setLoading(true);
    setError("");
    setMissingCredential(false);
    try {
      setCredential(await api.verification.myCredential());
    } catch (err) {
      const requestError = err as Error & { status?: number };
      if (requestError.status === 404) setMissingCredential(true);
      else setError(requestError.message || "Your Navodaya Connect ID could not be loaded.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadCredential(); }, []);

  const share = async () => {
    if (!credential) return;
    await Share.share({
      title: "Navodaya Connect Digital ID",
      message: `Navodaya Connect ID: ${credential.credentialId}\n${credential.fullName} · Verified ${ROLE_LABEL[credential.role] || credential.role}\n${credential.jnvName}, ${credential.jnvState}\nVerify: ${credential.publicVerificationUrl}`,
    });
  };

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>Navodaya Digital ID</Text>
      </View>
      {loading ? <ActivityIndicator style={styles.loading} size="large" color="#3D5AF1" /> : error || missingCredential ? (
        <View style={styles.empty}>
          <Ionicons name={missingCredential ? "shield-checkmark-outline" : "cloud-offline-outline"} size={42} color={missingCredential ? "#3D5AF1" : "#9CA3AF"} />
          <Text style={styles.emptyTitle}>{missingCredential ? "Your Digital ID is not available yet" : "Could not load your Digital ID"}</Text>
          <Text style={styles.emptyText}>
            {missingCredential
              ? "Your account does not have an issued Navodaya Connect ID yet. Your verified status is unchanged. Open Verification Center or contact your JNV verification official for help."
              : error}
          </Text>
          {missingCredential ? (
            <TouchableOpacity style={styles.actionButton} onPress={() => router.push("/(screens)/verification-center" as any)}>
              <Text style={styles.actionText}>Open Verification Center</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionButton} onPress={() => void loadCredential()}>
              <Text style={styles.actionText}>Try again</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : credential ? (
        <View style={styles.body}>
          <LinearGradient colors={["#1A3C6E", "#2D5A9E"]} style={styles.card}>
            <View style={styles.brandRow}>
              <View style={styles.brandMark}><Ionicons name="school" size={20} color="#1A3C6E" /></View>
              <View><Text style={styles.brand}>NAVODAYA CONNECT</Text><Text style={styles.brandSub}>Community Credential</Text></View>
              <Ionicons name="shield-checkmark" size={24} color="#A7F3D0" style={{ marginLeft: "auto" }} />
            </View>
            <View style={styles.divider} />
            <Text style={styles.idLabel}>DIGITAL ID</Text>
            <Text selectable style={styles.id}>{credential.credentialId}</Text>
            <View style={styles.details}>
              <View><Text style={styles.detailLabel}>NAME</Text><Text style={styles.detailValue}>{credential.fullName}</Text></View>
              <View><Text style={styles.detailLabel}>VERIFIED ROLE</Text><Text style={styles.detailValue}>{ROLE_LABEL[credential.role] || credential.role}</Text></View>
              <View><Text style={styles.detailLabel}>JAWAHAR NAVODAYA VIDYALAYA</Text><Text style={styles.detailValue}>{credential.jnvName}</Text><Text style={styles.detailSub}>{credential.jnvState}</Text></View>
              <View><Text style={styles.detailLabel}>ISSUED</Text><Text style={styles.detailValue}>{new Date(credential.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</Text></View>
            </View>
            <Text style={styles.disclaimer}>Issued by Navodaya Connect. This is a community credential, not a government or NVS identity card.</Text>
          </LinearGradient>
          <TouchableOpacity style={styles.shareButton} onPress={share}>
            <Ionicons name="share-outline" size={19} color="#fff" /><Text style={styles.shareText}>Share credential details</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push({ pathname: "/verify/[token]" as any, params: { token: credential.publicVerificationUrl.split("/").pop() || "" } })}>
            <Text style={styles.verifyLink}>Open public verification page</Text>
          </TouchableOpacity>
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
  body: { padding: 18, gap: 18 },
  card: { borderRadius: 22, padding: 22, gap: 19, overflow: "hidden" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  brandMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },
  brand: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 0.7 },
  brandSub: { color: "rgba(255,255,255,0.72)", fontFamily: "Inter_400Regular", fontSize: 11, marginTop: 2 },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.22)" },
  idLabel: { color: "rgba(255,255,255,0.68)", fontSize: 10, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, marginBottom: -12 },
  id: { color: "#fff", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  details: { gap: 16 },
  detailLabel: { color: "rgba(255,255,255,0.64)", fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.8, marginBottom: 3 },
  detailValue: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  detailSub: { color: "rgba(255,255,255,0.75)", fontSize: 12, marginTop: 2 },
  disclaimer: { color: "rgba(255,255,255,0.7)", fontSize: 10, lineHeight: 15 },
  shareButton: { minHeight: 48, borderRadius: 14, backgroundColor: "#3D5AF1", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  shareText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  verifyLink: { textAlign: "center", color: "#3D5AF1", fontFamily: "Inter_600SemiBold", fontSize: 13, padding: 8 },
});
