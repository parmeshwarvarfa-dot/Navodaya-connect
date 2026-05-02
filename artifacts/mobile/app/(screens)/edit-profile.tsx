import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumInput } from "@/components/PremiumInput";
import { PremiumButton } from "@/components/PremiumButton";

export default function EditProfileScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.fullName || "");
  const [profession, setProfession] = useState(profile?.profession || "");
  const [company, setCompany] = useState(profile?.company || "");
  const [skills, setSkills] = useState(profile?.skills?.join(", ") || "");
  const [subject, setSubject] = useState(profile?.subject || "");
  const [designation, setDesignation] = useState(profile?.designation || "");
  const [saving, setSaving] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates: any = { fullName: fullName.trim() };
      if (profile?.role === "alumni") {
        updates.profession = profession.trim();
        updates.company = company.trim();
        updates.skills = skills.split(",").map((s) => s.trim()).filter(Boolean);
      }
      if (profile?.role === "teacher") updates.subject = subject.trim();
      if (profile?.role === "official") updates.designation = designation.trim();
      await updateDoc(doc(db, "users", profile?.uid || ""), updates);
      await refreshProfile();
      Alert.alert("Saved", "Profile updated successfully.");
      router.back();
    } catch {
      Alert.alert("Error", "Failed to save profile");
    }
    setSaving(false);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Edit Profile</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <PremiumInput
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          icon="person-outline"
        />

        {profile?.role === "alumni" && (
          <>
            <PremiumInput label="Profession" value={profession} onChangeText={setProfession} icon="briefcase-outline" />
            <PremiumInput label="Company / Institution" value={company} onChangeText={setCompany} icon="business-outline" />
            <PremiumInput label="Skills (comma-separated)" value={skills} onChangeText={setSkills} placeholder="Python, Leadership..." icon="bulb-outline" />
          </>
        )}

        {profile?.role === "teacher" && (
          <PremiumInput label="Subject" value={subject} onChangeText={setSubject} icon="book-outline" />
        )}

        {profile?.role === "official" && (
          <PremiumInput label="Designation" value={designation} onChangeText={setDesignation} icon="ribbon-outline" />
        )}

        <PremiumButton title="Save Changes" onPress={handleSave} loading={saving} style={{ marginTop: 8 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  content: { padding: 20 },
});
