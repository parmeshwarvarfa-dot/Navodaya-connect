import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

const YOUR_GROUPS = [
  {
    id: "1", icon: "school-outline" as const, name: "Class 12",
    lastMessage: "Welcome to your class gr...", time: "12:51 PM", color: "#EEF2FF",
  },
  {
    id: "2", icon: "home-outline" as const, name: "Aravali House 💙",
    lastMessage: "Welcome to Aravali House!", time: "12:51 PM", color: "#EFF8FF",
  },
  {
    id: "3", icon: "chatbubble-outline" as const, name: "JNV Delhi",
    lastMessage: "Connect with your JNV c...", time: "12:51 PM", color: "#F0FDF4",
  },
  {
    id: "4", icon: "chatbubbles-outline" as const, name: "All Navodayans",
    lastMessage: "United by JNV spirit!", time: "12:51 PM", color: "#FFF7ED",
  },
];

const HOUSE_GROUPS = [
  { id: "h1", name: "Aravali", color: "#3D5AF1", members: 28, icon: "🏠" },
  { id: "h2", name: "Nilgiri", color: "#10B981", members: 24, icon: "🌿" },
  { id: "h3", name: "Shivalik", color: "#F59E0B", members: 31, icon: "⛰️" },
  { id: "h4", name: "Udaygiri", color: "#EF4444", members: 26, icon: "🌄" },
];

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>Chat Groups</Text>
        <TouchableOpacity style={styles.searchBtn}>
          <Ionicons name="search-outline" size={20} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Groups</Text>
          <View style={styles.groupList}>
            {YOUR_GROUPS.map((group) => (
              <TouchableOpacity key={group.id} style={styles.groupRow} activeOpacity={0.7}>
                <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
                  <Ionicons name={group.icon} size={22} color="#3D5AF1" />
                </View>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{group.name}</Text>
                  <Text style={styles.groupMessage} numberOfLines={1}>{group.lastMessage}</Text>
                </View>
                <Text style={styles.groupTime}>{group.time}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>House Groups</Text>
          <Text style={styles.sectionSub}>Join your house group for competitions and activities</Text>
          <View style={styles.houseGrid}>
            {HOUSE_GROUPS.map((h) => (
              <TouchableOpacity key={h.id} style={styles.houseCard} activeOpacity={0.8}>
                <View style={[styles.houseColorBar, { backgroundColor: h.color }]} />
                <View style={styles.houseCardBody}>
                  <Text style={styles.houseEmoji}>{h.icon}</Text>
                  <Text style={styles.houseName}>{h.name}</Text>
                  <Text style={styles.houseMembers}>{h.members} members</Text>
                  <TouchableOpacity style={[styles.joinBtn, { backgroundColor: h.color }]}>
                    <Text style={styles.joinBtnText}>Join</Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Explore Groups</Text>
          {[
            { id: "e1", name: "JNV Alumni Network", members: "4.2K", icon: "people-outline" as const, color: "#3D5AF1" },
            { id: "e2", name: "UPSC Aspirants", members: "1.8K", icon: "trophy-outline" as const, color: "#F59E0B" },
            { id: "e3", name: "Tech Careers", members: "2.1K", icon: "laptop-outline" as const, color: "#10B981" },
          ].map((g) => (
            <TouchableOpacity key={g.id} style={styles.exploreRow} activeOpacity={0.7}>
              <View style={[styles.exploreIcon, { backgroundColor: g.color + "15" }]}>
                <Ionicons name={g.icon} size={20} color={g.color} />
              </View>
              <View style={styles.exploreInfo}>
                <Text style={styles.exploreName}>{g.name}</Text>
                <Text style={styles.exploreMembers}>{g.members} members</Text>
              </View>
              <TouchableOpacity style={[styles.joinSmBtn, { borderColor: g.color }]}>
                <Text style={[styles.joinSmText, { color: g.color }]}>Join</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: "#fff",
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  searchBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center",
  },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 6 },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 14 },
  groupList: { gap: 0 },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    gap: 14,
  },
  groupIcon: {
    width: 50, height: 50, borderRadius: 25,
    alignItems: "center", justifyContent: "center",
  },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827", marginBottom: 3 },
  groupMessage: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  groupTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  houseGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  houseCard: {
    width: "47%",
    backgroundColor: "#F9FAFB",
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#F0F0F0",
  },
  houseColorBar: { height: 5 },
  houseCardBody: { padding: 14, gap: 4 },
  houseEmoji: { fontSize: 24, marginBottom: 4 },
  houseName: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827" },
  houseMembers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 8 },
  joinBtn: { paddingVertical: 7, borderRadius: 20, alignItems: "center" },
  joinBtnText: { color: "#fff", fontFamily: "Inter_600SemiBold", fontSize: 13 },
  exploreRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F5F5F5",
    gap: 14,
  },
  exploreIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  exploreInfo: { flex: 1 },
  exploreName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  exploreMembers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  joinSmBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  joinSmText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
