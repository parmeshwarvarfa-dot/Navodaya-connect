import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
  Modal,
  FlatList,
  KeyboardAvoidingView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth, UserRole } from "@/context/AuthContext";
import { JNV_DATA, STATES } from "@/data/jnvData";

const HOUSES = ["Aravali", "Nilgiri", "Shivalik", "Udaygiri"];
const CLASSES = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12"];
const BATCHES = Array.from({ length: 30 }, (_, i) => String(2026 - i));

const ROLES: { value: UserRole; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "student", label: "Student", icon: "school-outline" },
  { value: "alumni", label: "Alumni", icon: "home-outline" },
  { value: "official", label: "JNV Official", icon: "business-outline" },
  { value: "teacher", label: "Teacher", icon: "book-outline" },
];

function BluePicker({
  placeholder, value, options, onSelect, icon, houseFont,
}: {
  placeholder: string; value: string; options: string[]; onSelect: (v: string) => void; icon: keyof typeof Ionicons.glyphMap; houseFont?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity style={styles.inputWrap} onPress={() => setOpen(true)}>
        <Ionicons name={icon} size={18} color="rgba(255,255,255,0.75)" style={styles.inputIcon} />
        <Text style={[styles.inputText, !value && styles.placeholderText, value && houseFont && { fontFamily: "Pacifico_400Regular" }]}>
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.65)" />
      </TouchableOpacity>
      <Modal visible={open} animationType="slide" presentationStyle="formSheet">
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={modalStyles.header}>
            <Text style={modalStyles.title}>{placeholder}</Text>
            <TouchableOpacity onPress={() => setOpen(false)}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={options}
            keyExtractor={(i) => i}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={modalStyles.option}
                onPress={() => { onSelect(item); setOpen(false); }}
              >
                <Text style={[modalStyles.optionText, houseFont && { fontFamily: "Pacifico_400Regular" }, item === value && { color: "#3D5AF1" }]}>
                  {item}
                </Text>
                {item === value && <Ionicons name="checkmark" size={18} color="#3D5AF1" />}
              </TouchableOpacity>
            )}
          />
        </View>
      </Modal>
    </>
  );
}

