import React, { useEffect, useState, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput,
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
  unverified:   { color: "#6B7280", bg: "#F3F4F6", icon: "shield-outline", label: "Not Verified", desc: "Submit role-specific school evidence to request verification." },
  pending:      { color: "#F59E0B", bg: "#FFFBEB", icon: "time-outline",             label: "Pending Review",  desc: "Your request is in queue. A JNV Official will review it shortly." },
  awaiting_official_decision: { color: "#3D5AF1", bg: "#EEF2FF", icon: "hourglass-outline", label: "Awaiting Official Decision", desc: "Your school reviewer submitted a recommendation. An authorized JNV official makes the final decision." },
  info_requested:{ color: "#3D5AF1", bg: "#EEF2FF", icon: "information-circle-outline", label: "More Information Needed", desc: "Your school reviewer asked for additional information." },
  approved:     { color: "#10B981", bg: "#ECFDF5", icon: "checkmark-circle-outline", label: "Approved",        desc: "Congratulations! Your account has been verified." },
  rejected:     { color: "#EF4444", bg: "#FEF2F2", icon: "close-circle-outline",     label: "Rejected",        desc: "Your verification was rejected. See notes below." },
  suspended:    { color: "#6B7280", bg: "#F3F4F6", icon: "ban-outline", label: "Suspended", desc: "Your credential is suspended. Contact your JNV official for review." },
};

const TIMELINE_STEPS = [
  { key: "registered", label: "Account Created",    icon: "person-add-outline" as const },
  { key: "submitted",  label: "Request Submitted",  icon: "document-text-outline" as const },
  { key: "reviewing",  label: "Under Review",        icon: "eye-outline" as const },
  { key: "verified",   label: "Verification Complete",icon: "shield-checkmark-outline" as const },
];

const ROLE_TIPS: Record<string, string[]> = {
  student:  ["Submit enrollment evidence connected to your selected JNV.", "A school reviewer recommends a decision.", "An authorized JNV official makes the final decision."],
  teacher:  ["Submit evidence of your teaching role at the selected JNV.", "A school reviewer recommends a decision.", "An authorized JNV official makes the final decision."],
  alumni:   ["Submit an alumni record, transfer certificate, or marksheet.", "A school reviewer recommends a decision.", "An authorized JNV official makes the final decision."],
  official: ["Your request is reviewed by an assigned school reviewer.", "Final school authority must be independently confirmed.", "An authorized school official makes the final decision."],
};

