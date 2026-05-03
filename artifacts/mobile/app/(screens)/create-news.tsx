import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Platform,
  Alert,
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
  const [category, setCategory] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const handlePost = async () => {
    if (!title.trim()) { Alert.alert("Title required", "Please add a title for your post."); return; }
    if (!description.trim()) { Alert.alert("Content required", "Please add some content to your post."); return; }
    setSubmitting(true);
    try {
      await api.news.create({ title: title.trim(), description: description.trim(), category });
      Alert.alert("Posted!", "Your update has been shared with the community.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert("Error", "Failed to post update. Please try again.");
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
          style={[styles.postBtn, (!title.trim() || !description.trim() || submitting) && styles.postBtnDisabled]}
          onPress={handlePost}
          disabled={!title.trim() || !description.trim() || submitting}
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

        <View style={styles.divider} />

        <View style={styles.attachRow}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => Alert.alert("Photo", "Photo attachment coming soon!")}>
            <Ionicons name="image-outline" size={20} color="#3D5AF1" />
            <Text style={styles.attachText}>Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={() => Alert.alert("Link", "Link attachment coming soon!")}>
            <Ionicons name="link-outline" size={20} color="#10B981" />
            <Text style={styles.attachText}>Link</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachBtn} onPress={() => Alert.alert("Poll", "Poll feature coming soon!")}>
            <Ionicons name="stats-chart-outline" size={20} color="#F59E0B" />
            <Text style={styles.attachText}>Poll</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
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
