import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform,
  TextInput, Modal, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const SUPPORT_TYPES = [
  { label: "Sponsor an Event",      icon: "calendar-outline"   as const, color: "#3D5AF1", bg: "#EEF2FF", desc: "Co-sponsor school events, sports days, science fairs"     },
  { label: "Donate Books",          icon: "book-outline"       as const, color: "#10B981", bg: "#ECFDF5", desc: "Contribute books, study material, lab equipment"           },
  { label: "Scholarship Fund",      icon: "school-outline"     as const, color: "#8B5CF6", bg: "#F5F3FF", desc: "Support student scholarships and exam preparation funds"   },
  { label: "Mentorship Program",    icon: "people-outline"     as const, color: "#F59E0B", bg: "#FFFBEB", desc: "Fund mentorship sessions, webinars, career guidance events" },
  { label: "Infrastructure",        icon: "construct-outline"  as const, color: "#0891B2", bg: "#E0F2FE", desc: "Support computer lab, library, or sports facility upgrade"  },
  { label: "Other Contribution",    icon: "heart-outline"      as const, color: "#EC4899", bg: "#FDF2F8", desc: "Any other contribution for your JNV school"                },
];

const RECENT_CONTRIBUTIONS = [
  { name: "Rahul Verma",       jnv: "JNV Lucknow", type: "Scholarship Fund",   amount: "₹10,000", status: "approved", date: "3 May 2026",  impact: "Funded 2 students' NTSE prep"   },
  { name: "Dr. Meera Iyer",    jnv: "JNV Kochi",   type: "Mentorship Program", amount: "Time",    status: "approved", date: "28 Apr 2026", impact: "6 mentorship sessions completed" },
  { name: "Kavita Singh",      jnv: "JNV Patna",   type: "Donate Books",       amount: "25 Books",status: "pending",  date: "5 May 2026",  impact: "Pending coordinator approval"   },
  { name: "Arjun Sharma",      jnv: "JNV Jaipur",  type: "Sponsor an Event",   amount: "₹5,000",  status: "approved", date: "20 Apr 2026", impact: "Annual Science Fair 2026"       },
];

const STATUS_CFG: Record<string, { color: string; bg: string }> = {
  approved: { color: "#10B981", bg: "#ECFDF5" },
  pending:  { color: "#F59E0B", bg: "#FFFBEB" },
  rejected: { color: "#EF4444", bg: "#FEF2F2" },
};

