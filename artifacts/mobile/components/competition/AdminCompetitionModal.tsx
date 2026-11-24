import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OFFICIAL_HOUSES, type HouseName } from "@/constants/HouseTheme";
import { api } from "@/lib/api";

interface AdminCompetitionModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const HOUSES: HouseName[] = ["Aravali", "Nilgiri", "Shiwalik", "Udaygiri"];

export default function AdminCompetitionModal({
  visible,
  onClose,
  onSuccess,
}: AdminCompetitionModalProps) {
  const insets = useSafeAreaInsets();
  const [selectedHouse, setSelectedHouse] = useState<HouseName>("Aravali");
  const [targetUserId, setTargetUserId] = useState("");
  const [points, setPoints] = useState("50");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; error: boolean } | null>(null);

  const handleSubmitAdjustment = async () => {
    if (!targetUserId.trim()) {
      setStatusMessage({ text: "Please enter a valid User ID or student identifier", error: true });
      return;
    }
    const numPoints = parseInt(points, 10);
    if (isNaN(numPoints) || numPoints === 0) {
      setStatusMessage({ text: "Please enter a valid non-zero points amount", error: true });
      return;
    }
    if (!reason.trim()) {
      setStatusMessage({ text: "Mandatory audit reason is required for score adjustments", error: true });
      return;
    }

    try {
      setSubmitting(true);
      setStatusMessage(null);
      const res = await api.competition.adminScoreAdjust(
        targetUserId.trim(),
        selectedHouse,
        numPoints,
        reason.trim(),
      );

      setStatusMessage({ text: res.message || "Score adjusted successfully!", error: false });
      if (Platform.OS !== "web") {
        Alert.alert("Success", res.message || "Score adjusted successfully!");
      }
      setReason("");
      onSuccess?.();
    } catch (e: any) {
      const errMsg = e.message || "Failed to adjust score";
      setStatusMessage({ text: errMsg, error: true });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : undefined}
    >
      <View style={[styles.container, { paddingTop: Platform.OS === "web" ? 16 : insets.top + 8 }]}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTitleWrap}>
            <Ionicons name="shield-checkmark" size={22} color="#7C3AED" />
            <Text style={styles.headerTitle}>Competition Admin Hub</Text>
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={22} color="#1E293B" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Security Notice */}
          <View style={styles.noticeCard}>
            <Ionicons name="lock-closed" size={18} color="#059669" />
            <View style={styles.noticeInfo}>
              <Text style={styles.noticeTitle}>Official & Teacher Role Protected</Text>
              <Text style={styles.noticeSub}>
                All modifications generate immutable audit logs recorded to the competition ledger with your administrative signature.
              </Text>
            </View>
          </View>

          {/* Form */}
          <View style={styles.formCard}>
            <Text style={styles.formHeading}>Authoritative Score Adjustment</Text>

            {/* Target House Selection */}
            <Text style={styles.fieldLabel}>Select House</Text>
            <View style={styles.houseRow}>
              {HOUSES.map((h) => {
                const meta = OFFICIAL_HOUSES[h];
                const isSelected = selectedHouse === h;
                return (
                  <TouchableOpacity
                    key={h}
                    style={[
                      styles.houseBtn,
                      isSelected && {
                        backgroundColor: meta.bgColor,
                        borderColor: meta.color,
                        borderWidth: 2,
                      },
                    ]}
                    onPress={() => setSelectedHouse(h)}
                  >
                    <Text style={styles.houseBtnEmoji}>{meta.emoji}</Text>
                    <Text
                      style={[
                        styles.houseBtnText,
                        isSelected && { color: meta.color, fontWeight: "700" },
                      ]}
                    >
                      {meta.displayName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Target User ID */}
            <Text style={styles.fieldLabel}>Recipient User ID</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. user-uuid or student identifier"
              placeholderTextColor="#94A3B8"
              value={targetUserId}
              onChangeText={setTargetUserId}
              autoCapitalize="none"
            />

            {/* Points Amount */}
            <Text style={styles.fieldLabel}>Points (+ or -)</Text>
            <TextInput
              style={styles.input}
              placeholder="e.g. 50 or -20"
              placeholderTextColor="#94A3B8"
              value={points}
              onChangeText={setPoints}
              keyboardType="numbers-and-punctuation"
            />

            {/* Mandatory Reason */}
            <Text style={styles.fieldLabel}>Mandatory Audit Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="e.g. Sports Day 100m sprint gold medal, Debate competition first runner up..."
              placeholderTextColor="#94A3B8"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={3}
            />

            {statusMessage && (
              <View
                style={[
                  styles.statusBox,
                  statusMessage.error ? styles.statusBoxError : styles.statusBoxSuccess,
                ]}
              >
                <Ionicons
                  name={statusMessage.error ? "alert-circle" : "checkmark-circle"}
                  size={18}
                  color={statusMessage.error ? "#DC2626" : "#059669"}
                />
                <Text
                  style={[
                    styles.statusText,
                    statusMessage.error ? styles.statusTextError : styles.statusTextSuccess,
                  ]}
                >
                  {statusMessage.text}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
              onPress={handleSubmitAdjustment}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={18} color="#fff" />
                  <Text style={styles.submitBtnText}>Apply Ledger Adjustment</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#fff",
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#1E293B",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
  },
  scrollContent: {
    padding: 20,
    gap: 16,
  },
  noticeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  noticeInfo: {
    flex: 1,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#065F46",
    marginBottom: 2,
  },
  noticeSub: {
    fontSize: 11,
    color: "#047857",
    lineHeight: 16,
  },
  formCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  formHeading: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1E293B",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginTop: 4,
  },
  houseRow: {
    flexDirection: "row",
    gap: 8,
  },
  houseBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  houseBtnEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  houseBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 14,
    color: "#1E293B",
    backgroundColor: "#FAFAFA",
  },
  textArea: {
    height: 80,
    textAlignVertical: "top",
  },
  statusBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    gap: 8,
  },
  statusBoxError: {
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
  },
  statusBoxSuccess: {
    backgroundColor: "#F0FDF4",
    borderColor: "#BBF7D0",
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "600",
    flex: 1,
  },
  statusTextError: {
    color: "#DC2626",
  },
  statusTextSuccess: {
    color: "#059669",
  },
  submitBtn: {
    backgroundColor: "#7C3AED",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});
