import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Alert,
  Modal,
  FlatList,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, UserRole } from "@/context/AuthContext";
import { PremiumInput } from "@/components/PremiumInput";
import { PremiumButton } from "@/components/PremiumButton";
import { useColors } from "@/hooks/useColors";
import { JNV_DATA, STATES } from "@/data/jnvData";

const ROLES: { value: UserRole; label: string; icon: string }[] = [
  { value: "student", label: "Student", icon: "school-outline" },
  { value: "alumni", label: "Alumni", icon: "people-outline" },
  { value: "teacher", label: "Teacher", icon: "book-outline" },
  { value: "official", label: "Official", icon: "briefcase-outline" },
];

const HOUSES = ["Aravali", "Nilgiri", "Shivalik", "Udaygiri"] as const;

function DropdownPicker({
  label,
  value,
  placeholder,
  options,
  onSelect,
  disabled,
  error,
}: {
  label: string;
  value: string;
  placeholder: string;
  options: string[];
  onSelect: (v: string) => void;
  disabled?: boolean;
  error?: string;
}) {
  const colors = useColors();
  const [open, setOpen] = useState(false);

  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={[ddStyles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <TouchableOpacity
        disabled={disabled}
        onPress={() => setOpen(true)}
        style={[
          ddStyles.trigger,
          {
            borderColor: error ? colors.destructive : colors.border,
            borderRadius: colors.radius - 4,
            backgroundColor: disabled ? colors.muted : colors.card,
          },
        ]}
      >
        <Text
          style={[
            ddStyles.value,
            { color: value ? colors.foreground : colors.mutedForeground },
          ]}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color={colors.mutedForeground} />
      </TouchableOpacity>
      {error && <Text style={[ddStyles.error, { color: colors.destructive }]}>{error}</Text>}

      <Modal visible={open} animationType="slide" presentationStyle="formSheet">
        <View style={[ddStyles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[ddStyles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[ddStyles.modalTitle, { color: colors.foreground }]}>{label}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <TouchableOpacity
                onPress={() => {
                  onSelect(item);
                  setOpen(false);
                }}
                style={[
                  ddStyles.option,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor:
                      item === value ? colors.accent : "transparent",
                  },
                ]}
              >
                <Text
                  style={[
                    ddStyles.optionText,
                    {
                      color: item === value ? colors.primary : colors.foreground,
                      fontFamily:
                        item === value ? "Inter_600SemiBold" : "Inter_400Regular",
                    },
                  ]}
                >
                  {item}
                </Text>
                {item === value && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </View>
  );
}

const ddStyles = StyleSheet.create({
  label: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 6 },
  trigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 52,
  },
  value: { fontSize: 15, fontFamily: "Inter_400Regular" },
  error: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 4 },
  modalContainer: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 20,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  option: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  optionText: { fontSize: 15 },
});

