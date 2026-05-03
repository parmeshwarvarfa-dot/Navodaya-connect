import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useAuth } from "@/context/AuthContext";

const ALL_NAVODAYANS = { id: "all-navodayans", icon: "chatbubbles-outline" as const, name: "All Navodayans", lastMessage: "United by JNV spirit!", time: "12:51 PM", color: "#FFF7ED", iconColor: "#F59E0B" };

const HOUSE_META: Record<string, { color: string; bg: string; emoji: string }> = {
  Aravali:  { color: "#1D6ADE", bg: "#EFF6FF", emoji: "💙" },
  Nilgiri:  { color: "#16A34A", bg: "#F0FDF4", emoji: "💚" },
  Shivalik: { color: "#DC2626", bg: "#FEF2F2", emoji: "❤️" },
  Udaygiri: { color: "#D97706", bg: "#FFFBEB", emoji: "💛" },
};

const HOUSE_GROUPS = [
  { id: "aravali-house", name: "Aravali House 💙", color: "#1D6ADE", members: 28, icon: "🏠" },
  { id: "nilgiri-house", name: "Nilgiri House 💚", color: "#10B981", members: 24, icon: "🌿" },
  { id: "shivalik-house", name: "Shivalik House ❤️", color: "#DC2626", members: 31, icon: "⛰️" },
  { id: "udaygiri-house", name: "Udaygiri House 💛", color: "#D97706", members: 26, icon: "🌄" },
];

