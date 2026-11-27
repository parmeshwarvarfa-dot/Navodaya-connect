import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Platform, RefreshControl, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, type BloodRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { formatDateTimeInput, parseDateTimeInput } from "@/lib/date-formatting";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

export default function AlumniCommunityScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [city, setCity] = useState("");
  const [group, setGroup] = useState("");
  const [modal, setModal] = useState(false);
  const [detail, setDetail] = useState<BloodRequest | null>(null);
  const [toast, setToast] = useState("");
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const top = Platform.OS === "web" ? 8 : insets.top + 8;
  const say = (message: string) => { setToast(message); setTimeout(() => setToast(""), 2600); };

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setRequests(await api.bloodRequests.list({ bloodGroup: group, city }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load blood requests.");
    } finally {
      setLoading(false);
    }
  }, [city, group]);
  useEffect(() => { void load(); }, [load]);

  const submit = async () => {
    const requiredAt = parseDateTimeInput(form.requiredAt);
    if (!requiredAt) {
      say("Enter the required date and time as DD-MM-YYYY HH:mm, for example 28-10-2026 10:00.");
      return;
    }
    setBusy(true);
    try {
      await api.bloodRequests.create({
        bloodGroup: form.bloodGroup || "",
        hospital: form.hospital || "",
        city: form.city || "",
        requiredAt: requiredAt.toISOString(),
        urgency: form.urgency || "normal",
        notes: form.notes || "",
      });
      say("Blood request published");
      setModal(false);
      setForm({});
      await load();
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not save. Check the required fields.");
    } finally {
      setBusy(false);
    }
  };

  const respond = async (request: BloodRequest) => {
    try {
      await api.bloodRequests.respond(request.id, "I can help. Please message me to coordinate.");
      say("Response sent to the request owner");
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not send response");
    }
  };

  const report = async (request: BloodRequest) => {
    try {
      await api.communityReports.submit("blood_request", request.id, "Other");
      say("Report submitted for review");
    } catch (e) {
      say(e instanceof Error ? e.message : "Could not submit report");
    }
  };

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));
  const listing = (request: BloodRequest) => {
    const owner = request.ownerId === profile?.uid;
    return <TouchableOpacity style={styles.card} onPress={() => setDetail(request)} activeOpacity={0.85}>
      <View style={styles.row}>
        <Text style={styles.cardTitle}>{request.bloodGroup} blood needed</Text>
        <View style={styles.badge}><Text style={styles.badgeText}>{request.urgency}</Text></View>
      </View>
      <Text style={styles.muted}>{request.hospital} · {request.city}</Text>
      <Text numberOfLines={2} style={styles.body}>{request.notes || "Contact the request owner to coordinate."}</Text>
      <View style={styles.row}>
        <Text style={styles.muted}>Needed {formatDateTimeInput(request.requiredAt)}</Text>
        <Text style={styles.owner}>{owner ? "Your request" : "View details →"}</Text>
      </View>
    </TouchableOpacity>;
  };

  const activeRequests = requests.filter((request) => request.status === "open");

  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: top }]}>
      <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back"><Ionicons name="arrow-back" size={21} color="#17243A" /></TouchableOpacity>
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>Blood Donation Help</Text>
        <Text style={styles.subtitle}>Find and respond to local blood requests</Text>
      </View>
      <TouchableOpacity style={styles.add} onPress={() => { setForm({}); setModal(true); }} accessibilityLabel="Post a blood request">
        <Ionicons name="add" size={18} color="#fff"/><Text style={styles.addText}>Post</Text>
      </TouchableOpacity>
    </View>

    <View style={styles.filters}>
      <Ionicons name="location-outline" size={18} color="#7C3AED" />
      <TextInput value={city} onChangeText={setCity} placeholder="Filter by city or district" placeholderTextColor="#8792A5" style={styles.input} returnKeyType="search" />
      {city ? <TouchableOpacity onPress={() => setCity("")} accessibilityLabel="Clear city filter"><Ionicons name="close-circle" size={18} color="#8792A5"/></TouchableOpacity> : null}
    </View>

    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groups}>
      {["", ...GROUPS].map((value) => <TouchableOpacity key={value || "all"} onPress={() => setGroup(value)} style={[styles.group, value === group && styles.groupActive]}>
        <Text style={[styles.groupText, value === group && styles.groupTextActive]}>{value || "All groups"}</Text>
      </TouchableOpacity>)}
    </ScrollView>

    <Text style={styles.safety}>Confirm availability and eligibility with a qualified healthcare professional or blood bank. A response is not a guarantee of donation.</Text>

    {loading ? <ActivityIndicator style={{ marginTop: 42 }} color="#7C3AED" /> : error ? <TouchableOpacity onPress={() => void load()} style={styles.empty}>
      <Ionicons name="cloud-offline-outline" size={36} color="#9AA5B5" />
      <Text style={styles.body}>{error}</Text>
      <Text style={styles.owner}>Tap to retry</Text>
    </TouchableOpacity> : <FlatList
      data={activeRequests}
      keyExtractor={(request) => request.id}
      renderItem={({ item }) => listing(item)}
      contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void load()} />}
      ListEmptyComponent={<View style={styles.empty}><Ionicons name="water-outline" size={40} color="#9AA5B5"/><Text style={styles.emptyTitle}>No open blood requests</Text><Text style={styles.muted}>New requests in your selected area will appear here.</Text></View>}
    />}

    <Modal visible={modal} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setModal(false)}>
      <ScrollView style={styles.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.modalTitle}>Request blood donation help</Text>
        <Text style={styles.label}>Required blood group *</Text>
        <View style={styles.groupsWrap}>{GROUPS.map((value) => <TouchableOpacity key={value} onPress={() => set("bloodGroup", value)} style={[styles.group, form.bloodGroup === value && styles.groupActive]}><Text style={[styles.groupText, form.bloodGroup === value && styles.groupTextActive]}>{value}</Text></TouchableOpacity>)}</View>
        <Field label="Hospital *" value={form.hospital} onChange={(value) => set("hospital", value)} />
        <Field label="City/service area *" value={form.city} onChange={(value) => set("city", value)} />
        <Field label="Needed at *" value={form.requiredAt} onChange={(value) => set("requiredAt", value)} placeholder="DD-MM-YYYY HH:mm" />
        <Field label="Context (avoid sensitive patient details)" value={form.notes} onChange={(value) => set("notes", value)} multiline />
        <Text style={styles.safety}>Do not include a patient’s private contact details or exact home address. Donor eligibility and compatibility must be confirmed with healthcare professionals.</Text>
        <TouchableOpacity disabled={busy} onPress={() => void submit()} style={styles.submit}>{busy ? <ActivityIndicator color="#fff"/> : <Text style={styles.submitText}>Publish request</Text>}</TouchableOpacity>
        <TouchableOpacity onPress={() => setModal(false)} style={styles.cancel}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
      </ScrollView>
    </Modal>

    <Modal visible={!!detail} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
      <View style={styles.scrim}><View style={styles.detail}>
        <TouchableOpacity style={styles.close} onPress={() => setDetail(null)}><Ionicons name="close" size={22} color="#17243A"/></TouchableOpacity>
        {detail ? <>
          <Text style={styles.modalTitle}>{detail.bloodGroup} donation request</Text>
          <Text style={styles.muted}>{detail.hospital} · {detail.city} · {detail.urgency}</Text>
          <Text style={styles.body}>{detail.notes || "Contact the request owner to coordinate."}{"\n\n"}Needed: {formatDateTimeInput(detail.requiredAt)}</Text>
          {detail.ownerId !== profile?.uid ? <TouchableOpacity style={styles.submit} onPress={() => void respond(detail)}><Text style={styles.submitText}>Offer to help</Text></TouchableOpacity> : detail.status === "open" ? <TouchableOpacity style={styles.submit} onPress={async () => { try { await api.bloodRequests.update(detail.id, "fulfilled"); setDetail(null); await load(); say("Request marked fulfilled"); } catch (e) { say(e instanceof Error ? e.message : "Could not update the request"); } }}><Text style={styles.submitText}>Mark fulfilled</Text></TouchableOpacity> : null}
          {detail.ownerId !== profile?.uid ? <TouchableOpacity style={styles.cancel} onPress={() => void report(detail)}><Text style={styles.cancelText}>Report request</Text></TouchableOpacity> : null}
        </> : null}
      </View></View>
    </Modal>

    {toast ? <View style={[styles.toast, { bottom: 100 + insets.bottom }]}><Text style={styles.toastText}>{toast}</Text></View> : null}
  </View>;
}

