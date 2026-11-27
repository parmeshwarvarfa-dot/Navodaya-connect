import React, { useEffect, useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Image,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type RoleType = "student" | "alumni" | "teacher" | "official";

const ROLES: {
  id: RoleType;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
}[] = [
  {
    id: "student",
    title: "Student",
    subtitle: "Current Scholar",
    icon: "school-outline",
  },
  {
    id: "alumni",
    title: "Alumni",
    subtitle: "Graduate & Pro",
    icon: "ribbon-outline",
  },
  {
    id: "teacher",
    title: "Teacher",
    subtitle: "Faculty & Mentor",
    icon: "book-outline",
  },
  {
    id: "official",
    title: "JNV Official",
    subtitle: "Administration",
    icon: "shield-checkmark-outline",
  },
];

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ role?: string; phone?: string }>();
  const {
    signIn,
    quickDemoLogin,
    signInWithGoogle,
    signInWithFacebook,
    signInWithApple,
    forgotPassword,
    pendingProfile,
  } = useAuth();

  const initialRole: RoleType =
    params?.role && ["student", "alumni", "teacher", "official"].includes(params.role.toLowerCase())
      ? (params.role.toLowerCase() as RoleType)
      : "alumni";

  const [currentRole, setCurrentRole] = useState<RoleType>(initialRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [toastMsg, setToastMsg] = useState("");

  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : Math.max(insets.bottom, 20);

  useEffect(() => {
    if (pendingProfile) router.replace("/(auth)/sign-up?completeProfile=1" as any);
  }, [pendingProfile]);

  useEffect(() => {
    if (params?.role) {
      const r = params.role.toLowerCase() as RoleType;
      if (["student", "alumni", "teacher", "official"].includes(r)) {
        setCurrentRole(r);
        setErrorMsg("");
      }
    }
  }, [params?.role]);

  const handleRoleSelect = (role: RoleType) => {
    setCurrentRole(role);
    setErrorMsg("");
  };

  const handleDemoLogin = async (role: RoleType) => {
    setErrorMsg("");
    setLoading(true);
    try {
      if (quickDemoLogin) {
        await quickDemoLogin(role);
      } else {
        await signIn(`${role}@test.com`, "password123");
      }
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.includes("530") || msg.toLowerCase().includes("unreachable")) {
        setErrorMsg("Server temporarily unreachable. Please check your connection and try again.");
      } else {
        setErrorMsg(msg || "Demo login failed");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async () => {
    setErrorMsg("");
    const targetEmail = email.trim();
    const targetPassword = password;

    if (!targetEmail) {
      setErrorMsg("Please enter your email address.");
      return;
    }
    if (!targetPassword) {
      setErrorMsg("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      if (
        targetEmail.endsWith("@test.com") &&
        ["student", "alumni", "teacher", "official"].includes(targetEmail.replace("@test.com", ""))
      ) {
        const role = targetEmail.replace("@test.com", "") as RoleType;
        await handleDemoLogin(role);
        return;
      }

      await signIn(targetEmail, targetPassword);
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      if (msg.includes("530") || msg.toLowerCase().includes("unreachable")) {
        setErrorMsg("Server temporarily unreachable. Please check your network or try again in a moment.");
      } else if (msg.includes("auth/api-key-not-valid")) {
        setErrorMsg("Authentication service is temporarily unavailable. Please reload the app.");
      } else if (
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("credentials") ||
        msg.includes("auth/invalid")
      ) {
        setErrorMsg("Invalid email or password. Please verify and try again.");
      } else if (msg.toLowerCase().includes("network")) {
        setErrorMsg("Network error. Please check your internet connection.");
      } else {
        setErrorMsg(msg || "Sign in failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setErrorMsg("");
    if (!email.trim()) {
      setErrorMsg("Please enter your email address above to receive a reset link.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setToastMsg("Password reset link sent to your email.");
      setTimeout(() => setToastMsg(""), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to send password reset email.");
    } finally {
      setLoading(false);
    }
  };

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
        `${provider} sign-in is disabled on preview tunnels. Please use email/password or 1-Tap Demo login.`
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
      setErrorMsg(err?.message || `${provider} sign-in could not be completed.`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.mainContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: topPad, paddingBottom: bottomPad + 30 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── 1. Top Brand Hero Header ── */}
        <LinearGradient
          colors={["#3B0764", "#4C1D95", "#6D28D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroHeader}
        >
          {/* Subtle Ambient Light Decoration */}
          <View style={styles.ambientGlowLight} />

          {/* Logo & Emblem */}
          <View style={styles.logoRow}>
            <View style={styles.logoBadgeContainer}>
              <Image
                source={require("@/assets/images/jnv-logo.jpg")}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View>
              <Text style={styles.brandTitle}>Navodaya Connect</Text>
              <View style={styles.taglinePill}>
                <Text style={styles.taglinePillText}>ONE NAVODAYA • ONE COMMUNITY</Text>
              </View>
            </View>
          </View>

          {/* Welcome Message */}
          <Text style={styles.heroWelcomeHeading}>
            Welcome to Your Navodaya Family
          </Text>
          <Text style={styles.heroSubText}>
            Connecting students, alumni, and teachers across 661+ Jawahar Navodaya Vidyalayas nationwide.
          </Text>
        </LinearGradient>

        {/* ── 2. Role Selector (4 Communities) ── */}
        <View style={styles.roleSection}>
          <Text style={styles.sectionHeaderLabel}>SELECT YOUR NAVODAYA IDENTITY</Text>
          <View style={styles.roleGrid}>
            {ROLES.map((r) => {
              const isSelected = currentRole === r.id;
              return (
                <TouchableOpacity
                  key={r.id}
                  style={[styles.roleCard, isSelected && styles.roleCardActive]}
                  onPress={() => handleRoleSelect(r.id)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Select ${r.title} identity`}
                >
                  <View
                    style={[
                      styles.roleIconWrap,
                      isSelected && styles.roleIconWrapActive,
                    ]}
                  >
                    <Ionicons
                      name={r.icon}
                      size={20}
                      color={isSelected ? "#7C3AED" : "#64748B"}
                    />
                  </View>
                  <View style={styles.roleTextWrap}>
                    <Text
                      style={[
                        styles.roleCardTitle,
                        isSelected && styles.roleCardTitleActive,
                      ]}
                    >
                      {r.title}
                    </Text>
                    <Text style={styles.roleCardSub}>{r.subtitle}</Text>
                  </View>
                  {isSelected && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#7C3AED" />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── 3. Clean White Login Form Card ── */}
        <View style={styles.formCard}>
          <Text style={styles.formCardTitle}>Sign In</Text>
          <Text style={styles.formCardSub}>
            Enter your credentials to access your community feed
          </Text>

          {/* Error Message Alert */}
          {errorMsg ? (
            <View style={styles.errorAlert}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" style={{ marginTop: 1 }} />
              <Text style={styles.errorAlertText}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Email Address Field */}
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Email Address</Text>
            <View style={styles.inputFieldContainer}>
              <Ionicons name="mail-outline" size={18} color="#64748B" style={styles.fieldIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="e.g. rahul.alumni@jnv.ac.in"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          </View>

          {/* Password Field */}
          <View style={styles.inputGroup}>
            <View style={styles.passwordLabelRow}>
              <Text style={styles.inputLabel}>Password</Text>
              <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
                <Text style={styles.forgotPasswordLink}>Forgot Password?</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.inputFieldContainer}>
              <Ionicons
                name="lock-closed-outline"
                size={18}
                color="#64748B"
                style={styles.fieldIcon}
              />
              <TextInput
                style={[styles.textInput, { flex: 1 }]}
                placeholder="Enter your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                onPress={() => setShowPass(!showPass)}
                style={styles.eyeToggleBtn}
                accessibilityLabel={showPass ? "Hide password" : "Show password"}
              >
                <Ionicons
                  name={showPass ? "eye-off-outline" : "eye-outline"}
                  size={18}
                  color="#64748B"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Primary Sign In Button */}
          <TouchableOpacity
            style={styles.primaryLoginBtn}
            onPress={handleSignIn}
            disabled={loading}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="Sign In"
          >
            <LinearGradient
              colors={["#7C3AED", "#6D28D9"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.loginBtnGradient}
            >
              {loading ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.loginBtnText}>Signing In...</Text>
                </View>
              ) : (
                <Text style={styles.loginBtnText}>Sign In to Navodaya Connect</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* 1-Tap Demo Access (For review and development) */}
          <View style={styles.demoSection}>
            <View style={styles.demoHeader}>
              <Ionicons name="flash" size={13} color="#D97706" />
              <Text style={styles.demoHeaderText}>QUICK DEMO & PROTOTYPE ACCESS</Text>
            </View>
            <View style={styles.demoPillsRow}>
              {(["student", "alumni", "teacher", "official"] as const).map((r) => (
                <TouchableOpacity
                  key={`demo-${r}`}
                  style={[
                    styles.demoPill,
                    currentRole === r && styles.demoPillActive,
                  ]}
                  onPress={() => {
                    handleRoleSelect(r);
                    handleDemoLogin(r);
                  }}
                  disabled={loading}
                >
                  <Text
                    style={[
                      styles.demoPillText,
                      currentRole === r && styles.demoPillTextActive,
                    ]}
                  >
                    {r.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Social Sign-In (When not in preview tunnel) */}
          {!isTunnelDomain && (
            <>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>or continue with</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.socialRow}>
                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => handleSocial("Google")}
                  disabled={loading}
                >
                  <Text style={styles.googleIconText}>G</Text>
                  <Text style={styles.socialBtnText}>Google</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.socialBtn}
                  onPress={() => handleSocial("Apple")}
                  disabled={loading}
                >
                  <Ionicons name="logo-apple" size={17} color="#0F172A" />
                  <Text style={styles.socialBtnText}>Apple</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>

        {/* ── 4. Create Account & Secondary Actions ── */}
        <View style={styles.bottomActionsArea}>
          <View style={styles.createAccountRow}>
            <Text style={styles.createAccountText}>New to Navodaya Connect? </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/sign-up")}>
              <Text style={styles.createAccountLink}>Create Account →</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.secondaryLinksRow}>
            <TouchableOpacity
              style={styles.exploreLinkBtn}
              onPress={() => router.push("/(screens)/explore" as any)}
              activeOpacity={0.75}
            >
              <Ionicons name="compass-outline" size={15} color="#7C3AED" />
              <Text style={styles.exploreLinkText}>Explore Navodaya Connect Previews</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.storeAdminIconBtn}
              onPress={() => router.push("/store-admin" as any)}
              activeOpacity={0.75}
              accessibilityRole="button"
              accessibilityLabel="Store Admin Sign In"
            >
              <Ionicons name="shield-checkmark-outline" size={16} color="#7C3AED" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Floating Success Toast */}
      {toastMsg ? (
        <View style={styles.toastCard} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.toastCardText}>{toastMsg}</Text>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  mainContainer: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  scrollContent: {
    alignItems: "stretch",
  },

  // 1. Hero Header
  heroHeader: {
    paddingHorizontal: 22,
    paddingTop: 28,
    paddingBottom: 32,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    position: "relative",
    overflow: "hidden",
  },
  ambientGlowLight: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: "#8B5CF6",
    opacity: 0.25,
    ...Platform.select({
      web: { filter: "blur(40px)" } as any,
    }),
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  logoBadgeContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FDE68A",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  logoImage: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  taglinePill: {
    backgroundColor: "rgba(255, 255, 255, 0.16)",
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 8,
    marginTop: 2,
    alignSelf: "flex-start",
  },
  taglinePillText: {
    fontSize: 9.5,
    fontWeight: "600",
    color: "#F3E8FF",
    letterSpacing: 0.6,
  },
  heroWelcomeHeading: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
    marginBottom: 6,
  },
  heroSubText: {
    fontSize: 12.5,
    color: "#E9D5FF",
    lineHeight: 18,
    maxWidth: 380,
  },

  // 2. Role Selector
  roleSection: {
    paddingHorizontal: 18,
    marginTop: 18,
    marginBottom: 14,
  },
  sectionHeaderLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#6D28D9",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 2,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  roleCard: {
    width: "48.5%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 10,
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 1,
  },
  roleCardActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#7C3AED",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  roleIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F8FAFC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  roleIconWrapActive: {
    backgroundColor: "#EDE9FE",
  },
  roleTextWrap: {
    flex: 1,
  },
  roleCardTitle: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#1E293B",
  },
  roleCardTitleActive: {
    color: "#6D28D9",
    fontWeight: "700",
  },
  roleCardSub: {
    fontSize: 9.5,
    color: "#64748B",
    marginTop: 1,
  },
  checkBadge: {
    position: "absolute",
    top: 6,
    right: 6,
  },

  // 3. Form Card
  formCard: {
    marginHorizontal: 18,
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  formCardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0F172A",
    marginBottom: 4,
    letterSpacing: -0.2,
  },
  formCardSub: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 16,
  },
  errorAlert: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 12,
    padding: 10,
    marginBottom: 14,
  },
  errorAlertText: {
    flex: 1,
    fontSize: 12,
    color: "#B91C1C",
    lineHeight: 16,
    fontWeight: "500",
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 6,
  },
  passwordLabelRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  forgotPasswordLink: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#7C3AED",
  },
  inputFieldContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
  },
  fieldIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: "#0F172A",
    paddingVertical: 4,
  },
  eyeToggleBtn: {
    padding: 6,
  },
  primaryLoginBtn: {
    borderRadius: 14,
    overflow: "hidden",
    marginTop: 6,
    marginBottom: 14,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 4,
  },
  loginBtnGradient: {
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  loginBtnText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },

  // Demo Section
  demoSection: {
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 14,
    padding: 10,
    marginTop: 4,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 8,
  },
  demoHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  demoPillsRow: {
    flexDirection: "row",
    gap: 6,
  },
  demoPill: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#FCD34D",
    paddingVertical: 6,
    borderRadius: 8,
    alignItems: "center",
  },
  demoPillActive: {
    backgroundColor: "#7C3AED",
    borderColor: "#6D28D9",
  },
  demoPillText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400E",
  },
  demoPillTextActive: {
    color: "#FFFFFF",
  },

  // Social Login
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginVertical: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#F1F5F9",
  },
  dividerText: {
    fontSize: 11.5,
    color: "#94A3B8",
    fontWeight: "500",
  },
  socialRow: {
    flexDirection: "row",
    gap: 10,
  },
  socialBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    height: 42,
  },
  googleIconText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#EA4335",
  },
  socialBtnText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: "#334155",
  },

  // 4. Bottom Area
  bottomActionsArea: {
    alignItems: "center",
    marginTop: 18,
    gap: 12,
  },
  createAccountRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  createAccountText: {
    fontSize: 13,
    color: "#64748B",
  },
  createAccountLink: {
    fontSize: 13,
    fontWeight: "700",
    color: "#7C3AED",
  },
  secondaryLinksRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exploreLinkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 16,
  },
  storeAdminIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  exploreLinkText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6D28D9",
  },

  // Toast
  toastCard: {
    position: "absolute",
    bottom: 24,
    left: 20,
    right: 20,
    backgroundColor: "#1E1B4B",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 8,
  },
  toastCardText: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
});