const EXPLORE_GROUPS = [
  { id: "alumni-network", name: "JNV Alumni Network", members: "4.2K", icon: "people-outline" as const, color: "#3D5AF1" },
  { id: "upsc-aspirants", name: "UPSC Aspirants", members: "1.8K", icon: "trophy-outline" as const, color: "#F59E0B" },
  { id: "tech-careers", name: "Tech Careers", members: "2.1K", icon: "laptop-outline" as const, color: "#10B981" },
  { id: "jee-neet", name: "JEE & NEET Prep", members: "3.4K", icon: "school-outline" as const, color: "#8B5CF6" },
  { id: "arts-culture", name: "Arts & Culture", members: "980", icon: "color-palette-outline" as const, color: "#EF4444" },
];

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinedHouses, setJoinedHouses] = useState<Set<string>>(new Set());
  const [joinedExplore, setJoinedExplore] = useState<Set<string>>(new Set());
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [leaveConfirm, setLeaveConfirm] = useState<{ type: "house" | "explore"; id: string; name: string } | null>(null);
  const [joinToast, setJoinToast] = useState("");
  const [groupCreatedToast, setGroupCreatedToast] = useState("");
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const house = profile?.house ?? "";
  const houseMeta = HOUSE_META[house];

  const houseGroup = house
    ? {
        id: `${house.toLowerCase()}-myhouse`,
        icon: "home-outline" as const,
        name: `${house} House ${houseMeta?.emoji ?? "🏠"}`,
        lastMessage: `Welcome to ${house} House!`,
        time: "12:51 PM",
        color: houseMeta?.bg ?? "#EEF2FF",
        iconColor: houseMeta?.color ?? "#3D5AF1",
      }
    : null;

  const batchOrClassGroup = (() => {
    if (!profile) return null;
    if (profile.role === "alumni" && profile.passoutYear) {
      return {
        id: `batch-${profile.passoutYear}`,
        icon: "people-outline" as const,
        name: `Batch ${profile.passoutYear}`,
        lastMessage: `Connect with your Batch ${profile.passoutYear} batchmates!`,
        time: "12:51 PM",
        color: "#EEF2FF",
        iconColor: "#3D5AF1",
      };
    }
    if (profile.role === "student" && profile.class) {
      return {
        id: `class-${profile.class}`,
        icon: "school-outline" as const,
        name: `Class ${profile.class}`,
        lastMessage: `Study and connect with your Class ${profile.class} mates!`,
        time: "12:51 PM",
        color: "#EEF2FF",
        iconColor: "#3D5AF1",
      };
    }
    return null;
  })();

  const jnvGroup = profile?.jnvName
    ? {
        id: `jnv-${profile.jnvName.toLowerCase().replace(/\s+/g, "-")}`,
        icon: "chatbubble-outline" as const,
        name: profile.jnvName,
        lastMessage: `Connect with your ${profile.jnvName} community!`,
        time: "12:51 PM",
        color: "#F0FDF4",
        iconColor: "#10B981",
      }
    : null;

  const YOUR_GROUPS = [batchOrClassGroup, houseGroup, jnvGroup, ALL_NAVODAYANS].filter(Boolean) as typeof ALL_NAVODAYANS[];

  const filtered = searchQuery.trim()
    ? YOUR_GROUPS.filter((g) => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : YOUR_GROUPS;

  const showToast = (msg: string) => {
    setJoinToast(msg);
    setTimeout(() => setJoinToast(""), 2500);
  };

  const toggleHouse = (id: string, name: string) => {
    if (joinedHouses.has(id)) {
      setLeaveConfirm({ type: "house", id, name });
    } else {
      setJoinedHouses((prev) => { const n = new Set(prev); n.add(id); return n; });
    }
  };

  const toggleExplore = (id: string, name: string) => {
    if (joinedExplore.has(id)) {
      setLeaveConfirm({ type: "explore", id, name });
    } else {
      setJoinedExplore((prev) => { const n = new Set(prev); n.add(id); return n; });
      showToast(`Joined "${name}"!`);
    }
  };

  const confirmLeave = () => {
    if (!leaveConfirm) return;
    if (leaveConfirm.type === "house") {
      setJoinedHouses((p) => { const n = new Set(p); n.delete(leaveConfirm.id); return n; });
    } else {
      setJoinedExplore((p) => { const n = new Set(p); n.delete(leaveConfirm.id); return n; });
    }
    setLeaveConfirm(null);
  };

  const handleCreateGroup = () => {
    if (!newGroupName.trim()) return;
    const name = newGroupName.trim();
    setNewGroupName("");
    setShowNewGroup(false);
    setGroupCreatedToast(`"${name}" created! Invite members to join.`);
    setTimeout(() => setGroupCreatedToast(""), 3000);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        {showSearch ? (
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search groups..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>Chat Groups</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(true)}>
                <Ionicons name="search-outline" size={20} color="#3D5AF1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowNewGroup(true)}>
                <Ionicons name="add" size={22} color="#3D5AF1" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <View style={styles.groupList}>
            {(searchQuery ? filtered : YOUR_GROUPS).map((group) => (
              <TouchableOpacity
                key={group.id}
                style={styles.groupRow}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: "/(screens)/group-chat" as any, params: { id: group.id, name: encodeURIComponent(group.name) } })}
              >
                <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
                  <Ionicons name={group.icon} size={22} color={group.iconColor} />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMessage} numberOfLines={1}>{group.lastMessage}</Text>
                </View>
                <View style={styles.groupRight}>
                  <Text style={styles.groupTime}>{group.time}</Text>
                  <View style={styles.unreadDot} />
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {!searchQuery && (
          <>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>House Groups</Text>
              <Text style={styles.sectionSub}>Join your house group for competitions and activities</Text>
              <View style={styles.houseGrid}>
                {HOUSE_GROUPS.map((h) => {
                  const joined = joinedHouses.has(h.id);
                  return (
                    <View key={h.id} style={styles.houseCard}>
                      <View style={[styles.houseColorBar, { backgroundColor: h.color }]} />
                      <View style={styles.houseCardBody}>
                        <Text style={styles.houseEmoji}>{h.icon}</Text>
                        <Text style={styles.houseName}>{h.name}</Text>
                        <Text style={styles.houseMembers}>{h.members + (joined ? 1 : 0)} members</Text>
                        <TouchableOpacity
                          style={[styles.joinBtn, { backgroundColor: joined ? "#E5E7EB" : h.color }]}
                          onPress={() => joined
                            ? router.push({ pathname: "/(screens)/group-chat" as any, params: { id: h.id, name: encodeURIComponent(h.name + " House") } })
                            : toggleHouse(h.id, h.name)
                          }
                        >
                          <Text style={[styles.joinBtnText, { color: joined ? "#374151" : "#fff" }]}>
                            {joined ? "Open Chat" : "Join"}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Explore Groups</Text>
              {EXPLORE_GROUPS.map((g) => {
                const joined = joinedExplore.has(g.id);
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.exploreRow}
                    activeOpacity={0.7}
                    onPress={() => joined
                      ? router.push({ pathname: "/(screens)/group-chat" as any, params: { id: g.id, name: encodeURIComponent(g.name) } })
                      : undefined
                    }
                  >
                    <View style={[styles.exploreIcon, { backgroundColor: g.color + "18" }]}>
                      <Ionicons name={g.icon} size={20} color={g.color} />
                    </View>
                    <View style={styles.exploreInfo}>
                      <Text style={styles.exploreName}>{g.name}</Text>
                      <Text style={styles.exploreMembers}>{g.members} members</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinSmBtn, { borderColor: joined ? "#E5E7EB" : g.color, backgroundColor: joined ? g.color : "transparent" }]}
                      onPress={() => toggleExplore(g.id, g.name)}
                    >
                      <Text style={[styles.joinSmText, { color: joined ? "#fff" : g.color }]}>
                        {joined ? "Joined ✓" : "Join"}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={showNewGroup} animationType="slide" presentationStyle="formSheet">
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Group</Text>
            <TouchableOpacity onPress={() => setShowNewGroup(false)}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
          </View>
          <View style={styles.modalBody}>
            <Text style={styles.inputLabel}>Group Name</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Enter group name..."
              placeholderTextColor="#9CA3AF"
              value={newGroupName}
              onChangeText={setNewGroupName}
            />
            <TouchableOpacity
              style={[styles.createBtn, !newGroupName.trim() && { opacity: 0.5 }]}
              onPress={handleCreateGroup}
              disabled={!newGroupName.trim()}
            >
              <Text style={styles.createBtnText}>Create Group</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Leave confirmation modal */}
      <Modal visible={!!leaveConfirm} transparent animationType="fade">
        <View style={styles.leaveOverlay}>
          <View style={styles.leaveCard}>
            <Text style={styles.leaveTitle}>Leave Group</Text>
            <Text style={styles.leaveSub}>
              {leaveConfirm ? `Leave "${leaveConfirm.name}"?` : ""}
            </Text>
            <View style={styles.leaveRow}>
              <TouchableOpacity style={styles.leaveCancelBtn} onPress={() => setLeaveConfirm(null)}>
                <Text style={styles.leaveCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.leaveConfirmBtn} onPress={confirmLeave}>
                <Text style={styles.leaveConfirmText}>Leave</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join / Group Created toast */}
      {(joinToast || groupCreatedToast) ? (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>{joinToast || groupCreatedToast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  headerRight: { position: "absolute", right: 16, bottom: 12, flexDirection: "row", gap: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: {
    flex: 1, backgroundColor: "#F3F4F6", borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 9,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827",
  },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 14 },
  groupList: {},
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    gap: 14,
  },
  groupIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  groupMessage: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  groupRight: { alignItems: "flex-end", gap: 4 },
  groupTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3D5AF1" },
  houseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  houseCard: {
    width: "47%", backgroundColor: "#F9FAFB",
    borderRadius: 14, overflow: "hidden",
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  houseColorBar: { height: 5 },
  houseCardBody: { padding: 14, gap: 4 },
  houseEmoji: { fontSize: 24, marginBottom: 4 },
  houseName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  houseMembers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 8 },
  joinBtn: { paddingVertical: 7, borderRadius: 20, alignItems: "center" },
  joinBtnText: { fontFamily: "Inter_600SemiBold", fontSize: 13 },
  exploreRow: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5", gap: 14,
  },
  exploreIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  exploreInfo: { flex: 1 },
  exploreName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  exploreMembers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  joinSmBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  joinSmText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  modalWrap: { flex: 1, backgroundColor: "#fff" },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 8 },
  modalInput: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16,
  },
  createBtn: { backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  createBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  leaveOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", paddingHorizontal: 32 },
  leaveCard: { backgroundColor: "#fff", borderRadius: 20, padding: 24, width: "100%" },
  leaveTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111", marginBottom: 6 },
  leaveSub: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 20 },
  leaveRow: { flexDirection: "row", gap: 12 },
  leaveCancelBtn: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  leaveCancelText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#374151" },
  leaveConfirmBtn: { flex: 1, backgroundColor: "#EF4444", borderRadius: 12, paddingVertical: 13, alignItems: "center" },
  leaveConfirmText: { fontFamily: "Inter_600SemiBold", fontSize: 15, color: "#fff" },
  toast: { position: "absolute", bottom: 24, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  toastText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
