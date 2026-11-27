import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { api, type ChatContact } from "@/lib/api";
import { isPostEditable, formatEditTimeRemaining } from "@/lib/post-editing";
import MemoryCommentsSheet from "@/components/memories/MemoryCommentsSheet";
import MemoryComposer from "@/components/memories/MemoryComposer";
import MemoryPostCard from "@/components/memories/MemoryPostCard";
import MemoriesReels from "@/components/memories/MemoriesReels";
import FadeIn from "@/components/motion/FadeIn";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type ReportReason = "spam" | "harassment" | "inappropriate content";
type MemoryPostType = "text" | "photo" | "video" | "poll" | "achievement" | "event";
type PostFilter = "all" | "text" | "photo" | "video" | "poll" | "navodayan_talk" | "achievement" | "event";
const POST_FILTERS: { value: PostFilter; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: "all", label: "All", icon: "apps-outline" },
  { value: "text", label: "Posts", icon: "chatbubble-outline" },
  { value: "photo", label: "Photos", icon: "image-outline" },
  { value: "video", label: "Videos", icon: "videocam-outline" },
  { value: "poll", label: "Polls", icon: "stats-chart-outline" },
  { value: "navodayan_talk", label: "Navodayan Talks", icon: "mic-outline" },
  { value: "achievement", label: "Achievements", icon: "trophy-outline" },
  { value: "event", label: "Events", icon: "calendar-outline" },
];

