import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { signIn, signInWithGoogle, signInWithApple, forgotPassword } = useAuth();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [socialToast, setSocialToast] = useState("");
  const topPad    = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

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
        msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credentials") || msg.includes("auth/invalid")
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

  const handleSocial = async (provider: "Google" | "Apple") => {
    setErrorMsg("");
    setLoading(true);
    try {
      if (provider === "Google") await signInWithGoogle();
      else await signInWithApple();
      router.replace("/(tabs)");
    } catch (err: any) {
      if (err?.code === "auth/popup-closed-by-user" || err?.code === "ERR_REQUEST_CANCELED") {
        return;
      }
      setErrorMsg(err?.message || `${provider} sign-in couldn't be completed. Please try again.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.gradient}>
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
              <Ionicons name="people" size={48} color="#fff" />
            </View>
          </View>

          <Text style={styles.title}>Welcome Back</Text>
          <Text style={styles.subtitle}>Login to your JNV Connect account</Text>

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

            {/* Divider */}
            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Google */}
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

            {/* Apple */}
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
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/sign-up")}>
              <Text style={styles.footerLink}>Create Account →</Text>
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
  loginBtnText: { color: "#3D5AF1", fontFamily: "Inter_700Bold", fontSize: 16 },
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
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 15 },
  footerLink: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  toast: {
    position: "absolute", bottom: 36, left: 24, right: 24,
    backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  toastText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
