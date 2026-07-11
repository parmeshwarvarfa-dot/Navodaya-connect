import React, { useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, Animated, Platform, Dimensions, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "@/context/AuthContext";

const { width } = Dimensions.get("window");

const FEATURES = [
  { icon: "shield-checkmark-outline" as const,  color: "#10B981", bg: "#ECFDF5", text: "Green verified badge on your profile" },
  { icon: "chatbubble-ellipses-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", text: "Send messages & join group chats" },
  { icon: "people-outline" as const,            color: "#8B5CF6", bg: "#F5F3FF", text: "Network with alumni across India" },
  { icon: "calendar-outline" as const,          color: "#F59E0B", bg: "#FFFBEB", text: "RSVP to JNV events & meetups" },
  { icon: "school-outline" as const,            color: "#EF4444", bg: "#FEF2F2", text: "Access mentorship & community features" },
];

export default function VerificationWelcomeScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const { profile } = useAuth();

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 60, friction: 10, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 10, useNativeDriver: true }),
    ]).start();
  }, []);

  const markShownAndGo = async (destination: "/(screens)/verification-center" | "/(tabs)") => {
    try {
      if (profile?.uid) {
        await AsyncStorage.setItem(`verification_welcome_shown_${profile.uid}`, "1");
      }
    } catch {}
    router.replace(destination as any);
  };

  return (
    <View style={s.container}>
      <LinearGradient colors={["#1A3C6E", "#2D5A9E", "#1A3C6E"]} style={s.bg} />

      <Animated.View
        style={[
          s.contentWrap,
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
        ]}
      >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[s.content, { paddingTop: topPad + 20 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Badge icon */}
        <Animated.View style={[s.badgeWrap, { transform: [{ scale: scaleAnim }] }]}>
          <View style={s.badgeOuter}>
            <View style={s.badgeInner}>
              <Ionicons name="shield-checkmark" size={48} color="#10B981" />
            </View>
          </View>
          <View style={s.glow} />
        </Animated.View>

        <Text style={s.greeting}>Welcome, {profile?.fullName?.split(" ")[0] ?? "Navodayan"}! 🎉</Text>
        <Text style={s.title}>Unlock the Full{"\n"}Navodaya Connect</Text>
        <Text style={s.subtitle}>
          Get verified to access the complete community experience — messaging, events, mentorship, and more.
        </Text>

        {/* Feature list */}
        <View style={s.featureCard}>
          {FEATURES.map((f, i) => (
            <View key={f.text} style={[s.featureRow, i < FEATURES.length - 1 && s.featureRowBorder]}>
              <View style={[s.featureIcon, { backgroundColor: f.bg }]}>
                <Ionicons name={f.icon} size={18} color={f.color} />
              </View>
              <Text style={s.featureText}>{f.text}</Text>
              <Ionicons name="checkmark-circle" size={16} color="#D1D5DB" />
            </View>
          ))}
        </View>

        {/* Pending badge hint */}
        <View style={s.pendingHint}>
          <Ionicons name="time-outline" size={14} color="#F59E0B" />
          <Text style={s.pendingHintText}>Verification usually takes 24–48 hours after submission</Text>
        </View>

        {/* Actions */}
        <View style={s.actions}>
          <TouchableOpacity
            style={s.verifyBtn}
            onPress={() => markShownAndGo("/(screens)/verification-center")}
            activeOpacity={0.88}
          >
            <LinearGradient colors={["#FF7A00", "#FF9A3C"]} style={s.verifyBtnGrad}>
              <Ionicons name="shield-checkmark-outline" size={20} color="#fff" />
              <Text style={s.verifyBtnText}>Complete Verification</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={s.skipBtn}
            onPress={() => markShownAndGo("/(tabs)")}
            activeOpacity={0.7}
          >
            <Text style={s.skipBtnText}>Skip for Now · Enter Dashboard</Text>
            <Ionicons name="arrow-forward" size={16} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        <Text style={s.footnote}>
          You can always complete verification later from your Profile
        </Text>
      </Animated.View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  bg: { ...StyleSheet.absoluteFillObject },
  content: {
    flex: 1,
    paddingHorizontal: 22,
    paddingBottom: 32,
    alignItems: "center",
  },
  badgeWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  badgeOuter: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  badgeInner: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
  },
  greeting: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "rgba(255,255,255,0.8)",
    marginBottom: 6,
  },
  title: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
    textAlign: "center",
    lineHeight: 36,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  featureCard: {
    width: "100%",
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
  },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  featureRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.1)",
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  featureText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
  pendingHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 24,
  },
  pendingHintText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.65)",
  },
  actions: {
    width: "100%",
    gap: 10,
    marginBottom: 16,
  },
  verifyBtn: {
    borderRadius: 14,
    overflow: "hidden",
    shadowColor: "#FF7A00",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8,
  },
  verifyBtnGrad: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
  },
  verifyBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  skipBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  skipBtnText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.85)",
  },
  footnote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
});
