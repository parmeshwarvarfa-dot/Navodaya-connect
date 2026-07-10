import React, { useState } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput, KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const FEEDBACK_TYPES = [
  { value: "teacher",  label: "Teacher Feedback",  icon: "person-outline"       as const, color: "#3D5AF1" },
  { value: "school",   label: "School Feedback",   icon: "school-outline"       as const, color: "#10B981" },
  { value: "event",    label: "Event Feedback",    icon: "calendar-outline"     as const, color: "#F59E0B" },
  { value: "hostel",   label: "Hostel Feedback",   icon: "home-outline"         as const, color: "#8B5CF6" },
  { value: "food",     label: "Food & Mess",       icon: "restaurant-outline"   as const, color: "#EF4444" },
  { value: "other",    label: "Other",             icon: "chatbubble-outline"   as const, color: "#6B7280" },
];

const TEACHERS = ["Mr. Ramesh Kumar (Physics)", "Ms. Asha Sharma (Maths)", "Mr. Sunil Tiwari (English)", "Ms. Pooja Devi (Chemistry)", "Dr. Meera Verma (Biology)"];
const EVENTS   = ["Annual Sports Day 2026", "Science Exhibition", "Cultural Night", "Independence Day Celebration"];
const RATINGS  = [1, 2, 3, 4, 5];

