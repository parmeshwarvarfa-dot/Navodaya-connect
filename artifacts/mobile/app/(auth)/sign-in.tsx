import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { PremiumInput } from "@/components/PremiumInput";
import { PremiumButton } from "@/components/PremiumButton";
import { useColors } from "@/hooks/useColors";

export default function SignInScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const validate = () => {
    const e: typeof errors = {};
    if (!email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    if (!password) e.password = "Password is required";
    else if (password.length < 6) e.password = "Min 6 characters";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSignIn = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace("/(tabs)");
    } catch (err: any) {
      const message: string = err?.message ?? "";
      const msg =
        message.toLowerCase().includes("invalid credentials") || message.toLowerCase().includes("invalid email or password")
          ? "Invalid email or password. Please try again."
          : message.toLowerCase().includes("network") || message.toLowerCase().includes("failed to fetch")
          ? "Network error. Check your connection."
          : message || "Sign in failed. Please try again.";
      Alert.alert("Sign In Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.headerGradient, { paddingTop: topPad + 20 }]}
      >
        <View style={styles.logoRow}>
          <View style={styles.logoCircle}>
            <Ionicons name="school" size={28} color="#FF7A00" />
          </View>
          <View style={styles.logoText}>
            <Text style={styles.appName}>Navodaya Connect</Text>
            <Text style={styles.appTagline}>Navodayans Together</Text>
          </View>
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.heading, { color: colors.foreground }]}>Welcome back</Text>
        <Text style={[styles.subheading, { color: colors.mutedForeground }]}>
          Sign in to your Navodaya account
        </Text>

        <View style={styles.form}>
          <PremiumInput
            label="Email address"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            icon="mail-outline"
            error={errors.email}
          />
          <PremiumInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            isPassword
            icon="lock-closed-outline"
            error={errors.password}
          />

          <PremiumButton
            title="Sign In"
            onPress={handleSignIn}
            loading={loading}
            style={{ marginTop: 8 }}
          />

          <TouchableOpacity style={styles.forgotBtn}>
            <Text style={[styles.forgotText, { color: colors.primary }]}>
              Forgot password?
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Don't have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/sign-up")}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign Up</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerGradient: {
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  logoCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { gap: 2 },
  appName: {
    color: "#fff",
    fontSize: 20,
    fontFamily: "Inter_700Bold",
  },
  appTagline: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    fontFamily: "Inter_400Regular",
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 32,
  },
  heading: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  subheading: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    marginBottom: 28,
  },
  form: { gap: 0 },
  forgotBtn: {
    alignSelf: "flex-end",
    marginTop: 12,
    padding: 4,
  },
  forgotText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
  footerLink: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
});
