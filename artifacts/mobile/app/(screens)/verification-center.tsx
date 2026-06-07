import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, Platform, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { VerificationRequest } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STATUS_CFG: Record<string, { color: string; bg: string; icon: keyof typeof import("@expo/vector-icons").Ionicons.glyphMap; label: string; desc: string }> = {
  pending:      { color: "#F59E0B", bg: "#FFFBEB", icon: "time-outline",             label: "Pending Review",  desc: "Your request is in queue. A JNV Official will review it shortly." },
  approved:     { color: "#10B981", bg: "#ECFDF5", icon: "checkmark-circle-outline", label: "Approved",        desc: "Congratulations! Your account has been verified." },
  rejected:     { color: "#EF4444", bg: "#FEF2F2", icon: "close-circle-outline",     label: "Rejected",        desc: "Your verification was rejected. See notes below." },
  info_requested:{ color: "#3D5AF1", bg: "#EEF2FF", icon: "information-circle-outline",label: "Info Requested",desc: "The official needs more information from you." },
};

const TIMELINE_STEPS = [
  { key: "registered", label: "Account Created",    icon: "person-add-outline" as const },
  { key: "submitted",  label: "Request Submitted",  icon: "document-text-outline" as const },
  { key: "reviewing",  label: "Under Review",        icon: "eye-outline" as const },
  { key: "verified",   label: "Verification Complete",icon: "shield-checkmark-outline" as const },
];

const ROLE_TIPS: Record<string, string[]> = {
  student:  ["Your request is automatically sent to your JNV's official.", "Verification confirms your enrollment at the JNV.", "You'll get full access to the platform once verified."],
  teacher:  ["Your request is sent to your JNV Official for review.", "Verification confirms your teaching role at the JNV.", "Once verified, you can create groups and post updates."],
  alumni:   ["Your request is sent to your JNV Official for review.", "Alumni can also verify using Class 10 or Class 12 marksheets.", "Verified alumni appear in the directory and can mentor students."],
};

