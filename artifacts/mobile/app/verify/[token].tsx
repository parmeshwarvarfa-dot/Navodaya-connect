import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api, type PublicCredentialStatus } from "@/lib/api";

export default function PublicCredentialPage() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const [result, setResult] = useState<PublicCredentialStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.verification.checkCredential(token).then(setResult).catch(() => setResult({ status: "not_found" })).finally(() => setLoading(false));
  }, [token]);

  const valid = result?.status === "valid";
  return (
    <View style={styles.screen}>
      <View style={styles.brandMark}><Ionicons name="school" size={26} color="#3D5AF1" /></View>
      <Text style={styles.brand}>NAVODAYA CONNECT</Text>
      <Text style={styles.title}>Credential verification</Text>
      {loading ? <ActivityIndicator size="large" color="#3D5AF1" style={{ marginTop: 24 }} /> : (
        <View style={[styles.card, { borderColor: valid ? "#A7F3D0" : "#FECACA" }]}>
          <Ionicons name={valid ? "shield-checkmark" : "close-circle"} size={38} color={valid ? "#10B981" : "#EF4444"} />
          <Text style={[styles.status, { color: valid ? "#059669" : "#DC2626" }]}>{valid ? "Valid and active" : result?.status === "suspended" ? "Credential suspended" : result?.status === "revoked" ? "Credential revoked" : result?.status === "superseded" ? "Credential superseded" : "Credential not found"}</Text>
          {valid && result && <>
            <Text style={styles.id}>{result.credentialId}</Text>
            <Text style={styles.detail}>{result.role} · {result.jnvName}, {result.jnvState}</Text>
            {result.issuedAt ? <Text style={styles.date}>Issued {new Date(result.issuedAt).toLocaleDateString("en-IN")}</Text> : null}
          </>}
          <Text style={styles.note}>This page verifies a Navodaya Connect community credential. It is not a government or NVS identity document.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F6FA", alignItems: "center", padding: 24, paddingTop: 64 },
  brandMark: { width: 54, height: 54, borderRadius: 16, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  brand: { marginTop: 10, color: "#3D5AF1", fontFamily: "Inter_700Bold", fontSize: 12, letterSpacing: 1 },
  title: { color: "#111827", fontFamily: "Inter_700Bold", fontSize: 21, marginTop: 28 },
  card: { width: "100%", maxWidth: 460, alignItems: "center", gap: 12, padding: 24, marginTop: 26, borderRadius: 18, borderWidth: 1.5, backgroundColor: "#fff" },
  status: { fontFamily: "Inter_700Bold", fontSize: 17 },
  id: { color: "#111827", fontFamily: "Inter_700Bold", fontSize: 18, marginTop: 4 },
  detail: { color: "#4B5563", textAlign: "center", fontSize: 14 },
  date: { color: "#6B7280", fontSize: 12 },
  note: { color: "#8A94A3", fontSize: 11, lineHeight: 16, textAlign: "center", marginTop: 10 },
});
