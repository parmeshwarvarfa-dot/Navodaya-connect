import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const CATEGORIES = ["General", "Academic", "Sports", "Cultural", "Achievement", "Announcement"];

export default function CreateNewsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [category, setCategory] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const handlePost = async () => {
    setError("");
    if (!title.trim()) { setError("Please add a title for your post."); return; }
    if (!description.trim()) { setError("Please add some content to your post."); return; }
    if (!sourceUrl.trim()) { setError("Add the original source URL for this update."); return; }
    try {
      const url = new URL(sourceUrl.trim());
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
    } catch {
      setError("Enter a valid http or https source URL.");
      return;
    }
    setSubmitting(true);
    try {
      await api.news.create({ title: title.trim(), description: description.trim(), category, sourceUrl: sourceUrl.trim() });
      router.back();
    } catch {
      setError("Failed to post update. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="close" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>New Post</Text>
        <TouchableOpacity
           style={[styles.postBtn, (!title.trim() || !description.trim() || !sourceUrl.trim() || submitting) && styles.postBtnDisabled]}
          onPress={handlePost}
           disabled={!title.trim() || !description.trim() || !sourceUrl.trim() || submitting}
        >
          <Text style={styles.postBtnText}>{submitting ? "Posting..." : "Post"}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
        <View style={styles.authorRow}>
          <View style={styles.authorAvatar}>
            <Text style={styles.authorInitial}>{(profile?.fullName || "U")[0].toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.authorName}>{profile?.fullName || "Navodayan"}</Text>
            <Text style={styles.authorRole}>{profile?.jnvName || "JNV India"}</Text>
          </View>
        </View>

        <TextInput
          style={styles.titleInput}
          placeholder="Write a title..."
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
          multiline={false}
        />

        <TextInput
          style={styles.contentInput}
          placeholder="What's on your mind? Share an update, achievement, or news with your community..."
          placeholderTextColor="#9CA3AF"
          value={description}
          onChangeText={setDescription}
          multiline
          textAlignVertical="top"
        />

        <TextInput
          style={styles.sourceInput}
          placeholder="Original source URL (https://...)"
          placeholderTextColor="#9CA3AF"
          value={sourceUrl}
          onChangeText={setSourceUrl}
          autoCapitalize="none"
          keyboardType="url"
        />

        <View style={styles.divider} />

        <View style={styles.sectionWrap}>
          <Text style={styles.sectionLabel}>Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.categoryChip, category === cat && styles.categoryChipActive]}
                onPress={() => setCategory(cat)}
              >
                <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  errorText: { color: "#EF4444", fontSize: 13, fontFamily: "Inter_500Medium", marginTop: 4, paddingHorizontal: 4 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827", textAlign: "center" },
  postBtn: {
    backgroundColor: "#3D5AF1", borderRadius: 20,
    paddingHorizontal: 18, paddingVertical: 8,
  },
  postBtnDisabled: { backgroundColor: "#93C5FD" },
  postBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 14 },
  body: { flex: 1 },
  authorRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 20, paddingVertical: 16,
  },
  authorAvatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center",
  },
  authorInitial: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  authorName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" },
  authorRole: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 1 },
  titleInput: {
    paddingHorizontal: 20, paddingVertical: 4,
    fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827",
    borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
    paddingBottom: 16,
  },
  contentInput: {
    paddingHorizontal: 20, paddingTop: 16,
    fontSize: 15, fontFamily: "Inter_400Regular",
    color: "#374151", lineHeight: 24,
    minHeight: 160,
  },
  sourceInput: {
    marginHorizontal: 20,
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#374151",
  },
  divider: { height: 1, backgroundColor: "#F0F0F0", marginHorizontal: 20, marginVertical: 16 },
  sectionWrap: { paddingHorizontal: 20 },
  sectionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 10 },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 20, backgroundColor: "#F3F4F6",
    borderWidth: 1.5, borderColor: "transparent",
  },
  categoryChipActive: { backgroundColor: "#EEF2FF", borderColor: "#3D5AF1" },
  categoryText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  categoryTextActive: { color: "#3D5AF1" },
  attachRow: { flexDirection: "row", paddingHorizontal: 20, gap: 24 },
  attachBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  attachText: { fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
});
