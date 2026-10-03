import React, { useEffect, useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import { api } from "@/lib/api";
import type { PublicUserProfile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const REASONS = [
  { id: "harassment",  label: "Harassment or Bullying",    icon: "hand-left-outline"      as const, color: "#EF4444" },
  { id: "spam",        label: "Spam or Fake Account",      icon: "ban-outline"             as const, color: "#F59E0B" },
  { id: "inappropriate", label: "Inappropriate Content",  icon: "warning-outline"         as const, color: "#8B5CF6" },
  { id: "impersonation", label: "Impersonation",          icon: "person-remove-outline"   as const, color: "#EF4444" },
  { id: "hate",        label: "Hate Speech or Abuse",      icon: "alert-circle-outline"   as const, color: "#DC2626" },
  { id: "cheating",    label: "Cheating or Academic Fraud", icon: "school-outline"         as const, color: "#0891B2" },
  { id: "privacy",     label: "Privacy Violation",         icon: "eye-off-outline"        as const, color: "#6366F1" },
  { id: "other",       label: "Other",                     icon: "ellipsis-horizontal-outline" as const, color: "#6B7280" },
];

export default function ReportUserScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;
  const params  = useLocalSearchParams<{ userId?: string }>();
  const targetId = typeof params.userId === "string" ? params.userId : "";
  const { profile } = useAuth();
  const [target, setTarget] = useState<PublicUserProfile | null>(null);
  const [targetLoading, setTargetLoading] = useState(true);
  const [targetError, setTargetError] = useState("");

  const [selected, setSelected]   = useState<string | null>(null);
  const [details,  setDetails]    = useState("");
  const [submitted, setSubmitted] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    let cancelled = false;
    if (!targetId) {
      setTargetError("A valid user profile is required to report someone.");
      setTargetLoading(false);
      return;
    }
    api.users.get(targetId)
      .then((user) => { if (!cancelled) setTarget(user); })
      .catch(() => { if (!cancelled) setTargetError("Unable to load this user profile."); })
      .finally(() => { if (!cancelled) setTargetLoading(false); });
    return () => { cancelled = true; };
  }, [targetId]);

  const targetIsSelf = !!target && target.id === profile?.uid;
  const reportedName = target?.fullName ?? (targetLoading ? "Loading profile…" : "this user");

  const handleSubmit = async () => {
    if (!selected || !target || targetIsSelf) return;
    setSubmitting(true);
    try {
      await api.reports.submit({
        reportedUserId: target.id,
        reason: REASONS.find((r) => r.id === selected)?.label || selected,
        details: details.trim() || undefined,
      });
      setSubmitted(true);
    } catch (e: any) {
      showToast(e?.message || "Failed to submit report. Try again.");
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <View style={[styles.container, { paddingTop: topPad }]}>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={64} color="#10B981" /></View>
          <Text style={styles.successTitle}>Report Submitted</Text>
          <Text style={styles.successText}>Thank you for keeping JNV Connect safe. Our moderators will review this report within 24 hours.</Text>
          <View style={styles.successNote}>
            <Ionicons name="shield-checkmark-outline" size={16} color="#3D5AF1" />
            <Text style={styles.successNoteText}>Your report is confidential. The reported user will not be notified.</Text>
          </View>
          <TouchableOpacity style={styles.doneBtn} onPress={() => router.back()}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Report User</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }} keyboardShouldPersistTaps="handled">

        <View style={styles.targetCard}>
          <Ionicons name="flag-outline" size={20} color="#EF4444" />
          <View style={{ flex: 1 }}>
            <Text style={styles.targetText}>Reporting <Text style={styles.targetName}>{reportedName}</Text></Text>
            {targetIsSelf ? <Text style={styles.targetError}>You cannot report your own profile.</Text> : null}
            {targetError ? <Text style={styles.targetError}>{targetError}</Text> : null}
          </View>
        </View>

        <Text style={styles.sectionLabel}>Why are you reporting this user? *</Text>
        <Text style={styles.sectionSub}>Your report will be reviewed by JNV Connect moderators and appropriate action will be taken.</Text>

        <View style={styles.reasonList}>
          {REASONS.map((r) => (
            <TouchableOpacity
              key={r.id}
              style={[styles.reasonRow, selected === r.id && styles.reasonRowSelected]}
              onPress={() => setSelected(r.id)}
              activeOpacity={0.75}
            >
              <View style={[styles.reasonIcon, { backgroundColor: r.color + "18" }]}>
                <Ionicons name={r.icon} size={20} color={r.color} />
              </View>
              <Text style={[styles.reasonLabel, selected === r.id && styles.reasonLabelSelected]}>{r.label}</Text>
              <View style={[styles.radioOuter, selected === r.id && styles.radioOuterSelected]}>
                {selected === r.id && <View style={styles.radioInner} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.sectionLabel}>Additional Details (optional)</Text>
        <TextInput
          style={styles.detailsInput}
          placeholder="Describe what happened. This helps our team take the right action..."
          placeholderTextColor="#9CA3AF"
          value={details}
          onChangeText={setDetails}
          multiline
          textAlignVertical="top"
          numberOfLines={4}
        />

        <View style={styles.privacyNote}>
          <Ionicons name="lock-closed-outline" size={14} color="#6B7280" />
          <Text style={styles.privacyText}>Reports are anonymous and handled confidentially by JNV officials. False reports may result in action against the reporter.</Text>
        </View>

        {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
        <TouchableOpacity
          style={[styles.submitBtn, (!selected || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!selected || submitting || targetLoading || !target || targetIsSelf}
        >
          <Ionicons name="flag" size={18} color="#fff" />
          <Text style={styles.submitBtnText}>Submit Report</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  targetCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#FECACA" },
  targetText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  targetName: { fontFamily: "Inter_700Bold", color: "#EF4444" },
  targetError: { marginTop: 4, color: "#B91C1C", fontSize: 12, fontFamily: "Inter_500Medium" },
  sectionLabel: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  sectionSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 14, lineHeight: 18 },
  reasonList: { gap: 8, marginBottom: 22 },
  reasonRow: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#F0F0F0" },
  reasonRowSelected: { borderColor: "#3D5AF1", backgroundColor: "#EEF2FF" },
  reasonIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  reasonLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  reasonLabelSelected: { color: "#3D5AF1", fontFamily: "Inter_600SemiBold" },
  radioOuter: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "#D1D5DB", alignItems: "center", justifyContent: "center" },
  radioOuterSelected: { borderColor: "#3D5AF1" },
  radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: "#3D5AF1" },
  detailsInput: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 100, marginBottom: 14 },
  privacyNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#F3F4F6", borderRadius: 10, padding: 12, marginBottom: 20 },
  privacyText: { flex: 1, fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 16 },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#EF4444", borderRadius: 14, paddingVertical: 15 },
  submitBtnDisabled: { backgroundColor: "#9CA3AF" },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  successWrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  successIcon: { marginBottom: 8 },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  successText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 22 },
  successNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, backgroundColor: "#EEF2FF", borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#C7D2FE" },
  successNoteText: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium", color: "#3730A3" },
  doneBtn: { backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 48 },
  doneBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