export default function VerificationCenterScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const { profile, refreshProfile, signOut } = useAuth();

  const [request, setRequest]   = useState<VerificationRequest | null>(null);
  const [status, setStatus]     = useState(profile?.verificationStatus ?? "pending");
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast]       = useState("");

  const pulse = new Animated.Value(1);
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.08, duration: 1000, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 1000, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.verification.myStatus();
      setStatus(data.verificationStatus);
      setRequest(data.request);
      if (data.verificationStatus === "verified") refreshProfile();
    } catch {
      showToast("Could not load verification status");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const currentStep = status === "verified" ? 3 : status === "pending" ? 2 : status === "info_requested" ? 2 : 2;
  const cfg = STATUS_CFG[request?.status ?? status] ?? STATUS_CFG.pending;
  const tips = ROLE_TIPS[profile?.role ?? "student"] ?? ROLE_TIPS.student;

  if (status === "verified") {
    refreshProfile();
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={["#1A3C6E", "#2D5A9E"]} style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="rgba(255,255,255,0.9)" />
          </TouchableOpacity>
          <View style={{ flex: 1 }}>
            <Text style={s.headerTitle}>Verification Center</Text>
            <Text style={s.headerSub}>JNV · {profile?.jnvName}</Text>
          </View>
          <TouchableOpacity style={s.refreshBtn} onPress={() => { setRefreshing(true); fetchStatus(); }}>
            <Ionicons name="refresh" size={20} color="rgba(255,255,255,0.8)" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStatus(); }} />}
      >
        {/* Status Card */}
        <View style={[s.statusCard, { borderColor: cfg.color + "50" }]}>
          <Animated.View style={[s.statusIconWrap, { backgroundColor: cfg.bg, transform: [{ scale: pulse }] }]}>
            <Ionicons name={cfg.icon} size={40} color={cfg.color} />
          </Animated.View>
          <Text style={[s.statusLabel, { color: cfg.color }]}>{cfg.label}</Text>
          <Text style={s.statusDesc}>{cfg.desc}</Text>
          {request?.infoRequest && (
            <View style={s.infoRequestBanner}>
              <Ionicons name="information-circle" size={16} color="#3D5AF1" />
              <Text style={s.infoRequestText}>{request.infoRequest}</Text>
            </View>
          )}
          {request?.notes && (
            <View style={s.notesBanner}>
              <Ionicons name="document-text" size={14} color="#6B7280" />
              <Text style={s.notesText}>{request.notes}</Text>
            </View>
          )}
        </View>

        {/* Timeline */}
        <View style={s.timelineCard}>
          <Text style={s.sectionTitle}>VERIFICATION PROGRESS</Text>
          {TIMELINE_STEPS.map((step, i) => {
            const done = i <= currentStep;
            const active = i === currentStep;
            return (
              <View key={step.key} style={s.timelineRow}>
                <View style={s.timelineLeft}>
                  <View style={[s.timelineDot, done && s.timelineDotDone, active && s.timelineDotActive]}>
                    {done ? <Ionicons name="checkmark" size={12} color="#fff" /> : <Ionicons name={step.icon} size={12} color={active ? "#fff" : "#D1D5DB"} />}
                  </View>
                  {i < TIMELINE_STEPS.length - 1 && <View style={[s.timelineLine, done && s.timelineLineDone]} />}
                </View>
                <View style={s.timelineContent}>
                  <Text style={[s.timelineLabel, !done && { color: "#9CA3AF" }, active && { color: "#1A3C6E" }]}>{step.label}</Text>
                  {active && <Text style={s.timelineActive}>In progress</Text>}
                  {done && i < currentStep && <Text style={s.timelineDoneText}>Completed</Text>}
                </View>
              </View>
            );
          })}
        </View>

        {/* Request Details */}
        {request && (
          <View style={s.detailCard}>
            <Text style={s.sectionTitle}>YOUR REQUEST</Text>
            {[
              { icon: "person-outline" as const,       label: "Name",    value: request.userFullName },
              { icon: "mail-outline" as const,          label: "Email",   value: request.userEmail },
              { icon: "business-outline" as const,      label: "JNV",     value: `${request.jnvName}, ${request.jnvState}` },
              { icon: "shield-outline" as const,        label: "Method",  value: request.method === "official" ? "Official Review" : request.method },
              { icon: "calendar-outline" as const,      label: "Submitted", value: new Date(request.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) },
              ...(request.reviewedByName ? [{ icon: "checkmark-circle-outline" as const, label: "Reviewed By", value: request.reviewedByName }] : []),
            ].map((row) => (
              <View key={row.label} style={s.detailRow}>
                <Ionicons name={row.icon} size={16} color="#6B7280" />
                <Text style={s.detailLabel}>{row.label}</Text>
                <Text style={s.detailValue} numberOfLines={1}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Tips */}
        <View style={s.tipsCard}>
          <Text style={s.sectionTitle}>WHAT TO EXPECT</Text>
          {tips.map((tip, i) => (
            <View key={i} style={s.tipRow}>
              <View style={s.tipDot} />
              <Text style={s.tipText}>{tip}</Text>
            </View>
          ))}
          <View style={s.tipRow}>
            <View style={s.tipDot} />
            <Text style={s.tipText}>Verification typically takes 24–48 hours. You will be notified once it is done.</Text>
          </View>
        </View>

        {/* What you can do while waiting */}
        <View style={s.allowedCard}>
          <Text style={s.sectionTitle}>AVAILABLE WHILE PENDING</Text>
          {[
            { icon: "person-circle-outline" as const, text: "Edit your profile" },
            { icon: "eye-outline" as const,           text: "View your verification status" },
          ].map((item) => (
            <TouchableOpacity key={item.text} style={s.allowedRow}>
              <Ionicons name={item.icon} size={18} color="#10B981" />
              <Text style={s.allowedText}>{item.text}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Sign Out */}
        <TouchableOpacity style={s.signOutBtn} onPress={signOut}>
          <Ionicons name="log-out-outline" size={18} color="#EF4444" />
          <Text style={s.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>

      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.12)", alignItems: "center", justifyContent: "center", marginRight: 4 },
  refreshBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  statusCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", gap: 10, borderWidth: 1.5 },
  statusIconWrap: { width: 80, height: 80, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  statusLabel: { fontSize: 20, fontFamily: "Inter_700Bold" },
  statusDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 20 },
  infoRequestBanner: { flexDirection: "row", gap: 8, backgroundColor: "#EEF2FF", borderRadius: 10, padding: 12, alignItems: "flex-start", width: "100%" },
  infoRequestText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#3D5AF1", lineHeight: 18 },
  notesBanner: { flexDirection: "row", gap: 8, backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, alignItems: "flex-start", width: "100%", borderWidth: 1, borderColor: "#F0F0F0" },
  notesText: { flex: 1, fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  timelineCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", gap: 0 },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 14 },
  timelineRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  timelineLeft: { alignItems: "center", width: 24 },
  timelineDot: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  timelineDotDone: { backgroundColor: "#10B981", borderColor: "#10B981" },
  timelineDotActive: { backgroundColor: "#1A3C6E", borderColor: "#1A3C6E" },
  timelineLine: { width: 2, height: 32, backgroundColor: "#E5E7EB", marginVertical: 4 },
  timelineLineDone: { backgroundColor: "#10B981" },
  timelineContent: { flex: 1, paddingBottom: 20 },
  timelineLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  timelineActive: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#1A3C6E", marginTop: 2 },
  timelineDoneText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#10B981", marginTop: 2 },
  detailCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  detailLabel: { width: 80, fontSize: 12, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  detailValue: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#111827" },
  tipsCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", gap: 2 },
  tipRow: { flexDirection: "row", gap: 10, paddingVertical: 6, alignItems: "flex-start" },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1A3C6E", marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20 },
  allowedCard: { backgroundColor: "#ECFDF5", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#A7F3D0" },
  allowedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  allowedText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#065F46" },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
