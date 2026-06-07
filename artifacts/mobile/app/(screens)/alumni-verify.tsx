import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Platform, TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CURRENT_YEAR = new Date().getFullYear();
const BATCH_YEARS = Array.from({ length: CURRENT_YEAR - 1985 + 1 }, (_, i) => String(CURRENT_YEAR - i));

const DOC_TYPES = [
  { id: "marksheet", label: "Marksheet / TC", icon: "document-text-outline" as const },
  { id: "id_card",   label: "JNV ID Card",     icon: "card-outline"           as const },
  { id: "photo",     label: "Passing Photo",   icon: "image-outline"          as const },
];

export default function AlumniVerifyScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const [status, setStatus] = useState<string>(profile?.verificationStatus ?? "unverified");
  const [passoutBatch, setPassoutBatch] = useState(profile?.passoutYear ?? "");
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [docUrls, setDocUrls] = useState(["", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  useEffect(() => {
    (async () => {
      try {
        const data = await api.verification.myStatus();
        setStatus(data.verificationStatus);
      } catch { /* show whatever is in profile */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleSubmit = async () => {
    if (!passoutBatch) { showToast("Please select your passout batch year"); return; }
    setSubmitting(true);
    try {
      const filledUrls = docUrls.filter(u => u.trim().length > 0);
      await api.verification.create("official", filledUrls.length ? filledUrls : undefined);
      await refreshProfile();
      setStatus("pending");
      showToast("Verification request submitted!");
    } catch (e: any) {
      showToast(e?.message ?? "Failed to submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const isAlreadySubmitted = status === "pending" || status === "verified" || status === "suspended";

  const STATUS_CFG: Record<string, { color: string; bg: string; icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap; label: string; desc: string }> = {
    pending:    { color: "#F59E0B", bg: "#FFFBEB", icon: "time-outline",             label: "Pending Review",  desc: "Your request is awaiting review by a JNV Official." },
    verified:   { color: "#10B981", bg: "#ECFDF5", icon: "checkmark-circle-outline", label: "Verified Alumni", desc: "You are a verified Navodayan alumni." },
    rejected:   { color: "#EF4444", bg: "#FEF2F2", icon: "close-circle-outline",     label: "Rejected",        desc: "Your verification was rejected. You may reapply." },
    suspended:  { color: "#9CA3AF", bg: "#F3F4F6", icon: "ban-outline",              label: "Suspended",       desc: "Your account has been suspended. Contact an official." },
    unverified: { color: "#6B7280", bg: "#F9FAFB", icon: "shield-outline",           label: "Not Verified",    desc: "Complete the form below to apply for verification." },
  };

  const cfg = STATUS_CFG[status] ?? STATUS_CFG.unverified;

  return (
    <View style={s.container}>
      <LinearGradient colors={["#1A3C6E", "#2D5A9E"]} style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Alumni Verification</Text>
            <Text style={s.headerSub}>JNV · {profile?.jnvName}</Text>
          </View>
        </View>
      </LinearGradient>

      {toast ? (
        <View style={s.toast}>
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 40 }}
      >
        {/* Status Card */}
        <View style={[s.statusCard, { borderColor: cfg.color + "40", backgroundColor: cfg.bg }]}>
          <View style={[s.statusIcon, { backgroundColor: cfg.color + "22" }]}>
            <Ionicons name={cfg.icon} size={28} color={cfg.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
            <Text style={s.statusDesc}>{cfg.desc}</Text>
          </View>
        </View>

        {!isAlreadySubmitted && (
          <>
            {/* Passout Batch */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Your Passout Batch *</Text>
              <Text style={s.cardSub}>Select the year you completed Class XII from JNV</Text>
              <TouchableOpacity
                style={s.pickerBtn}
                onPress={() => setShowYearPicker(!showYearPicker)}
                activeOpacity={0.8}
              >
                <Ionicons name="calendar-outline" size={18} color="#3D5AF1" />
                <Text style={[s.pickerBtnText, !passoutBatch && { color: "#9CA3AF" }]}>
                  {passoutBatch || "Select batch year"}
                </Text>
                <Ionicons name={showYearPicker ? "chevron-up" : "chevron-down"} size={16} color="#9CA3AF" />
              </TouchableOpacity>
              {showYearPicker && (
                <View style={s.yearList}>
                  <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled>
                    {BATCH_YEARS.map((y) => (
                      <TouchableOpacity
                        key={y}
                        style={[s.yearItem, passoutBatch === y && s.yearItemSelected]}
                        onPress={() => { setPassoutBatch(y); setShowYearPicker(false); }}
                      >
                        <Text style={[s.yearItemText, passoutBatch === y && s.yearItemTextSelected]}>
                          Batch of {y}
                        </Text>
                        {passoutBatch === y && <Ionicons name="checkmark" size={16} color="#3D5AF1" />}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* Document URLs */}
            <View style={s.card}>
              <Text style={s.cardTitle}>Supporting Documents (optional)</Text>
              <Text style={s.cardSub}>Add links to scanned documents hosted on Google Drive, Dropbox, or any cloud storage</Text>
              {DOC_TYPES.map((doc, idx) => (
                <View key={doc.id} style={s.docRow}>
                  <View style={s.docIcon}>
                    <Ionicons name={doc.icon} size={18} color="#6B7280" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.docLabel}>{doc.label}</Text>
                    <TextInput
                      style={s.docInput}
                      placeholder="Paste document link here..."
                      placeholderTextColor="#D1D5DB"
                      value={docUrls[idx]}
                      onChangeText={(t) => {
                        const next = [...docUrls];
                        next[idx] = t;
                        setDocUrls(next);
                      }}
                      autoCapitalize="none"
                      keyboardType="url"
                    />
                  </View>
                </View>
              ))}
            </View>

            {/* How it works */}
            <View style={s.card}>
              <Text style={s.cardTitle}>How Verification Works</Text>
              {[
                { icon: "send-outline" as const,             step: "Submit your verification request below" },
                { icon: "person-outline" as const,           step: "A JNV Official from your school reviews it" },
                { icon: "checkmark-circle-outline" as const, step: "Once approved, you get a verified badge" },
                { icon: "star-outline" as const,             step: "Verified alumni can mentor students & post jobs" },
              ].map((item, i) => (
                <View key={i} style={s.stepRow}>
                  <View style={s.stepNum}><Text style={s.stepNumText}>{i + 1}</Text></View>
                  <Ionicons name={item.icon} size={16} color="#3D5AF1" style={{ marginRight: 10 }} />
                  <Text style={s.stepText}>{item.step}</Text>
                </View>
              ))}
            </View>

            {/* Submit */}
            <TouchableOpacity
              style={[s.submitBtn, (!passoutBatch || submitting) && s.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={!passoutBatch || submitting}
              activeOpacity={0.85}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
              <Text style={s.submitBtnText}>{submitting ? "Submitting…" : "Submit Verification Request"}</Text>
            </TouchableOpacity>
          </>
        )}

        {isAlreadySubmitted && status !== "verified" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>What happens next?</Text>
            <Text style={s.cardSub}>
              Your JNV Official will review your request. You'll see the updated status here and on your profile.
              This typically takes 1–3 business days.
            </Text>
            <TouchableOpacity
              style={s.checkStatusBtn}
              onPress={() => router.push("/(screens)/verification-center" as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="eye-outline" size={17} color="#3D5AF1" />
              <Text style={s.checkStatusText}>View Verification Status</Text>
            </TouchableOpacity>
          </View>
        )}

        {status === "verified" && (
          <View style={s.card}>
            <Text style={s.cardTitle}>You're all set! 🎉</Text>
            <Text style={s.cardSub}>
              Your alumni status is verified. You now have access to all Navodaya Connect features
              including mentorship, job postings, and more.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 19, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 1 },
  toast: { marginHorizontal: 16, marginTop: 12, backgroundColor: "#111827", borderRadius: 10, padding: 12, alignItems: "center" },
  toastText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium" },
  statusCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 14, borderWidth: 1.5 },
  statusIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 3 },
  statusDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 18 },
  card: { backgroundColor: "#fff", borderRadius: 14, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  cardTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },
  cardSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 18, marginBottom: 14 },
  pickerBtn: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 10, padding: 12, backgroundColor: "#F9FAFB" },
  pickerBtnText: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: "#111827" },
  yearList: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, marginTop: 8, overflow: "hidden" },
  yearItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 11, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  yearItemSelected: { backgroundColor: "#EEF2FF" },
  yearItemText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  yearItemTextSelected: { color: "#3D5AF1", fontFamily: "Inter_700Bold" },
  docRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginBottom: 12 },
  docIcon: { width: 36, height: 36, borderRadius: 8, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", marginTop: 18 },
  docLabel: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 5 },
  docInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 8, padding: 9, fontSize: 13, fontFamily: "Inter_400Regular", color: "#111827", backgroundColor: "#FAFAFA" },
  stepRow: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  stepNum: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginRight: 8 },
  stepNumText: { fontSize: 11, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  stepText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 18 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#1A3C6E", borderRadius: 14, paddingVertical: 15 },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#fff" },
  checkStatusBtn: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 },
  checkStatusText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
});
