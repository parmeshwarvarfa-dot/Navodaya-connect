import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Platform,
  Modal,
  ScrollView,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { NewsItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { PremiumButton } from "@/components/PremiumButton";
import { PremiumInput } from "@/components/PremiumInput";

const NEWS_CATEGORIES = ["General", "Academic", "Sports", "Cultural", "Achievement", "Announcement"];

export default function NewsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("General");
  const [submitting, setSubmitting] = useState(false);
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const canPost = profile?.role === "teacher" || profile?.role === "official";

  const fetchNews = async () => {
    try {
      const data = await api.news.list();
      setNews(data);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { fetchNews(); }, []);

  const handlePost = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Error", "Please fill all fields");
      return;
    }
    setSubmitting(true);
    try {
      await api.news.create({ title: title.trim(), description: description.trim(), category });
      setShowCreate(false);
      setTitle("");
      setDescription("");
      setCategory("General");
      fetchNews();
    } catch {
      Alert.alert("Error", "Failed to post news");
    }
    setSubmitting(false);
  };

  const handleDelete = (id: string) => {
    Alert.alert("Delete", "Delete this news post?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await api.news.delete(id);
            fetchNews();
          } catch {
            Alert.alert("Error", "Failed to delete");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>News</Text>
          {canPost && (
            <TouchableOpacity style={styles.addBtn} onPress={() => setShowCreate(true)}>
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      <FlatList
        data={news}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: 40 }]}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.emptyState}>
              <Ionicons name="newspaper-outline" size={48} color={colors.mutedForeground} />
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No news yet</Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => (
          <PremiumCard style={styles.newsCard}>
            <View style={styles.cardMeta}>
              <View style={[styles.catBadge, { backgroundColor: colors.accent }]}>
                <Text style={[styles.catText, { color: colors.primary }]}>{item.category}</Text>
              </View>
              {canPost && (
                <TouchableOpacity onPress={() => handleDelete(item.id)}>
                  <Ionicons name="trash-outline" size={16} color={colors.destructive} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={[styles.newsTitle, { color: colors.foreground }]}>{item.title}</Text>
            <Text style={[styles.newsDesc, { color: colors.mutedForeground }]}>{item.description}</Text>
            <Text style={[styles.newsAuthor, { color: colors.mutedForeground }]}>By {item.authorName}</Text>
          </PremiumCard>
        )}
      />

      <Modal visible={showCreate} animationType="slide" presentationStyle="formSheet">
        <View style={[styles.modalContainer, { backgroundColor: colors.background }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>Post News</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Ionicons name="close" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.modalContent} keyboardShouldPersistTaps="handled">
            <PremiumInput label="Title" value={title} onChangeText={setTitle} placeholder="News headline" icon="newspaper-outline" />
            <PremiumInput
              label="Description"
              value={description}
              onChangeText={setDescription}
              placeholder="Full news content..."
              multiline
              numberOfLines={5}
              style={{ minHeight: 100, textAlignVertical: "top" }}
              icon="create-outline"
            />
            <Text style={[styles.fieldLabel, { color: colors.mutedForeground }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {NEWS_CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  onPress={() => setCategory(c)}
                  style={[styles.chip, { backgroundColor: category === c ? colors.primary : colors.muted, borderRadius: 20 }]}
                >
                  <Text style={[styles.chipText, { color: category === c ? "#fff" : colors.foreground }]}>{c}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <PremiumButton title="Post News" onPress={handlePost} loading={submitting} style={{ marginTop: 8 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  addBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  listContent: { padding: 16 },
  newsCard: { marginBottom: 12 },
  cardMeta: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  catBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  catText: { fontSize: 11, fontFamily: "Inter_600SemiBold" },
  newsTitle: { fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 8, lineHeight: 22 },
  newsDesc: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, marginBottom: 10 },
  newsAuthor: { fontSize: 12, fontFamily: "Inter_400Regular" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 12 },
  emptyText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold" },
  modalContent: { padding: 20 },
  fieldLabel: { fontSize: 13, fontFamily: "Inter_500Medium", marginBottom: 8 },
  chipScroll: { marginBottom: 16 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, marginRight: 8 },
  chipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
});
