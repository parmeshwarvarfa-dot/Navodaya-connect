import React from "react";
import {
  Modal, View, Text, StyleSheet, TouchableOpacity, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

interface Props {
  visible: boolean;
  onClose: () => void;
  featureName?: string;
}

const BENEFITS = [
  { icon: "chatbubble-outline" as const,   text: "Send messages & join group chats" },
  { icon: "people-outline" as const,       text: "Network with alumni & peers" },
  { icon: "calendar-outline" as const,     text: "RSVP to JNV events" },
  { icon: "shield-checkmark-outline" as const, text: "Get your verified badge" },
];

export function VerificationGateModal({ visible, onClose, featureName }: Props) {
  const handleVerifyNow = () => {
    onClose();
    router.push("/(screens)/verification-center" as any);
  };

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={s.overlay}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <View style={s.sheet}>
          <View style={s.iconWrap}>
            <View style={s.iconCircle}>
              <Ionicons name="shield-outline" size={36} color="#1A3C6E" />
            </View>
            <View style={s.lockBadge}>
              <Ionicons name="lock-closed" size={12} color="#fff" />
            </View>
          </View>

          <Text style={s.title}>Verification Required</Text>
          <Text style={s.desc}>
            {featureName
              ? `"${featureName}" is available only to verified Navodaya Connect members.`
              : "This feature is available only to verified users."}
            {"\n\n"}Complete your verification to unlock the full Navodaya Connect experience.
          </Text>

          <View style={s.benefitsList}>
            {BENEFITS.map((b) => (
              <View key={b.text} style={s.benefitRow}>
                <View style={s.benefitIcon}>
                  <Ionicons name={b.icon} size={14} color="#1A3C6E" />
                </View>
                <Text style={s.benefitText}>{b.text}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity style={s.verifyBtn} onPress={handleVerifyNow} activeOpacity={0.88}>
            <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
            <Text style={s.verifyBtnText}>Verify Now</Text>
          </TouchableOpacity>

          <TouchableOpacity style={s.laterBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={s.laterBtnText}>Later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

export function useVerificationGate(isVerified: boolean) {
  const [visible, setVisible] = React.useState(false);
  const [featureName, setFeatureName] = React.useState<string | undefined>();

  const tryAccess = React.useCallback((name?: string, onGranted?: () => void) => {
    if (isVerified) {
      onGranted?.();
      return true;
    }
    setFeatureName(name);
    setVisible(true);
    return false;
  }, [isVerified]);

  const modal = (
    <VerificationGateModal
      visible={visible}
      onClose={() => setVisible(false)}
      featureName={featureName}
    />
  );

  return { tryAccess, modal, gateVisible: visible, closeGate: () => setVisible(false) };
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 36,
    alignItems: "center",
    gap: 0,
  },
  iconWrap: {
    position: "relative",
    marginBottom: 20,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#C7D2FE",
  },
  lockBadge: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FF7A00",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    marginBottom: 10,
    textAlign: "center",
  },
  desc: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
  },
  benefitsList: {
    width: "100%",
    backgroundColor: "#F8FAFF",
    borderRadius: 14,
    padding: 14,
    gap: 10,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#E8EDFF",
  },
  benefitRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  benefitIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  benefitText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#374151",
  },
  verifyBtn: {
    width: "100%",
    backgroundColor: "#1A3C6E",
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 10,
  },
  verifyBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  laterBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  laterBtnText: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: "#9CA3AF",
  },
});
