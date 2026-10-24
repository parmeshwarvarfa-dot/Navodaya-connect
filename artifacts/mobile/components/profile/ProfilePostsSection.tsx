import React, { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useDeleteMemory,
  useReportMemory,
  useToggleMemoryBookmark,
  useToggleMemoryLike,
  useUpdateMemory,
  useVoteInMemoryPoll,
} from "@workspace/api-client-react";
import type { SocialMemory, UpdateMemoryRequest } from "@workspace/api-client-react";
import { api, type ProfileConnection } from "@/lib/api";
import MemoryCommentsSheet from "@/components/memories/MemoryCommentsSheet";
import MemoryComposer from "@/components/memories/MemoryComposer";
import MemoryPostCard from "@/components/memories/MemoryPostCard";

type Props = { userId: string; isOwner: boolean; restricted?: boolean };
type RelationList = "followers" | "following";

export default function ProfilePostsSection({ userId, isOwner, restricted = false }: Props) {
  const queryClient = useQueryClient();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [relationList, setRelationList] = useState<RelationList | null>(null);
  const [selectedPost, setSelectedPost] = useState<SocialMemory | null>(null);
  const [postMenu, setPostMenu] = useState<SocialMemory | null>(null);
  const [editingPost, setEditingPost] = useState<SocialMemory | null>(null);
  const [commentsPost, setCommentsPost] = useState<SocialMemory | null>(null);
  const [toast, setToast] = useState("");
  const stats = useQuery({ queryKey: ["profile-stats", userId], queryFn: () => api.users.profileStats(userId), enabled: !!userId });
  const posts = useInfiniteQuery({
    queryKey: ["profile-posts-v2", userId],
    queryFn: async ({ pageParam }) => {
      const page = await api.memories.profileList(userId, 12, typeof pageParam === "string" ? pageParam : undefined);
      // Keep the profile grid author-specific even if an older API server ignores authorId.
      return { ...page, items: page.items.filter((post) => post.authorId === userId) };
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.hasMore ? page.nextCursor : undefined,
    enabled: !!userId && !restricted,
  });
  const relations = useQuery({
    queryKey: ["profile-relations", userId, relationList],
    queryFn: () => relationList === "followers" ? api.users.followers(userId) : api.users.following(userId),
    enabled: !!relationList,
  });
  const toggleLike = useToggleMemoryLike();
  const toggleBookmark = useToggleMemoryBookmark();
  const vote = useVoteInMemoryPoll();
  const deleteMemory = useDeleteMemory();
  const updateMemory = useUpdateMemory();
  const reportMemory = useReportMemory();
  const memories = useMemo(() => posts.data?.pages.flatMap((page) => page.items) ?? [], [posts.data]);
  const columns = width >= 900 ? 5 : width >= 600 ? 4 : 3;
  const tileSize = Math.floor((width - 32 - (columns - 1) * 2) / columns);

  const message = (value: string) => {
    setToast(value);
    setTimeout(() => setToast(""), 2600);
  };
  const refreshPosts = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["profile-posts-v2", userId] }),
      queryClient.invalidateQueries({ queryKey: ["profile-stats", userId] }),
      queryClient.invalidateQueries({ queryKey: ["/api/memories"] }),
    ]);
  };
  const openRelations = (list: RelationList) => setRelationList(list);

  const postAction = async (action: "like" | "bookmark" | "vote", post: SocialMemory, optionIndex?: number) => {
    try {
      let patch: Partial<SocialMemory> = {};
      if (action === "like") {
        const result = await toggleLike.mutateAsync({ id: post.id });
        patch = { liked: result.liked, likes: result.likes };
      } else if (action === "bookmark") {
        await toggleBookmark.mutateAsync({ id: post.id });
        patch = { bookmarked: !post.bookmarked };
      } else if (optionIndex !== undefined) {
        const result = await vote.mutateAsync({ id: post.id, data: { optionIndex } });
        patch = { pollVotes: result.pollVotes, viewerVote: result.viewerVote };
      }
      await refreshPosts();
      setSelectedPost((current) => current?.id === post.id ? { ...current, ...patch } : current);
    } catch (error) {
      message(error instanceof Error ? error.message : "Could not update this post.");
    }
  };

  const handleMore = (post: SocialMemory) => {
    setPostMenu(post);
  };

  const reportPost = async () => {
    if (!postMenu) return;
    try {
      await reportMemory.mutateAsync({ id: postMenu.id, data: { reason: "inappropriate content" } });
      setPostMenu(null);
      message("Post reported for review.");
    } catch (error) {
      message(error instanceof Error ? error.message : "Could not report this post.");
    }
  };

  const saveEdit = async (data: UpdateMemoryRequest) => {
    if (!editingPost) return;
    try {
      const updated = await updateMemory.mutateAsync({ id: editingPost.id, data });
      setEditingPost(null);
      setSelectedPost(updated);
      message("Post updated.");
      await refreshPosts();
    } catch (error) {
      message(error instanceof Error ? error.message : "Could not update this post.");
      throw error;
    }
  };

  const confirmDelete = () => {
    if (!postMenu) return;
    Alert.alert("Delete post?", "This permanently removes the post and its comments.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => {
        void deleteMemory.mutateAsync({ id: postMenu.id }).then(async () => {
          setPostMenu(null);
          setSelectedPost(null);
          message("Post deleted.");
          await refreshPosts();
        }).catch((error) => message(error instanceof Error ? error.message : "Could not delete this post."));
      } },
    ]);
  };

  return (
    <View style={styles.section}>
      <View style={styles.stats}>
        <View style={styles.stat}><Text style={styles.statValue}>{stats.isLoading || stats.isError || stats.data?.posts == null ? "—" : stats.data.posts}</Text><Text style={styles.statLabel}>Posts</Text></View>
        <TouchableOpacity style={styles.stat} onPress={() => openRelations("followers")} disabled={restricted || stats.data?.restricted} accessibilityRole="button">
          <Text style={styles.statValue}>{stats.isLoading || stats.isError || stats.data?.followers == null ? "—" : stats.data.followers}</Text><Text style={styles.statLabel}>Followers</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.stat} onPress={() => openRelations("following")} disabled={restricted || stats.data?.restricted} accessibilityRole="button">
          <Text style={styles.statValue}>{stats.isLoading || stats.isError || stats.data?.following == null ? "—" : stats.data.following}</Text><Text style={styles.statLabel}>Following</Text>
        </TouchableOpacity>
      </View>
      {stats.isError ? <TouchableOpacity style={styles.statsRetry} onPress={() => void stats.refetch()}><Text style={styles.retry}>Could not load counts. Retry</Text></TouchableOpacity> : null}

      <Text style={styles.title}>Posts</Text>
      {restricted ? (
        <View style={styles.empty}><Ionicons name="lock-closed-outline" size={24} color="#69758B"/><Text style={styles.emptyTitle}>Posts are private</Text><Text style={styles.emptyText}>Follow this profile to request access.</Text></View>
      ) : posts.isLoading ? (
        <View style={styles.state}><ActivityIndicator color="#3D5AF1"/><Text style={styles.stateText}>Loading posts…</Text></View>
      ) : posts.isError ? (
        <View style={styles.empty}><Text style={styles.emptyText}>Posts could not load.</Text><TouchableOpacity onPress={() => void posts.refetch()}><Text style={styles.retry}>Try again</Text></TouchableOpacity></View>
      ) : memories.length === 0 ? (
        <View style={styles.empty}><Ionicons name="images-outline" size={25} color="#69758B"/><Text style={styles.emptyTitle}>No posts yet</Text><Text style={styles.emptyText}>{isOwner ? "Your published Memories posts will appear here." : "This profile has not shared any posts."}</Text></View>
      ) : (
        <View style={styles.grid}>
          {memories.map((post) => {
            const media = post.mediaUrls ?? [];
            const preview = media[0];
            return (
              <TouchableOpacity key={post.id} style={[styles.tile, { width: tileSize, height: tileSize }]} onPress={() => setSelectedPost(post)} activeOpacity={0.8} accessibilityLabel={`Open post: ${post.caption || post.postType}`}>
                {preview && post.postType !== "video" ? <Image source={{ uri: preview }} style={StyleSheet.absoluteFill} resizeMode="cover"/> : (
                  <View style={[styles.textTile, post.postType === "video" && styles.videoTile]}>
                    <Ionicons name={post.postType === "video" ? "play-circle" : post.postType === "poll" ? "stats-chart-outline" : "chatbubble-ellipses-outline"} size={26} color={post.postType === "video" ? "#fff" : "#3D5AF1"}/>
                    {post.caption ? <Text numberOfLines={4} style={[styles.tileCaption, post.postType === "video" && { color: "#fff" }]}>{post.caption}</Text> : null}
                  </View>
                )}
                {media.length > 1 ? <View style={styles.tileIndicator}><Ionicons name="copy-outline" size={15} color="#fff"/></View> : null}
                {post.postType === "video" ? <View style={styles.tileIndicator}><Ionicons name="play" size={14} color="#fff"/></View> : null}
              </TouchableOpacity>
            );
          })}
        </View>
      )}
      {posts.hasNextPage ? <TouchableOpacity style={styles.loadMore} onPress={() => void posts.fetchNextPage()} disabled={posts.isFetchingNextPage}><Text style={styles.retry}>{posts.isFetchingNextPage ? "Loading…" : "Load more posts"}</Text></TouchableOpacity> : null}
      {posts.isFetchNextPageError ? <TouchableOpacity style={styles.loadMore} onPress={() => void posts.fetchNextPage()}><Text style={styles.retry}>Could not load more. Retry</Text></TouchableOpacity> : null}

      <Modal visible={!!selectedPost} animationType="slide" onRequestClose={() => setSelectedPost(null)}>
        <View style={styles.detailScreen}>
          <View style={[styles.detailHeader, { paddingTop: insets.top }]}><TouchableOpacity onPress={() => setSelectedPost(null)} style={styles.closeButton}><Ionicons name="arrow-back" size={22} color="#111827"/></TouchableOpacity><Text style={styles.detailTitle}>Post</Text><View style={{ width: 40 }}/></View>
          <ScrollView contentContainerStyle={[styles.detailBody, { paddingBottom: 28 + insets.bottom }]}>{selectedPost ? <MemoryPostCard memory={selectedPost} currentUserId={isOwner ? userId : undefined} onLike={(post) => void postAction("like", post)} onBookmark={(post) => void postAction("bookmark", post)} onComments={setCommentsPost} onMore={(post) => void handleMore(post)} onVote={(post, optionIndex) => void postAction("vote", post, optionIndex)} onOpenProfile={() => undefined} onMessage={message}/> : null}</ScrollView>
        </View>
      </Modal>

      <MemoryCommentsSheet visible={!!commentsPost} memory={commentsPost} onClose={() => { setCommentsPost(null); void refreshPosts(); }} onMessage={message}/>

      <Modal visible={!!postMenu} transparent animationType="fade" onRequestClose={() => setPostMenu(null)}>
        <View style={styles.menuBackdrop}><View style={styles.menuCard}>
          <Text style={styles.menuTitle}>Post options</Text>
          {postMenu?.authorId === userId && isOwner ? <>
            <TouchableOpacity style={styles.menuOption} onPress={() => { setEditingPost(postMenu); setPostMenu(null); }}><Ionicons name="create-outline" size={19} color="#3D5AF1"/><Text style={styles.menuOptionText}>Edit post</Text></TouchableOpacity>
            <TouchableOpacity style={styles.menuOption} onPress={confirmDelete}><Ionicons name="trash-outline" size={19} color="#B42318"/><Text style={[styles.menuOptionText, { color: "#B42318" }]}>Delete post</Text></TouchableOpacity>
          </> : <TouchableOpacity style={styles.menuOption} onPress={() => void reportPost()}><Ionicons name="flag-outline" size={19} color="#B42318"/><Text style={[styles.menuOptionText, { color: "#B42318" }]}>Report post</Text></TouchableOpacity>}
          <TouchableOpacity style={styles.menuCancel} onPress={() => setPostMenu(null)}><Text style={styles.menuCancelText}>Cancel</Text></TouchableOpacity>
        </View></View>
      </Modal>
      <MemoryComposer visible={!!editingPost} initial={editingPost} onClose={() => setEditingPost(null)} onSubmit={saveEdit} onMessage={message}/>

      <Modal visible={!!relationList} animationType="slide" onRequestClose={() => setRelationList(null)}>
        <View style={styles.relationScreen}>
          <View style={[styles.detailHeader, { paddingTop: insets.top }]}><TouchableOpacity onPress={() => setRelationList(null)} style={styles.closeButton}><Ionicons name="arrow-back" size={22} color="#111827"/></TouchableOpacity><Text style={styles.detailTitle}>{relationList === "followers" ? "Followers" : "Following"}</Text><View style={{ width: 40 }}/></View>
          {relations.isLoading ? <View style={styles.state}><ActivityIndicator color="#3D5AF1"/></View> : relations.isError ? <View style={styles.state}><Text style={styles.stateText}>Could not load people.</Text><TouchableOpacity onPress={() => void relations.refetch()}><Text style={styles.retry}>Try again</Text></TouchableOpacity></View> : (
            <ScrollView contentContainerStyle={styles.peopleList}>
              {(relations.data ?? []).length === 0 ? <Text style={styles.emptyText}>No {relationList} yet.</Text> : relations.data?.map((person: ProfileConnection) => (
                <TouchableOpacity key={person.id} style={styles.personRow} onPress={() => { setRelationList(null); router.push({ pathname: "/(screens)/user-profile", params: { userId: person.id } } as any); }}>
                  {person.photoURL ? <Image source={{ uri: person.photoURL }} style={styles.personAvatar}/> : <View style={styles.personAvatarFallback}><Text style={styles.personInitial}>{person.fullName.charAt(0).toUpperCase()}</Text></View>}
                  <View style={{ flex: 1 }}><Text style={styles.personName}>{person.fullName}</Text><Text style={styles.personMeta}>{person.isRestricted ? "Private profile" : `${person.role} · ${person.jnvName}`}</Text></View>
                  <Ionicons name="chevron-forward" size={18} color="#98A2B3"/>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      {toast ? <View style={styles.toast} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 14 },
  stats: { flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#F0F0F0", paddingVertical: 13, marginBottom: 18 },
  stat: { flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48, borderRightWidth: 1, borderRightColor: "#EEF0F4" },
  statValue: { color: "#111827", fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { marginTop: 2, color: "#69758B", fontSize: 12, fontFamily: "Inter_500Medium" },
  statsRetry: { alignItems: "center", marginTop: -14, marginBottom: 10 },
  title: { color: "#111827", fontSize: 18, fontFamily: "Inter_700Bold", marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 2 },
  tile: { backgroundColor: "#E8EBF2", overflow: "hidden", position: "relative" },
  textTile: { flex: 1, alignItems: "center", justifyContent: "center", padding: 9, backgroundColor: "#EEF2FF" },
  videoTile: { backgroundColor: "#27324B" },
  tileCaption: { marginTop: 7, textAlign: "center", color: "#27324B", fontSize: 11, lineHeight: 15, fontFamily: "Inter_500Medium" },
  tileIndicator: { position: "absolute", right: 7, top: 7, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(17,24,39,0.55)" },
  empty: { alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: "#F0F0F0" },
  emptyTitle: { marginTop: 8, color: "#344054", fontSize: 15, fontFamily: "Inter_600SemiBold" },
  emptyText: { marginTop: 5, color: "#69758B", textAlign: "center", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular" },
  state: { minHeight: 94, alignItems: "center", justifyContent: "center", gap: 8 },
  stateText: { color: "#69758B", fontSize: 13, fontFamily: "Inter_400Regular" },
  retry: { color: "#3D5AF1", fontSize: 13, fontFamily: "Inter_600SemiBold", padding: 8 },
  loadMore: { alignItems: "center", paddingVertical: 10 },
  detailScreen: { flex: 1, backgroundColor: "#F5F6FA" },
  relationScreen: { flex: 1, backgroundColor: "#fff" },
  detailHeader: { minHeight: 56, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 14, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EAECF0" },
  closeButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  detailTitle: { flex: 1, marginLeft: 10, color: "#111827", fontSize: 17, fontFamily: "Inter_700Bold" },
  detailBody: { padding: 12, paddingBottom: 28 },
  peopleList: { paddingHorizontal: 16, paddingVertical: 8 },
  personRow: { minHeight: 68, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#F0F1F4" },
  personAvatar: { width: 44, height: 44, borderRadius: 22 },
  personAvatarFallback: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  personInitial: { color: "#3D5AF1", fontSize: 17, fontFamily: "Inter_700Bold" },
  personName: { color: "#111827", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  personMeta: { marginTop: 3, color: "#69758B", fontSize: 12, fontFamily: "Inter_400Regular", textTransform: "capitalize" },
  toast: { position: "absolute", bottom: 18, left: 20, right: 20, padding: 12, borderRadius: 12, backgroundColor: "#1F2937" },
  toastText: { color: "#fff", fontSize: 13, textAlign: "center", fontFamily: "Inter_500Medium" },
  menuBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(17,24,39,0.4)" },
  menuCard: { padding: 18, paddingBottom: 30, backgroundColor: "#fff", borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  menuTitle: { marginBottom: 8, color: "#111827", fontSize: 16, fontFamily: "Inter_700Bold" },
  menuOption: { minHeight: 50, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: "#F0F1F4" },
  menuOptionText: { color: "#111827", fontSize: 14, fontFamily: "Inter_500Medium" },
  menuCancel: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 10, borderRadius: 10, backgroundColor: "#F3F4F6" },
  menuCancelText: { color: "#344054", fontSize: 14, fontFamily: "Inter_600SemiBold" },
});
