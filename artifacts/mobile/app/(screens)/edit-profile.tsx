import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  TextInput,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { LinearGradient } from "expo-linear-gradient";

const HOUSE_OPTIONS = ["Aravali", "Nilgiri", "Shivalik", "Udaygiri"];
const CLASS_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"];

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  alumni: "Alumni",
  teacher: "Teacher",
  official: "JNV Official",
};

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function Section({ title, icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <View style={sec.wrap}>
      <View style={sec.titleRow}>
        <View style={sec.iconBox}>
          <Ionicons name={icon} size={16} color="#3D5AF1" />
        </View>
        <Text style={sec.title}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function Field({
  label, value, onChange, placeholder, multiline, keyboardType, icon, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; multiline?: boolean; keyboardType?: any; icon?: any; required?: boolean;
}) {
  return (
    <View style={fld.wrap}>
      <Text style={fld.label}>{label}{required && <Text style={{ color: "#EF4444" }}> *</Text>}</Text>
      <View style={[fld.inputRow, multiline && { alignItems: "flex-start" }]}>
        {icon && (
          <View style={[fld.iconBox, multiline && { marginTop: 3 }]}>
            <Ionicons name={icon} size={17} color="#6B7280" />
          </View>
        )}
        <TextInput
          style={[fld.input, multiline && { minHeight: 80, textAlignVertical: "top" }]}
          value={value} onChangeText={onChange} placeholder={placeholder}
          placeholderTextColor="#9CA3AF" keyboardType={keyboardType} multiline={multiline}
        />
      </View>
    </View>
  );
}

const HOUSE_LABEL_MAP: Record<string, string> = {
  Aravali:  "Aravali House 💙",
  Nilgiri:  "Nilgiri House 💚",
  Shivalik: "Shivalik House ❤️",
  Udaygiri: "Udaygiri House 💛",
};

function ChipRow({ label, options, value, onChange, labelMap }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; labelMap?: Record<string, string>;
}) {
  return (
    <View style={fld.wrap}>
      <Text style={fld.label}>{label}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {options.map((o) => (
          <TouchableOpacity key={o} onPress={() => onChange(o)}
            style={[chip.base, value === o && chip.active]}>
            <Text style={[chip.text, value === o && chip.textActive]}>{labelMap?.[o] ?? o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [phone, setPhone] = useState((profile as any)?.phone || "");
  const [bio, setBio] = useState((profile as any)?.bio || "");
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || "");

  const [jnvName, setJnvName] = useState(profile?.jnvName || "");
  const [jnvState, setJnvState] = useState(profile?.jnvState || "");
  const [house, setHouse] = useState(profile?.house || "");

  const [passoutYear, setPassoutYear] = useState(profile?.passoutYear || "");
  const [profession, setProfession] = useState(profile?.profession || "");
  const [company, setCompany] = useState(profile?.company || "");
  const [field, setField] = useState(profile?.field || "");
  const [skills, setSkills] = useState(profile?.skills?.join(", ") || "");
  const [cls, setCls] = useState(profile?.class || "");
  const [enrollYear, setEnrollYear] = useState((profile as any)?.enrollYear || "");
  const [subject, setSubject] = useState(profile?.subject || "");
  const [designation, setDesignation] = useState(profile?.designation || "");

  const [linkedin, setLinkedin] = useState((profile as any)?.linkedinUrl || "");
  const [twitter, setTwitter] = useState((profile as any)?.twitterUrl || "");

  const [saving, setSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [pickingPhoto, setPickingPhoto] = useState(false);

  const role = profile?.role || "student";
  const initials = getInitials(fullName || "N");

  const pickImage = async () => {
    setPickingPhoto(true);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setPickingPhoto(false); return; }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.6,
        base64: true,
      });
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0];
        if (asset.base64) {
          setPhotoURL(`data:image/jpeg;base64,${asset.base64}`);
        } else if (asset.uri) {
          setPhotoURL(asset.uri);
        }
      }
    } catch {}
    setPickingPhoto(false);
  };

  const handleSave = async () => {
    if (!fullName.trim()) return;
    setSaving(true);
    try {
      const updates: any = {
        fullName: fullName.trim(),
        phone: phone.trim(),
        bio: bio.trim(),
        jnvName: jnvName.trim(),
        jnvState: jnvState.trim(),
        house,
      };
      if (photoURL) updates.photoURL = photoURL;
      if (role === "alumni") {
        updates.passoutYear = passoutYear.trim();
        updates.profession = profession.trim();
        updates.company = company.trim();
        updates.field = field.trim();
        updates.skills = skills.split(",").map((s: string) => s.trim()).filter(Boolean);
        updates.linkedinUrl = linkedin.trim();
        updates.twitterUrl = twitter.trim();
      }
      if (role === "student") {
        updates.class = cls;
        updates.enrollYear = enrollYear.trim();
      }
      if (role === "teacher") {
        updates.subject = subject.trim();
        updates.linkedinUrl = linkedin.trim();
      }
      if (role === "official") {
        updates.designation = designation.trim();
      }
      await api.users.updateMe(updates);
      await refreshProfile();
      setShowSuccess(true);
    } catch {}
    setSaving(false);
  };

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
          {saving
            ? <ActivityIndicator color="#fff" size="small" />
            : <Text style={styles.saveBtnText}>Save</Text>
          }
        </TouchableOpacity>
      </LinearGradient>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* ── Avatar ── */}
          <View style={styles.avatarSection}>
            <TouchableOpacity onPress={pickImage} activeOpacity={0.85} style={styles.avatarWrap}>
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
              ) : (
                <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.avatarFallback}>
                  <Text style={styles.avatarInitials}>{initials}</Text>
                </LinearGradient>
              )}
              <View style={styles.cameraBadge}>
                {pickingPhoto
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Ionicons name="camera" size={16} color="#fff" />
                }
              </View>
            </TouchableOpacity>
            <Text style={styles.avatarName}>{fullName || "Your Name"}</Text>
            <Text style={styles.avatarHint}>Tap photo to change</Text>
            <View style={styles.rolePill}>
              <Text style={styles.rolePillText}>{ROLE_LABEL[role]}</Text>
            </View>
          </View>

          {/* ── Personal Info ── */}
          <Section title="Personal Information" icon="person-outline">
            <Field label="Full Name" value={fullName} onChange={setFullName} placeholder="Your full name" icon="person-outline" required />
            <Field label="Mobile Number" value={phone} onChange={setPhone} placeholder="10-digit mobile number" icon="call-outline" keyboardType="phone-pad" />
            <Field
              label="Bio / About Me"
              value={bio}
              onChange={setBio}
              placeholder="A short intro about yourself — who you are, what you do, your passions..."
              icon="create-outline"
              multiline
            />
          </Section>

          {/* ── JNV Details ── */}
          <Section title="JNV Details" icon="school-outline">
            <Field label="JNV Name" value={jnvName} onChange={setJnvName} placeholder="e.g. JNV Jaipur" icon="business-outline" />
            <Field label="State" value={jnvState} onChange={setJnvState} placeholder="e.g. Rajasthan" icon="map-outline" />
            <ChipRow label="House" options={HOUSE_OPTIONS} value={house} onChange={setHouse} labelMap={HOUSE_LABEL_MAP} />
          </Section>

          {/* ── Alumni ── */}
          {role === "alumni" && (
            <Section title="Alumni Details" icon="ribbon-outline">
              <Field label="Passout Batch / Year" value={passoutYear} onChange={setPassoutYear} placeholder="e.g. 2018" icon="calendar-outline" keyboardType="numeric" />
              <Field label="Current Profession / Role" value={profession} onChange={setProfession} placeholder="e.g. Software Engineer" icon="briefcase-outline" />
              <Field label="Company / Institution" value={company} onChange={setCompany} placeholder="e.g. Infosys, IIT Delhi" icon="business-outline" />
              <Field label="Field / Domain" value={field} onChange={setField} placeholder="e.g. Technology, Medicine, Law" icon="layers-outline" />
              <Field label="Skills (comma-separated)" value={skills} onChange={setSkills} placeholder="Python, Leadership, UI Design..." icon="bulb-outline" />
            </Section>
          )}

          {/* ── Student ── */}
          {role === "student" && (
            <Section title="Student Details" icon="book-outline">
              <ChipRow label="Class" options={CLASS_OPTIONS} value={cls} onChange={setCls} />
              <Field label="Enrolment Year" value={enrollYear} onChange={setEnrollYear} placeholder="e.g. 2022" icon="calendar-outline" keyboardType="numeric" />
            </Section>
          )}

          {/* ── Teacher ── */}
          {role === "teacher" && (
            <Section title="Teacher Details" icon="book-outline">
              <Field label="Subject(s)" value={subject} onChange={setSubject} placeholder="e.g. Mathematics, Physics" icon="book-outline" />
            </Section>
          )}

          {/* ── Official ── */}
          {role === "official" && (
            <Section title="Official Details" icon="ribbon-outline">
              <Field label="Designation" value={designation} onChange={setDesignation} placeholder="e.g. Principal, Vice Principal" icon="ribbon-outline" />
            </Section>
          )}

          {/* ── Social Links ── */}
          {(role === "alumni" || role === "teacher") && (
            <Section title="Social & Professional Links" icon="share-social-outline">
              <Field
                label="LinkedIn Profile URL"
                value={linkedin}
                onChange={setLinkedin}
                placeholder="https://linkedin.com/in/yourname"
                icon="logo-linkedin"
                keyboardType="url"
              />
              {role === "alumni" && (
                <Field
                  label="Twitter / X Profile URL"
                  value={twitter}
                  onChange={setTwitter}
                  placeholder="https://twitter.com/yourhandle"
                  icon="logo-twitter"
                  keyboardType="url"
                />
              )}
            </Section>
          )}

          <TouchableOpacity
            style={[styles.saveFullBtn, (saving || !fullName.trim()) && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving || !fullName.trim()}
            activeOpacity={0.85}
          >
            {saving
              ? <ActivityIndicator color="#fff" />
              : <>
                  <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                  <Text style={styles.saveFullBtnText}>Save All Changes</Text>
                </>
            }
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Success Modal ── */}
      <Modal
        visible={showSuccess}
        transparent
        animationType="fade"
        onRequestClose={() => { setShowSuccess(false); router.back(); }}
      >
        <View style={styles.successOverlay}>
          <View style={styles.successBox}>
            <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.successIcon}>
              <Ionicons name="checkmark" size={36} color="#fff" />
            </LinearGradient>
            <Text style={styles.successTitle}>Profile Updated!</Text>
            <Text style={styles.successDesc}>
              Your changes have been saved. Your profile now shows the latest information across Navodaya Connect.
            </Text>
            <TouchableOpacity
              style={styles.successBtn}
              onPress={() => { setShowSuccess(false); router.back(); }}
            >
              <Text style={styles.successBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, paddingBottom: 16,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  saveBtn: {
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
  },
  saveBtnText: { color: "#fff", fontSize: 14, fontFamily: "Inter_700Bold" },
  body: { padding: 16, paddingBottom: 48 },
  avatarSection: {
    alignItems: "center", paddingVertical: 28,
    backgroundColor: "#fff", borderRadius: 20,
    borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 14,
  },
  avatarWrap: { position: "relative", marginBottom: 12 },
  avatarImage: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: "#3D5AF1" },
  avatarFallback: { width: 100, height: 100, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  avatarInitials: { fontSize: 36, fontFamily: "Inter_700Bold", color: "#fff" },
  cameraBadge: {
    position: "absolute", bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: "#3D5AF1", borderWidth: 2.5, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  avatarName: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },
  avatarHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 12 },
  rolePill: { backgroundColor: "#EEF2FF", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 6 },
  rolePillText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  saveFullBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10,
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 16, marginTop: 8,
  },
  saveFullBtnText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  successOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", paddingHorizontal: 24,
  },
  successBox: {
    backgroundColor: "#fff", borderRadius: 20, padding: 28,
    width: "100%", maxWidth: 340, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
  },
  successIcon: {
    width: 72, height: 72, borderRadius: 24,
    alignItems: "center", justifyContent: "center", marginBottom: 16,
  },
  successTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  successDesc: {
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280",
    textAlign: "center", lineHeight: 21, marginBottom: 24,
  },
  successBtn: {
    backgroundColor: "#3D5AF1", borderRadius: 12,
    paddingVertical: 14, paddingHorizontal: 40,
  },
  successBtnText: { color: "#fff", fontSize: 15, fontFamily: "Inter_700Bold" },
});

const sec = StyleSheet.create({
  wrap: {
    backgroundColor: "#fff", borderRadius: 16,
    borderWidth: 1, borderColor: "#F0F0F0", marginBottom: 14, padding: 16,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  iconBox: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center",
  },
  title: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
});

const fld = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: {
    fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9CA3AF",
    marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#F9FAFB", borderRadius: 12,
    borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  iconBox: { width: 42, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1, paddingVertical: 12, paddingRight: 14,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827",
  },
});

const chip = StyleSheet.create({
  base: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    backgroundColor: "#F3F4F6", borderWidth: 1.5, borderColor: "#E5E7EB",
  },
  active: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  text: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  textActive: { color: "#fff" },
});
