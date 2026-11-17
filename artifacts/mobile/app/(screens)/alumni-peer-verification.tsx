import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View, Alert, TextInput, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";

type Peer = { id: string; fullName: string; photoURL: string | null; passoutYear: string | null; enrollYear: string | null; status: string; response: string | null };
type InboxItem = { id: string; userId: string; fullName: string; photoURL: string | null; passoutYear: string | null; enrollYear: string | null; createdAt: string; decision: string | null };
type ModerationCase = { id: string; status: string; createdAt: string | null };
type PendingResponse = { item: InboxItem; decision: "confirmed" | "declined" };

export default function AlumniPeerVerificationScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [status, setStatus] = useState("unverified");
  const [request, setRequest] = useState<{ id: string; status: string; createdAt: string } | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [cases, setCases] = useState<ModerationCase[]>([]);
  const [appealDrafts, setAppealDrafts] = useState<Record<string, string>>({});
  const [tab, setTab] = useState<"inbox" | "peers">("inbox");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [pendingResponse, setPendingResponse] = useState<PendingResponse | null>(null);
  const [responseError, setResponseError] = useState("");
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const load = useCallback(async () => {
    setError("");
    try {
      const [state, peerData, inboxData] = await Promise.all([
        api.alumniVerification.status(), api.alumniVerification.peers(), api.alumniVerification.inbox(),
      ]);
      setStatus(state.verificationStatus);
      setRequest(state.request);
      setCases(state.moderationCases ?? []);
      setPeers(peerData.peers);
      setInbox(inboxData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load alumni verification.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startRequest = async () => {
    setBusyId("request");
    try {
      const data = await api.alumniVerification.request();
      setRequest(data.request as any);
      Alert.alert("Request sent", peers.length ? "Alumni from your JNV can now review your request." : "No other alumni are registered at this JNV yet. Your request is ready when one joins.");
      await load();
    } catch (e) { Alert.alert("Could not send request", e instanceof Error ? e.message : "Try again."); }
    finally { setBusyId(""); }
  };

  const respond = async (item: InboxItem, decision: "confirmed" | "declined") => {
    setResponseError("");
    setPendingResponse({ item, decision });
  };

  const confirmResponse = async () => {
    if (!pendingResponse) return;
    setBusyId(pendingResponse.item.id);
    setResponseError("");
    try {
      await api.alumniVerification.respond(pendingResponse.item.id, pendingResponse.decision);
      setPendingResponse(null);
      await load();
    } catch (e) {
      setResponseError(e instanceof Error ? e.message : "Could not record the response. Refresh and try again.");
    } finally {
      setBusyId("");
    }
  };

  const submitAppeal = async (caseId: string) => {
    const reason = appealDrafts[caseId]?.trim() ?? "";
    if (reason.length < 10) { Alert.alert("Add more detail", "Please enter at least 10 characters explaining your appeal."); return; }
    setBusyId(caseId);
    try { await api.alumniVerification.appeal(caseId, reason); Alert.alert("Appeal submitted", "A JNV moderator will review your appeal."); await load(); }
    catch (e) { Alert.alert("Could not submit appeal", e instanceof Error ? e.message : "Try again."); }
    finally { setBusyId(""); }
  };

  if (profile?.role !== "alumni") return <View style={styles.center}><Text style={styles.body}>Alumni verification is available to alumni accounts.</Text></View>;

  const label = status === "community_verified" ? "Community verified" : status === "legacy_approval_peer_required" ? "Peer confirmation needed" : status === "under_review" ? "Under moderator review" : status === "suspended" ? "Verification suspended" : status === "revoked" ? "Verification revoked" : "Not yet community verified";
  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: topPad + 10 }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back"><Ionicons name="arrow-back" size={23} color="#15233B" /></TouchableOpacity>
      <View style={{ flex: 1 }}><Text style={styles.title}>Alumni verification</Text><Text style={styles.subtitle}>{profile.jnvName} · {profile.jnvState}</Text></View>
      <TouchableOpacity onPress={() => { setLoading(true); void load(); }} style={styles.refresh}><Ionicons name="refresh" size={20} color="#7C3AED" /></TouchableOpacity>
    </View>
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 + insets.bottom }}>
      <View style={styles.statusCard}>
        <View style={styles.statusHeading}><Ionicons name="people-outline" size={22} color="#7C3AED" /><Text style={styles.statusTitle}>{label}</Text></View>
        <Text style={styles.body}>{status === "community_verified" ? "Another alumnus from your JNV confirmed your alumni status. This is community confirmation, not school certification." : status === "legacy_approval_peer_required" ? "Your previous school approval is preserved as history. Confirm your alumni status with one peer to use alumni community features." : status === "under_review" ? "A moderator is reviewing a report. You can still use account support and submit an appeal." : "One alumnus from your JNV must confirm you. The confirmer may also be unverified."}</Text>
        <VerifiedBadge role="alumni" status={status === "legacy_approval_peer_required" ? "verified" : status} size="md" />
        {status !== "community_verified" && status !== "under_review" && status !== "suspended" && status !== "revoked" && <TouchableOpacity style={styles.primary} onPress={() => void startRequest()} disabled={busyId === "request"}>
          {busyId === "request" ? <ActivityIndicator color="white" /> : <><Ionicons name="paper-plane-outline" size={18} color="white" /><Text style={styles.primaryText}>{request ? "Refresh my request" : "Request peer confirmation"}</Text></>}
        </TouchableOpacity>}
      </View>
      <View style={styles.tabs}>
        <TouchableOpacity style={[styles.tab, tab === "inbox" && styles.tabSelected]} onPress={() => setTab("inbox")}><Text style={[styles.tabText, tab === "inbox" && styles.tabTextSelected]}>Requests for me ({inbox.length})</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.tab, tab === "peers" && styles.tabSelected]} onPress={() => setTab("peers")}><Text style={[styles.tabText, tab === "peers" && styles.tabTextSelected]}>JNV alumni ({peers.length})</Text></TouchableOpacity>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color="#7C3AED" /><Text style={styles.muted}>Loading peer requests…</Text></View> : error ? <View style={styles.empty}><Ionicons name="cloud-offline-outline" size={32} color="#8A94A8" /><Text style={styles.statusTitle}>Could not load this section</Text><Text style={styles.body}>{error}</Text><TouchableOpacity style={styles.retry} onPress={() => { setLoading(true); void load(); }}><Text style={styles.retryText}>Retry</Text></TouchableOpacity></View> : tab === "inbox" ? (
        inbox.length ? inbox.map((item) => <View key={item.id} style={styles.personCard}><Person item={item} />{item.decision ? <Text style={styles.muted}>You {item.decision} this request.</Text> : <><Text style={styles.reason}>Confirm only if you reasonably believe this person attended your JNV.</Text><View style={styles.actions}><TouchableOpacity style={styles.confirm} onPress={() => void respond(item, "confirmed")} disabled={!!busyId}>{busyId === item.id ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>Confirm</Text>}</TouchableOpacity><TouchableOpacity style={styles.decline} onPress={() => void respond(item, "declined")} disabled={!!busyId}><Text style={styles.declineText}>Decline</Text></TouchableOpacity></View></>}</View>) : <Empty icon="mail-open-outline" title="No requests yet" text="When alumni from your JNV request confirmation, their requests will appear here." />
      ) : peers.length ? peers.map((peer) => <View key={peer.id} style={styles.personCard}><Person item={peer} /><View style={styles.peerStatus}><VerifiedBadge role="alumni" status={peer.status} size="sm" /><TouchableOpacity onPress={() => router.push({ pathname: "/(screens)/report-user" as any, params: { userId: peer.id } })}><Text style={styles.report}>Report</Text></TouchableOpacity></View>{peer.response && <Text style={styles.muted}>You {peer.response} this request.</Text>}</View>) : <Empty icon="people-outline" title="No other alumni from this JNV yet" text="Your request will stay available. Alumni can confirm each other when they join." />}
      {cases.length > 0 && <View style={{ marginTop: 16, gap: 10 }}><Text style={styles.sectionTitle}>Moderation and appeals</Text>{cases.map((item) => <View key={item.id} style={styles.personCard}><Text style={styles.personName}>Case {item.id.slice(0, 8)}</Text><Text style={styles.muted}>Status: {item.status.replaceAll("_", " ")}</Text><TextInput multiline value={appealDrafts[item.id] ?? ""} onChangeText={(value) => setAppealDrafts((old) => ({ ...old, [item.id]: value }))} placeholder="Explain why you are appealing" style={styles.appealInput} accessibilityLabel="Appeal reason"/><TouchableOpacity style={styles.confirm} onPress={() => void submitAppeal(item.id)} disabled={!!busyId}>{busyId === item.id ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>Submit appeal</Text>}</TouchableOpacity></View>)}</View>}
      <Text style={styles.footer}>Community confirmation is based on a peer's judgment. It is not an official JNV certificate.</Text>
    </ScrollView>
    <Modal visible={!!pendingResponse} transparent animationType="fade" onRequestClose={() => { if (!busyId) setPendingResponse(null); }}>
      <View style={styles.modalOverlay}>
        <View style={styles.confirmModal}>
          <Text style={styles.statusTitle}>{pendingResponse?.decision === "confirmed" ? "Confirm alumni request?" : "Decline alumni request?"}</Text>
          <Text style={styles.body}>{pendingResponse?.decision === "confirmed" ? "Confirm only if you reasonably believe this person attended your JNV. Your confirmation will verify their alumni community status." : "This response will be recorded for this request."}</Text>
          {responseError ? <Text style={styles.responseError}>{responseError}</Text> : null}
          <View style={styles.actions}>
            <TouchableOpacity style={styles.decline} onPress={() => { setPendingResponse(null); setResponseError(""); }} disabled={!!busyId}>
              <Text style={styles.declineText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirm} onPress={() => void confirmResponse()} disabled={!!busyId}>
              {busyId ? <ActivityIndicator color="white" /> : <Text style={styles.confirmText}>{pendingResponse?.decision === "confirmed" ? "Confirm" : "Decline"}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </View>;
}

