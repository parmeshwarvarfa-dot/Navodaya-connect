import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Platform,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";

const { width } = Dimensions.get("window");
const COL = 3;
const ITEM_SIZE = (width - 4) / COL;

const CATEGORIES = ["All", "Sports", "Cultural", "Academic", "Farewell"];

const MEMORIES = [
  { id: "1", category: "Sports", uri: "https://picsum.photos/seed/sports1/300/300", caption: "Sports Day 2023" },
  { id: "2", category: "Cultural", uri: "https://picsum.photos/seed/culture1/300/300", caption: "Annual Day" },
  { id: "3", category: "Academic", uri: "https://picsum.photos/seed/study1/300/300", caption: "Science Fair" },
  { id: "4", category: "Sports", uri: "https://picsum.photos/seed/cricket1/300/300", caption: "Cricket Match" },
  { id: "5", category: "Farewell", uri: "https://picsum.photos/seed/farewell1/300/300", caption: "Farewell 2024" },
  { id: "6", category: "Cultural", uri: "https://picsum.photos/seed/dance1/300/300", caption: "Dance Night" },
  { id: "7", category: "Academic", uri: "https://picsum.photos/seed/lab1/300/300", caption: "Lab Work" },
  { id: "8", category: "Sports", uri: "https://picsum.photos/seed/football1/300/300", caption: "Football Final" },
  { id: "9", category: "Farewell", uri: "https://picsum.photos/seed/class2024/300/300", caption: "Last Day" },
  { id: "10", category: "Cultural", uri: "https://picsum.photos/seed/festival1/300/300", caption: "Navratri Fest" },
  { id: "11", category: "Academic", uri: "https://picsum.photos/seed/library1/300/300", caption: "Library Hour" },
  { id: "12", category: "Sports", uri: "https://picsum.photos/seed/kabaddi1/300/300", caption: "Kabaddi Finals" },
];

const topPicks = [
  { id: "a", uri: "https://picsum.photos/seed/jnvmemo1/600/300", caption: "Best Memories of 2024", likes: 142 },
  { id: "b", uri: "https://picsum.photos/seed/jnvmemo2/600/300", caption: "Sports Meet Champions", likes: 98 },
];

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [activeCategory, setActiveCategory] = useState("All");
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const filtered = activeCategory === "All"
    ? MEMORIES
    : MEMORIES.filter((m) => m.category === activeCategory);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>Memories</Text>
        <TouchableOpacity style={styles.addBtn}>
          <Ionicons name="add" size={22} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
            {topPicks.map((pick) => (
              <TouchableOpacity key={pick.id} style={styles.featuredCard} activeOpacity={0.9}>
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
            <TouchableOpacity key={item.id} style={styles.gridItem} activeOpacity={0.85}>
              <Image source={{ uri: item.uri }} style={styles.gridImage} />
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
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: "Inter_700Bold",
    color: "#111827",
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#EEF2FF",
    alignItems: "center",
    justifyContent: "center",
  },
  section: { paddingTop: 16 },
  sectionTitle: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
    color: "#111827",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  featuredCard: {
    width: 260,
    height: 150,
    borderRadius: 14,
    overflow: "hidden",
    marginLeft: 20,
  },
  featuredImage: { width: "100%", height: "100%" },
  featuredOverlay: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  featuredCaption: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold", flex: 1 },
  featuredLikes: { flexDirection: "row", alignItems: "center", gap: 4 },
  featuredLikesText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  catScroll: { paddingHorizontal: 20, gap: 8, paddingBottom: 12 },
  catChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },
  catChipActive: { backgroundColor: "#3D5AF1" },
  catText: { fontSize: 13, fontFamily: "Inter_500Medium", color: "#6B7280" },
  catTextActive: { color: "#fff" },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 2,
    paddingHorizontal: 2,
  },
  gridItem: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
  },
  gridImage: { width: "100%", height: "100%" },
});
