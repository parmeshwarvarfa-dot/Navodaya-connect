import React, { useCallback, useEffect, useMemo, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api, type ClubWithMeta } from "@/lib/api";

const CATEGORIES = ["All", "Tech", "Sports", "Arts", "Academic", "Social"];

function categoryForClub(club: ClubWithMeta) {
  const text = `${club.name} ${club.description}`.toLowerCase();
  if (/code|tech|robot|computer|program/.test(text)) return "Tech";
  if (/sport|football|cricket|athlet|game/.test(text)) return "Sports";
  if (/music|art|dance|drama|paint|culture/.test(text)) return "Arts";
  if (/science|study|academic|debate|math|olympiad/.test(text)) return "Academic";
  return "Social";
}

export default function StudyClubsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 0 : insets.top;
  const [activeCategory, setActiveCategory] = useState("All");
  const [clubs, setClubs] = useState<ClubWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyClub, setBusyClub] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const fetchClubs = useCallback(async () => {
    try { setClubs(await api.clubs.list()); }
    catch { showToast("Could not load clubs. Please try again."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    void fetchClubs();
    const timer = setInterval(() => void fetchClubs(), 10000);
    return () => clearInterval(timer);
  }, [fetchClubs]);

  const filtered = useMemo(() => clubs.filter((club) => activeCategory === "All" || categoryForClub(club) === activeCategory), [clubs, activeCategory]);
  const myClubs = clubs.filter((club) => club.joined);

  const handleMembership = async (club: ClubWithMeta) => {
    setBusyClub(club.id);
    try {
      if (club.joined) {
        await api.clubs.leave(club.id);
        setClubs((current) => current.map((item) => item.id === club.id ? { ...item, joined: false, joinStatus: "none", members: Math.max(0, item.members - 1) } : item));
        showToast(`You left ${club.name}.`);
      } else {
        const response = await api.clubs.toggleJoin(club.id);
        setClubs((current) => current.map((item) => item.id === club.id ? { ...item, joined: response.joined, joinStatus: response.joinStatus as ClubWithMeta["joinStatus"] ?? "pending" } : item));
        showToast(response.joined ? `You joined ${club.name}.` : `Join request sent to ${club.managerName || "the club teacher"}.`);
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update club membership.");
    } finally { setBusyClub(null); }
  };

  const openClubChat = async (club: ClubWithMeta) => {
    try {
      const chat = await api.clubs.chat(club.id);
      router.push({ pathname: "/(screens)/group-chat" as any, params: { id: chat.id, name: chat.name } });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not open club chat.");
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clubs & Activities</Text>
        <View style={styles.joinedBadge}><Text style={styles.joinedBadgeText}>{clubs.filter((club) => club.joined).length} joined</Text></View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={{ flexGrow: 0 }}>
        {CATEGORIES.map((c) => (
          <TouchableOpacity key={c} style={[styles.chip, activeCategory === c && styles.chipActive]} onPress={() => setActiveCategory(c)}>
            <Text style={[styles.chipText, activeCategory === c && styles.chipTextActive]}>{c}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 + insets.bottom }}>

        {/* My clubs */}
        {myClubs.length > 0 && activeCategory === "All" && (
          <>
            <Text style={styles.sectionTitle}>My Clubs</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginBottom: 20 }}>
              {myClubs.map((c) => (
                <View key={c.id} style={[styles.myClubCard, { borderColor: c.color }]}>
                  <View style={[styles.myClubIcon, { backgroundColor: c.bg }]}>
                    <Ionicons name={c.icon} size={20} color={c.color} />
                  </View>
                  <Text style={styles.myClubName}>{c.name}</Text>
                  <Text style={styles.myClubUpcoming}>{c.nextEvent}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>All Clubs</Text>
        {loading ? <ActivityIndicator style={{ marginTop: 32 }} color="#3D5AF1" /> : null}
        {!loading && filtered.length === 0 ? <Text style={styles.emptyText}>No clubs available in this category yet.</Text> : null}
        {filtered.map((club) => {
          const isJoined = club.joined;
          const isPending = !isJoined && club.joinStatus === "pending";
          const wasDenied = !isJoined && club.joinStatus === "denied";
          const busy = busyClub === club.id;
          return (
            <View key={club.id} style={styles.clubCard}>
              <View style={styles.clubTop}>
                <View style={[styles.clubIcon, { backgroundColor: club.bg }]}>
                  <Ionicons name={club.icon as any} size={26} color={club.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.clubNameRow}>
                    <Text style={styles.clubName}>{club.name}</Text>
                    {isJoined ? <View style={styles.memberBadge}><Ionicons name="checkmark-circle" size={12} color="#10B981" /><Text style={styles.memberBadgeText}>Member</Text></View> : null}
                    {isPending ? <View style={styles.pendingBadge}><Ionicons name="time-outline" size={12} color="#D97706" /><Text style={styles.pendingBadgeText}>Request pending</Text></View> : null}
                  </View>
                  <View style={styles.clubMeta}>
                    <View style={[styles.catPill, { backgroundColor: club.color + "18" }]}>
                      <Text style={[styles.catPillText, { color: club.color }]}>{categoryForClub(club)}</Text>
                    </View>
                    <Ionicons name="people-outline" size={12} color="#9CA3AF" />
                    <Text style={styles.memberCount}>{club.members} members</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.clubDesc}>{club.description}</Text>

              {isJoined && (
                <View style={styles.upcomingRow}>
                  <Ionicons name="calendar-outline" size={13} color="#3D5AF1" />
                  <Text style={styles.upcomingText}>{club.nextEvent}</Text>
                </View>
              )}

              <View style={styles.clubActions}>
                <TouchableOpacity
                  style={[styles.joinBtn, isJoined && styles.leaveBtn, { borderColor: isJoined ? "#EF4444" : club.color }]}
                  onPress={() => void handleMembership(club)}
                  disabled={isPending || busy}
                >
                  {busy ? <ActivityIndicator size="small" color={club.color} /> : <Ionicons name={isJoined ? "exit-outline" : isPending ? "time-outline" : "add-circle-outline"} size={16} color={isJoined ? "#EF4444" : isPending ? "#D97706" : club.color} />}
                  <Text style={[styles.joinBtnText, { color: isJoined ? "#EF4444" : isPending ? "#D97706" : club.color }]}>{isJoined ? "Leave Club" : isPending ? "Request pending" : wasDenied ? "Request again" : "Request to join"}</Text>
                </TouchableOpacity>
                {isJoined && (
                  <TouchableOpacity style={[styles.chatBtn, { backgroundColor: club.color }]} onPress={() => void openClubChat(club)}>
                    <Ionicons name="chatbubbles-outline" size={15} color="#fff" />
                    <Text style={styles.chatBtnText}>Club Chat</Text>
                  </TouchableOpacity>
                )}
              </View>
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
  headerTitle: { flex: 1, fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  joinedBadge: { backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4 },
  joinedBadgeText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  chips: { paddingHorizontal: 16, gap: 8, paddingBottom: 14, paddingTop: 12 },
  chip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB" },
  chipActive: { backgroundColor: "#3D5AF1", borderColor: "#3D5AF1" },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#374151" },
  chipTextActive: { color: "#fff" },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 12 },
  myClubCard: { backgroundColor: "#fff", borderRadius: 14, padding: 14, width: 150, borderWidth: 2, gap: 6 },
  myClubIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  myClubName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  myClubUpcoming: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280" },
  clubCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "#F0F0F0" },
  clubTop: { flexDirection: "row", gap: 14, marginBottom: 10 },
  clubIcon: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center" },
  clubNameRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" },
  clubName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  memberBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#ECFDF5", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  memberBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#10B981" },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFFBEB", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  pendingBadgeText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#D97706" },
  clubMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  catPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  catPillText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  memberCount: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  clubDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 19, marginBottom: 10 },
  upcomingRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#EEF2FF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, marginBottom: 12 },
  upcomingText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#3D5AF1" },
  clubActions: { flexDirection: "row", gap: 10 },
  joinBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1.5, borderRadius: 10, paddingVertical: 9 },
  leaveBtn: { borderColor: "#EF4444" },
  joinBtnText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  chatBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderRadius: 10, paddingVertical: 9 },
  chatBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  toast: { position: "absolute", bottom: 36, left: 24, right: 24, backgroundColor: "rgba(30,27,75,0.92)", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16 },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13, textAlign: "center" },
  emptyText: { textAlign: "center", color: "#6B7280", fontFamily: "Inter_400Regular", marginTop: 32, lineHeight: 20 },
});
