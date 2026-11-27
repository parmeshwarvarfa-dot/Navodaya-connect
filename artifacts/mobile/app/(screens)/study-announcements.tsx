import React, { useCallback, useEffect, useState } from "react";
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { Announcement } from "@/lib/api";
import { ThemedText as Text } from "@/components/ThemedNative";

export default function StudyAnnouncementsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setItems(await api.announcements.list());
    } catch (cause: any) {
      setError(cause?.message || "Announcements could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <View style={styles.page}>
      <View style={[styles.header, { paddingTop: (Platform.OS === "web" ? 0 : insets.top) + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.title}>School Announcements</Text>
        <TouchableOpacity onPress={load} style={styles.refresh} accessibilityLabel="Refresh announcements">
          <Ionicons name="refresh-outline" size={20} color="#7C3AED" />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: 32 + insets.bottom }]}>
        {loading ? <Text style={styles.notice}>Loading announcements…</Text> : null}
        {!loading && error ? (
          <TouchableOpacity style={styles.noticeCard} onPress={load}>
            <Text style={styles.error}>{error}</Text><Text style={styles.retry}>Tap to retry</Text>
          </TouchableOpacity>
        ) : null}
        {!loading && !error && items.length === 0 ? <Text style={styles.notice}>No announcements are available for your school or class.</Text> : null}
        {items.map((item) => (
          <View key={item.id} style={styles.card}>
            <View style={[styles.priorityDot, item.priority === "urgent" && styles.urgentDot]} />
            <View style={styles.body}>
              <View style={styles.metaRow}>
                {item.pinned ? <Ionicons name="pin" size={13} color="#7C3AED" /> : null}
                <Text style={styles.audience}>{item.target}</Text>
                <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString()}</Text>
              </View>
              <Text style={styles.heading}>{item.title}</Text>
              <Text style={styles.message}>{item.body}</Text>
              <Text style={styles.author}>Posted by {item.authorName || "School staff"}</Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  back: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  title: { flex: 1, fontSize: 18, fontWeight: "700", color: "#111827" },
  refresh: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  content: { padding: 16, gap: 12 },
  notice: { textAlign: "center", padding: 24, color: "#6B7280", fontSize: 14 },
  noticeCard: { backgroundColor: "#fff", borderRadius: 14, padding: 18, alignItems: "center" },
  error: { color: "#B91C1C", textAlign: "center" },
  retry: { marginTop: 6, color: "#7C3AED", fontWeight: "600" },
  card: { flexDirection: "row", gap: 12, backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E8EAF0" },
  priorityDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#F59E0B", marginTop: 5 },
  urgentDot: { backgroundColor: "#EF4444" },
  body: { flex: 1 },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  audience: { color: "#6B7280", fontSize: 12, flex: 1 },
  date: { color: "#9CA3AF", fontSize: 11 },
  heading: { color: "#111827", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  message: { color: "#374151", fontSize: 14, lineHeight: 21 },
  author: { color: "#9CA3AF", fontSize: 11, marginTop: 10 },
});
