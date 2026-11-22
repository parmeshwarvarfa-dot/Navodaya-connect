import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ role?: string; phone?: string }>();
  const { signIn, quickDemoLogin, signInWithGoogle, signInWithFacebook, signInWithApple, forgotPassword, pendingProfile } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [socialToast, setSocialToast] = useState("");
  const topPad    = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  useEffect(() => {
    if (pendingProfile) router.replace("/(auth)/sign-up?completeProfile=1" as any);
  }, [pendingProfile]);

  const handleDemoLogin = async (role: "student" | "alumni" | "teacher" | "official") => {
    setErrorMsg("");
    setLoading(true);
    try {
      if (quickDemoLogin) {
        await quickDemoLogin(role);
      } else {
        await signIn(role + "@test.com", "password123");
      }
      router.replace("/(tabs)");
    } catch (err: any) {
      setErrorMsg(err?.message || "Demo login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setErrorMsg("");
    if (!email.trim() || !password) {
      setErrorMsg("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      setErrorMsg(
        msg.includes("auth/api-key-not-valid")
          ? "Firebase sign-in is not configured correctly. Please reload the app and try again."
          : msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials") || msg.includes("auth/invalid")
          ? "Invalid email or password. Please try again."
          : msg.toLowerCase().includes("network")
          ? "Network error. Check your connection."
          : msg || "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg("");
    if (!email.trim()) {
      setErrorMsg("Enter your email address first.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSocialToast("Password reset email sent. Check your inbox.");
      setTimeout(() => setSocialToast(""), 3500);
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to send the password reset email.");
    } finally {
      setLoading(false);
    }
  };

  /* Detect if the app is served from a tunnel / non-standard preview domain */
  const isTunnelDomain =
    typeof window !== "undefined" &&
    Boolean(window.location?.hostname) &&
    /\.(trycloudflare\.com|ngrok(-free)?\.(?:app|io)|exp\.direct)$/i.test(
      window.location.hostname,
    );

  const handleSocial = async (provider: "Google" | "Facebook" | "Apple") => {
    setErrorMsg("");
    if (isTunnelDomain) {
      setErrorMsg(
        `${provider} sign-in is disabled on preview tunnels because the temporary domain is not authorized in Firebase. Please use 1-Tap Preview or email/password login.`
      );
      return;
    }
    setLoading(true);
    try {
      if (provider === "Google") await signInWithGoogle();
      else if (provider === "Facebook") await signInWithFacebook();
      else await signInWithApple();
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err?.code === "PROFILE_REQUIRED") {
        router.replace("/(auth)/sign-up?completeProfile=1" as any);
        return;
      }
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      const providerError =
        err?.code === "auth/operation-not-allowed"
          ? `Continue with ${provider} is not enabled in the Firebase project.`
          : err?.code === "auth/unauthorized-domain"
          ? `${provider} sign-in requires this domain to be authorized in Firebase Console. Please use email/password or 1-Tap Preview login.`
          : err?.code === "auth/popup-blocked"
          ? "Your browser blocked the sign-in window. Allow pop-ups and try again."
          : err?.code === "auth/api-key-not-valid"
          ? "Firebase configuration was not accepted. Reload the app and try again."
          : err?.message || `${provider} sign-in couldn't be completed. Please try again.`;
      setErrorMsg(providerError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#2E1065", "#4C1D95", "#6D28D9"]} style={styles.gradient}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 20, paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.iconWrap}>
            <View style={styles.iconCircle}>
              <Image
                source={require("@/assets/images/jnv-logo.jpg")}
                style={{ width: 68, height: 68, borderRadius: 34 }}
                resizeMode="contain"
              />
            </View>
          </View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to your JNV Connect account</Text>
          {params?.role ? (
            <View style={styles.roleBadge}>
              <Ionicons name="person-circle-outline" size={14} color="#D8C2FF" />
              <Text style={styles.roleBadgeText}>
                Selected Community: {params.role.toUpperCase()}
              </Text>
            </View>
          ) : null}

          <View style={styles.form}>
            {/* Email */}
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="rgba(255,255,255,0.75)" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Email"
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {/* Password */}
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="rgba(255,255,255,0.75)" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="Password"
                placeholderTextColor="rgba(255,255,255,0.65)"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.eyeBtn}>
                <Ionicons name={showPass ? "eye-off-outline" : "eye-outline"} size={18} color="rgba(255,255,255,0.75)" />
              </TouchableOpacity>
            </View>

            {/* Inline error */}
            {errorMsg ? (
              <View style={styles.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color="#fff" />
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : null}

            <TouchableOpacity style={styles.loginBtn} onPress={handleSignIn} disabled={loading} activeOpacity={0.85}>
              <Text style={styles.loginBtnText}>{loading ? "Logging in..." : "Login"}</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.forgotBtn} onPress={handleForgotPassword} disabled={loading}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* 1-Tap Quick Preview for Testing */}
            <View style={styles.quickSection}>
              <View style={styles.quickHeader}>
                <Ionicons name="flash" size={14} color="#FBBF24" />
                <Text style={styles.quickTitle}>1-TAP PREVIEW (INSTANT LOGIN)</Text>
              </View>
              <View style={styles.quickRow}>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => handleDemoLogin("student")}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickEmoji}>🎓</Text>
                  <Text style={styles.quickText}>Student</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => handleDemoLogin("alumni")}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickEmoji}>🏛️</Text>
                  <Text style={styles.quickText}>Alumni</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => handleDemoLogin("teacher")}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickEmoji}>📚</Text>
                  <Text style={styles.quickText}>Teacher</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => handleDemoLogin("official")}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  <Text style={styles.quickEmoji}>👔</Text>
                  <Text style={styles.quickText}>Official</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Divider & Social Login */}
            {!isTunnelDomain ? (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or continue with</Text>
                  <View style={styles.dividerLine} />
                </View>

                {Platform.OS === "web" && (
                  <TouchableOpacity
                    style={styles.socialBtn}
                    activeOpacity={0.85}
                    onPress={() => handleSocial("Google")}
                    disabled={loading}
                  >
                    <View style={styles.socialIconWrap}>
                      <Text style={styles.googleG}>G</Text>
                    </View>
                    <Text style={styles.socialBtnText}>Continue with Google</Text>
                  </TouchableOpacity>
                )}

                {Platform.OS === "web" && (
                  <TouchableOpacity
                    style={styles.socialBtn}
                    activeOpacity={0.85}
                    onPress={() => handleSocial("Facebook")}
                    disabled={loading}
                  >
                    <View style={styles.socialIconWrap}>
                      <Text style={[styles.googleG, { color: "#1877F2" }]}>f</Text>
                    </View>
                    <Text style={styles.socialBtnText}>Continue with Facebook</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[styles.socialBtn, styles.appleSocialBtn]}
                  activeOpacity={0.85}
                  onPress={() => handleSocial("Apple")}
                  disabled={loading}
                >
                  <View style={[styles.socialIconWrap, styles.appleIconWrap]}>
                    <Ionicons name="logo-apple" size={20} color="#fff" />
                  </View>
                  <Text style={[styles.socialBtnText, { color: "#fff" }]}>Continue with Apple</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={styles.tunnelNote}>
                <Ionicons name="shield-checkmark-outline" size={16} color="#FBBF24" />
                <Text style={styles.tunnelNoteText}>
                  Preview Mode: Dynamic tunnel domain detected. Use the 1-Tap Preview buttons above or email & password to sign in.
                </Text>
              </View>
            )}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/sign-up")}>
              <Text style={styles.footerLink}>Create Account →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.exploreFooter}>
            <TouchableOpacity
              onPress={() => router.push("/(screens)/explore" as any)}
              style={styles.explorePill}
              activeOpacity={0.8}
            >
              <Ionicons name="compass-outline" size={14} color="#D8C2FF" />
              <Text style={styles.explorePillText}>Explore Navodaya Connect Previews</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.replace("/onboarding")}
              style={styles.replayLink}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={12} color="rgba(255,255,255,0.7)" />
              <Text style={styles.replayLinkText}>Replay Launch Experience</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Social toast */}
      {socialToast ? (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="time-outline" size={15} color="#fff" />
          <Text style={styles.toastText}>{socialToast}</Text>
        </View>
      ) : null}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { paddingHorizontal: 28, alignItems: "stretch" },
  iconWrap: { alignItems: "center", marginBottom: 24 },
  iconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  title: { fontFamily: "Pacifico_400Regular", fontSize: 30, color: "#fff", textAlign: "center", marginBottom: 8 },
  subtitle: { fontFamily: "Inter_400Regular", fontSize: 14, color: "rgba(255,255,255,0.75)", textAlign: "center", marginBottom: 32 },
  form: { gap: 14 },
  inputWrap: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 28, paddingHorizontal: 18, height: 54,
  },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, color: "#fff", fontFamily: "Inter_400Regular", fontSize: 15 },
  eyeBtn: { padding: 4 },
  quickSection: {
    backgroundColor: "rgba(255, 255, 255, 0.12)",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
    marginVertical: 4,
  },
  quickHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
    justifyContent: "center",
  },
  quickTitle: {
    color: "#FDE68A",
    fontFamily: "Inter_700Bold",
    fontSize: 11,
    letterSpacing: 0.6,
  },
  quickRow: {
    flexDirection: "row",
    gap: 6,
    justifyContent: "space-between",
  },
  quickBtn: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    borderRadius: 12,
    paddingVertical: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  quickEmoji: {
    fontSize: 18,
    marginBottom: 2,
  },
  quickText: {
    color: "#4C1D95",
    fontFamily: "Inter_600SemiBold",
    fontSize: 11,
  },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(239,68,68,0.85)", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
  },
  errorText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, lineHeight: 18 },
  loginBtn: {
    backgroundColor: "#fff", borderRadius: 28, height: 54,
    alignItems: "center", justifyContent: "center", marginTop: 4,
  },
  loginBtnText: { color: "#5B21B6", fontFamily: "Inter_700Bold", fontSize: 16 },
  forgotBtn: { alignItems: "center", paddingVertical: 2 },
  forgotText: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 14 },
  dividerRow: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: "rgba(255,255,255,0.25)" },
  dividerText: { color: "rgba(255,255,255,0.65)", fontFamily: "Inter_400Regular", fontSize: 13 },
  socialBtn: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#fff", borderRadius: 28, height: 54,
    paddingHorizontal: 20,
  },
  appleSocialBtn: { backgroundColor: "#111" },
  socialIconWrap: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center",
  },
  appleIconWrap: { backgroundColor: "#333" },
  googleG: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#EA4335" },
  socialBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#111827" },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 24 },
  footerText: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 14 },
  footerLink: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  roleBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    borderRadius: 999,
    alignSelf: "center",
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(216, 194, 255, 0.4)",
  },
  roleBadgeText: {
    color: "#D8C2FF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12,
    letterSpacing: 0.5,
  },
  exploreFooter: {
    alignItems: "center",
    gap: 12,
    marginTop: 18,
    paddingBottom: 16,
  },
  explorePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(216, 194, 255, 0.4)",
  },
  explorePillText: {
    color: "#EFE6FF",
    fontFamily: "Inter_600SemiBold",
    fontSize: 12.5,
  },
  replayLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
  },
  replayLinkText: {
    color: "rgba(255, 255, 255, 0.75)",
    fontFamily: "Inter_500Medium",
    fontSize: 12,
  },
  toast: {
    position: "absolute", bottom: 36, left: 24, right: 24,
    backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  toastText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
  tunnelNote: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 10, marginTop: 4,
  },
  tunnelNoteText: {
    flex: 1, color: "rgba(255,255,255,0.85)", fontFamily: "Inter_400Regular",
    fontSize: 12, lineHeight: 17,
  },
});