export default function StudyFeedbackScreen() {
  const insets  = useSafeAreaInsets();
  const topPad  = Platform.OS === "web" ? 60 : insets.top;

  const [activeType,  setActiveType]  = useState<string | null>(null);
  const [rating,      setRating]      = useState(0);
  const [feedback,    setFeedback]    = useState("");
  const [target,      setTarget]      = useState("");
  const [anonymous,   setAnonymous]   = useState(true);
  const [submitted,   setSubmitted]   = useState(false);
  const [error,       setError]       = useState("");

  const typeCfg = FEEDBACK_TYPES.find((t) => t.value === activeType);

  const handleSubmit = () => {
    if (!activeType) { setError("Please select a feedback type."); return; }
    if (rating === 0) { setError("Please give a star rating."); return; }
    if (feedback.trim().length < 20) { setError("Please write at least 20 characters of feedback."); return; }
    setError("");
    setSubmitted(true);
  };

  const handleReset = () => {
    setActiveType(null); setRating(0); setFeedback(""); setTarget(""); setSubmitted(false); setError("");
  };

  if (submitted) {
    return (
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Submit Feedback</Text>
        </View>
        <View style={styles.successScreen}>
          <View style={styles.successIcon}><Ionicons name="checkmark-circle" size={64} color="#10B981" /></View>
          <Text style={styles.successTitle}>Feedback Submitted!</Text>
          <Text style={styles.successDesc}>
            {anonymous ? "Your feedback has been sent anonymously to the coordinator. Thank you for helping improve JNV!" : "Your feedback has been submitted. Thank you!"}
          </Text>
          <View style={styles.anonNote}>
            <Ionicons name="shield-checkmark" size={16} color="#3D5AF1" />
            <Text style={styles.anonNoteText}>{anonymous ? "This feedback is completely anonymous to teachers." : "Your name is attached to this feedback."}</Text>
          </View>
          <TouchableOpacity style={styles.submitAnotherBtn} onPress={handleReset}>
            <Text style={styles.submitAnotherText}>Submit Another Feedback</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.goBackBtn} onPress={() => router.back()}>
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.container}>
        <View style={[styles.header, { paddingTop: topPad + 8 }]}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Submit Feedback</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }} keyboardShouldPersistTaps="handled">

          {/* Info banner */}
          <View style={styles.infoBanner}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#3D5AF1" />
            <Text style={styles.infoBannerText}>Feedback is confidential. Only school coordinators can see it — never individual teachers.</Text>
          </View>

          {/* Type selection */}
          <Text style={styles.label}>Feedback Type</Text>
          <View style={styles.typeGrid}>
            {FEEDBACK_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeCard, activeType === t.value && { borderColor: t.color, backgroundColor: t.color + "10" }]}
                onPress={() => { setActiveType(t.value); setTarget(""); }}
              >
                <Ionicons name={t.icon} size={22} color={activeType === t.value ? t.color : "#6B7280"} />
                <Text style={[styles.typeCardText, activeType === t.value && { color: t.color }]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Teacher selector */}
          {activeType === "teacher" && (
            <>
              <Text style={styles.label}>Select Teacher</Text>
              <View style={styles.optionList}>
                {TEACHERS.map((t) => (
                  <TouchableOpacity key={t} style={[styles.optionRow, target === t && styles.optionRowActive]} onPress={() => setTarget(t)}>
                    <Ionicons name="person-circle-outline" size={18} color={target === t ? "#3D5AF1" : "#9CA3AF"} />
                    <Text style={[styles.optionText, target === t && { color: "#3D5AF1" }]}>{t}</Text>
                    {target === t && <Ionicons name="checkmark-circle" size={18} color="#3D5AF1" />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Event selector */}
          {activeType === "event" && (
            <>
              <Text style={styles.label}>Select Event</Text>
              <View style={styles.optionList}>
                {EVENTS.map((e) => (
                  <TouchableOpacity key={e} style={[styles.optionRow, target === e && styles.optionRowActive]} onPress={() => setTarget(e)}>
                    <Ionicons name="calendar-outline" size={18} color={target === e ? "#F59E0B" : "#9CA3AF"} />
                    <Text style={[styles.optionText, target === e && { color: "#F59E0B" }]}>{e}</Text>
                    {target === e && <Ionicons name="checkmark-circle" size={18} color="#F59E0B" />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Star rating */}
          <Text style={styles.label}>Your Rating</Text>
          <View style={styles.starsRow}>
            {RATINGS.map((r) => (
              <TouchableOpacity key={r} onPress={() => setRating(r)} style={styles.starBtn}>
                <Ionicons name={rating >= r ? "star" : "star-outline"} size={36} color={rating >= r ? "#F59E0B" : "#D1D5DB"} />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={styles.ratingLabel}>
              {rating === 5 ? "Excellent!" : rating === 4 ? "Very Good" : rating === 3 ? "Average" : rating === 2 ? "Needs Improvement" : "Poor"}
            </Text>
          )}

          {/* Feedback text */}
          <Text style={styles.label}>Your Feedback</Text>
          <TextInput
            style={styles.feedbackInput}
            placeholder="Share your honest thoughts, suggestions, or concerns here. Minimum 20 characters..."
            placeholderTextColor="#9CA3AF"
            value={feedback}
            onChangeText={setFeedback}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{feedback.length} characters</Text>

          {/* Anonymous toggle */}
          <TouchableOpacity style={styles.anonToggle} onPress={() => setAnonymous(!anonymous)}>
            <Ionicons name={anonymous ? "checkbox" : "square-outline"} size={22} color={anonymous ? "#3D5AF1" : "#9CA3AF"} />
            <View style={{ flex: 1 }}>
              <Text style={styles.anonLabel}>Submit Anonymously</Text>
              <Text style={styles.anonSub}>{anonymous ? "Your name will NOT be visible to anyone" : "Your name will be attached to this feedback"}</Text>
            </View>
          </TouchableOpacity>

          {/* Error */}
          {error ? (
            <View style={styles.errorRow}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {/* Submit */}
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Ionicons name="send-outline" size={18} color="#fff" />
            <Text style={styles.submitBtnText}>Submit Feedback</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  infoBanner: { flexDirection: "row", alignItems: "flex-start", gap: 10, backgroundColor: "#EEF2FF", borderRadius: 14, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: "#C7D2FE" },
  infoBannerText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#3730A3", lineHeight: 19 },
  label: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10, marginTop: 16 },
  typeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  typeCard: { width: "47%", flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: "#E5E7EB" },
  typeCardText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  optionList: { backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#F0F0F0", overflow: "hidden", marginBottom: 4 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  optionRowActive: { backgroundColor: "#EEF2FF" },
  optionText: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  starsRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#F59E0B", marginBottom: 4 },
  feedbackInput: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 14, padding: 14, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 130, backgroundColor: "#fff" },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 6, marginBottom: 8, textAlign: "right" },
  anonToggle: { flexDirection: "row", alignItems: "flex-start", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 16 },
  anonLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  anonSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#FECACA" },
  errorText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#DC2626" },
  submitBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15 },
  submitBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  successScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32 },
  successIcon: { marginBottom: 20 },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12, textAlign: "center" },
  successDesc: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 22, marginBottom: 20 },
  anonNote: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, marginBottom: 32 },
  anonNoteText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  submitAnotherBtn: { backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, marginBottom: 12, width: "100%", alignItems: "center" },
  submitAnotherText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 15 },
  goBackBtn: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 32, width: "100%", alignItems: "center" },
  goBackText: { color: "#374151", fontFamily: "Inter_600SemiBold", fontSize: 15 },
});