export default function MemoriesScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ mode?: string; filter?: string }>();
  const savedOnly = typeof params.mode === "string" && params.mode === "saved";
  const [activeTab, setActiveTab] = useState<"posts" | "reels">("posts");
  const [reelScope, setReelScope] = useState<"recommended" | "following" | "latest">("recommended");
  const [headerMenuVisible, setHeaderMenuVisible] = useState(false);
  const [createMenuVisible, setCreateMenuVisible] = useState(false);
  const [filtersVisible, setFiltersVisible] = useState(false);
  const [initialPostType, setInitialPostType] = useState<MemoryPostType>("text");
  const [searchFocused, setSearchFocused] = useState(false);
  const initialFilter: PostFilter =
    typeof params.filter === "string" &&
    ["all", "text", "photo", "video", "poll", "navodayan_talk", "achievement", "event"].includes(params.filter)
      ? params.filter as PostFilter
      : "all";
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [postFilter, setPostFilter] = useState<PostFilter>(initialFilter);
  const [composerVisible, setComposerVisible] = useState(false);
  const [editingPost, setEditingPost] = useState<SocialMemory | null>(null);
  const [commentsPost, setCommentsPost] = useState<SocialMemory | null>(null);
  const [menuPost, setMenuPost] = useState<SocialMemory | null>(null);
  const [deletePost, setDeletePost] = useState<SocialMemory | null>(null);
  const [reportPost, setReportPost] = useState<SocialMemory | null>(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (savedOnly) router.replace("/(tabs)/memories-saved" as any);
  }, [savedOnly]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search.trim()), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const feed = useInfiniteQuery({
    queryKey: ["/api/memories", debouncedSearch, activeTab === "reels" ? "video" : postFilter, activeTab === "reels" ? reelScope : "all"],
    queryFn: ({ pageParam, signal }) => {
      const params = {
        limit: 20,
        ...(typeof pageParam === "string" ? { cursor: pageParam } : {}),
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(activeTab === "reels" ? { type: "video" } : postFilter !== "all" ? { type: postFilter } : {}),
        ...(activeTab === "reels" && reelScope === "following" ? { following: true } : {}),
      };
      return activeTab === "reels" && reelScope === "following"
        ? api.memories.feed(params)
        : listMemories(params, { signal });
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.hasMore ? page.nextCursor : undefined,
  });

  const peopleSearch = useQuery({
    queryKey: ["memory-people-search", debouncedSearch],
    queryFn: () => api.users.search(debouncedSearch),
    enabled: debouncedSearch.length >= 2,
    staleTime: 30_000,
  });
  const unreadNotifications = useQuery({
    queryKey: ["social-notifications", "unread-count"],
    queryFn: () => api.notifications.unreadCount(),
    staleTime: 30_000,
  });
  const memoryPreferences = useQuery({
    queryKey: ["memories-preferences"],
    queryFn: async () => {
      const value = await AsyncStorage.getItem("memories_preferences_v1");
      if (!value) return { autoplayVideos: true, dataSaver: false };
      const parsed = JSON.parse(value) as { autoplayVideos?: boolean; dataSaver?: boolean };
      return {
        autoplayVideos: parsed.autoplayVideos ?? true,
        dataSaver: parsed.dataSaver ?? false,
      };
    },
  });

  const memories = useMemo(() => {
    const items = feed.data?.pages.flatMap((page) => page.items) ?? [];
    if (savedOnly) return items.filter((item) => item.bookmarked);
    if (activeTab === "reels" && reelScope === "recommended") {
      return [...items].sort((first, second) => second.likes - first.likes ||
        new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime());
    }
    return items;
  }, [activeTab, feed.data, reelScope, savedOnly]);
  const createMemory = useCreateMemory();
  const updateMemory = useUpdateMemory();
  const deleteMemory = useDeleteMemory();
  const toggleLike = useToggleMemoryLike();
  const toggleBookmark = useToggleMemoryBookmark();
  const voteInPoll = useVoteInMemoryPoll();
  const reportMemory = useReportMemory();

  const showToast = (message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 2600);
  };

  const refreshFeed = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/memories"] }),
      ...(profile?.uid ? [
        queryClient.invalidateQueries({ queryKey: ["profile-posts-v2", profile.uid] }),
        queryClient.invalidateQueries({ queryKey: ["profile-stats", profile.uid] }),
      ] : []),
    ]);
  };

  const submitPost = async (data: CreateMemoryRequest) => {
    if (editingPost) {
      if (!isPostEditable(editingPost.createdAt)) {
        showToast("Posts can only be edited within 24 hours of publishing.");
        setEditingPost(null);
        return;
      }
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
    if (toggleLike.isPending) return;
    try {
      await toggleLike.mutateAsync({ id: memory.id });
      await refreshFeed();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update your like.");
    }
  };

  const handleBookmark = async (memory: SocialMemory) => {
    if (toggleBookmark.isPending) return;
    try {
      await toggleBookmark.mutateAsync({ id: memory.id });
      await refreshFeed();
      showToast(memory.bookmarked ? "Bookmark removed." : "Post saved.");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not save this post.");
    }
  };

  const handleVote = async (memory: SocialMemory, optionIndex: number) => {
    if (voteInPoll.isPending) return;
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
    if (!isPostEditable(memory.createdAt)) {
      showToast("Posts can only be edited within 24 hours of publishing.");
      setMenuPost(null);
      return;
    }
    setMenuPost(null);
    setEditingPost(memory);
    setComposerVisible(true);
  };

  const openComposer = () => {
    setEditingPost(null);
    setInitialPostType("text");
    setComposerVisible(true);
  };

  const openCreateOption = (option: "post" | "poll" | "talk") => {
    setCreateMenuVisible(false);
    if (option === "talk") {
      router.push({ pathname: "/(screens)/navodayan-talks", params: { create: "true" } });
      return;
    }
    setInitialPostType(option === "poll" ? "poll" : "text");
    setComposerVisible(true);
  };

  const headerTop = Math.max(insets.top, Platform.OS === "web" ? 12 : 6);

  const renderPeopleResults = (people: ChatContact[]) => (
    <View style={styles.peopleSection}>
      <View style={styles.peopleHeading}>
        <View style={styles.peopleHeadingIcon}><Ionicons name="people-outline" size={15} color="#7C3AED" /></View>
        <Text style={styles.peopleTitle}>Accounts</Text>
        {!!people.length && <Text style={styles.peopleCount}>{people.length}</Text>}
      </View>
      {peopleSearch.isFetching && !peopleSearch.data ? (
        <View style={styles.peopleState}><ActivityIndicator size="small" color="#7C3AED" /><Text style={styles.peopleStateText}>Searching accounts…</Text></View>
      ) : peopleSearch.isError ? (
        <TouchableOpacity style={styles.peopleState} onPress={() => void peopleSearch.refetch()} accessibilityRole="button">
          <Ionicons name="cloud-offline-outline" size={17} color="#66758E" /><Text style={styles.peopleStateText}>Account search failed. Tap to retry.</Text>
        </TouchableOpacity>
      ) : people.length === 0 ? (
        <Text style={styles.peopleEmpty}>No discoverable accounts match this search.</Text>
      ) : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleResults}>
        {people.map((person) => (
          <TouchableOpacity
            key={person.id}
            style={styles.peopleCard}
            onPress={() => {
              Keyboard.dismiss();
              router.push({ pathname: "/(screens)/user-profile", params: { userId: person.id } });
            }}
            accessibilityRole="button"
            accessibilityLabel={`Open ${person.fullName}'s profile`}
          >
            {person.photoURL
              ? <Image source={{ uri: person.photoURL }} style={styles.peopleAvatar} />
              : <View style={[styles.peopleAvatar, styles.peopleAvatarFallback]}><Text style={styles.peopleInitial}>{person.fullName.slice(0, 1).toUpperCase()}</Text></View>}
            <View style={styles.peopleInfo}>
              <Text style={styles.peopleName} numberOfLines={1}>{person.fullName}</Text>
              <Text style={styles.peopleMeta} numberOfLines={1}>{person.role.charAt(0).toUpperCase() + person.role.slice(1)}</Text>
              <Text style={styles.peopleJnv} numberOfLines={1}>{person.jnvName || "Navodaya Connect member"}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color="#98A2B3" />
          </TouchableOpacity>
        ))}
      </ScrollView>}
    </View>
  );

  const renderListHeader = () => (
    <View>
      <View style={[styles.header, { paddingTop: headerTop + 8 }]}>
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>Memories</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Stories and updates from your JNV community</Text>
          </View>
          <TouchableOpacity
            style={styles.headerIcon}
            onPress={() => router.push("/(screens)/social-inbox" as any)}
            accessibilityLabel="Open social inbox"
          >
            <Ionicons name="mail-unread-outline" size={20} color="#7C3AED" />
            {(unreadNotifications.data?.unreadCount ?? 0) > 0 && <View style={styles.unreadDot} />}
          </TouchableOpacity>
          <TouchableOpacity style={styles.createButton} onPress={() => setCreateMenuVisible(true)} accessibilityLabel="Create a post">
            <LinearGradient colors={["#9B5CFF", "#6D28D9"]} style={styles.createGradient}>
              <Ionicons name="add" size={22} color="#fff" />
            </LinearGradient>
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setHeaderMenuVisible(true)} accessibilityLabel="Memories options">
            <Ionicons name="ellipsis-vertical" size={19} color="#6D28D9" />
          </TouchableOpacity>
        </View>

        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Ionicons name="search-outline" size={18} color="#8994A8" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search memories, people, Digital ID, or JNV"
            placeholderTextColor="#98A2B3"
            returnKeyType="search"
            onSubmitEditing={Keyboard.dismiss}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            style={styles.searchInput}
          />
          {!!search && (
            <TouchableOpacity onPress={() => setSearch("")} accessibilityLabel="Clear search">
              <Ionicons name="close-circle" size={18} color="#A7B0C0" />
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={() => setFiltersVisible(true)} accessibilityLabel="Filter memories">
            <Ionicons name="options-outline" size={19} color="#7C3AED" />
          </TouchableOpacity>
        </View>

        <View style={styles.contentTabs}>
          <TouchableOpacity
            style={[styles.contentTab, activeTab === "posts" ? styles.contentTabActive : styles.contentTabInactive]}
            onPress={() => { setActiveTab("posts"); setPostFilter("all"); }}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "posts" }}
          >
            <Ionicons name="grid-outline" size={16} color={activeTab === "posts" ? "#fff" : "#6D28D9"} />
            <Text style={[styles.contentTabText, activeTab === "posts" && styles.contentTabTextActive]}>Posts</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.contentTab, activeTab === "reels" ? styles.contentTabActive : styles.contentTabInactive]}
            onPress={() => setActiveTab("reels")}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === "reels" }}
          >
            <Ionicons name="videocam-outline" size={16} color={activeTab === "reels" ? "#fff" : "#6D28D9"} />
            <Text style={[styles.contentTabText, activeTab === "reels" && styles.contentTabTextActive]}>Reels</Text>
          </TouchableOpacity>
        </View>
      </View>

      {debouncedSearch.length >= 2 && renderPeopleResults(peopleSearch.data ?? [])}

    </View>
  );

  const renderListEmpty = () => {
    if (feed.isLoading) {
      return (
        <View style={styles.state}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={styles.stateText}>{activeTab === "reels" ? "Loading Reels…" : "Loading community posts…"}</Text>
        </View>
      );
    }

    if (feed.isError) {
      return (
        <View style={styles.state}>
          <View style={styles.stateIcon}>
            <Ionicons name="cloud-offline-outline" size={23} color="#68758D" />
          </View>
          <Text style={styles.stateTitle}>Memories could not load</Text>
          <Text style={styles.stateText}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void feed.refetch()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIcon}>
          <Ionicons name="images-outline" size={28} color="#7C3AED" />
        </View>
        <Text style={styles.emptyTitle}>
          {activeTab === "reels"
            ? "No Reels yet"
            : debouncedSearch || postFilter !== "all" ? "No matching posts" : "Start the conversation"}
        </Text>
        <Text style={styles.emptyText}>
          {activeTab === "reels"
            ? "Videos shared as posts in your JNV community will appear here automatically."
            : debouncedSearch || postFilter !== "all"
            ? "Try another search or choose a different filter."
            : "Share the first memory or update with your JNV community."}
        </Text>
        {activeTab === "posts" && !debouncedSearch && postFilter === "all" ? (
          <TouchableOpacity style={styles.emptyButton} onPress={() => setCreateMenuVisible(true)}>
            <Text style={styles.emptyButtonText}>Create a post</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {activeTab === "posts" ? <FlatList
        data={feed.isLoading || feed.isError ? [] : memories}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <FadeIn delay={Math.min(index, 4) * 30}>
            <MemoryPostCard
              memory={item}
              currentUserId={profile?.uid}
              actionPending={toggleLike.isPending || toggleBookmark.isPending || voteInPoll.isPending}
              onLike={handleLike}
              onBookmark={handleBookmark}
              onComments={setCommentsPost}
              onMore={setMenuPost}
              onVote={handleVote}
              onOpenProfile={(userId) => router.push({ pathname: "/(screens)/user-profile", params: { userId } })}
              onMessage={showToast}
            />
          </FadeIn>
        )}
        contentContainerStyle={[
          styles.list,
          (feed.isLoading || feed.isError || memories.length === 0) && styles.emptyList,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={feed.isRefetching && !feed.isFetchingNextPage}
            onRefresh={() => feed.refetch()}
            tintColor="#7C3AED"
          />
        }
        onEndReached={() => {
          if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
        }}
        onEndReachedThreshold={0.45}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderListEmpty}
        ListFooterComponent={
          feed.isFetchingNextPage ? (
            <View style={styles.footerLoading}>
              <ActivityIndicator color="#7C3AED" />
              <Text style={styles.stateText}>Loading more posts…</Text>
            </View>
          ) : feed.hasNextPage ? (
            <TouchableOpacity style={styles.loadMore} onPress={() => void feed.fetchNextPage()}>
              <Text style={styles.loadMoreText}>Load more</Text>
            </TouchableOpacity>
          ) : memories.length > 0 ? (
            <Text style={styles.endText}>You’re all caught up.</Text>
          ) : (
            <View style={{ height: 20 }} />
          )
        }
      /> : (
        <MemoriesReels
          memories={feed.isLoading || feed.isError ? [] : memories}
          scope={reelScope}
          onScopeChange={setReelScope}
          onClose={() => setActiveTab("posts")}
          isLoading={feed.isLoading}
          isError={feed.isError}
          isFetchingNextPage={feed.isFetchingNextPage}
          onRetry={() => void feed.refetch()}
          onLoadMore={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage();
          }}
          autoplayVideos={memoryPreferences.data?.autoplayVideos}
          dataSaver={memoryPreferences.data?.dataSaver}
          onLike={handleLike}
          onBookmark={handleBookmark}
          onComments={setCommentsPost}
          onOpenProfile={(userId) => router.push({ pathname: "/(screens)/user-profile", params: { userId } })}
          onReport={(memory) => {
            if (memory.authorId === profile?.uid) {
              showToast("You can’t report your own post.");
              return;
            }
            setReportPost(memory);
          }}
          currentUserId={profile?.uid}
        />
      )}

      {!!toast && <FadeIn style={[styles.toast, { bottom: Math.max(insets.bottom, 18) + 78 }]}><Text style={styles.toastText}>{toast}</Text></FadeIn>}

      <MemoryComposer
        visible={composerVisible}
        onClose={() => {
          setComposerVisible(false);
          setEditingPost(null);
        }}
        onSubmit={submitPost}
        initial={editingPost}
        initialPostType={initialPostType}
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
            <TouchableOpacity style={styles.sheetOption} onPress={() => { const post = menuPost; setMenuPost(null); if (post) void handleBookmark(post); }}>
              <Ionicons name={menuPost?.bookmarked ? "bookmark" : "bookmark-outline"} size={19} color="#42516B" />
              <Text style={styles.sheetOptionText}>{menuPost?.bookmarked ? "Remove from Saved" : "Save post"}</Text>
            </TouchableOpacity>
            {menuPost?.authorId === profile?.uid ? (
              <>
                {isPostEditable(menuPost?.createdAt) ? (
                  <TouchableOpacity style={styles.sheetOption} onPress={() => menuPost && startEdit(menuPost)}>
                    <Ionicons name="create-outline" size={19} color="#42516B" />
                    <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <Text style={styles.sheetOptionText}>Edit post</Text>
                      {formatEditTimeRemaining(menuPost?.createdAt) ? (
                        <Text style={{ fontSize: 11, color: "#6366F1", marginRight: 8 }}>
                          {formatEditTimeRemaining(menuPost?.createdAt)}
                        </Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.sheetOption, { opacity: 0.65 }]}>
                    <Ionicons name="time-outline" size={19} color="#7A8BA0" />
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text style={[styles.sheetOptionText, { color: "#7A8BA0", marginLeft: 0 }]}>Edit unavailable</Text>
                      <Text style={{ fontSize: 11, color: "#9AA5B5", marginTop: 2 }}>
                        Posts can only be edited within 24 hours of publishing.
                      </Text>
                    </View>
                  </View>
                )}
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

      <Modal visible={headerMenuVisible} animationType="fade" transparent onRequestClose={() => setHeaderMenuVisible(false)}>
        <View style={styles.memoryMenuOverlay}>
          <TouchableOpacity
            style={styles.memoryMenuDismiss}
            onPress={() => setHeaderMenuVisible(false)}
            accessibilityRole="button"
            accessibilityLabel="Close Memories menu"
          />
          <View style={[styles.memoryMenuDrawer, { paddingTop: Math.max(insets.top, 10) + 8 }]}>
            <View style={styles.memoryMenuHeader}>
              <View style={styles.memoryMenuIdentity}>
                {profile?.photoURL ? (
                  <Image source={{ uri: profile.photoURL }} style={styles.memoryMenuAvatar} />
                ) : (
                  <View style={[styles.memoryMenuAvatar, styles.memoryMenuAvatarFallback]}>
                    <Text style={styles.memoryMenuAvatarText}>{profile?.fullName?.slice(0, 1).toUpperCase() || "N"}</Text>
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.memoryMenuName} numberOfLines={1}>{profile?.fullName || "Navodaya Connect"}</Text>
                  <Text style={styles.memoryMenuRole} numberOfLines={1}>
                    {[profile?.role, profile?.jnvName].filter(Boolean).join(" · ")}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.memoryMenuClose}
                onPress={() => setHeaderMenuVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close Memories menu"
              >
                <Ionicons name="close" size={22} color="#1F2937" />
              </TouchableOpacity>
            </View>
            <View style={styles.memoryMenuCard}>
              {([
                ["bookmark-outline", "Saved", "/(tabs)/memories-saved"],
                ["settings-outline", "Memories settings", "/(tabs)/memories-settings"],
                ["flag-outline", "Report a problem", "/(screens)/report-problem"],
              ] as const).map(([icon, label, route]) => (
                <TouchableOpacity
                  key={label}
                  style={styles.memoryMenuItem}
                  onPress={() => {
                    setHeaderMenuVisible(false);
                    router.push(route as any);
                  }}
                  activeOpacity={0.72}
                >
                  <View style={styles.memoryMenuItemIcon}>
                    <Ionicons name={icon} size={18} color="#7C3AED" />
                  </View>
                  <Text style={styles.memoryMenuItemText}>{label}</Text>
                  <Ionicons name="chevron-forward" size={16} color="#C4B5FD" />
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={createMenuVisible} animationType="fade" transparent onRequestClose={() => setCreateMenuVisible(false)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setCreateMenuVisible(false)}>
          <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 18) + 16 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Create in Memories</Text>
            {([
              ["post", "Post", "Share text, photos or videos.", "create-outline"],
              ["poll", "Poll", "Ask the Navodaya community.", "stats-chart-outline"],
              ["talk", "Navodayan Talks", "Share your journey and inspire others.", "mic-outline"],
            ] as ["post" | "poll" | "talk", string, string, keyof typeof Ionicons.glyphMap][]).map(([option, label, description, icon]) => (
              <TouchableOpacity key={option} style={styles.sheetOption} onPress={() => openCreateOption(option)}>
                <Ionicons name={icon} size={20} color="#6D28D9" />
                <View style={styles.createOptionCopy}>
                  <Text style={styles.sheetOptionText}>{label}</Text>
                  <Text style={styles.createOptionDescription}>{description}</Text>
                </View>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setCreateMenuVisible(false)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={filtersVisible} animationType="fade" transparent onRequestClose={() => setFiltersVisible(false)}>
        <TouchableOpacity style={styles.scrim} activeOpacity={1} onPress={() => setFiltersVisible(false)}>
          <View style={[styles.actionSheet, { paddingBottom: Math.max(insets.bottom, 18) + 16 }]} onStartShouldSetResponder={() => true}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Filter posts</Text>
            {POST_FILTERS.map((item) => {
              const selected = postFilter === item.value;
              return (
                <TouchableOpacity key={item.value} style={styles.sheetOption} onPress={() => { setPostFilter(item.value); setActiveTab("posts"); setFiltersVisible(false); }}>
                  <Ionicons name={item.icon} size={20} color={selected ? "#6D28D9" : "#596579"} />
                  <Text style={styles.sheetOptionText}>{item.label}</Text>
                  {selected ? <Ionicons name="checkmark" size={18} color="#6D28D9" /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity style={styles.cancelButton} onPress={() => setFiltersVisible(false)}><Text style={styles.cancelText}>Close</Text></TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { backgroundColor: "#FFFFFF", paddingHorizontal: 18, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: "rgba(233, 213, 255, 0.6)" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleBlock: { flex: 1 },
  title: { color: "#1E1B4B", fontSize: 24, fontFamily: "Inter_700Bold" },
  subtitle: { color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  headerIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.8)", position: "relative" },
  unreadDot: { position: "absolute", top: 5, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1, borderColor: "#fff" },
  createButton: { width: 40, height: 40, borderRadius: 20, overflow: "hidden", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
  createGradient: { flex: 1, alignItems: "center", justifyContent: "center" },
  searchBox: { height: 44, marginTop: 12, paddingHorizontal: 14, borderRadius: 22, flexDirection: "row", alignItems: "center", gap: 9, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.8)" },
  searchBoxFocused: { borderColor: "#8B5CF6", backgroundColor: "#FFFFFF" },
  searchInput: { flex: 1, minWidth: 0, color: "#1E1B4B", fontSize: 13, fontFamily: "Inter_400Regular", paddingVertical: 0 },
  contentTabs: { flexDirection: "row", gap: 7, marginTop: 10, paddingHorizontal: 1 },
  contentTab: { height: 36, flex: 1, borderRadius: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
  contentTabActive: { backgroundColor: "#7C3AED" },
  contentTabInactive: { backgroundColor: "#F1ECF9" },
  contentTabText: { color: "#6D28D9", fontSize: 12, fontFamily: "Inter_700Bold" },
  contentTabTextActive: { color: "#FFFFFF" },
  filters: { gap: 8, paddingTop: 12, paddingBottom: 2 },
  peopleSection: { backgroundColor: "#FFFFFF", paddingTop: 10, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(233, 213, 255, 0.6)" },
  peopleHeading: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, marginBottom: 8 },
  peopleHeadingIcon: { width: 26, height: 26, borderRadius: 9, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F3FF" },
  peopleTitle: { color: "#1E1B4B", fontSize: 13, fontFamily: "Inter_700Bold" },
  peopleCount: { color: "#7C3AED", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  peopleResults: { paddingHorizontal: 16, gap: 10 },
  peopleCard: { width: 235, minHeight: 68, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 16, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.8)", flexDirection: "row", alignItems: "center", gap: 10, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  peopleAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#EDE9FE" },
  peopleAvatarFallback: { alignItems: "center", justifyContent: "center" },
  peopleInitial: { color: "#7C3AED", fontSize: 15, fontFamily: "Inter_700Bold" },
  peopleInfo: { flex: 1, minWidth: 0, gap: 2 },
  peopleName: { color: "#1E1B4B", fontSize: 12, fontFamily: "Inter_700Bold" },
  peopleMeta: { color: "#7C3AED", fontSize: 10, fontFamily: "Inter_500Medium" },
  peopleJnv: { color: "#64748B", fontSize: 10, fontFamily: "Inter_400Regular" },
  peopleState: { minHeight: 42, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14 },
  peopleStateText: { color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular" },
  peopleEmpty: { paddingHorizontal: 16, color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular" },
  filterChip: { height: 34, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, borderRadius: 18, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)" },
  filterChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  filterText: { color: "#64748B", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  filterTextActive: { color: "#FFFFFF" },
  list: { paddingBottom: 140 },
  emptyList: { flexGrow: 1 },
  feedIntro: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 14, marginBottom: 12, padding: 14, borderRadius: 16, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)" },
  introMark: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  introText: { flex: 1, color: "#1E1B4B", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  state: { flex: 1, minHeight: 280, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  stateIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center", backgroundColor: "#F5F3FF" },
  stateTitle: { color: "#1E1B4B", fontSize: 16, fontFamily: "Inter_700Bold", marginTop: 5 },
  stateText: { color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular" },
  retryButton: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 20, backgroundColor: "#7C3AED", marginTop: 8 },
  retryText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  emptyState: { alignItems: "center", paddingHorizontal: 30, paddingTop: 45 },
  emptyIcon: { width: 64, height: 64, borderRadius: 24, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", marginBottom: 14 },
  emptyTitle: { color: "#1E1B4B", fontSize: 17, fontFamily: "Inter_700Bold", textAlign: "center" },
  emptyText: { color: "#64748B", fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", textAlign: "center", marginTop: 7 },
  emptyButton: { marginTop: 18, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 22, backgroundColor: "#7C3AED", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  emptyButtonText: { color: "#fff", fontSize: 13, fontFamily: "Inter_700Bold" },
  footerLoading: { height: 60, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 8 },
  loadMore: { alignSelf: "center", marginVertical: 16, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.9)", borderRadius: 22, backgroundColor: "#FFFFFF" },
  loadMoreText: { color: "#7C3AED", fontSize: 12, fontFamily: "Inter_700Bold" },
  endText: { textAlign: "center", color: "#94A3B8", fontSize: 11, fontFamily: "Inter_400Regular", paddingVertical: 20 },
  toast: { position: "absolute", left: 20, right: 20, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: "#1E1B4B", zIndex: 30, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 10, elevation: 6 },
  toastText: { color: "#fff", fontSize: 12, textAlign: "center", fontFamily: "Inter_500Medium" },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 12, 35, 0.45)" },
  memoryMenuOverlay: { flex: 1, flexDirection: "row", justifyContent: "flex-end", backgroundColor: "rgba(17, 24, 39, 0.42)" },
  memoryMenuDismiss: { flex: 1 },
  memoryMenuDrawer: { width: "86%", maxWidth: 390, height: "100%", backgroundColor: "#FAF9FF", borderTopLeftRadius: 24, borderBottomLeftRadius: 24, paddingHorizontal: 14 },
  memoryMenuHeader: { minHeight: 74, flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingBottom: 12 },
  memoryMenuIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  memoryMenuAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#7C3AED", backgroundColor: "#EDE9FE" },
  memoryMenuAvatarFallback: { alignItems: "center", justifyContent: "center" },
  memoryMenuAvatarText: { color: "#7C3AED", fontFamily: "Inter_700Bold", fontSize: 16 },
  memoryMenuName: { color: "#1F2937", fontFamily: "Inter_700Bold", fontSize: 15 },
  memoryMenuRole: { color: "#6B7280", fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 3, textTransform: "capitalize" },
  memoryMenuClose: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#FFFFFF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  memoryMenuCard: { backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 1, borderColor: "#F0EAFE", overflow: "hidden" },
  memoryMenuItem: { minHeight: 56, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 10, borderBottomWidth: 1, borderBottomColor: "#F3F4F6" },
  memoryMenuItemIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: "#FAF5FF", alignItems: "center", justifyContent: "center" },
  memoryMenuItemText: { flex: 1, color: "#374151", fontFamily: "Inter_500Medium", fontSize: 13 },
  actionSheet: { backgroundColor: "#fff", paddingHorizontal: 20, paddingTop: 12, borderTopLeftRadius: 26, borderTopRightRadius: 26 },
  sheetHandle: { width: 40, height: 4, backgroundColor: "#E2E8F0", borderRadius: 2, alignSelf: "center", marginBottom: 14 },
  sheetTitle: { color: "#1E1B4B", fontSize: 16, fontFamily: "Inter_700Bold", paddingVertical: 8 },
  sheetOption: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  sheetOptionText: { color: "#1E1B4B", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  createOptionCopy: { flex: 1, gap: 3 },
  createOptionDescription: { color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular" },
  dangerText: { color: "#EF4444" },
  cancelButton: { minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 8, borderRadius: 14, backgroundColor: "#F8F7FF" },
  cancelText: { color: "#64748B", fontSize: 13, fontFamily: "Inter_700Bold" },
  confirmCard: { width: "88%", alignSelf: "center", padding: 22, borderRadius: 22, backgroundColor: "#fff", marginBottom: 40 },
  confirmIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: "#FEF2F2", marginBottom: 12 },
  confirmTitle: { color: "#1E1B4B", fontSize: 17, fontFamily: "Inter_700Bold" },
  confirmText: { color: "#64748B", fontSize: 12, lineHeight: 18, fontFamily: "Inter_400Regular", marginTop: 7, marginBottom: 14 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  confirmSecondary: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#F8F7FF", alignItems: "center", justifyContent: "center" },
  confirmSecondaryText: { color: "#64748B", fontSize: 12, fontFamily: "Inter_700Bold" },
  confirmDanger: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  confirmDangerText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  reportChoice: { minHeight: 46, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  reportChoiceText: { color: "#1E1B4B", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
