import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Platform } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";

const CATEGORIES = ["All", "Tech", "Sports", "Arts", "Academic", "Social"];

const CLUBS = [
  { id: "1", name: "Coding Club",       category: "Tech",     icon: "code-slash-outline"     as const, color: "#3D5AF1", bg: "#EEF2FF", members: 42, desc: "Learn programming, build projects, compete in hackathons.", joined: false, upcoming: "Hackathon Prep — 12 May" },
  { id: "2", name: "Football Team",     category: "Sports",   icon: "football-outline"       as const, color: "#10B981", bg: "#ECFDF5", members: 22, desc: "Inter-school football tournament practice and matches.", joined: true,  upcoming: "Practice — Tomorrow 5PM" },
  { id: "3", name: "Debate Society",    category: "Academic", icon: "mic-outline"            as const, color: "#8B5CF6", bg: "#F5F3FF", members: 28, desc: "Parliamentary debates, MUNs, and public speaking sessions.", joined: false, upcoming: "Debate on AI — 15 May" },
  { id: "4", name: "Science Club",      category: "Academic", icon: "flask-outline"          as const, color: "#0891B2", bg: "#E0F2FE", members: 35, desc: "Science experiments, Olympiad preparation, and projects.", joined: true,  upcoming: "Olympiad Mock Test — 11 May" },
  { id: "5", name: "Music Band",        category: "Arts",     icon: "musical-notes-outline"  as const, color: "#EC4899", bg: "#FDF2F8", members: 18, desc: "Classical and modern music, annual cultural performances.", joined: false, upcoming: "Rehearsal — 13 May" },
  { id: "6", name: "Eco Club",          category: "Social",   icon: "leaf-outline"           as const, color: "#16A34A", bg: "#F0FDF4", members: 31, desc: "Environmental drives, tree plantation, and sustainability projects.", joined: false, upcoming: "Plantation Drive — 16 May" },
  { id: "7", name: "Robotics Club",     category: "Tech",     icon: "hardware-chip-outline"  as const, color: "#F59E0B", bg: "#FFFBEB", members: 19, desc: "Build robots, Arduino projects, and compete at national level.", joined: false, upcoming: "Arduino Workshop — 18 May" },
  { id: "8", name: "Art & Craft Club",  category: "Arts",     icon: "color-palette-outline"  as const, color: "#EF4444", bg: "#FEF2F2", members: 24, desc: "Painting, sculpture, and craft exhibitions.", joined: false, upcoming: "Exhibition — 20 May" },
];

export default function StudyClubsScreen() {
  const insets   = useSafeAreaInsets();
  const topPad   = Platform.OS === "web" ? 60 : insets.top;
  const [activeCategory, setActiveCategory] = useState("All");
  const [joined, setJoined] = useState<Set<string>>(new Set(CLUBS.filter((c) => c.joined).map((c) => c.id)));
  const [toast, setToast] = useState("");

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const toggle = (id: string, name: string) => {
    setJoined((p) => {
      const n = new Set(p);
      if (n.has(id)) { n.delete(id); showToast(`Left ${name}`); }
      else { n.add(id); showToast(`Joined ${name}! Welcome!`); }
      return n;
    });
  };

  const filtered = CLUBS.filter((c) => activeCategory === "All" || c.category === activeCategory);
  const myClubs  = CLUBS.filter((c) => joined.has(c.id));

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Clubs & Activities</Text>
        <View style={styles.joinedBadge}><Text style={styles.joinedBadgeText}>{joined.size} joined</Text></View>
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
                  <Text style={styles.myClubUpcoming}>{c.upcoming}</Text>
                </View>
              ))}
            </ScrollView>
          </>
        )}

        <Text style={styles.sectionTitle}>All Clubs</Text>
        {filtered.map((club) => {
          const isJoined = joined.has(club.id);
          return (
            <View key={club.id} style={styles.clubCard}>
              <View style={styles.clubTop}>
                <View style={[styles.clubIcon, { backgroundColor: club.bg }]}>
                  <Ionicons name={club.icon} size={26} color={club.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.clubNameRow}>
                    <Text style={styles.clubName}>{club.name}</Text>
                    {isJoined && (
                      <View style={styles.memberBadge}><Ionicons name="checkmark-circle" size={12} color="#10B981" /><Text style={styles.memberBadgeText}>Member</Text></View>
                    )}
                  </View>
                  <View style={styles.clubMeta}>
                    <View style={[styles.catPill, { backgroundColor: club.color + "18" }]}>
                      <Text style={[styles.catPillText, { color: club.color }]}>{club.category}</Text>
                    </View>
                    <Ionicons name="people-outline" size={12} color="#9CA3AF" />
                    <Text style={styles.memberCount}>{club.members} members</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.clubDesc}>{club.desc}</Text>

              {isJoined && (
                <View style={styles.upcomingRow}>
                  <Ionicons name="calendar-outline" size={13} color="#3D5AF1" />
                  <Text style={styles.upcomingText}>{club.upcoming}</Text>
                </View>
              )}

              <View style={styles.clubActions}>
                <TouchableOpacity
                  style={[styles.joinBtn, isJoined && styles.leaveBtn, { borderColor: isJoined ? "#EF4444" : club.color }]}
                  onPress={() => toggle(club.id, club.name)}
                >
                  <Ionicons name={isJoined ? "exit-outline" : "add-circle-outline"} size={16} color={isJoined ? "#EF4444" : club.color} />
                  <Text style={[styles.joinBtnText, { color: isJoined ? "#EF4444" : club.color }]}>{isJoined ? "Leave" : "Join Club"}</Text>
                </TouchableOpacity>
                {isJoined && (
                  <TouchableOpacity style={[styles.chatBtn, { backgroundColor: club.color }]}>
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
});
