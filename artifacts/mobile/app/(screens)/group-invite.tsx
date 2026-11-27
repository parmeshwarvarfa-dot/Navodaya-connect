import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { ThemedText as Text } from "@/components/ThemedNative";

export default function GroupInviteScreen() {
  const params = useLocalSearchParams<{ token?: string | string[] }>();
  const token = Array.isArray(params.token) ? params.token[0] : params.token;
  const { profile } = useAuth();
  const [error, setError] = useState("");
  const [joining, setJoining] = useState(false);

  const joinGroup = () => {
    if (!token) return;
    setError("");
    setJoining(true);
    api.groups.joinByInvite(token)
      .then((group) => router.replace({ pathname: "/(screens)/group-chat", params: { id: group.id, name: group.name } }))
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not join this group"))
      .finally(() => setJoining(false));
  };

  useEffect(() => {
    if (profile && token) joinGroup();
  }, [profile, token]);

  const authParams = token ? `?groupInvite=${encodeURIComponent(token)}` : "";
  return <View style={styles.page}>
    <View style={styles.card}>
      <Text style={styles.icon}>👥</Text>
      <Text style={styles.title}>{!token ? "Invalid invite link" : profile ? (joining ? "Joining group…" : "Could not join group") : "Join a group"}</Text>
      <Text style={styles.message}>{error || (!token ? "This invite link is missing its code." : profile ? "Please try again later." : "Sign in or create an account to join this group." )}</Text>
      {joining && <ActivityIndicator color="#7C3AED" style={{ marginTop: 18 }} />}
      {!profile && token && <>
        <TouchableOpacity style={styles.primary} onPress={() => router.push(`/(auth)/sign-in${authParams}` as any)}><Text style={styles.primaryText}>Sign in</Text></TouchableOpacity>
        <TouchableOpacity style={styles.secondary} onPress={() => router.push(`/(auth)/sign-up${authParams}` as any)}><Text style={styles.secondaryText}>Create account</Text></TouchableOpacity>
      </>}
      {!!error && profile && <TouchableOpacity style={styles.primary} onPress={joinGroup}><Text style={styles.primaryText}>Try again</Text></TouchableOpacity>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f3f5fb", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 420, backgroundColor: "#fff", borderRadius: 24, padding: 28, alignItems: "center", shadowColor: "#172554", shadowOpacity: 0.08, shadowRadius: 20, elevation: 4 },
  icon: { fontSize: 44, marginBottom: 12 }, title: { fontSize: 22, fontWeight: "700", color: "#172033", textAlign: "center" },
  message: { fontSize: 15, lineHeight: 22, color: "#667085", textAlign: "center", marginTop: 10, marginBottom: 18 },
  primary: { width: "100%", minHeight: 48, borderRadius: 14, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center", marginTop: 10 }, primaryText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondary: { width: "100%", minHeight: 48, borderRadius: 14, borderWidth: 1, borderColor: "#d9def0", alignItems: "center", justifyContent: "center", marginTop: 10 }, secondaryText: { color: "#344054", fontSize: 16, fontWeight: "600" },
});
