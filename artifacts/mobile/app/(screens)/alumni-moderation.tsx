import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Platform, ScrollView, StyleSheet, TouchableOpacity, View, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type AlumniModerationReport } from "@/lib/api";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type Action = "begin_review" | "suspend" | "revoke" | "complete_review" | "allow_peer_retry";
const ACTIONS: Array<{ id: Action; label: string; color: string }> = [
  { id: "begin_review", label: "Begin review", color: "#7C3AED" },
  { id: "complete_review", label: "Complete review", color: "#079455" },
  { id: "suspend", label: "Suspend access", color: "#B54708" },
  { id: "revoke", label: "Revoke confirmation", color: "#B42318" },
  { id: "allow_peer_retry", label: "Allow peer retry", color: "#6941C6" },
];

export default function AlumniModerationScreen() {
  const insets = useSafeAreaInsets();
  const [rows, setRows] = useState<AlumniModerationReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<AlumniModerationReport | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const load = useCallback(async () => {
    setError("");
    try { setRows(await api.reports.alumniModeration()); }
    catch (e) { setError(e instanceof Error ? e.message : "Could not load moderation cases."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const actionsFor = (item: AlumniModerationReport): Action[] => {
    const status = item.targetStatus ?? "unverified";
    if (["suspended", "revoked"].includes(status)) return ["allow_peer_retry"];
    if (status === "under_review") return item.hasPeerConfirmation ? ["complete_review", "suspend", "revoke"] : ["complete_review"];
    if (status === "community_verified") return ["begin_review", "suspend", "revoke"];
    return ["begin_review"];
  };
  const openAction = (item: AlumniModerationReport, nextAction: Action) => { setSelected(item); setAction(nextAction); setReason(""); };
  const save = async () => {
    if (!selected || !action || reason.trim().length < 6) { Alert.alert("Reason required", "Enter a reason of at least 6 characters for the audit record."); return; }
    setSaving(true);
    try { await api.reports.moderateAlumni(selected.id, action, reason.trim()); setSelected(null); setAction(null); await load(); }
    catch (e) { Alert.alert("Action failed", e instanceof Error ? e.message : "Could not update this case."); }
    finally { setSaving(false); }
  };

  return <View style={styles.page}>
    <View style={[styles.header, { paddingTop: topPad + 10 }]}>
      <TouchableOpacity style={styles.back} onPress={() => router.back()}><Ionicons name="arrow-back" size={22} color="#172033" /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.title}>Alumni reports</Text><Text style={styles.subtitle}>Private safety review · {rows.length} cases</Text></View>
      <TouchableOpacity style={styles.refresh} onPress={() => { setLoading(true); void load(); }}><Ionicons name="refresh" size={19} color="#7C3AED" /></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
      <View style={styles.notice}><Ionicons name="shield-checkmark-outline" size={18} color="#6D28D9" /><Text style={styles.noticeText}>Moderation can investigate, suspend, or revoke peer verification. Moderators cannot grant the alumni badge.</Text></View>
      {loading ? <View style={styles.empty}><ActivityIndicator color="#7C3AED" /><Text style={styles.muted}>Loading reports…</Text></View> : error ? <View style={styles.empty}><Text style={styles.body}>{error}</Text><TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={styles.primary}><Text style={styles.primaryText}>Retry</Text></TouchableOpacity></View> : rows.length === 0 ? <View style={styles.empty}><Ionicons name="checkmark-circle-outline" size={34} color="#12B76A" /><Text style={styles.cardTitle}>No alumni reports</Text><Text style={styles.body}>There are no reports for alumni in this assigned JNV.</Text></View> : rows.map((item) => <View key={item.id} style={styles.card}>
        <View style={styles.cardTop}><View style={{ flex: 1 }}><Text style={styles.cardTitle}>{item.reportedUserName || "Alumni account"}</Text><Text style={styles.muted}>Case {item.id.slice(0, 8)} · {item.status.replaceAll("_", " ")}</Text></View><Text style={styles.badge}>{item.targetStatus?.replaceAll("_", " ") || "unverified"}</Text></View>
        <Text style={styles.reason}>{item.reason}</Text>{item.details ? <Text style={styles.body}>{item.details}</Text> : null}
        <Text style={styles.muted}>Reporter: {item.reporterName || "Account unavailable"} · {item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</Text>
        <View style={styles.actions}>{actionsFor(item).map((id) => { const config = ACTIONS.find((a) => a.id === id)!; return <TouchableOpacity key={id} style={[styles.actionButton, { borderColor: config.color }]} onPress={() => openAction(item, id)}><Text style={[styles.actionText, { color: config.color }]}>{config.label}</Text></TouchableOpacity>; })}</View>
      </View>)}
    </ScrollView>
    <Modal visible={!!action} transparent animationType="fade" onRequestClose={() => setAction(null)}><View style={styles.overlay}><View style={styles.modal}><Text style={styles.cardTitle}>{ACTIONS.find((a) => a.id === action)?.label}</Text><Text style={styles.body}>This decision will be recorded in the private moderation history. A report alone does not change verification status.</Text><TextInput value={reason} onChangeText={setReason} placeholder="Reason for this action" multiline style={styles.input} accessibilityLabel="Moderation reason"/><View style={styles.actions}><TouchableOpacity style={styles.cancel} onPress={() => setAction(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={styles.primary} onPress={() => void save()} disabled={saving}>{saving ? <ActivityIndicator color="white" /> : <Text style={styles.primaryText}>Save decision</Text>}</TouchableOpacity></View></View></View></Modal>
  </View>;
}

const styles = StyleSheet.create({ page: { flex: 1, backgroundColor: "#F8F7FF" }, header: { backgroundColor: "white", minHeight: 74, paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderColor: "#E9D5FF" }, back: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#F1F3F7" }, refresh: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F3FF" }, title: { color: "#172033", fontSize: 20, fontFamily: "Inter_700Bold" }, subtitle: { color: "#718096", fontSize: 12, marginTop: 3 }, notice: { flexDirection: "row", alignItems: "flex-start", gap: 9, padding: 13, backgroundColor: "#F5F3FF", borderRadius: 14, marginBottom: 12 }, noticeText: { flex: 1, color: "#344054", fontSize: 13, lineHeight: 19 }, card: { backgroundColor: "white", borderWidth: 1, borderColor: "#E9D5FF", padding: 15, borderRadius: 16, marginBottom: 10, gap: 8 }, cardTop: { flexDirection: "row", alignItems: "center", gap: 8 }, cardTitle: { color: "#172033", fontSize: 16, fontFamily: "Inter_700Bold" }, muted: { color: "#8290A5", fontSize: 12, marginTop: 3 }, badge: { color: "#475467", backgroundColor: "#F2F4F7", paddingHorizontal: 9, paddingVertical: 5, borderRadius: 20, fontSize: 11, overflow: "hidden" }, reason: { color: "#344054", fontSize: 14, fontFamily: "Inter_600SemiBold" }, body: { color: "#667085", fontSize: 13, lineHeight: 19 }, actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 5 }, actionButton: { borderWidth: 1, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 11 }, actionText: { fontSize: 12, fontFamily: "Inter_600SemiBold" }, empty: { minHeight: 190, justifyContent: "center", alignItems: "center", gap: 10, backgroundColor: "white", borderRadius: 16, padding: 20 }, primary: { minHeight: 42, alignItems: "center", justifyContent: "center", backgroundColor: "#7C3AED", borderRadius: 11, paddingHorizontal: 15, flex: 1 }, primaryText: { color: "white", fontFamily: "Inter_600SemiBold", fontSize: 14 }, overlay: { flex: 1, justifyContent: "center", backgroundColor: "rgba(16,24,40,0.5)", padding: 20 }, modal: { padding: 18, backgroundColor: "white", borderRadius: 18, gap: 12 }, input: { minHeight: 86, borderWidth: 1, borderColor: "#D0D5DD", borderRadius: 12, padding: 11, textAlignVertical: "top", color: "#172033" }, cancel: { minHeight: 42, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 }, cancelText: { color: "#667085", fontFamily: "Inter_600SemiBold" } });