function BlueInput({
  placeholder, value, onChangeText, icon, secureTextEntry, keyboardType,
}: {
  placeholder: string; value: string; onChangeText: (t: string) => void;
  icon: keyof typeof Ionicons.glyphMap; secureTextEntry?: boolean; keyboardType?: any;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color="rgba(255,255,255,0.75)" style={styles.inputIcon} />
      <TextInput
        style={[styles.input, { flex: 1 }]}
        placeholder={placeholder}
        placeholderTextColor="rgba(255,255,255,0.65)"
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={secureTextEntry && !show}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {secureTextEntry && (
        <TouchableOpacity onPress={() => setShow(!show)}>
          <Ionicons name={show ? "eye-off-outline" : "eye-outline"} size={18} color="rgba(255,255,255,0.75)" />
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function SignUpScreen() {
  const insets = useSafeAreaInsets();
  const { signUp } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const bottomPad = Platform.OS === "web" ? 24 : insets.bottom;

  const [step, setStep] = useState<"role" | "form">("role");
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [jnvState, setJnvState] = useState("");
  const [jnvName, setJnvName] = useState("");
  const [house, setHouse] = useState("");
  const [studentClass, setStudentClass] = useState("");
  const [passoutBatch, setPassoutBatch] = useState("");
  const [profession, setProfession] = useState("");
  const [principalName, setPrincipalName] = useState("");
  const [jnvEmail, setJnvEmail] = useState("");
  const [subject, setSubject] = useState("");

  const jnvOptions = jnvState ? JNV_DATA[jnvState] || [] : [];

  const selectRole = (r: UserRole) => {
    setRole(r);
    setStep("form");
  };

  const handleSignUp = async () => {
    if (!fullName.trim() || !email.trim() || !password || !jnvState || !jnvName || !house) {
      Alert.alert("Missing Fields", "Please fill in all required fields.");
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim(), password, {
        fullName: fullName.trim(),
        role: role!,
        jnvState,
        jnvName,
        house: house as any,
        class: role === "student" ? studentClass : undefined,
        passoutYear: role === "alumni" ? passoutBatch : undefined,
        profession: role === "alumni" ? profession : undefined,
        designation: role === "official" ? principalName : undefined,
        subject: role === "teacher" ? subject : undefined,
      });
      router.replace("/(tabs)");
    } catch (err: any) {
      const msg: string = err?.message ?? "";
      Alert.alert(
        "Sign Up Failed",
        msg.toLowerCase().includes("already") ? "This email is already registered." :
        msg.toLowerCase().includes("network") ? "Network error. Check your connection." :
        msg || "Sign up failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  const roleTitles: Record<UserRole, string> = {
    student: "Student Registration",
    alumni: "Alumni Registration",
    official: "JNV Official Registration",
    teacher: "Teacher Registration",
  };

  return (
    <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.gradient}>
      {step === "role" ? (
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          <TouchableOpacity style={styles.backBtn} onPress={() => router.replace("/(auth)/sign-in")}>
            <Ionicons name="arrow-back" size={20} color="#fff" />
          </TouchableOpacity>

          <Text style={styles.roleScreenTitle}>Select Your Role</Text>
          <Text style={styles.roleScreenSub}>Choose how you want to join JNV Connect</Text>

          <View style={styles.roleCards}>
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                style={styles.roleCard}
                onPress={() => selectRole(r.value)}
                activeOpacity={0.85}
              >
                <View style={styles.roleIconWrap}>
                  <Ionicons name={r.icon} size={26} color="#3D5AF1" />
                </View>
                <Text style={styles.roleCardText}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/sign-in")}>
              <Text style={styles.footerLink}>Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={[styles.scroll, { paddingTop: topPad + 16, paddingBottom: bottomPad + 24 }]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep("role")}>
              <Ionicons name="arrow-back" size={20} color="#fff" />
            </TouchableOpacity>

            <Text style={styles.formTitle}>{roleTitles[role!]}</Text>
            <Text style={styles.formSub}>Create your JNV Connect account</Text>

            <View style={styles.form}>
              <BlueInput placeholder="Full Name" value={fullName} onChangeText={setFullName} icon="person-outline" />
              <BlueInput placeholder="Email" value={email} onChangeText={setEmail} icon="mail-outline" keyboardType="email-address" />
              <BlueInput placeholder="Password" value={password} onChangeText={setPassword} icon="lock-closed-outline" secureTextEntry />

              {role === "student" && (
                <BluePicker placeholder="Select Class" value={studentClass} options={CLASSES} onSelect={setStudentClass} icon="school-outline" />
              )}

              <BluePicker placeholder="Select House" value={house} options={HOUSES} onSelect={setHouse} icon="home-outline" houseFont />
              <BluePicker
                placeholder="Select JNV State"
                value={jnvState}
                options={STATES}
                onSelect={(v) => { setJnvState(v); setJnvName(""); }}
                icon="location-outline"
              />
              <BluePicker
                placeholder="Select JNV Name"
                value={jnvName}
                options={jnvOptions}
                onSelect={setJnvName}
                icon="business-outline"
              />

              {role === "alumni" && (
                <>
                  <BluePicker placeholder="Select Pass-out Batch" value={passoutBatch} options={BATCHES} onSelect={setPassoutBatch} icon="calendar-outline" />
                  <BlueInput placeholder="Profession" value={profession} onChangeText={setProfession} icon="briefcase-outline" />
                </>
              )}

              {role === "official" && (
                <>
                  <BlueInput placeholder="Name of Principal" value={principalName} onChangeText={setPrincipalName} icon="person-outline" />
                  <BlueInput placeholder="JNV Email ID" value={jnvEmail} onChangeText={setJnvEmail} icon="mail-outline" keyboardType="email-address" />
                </>
              )}

              {role === "teacher" && (
                <BlueInput placeholder="Subject" value={subject} onChangeText={setSubject} icon="book-outline" />
              )}

              <TouchableOpacity style={styles.createBtn} onPress={handleSignUp} disabled={loading} activeOpacity={0.85}>
                <Text style={styles.createBtnText}>{loading ? "Creating..." : "Create Account"}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </LinearGradient>
  );
}

const modalStyles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  title: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111" },
  option: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E7EB" },
  optionText: { fontSize: 15, fontFamily: "Inter_400Regular", color: "#111" },
});

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  scroll: { paddingHorizontal: 28, flexGrow: 1 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 28,
  },
  roleScreenTitle: {
    fontFamily: "Pacifico_400Regular",
    fontSize: 28,
    color: "#fff",
    marginBottom: 8,
  },
  roleScreenSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 36,
  },
  roleCards: { gap: 14 },
  roleCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 16,
  },
  roleIconWrap: {
    width: 48, height: 48, borderRadius: 24,
    backgroundColor: "#EEF2FF",
    alignItems: "center", justifyContent: "center",
  },
  roleCardText: { fontSize: 17, fontFamily: "Inter_600SemiBold", color: "#111827" },
  formTitle: {
    fontFamily: "Pacifico_400Regular",
    fontSize: 26,
    color: "#fff",
    marginBottom: 6,
  },
  formSub: {
    fontFamily: "Inter_400Regular",
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 28,
  },
  form: { gap: 14 },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 28,
    paddingHorizontal: 18,
    height: 54,
  },
  inputIcon: { marginRight: 10 },
  input: {
    color: "#fff",
    fontFamily: "Inter_400Regular",
    fontSize: 15,
  },
  inputText: { flex: 1, color: "#fff", fontFamily: "Inter_400Regular", fontSize: 15 },
  placeholderText: { color: "rgba(255,255,255,0.65)" },
  createBtn: {
    backgroundColor: "#fff",
    borderRadius: 28,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  createBtnText: { color: "#3D5AF1", fontFamily: "Inter_700Bold", fontSize: 16 },
  footer: { flexDirection: "row", justifyContent: "center", marginTop: 32 },
  footerText: { color: "rgba(255,255,255,0.75)", fontFamily: "Inter_400Regular", fontSize: 15 },
  footerLink: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
});
