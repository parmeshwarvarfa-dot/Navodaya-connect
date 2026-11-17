import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProfilePostsSection from "@/components/profile/ProfilePostsSection";

export default function ProfilePostsScreen() {
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ userId?: string; isOwner?: string; restricted?: string }>();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const isOwner = params.isOwner === "true";
  const restricted = params.restricted === "true";

  return (
    <View style={styles.screen}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 8) }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color="#26324A" />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.title}>Posts</Text>
          <Text style={styles.subtitle}>All posts shared on this profile</Text>
        </View>
      </View>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, { paddingBottom: 28 + insets.bottom }]}>
        {userId ? (
          <ProfilePostsSection userId={userId} isOwner={isOwner} restricted={restricted} mode="all" />
        ) : (
          <View style={styles.empty}>
            <Ionicons name="alert-circle-outline" size={26} color="#7C879B" />
            <Text style={styles.emptyText}>This profile’s posts could not be opened.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EAECF0" },
  backButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F3FF" },
  headerText: { flex: 1 },
  title: { color: "#111827", fontSize: 20, fontFamily: "Inter_700Bold" },
  subtitle: { marginTop: 2, color: "#69758B", fontSize: 12, fontFamily: "Inter_400Regular" },
  content: { paddingHorizontal: 16 },
  empty: { minHeight: 180, alignItems: "center", justifyContent: "center", gap: 8 },
  emptyText: { color: "#69758B", fontSize: 14, fontFamily: "Inter_500Medium" },
});