function Field({ label, value, onChange, placeholder, multiline }: { label: string; value?: string; onChange: (value: string) => void; placeholder?: string; multiline?: boolean }) {
  return <View style={{ marginTop: 14 }}><Text style={styles.label}>{label}</Text><TextInput value={value || ""} onChangeText={onChange} placeholder={placeholder} multiline={multiline} style={[styles.field, multiline && { minHeight: 80, textAlignVertical: "top" }]} /></View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingBottom: 13, backgroundColor: "#fff" },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F1F3F7", alignItems: "center", justifyContent: "center" },
  title: { color: "#17243A", fontSize: 18, fontFamily: "Inter_700Bold" },
  subtitle: { color: "#8792A5", fontSize: 11, marginTop: 2, fontFamily: "Inter_400Regular" },
  add: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#7C3AED", borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  addText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 12 },
  filters: { flexDirection: "row", alignItems: "center", gap: 9, margin: 12, paddingHorizontal: 13, minHeight: 46, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E8EF", borderRadius: 12 },
  input: { flex: 1, color: "#17243A", fontSize: 14, paddingVertical: 8 },
  groups: { paddingHorizontal: 12, paddingBottom: 10, gap: 6 },
  group: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E3E7EE" },
  groupActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  groupText: { color: "#526078", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  groupTextActive: { color: "#fff" },
  groupsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  safety: { color: "#8A5A12", backgroundColor: "#FFF4E5", borderRadius: 10, padding: 10, marginHorizontal: 14, marginBottom: 8, fontSize: 11, lineHeight: 16 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 15, marginBottom: 11, borderWidth: 1, borderColor: "#E9ECF2", gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { flex: 1, fontSize: 16, color: "#17243A", fontFamily: "Inter_700Bold" },
  badge: { backgroundColor: "#F5F3FF", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 },
  badgeText: { color: "#7C3AED", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  muted: { color: "#8290A4", fontSize: 12, fontFamily: "Inter_400Regular" },
  body: { color: "#45536A", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  owner: { color: "#7C3AED", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  empty: { alignItems: "center", justifyContent: "center", padding: 36, gap: 12 },
  emptyTitle: { color: "#17243A", fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  modal: { flex: 1, padding: 20, backgroundColor: "#fff" },
  modalTitle: { color: "#17243A", fontSize: 20, fontFamily: "Inter_700Bold", marginBottom: 8 },
  label: { color: "#344158", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  field: { marginTop: 6, borderWidth: 1, borderColor: "#E2E6ED", borderRadius: 10, padding: 11, color: "#17243A", minHeight: 42 },
  submit: { marginTop: 20, minHeight: 46, borderRadius: 11, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  submitText: { color: "#fff", fontFamily: "Inter_700Bold" },
  cancel: { marginTop: 10, minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { color: "#66748A", fontFamily: "Inter_600SemiBold" },
  scrim: { flex: 1, backgroundColor: "rgba(15,23,42,0.45)", justifyContent: "center", padding: 18 },
  detail: { backgroundColor: "#fff", borderRadius: 18, padding: 20, gap: 10 },
  close: { alignSelf: "flex-end" },
  toast: { position: "absolute", left: 18, right: 18, backgroundColor: "#1B2943", padding: 12, borderRadius: 12 },
  toastText: { color: "#fff", textAlign: "center", fontFamily: "Inter_500Medium" },
});