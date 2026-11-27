import React from "react";
import { Platform, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ThemedText as Text } from "@/components/ThemedNative";

export default function AcademicFeatureUnavailable({ title, message }: { title: string; message: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>{title}</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.icon}><Ionicons name="information-circle-outline" size={28} color="#7C3AED" /></View>
        <Text style={styles.heading}>Academic records are not connected</Text>
        <Text style={styles.message}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { minHeight: 58, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 10, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  title: { fontSize: 18, fontWeight: "700", color: "#111827" },
  content: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  icon: { width: 58, height: 58, borderRadius: 29, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F3FF", marginBottom: 16 },
  heading: { textAlign: "center", fontSize: 18, fontWeight: "700", color: "#111827", marginBottom: 8 },
  message: { maxWidth: 360, textAlign: "center", color: "#6B7280", fontSize: 14, lineHeight: 21 },
});
