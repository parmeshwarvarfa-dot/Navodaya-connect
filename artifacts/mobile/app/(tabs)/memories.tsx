import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMemories,
  useCreateMemory,
  useDeleteMemory,
  useReportMemory,
  useToggleMemoryBookmark,
  useToggleMemoryLike,
  useUpdateMemory,
  useVoteInMemoryPoll,
} from "@workspace/api-client-react";
import type { CreateMemoryRequest, SocialMemory } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import MemoryCommentsSheet from "@/components/memories/MemoryCommentsSheet";
import MemoryComposer from "@/components/memories/MemoryComposer";
import MemoryPostCard from "@/components/memories/MemoryPostCard";

type ReportReason = "spam" | "harassment" | "inappropriate content";

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [composerVisible, setComposerVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialMemory | null>(null);
  const [commentsPost, setCommentsPost] = useState<SocialMemory | null>(null);
  const [menuPost, setMenuPost] = useState<SocialMemory | null>(null);
  const [deletePost, setDeletePost] = useState<SocialMemory | null>(null);
  const [reportPost, setReportPost] = useState<SocialMemory | null>(null);
  const [toast, setToast] = useState("");

  const feed = useInfiniteQuery({
    queryKey: ["/api/memories", search.trim()],
    queryFn: ({ pageParam, signal }) => listMemories({
      limit: 20,
      ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
      ...(search.trim() ? { search: search.trim() } : {}),
    }, { signal }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.hasMore ? page.nextCursor : undefined,
  });

  const memories = useMemo(() => feed.data?.pages.flatMap((page) => page.items) ?? [], [feed.data]);
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const toggleLike = useToggleMemoryLike();
  const toggleBookmark = useToggleMemoryBookmark();
  const voteInPoll = useVoteInMemoryPoll();
  const reportMemory = useReportMemory();

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 2600);
  };

  const refreshFeed = () => queryClient.invalidateQueries({ queryKey: ["/api/memories"] });

  const submitPost = async (data: CreateMemoryRequest) => {
    if (editingPost) {
      await updateMemory.mutateAsync({ id: editingPost.id, data });
      setEditingPost(null);
      showToast("Post updated.");
    } else {
      await createMemory.mutateAsync({ data });
      showToast("Your post is now in Memories.");
    }
    await refreshFeed();
  };

  const handleLike = async (memory: SocialMemory) => {
    try {
      await toggleLike.mutateAsync({ id: memory.id });
      await refreshFeed();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update your like.");
    }
  };

  const handleBookmark = async (memory: SocialMemory) => {
    try {
      await toggleBookmark.mutateAsync({ id: memory.id });
      await refreshFeed();
      showToast(memory.bookmarked ? "Bookmark removed." : "Post saved.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save this post.");
    }
  };

  const handleVote = async (memory: SocialMemory, optionIndex: number) => {
    try {
      await voteInPoll.mutateAsync({ id: memory.id, data: { optionIndex } });
      await refreshFeed();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not submit your vote.");
    }
  };

  const confirmDelete = async () => {
    if (!deletePost) return;
    try {
      await deleteMemory.mutateAsync({ id: deletePost.id });
      setDeletePost(null);
      await refreshFeed();
      showToast("Post deleted.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not delete the post.");
    }
  };

  const submitReport = async (reason: ReportReason) => {
    if (!reportPost) return;
    try {
      await reportMemory.mutateAsync({ id: reportPost.id, data: { reason } });
      setReportPost(null);
      showToast("Thanks. The post was reported for review.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not submit the report.");
    }
  };

  const startEdit = (memory: SocialMemory) => {
    setMenuPost(null);
    setEditingPost(memory);
    setComposerVisible(true);
  };

  const openComposer = () => {
    setEditingPost(null);
    setComposerVisible(true);
  };

  const headerTop = Math.max(insets.top, Platform.OS === "web" ? 12 : 6);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerTop + 8 }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Memories</Text>
            <Text style={styles.subtitle}>Stories and updates from the JNV community</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push("/(screens)/social-inbox" as any)}
            accessibilityLabel="Open social inbox"
          >
            <Ionicons name="mail-unread-outline" size={20} color="#355BE5" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={openComposer} accessibilityLabel="Create a post">
            <Ionicons name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#8994A8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search memories, people, or JNV"
            placeholderTextColor="#98A2B3"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            style={styles.searchInput}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color="#A7B0C0" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {feed.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator size="small" color="#355BE5" />
          <Text style={styles.stateText}>Loading community posts…</Text>
        </View>
      ) : feed.isError ? (
        <View style={styles.state}>
          <View style={styles.stateIcon}><Ionicons name="cloud-offline-outline" size={23} color="#68758D" /></View>
          <Text style={styles.stateTitle}>Memories could not load</Text>
          <Text style={styles.stateText}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => feed.refetch()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={memories}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MemoryPostCard
              memory={item}
              currentUserId={profile?.uid}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onComments={setCommentsPost}
              onMore={setMenuPost}
              onVote={handleVote}
              onOpenProfile={(userId) => router.push({ pathname: "/(screens)/user-profile", params: { userId } })}
              onMessage={showToast}
            />
          )}
          contentContainerStyle={[styles.list, memories.length === 0 && styles.emptyList]}
          refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={() => feed.refetch()} tintColor="#355BE5" />}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          onEndReachedThreshold={0.45}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={(
            <View style={styles.feedIntro}>
              <View style={styles.introMark}><Ionicons name="people-outline" size={17} color="#355BE5" /></View>
              <Text style={styles.introText}>A shared space for JNV stories, achievements, events, and conversations.</Text>
            </View>
          )}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Ionicons name="images-outline" size={28} color="#355BE5" /></View>
              <Text style={styles.emptyTitle}>{search.trim() ? "No matching posts" : "Start the conversation"}</Text>
              <Text style={styles.emptyText}>{search.trim() ? "Try a different name, JNV, or keyword." : "Share the first memory or update with your JNV community."}</Text>
              {!search.trim() && <TouchableOpacity style={styles.emptyButton} onPress={openComposer}><Text style={styles.emptyButtonText}>Create a post</Text></TouchableOpacity>}
            </View>
          )}
          ListFooterComponent={feed.isFetchingNextPage ? (
            <View style={styles.footerLoading}><ActivityIndicator color="#355BE5" /><Text style={styles.stateText}>Loading more posts…</Text></View>
          ) : feed.hasNextPage ? (
            <TouchableOpacity style={styles.loadMore} onPress={() => void feed.fetchNextPage()}><Text style={styles.loadMoreText}>Load more</Text></TouchableOpacity>
          ) : memories.length > 0 ? (
            <Text style={styles.endText}>You’re all caught up.</Text>
          ) : <View style={{ height: 20 }} />}
        />
      )}

      {!!toast && <View style={[styles.toast, { bottom: Math.max(insets.bottom, 18) + 78 }]} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View>}

      <MemoryComposer
        visible={composerVisible}
        onClose={() => {
          setComposerVisible(false);
          setEditingPost(null);
        }}
        onSubmit={submitPost}
        initial={editingPost}
        onMessage={showToast}
      />
      <MemoryCommentsSheet
        visible={!!commentsPost}
        memory={commentsPost}
        onClose={() => setCommentsPost(null)}
        onMessage={showToast}
      />

      <Modal visible={!!menuPost} animationType="fade" transparent onRequestClose={() => setMenuPost(null)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setMenuPost(null)}>
          <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 18) + 16 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Post options</Text>
            {menuPost?.authorId === profile?.uid ? (
              <>
                <TouchableOpacity style={styles.sheetOption} onPress={() => menuPost && startEdit(menuPost)}>
                  <Ionicons name="create-outline" size={19} color="#42516B" /><Text style={styles.sheetOptionText}>Edit post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.sheetOption} onPress={() => { setDeletePost(menuPost); setMenuPost(null); }}>
                  <Ionicons name="trash-outline" size={19} color="#C74353" /><Text style={[styles.sheetOptionText, styles.dangerText]}>Delete post</Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity style={styles.sheetOption} onPress={() => { setReportPost(menuPost); setMenuPost(null); }}>
                <Ionicons name="flag-outline" size={19} color="#42516B" /><Text style={styles.sheetOptionText}>Report post</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setMenuPost(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={!!deletePost} animationType="fade" transparent onRequestClose={() => setDeletePost(null)}>
        <View style={styles.scrim}>
          <View style={styles.confirmCard}>
            <View style={styles.confirmIcon}><Ionicons name="trash-outline" size={22} color="#C74353" /></View>
            <Text style={styles.confirmTitle}>Delete this post?</Text>
            <Text style={styles.confirmText}>This will permanently remove the post, its comments, likes, bookmarks, and poll votes.</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmSecondary} onPress={() => setDeletePost(null)}><Text style={styles.confirmSecondaryText}>Keep post</Text></TouchableOpacity>
              <TouchableOpacity style={styles.confirmDanger} onPress={confirmDelete} disabled={deleteMemory.isPending}>
                <Text style={styles.confirmDangerText}>{deleteMemory.isPending ? "Deleting…" : "Delete"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!reportPost} animationType="fade" transparent onRequestClose={() => setReportPost(null)}>
        <View style={styles.scrim}>
          <View style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Report this post</Text>
            <Text style={styles.confirmText}>Choose the reason that best describes your concern.</Text>
            {([
              ["inappropriate content", "Inappropriate content"],
              ["harassment", "Harassment or bullying"],
              ["spam", "Spam or misleading"],
            ] as [ReportReason, string][]).map(([reason, label]) => (
              <TouchableOpacity key={reason} style={styles.reportChoice} onPress={() => submitReport(reason)} disabled={reportMemory.isPending}>
                <Text style={styles.reportChoiceText}>{label}</Text>
                <Ionicons name="chevron-forward" size={16} color="#8894A8" />
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setReportPost(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F7FB" },
  header: { backgroundColor: "#fff", paddingHorizontal: 17, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: "#E8ECF3" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  titleBlock: { flex: 1 },
  title: { color: "#18243B", fontSize: 23, fontFamily: "Inter_700Bold" },
  subtitle: { color: "#8490A4", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  headerIcon: { width: 38, height: 38, borderRadius: 20, backgroundColor: "#F0F3FF", alignItems: "center", justifyContent: "center" },
  createButton: { width: 38, height: 38, borderRadius: 20, backgroundColor: "#355BE5", alignItems: "center", justifyContent: "center" },
  searchBox: { height: 42, marginTop: 13, paddingHorizontal: 12, borderRadius: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#F4F6FA", borderWidth: 1, borderColor: "#EBEEF4" },
  searchInput: { flex: 1, minWidth: 0, color: "#27334B", fontSize: 12, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  list: { paddingBottom: 135 },
  emptyList: { flexGrow: 1 },
  feedIntro: { flexDirection: "row", alignItems: "center", gap: 9, marginHorizontal: 14, marginTop: 13, padding: 12, borderRadius: 13, backgroundColor: "#EDF1FF" },
  introMark: { width: 30, height: 30, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  introText: { flex: 1, color: "#485777", fontSize: 11, lineHeight: 16, fontFamily: "Inter_500Medium" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  stateIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "#EDF0F5" },
  stateTitle: { color: "#253149", fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 5 },
  stateText: { color: "#8994A8", fontSize: 12, fontFamily: "Inter_400Regular" },
  retryButton: { paddingHorizontal: 17, paddingVertical: 10, borderRadius: 20, backgroundColor: "#355BE5", marginTop: 7 },
  retryText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  emptyState: { alignItems: "center", paddingHorizontal: 30, paddingTop: 45 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, backgroundColor: "#EDF1FF", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: "#253149", fontSize: 16, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { color: "#8792A5", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 7 },
  emptyButton: { marginTop: 18, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "#355BE5" },
  emptyButtonText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  footerLoading: { height: 60, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  loadMore: { alignSelf: "center", marginVertical: 16, paddingHorizontal: 18, paddingVertical: 10, borderWidth: 1, borderColor: "#D6DDF2", borderRadius: 20, backgroundColor: "#fff" },
  loadMoreText: { color: "#355BE5", fontSize: 12, fontFamily: "Inter_700Bold" },
  endText: { textAlign: "center", color: "#9AA4B5", fontSize: 11, fontFamily: "Inter_400Regular", paddingVertical: 20 },
  toast: { position: "absolute", left: 20, right: 20, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, backgroundColor: "#1B2943", zIndex: 30 },
  toastText: { color: "#fff", fontSize: 12, textAlign: "center", fontFamily: "Inter_500Medium" },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(16,25,43,0.42)" },
  actionSheet: { backgroundColor: "#fff", paddingHorizontal: 18, paddingTop: 10, borderTopLeftRadius: 22, borderTopRightRadius: 22 },
  sheetHandle: { width: 38, height: 4, backgroundColor: "#D7DCE5", borderRadius: 2, alignSelf: "center", marginBottom: 13 },
  sheetTitle: { color: "#1E2940", fontSize: 15, fontFamily: "Inter_700Bold", paddingVertical: 8 },
  sheetOption: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#F1F3F7" },
  sheetOptionText: { color: "#344158", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  dangerText: { color: "#C74353" },
  cancelButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 5, borderRadius: 11, backgroundColor: "#F1F3F8" },
  cancelText: { color: "#59677E", fontSize: 13, fontFamily: "Inter_700Bold" },
  confirmCard: { width: "88%", alignSelf: "center", padding: 20, borderRadius: 18, backgroundColor: "#fff", marginBottom: 40 },
  confirmIcon: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#FFF0F1", marginBottom: 12 },
  confirmTitle: { color: "#202B41", fontSize: 17, fontFamily: "Inter_700Bold" },
  confirmText: { color: "#77839A", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 7, marginBottom: 13 },
  confirmActions: { flexDirection: "row", gap: 9, marginTop: 10 },
  confirmSecondary: { flex: 1, minHeight: 43, borderRadius: 10, backgroundColor: "#F1F3F8", alignItems: "center", justifyContent: "center" },
  confirmSecondaryText: { color: "#59677E", fontSize: 12, fontFamily: "Inter_700Bold" },
  confirmDanger: { flex: 1, minHeight: 43, borderRadius: 10, backgroundColor: "#C74353", alignItems: "center", justifyContent: "center" },
  confirmDangerText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  reportChoice: { minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F3F7" },
  reportChoiceText: { color: "#344158", fontSize: 12, fontFamily: "Inter_600SemiBold" },
});