export default function AlumniSupportScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [showModal, setShowModal] = useState(false);
  const [selType,   setSelType]   = useState("");
  const [note,      setNote]      = useState("");
  const [toast,     setToast]     = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const handleSubmit = () => {
    if (!selType) return;
    setShowModal(false);
    showToast("Contribution request submitted! School coordinator will review and reach out.");
    setSelType(""); setNote("");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Support Your JNV ❤️</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>

        {/* Hero */}
        <View style={styles.heroCard}>
          <Text style={styles.heroEmoji}>🏫</Text>
          <Text style={styles.heroTitle}>Give Back to Your School</Text>
          <Text style={styles.heroText}>Your JNV gave you everything. Now it's your turn to give back — mentor a junior, sponsor an event, or donate resources. Every contribution matters.</Text>
        </View>

        {/* Support types */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How Would You Like to Help?</Text>
          <View style={styles.typeGrid}>
            {SUPPORT_TYPES.map((t) => (
              <TouchableOpacity key={t.label} style={styles.typeCard} activeOpacity={0.75} onPress={() => { setSelType(t.label); setShowModal(true); }}>
                <View style={[styles.typeIcon, { backgroundColor: t.bg }]}>
                  <Ionicons name={t.icon} size={26} color={t.color} />
                </View>
                <Text style={styles.typeLabel}>{t.label}</Text>
                <Text style={styles.typeDesc}>{t.desc}</Text>
                <View style={[styles.contributeBtn, { backgroundColor: t.color }]}>
                  <Text style={styles.contributeBtnText}>Contribute</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Total contributions banner */}
        <View style={styles.impactBanner}>
          <View style={styles.impactItem}>
            <Text style={styles.impactVal}>142</Text>
            <Text style={styles.impactLabel}>Alumni Contributed</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactItem}>
            <Text style={styles.impactVal}>89</Text>
            <Text style={styles.impactLabel}>Students Helped</Text>
          </View>
          <View style={styles.impactDivider} />
          <View style={styles.impactItem}>
            <Text style={styles.impactVal}>₹3.2L</Text>
            <Text style={styles.impactLabel}>Total Raised</Text>
          </View>
        </View>

        {/* Recent contributions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Contributions</Text>
          {RECENT_CONTRIBUTIONS.map((c, i) => {
            const cfg = STATUS_CFG[c.status];
            return (
              <View key={i} style={styles.contribCard}>
                <View style={styles.contribTop}>
                  <View style={styles.contribAvatar}><Text style={styles.contribAvatarText}>{c.name[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <View style={styles.contribNameRow}>
                      <Text style={styles.contribName}>{c.name}</Text>
                      <Ionicons name="checkmark-circle" size={13} color="#3D5AF1" />
                    </View>
                    <Text style={styles.contribJnv}>{c.jnv} · {c.date}</Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{c.status.charAt(0).toUpperCase() + c.status.slice(1)}</Text>
                  </View>
                </View>
                <View style={styles.contribDetails}>
                  <View style={styles.contribDetailItem}>
                    <Text style={styles.contribDetailLabel}>Type</Text>
                    <Text style={styles.contribDetailVal}>{c.type}</Text>
                  </View>
                  <View style={styles.contribDetailItem}>
                    <Text style={styles.contribDetailLabel}>Contribution</Text>
                    <Text style={[styles.contribDetailVal, { color: "#10B981" }]}>{c.amount}</Text>
                  </View>
                  <View style={styles.contribDetailItem}>
                    <Text style={styles.contribDetailLabel}>Impact</Text>
                    <Text style={styles.contribDetailVal}>{c.impact}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Transparency note */}
        <View style={styles.transparencyNote}>
          <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
          <Text style={styles.transparencyText}>All contributions are reviewed and approved by school coordinators. We maintain full transparency records. No direct monetary transactions through this app.</Text>
        </View>
      </ScrollView>

      {/* Contribution Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="formSheet">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{selType}</Text>
              <TouchableOpacity onPress={() => setShowModal(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
            </View>
            <View style={styles.modalBody}>
              <View style={styles.coordinatorNote}>
                <Ionicons name="information-circle-outline" size={16} color="#3D5AF1" />
                <Text style={styles.coordinatorNoteText}>Your request will be reviewed by the school coordinator before proceeding. No payment is processed in the app.</Text>
              </View>
              <Text style={styles.fieldLabel}>Additional Note (optional)</Text>
              <TextInput style={[styles.input, { minHeight: 100 }]} placeholder="Describe your contribution, availability, or any specific details…" placeholderTextColor="#9CA3AF" value={note} onChangeText={setNote} multiline textAlignVertical="top" />
              <TouchableOpacity style={styles.confirmBtn} onPress={handleSubmit}>
                <Ionicons name="heart-outline" size={18} color="#fff" />
                <Text style={styles.confirmBtnText}>Submit Contribution Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  heroCard: { margin: 16, backgroundColor: "#fff", borderRadius: 18, padding: 20, borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", gap: 8 },
  heroEmoji: { fontSize: 40 },
  heroTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center" },
  heroText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 20, textAlign: "center" },
  section: { paddingHorizontal: 16, marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  typeCard: { width: "47%", backgroundColor: "#fff", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", gap: 7 },
  typeIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  typeLabel: { fontSize: 13, fontFamily: "Inter_700Bold", color: "#111827" },
  typeDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", lineHeight: 15 },
  contributeBtn: { borderRadius: 10, paddingVertical: 7, alignItems: "center", marginTop: 4 },
  contributeBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  impactBanner: { flexDirection: "row", alignItems: "center", backgroundColor: "#10B981", marginHorizontal: 16, borderRadius: 18, padding: 18, marginBottom: 20 },
  impactItem: { flex: 1, alignItems: "center" },
  impactVal: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#fff" },
  impactLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.8)", textAlign: "center" },
  impactDivider: { width: 1, height: 40, backgroundColor: "rgba(255,255,255,0.3)" },
  contribCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  contribTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  contribAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  contribAvatarText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#10B981" },
  contribNameRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  contribName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  contribJnv: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  statusPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  statusText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  contribDetails: { flexDirection: "row", gap: 12, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10 },
  contribDetailItem: { flex: 1 },
  contribDetailLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 2 },
  contribDetailVal: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151" },
  transparencyNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#ECFDF5", marginHorizontal: 16, marginBottom: 10, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#A7F3D0" },
  transparencyText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#065F46", lineHeight: 18 },
  modal: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  coordinatorNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginBottom: 20 },
  coordinatorNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#3730A3", lineHeight: 18 },
  fieldLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10 },
  input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 20 },
  confirmBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 15 },
  confirmBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
