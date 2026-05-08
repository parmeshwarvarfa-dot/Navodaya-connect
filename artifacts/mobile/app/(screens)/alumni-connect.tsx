import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, TextInput } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const PROFESSIONS = ["All", "Engineering", "Medicine", "IAS/IPS", "Defence", "Startup", "Law", "Research"];
const YEARS       = ["All", "2024", "2023", "2022", "2021", "2020", "2018", "2016", "2014", "2012", "2010"];

const ALUMNI_LIST = [
  { id: "1", name: "Rahul Verma",       jnv: "JNV Lucknow",    year: "2018", profession: "Engineering", role: "SWE at Google",               mutual: 12, connected: false, verified: true  },
  { id: "2", name: "Dr. Meera Iyer",    jnv: "JNV Kochi",      year: "2015", profession: "Medicine",    role: "MBBS, AIIMS Delhi",           mutual: 8,  connected: true,  verified: true  },
  { id: "3", name: "Kavita Singh",      jnv: "JNV Patna",      year: "2012", profession: "IAS/IPS",     role: "IAS Officer – AIR 47",        mutual: 5,  connected: false, verified: true  },
  { id: "4", name: "Arjun Sharma",      jnv: "JNV Jaipur",     year: "2020", profession: "Startup",     role: "Founder – EdTech Startup",    mutual: 3,  connected: false, verified: true  },
  { id: "5", name: "Priti Gupta",       jnv: "JNV Bhopal",     year: "2016", profession: "Law",         role: "Advocate, Delhi High Court",  mutual: 6,  connected: false, verified: false },
  { id: "6", name: "Vivek Nair",        jnv: "JNV Thrissur",   year: "2014", profession: "Defence",     role: "Captain, Indian Army",        mutual: 9,  connected: false, verified: true  },
  { id: "7", name: "Sneha Dubey",       jnv: "JNV Varanasi",   year: "2021", profession: "Research",    role: "PhD Scholar – IISc Bangalore", mutual: 4, connected: false, verified: false },
  { id: "8", name: "Manish Kumar",      jnv: "JNV Ranchi",     year: "2013", profession: "Engineering", role: "Tech Lead at Microsoft",      mutual: 7,  connected: true,  verified: true  },
];

const SUGGESTED = ALUMNI_LIST.filter((a) => !a.connected).slice(0, 3);

