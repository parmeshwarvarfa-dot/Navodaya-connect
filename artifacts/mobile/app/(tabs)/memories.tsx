import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Platform,
  Dimensions,
  Modal,
  TextInput,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { useAuth } from "@/context/AuthContext";

const { width } = Dimensions.get("window");
const COL = 3;
const ITEM_SIZE = (width - 4) / COL;

const CATEGORIES = ["All", "Sports", "Cultural", "Academic", "Farewell"];

const MEMORIES = [
  { id: "1", category: "Sports", uri: "https://picsum.photos/seed/sports1/400/400", caption: "Sports Day 2023", likes: 34 },
  { id: "2", category: "Cultural", uri: "https://picsum.photos/seed/culture1/400/400", caption: "Annual Day", likes: 67 },
  { id: "3", category: "Academic", uri: "https://picsum.photos/seed/study1/400/400", caption: "Science Fair", likes: 22 },
  { id: "4", category: "Sports", uri: "https://picsum.photos/seed/cricket1/400/400", caption: "Cricket Match", likes: 45 },
  { id: "5", category: "Farewell", uri: "https://picsum.photos/seed/farewell1/400/400", caption: "Farewell 2024", likes: 112 },
  { id: "6", category: "Cultural", uri: "https://picsum.photos/seed/dance1/400/400", caption: "Dance Night", likes: 78 },
  { id: "7", category: "Academic", uri: "https://picsum.photos/seed/lab1/400/400", caption: "Lab Work", likes: 19 },
  { id: "8", category: "Sports", uri: "https://picsum.photos/seed/football1/400/400", caption: "Football Final", likes: 56 },
  { id: "9", category: "Farewell", uri: "https://picsum.photos/seed/class2024/400/400", caption: "Last Day", likes: 203 },
  { id: "10", category: "Cultural", uri: "https://picsum.photos/seed/festival1/400/400", caption: "Navratri Fest", likes: 89 },
  { id: "11", category: "Academic", uri: "https://picsum.photos/seed/library1/400/400", caption: "Library Hour", likes: 14 },
  { id: "12", category: "Sports", uri: "https://picsum.photos/seed/kabaddi1/400/400", caption: "Kabaddi Finals", likes: 61 },
];

const topPicks = [
  { id: "a", uri: "https://picsum.photos/seed/jnvmemo1/600/300", caption: "Best Memories of 2024", likes: 142 },
  { id: "b", uri: "https://picsum.photos/seed/jnvmemo2/600/300", caption: "Sports Meet Champions", likes: 98 },
  { id: "c", uri: "https://picsum.photos/seed/jnvmemo3/600/300", caption: "Annual Day Highlights", likes: 76 },
];

