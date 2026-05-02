import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  TextInput,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";

interface AlumniProfile {
  id: string;
  fullName: string;
  profession: string;
  company: string;
  field: string;
  skills: string[];
  jnvName: string;
  jnvState: string;
  passoutYear: string;
  verificationStatus: string;
}

export default function AlumniScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [alumni, setAlumni] = useState<AlumniProfile[]>([]);
  const [search, setSearch] = useState("");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  const fetchAlumni = async () => {
    try {
      const q = query(collection(db, "users"), where("role", "==", "alumni"));
      const snap = await getDocs(q);
      setAlumni(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AlumniProfile)));
    } catch {}
  };

  useEffect(() => { fetchAlumni(); }, []);

  const filtered = alumni.filter(
    (a) =>
      a.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      a.profession?.toLowerCase().includes(search.toLowerCase()) ||
      a.company?.toLowerCase().includes(search.toLowerCase()) ||
      a.jnvName?.toLowerCase().includes(search.toLowerCase())
  );

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
          <Text style={styles.headerTitle}>Alumni Directory</Text>
          <View style={{ width: 36 }} />
        </View>
        <View style={[styles.searchBox, { backgroundColor: "rgba(255,255,255,0.15)" }]}>
          <Ionicons name="search" size={16} color="rgba(255,255,255,0.8)" />
          <TextInput
            placeholder="Search alumni..."
            placeholderTextColor="rgba(255,255,255,0.6)"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>
      </LinearGradient>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No alumni found</Text>
          </View>
        }
        renderItem={({ item }) => (
          <PremiumCard style={styles.card}>
            <View style={styles.cardRow}>
              <View style={[styles.avatar, { backgroundColor: colors.accent }]}>
                <Text style={[styles.avatarText, { color: colors.primary }]}>
                  {item.fullName?.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={styles.info}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { color: colors.foreground }]}>{item.fullName}</Text>
                  {item.verificationStatus === "verified" && (
                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                  )}
                </View>
                <Text style={[styles.profession, { color: colors.mutedForeground }]}>
                  {item.profession}{item.company ? ` at ${item.company}` : ""}
                </Text>
                <Text style={[styles.jnv, { color: colors.mutedForeground }]}>
                  {item.jnvName} {item.passoutYear ? `• Batch ${item.passoutYear}` : ""}
                </Text>
              </View>
            </View>
            {item.skills?.length > 0 && (
              <View style={styles.skills}>
                {item.skills.slice(0, 3).map((s) => (
                  <View key={s} style={[styles.skillChip, { backgroundColor: colors.muted }]}>
                    <Text style={[styles.skillText, { color: colors.mutedForeground }]}>{s}</Text>
                  </View>
                ))}
              </View>
            )}
          </PremiumCard>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  searchBox: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, gap: 8 },
  searchInput: { flex: 1, color: "#fff", fontSize: 14, fontFamily: "Inter_400Regular" },
  listContent: { padding: 16 },
  card: { marginBottom: 10 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, fontFamily: "Inter_700Bold" },
  info: { flex: 1 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 2 },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  profession: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 2 },
  jnv: { fontSize: 12, fontFamily: "Inter_400Regular" },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  skillChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  skillText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
});