export default function SignUpScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole | "">("");
  const [jnvState, setJnvState] = useState("");
  const [jnvName, setJnvName] = useState("");
  const [house, setHouse] = useState("");
  // Role-specific
  const [studentClass, setStudentClass] = useState("");
  const [enrollYear, setEnrollYear] = useState("");
  const [passoutYear, setPassoutYear] = useState("");
  const [profession, setProfession] = useState("");
  const [field, setField] = useState("");
  const [company, setCompany] = useState("");
  const [skills, setSkills] = useState("");
  const [subject, setSubject] = useState("");
  const [designation, setDesignation] = useState("");

  const [errors, setErrors] = useState<Record<string, string>>({});

  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const validateStep1 = () => {
    const e: Record<string, string> = {};
    if (!fullName.trim()) e.fullName = "Full name required";
    if (!email.trim()) e.email = "Email required";
    else if (!/\S+@\S+\.\S+/.test(email)) e.email = "Invalid email";
    if (!password) e.password = "Password required";
    else if (password.length < 6) e.password = "Min 6 characters";
    if (!role) e.role = "Select a role";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validateStep2 = () => {
    const e: Record<string, string> = {};
    if (!jnvState) e.jnvState = "Select your state";
    if (!jnvName) e.jnvName = "Select your JNV";
    if (!house) e.house = "Select your house";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
  };

  const handleSignUp = async () => {
    setLoading(true);
    try {
      await signUp(email.trim(), password, {
        fullName: fullName.trim(),
        email: email.trim(),
        role: role as UserRole,
        jnvState,
        jnvName,
        house: house as any,
        class: role === "student" ? studentClass : undefined,
        enrollYear: role === "alumni" ? enrollYear : undefined,
        passoutYear: role === "alumni" ? passoutYear : undefined,
        profession: role === "alumni" ? profession : undefined,
        field: role === "alumni" ? field : undefined,
        company: role === "alumni" ? company : undefined,
        skills: role === "alumni" ? skills.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        subject: role === "teacher" ? subject : undefined,
        designation: role === "official" ? designation : undefined,
      });
      router.replace("/(tabs)");
    } catch (err: any) {
      const message: string = err?.message ?? "";
      const msg =
        message.toLowerCase().includes("already in use") || message.toLowerCase().includes("already registered")
          ? "This email is already registered. Please sign in instead."
          : message.toLowerCase().includes("missing required")
          ? "Please fill in all required fields."
          : message.toLowerCase().includes("network") || message.toLowerCase().includes("failed to fetch")
          ? "Network error. Check your connection and try again."
          : message || "Sign up failed. Please try again.";
      Alert.alert("Sign Up Failed", msg);
    } finally {
      setLoading(false);
    }
  };

  const jnvOptions = jnvState ? JNV_DATA[jnvState] || [] : [];

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 16 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => (step > 1 ? setStep(step - 1) : router.back())}
            style={styles.backBtn}
          >
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.stepIndicator}>{step}/3</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(step / 3) * 100}%` },
            ]}
          />
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
        {step === 1 && (
          <View>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              Basic Information
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Tell us about yourself
            </Text>
            <PremiumInput
              label="Full Name"
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your full name"
              icon="person-outline"
              error={errors.fullName}
            />
            <PremiumInput
              label="Email Address"
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
              placeholder="Min 6 characters"
              isPassword
              icon="lock-closed-outline"
              error={errors.password}
            />

            <Text style={[styles.roleLabel, { color: colors.mutedForeground }]}>
              I am a...
            </Text>
            {errors.role && (
              <Text style={[styles.roleError, { color: colors.destructive }]}>
                {errors.role}
              </Text>
            )}
            <View style={styles.roleGrid}>
              {ROLES.map((r) => (
                <TouchableOpacity
                  key={r.value}
                  onPress={() => setRole(r.value)}
                  style={[
                    styles.roleCard,
                    {
                      borderColor: role === r.value ? colors.primary : colors.border,
                      backgroundColor:
                        role === r.value ? colors.accent : colors.card,
                      borderRadius: colors.radius - 4,
                    },
                  ]}
                >
                  <Ionicons
                    name={r.icon as any}
                    size={24}
                    color={role === r.value ? colors.primary : colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.roleText,
                      {
                        color:
                          role === r.value ? colors.primary : colors.foreground,
                        fontFamily:
                          role === r.value ? "Inter_600SemiBold" : "Inter_500Medium",
                      },
                    ]}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <PremiumButton title="Next" onPress={handleNext} style={{ marginTop: 16 }} />
          </View>
        )}

        {step === 2 && (
          <View>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              Your JNV Details
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Connect with your Navodaya family
            </Text>

            <DropdownPicker
              label="State / UT"
              value={jnvState}
              placeholder="Select your state"
              options={STATES}
              onSelect={(v) => {
                setJnvState(v);
                setJnvName("");
              }}
              error={errors.jnvState}
            />

            <DropdownPicker
              label="JNV Name"
              value={jnvName}
              placeholder={jnvState ? "Select your JNV" : "Select state first"}
              options={jnvOptions}
              onSelect={setJnvName}
              disabled={!jnvState}
              error={errors.jnvName}
            />

            <DropdownPicker
              label="House"
              value={house}
              placeholder="Select your house"
              options={HOUSES as unknown as string[]}
              onSelect={setHouse}
              error={errors.house}
            />

            <PremiumButton title="Next" onPress={handleNext} style={{ marginTop: 8 }} />
          </View>
        )}

        {step === 3 && (
          <View>
            <Text style={[styles.stepTitle, { color: colors.foreground }]}>
              {role === "student" && "Student Details"}
              {role === "alumni" && "Alumni Profile"}
              {role === "teacher" && "Teacher Details"}
              {role === "official" && "Official Details"}
            </Text>
            <Text style={[styles.stepSub, { color: colors.mutedForeground }]}>
              Complete your profile
            </Text>

            {role === "student" && (
              <DropdownPicker
                label="Current Class"
                value={studentClass}
                placeholder="Select class"
                options={["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"]}
                onSelect={setStudentClass}
              />
            )}

            {role === "alumni" && (
              <>
                <PremiumInput
                  label="Enrollment Year"
                  value={enrollYear}
                  onChangeText={setEnrollYear}
                  placeholder="e.g. 2010"
                  keyboardType="numeric"
                  icon="calendar-outline"
                />
                <PremiumInput
                  label="Passout Year"
                  value={passoutYear}
                  onChangeText={setPassoutYear}
                  placeholder="e.g. 2022"
                  keyboardType="numeric"
                  icon="calendar-outline"
                />
                <DropdownPicker
                  label="Profession"
                  value={profession}
                  placeholder="Select profession"
                  options={["Engineer", "Doctor", "IAS/IPS Officer", "Defence", "Lawyer", "Teacher", "Researcher", "Entrepreneur", "Other"]}
                  onSelect={setProfession}
                />
                <PremiumInput
                  label="Field / Domain"
                  value={field}
                  onChangeText={setField}
                  placeholder="e.g. Software Engineering"
                  icon="briefcase-outline"
                />
                <PremiumInput
                  label="Company / Institution"
                  value={company}
                  onChangeText={setCompany}
                  placeholder="e.g. Google, AIIMS"
                  icon="business-outline"
                />
                <PremiumInput
                  label="Skills (comma-separated)"
                  value={skills}
                  onChangeText={setSkills}
                  placeholder="e.g. Python, Leadership, Research"
                  icon="bulb-outline"
                />
              </>
            )}

            {role === "teacher" && (
              <PremiumInput
                label="Subject"
                value={subject}
                onChangeText={setSubject}
                placeholder="e.g. Mathematics, Physics"
                icon="book-outline"
              />
            )}

            {role === "official" && (
              <PremiumInput
                label="Designation"
                value={designation}
                onChangeText={setDesignation}
                placeholder="e.g. Principal, JNV Commissioner"
                icon="ribbon-outline"
              />
            )}

            <PremiumButton
              title="Create Account"
              onPress={handleSignUp}
              loading={loading}
              style={{ marginTop: 16 }}
            />
          </View>
        )}

        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            Already have an account?{" "}
          </Text>
          <TouchableOpacity onPress={() => router.replace("/(auth)/sign-in")}>
            <Text style={[styles.footerLink, { color: colors.primary }]}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  stepIndicator: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: "#fff",
    borderRadius: 2,
  },
  scrollContent: {
    padding: 24,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    marginBottom: 6,
  },
  stepSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    marginBottom: 24,
  },
  roleLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    marginBottom: 6,
    marginTop: 4,
  },
  roleError: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginBottom: 8,
  },
  roleGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 4,
  },
  roleCard: {
    width: "47%",
    padding: 16,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 8,
  },
  roleText: {
    fontSize: 14,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 24,
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
