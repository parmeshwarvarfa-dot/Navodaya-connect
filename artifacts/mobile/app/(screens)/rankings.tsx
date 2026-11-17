import React from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function RankingsScreen() {
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>JNV Ranking</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.icon}><Ionicons name="trophy-outline" size={28} color="#B7791F" /></View>
        <Text style={styles.heading}>Verified ranking data is not connected</Text>
        <Text style={styles.message}>This app does not yet have an official JNV ranking data source. Rankings will appear here when verified school data and ranking rules are available.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#ECEEF2" },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, color: "#111827", fontSize: 19, fontFamily: "Inter_700Bold" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  icon: { width: 60, height: 60, borderRadius: 30, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFBEB", marginBottom: 16 },
  heading: { color: "#111827", fontSize: 18, fontFamily: "Inter_700Bold", textAlign: "center", marginBottom: 8 },
  message: { maxWidth: 370, color: "#6B7280", fontSize: 14, lineHeight: 21, textAlign: "center", fontFamily: "Inter_400Regular" },
});