function Person({ item }: { item: { fullName: string; photoURL: string | null; passoutYear: string | null; enrollYear: string | null } }) {
  return <View style={styles.person}><View style={styles.avatar}>{item.photoURL ? <Image source={{ uri: item.photoURL }} style={styles.photo} /> : <Ionicons name="person" size={20} color="#63718A" />}</View><View style={{ flex: 1 }}><Text style={styles.personName}>{item.fullName}</Text><Text style={styles.muted}>{item.passoutYear ? `Batch ${item.passoutYear}` : item.enrollYear ? `Enrolled ${item.enrollYear}` : "Alumnus of your JNV"}</Text></View></View>;
}
function Empty({ icon, title, text }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }) { return <View style={styles.empty}><Ionicons name={icon} size={34} color="#98A2B3" /><Text style={styles.statusTitle}>{title}</Text><Text style={styles.body}>{text}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F7FF" }, header: { minHeight: 72, backgroundColor: "white", borderBottomWidth: 1, borderColor: "#E9D5FF", paddingHorizontal: 16, paddingBottom: 10, flexDirection: "row", alignItems: "center", gap: 12 }, back: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F1F3F7", alignItems: "center", justifyContent: "center" }, refresh: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" }, title: { fontSize: 20, color: "#172033", fontFamily: "Inter_700Bold" }, subtitle: { marginTop: 2, fontSize: 13, color: "#718096", fontFamily: "Inter_400Regular" }, statusCard: { backgroundColor: "white", borderRadius: 20, borderWidth: 1, borderColor: "#E9D5FF", padding: 18, gap: 12 }, statusHeading: { flexDirection: "row", gap: 9, alignItems: "center" }, statusTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#172033", alignSelf: "flex-start" }, sectionTitle: { fontSize: 17, color: "#172033", fontFamily: "Inter_700Bold" }, body: { fontSize: 14, lineHeight: 21, color: "#667085", fontFamily: "Inter_400Regular" }, primary: { marginTop: 3, height: 48, borderRadius: 14, backgroundColor: "#7C3AED", flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center" }, primaryText: { color: "white", fontSize: 15, fontFamily: "Inter_600SemiBold" }, tabs: { flexDirection: "row", backgroundColor: "white", borderRadius: 14, padding: 4, marginTop: 18, marginBottom: 12 }, tab: { flex: 1, minHeight: 42, alignItems: "center", justifyContent: "center", borderRadius: 11 }, tabSelected: { backgroundColor: "#F5F3FF" }, tabText: { color: "#718096", fontSize: 13, fontFamily: "Inter_600SemiBold" }, tabTextSelected: { color: "#7C3AED", fontSize: 13, fontFamily: "Inter_600SemiBold" }, personCard: { backgroundColor: "white", borderRadius: 16, borderWidth: 1, borderColor: "#E9D5FF", padding: 14, marginBottom: 10 }, person: { flexDirection: "row", alignItems: "center", gap: 11 }, avatar: { height: 42, width: 42, borderRadius: 21, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", overflow: "hidden" }, photo: { width: 42, height: 42 }, personName: { color: "#172033", fontSize: 15, fontFamily: "Inter_600SemiBold" }, muted: { color: "#8290A5", fontSize: 12, marginTop: 3, fontFamily: "Inter_400Regular" }, reason: { color: "#6B7280", fontSize: 12, marginTop: 12, lineHeight: 18 }, actions: { flexDirection: "row", gap: 9, marginTop: 12 }, confirm: { flex: 1, height: 42, borderRadius: 12, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" }, confirmText: { color: "white", fontSize: 14, fontFamily: "Inter_600SemiBold" }, decline: { minWidth: 90, height: 42, borderRadius: 12, borderWidth: 1, borderColor: "#E9D5FF", alignItems: "center", justifyContent: "center" }, declineText: { color: "#667085", fontSize: 14, fontFamily: "Inter_600SemiBold" }, peerStatus: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 10 }, report: { color: "#B42318", fontSize: 12, fontFamily: "Inter_600SemiBold" }, empty: { minHeight: 185, borderRadius: 18, borderWidth: 1, borderColor: "#E9D5FF", backgroundColor: "white", alignItems: "center", justifyContent: "center", gap: 8, padding: 22 }, retry: { backgroundColor: "#7C3AED", borderRadius: 12, paddingHorizontal: 22, paddingVertical: 11, marginTop: 6 }, retryText: { color: "white", fontFamily: "Inter_600SemiBold" }, center: { alignItems: "center", justifyContent: "center", padding: 28, gap: 8 }, footer: { textAlign: "center", color: "#8993A4", fontSize: 11, lineHeight: 17, paddingHorizontal: 20, paddingTop: 14 }, appealInput: { minHeight: 76, marginTop: 10, borderWidth: 1, borderColor: "#E9D5FF", borderRadius: 12, padding: 10, textAlignVertical: "top", color: "#172033" },
  modalOverlay: { flex: 1, backgroundColor: "rgba(15,23,42,0.42)", alignItems: "center", justifyContent: "center", padding: 24 }, confirmModal: { width: "100%", maxWidth: 420, backgroundColor: "white", borderRadius: 20, padding: 22, gap: 12 }, responseError: { color: "#B42318", backgroundColor: "#FEF3F2", padding: 10, borderRadius: 10, fontSize: 13, lineHeight: 18 },
});
