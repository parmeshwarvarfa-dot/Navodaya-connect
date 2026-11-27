import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  useReportMemory,
  useToggleMemoryBookmark,
  useToggleMemoryLike,
  useVoteInMemoryPoll,
} from "@workspace/api-client-react";
import type { SocialMemory } from "@workspace/api-client-react";
import { api, type MemoryBookmarkCollection } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import MemoryCommentsSheet from "@/components/memories/MemoryCommentsSheet";
import MemoryPostCard from "@/components/memories/MemoryPostCard";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

export default function MemoriesSavedScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [selectedCollection, setSelectedCollection] = useState<MemoryBookmarkCollection | null>(null);
  const [collectionModal, setCollectionModal] = useState(false);
  const [editingCollection, setEditingCollection] = useState<MemoryBookmarkCollection | null>(null);
  const [collectionName, setCollectionName] = useState("");
  const [organizePost, setOrganizePost] = useState<SocialMemory | null>(null);
  const [commentsPost, setCommentsPost] = useState<SocialMemory | null>(null);
  const [toast, setToast] = useState("");
  const collections = useQuery({
    queryKey: ["memory-bookmark-collections"],
    queryFn: () => api.memories.collections.list(),
  });
  const feed = useInfiniteQuery({
    queryKey: ["saved-memories", selectedCollection?.id ?? "all"],
    queryFn: ({ pageParam, signal }) => api.memories.saved(
      20,
      typeof pageParam === "string" ? pageParam : undefined,
      selectedCollection?.id,
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.hasMore ? page.nextCursor : undefined,
  });
  const memories = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const toggleLike = useToggleMemoryLike();
  const toggleBookmark = useToggleMemoryBookmark();
  const voteInPoll = useVoteInMemoryPoll();
  const reportMemory = useReportMemory();

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["saved-memories"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/memories"] }),
      queryClient.invalidateQueries({ queryKey: ["memory-bookmark-collections"] }),
    ]);
  };

  const showMessage = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2400);
  };

  const saveCollection = async () => {
    const name = collectionName.trim();
    if (!name) return;
    try {
      if (editingCollection) {
        await api.memories.collections.rename(editingCollection.id, name);
        if (selectedCollection?.id === editingCollection.id) setSelectedCollection({ ...selectedCollection, name });
      } else {
        await api.memories.collections.create(name);
      }
      setCollectionModal(false);
      setEditingCollection(null);
      setCollectionName("");
      await invalidate();
    } catch (error) {
      Alert.alert("Could not save collection", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const moveToCollection = async (collection: MemoryBookmarkCollection) => {
    if (!organizePost) return;
    try {
      await api.memories.collections.move(collection.id, organizePost.id);
      setOrganizePost(null);
      await invalidate();
      showMessage(`Moved to ${collection.name}.`);
    } catch (error) {
      Alert.alert("Could not organize post", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const removeFromCollection = async () => {
    if (!organizePost || !selectedCollection) return;
    try {
      await api.memories.collections.remove(selectedCollection.id, organizePost.id);
      setOrganizePost(null);
      await invalidate();
      showMessage("Removed from this collection. The post remains saved.");
    } catch (error) {
      Alert.alert("Could not remove post", error instanceof Error ? error.message : "Please try again.");
    }
  };

  const handleLike = async (memory: SocialMemory) => {
    try {
      await toggleLike.mutateAsync({ id: memory.id });
      await invalidate();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not update your like.");
    }
  };

  const handleBookmark = async (memory: SocialMemory) => {
    try {
      await toggleBookmark.mutateAsync({ id: memory.id });
      await invalidate();
      showMessage(memory.bookmarked ? "Removed from Saved." : "Saved.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not update Saved.");
    }
  };

  const handleVote = async (memory: SocialMemory, optionIndex: number) => {
    try {
      await voteInPoll.mutateAsync({ id: memory.id, data: { optionIndex } });
      await invalidate();
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not submit your vote.");
    }
  };

  const handleReport = async (memory: SocialMemory) => {
    try {
      await reportMemory.mutateAsync({ id: memory.id, data: { reason: "inappropriate content" } });
      showMessage("Thanks. The post was reported for review.");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "Could not submit the report.");
    }
  };

  const openNewCollection = () => {
    setEditingCollection(null);
    setCollectionName("");
    setCollectionModal(true);
  };

  const openRename = (collection: MemoryBookmarkCollection) => {
    setEditingCollection(collection);
    setCollectionName(collection.name);
    setCollectionModal(true);
  };

  return (
    <View style={[styles.page, {
      paddingTop: Math.max(insets.top, 8),
      paddingBottom: Math.max(12, insets.bottom) + 76,
    }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color="#34205F" />
        </TouchableOpacity>
        <View style={styles.headerTitle}>
          <Text style={styles.title}>Saved</Text>
          <Text style={styles.subtitle}>Your saved posts and Reels</Text>
        </View>
        <TouchableOpacity style={styles.addButton} onPress={openNewCollection} accessibilityLabel="Create collection">
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.collectionRow}>
        <TouchableOpacity
          style={[styles.collectionChip, !selectedCollection && styles.collectionChipActive]}
          onPress={() => setSelectedCollection(null)}
        >
          <Ionicons name="bookmark-outline" size={14} color={!selectedCollection ? "#fff" : "#6D28D9"} />
          <Text style={[styles.collectionText, !selectedCollection && styles.collectionTextActive]}>All Saved</Text>
        </TouchableOpacity>
        {(collections.data ?? []).map((collection) => (
          <TouchableOpacity
            key={collection.id}
            style={[styles.collectionChip, selectedCollection?.id === collection.id && styles.collectionChipActive]}
            onPress={() => setSelectedCollection(collection)}
            onLongPress={() => openRename(collection)}
            accessibilityHint="Long press to rename this collection"
          >
            <Text style={[styles.collectionText, selectedCollection?.id === collection.id && styles.collectionTextActive]} numberOfLines={1}>
              {collection.name}
            </Text>
            <Text style={[styles.collectionCount, selectedCollection?.id === collection.id && styles.collectionTextActive]}>{collection.itemCount}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity style={styles.addCollectionChip} onPress={openNewCollection}>
          <Ionicons name="add" size={15} color="#6D28D9" />
          <Text style={styles.addCollectionText}>New</Text>
        </TouchableOpacity>
      </ScrollView>

      {feed.isLoading ? (
        <View style={styles.center}><ActivityIndicator color="#7C3AED" /><Text style={styles.muted}>Loading your saved posts…</Text></View>
      ) : feed.isError ? (
        <TouchableOpacity style={styles.center} onPress={() => void feed.refetch()}>
          <Ionicons name="cloud-offline-outline" size={28} color="#7C3AED" />
          <Text style={styles.emptyTitle}>Saved posts could not load</Text>
          <Text style={styles.muted}>Tap to retry.</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemoryPostCard
              memory={item}
              currentUserId={profile?.uid}
              actionPending={toggleLike.isPending || toggleBookmark.isPending || voteInPoll.isPending}
              onLike={(memory) => void handleLike(memory)}
              onBookmark={(memory) => void handleBookmark(memory)}
              onComments={setCommentsPost}
              onMore={setOrganizePost}
              onVote={(memory, optionIndex) => void handleVote(memory, optionIndex)}
              onOpenProfile={(userId) => router.push({ pathname: "/(screens)/user-profile", params: { userId } })}
              onMessage={showMessage}
            />
          )}
          contentContainerStyle={[styles.feed, memories.length === 0 && styles.emptyFeed]}
          refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => void feed.refetch()} tintColor="#7C3AED" />}
          onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage(); }}
          onEndReachedThreshold={0.45}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="bookmark-outline" size={28} color="#7C3AED" /></View>
              <Text style={styles.emptyTitle}>{selectedCollection ? `Nothing in ${selectedCollection.name} yet` : "Nothing saved yet"}</Text>
              <Text style={styles.muted}>Save a post or Reel and it will appear here.</Text>
              <TouchableOpacity style={styles.browseButton} onPress={() => router.replace("/(tabs)/memories" as any)}>
                <Text style={styles.browseButtonText}>Browse Memories</Text>
              </TouchableOpacity>
            </View>
          }
          ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator color="#7C3AED" style={{ padding: 18 }} /> : null}
        />
      )}

      {!!toast && <View style={[styles.toast, { bottom: Math.max(12, insets.bottom) + 88 }]}><Text style={styles.toastText}>{toast}</Text></View>}

      <MemoryCommentsSheet visible={!!commentsPost} memory={commentsPost} onClose={() => setCommentsPost(null)} onMessage={showMessage} />

      <Modal visible={Boolean(organizePost)} transparent animationType="fade" onRequestClose={() => setOrganizePost(null)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setOrganizePost(null)}>
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 18) + 14 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>Organize saved post</Text>
            {selectedCollection ? (
              <TouchableOpacity style={styles.option} onPress={() => void removeFromCollection()}>
                <Ionicons name="remove-circle-outline" size={20} color="#6D28D9" /><Text style={styles.optionText}>Remove from {selectedCollection.name}</Text>
              </TouchableOpacity>
            ) : null}
            {(collections.data ?? []).map((collection) => (
              <TouchableOpacity key={collection.id} style={styles.option} onPress={() => void moveToCollection(collection)}>
                <Ionicons name="folder-outline" size={20} color="#6D28D9" /><Text style={styles.optionText}>Move to {collection.name}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.option} onPress={() => { const post = organizePost; setOrganizePost(null); if (post) void handleReport(post); }}>
              <Ionicons name="flag-outline" size={19} color="#596579" /><Text style={styles.optionText}>Report post</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancel} onPress={() => setOrganizePost(null)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={collectionModal} transparent animationType="fade" onRequestClose={() => setCollectionModal(false)}>
        <View style={styles.scrim}>
          <View style={styles.renameModal}>
            <Text style={styles.sheetTitle}>{editingCollection ? "Rename collection" : "Create collection"}</Text>
            <TextInput
              value={collectionName}
              onChangeText={setCollectionName}
              placeholder="Collection name"
              placeholderTextColor="#9A90AA"
              maxLength={40}
              autoFocus
              style={styles.nameInput}
              returnKeyType="done"
              onSubmitEditing={() => void saveCollection()}
            />
            {!editingCollection ? (
              <View style={styles.suggestions}>
                {["Favorite Memories", "JNV Friends", "School Events", "Favorite Reels", "Career Inspiration"].map((name) => (
                  <TouchableOpacity key={name} style={styles.suggestion} onPress={() => setCollectionName(name)}>
                    <Text style={styles.suggestionText}>{name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancel} onPress={() => setCollectionModal(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={styles.saveButton} onPress={() => void saveCollection()}><Text style={styles.saveButtonText}>{editingCollection ? "Save name" : "Create"}</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#FAF8FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 16, paddingBottom: 13 },
  backButton: { width: 39, height: 39, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#F1ECF9" },
  headerTitle: { flex: 1 },
  title: { color: "#211B45", fontSize: 22, fontWeight: "800" },
  subtitle: { color: "#64748B", fontSize: 11, marginTop: 2 },
  addButton: { width: 39, height: 39, borderRadius: 20, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  collectionRow: { paddingHorizontal: 15, paddingVertical: 8, gap: 7 },
  collectionChip: { height: 35, maxWidth: 170, paddingHorizontal: 12, borderRadius: 18, backgroundColor: "#F1ECF9", flexDirection: "row", alignItems: "center", gap: 6 },
  collectionChipActive: { backgroundColor: "#7C3AED" },
  collectionText: { color: "#6D28D9", fontSize: 11, fontWeight: "700" },
  collectionTextActive: { color: "#fff" },
  collectionCount: { color: "#8A7AA6", fontSize: 10, fontWeight: "700" },
  addCollectionChip: { height: 35, paddingHorizontal: 11, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E8E0F2", flexDirection: "row", alignItems: "center", gap: 3 },
  addCollectionText: { color: "#6D28D9", fontSize: 11, fontWeight: "700" },
  feed: { paddingBottom: 20, paddingTop: 2 },
  emptyFeed: { flexGrow: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 25, gap: 10 },
  muted: { color: "#756B84", fontSize: 12, lineHeight: 18, textAlign: "center" },
  emptyState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 25, gap: 9 },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#EFE8F8", alignItems: "center", justifyContent: "center", marginBottom: 5 },
  emptyTitle: { color: "#302044", fontSize: 16, fontWeight: "800", textAlign: "center" },
  browseButton: { marginTop: 7, backgroundColor: "#7C3AED", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  browseButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  toast: { position: "absolute", left: 24, right: 24, backgroundColor: "#302044", borderRadius: 14, padding: 13, alignItems: "center" },
  toastText: { color: "#fff", fontSize: 12, fontWeight: "600" },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25,18,40,0.36)" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 18, paddingTop: 10 },
  handle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: "#DED7E8", marginBottom: 13 },
  sheetTitle: { color: "#2A1D3E", fontSize: 16, fontWeight: "800", marginBottom: 9 },
  option: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 12 },
  optionText: { color: "#51445F", fontSize: 13, fontWeight: "600" },
  cancel: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 4 },
  cancelText: { color: "#7C3AED", fontSize: 13, fontWeight: "700" },
  renameModal: { backgroundColor: "#fff", borderRadius: 20, padding: 19, margin: 20, gap: 11 },
  nameInput: { minHeight: 45, borderRadius: 13, backgroundColor: "#F8F5FB", paddingHorizontal: 12, color: "#2A1D3E", fontSize: 13 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  suggestion: { backgroundColor: "#F1ECF9", borderRadius: 14, paddingHorizontal: 9, paddingVertical: 7 },
  suggestionText: { color: "#6D28D9", fontSize: 10, fontWeight: "700" },
  modalButtons: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10 },
  saveButton: { backgroundColor: "#7C3AED", paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12 },
  saveButtonText: { color: "#fff", fontSize: 12, fontWeight: "800" },
});