export default function AlumniConnectScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const [search,      setSearch]      = useState("");
  const [profFilter,  setProfFilter]  = useState("All");
  const [yearFilter,  setYearFilter]  = useState("All");
  const [connections, setConnections] = useState<Record<string, "connected" | "pending" | null>>({});
  const [toast,       setToast]       = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const connect = (id: string, name: string) => {
    setConnections((p) => ({ ...p, [id]: "pending" }));
    showToast(`Connection request sent to ${name}!`);
  };

  const filtered = ALUMNI_LIST.filter((a) => {
    const s  = search.toLowerCase();
    const matchS = !s || a.name.toLowerCase().includes(s) || a.role.toLowerCase().includes(s) || a.jnv.toLowerCase().includes(s);
    const matchP = profFilter === "All" || a.profession === profFilter;
    const matchY = yearFilter === "All" || a.year === yearFilter;
    return matchS && matchP && matchY;
  });

  const connectedCount = ALUMNI_LIST.filter((a) => a.connected).length + Object.values(connections).filter((v) => v === "connected").length;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Connect with Alumni</Text>
          <Text style={styles.headerSub}>{connectedCount} connections</Text>
        </View>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={16} color="#9CA3AF" style={{ marginRight: 8 }} />
        <TextInput style={styles.searchInput} placeholder="Search by name, role, JNV…" placeholderTextColor="#9CA3AF" value={search} onChangeText={setSearch} />
      </View>

      {/* Profession Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {PROFESSIONS.map((p) => (
          <TouchableOpacity key={p} style={[styles.chip, profFilter === p && styles.chipActive]} onPress={() => setProfFilter(p)}>
            <Text style={[styles.chipText, profFilter === p && styles.chipTextActive]}>{p}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Year Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingTop: 0 }]} style={{ flexGrow: 0 }}>
        {YEARS.map((y) => (
          <TouchableOpacity key={y} style={[styles.chip, styles.chipSmall, yearFilter === y && styles.chipActiveGreen]} onPress={() => setYearFilter(y)}>
            <Text style={[styles.chipText, yearFilter === y && styles.chipTextActive]}>{y === "All" ? "All Years" : `'${y.slice(2)}`}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>

        {/* Suggested */}
        {!search && profFilter === "All" && (
          <View style={styles.suggestedSection}>
            <Text style={styles.sectionLabel}>🤝 Suggested for You</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {SUGGESTED.map((a) => {
                const state = connections[a.id] || (a.connected ? "connected" : null);
                return (
                  <View key={a.id} style={styles.suggestCard}>
                    <View style={styles.suggestAvatar}><Text style={styles.suggestAvatarText}>{a.name[0]}</Text></View>
                    {a.verified && <View style={styles.verifiedDot}><Ionicons name="checkmark-circle" size={14} color="#3D5AF1" /></View>}
                    <Text style={styles.suggestName} numberOfLines={1}>{a.name}</Text>
                    <Text style={styles.suggestRole} numberOfLines={1}>{a.role}</Text>
                    <Text style={styles.suggestMutual}>{a.mutual} mutual</Text>
                    <TouchableOpacity
                      style={[styles.connectBtn, state && styles.connectBtnDone]}
                      onPress={() => !state && connect(a.id, a.name)}
                    >
                      <Text style={[styles.connectBtnText, state && styles.connectBtnTextDone]}>{state === "connected" ? "Connected" : state === "pending" ? "Pending" : "Connect"}</Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        <Text style={styles.resultCount}>{filtered.length} alumni found</Text>

        {filtered.map((a) => {
          const state = connections[a.id] || (a.connected ? "connected" : null);
          return (
            <View key={a.id} style={styles.alumniCard}>
              <View style={styles.alumniAvatarWrap}>
                <View style={styles.alumniAvatar}><Text style={styles.alumniAvatarText}>{a.name[0]}</Text></View>
                {a.verified && <View style={styles.verifiedIconSmall}><Ionicons name="checkmark-circle" size={14} color="#3D5AF1" /></View>}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.alumniName}>{a.name}</Text>
                <Text style={styles.alumniRole}>{a.role}</Text>
                <View style={styles.alumniMetaRow}>
                  <Ionicons name="school-outline" size={11} color="#9CA3AF" />
                  <Text style={styles.alumniMeta}>{a.jnv} · {a.year}</Text>
                  <Text style={styles.alumniMutual}>· {a.mutual} mutual</Text>
                </View>
              </View>
              <TouchableOpacity
                style={[styles.cardConnectBtn, state && styles.cardConnectBtnDone]}
                onPress={() => !state && connect(a.id, a.name)}
              >
                <Ionicons name={state === "connected" ? "checkmark" : state === "pending" ? "time-outline" : "person-add-outline"} size={15} color={state ? "#10B981" : "#3D5AF1"} />
              </TouchableOpacity>
            </View>
          );
        })}
      </ScrollView>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  searchWrap: { flexDirection: "row", alignItems: "center", margin: 14, backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  chips: { paddingHorizontal: 14, gap: 8, paddingBottom: 10 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipSmall: { paddingHorizontal: 10, paddingVertical: 5 },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipActiveGreen: { backgroundColor: "#10B981", borderColor: "#10B981" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  suggestedSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 10 },
  suggestCard: { backgroundColor: "#fff", borderRadius: 16, padding: 14, width: 150, borderWidth: 1, borderColor: "#F0F0F0", alignItems: "center", gap: 4 },
  suggestAvatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  suggestAvatarText: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  verifiedDot: { position: "absolute", top: 10, right: 24 },
  suggestName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827", textAlign: "center", width: "100%" },
  suggestRole: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", textAlign: "center", width: "100%" },
  suggestMutual: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#9CA3AF" },
  connectBtn: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6, marginTop: 4 },
  connectBtnDone: { backgroundColor: "#ECFDF5" },
  connectBtnText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  connectBtnTextDone: { color: "#10B981" },
  resultCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 10 },
  alumniCard: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#fff", borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#F0F0F0" },
  alumniAvatarWrap: { position: "relative" },
  alumniAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  alumniAvatarText: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  verifiedIconSmall: { position: "absolute", bottom: -2, right: -2, backgroundColor: "#fff", borderRadius: 8 },
  alumniName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 2 },
  alumniRole: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 4 },
  alumniMetaRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  alumniMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  alumniMutual: { fontSize: 11, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  cardConnectBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  cardConnectBtnDone: { backgroundColor: "#ECFDF5" },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
});
