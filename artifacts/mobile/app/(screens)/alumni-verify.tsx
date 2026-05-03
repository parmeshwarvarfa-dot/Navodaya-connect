import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";

export default function AlumniVerifyScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSubmitRequest = async () => {
    if (profile?.verificationStatus === "pending") {
      Alert.alert("Already Submitted", "Your verification request is pending.");
      return;
    }
    setSubmitting(true);
    try {
      await api.users.updateMe({ verificationStatus: "pending" } as any);
      await refreshProfile();
      Alert.alert("Request Submitted", "Your verification request has been submitted. Other verified alumni will review it.");
    } catch {
      Alert.alert("Error", "Failed to submit request");
    }
    setSubmitting(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Alumni Verification</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <PremiumCard style={styles.statusCard}>
          <View style={styles.statusRow}>
            <View style={[styles.statusIconBg, {
              backgroundColor:
                profile?.verificationStatus === "verified" ? "#D1FAE5"
                : profile?.verificationStatus === "pending" ? "#FEF3C7"
                : "#F1F5F9",
            }]}>
              <Ionicons
                name={
                  profile?.verificationStatus === "verified" ? "checkmark-circle"
                  : profile?.verificationStatus === "pending" ? "time"
                  : "shield-outline"
                }
                size={28}
                color={
                  profile?.verificationStatus === "verified" ? "#059669"
                  : profile?.verificationStatus === "pending" ? "#D97706"
                  : "#64748B"
                }
              />
            </View>
            <View style={styles.statusInfo}>
              <Text style={[styles.statusTitle, { color: colors.foreground }]}>Verification Status</Text>
              <Text style={[styles.statusValue, {
                color:
                  profile?.verificationStatus === "verified" ? "#059669"
                  : profile?.verificationStatus === "pending" ? "#D97706"
                  : "#64748B",
              }]}>
                {profile?.verificationStatus === "verified" ? "Verified Alumni"
                  : profile?.verificationStatus === "pending" ? "Verification Pending"
                  : "Not Verified"}
              </Text>
              <Text style={[styles.statusSub, { color: colors.mutedForeground }]}>
                {profile?.verificationStatus === "verified"
                  ? "You are a verified alumni member"
                  : profile?.verificationStatus === "pending"
                  ? "Your request is under review"
                  : "Submit a request to get verified"}
              </Text>
            </View>
          </View>
          {(profile?.verificationStatus === "unverified" || !profile?.verificationStatus) && (
            <PremiumButton
              title="Request Verification"
              onPress={handleSubmitRequest}
              loading={submitting}
              style={{ marginTop: 12 }}
            />
          )}
        </PremiumCard>

        <PremiumCard>
          <Text style={[styles.howTitle, { color: colors.foreground }]}>How Verification Works</Text>
          {[
            { icon: "send-outline", text: "Submit a verification request" },
            { icon: "people-outline", text: "Verified alumni from your JNV will review your request" },
            { icon: "checkmark-circle-outline", text: "2 approvals from verified alumni needed" },
            { icon: "star-outline", text: "Once verified, you can mentor students and help verify others" },
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepIcon, { backgroundColor: colors.accent }]}>
                <Ionicons name={step.icon as any} size={16} color={colors.primary} />
              </View>
              <Text style={[styles.stepText, { color: colors.mutedForeground }]}>{step.text}</Text>
            </View>
          ))}
        </PremiumCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 16 },
  statusCard: { marginBottom: 0 },
  statusRow: { flexDirection: "row", gap: 14, alignItems: "flex-start", marginBottom: 4 },
  statusIconBg: { width: 52, height: 52, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  statusInfo: { flex: 1 },
  statusTitle: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 3 },
  statusValue: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 2 },
  statusSub: { fontSize: 13, fontFamily: "Inter_400Regular" },
  howTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 14 },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  stepIcon: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepText: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
});
