import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { AlumniUser } from "@/lib/api";
import { VerifiedBadge } from "@/components/VerifiedBadge";

const TRACKS = ["All", "Engineering", "Medicine", "UPSC/IAS", "Commerce/CA", "Law", "Research", "Defence"];

const AVATAR_COLORS = ["#3D5AF1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6", "#0891B2"];

const MOCK_MENTORS = [
  { id: "m1", fullName: "Priya Sharma", profession: "Senior Software Engineer", company: "Google India", field: "Engineering", jnvName: "JNV Jaipur", verificationStatus: "verified", passoutYear: "2017", skills: ["Java", "ML", "Leadership"] },
  { id: "m2", fullName: "Dr. Amit Kumar", profession: "MBBS, MD Cardiology", company: "AIIMS Delhi", field: "Medicine", jnvName: "JNV Patna", verificationStatus: "verified", passoutYear: "2016", skills: ["NEET Guidance", "Research", "Mentorship"] },
  { id: "m3", fullName: "IAS Suresh Yadav", profession: "IAS Officer (2021 Batch)", company: "Govt. of Rajasthan", field: "UPSC/IAS", jnvName: "JNV Jodhpur", verificationStatus: "verified", passoutYear: "2015", skills: ["UPSC Strategy", "GS Paper", "Interview Prep"] },
  { id: "m4", fullName: "CA Sneha Agarwal", profession: "Chartered Accountant", company: "Deloitte", field: "Commerce/CA", jnvName: "JNV Bhopal", verificationStatus: "verified", passoutYear: "2018", skills: ["Finance", "CA Exam", "Career Guidance"] },
  { id: "m5", fullName: "Adv. Rahul Singh", profession: "Advocate, High Court", company: "Delhi High Court", field: "Law", jnvName: "JNV Lucknow", verificationStatus: "verified", passoutYear: "2014", skills: ["CLAT", "Law School", "Moots"] },
  { id: "m6", fullName: "Col. Neeraj Verma", profession: "Indian Army Colonel", company: "Indian Army", field: "Defence", jnvName: "JNV Dehradun", verificationStatus: "verified", passoutYear: "2013", skills: ["NDA", "Military Life", "Leadership"] },
  { id: "m7", fullName: "Dr. Kavita Mishra", profession: "Research Scientist", company: "ISRO", field: "Research", jnvName: "JNV Hyderabad", verificationStatus: "verified", passoutYear: "2016", skills: ["Physics", "Space Tech", "Research Papers"] },
  { id: "m8", fullName: "Aryan Mehta", profession: "Product Manager", company: "Microsoft", field: "Engineering", jnvName: "JNV Pune", verificationStatus: "verified", passoutYear: "2019", skills: ["Product Thinking", "Tech", "Startups"] },
];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function SeniorConnectScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const [activeTrack, setActiveTrack] = useState("All");
  const [searchQ, setSearchQ] = useState("");
  const [connected, setConnected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [apiMentors, setApiMentors] = useState<AlumniUser[]>([]);

  useEffect(() => {
    api.users.alumni().then(setApiMentors).catch(() => {});
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const verifiedApi = apiMentors.filter((a) => a.verificationStatus === "verified");
  const combined = verifiedApi.length > 0 ? verifiedApi.map((a) => ({ ...a, source: "api" })) : MOCK_MENTORS;

  const filtered = combined.filter((m) => {
    const matchTrack = activeTrack === "All" || (m as any).field === activeTrack;
    const matchSearch = !searchQ || m.fullName?.toLowerCase().includes(searchQ.toLowerCase()) || (m as any).profession?.toLowerCase().includes(searchQ.toLowerCase());
    return matchTrack && matchSearch;
  });

  const sameJnv = filtered.filter((m) => m.jnvName === profile?.jnvName);
  const others  = filtered.filter((m) => m.jnvName !== profile?.jnvName);
  const ordered = [...sameJnv, ...others];

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Senior Connect</Text>
          <Text style={styles.headerSub}>Find your ideal JNV mentor</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or profession..."
          placeholderTextColor="#9CA3AF"
          value={searchQ}
          onChangeText={setSearchQ}
        />
      </View>

      {/* Track filter chips */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {TRACKS.map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.chip, activeTrack === t && styles.chipActive]}
            onPress={() => setActiveTrack(t)}
          >
            <Text style={[styles.chipText, activeTrack === t && styles.chipTextActive]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        {/* Same JNV banner */}
        {sameJnv.length > 0 && (
          <View style={styles.sectionLabel}>
            <View style={styles.sameJnvBadge}>
              <Ionicons name="home" size={13} color="#3D5AF1" />
              <Text style={styles.sameJnvText}>From your JNV · {profile?.jnvName}</Text>
            </View>
          </View>
        )}

        {ordered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>No mentors found</Text>
            <Text style={styles.emptySub}>Try a different filter or search term</Text>
          </View>
        ) : ordered.map((mentor, idx) => {
          const isFromJnv = mentor.jnvName === profile?.jnvName;
          const isConnected = connected.has(mentor.id);
          const colorIdx = idx % AVATAR_COLORS.length;
          const m = mentor as any;

          return (
            <View key={mentor.id}>
              {isFromJnv && idx === sameJnv.length && sameJnv.length > 0 && (
                <View style={styles.sectionLabel}>
                  <Text style={styles.sectionLabelText}>Other JNVs</Text>
                </View>
              )}
              <View style={[styles.mentorCard, isFromJnv && styles.mentorCardHighlight]}>
                {isFromJnv && <View style={styles.sameJnvStripe} />}
                <View style={styles.mentorCardInner}>
                  <View style={styles.mentorTop}>
                    <View style={[styles.avatar, { backgroundColor: AVATAR_COLORS[colorIdx] + "22" }]}>
                      <Text style={[styles.avatarText, { color: AVATAR_COLORS[colorIdx] }]}>{getInitials(mentor.fullName)}</Text>
                    </View>
                    <View style={styles.mentorInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.mentorName}>{mentor.fullName}</Text>
                        <VerifiedBadge status={mentor.verificationStatus} role="alumni" size="sm" />
                      </View>
                      <Text style={styles.mentorProf}>{m.profession}</Text>
                      {m.company && <Text style={styles.mentorCompany}>{m.company}</Text>}
                    </View>
                  </View>

                  <View style={styles.metaRow}>
                    {m.passoutYear && (
                      <View style={styles.metaChip}>
                        <Ionicons name="calendar-outline" size={12} color="#6B7280" />
                        <Text style={styles.metaChipText}>Batch {m.passoutYear}</Text>
                      </View>
                    )}
                    {mentor.jnvName && (
                      <View style={styles.metaChip}>
                        <Ionicons name="location-outline" size={12} color="#6B7280" />
                        <Text style={styles.metaChipText}>{mentor.jnvName}</Text>
                      </View>
                    )}
                  </View>

                  {m.skills && m.skills.length > 0 && (
                    <View style={styles.skillsRow}>
                      {m.skills.slice(0, 3).map((s: string) => (
                        <View key={s} style={styles.skillChip}>
                          <Text style={styles.skillText}>{s}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[styles.connectBtn, isConnected && styles.connectedBtn]}
                      onPress={() => {
                        setConnected((p) => { const n = new Set(p); isConnected ? n.delete(mentor.id) : n.add(mentor.id); return n; });
                        if (!isConnected) showToast(`Connected with ${mentor.fullName}!`);
                      }}
                    >
                      <Ionicons name={isConnected ? "checkmark" : "person-add-outline"} size={15} color={isConnected ? "#10B981" : "#3D5AF1"} />
                      <Text style={[styles.connectBtnText, isConnected && { color: "#10B981" }]}>{isConnected ? "Connected" : "Connect"}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.messageBtn}
                      onPress={() => router.push({ pathname: "/(screens)/group-chat" as any, params: { id: `mentor-${mentor.id}`, name: encodeURIComponent(mentor.fullName) } })}
                    >
                      <Ionicons name="chatbubble-outline" size={15} color="#fff" />
                      <Text style={styles.messageBtnText}>Message</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      {toast ? (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={15} color="#fff" />
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  searchWrap: {
    flexDirection: "row", alignItems: "center", margin: 14,
    backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 14 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  sectionLabel: { paddingHorizontal: 16, paddingVertical: 8 },
  sameJnvBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, alignSelf: "flex-start" },
  sameJnvText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  sectionLabelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  empty: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  emptySub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center" },
  mentorCard: { marginHorizontal: 14, marginBottom: 12, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#F0F0F0", overflow: "hidden", flexDirection: "row" },
  mentorCardHighlight: { borderColor: "#C7D2FE" },
  sameJnvStripe: { width: 4, backgroundColor: "#3D5AF1" },
  mentorCardInner: { flex: 1, padding: 16 },
  mentorTop: { flexDirection: "row", gap: 12, marginBottom: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontFamily: "Inter_700Bold" },
  mentorInfo: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" },
  mentorName: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#111827" },
  mentorProf: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151", marginBottom: 2 },
  mentorCompany: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  metaRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 },
  metaChip: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F3F4F6", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  metaChipText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  skillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 14 },
  skillChip: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  skillText: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  actionRow: { flexDirection: "row", gap: 10 },
  connectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    borderWidth: 1.5, borderColor: "#3D5AF1", borderRadius: 10, paddingVertical: 9,
  },
  connectedBtn: { borderColor: "#10B981", backgroundColor: "#ECFDF5" },
  connectBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  messageBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6,
    backgroundColor: "#3D5AF1", borderRadius: 10, paddingVertical: 9,
  },
  messageBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff" },
  toast: {
    position: "absolute", bottom: 36, left: 24, right: 24,
    backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", gap: 8,
  },
  toastText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