export default function VerificationCenterScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const { profile, refreshProfile, signOut } = useAuth();

  const [request, setRequest]   = useState<VerificationRequest | null>(null);
  const [status, setStatus]     = useState<string>(profile?.verificationStatus ?? "unverified");
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast]       = useState("");
  const [applicantResponse, setApplicantResponse] = useState("");
  const [evidenceSummary, setEvidenceSummary] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

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

  const submitAdditionalInfo = async () => {
    if (!request) return;
    if (!applicantResponse.trim()) return showToast("Add the requested information before submitting.");
    const documentUrls = evidenceLinks.split(/\s+/).map((url) => url.trim()).filter(Boolean);
    if (!documentUrls.length) return showToast("Add at least one supporting evidence link.");
    setActionLoading(true);
    try {
      await api.verification.resubmit(request.id, { applicantResponse: applicantResponse.trim(), documentUrls });
      setApplicantResponse("");
      setEvidenceLinks("");
      showToast("Additional information sent to your JNV reviewer.");
      await fetchStatus();
    } catch (error: any) { showToast(error.message || "Could not submit the information."); }
    finally { setActionLoading(false); }
  };

  const withdrawRequest = async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      await api.verification.withdraw(request.id);
      showToast("Verification request withdrawn.");
      await fetchStatus();
    } catch (error: any) { showToast(error.message || "Could not withdraw the request."); }
    finally { setActionLoading(false); }
  };

  const submitVerificationRequest = async () => {
    const documentUrls = evidenceLinks.split(/\s+/).map((url) => url.trim()).filter(Boolean);
    if (evidenceSummary.trim().length < 20) return showToast("Describe your role and school evidence in at least 20 characters.");
    if (!documentUrls.length) return showToast("Add at least one supporting evidence link.");
    setActionLoading(true);
    try {
      await api.verification.create({ evidenceSummary: evidenceSummary.trim(), documentUrls });
      setEvidenceSummary("");
      setEvidenceLinks("");
      await refreshProfile();
      await fetchStatus();
      showToast("Verification request submitted to your JNV.");
    } catch (error: any) { showToast(error.message || "Could not submit verification request."); }
    finally { setActionLoading(false); }
  };

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
              ...(request.evidenceSummary ? [{ icon: "document-text-outline" as const, label: "Evidence", value: request.evidenceSummary }] : []),
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

        {status !== "verified" && status !== "pending" && status !== "suspended" && request?.status !== "info_requested" && (
          <View style={s.detailCard}>
            <Text style={s.sectionTitle}>REQUEST VERIFICATION</Text>
            <Text style={s.evidenceHelp}>{profile?.role === "student" ? "Describe your current enrollment and attach a school record or enrollment confirmation." : profile?.role === "alumni" ? "Describe your JNV attendance and attach an alumni record, transfer certificate, or marksheet." : profile?.role === "teacher" ? "Describe your teaching role and attach an appointment or school confirmation record." : "Describe your school authority claim and attach institutional confirmation."}</Text>
            <TextInput
              style={s.responseInput}
              multiline
              value={evidenceSummary}
              onChangeText={setEvidenceSummary}
              placeholder="Explain how the attached evidence verifies your role at this JNV..."
              placeholderTextColor="#9CA3AF"
              maxLength={2000}
            />
            <TextInput
              style={s.responseInput}
              multiline
              value={evidenceLinks}
              onChangeText={setEvidenceLinks}
              placeholder="Paste one or more HTTPS document links"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
              maxLength={10000}
            />
            <Text style={s.evidenceHelp}>Before submitting, restrict link access to your assigned JNV reviewers. The app stores links, not document copies.</Text>
            <TouchableOpacity style={s.responseButton} onPress={submitVerificationRequest} disabled={actionLoading}>
              <Text style={s.responseButtonText}>{actionLoading ? "Submitting..." : "Submit verification request"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {request?.status === "info_requested" && (
          <View style={s.detailCard}>
            <Text style={s.sectionTitle}>ADDITIONAL INFORMATION REQUESTED</Text>
            <Text style={s.detailValue}>{request.infoRequest || "Your school reviewer needs more information to continue."}</Text>
            <TextInput
              style={s.responseInput}
              multiline
              value={applicantResponse}
              onChangeText={setApplicantResponse}
              placeholder="Enter your response..."
              placeholderTextColor="#9CA3AF"
              maxLength={2000}
            />
            <TextInput
              style={s.responseInput}
              multiline
              value={evidenceLinks}
              onChangeText={setEvidenceLinks}
              placeholder="Paste updated HTTPS evidence links"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="url"
              maxLength={10000}
            />
            <Text style={s.evidenceHelp}>Restrict the links to your assigned JNV reviewers before submitting.</Text>
            <TouchableOpacity style={s.responseButton} onPress={submitAdditionalInfo} disabled={actionLoading}>
              <Text style={s.responseButtonText}>{actionLoading ? "Submitting..." : "Submit information"}</Text>
            </TouchableOpacity>
          </View>
        )}

        {request && ["pending", "info_requested"].includes(request.status) && (
          <TouchableOpacity style={s.withdrawButton} onPress={withdrawRequest} disabled={actionLoading}>
            <Text style={s.withdrawText}>Withdraw verification request</Text>
          </TouchableOpacity>
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

        {status !== "verified" && (
          <View style={s.skipCard}>
            <View style={s.skipIconWrap}>
              <Ionicons name="arrow-forward-circle-outline" size={22} color="#3D5AF1" />
            </View>
            <Text style={s.skipTitle}>Want to explore Navodaya Connect?</Text>
            <Text style={s.skipText}>
              You can use limited dashboard features now. Complete verification later to unlock messaging, events, communities, and all member features.
            </Text>
            <TouchableOpacity
              style={s.skipBtn}
              onPress={() => router.replace("/(tabs)" as any)}
              activeOpacity={0.85}
            >
              <Text style={s.skipBtnText}>Skip for Now · Go to Dashboard</Text>
              <Ionicons name="arrow-forward" size={17} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

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
  evidenceHelp: { color: "#6B7280", fontSize: 12, lineHeight: 18, marginTop: 8 },
  responseInput: { minHeight: 90, marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: "#F9FAFB", borderWidth: 1, borderColor: "#E5E7EB", color: "#111827", textAlignVertical: "top", fontFamily: "Inter_400Regular" },
  responseButton: { marginTop: 10, minHeight: 44, borderRadius: 12, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  responseButtonText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  withdrawButton: { minHeight: 42, alignItems: "center", justifyContent: "center" },
  withdrawText: { color: "#B91C1C", fontFamily: "Inter_500Medium", fontSize: 12 },
  tipsCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0", gap: 2 },
  tipRow: { flexDirection: "row", gap: 10, paddingVertical: 6, alignItems: "flex-start" },
  tipDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#1A3C6E", marginTop: 6 },
  tipText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151", lineHeight: 20 },
  allowedCard: { backgroundColor: "#ECFDF5", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#A7F3D0" },
  allowedRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  allowedText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#065F46" },
  skipCard: { backgroundColor: "#EEF2FF", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#C7D2FE" },
  skipIconWrap: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", marginBottom: 10 },
  skipTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1E3A8A", marginBottom: 5 },
  skipText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#4B5CC4", lineHeight: 19, marginBottom: 14 },
  skipBtn: { backgroundColor: "#3D5AF1", borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  skipBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  signOutBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12, backgroundColor: "#FEF2F2", borderWidth: 1, borderColor: "#FECACA" },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
