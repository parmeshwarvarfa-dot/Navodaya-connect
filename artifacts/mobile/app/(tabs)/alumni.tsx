import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  TextInput,
  ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { AlumniUser } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

const FILTERS = ["All", "Verified", "Engineers", "Doctors", "IAS/IPS", "Defence"];

const AVATAR_COLORS = ["#1A3C6E", "#FF7A00", "#16A34A", "#8B5CF6", "#EF4444", "#0891B2"];

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function AlumniScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [alumni, setAlumni] = useState<AlumniUser[]>([]);
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  useEffect(() => {
    api.users.alumni().then(setAlumni).catch(() => {});
  }, []);

  const filtered = alumni.filter((a) => {
    const matchSearch =
      !search ||
      a.fullName?.toLowerCase().includes(search.toLowerCase()) ||
      a.profession?.toLowerCase().includes(search.toLowerCase()) ||
      a.company?.toLowerCase().includes(search.toLowerCase()) ||
      a.jnvName?.toLowerCase().includes(search.toLowerCase());

    const matchFilter =
      activeFilter === "All" ||
      (activeFilter === "Verified" && a.verificationStatus === "verified") ||
      (activeFilter === "Engineers" && a.profession?.toLowerCase().includes("engineer")) ||
      (activeFilter === "Doctors" && a.profession?.toLowerCase().includes("doctor")) ||
      (activeFilter === "IAS/IPS" && (a.profession?.toLowerCase().includes("ias") || a.profession?.toLowerCase().includes("ips") || a.profession?.toLowerCase().includes("officer"))) ||
      (activeFilter === "Defence" && a.profession?.toLowerCase().includes("defence"));

    return matchSearch && matchFilter;
  });

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Alumni Network</Text>
            <Text style={styles.headerSubtitle}>{alumni.length.toLocaleString()} members</Text>
          </View>
          <TouchableOpacity style={styles.filterIconBtn}>
            <Ionicons name="options-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, { backgroundColor: "#fff" }]}>
          <Ionicons name="search-outline" size={16} color={colors.mutedForeground} />
          <TextInput
            placeholder="Search by name, batch, profession…"
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch("")}>
              <Ionicons name="close-circle" size={16} color={colors.mutedForeground} />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <View style={[styles.filterRow, { borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterContent}>
          {FILTERS.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setActiveFilter(f)}
              style={[
                styles.filterChip,
                {
                  backgroundColor: activeFilter === f ? colors.saffron : colors.muted,
                  borderColor: activeFilter === f ? colors.saffron : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: activeFilter === f ? "#fff" : colors.mutedForeground },
                ]}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 100 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <Text style={[styles.resultsText, { color: colors.mutedForeground }]}>
            {filtered.length} alumni found
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color={colors.mutedForeground} />
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No alumni found</Text>
            <Text style={[styles.emptySub, { color: colors.mutedForeground }]}>Try a different search or filter</Text>
          </View>
        }
        renderItem={({ item, index }) => {
          const avatarColor = AVATAR_COLORS[index % AVATAR_COLORS.length];
          const initials = getInitials(item.fullName || "?");
          return (
            <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.cardRow}>
                <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
                <View style={styles.info}>
                  <View style={styles.nameRow}>
                    <Text style={[styles.name, { color: colors.foreground }]}>{item.fullName}</Text>
                    {item.verificationStatus === "verified" && (
                      <View style={styles.verifiedBadge}>
                        <Ionicons name="checkmark-circle" size={14} color="#16A34A" />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    )}
                  </View>
                  {item.profession && (
                    <Text style={[styles.profession, { color: colors.mutedForeground }]}>
                      {item.profession}{item.company ? ` · ${item.company}` : ""}
                    </Text>
                  )}
                  {item.jnvName && (
                    <View style={styles.jnvRow}>
                      <Ionicons name="school-outline" size={11} color={colors.mutedForeground} />
                      <Text style={[styles.jnv, { color: colors.mutedForeground }]}>{item.jnvName}</Text>
                    </View>
                  )}
                </View>
              </View>

              {item.skills && item.skills.length > 0 && (
                <View style={styles.skills}>
                  {item.skills.slice(0, 3).map((s) => (
                    <View key={s} style={[styles.skillChip, { backgroundColor: colors.saffronLight }]}>
                      <Text style={[styles.skillText, { color: colors.saffron }]}>{s}</Text>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.cardActions}>
                <TouchableOpacity style={[styles.connectBtn, { backgroundColor: colors.primary }]}>
                  <Text style={styles.connectText}>Connect</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.msgBtn, { borderColor: colors.primary }]}>
                  <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
                  <Text style={[styles.msgText, { color: colors.primary }]}>Message</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  headerTitle: { color: "#fff", fontSize: 22, fontFamily: "Inter_700Bold" },
  headerSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  filterIconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.15)", alignItems: "center", justifyContent: "center" },
  searchBox: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, gap: 8 },
  searchInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular" },
  filterRow: { paddingVertical: 10, borderBottomWidth: 1 },
  filterContent: { paddingHorizontal: 16, gap: 8 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  filterChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  listContent: { padding: 16 },
  resultsText: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 12 },
  card: { borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardRow: { flexDirection: "row", gap: 12, marginBottom: 10 },
  avatar: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  info: { flex: 1, justifyContent: "center" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 3, flexWrap: "wrap" },
  name: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F0FDF4", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10 },
  verifiedText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#16A34A" },
  profession: { fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 3 },
  jnvRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  jnv: { fontSize: 12, fontFamily: "Inter_400Regular" },
  skills: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  skillChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  skillText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  cardActions: { flexDirection: "row", gap: 10 },
  connectBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: "center" },
  connectText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  msgBtn: { flex: 1, flexDirection: "row", paddingVertical: 8, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5, gap: 5 },
  msgText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", paddingTop: 60, gap: 10 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular" },
});