interface MemoryItem {
  id: string;
  category: string;
  uri: string;
  caption: string;
  likes: number;
}

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const [selected, setSelected] = useState<MemoryItem | null>(null);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [showUpload, setShowUpload] = useState(false);
  const [uploadCaption, setUploadCaption] = useState("");
  const [uploadCategory, setUploadCategory] = useState("Sports");
  const [memories, setMemories] = useState(MEMORIES);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 2200); };

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { showToast("Photo library permission denied"); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.[0]?.uri) {
      setPickedUri(result.assets[0].uri);
    }
  };

  const handleShare = async (caption: string, uri: string) => {
    try {
      await Share.share({ message: `${caption} — shared from Navodaya Connect`, url: uri });
    } catch {
      showToast("Could not open share sheet");
    }
  };

  const filtered = activeCategory === "All"
    ? memories
    : memories.filter((m) => m.category === activeCategory);

  const toggleLike = (id: string) => {
    setLikedItems((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleUpload = () => {
    if (!uploadCaption.trim()) {
      showToast("Please add a caption for your memory.");
      return;
    }
    if (!pickedUri) {
      showToast("Please choose a photo first.");
      return;
    }
    const newMemory: MemoryItem = {
      id: `u${Date.now()}`,
      category: uploadCategory,
      uri: pickedUri,
      caption: uploadCaption.trim(),
      likes: 0,
    };
    setMemories((prev) => [newMemory, ...prev]);
    setUploadCaption("");
    setUploadCategory("Sports");
    setPickedUri(null);
    setShowUpload(false);
    showToast("Your memory has been shared with the community.");
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>Memories</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowUpload(true)}>
          <Ionicons name="add" size={22} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingLeft: 20, paddingRight: 8 }}>
            {topPicks.map((pick) => (
              <TouchableOpacity
                key={pick.id}
                style={styles.featuredCard}
                activeOpacity={0.9}
                onPress={() => setSelected({ id: pick.id, category: "Featured", uri: pick.uri, caption: pick.caption, likes: pick.likes })}
              >
                <Image source={{ uri: pick.uri }} style={styles.featuredImage} />
                <View style={styles.featuredOverlay}>
                  <Text style={styles.featuredCaption}>{pick.caption}</Text>
                  <View style={styles.featuredLikes}>
                    <Ionicons name="heart" size={13} color="#fff" />
                    <Text style={styles.featuredLikesText}>{pick.likes}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.section}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.catScroll}>
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[styles.catChip, activeCategory === cat && styles.catChipActive]}
                onPress={() => setActiveCategory(cat)}
              >
                <Text style={[styles.catText, activeCategory === cat && styles.catTextActive]}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.grid}>
          {filtered.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.gridItem}
              activeOpacity={0.85}
              onPress={() => setSelected(item)}
            >
              <Image source={{ uri: item.uri }} style={styles.gridImage} />
              {likedItems.has(item.id) && (
                <View style={styles.likedBadge}>
                  <Ionicons name="heart" size={12} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* Lightbox Modal */}
      <Modal visible={!!selected} animationType="fade" transparent statusBarTranslucent>
        <View style={styles.lightbox}>
          <TouchableOpacity style={styles.lightboxClose} onPress={() => setSelected(null)}>
            <Ionicons name="close" size={26} color="#fff" />
          </TouchableOpacity>
          {selected && (
            <>
              <Image source={{ uri: selected.uri }} style={styles.lightboxImage} resizeMode="contain" />
              <View style={styles.lightboxFooter}>
                <View style={styles.lightboxInfo}>
                  <Text style={styles.lightboxCaption}>{selected.caption}</Text>
                  <View style={styles.lightboxCatBadge}>
                    <Text style={styles.lightboxCatText}>{selected.category}</Text>
                  </View>
                </View>
                <View style={styles.lightboxActions}>
                  <TouchableOpacity style={styles.lightboxAction} onPress={() => toggleLike(selected.id)}>
                    <Ionicons
                      name={likedItems.has(selected.id) ? "heart" : "heart-outline"}
                      size={24}
                      color={likedItems.has(selected.id) ? "#EF4444" : "#fff"}
                    />
                    <Text style={styles.lightboxActionText}>
                      {selected.likes + (likedItems.has(selected.id) ? 1 : 0)}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.lightboxAction} onPress={() => handleShare(selected.caption, selected.uri)}>
                    <Ionicons name="share-outline" size={24} color="#fff" />
                    <Text style={styles.lightboxActionText}>Share</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.lightboxAction} onPress={() => handleShare(selected.caption, selected.uri)}>
                    <Ionicons name="download-outline" size={24} color="#fff" />
                    <Text style={styles.lightboxActionText}>Save</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </>
          )}
        </View>
      </Modal>

      {/* Upload Modal */}
      <Modal visible={showUpload} animationType="slide" presentationStyle="formSheet">
        <View style={styles.uploadModal}>
          <View style={styles.uploadHeader}>
            <Text style={styles.uploadTitle}>Share a Memory</Text>
            <TouchableOpacity onPress={() => setShowUpload(false)}>
              <Ionicons name="close" size={24} color="#111" />
            </TouchableOpacity>
          </View>
          <ScrollView style={styles.uploadBody} keyboardShouldPersistTaps="handled">
            <TouchableOpacity style={styles.photoPickerBtn} onPress={pickPhoto}>
              {pickedUri ? (
                <Image source={{ uri: pickedUri }} style={{ width: 96, height: 96, borderRadius: 12, marginBottom: 8 }} />
              ) : (
                <Ionicons name="image-outline" size={40} color="#3D5AF1" />
              )}
              <Text style={styles.photoPickerText}>{pickedUri ? "Change photo" : "Tap to choose a photo"}</Text>
              <Text style={styles.photoPickerSub}>JPG, PNG up to 10MB</Text>
            </TouchableOpacity>

            <Text style={styles.formLabel}>Caption</Text>
            <TextInput
              style={styles.captionInput}
              placeholder="What's the story behind this memory?"
              placeholderTextColor="#9CA3AF"
              value={uploadCaption}
              onChangeText={setUploadCaption}
              multiline
              numberOfLines={3}
            />

            <Text style={styles.formLabel}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 24 }}>
              {CATEGORIES.filter((c) => c !== "All").map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.catChip, uploadCategory === cat && styles.catChipActive]}
                  onPress={() => setUploadCategory(cat)}
                >
                  <Text style={[styles.catText, uploadCategory === cat && styles.catTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.uploadBtnText}>Share Memory</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>

      {!!toast && (
        <View style={styles.toast}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  toast: {
    position: "absolute", bottom: 30, left: 20, right: 20,
    backgroundColor: "#1A3C6E", borderRadius: 10, padding: 14, alignItems: "center",
  },
  toastText: { color: "#fff", fontSize: 14, fontFamily: "Inter_500Medium" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  addBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  section: { paddingTop: 16 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", paddingHorizontal: 20, marginBottom: 12 },
  featuredCard: { width: 260, height: 150, borderRadius: 14, overflow: "hidden" },
  featuredImage: { width: "100%", height: "100%" },
  featuredOverlay: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "rgba(0,0,0,0.45)", padding: 12,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  featuredCaption: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  featuredLikes: { flexDirection: "row", alignItems: "center", gap: 4 },
  featuredLikesText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  catScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  catChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: "#F3F4F6" },
  catChipActive: { backgroundColor: "#3D5AF1" },
  catText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  catTextActive: { color: "#fff" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2, paddingHorizontal: 2 },
  gridItem: { width: ITEM_SIZE, height: ITEM_SIZE, position: "relative" },
  gridImage: { width: "100%", height: "100%" },
  likedBadge: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: "#EF4444", width: 20, height: 20,
    borderRadius: 10, alignItems: "center", justifyContent: "center",
  },
  lightbox: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center", alignItems: "center",
  },
  lightboxClose: {
    position: "absolute", top: 56, right: 20, zIndex: 10,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center", justifyContent: "center",
  },
  lightboxImage: { width: width, height: width, maxHeight: "65%" },
  lightboxFooter: { position: "absolute", bottom: 0, left: 0, right: 0, padding: 24, backgroundColor: "rgba(0,0,0,0.6)" },
  lightboxInfo: { marginBottom: 16 },
  lightboxCaption: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 6 },
  lightboxCatBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3,
  },
  lightboxCatText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#fff" },
  lightboxActions: { flexDirection: "row", gap: 32 },
  lightboxAction: { alignItems: "center", gap: 4 },
  lightboxActionText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#fff" },
  uploadModal: { flex: 1, backgroundColor: "#fff" },
  uploadHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  uploadTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  uploadBody: { flex: 1, padding: 20 },
  photoPickerBtn: {
    backgroundColor: "#EEF2FF", borderRadius: 16, borderWidth: 2,
    borderColor: "#3D5AF1", borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    paddingVertical: 32, marginBottom: 20, gap: 8,
  },
  photoPickerText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  photoPickerSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  formLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 8 },
  captionInput: {
    borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827",
    textAlignVertical: "top", minHeight: 80, marginBottom: 16,
  },
  uploadBtn: {
    backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
  },
  uploadBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
});
