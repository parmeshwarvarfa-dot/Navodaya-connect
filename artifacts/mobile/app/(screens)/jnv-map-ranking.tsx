import React from "react";
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const OPTIONS = [
  {
    title: "JNV Connect Map",
    description: "Explore Jawahar Navodaya Vidyalayas across locations.",
    icon: "map-outline" as const,
    color: "#3151E8",
    background: "#EEF2FF",
    route: "/(screens)/map-prototype",
  },
  {
    title: "JNV Ranking",
    description: "Explore JNV rankings and compare schools.",
    icon: "trophy-outline" as const,
    color: "#B7791F",
    background: "#FFFBEB",
    route: "/(screens)/rankings",
  },
];

export default function JnvMapRankingScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>JNV Map & Ranking</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 28 }]}>
        <Text style={styles.intro}>Explore Navodaya schools and browse available school information.</Text>
        {OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.title}
            style={styles.card}
            activeOpacity={0.82}
            onPress={() => router.push(option.route as any)}
            accessibilityRole="button"
            accessibilityLabel={`${option.title}. ${option.description}`}
          >
            <View style={[styles.iconWrap, { backgroundColor: option.background }]}>
              <Ionicons name={option.icon} size={27} color={option.color} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.cardTitle}>{option.title}</Text>
              <Text style={styles.cardDescription}>{option.description}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF2" },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, color: "#111827", fontSize: 19, fontFamily: "Inter_700Bold" },
  content: { padding: 16, gap: 14 },
  intro: { color: "#6B7280", fontSize: 14, lineHeight: 21, marginBottom: 4 },
  card: { minHeight: 112, padding: 17, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 18, flexDirection: "row", alignItems: "center", gap: 14, elevation: 2, shadowColor: "#111827", shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  iconWrap: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  cardText: { flex: 1, gap: 5 },
  cardTitle: { color: "#111827", fontSize: 17, fontFamily: "Inter_700Bold" },
  cardDescription: { color: "#6B7280", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
});
