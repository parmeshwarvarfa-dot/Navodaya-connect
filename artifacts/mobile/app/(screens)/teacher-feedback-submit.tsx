import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Switch,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { ManagedUser } from "@/lib/api";

export default function TeacherFeedbackSubmitScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [teachers, setTeachers]     = useState<ManagedUser[]>([]);
  const [selected, setSelected]     = useState<ManagedUser | null>(null);
  const [rating, setRating]         = useState(0);
  const [comment, setComment]       = useState("");
  const [anonymous, setAnonymous]   = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [toast, setToast]           = useState("");
  const [showPicker, setShowPicker] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2500); };

  useEffect(() => {
    api.users.manage().then((users) => {
      setTeachers(users.filter((u) => u.role === "teacher" && u.verificationStatus === "verified"));
    }).catch(() => showToast("Could not load teachers"));
  }, []);

  const handleSubmit = async () => {
    if (!selected) return showToast("Please select a teacher");
    if (rating === 0) return showToast("Please select a rating");
    if (!comment.trim() || comment.trim().length < 10) return showToast("Please write at least 10 characters");
    setSubmitting(true);
    try {
      await api.teacherFeedback.submit({
        teacherId: selected.id,
        teacherName: selected.fullName,
        subject: selected.subject,
        rating,
        comment: comment.trim(),
        anonymous,
      });
      setSubmitted(true);
    } catch (e: any) { showToast(e.message || "Failed to submit"); }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <View style={[s.container, { alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }]}>
        <View style={s.successIcon}>
          <Ionicons name="checkmark-circle" size={64} color="#10B981" />
        </View>
        <Text style={s.successTitle}>Feedback Submitted!</Text>
        <Text style={s.successDesc}>
          Your feedback has been sent to the JNV Official. It will remain confidential and help improve teaching quality.
        </Text>
        <TouchableOpacity style={s.doneBtn} onPress={() => router.back()}>
          <Text style={s.doneBtnText}>Done</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={s.container}>
      <LinearGradient colors={["#1A3C6E", "#2D5A9E"]} style={[s.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.headerTitle}>Teacher Feedback</Text>
          <Text style={s.headerSub}>Your feedback goes only to the JNV Official</Text>
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
      >
        {/* Privacy notice */}
        <View style={s.privacyBanner}>
          <Ionicons name="shield-checkmark" size={18} color="#3D5AF1" />
          <Text style={s.privacyText}>
            Feedback is <Text style={{ fontFamily: "Inter_700Bold" }}>confidential</Text> — teachers cannot see it. Only JNV Officials can view submitted feedback.
          </Text>
        </View>

        {/* Select teacher */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>SELECT TEACHER</Text>
          <TouchableOpacity style={s.pickerBtn} onPress={() => setShowPicker(!showPicker)}>
            {selected ? (
              <View style={s.selectedTeacher}>
                <View style={s.teacherAvatar}><Text style={s.teacherAvatarText}>{selected.fullName[0]}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.selectedTeacherName}>{selected.fullName}</Text>
                  {selected.subject && <Text style={s.selectedTeacherSubject}>{selected.subject}</Text>}
                </View>
                <Ionicons name={showPicker ? "chevron-up" : "chevron-down"} size={18} color="#6B7280" />
              </View>
            ) : (
              <View style={s.pickerPlaceholder}>
                <Ionicons name="person-outline" size={20} color="#9CA3AF" />
                <Text style={s.pickerPlaceholderText}>Choose a teacher...</Text>
                <Ionicons name="chevron-down" size={18} color="#9CA3AF" />
              </View>
            )}
          </TouchableOpacity>

          {showPicker && (
            <View style={s.dropdownList}>
              {teachers.length === 0 ? (
                <Text style={s.noTeacherText}>No verified teachers found in your JNV</Text>
              ) : teachers.map((t) => (
                <TouchableOpacity
                  key={t.id}
                  style={[s.dropdownItem, selected?.id === t.id && s.dropdownItemActive]}
                  onPress={() => { setSelected(t); setShowPicker(false); }}
                >
                  <View style={s.teacherAvatar}><Text style={s.teacherAvatarText}>{t.fullName[0]}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.dropdownItemName}>{t.fullName}</Text>
                    {t.subject && <Text style={s.dropdownItemSubject}>{t.subject}</Text>}
                  </View>
                  {selected?.id === t.id && <Ionicons name="checkmark-circle" size={18} color="#10B981" />}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Rating */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>OVERALL RATING</Text>
          <View style={s.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} style={s.starBtn}>
                <Ionicons name={star <= rating ? "star" : "star-outline"} size={36} color={star <= rating ? "#F59E0B" : "#D1D5DB"} />
              </TouchableOpacity>
            ))}
          </View>
          {rating > 0 && (
            <Text style={s.ratingLabel}>
              {["", "Poor", "Below Average", "Average", "Good", "Excellent"][rating]} ({rating}/5)
            </Text>
          )}
        </View>

        {/* Comment */}
        <View style={s.section}>
          <Text style={s.sectionTitle}>YOUR FEEDBACK</Text>
          <TextInput
            style={s.commentInput}
            placeholder="Share your honest feedback about teaching quality, subject clarity, behaviour, etc. (minimum 10 characters)"
            placeholderTextColor="#9CA3AF"
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={6}
            maxLength={1000}
            textAlignVertical="top"
          />
          <Text style={s.charCount}>{comment.length}/1000</Text>
        </View>

        {/* Anonymous toggle */}
        <View style={s.anonRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.anonLabel}>Submit Anonymously</Text>
            <Text style={s.anonDesc}>Your name will be hidden from the official</Text>
          </View>
          <Switch
            value={anonymous}
            onValueChange={setAnonymous}
            trackColor={{ false: "#E5E7EB", true: "#1A3C6E" }}
            thumbColor="#fff"
          />
        </View>

        {/* Submit */}
        <TouchableOpacity
          style={[s.submitBtn, (!selected || rating === 0 || comment.trim().length < 10) && { opacity: 0.5 }]}
          onPress={handleSubmit}
          disabled={submitting || !selected || rating === 0 || comment.trim().length < 10}
        >
          <LinearGradient colors={["#1A3C6E", "#2D5A9E"]} style={s.submitBtnGrad}>
            <Ionicons name={submitting ? "hourglass-outline" : "send-outline"} size={20} color="#fff" />
            <Text style={s.submitBtnText}>{submitting ? "Submitting..." : "Submit Feedback"}</Text>
          </LinearGradient>
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
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingBottom: 16 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular" },
  privacyBanner: { flexDirection: "row", gap: 10, backgroundColor: "#EEF2FF", borderRadius: 12, padding: 12, alignItems: "flex-start", borderWidth: 1, borderColor: "#C7D2FE" },
  privacyText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#3730A3", lineHeight: 18 },
  section: { backgroundColor: "#fff", borderRadius: 16, padding: 16, gap: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  sectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8 },
  pickerBtn: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, padding: 12 },
  pickerPlaceholder: { flexDirection: "row", alignItems: "center", gap: 10 },
  pickerPlaceholderText: { flex: 1, fontSize: 15, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  selectedTeacher: { flexDirection: "row", alignItems: "center", gap: 10 },
  teacherAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  teacherAvatarText: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#10B981" },
  selectedTeacherName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  selectedTeacherSubject: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  dropdownList: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, overflow: "hidden" },
  dropdownItem: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  dropdownItemActive: { backgroundColor: "#ECFDF5" },
  dropdownItemName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  dropdownItemSubject: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  noTeacherText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#9CA3AF", textAlign: "center", padding: 16 },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 8 },
  starBtn: { padding: 4 },
  ratingLabel: { textAlign: "center", fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#F59E0B" },
  commentInput: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", minHeight: 120 },
  charCount: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#D1D5DB", textAlign: "right" },
  anonRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 14, gap: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  anonLabel: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  anonDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginTop: 2 },
  submitBtn: { borderRadius: 14, overflow: "hidden" },
  submitBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  submitBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  successIcon: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#ECFDF5", alignItems: "center", justifyContent: "center" },
  successTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center" },
  successDesc: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", lineHeight: 22 },
  doneBtn: { backgroundColor: "#1A3C6E", borderRadius: 14, paddingVertical: 14, paddingHorizontal: 40 },
  doneBtnText: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#fff" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
