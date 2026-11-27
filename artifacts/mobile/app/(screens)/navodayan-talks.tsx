import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, type NavodayanTalk, type NavodayanTalkComment } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

const CATEGORIES = [
  "Career Journey", "Education", "Entrepreneurship", "Community Service", "Personal Growth", "Other",
];
type TalkModerationAction = "start_review" | "request_changes" | "approve" | "reject" | "publish" | "remove" | "restore";
type Tab = "discover" | "my" | "review";

function makeRequestKey() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const value = Math.floor(Math.random() * 16);
    return (char === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

function TalkCard({
  talk,
  onChanged,
  onComments,
  onEdit,
  onReport,
  onModerateAction,
  currentUserId,
  mode,
}: {
  talk: NavodayanTalk;
  onChanged: () => void;
  onComments: (talk: NavodayanTalk) => void;
  onEdit?: (talk: NavodayanTalk) => void;
  onReport?: (talk: NavodayanTalk) => void;
  onModerateAction?: (talk: NavodayanTalk, action: TalkModerationAction) => void;
  currentUserId?: string;
  mode: Tab;
}) {
  const [busy, setBusy] = useState(false);
  const media = talk.media[0];
  const date = new Date(talk.createdAt);
  const dateLabel = Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  const moderationActions: TalkModerationAction[] = talk.status === "submitted"
    ? ["start_review", "request_changes", "approve", "reject"]
    : talk.status === "under_review"
      ? ["request_changes", "approve", "reject"]
      : talk.status === "approved"
        ? ["publish"]
        : talk.status === "published"
          ? ["remove"]
          : talk.status === "removed"
            ? ["restore"]
            : [];

  const toggleLike = async () => {
    setBusy(true);
    try {
      await api.memories.toggleLike(talk.memoryId);
      onChanged();
    } catch (error) {
      Alert.alert("Could not update", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const toggleBookmark = async () => {
    setBusy(true);
    try {
      await api.memories.toggleBookmark(talk.memoryId);
      onChanged();
    } catch (error) {
      Alert.alert("Could not save Talk", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const openMedia = async () => {
    if (!media?.url) return;
    try {
      await Linking.openURL(media.url);
    } catch {
      Alert.alert("Could not open media", "Please try again later.");
    }
  };

  return (
    <View style={styles.talkCard}>
      <View style={styles.authorRow}>
        {talk.author.photoUrl ? (
          <Image source={{ uri: talk.author.photoUrl }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{talk.author.name.charAt(0).toUpperCase()}</Text></View>
        )}
        <View style={styles.authorInfo}>
          <Text style={styles.authorName} numberOfLines={1}>{talk.author.name}</Text>
          <Text style={styles.authorMeta} numberOfLines={1}>
            {[talk.author.jnvName, talk.author.profession, dateLabel].filter(Boolean).join(" · ")}
          </Text>
        </View>
        <View style={styles.categoryPill}><Text style={styles.categoryPillText}>{talk.category}</Text></View>
      </View>

      <Text style={styles.talkTitle}>{talk.title}</Text>
      <Text style={styles.talkBody} numberOfLines={mode === "discover" ? 6 : undefined}>{talk.body}</Text>
      {media ? (
        <TouchableOpacity style={styles.talkMedia} onPress={openMedia} activeOpacity={0.9}>
          {media.mediaType === "image" ? (
            <Image source={{ uri: media.url }} style={styles.talkImage} resizeMode="cover" />
          ) : (
            <LinearGradient colors={["#21134B", "#6D28D9"]} style={styles.videoPlaceholder}>
              <Ionicons name="play-circle" size={58} color="#fff" />
              <Text style={styles.videoLabel}>Tap to play Talk</Text>
            </LinearGradient>
          )}
        </TouchableOpacity>
      ) : null}
      {talk.topics.length > 0 ? (
        <View style={styles.topicRow}>
          {talk.topics.map((topic) => <Text style={styles.topicChip} key={`${talk.id}-${topic}`}>#{topic}</Text>)}
        </View>
      ) : null}
      {talk.career || talk.batch ? (
        <Text style={styles.careerMeta}>{[talk.career, talk.batch ? `Batch ${talk.batch}` : ""].filter(Boolean).join(" · ")}</Text>
      ) : null}
      {mode === "my" && talk.status !== "published" ? (
        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            {talk.status === "submitted" ? "Pending review" :
              talk.status === "under_review" ? "Under review" :
                talk.status === "changes_requested" ? "Changes requested" :
                  talk.status === "approved" ? "Approved · awaiting publishing" :
                    talk.status === "removed" || talk.status === "rejected" ? talk.status : "Draft"}
          </Text>
          {talk.moderationFeedback ? <Text style={styles.statusFeedback}>{talk.moderationFeedback}</Text> : null}
          {talk.status !== "removed" && talk.status !== "rejected" && onEdit ? (
            <TouchableOpacity style={styles.editSubmissionButton} onPress={() => onEdit(talk)}>
              <Ionicons name="create-outline" size={15} color="#5B21B6" />
              <Text style={styles.editSubmissionText}>Edit and resubmit</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
      {mode === "my" && talk.status === "published" && onEdit ? (
        <TouchableOpacity style={styles.editPublishedButton} onPress={() => onEdit(talk)}>
          <Ionicons name="create-outline" size={16} color="#5B21B6" />
          <Text style={styles.editSubmissionText}>Edit your story</Text>
        </TouchableOpacity>
      ) : null}
      <View style={styles.engagementRow}>
          <TouchableOpacity style={styles.engagementButton} disabled={busy || mode !== "discover"} onPress={toggleLike}>
            <Ionicons name={talk.liked ? "heart" : "heart-outline"} size={19} color={talk.liked ? "#DC4C73" : "#667085"} />
            <Text style={styles.engagementText}>{talk.likes}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.engagementButton} disabled={busy || mode !== "discover"} onPress={() => onComments(talk)}>
            <Ionicons name="chatbubble-ellipses-outline" size={18} color="#667085" />
            <Text style={styles.engagementText}>{talk.commentsCount}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.engagementButton} disabled={busy} onPress={toggleBookmark}>
            <Ionicons name={talk.bookmarked ? "bookmark" : "bookmark-outline"} size={18} color="#667085" />
            <Text style={styles.engagementText}>{talk.bookmarked ? "Saved" : "Save"}</Text>
          </TouchableOpacity>
          {mode === "discover" && talk.author.id !== currentUserId && onReport ? (
            <TouchableOpacity style={styles.engagementButton} onPress={() => onReport(talk)} accessibilityLabel="Report Talk">
              <Ionicons name="flag-outline" size={17} color="#8A8097" />
              <Text style={styles.engagementText}>Report</Text>
            </TouchableOpacity>
          ) : null}
      </View>
      {mode === "review" && onModerateAction && moderationActions.length ? (
        <View style={styles.reviewActions}>
          {moderationActions.map((action) => (
            <TouchableOpacity
              key={action}
              style={[styles.reviewAction, action === "reject" || action === "remove" ? styles.reviewActionDanger : null]}
              onPress={() => onModerateAction(talk, action)}
            >
              <Text style={[styles.reviewActionText, action === "reject" || action === "remove" ? styles.reviewActionDangerText : null]}>
                {action === "start_review" ? "Start review" :
                  action === "request_changes" ? "Request changes" :
                    action === "approve" ? "Approve" :
                      action === "reject" ? "Reject" :
                        action === "publish" ? "Publish" : action === "restore" ? "Restore" : "Remove"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function NavodayanTalksScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ create?: string }>();
  const [tab, setTab] = useState<Tab>("my");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [category, setCategory] = useState("");
  const [composerVisible, setComposerVisible] = useState(false);
  const [commentsTalk, setCommentsTalk] = useState<NavodayanTalk | null>(null);
  const [reportTalk, setReportTalk] = useState<NavodayanTalk | null>(null);
  const [reportReason, setReportReason] = useState("Inappropriate content");
  const [reportDetails, setReportDetails] = useState("");
  const [tick, setTick] = useState(0);
  const [submissionKey, setSubmissionKey] = useState(makeRequestKey);
  const [editingTalk, setEditingTalk] = useState<NavodayanTalk | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [topicsInput, setTopicsInput] = useState("");
  const [career, setCareer] = useState("");
  const [batch, setBatch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(CATEGORIES[0]);
  const [storyType, setStoryType] = useState<"written" | "video">("written");
  const [visibility, setVisibility] = useState<"public" | "followers">("public");
  const [mediaKey, setMediaKey] = useState("");
  const [mediaLabel, setMediaLabel] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [commentRows, setCommentRows] = useState<NavodayanTalkComment[]>([]);
  const [commentInput, setCommentInput] = useState("");
  const [commentBusy, setCommentBusy] = useState(false);
  const [reviewDialog, setReviewDialog] = useState<{ talk: NavodayanTalk; action: TalkModerationAction } | null>(null);
  const [reviewReason, setReviewReason] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);
  const canModerateTalks = profile?.role === "teacher" || profile?.role === "official";

  const discoverQuery = useInfiniteQuery({
    queryKey: ["navodayan-talks", "discover", debouncedSearch, category, tick],
    queryFn: ({ pageParam }) => api.talks.list(
      debouncedSearch.trim(),
      category,
      typeof pageParam === "string" ? pageParam : undefined,
    ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.hasMore ? page.nextCursor : undefined,
    enabled: tab === "discover",
  });
  const submissionsQuery = useQuery({
    queryKey: ["navodayan-talks", tab, tick],
    queryFn: () => api.talks.mine(),
    enabled: tab === "my",
  });
  const reviewQuery = useQuery({
    queryKey: ["navodayan-talks", "moderation", tick],
    queryFn: () => api.talks.moderationQueue(),
    enabled: tab === "review" && canModerateTalks,
  });
  const talksQuery = tab === "discover" ? discoverQuery : tab === "my" ? submissionsQuery : reviewQuery;
  const talks = tab === "discover"
    ? discoverQuery.data?.pages.flatMap((page) => page.items) ?? []
    : tab === "my" ? submissionsQuery.data ?? [] : reviewQuery.data ?? [];

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (tab === "discover" && !discoverQuery.isLoading && !discoverQuery.isFetchingNextPage && talks.length === 0 && discoverQuery.hasNextPage) {
      void discoverQuery.fetchNextPage();
    }
  }, [tab, talks.length, discoverQuery.isLoading, discoverQuery.isFetchingNextPage, discoverQuery.hasNextPage, discoverQuery.fetchNextPage]);

  const refreshTalks = useCallback(() => {
    setTick((value) => value + 1);
    void queryClient.invalidateQueries({ queryKey: ["navodayan-talks"] });
  }, [queryClient]);

  useEffect(() => {
    if (!commentsTalk) return;
    let active = true;
    setCommentRows([]);
    api.memories.comments(commentsTalk.memoryId)
      .then((rows) => { if (active) setCommentRows(rows); })
      .catch((error) => { if (active) Alert.alert("Could not load comments", error instanceof Error ? error.message : "Please try again."); });
    return () => { active = false; };
  }, [commentsTalk]);

  const resetComposer = () => {
    setEditingTalk(null);
    setSubmissionKey(makeRequestKey());
    setTitle("");
    setBody("");
    setTopicsInput("");
    setCareer("");
    setBatch("");
    setSelectedCategory(CATEGORIES[0]);
    setStoryType("written");
    setVisibility("public");
    setMediaKey("");
    setMediaLabel("");
    setConsentConfirmed(false);
    setRightsConfirmed(false);
    setFeedback("");
  };

  useEffect(() => {
    if (params.create !== "true") return;
    resetComposer();
    setComposerVisible(true);
    router.setParams({ create: undefined });
  }, [params.create]);

  const editTalk = (talk: NavodayanTalk) => {
    setEditingTalk(talk);
    setTitle(talk.title);
    setBody(talk.body);
    setTopicsInput(talk.topics.join(", "));
    setCareer(talk.career ?? "");
    setBatch(talk.batch ?? "");
    setSelectedCategory(talk.category);
    setStoryType(talk.storyType);
    setMediaKey("");
    setMediaLabel(talk.media.length ? "Existing media will be kept" : "");
    setConsentConfirmed(false);
    setRightsConfirmed(false);
    setFeedback("");
    setComposerVisible(true);
  };

  const chooseMedia = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert("Permission needed", "Allow access to your library to attach Talk media.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: storyType === "video" ? ["videos"] : ["images"],
        quality: 0.85,
        allowsMultipleSelection: false,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      if ((asset.fileSize ?? 0) > 50 * 1024 * 1024) {
        Alert.alert("File too large", "Choose a file under 50 MB.");
        return;
      }
      setUploading(true);
      const upload = await api.memories.uploadMedia(asset.uri, asset.fileName ?? (storyType === "video" ? "talk-video" : "talk-image"), asset.mimeType);
      if (typeof upload.key !== "string") throw new Error("The media upload did not return a valid file key.");
      setMediaKey(upload.key);
      setMediaLabel(asset.fileName ?? "Media attached");
    } catch (error) {
      Alert.alert("Upload failed", error instanceof Error ? error.message : "Could not upload this file.");
    } finally {
      setUploading(false);
    }
  };

  const submitTalk = async (saveAsDraft = false) => {
    if (title.trim().length < 5 || body.trim().length < 30 ||
      (!saveAsDraft && ((!editingTalk && !mediaKey && storyType === "video") || !consentConfirmed || !rightsConfirmed))) {
      setFeedback("Use a title of at least 5 characters and a story of at least 30 characters. Submitted Talks need any required video and both permissions.");
      return;
    }
    const wasEditing = Boolean(editingTalk);
    setSubmitting(true);
    setFeedback("");
    try {
      if (editingTalk) {
        await api.talks.update(editingTalk.id, {
          title: title.trim(),
          body: body.trim(),
          category: selectedCategory,
          topics: topicsInput.split(",").map((topic) => topic.trim()).filter(Boolean).slice(0, 6),
          visibility,
          consentConfirmed,
          rightsConfirmed,
          saveAsDraft,
        });
      } else {
        await api.talks.create({
          submissionKey,
          title: title.trim(),
          body: body.trim(),
          storyType,
          category: selectedCategory,
          topics: topicsInput.split(",").map((topic) => topic.trim()).filter(Boolean).slice(0, 6),
          ...(career.trim() ? { career: career.trim() } : {}),
          ...(batch.trim() ? { batch: batch.trim() } : {}),
          ...(mediaKey ? { mediaKey } : {}),
          visibility,
          consentConfirmed,
          rightsConfirmed,
          saveAsDraft,
        });
        setSubmissionKey(makeRequestKey());
      }
      setComposerVisible(false);
      resetComposer();
      setTab("my");
      refreshTalks();
      void queryClient.invalidateQueries({ queryKey: ["/api/memories"] });
      Alert.alert(
        saveAsDraft ? "Draft saved" : wasEditing ? "Story updated" : "Story published!",
        saveAsDraft
          ? "Your Talk is saved privately in My Talks."
          : "Your Navodayan Talk is now live in the Memories Posts feed.",
      );
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Could not submit your story.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitComment = async () => {
    if (!commentsTalk || !commentInput.trim()) return;
    setCommentBusy(true);
    try {
      const created = await api.memories.addComment(commentsTalk.memoryId, commentInput.trim());
      setCommentRows((current) => [...current, created]);
      setCommentInput("");
      refreshTalks();
    } catch (error) {
      Alert.alert("Could not add comment", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setCommentBusy(false);
    }
  };

  const submitReport = async () => {
    if (!reportTalk || !reportReason.trim()) return;
    setSubmitting(true);
    try {
      await api.memories.report(reportTalk.memoryId, reportReason, reportDetails.trim());
      setReportTalk(null);
      setReportReason("Inappropriate content");
      setReportDetails("");
      Alert.alert("Report submitted", "Thank you. The moderation team will review this Talk.");
    } catch (error) {
      Alert.alert("Could not submit report", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const submitModerationAction = async () => {
    if (!reviewDialog || reviewReason.trim().length < 3) return;
    setReviewBusy(true);
    try {
      await api.talks.moderate(reviewDialog.talk.id, reviewDialog.action, reviewReason.trim());
      setReviewDialog(null);
      setReviewReason("");
      refreshTalks();
    } catch (error) {
      Alert.alert("Could not update Talk", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <View style={[styles.page, { paddingTop: Math.max(insets.top, 8) }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()} accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={21} color="#34205F" />
        </TouchableOpacity>
        <View style={styles.headerTitleBlock}>
          <Text style={styles.headerTitle}>Navodayan Talks</Text>
          <Text style={styles.headerSubtitle}>Stories that move our community forward</Text>
        </View>
        <TouchableOpacity style={styles.submitButton} onPress={() => { resetComposer(); setComposerVisible(true); }}>
          <Ionicons name="add" size={20} color="#fff" />
          <Text style={styles.submitButtonText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        {(["my", ...(canModerateTalks ? ["review" as const] : [])] as Tab[]).map((value) => (
          <TouchableOpacity
            key={value}
            style={[styles.tabButton, tab === value && styles.tabButtonActive]}
            onPress={() => setTab(value)}
          >
            <Text style={[styles.tabText, tab === value && styles.tabTextActive]}>
              {value === "my" ? "My Talks" : "Moderation"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === "discover" ? (
        <>
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={18} color="#8A7AA6" />
            <TextInput value={search} onChangeText={setSearch} placeholder="Search stories, topics, careers" placeholderTextColor="#9A90AA" style={styles.searchInput} />
            {search ? <TouchableOpacity onPress={() => setSearch("")}><Ionicons name="close-circle" size={18} color="#8A7AA6" /></TouchableOpacity> : null}
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRow}>
            <TouchableOpacity style={[styles.filterChip, !category && styles.filterChipActive]} onPress={() => setCategory("")}>
              <Text style={[styles.filterChipText, !category && styles.filterChipTextActive]}>All stories</Text>
            </TouchableOpacity>
            {CATEGORIES.map((item) => (
              <TouchableOpacity key={item} style={[styles.filterChip, category === item && styles.filterChipActive]} onPress={() => setCategory(category === item ? "" : item)}>
                <Text style={[styles.filterChipText, category === item && styles.filterChipTextActive]}>{item}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </>
      ) : null}

      {talksQuery.isLoading ? (
        <View style={styles.centerState}><ActivityIndicator color="#7C3AED" /><Text style={styles.stateText}>Loading Talks…</Text></View>
      ) : talksQuery.isError ? (
        <TouchableOpacity style={styles.centerState} onPress={() => void talksQuery.refetch()}>
          <Ionicons name="cloud-offline-outline" size={32} color="#8B5CF6" />
          <Text style={styles.emptyTitle}>Could not load Talks</Text>
          <Text style={styles.stateText}>{talksQuery.error instanceof Error ? talksQuery.error.message : "Tap to try again."}</Text>
        </TouchableOpacity>
      ) : (
        <FlatList
          data={talks}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TalkCard
              talk={item}
              mode={tab}
              onChanged={refreshTalks}
              onComments={setCommentsTalk}
              onReport={tab === "discover" ? setReportTalk : undefined}
              onModerateAction={tab === "review" ? (talk, action) => {
                setReviewReason(action === "approve" || action === "publish" ? "Approved after review." : "");
                setReviewDialog({ talk, action });
              } : undefined}
              currentUserId={profile?.uid}
              onEdit={tab === "my" ? editTalk : undefined}
            />
          )}
          onEndReached={() => {
            if (tab === "discover" && discoverQuery.hasNextPage && !discoverQuery.isFetchingNextPage) {
              void discoverQuery.fetchNextPage();
            }
          }}
          onEndReachedThreshold={0.45}
          ListFooterComponent={tab === "discover" && discoverQuery.isFetchingNextPage ? <ActivityIndicator color="#7C3AED" style={{ padding: 14 }} /> : null}
          contentContainerStyle={[styles.listContent, talks.length === 0 && styles.emptyList]}
          refreshControl={<RefreshControl refreshing={talksQuery.isRefetching} onRefresh={() => void talksQuery.refetch()} tintColor="#7C3AED" />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name={tab === "my" ? "albums-outline" : "sparkles-outline"} size={38} color="#8B5CF6" />
              <Text style={styles.emptyTitle}>{tab === "my" ? "No stories yet" : tab === "review" ? "Nothing to review" : "No stories found"}</Text>
              <Text style={styles.stateText}>{tab === "my" ? "Submit a story to start your Talks journey." : tab === "review" ? "There are no submissions awaiting moderator action." : "Try another search or category."}</Text>
              {tab === "my" ? <TouchableOpacity style={styles.emptyCta} onPress={() => { resetComposer(); setComposerVisible(true); }}><Text style={styles.emptyCtaText}>Share your story</Text></TouchableOpacity> : null}
            </View>
          }
        />
      )}

      <Modal visible={composerVisible} animationType="slide" onRequestClose={() => setComposerVisible(false)}>
        <KeyboardAvoidingView style={[styles.modalPage, { paddingTop: Math.max(insets.top, 10) }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setComposerVisible(false)} style={styles.backButton}><Ionicons name="close" size={23} color="#34205F" /></TouchableOpacity>
            <Text style={styles.modalTitle}>{editingTalk ? "Edit your Talk" : "Share your Talk"}</Text>
            <View style={{ width: 40 }} />
          </View>
          <ScrollView contentContainerStyle={styles.formContent} keyboardShouldPersistTaps="handled">
            <LinearGradient colors={["#7C3AED", "#4C1D95"]} style={styles.formBanner}>
              <Ionicons name="mic-outline" size={27} color="#fff" />
              <View style={{ flex: 1 }}>
                <Text style={styles.formBannerTitle}>Your journey can inspire others</Text>
                <Text style={styles.formBannerText}>Share your journey directly with the Navodaya community.</Text>
              </View>
            </LinearGradient>
            {!editingTalk ? (
              <>
                <Text style={styles.fieldLabel}>Story format</Text>
                <View style={styles.formatRow}>
                  {(["written", "video"] as const).map((format) => (
                    <TouchableOpacity key={format} style={[styles.formatCard, storyType === format && styles.formatCardActive]} onPress={() => { setStoryType(format); setMediaKey(""); setMediaLabel(""); }}>
                      <Ionicons name={format === "written" ? "document-text-outline" : "videocam-outline"} size={21} color={storyType === format ? "#6D28D9" : "#667085"} />
                      <Text style={[styles.formatText, storyType === format && styles.formatTextActive]}>{format === "written" ? "Written story" : "Video talk"}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>Title</Text>
            <TextInput value={title} onChangeText={setTitle} maxLength={120} placeholder="Give your story a clear title" placeholderTextColor="#9A90AA" style={styles.input} />
            <Text style={styles.fieldLabel}>Your story</Text>
            <TextInput value={body} onChangeText={setBody} multiline maxLength={8000} textAlignVertical="top" placeholder="Share your experience, lessons, and advice…" placeholderTextColor="#9A90AA" style={[styles.input, styles.storyInput]} />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.formChipRow}>
              {CATEGORIES.map((item) => (
                <TouchableOpacity key={item} style={[styles.formChip, selectedCategory === item && styles.formChipActive]} onPress={() => setSelectedCategory(item)}>
                  <Text style={[styles.formChipText, selectedCategory === item && styles.formChipTextActive]}>{item}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Topics <Text style={styles.optionalText}>(comma-separated, up to 6)</Text></Text>
            <TextInput value={topicsInput} onChangeText={setTopicsInput} placeholder="e.g. leadership, engineering, resilience" placeholderTextColor="#9A90AA" style={styles.input} />
            <View style={styles.inlineFields}>
              <View style={styles.inlineField}>
                <Text style={styles.fieldLabel}>Career <Text style={styles.optionalText}>(optional)</Text></Text>
                <TextInput value={career} onChangeText={setCareer} placeholder="Your field" placeholderTextColor="#9A90AA" style={styles.input} />
              </View>
              <View style={styles.inlineField}>
                <Text style={styles.fieldLabel}>Batch <Text style={styles.optionalText}>(optional)</Text></Text>
                <TextInput value={batch} onChangeText={setBatch} keyboardType="number-pad" placeholder="Pass-out year" placeholderTextColor="#9A90AA" style={styles.input} />
              </View>
            </View>
            {!editingTalk ? (
              <>
                <Text style={styles.fieldLabel}>{storyType === "video" ? "Video upload" : "Image (optional)"}</Text>
                <TouchableOpacity style={styles.uploadBox} onPress={() => void chooseMedia()} disabled={uploading}>
                  {uploading ? <ActivityIndicator color="#7C3AED" /> : <Ionicons name={mediaKey ? "checkmark-circle-outline" : storyType === "video" ? "cloud-upload-outline" : "image-outline"} size={23} color="#7C3AED" />}
                  <Text style={styles.uploadText}>{uploading ? "Uploading…" : mediaLabel || (storyType === "video" ? "Choose a video, up to 50 MB" : "Add a cover image, up to 50 MB")}</Text>
                  {mediaKey ? <TouchableOpacity onPress={() => { setMediaKey(""); setMediaLabel(""); }} accessibilityLabel="Remove selected media"><Ionicons name="close-circle" size={20} color="#667085" /></TouchableOpacity> : null}
                </TouchableOpacity>
              </>
            ) : null}
            <ConsentRow checked={consentConfirmed} onPress={() => setConsentConfirmed(!consentConfirmed)}>
              I confirm I have permission from identifiable people shown or mentioned, especially minors.
            </ConsentRow>
            <Text style={styles.fieldLabel}>Audience</Text>
            <View style={styles.formatRow}>
              {(["public", "followers"] as const).map((vis) => (
                <TouchableOpacity key={vis} style={[styles.formatCard, visibility === vis && styles.formatCardActive]} onPress={() => setVisibility(vis)}>
                  <Ionicons name={vis === "public" ? "globe-outline" : "people-outline"} size={19} color={visibility === vis ? "#6D28D9" : "#667085"} />
                  <Text style={[styles.formatText, visibility === vis && styles.formatTextActive]}>{vis === "public" ? "Public (Memories)" : "Followers only"}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <ConsentRow checked={rightsConfirmed} onPress={() => setRightsConfirmed(!rightsConfirmed)}>
              I own or have permission to share this story and all attached media.
            </ConsentRow>
            {feedback ? <Text style={styles.formError}>{feedback}</Text> : null}
            <TouchableOpacity style={[styles.draftButton, (submitting || uploading) && styles.disabled]} onPress={() => void submitTalk(true)} disabled={submitting || uploading}>
              <Text style={styles.draftButtonText}>Save draft</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.submitWide, (submitting || uploading) && styles.disabled]} onPress={() => void submitTalk(false)} disabled={submitting || uploading}>
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitWideText}>{editingTalk ? "Save & Publish" : "Publish Talk"}</Text>}
            </TouchableOpacity>
            <Text style={styles.privacyNote}>Valid Talks publish automatically to the Memories Posts feed with a NAVODAYAN TALKS badge.</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={Boolean(commentsTalk)} transparent animationType="slide" onRequestClose={() => setCommentsTalk(null)}>
        <View style={styles.scrim}>
          <KeyboardAvoidingView style={styles.commentSheet} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}><Text style={styles.modalTitle}>Talk comments</Text><TouchableOpacity onPress={() => setCommentsTalk(null)}><Ionicons name="close" size={23} color="#34205F" /></TouchableOpacity></View>
            <ScrollView style={styles.commentList}>
              {commentRows.length ? commentRows.map((comment) => (
                <View style={styles.commentItem} key={comment.id}>
                  <Text style={styles.commentAuthor}>{comment.authorName}</Text>
                  <Text style={styles.commentContent}>{comment.content}</Text>
                </View>
              )) : <Text style={styles.stateText}>No comments yet. Start the conversation.</Text>}
            </ScrollView>
            <View style={styles.commentComposer}>
              <TextInput value={commentInput} onChangeText={setCommentInput} placeholder="Write a thoughtful comment…" placeholderTextColor="#9A90AA" style={styles.commentInput} />
              <TouchableOpacity onPress={() => void submitComment()} disabled={commentBusy || !commentInput.trim()} style={styles.commentSend}>
                {commentBusy ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={17} color="#fff" />}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal visible={Boolean(reportTalk)} transparent animationType="fade" onRequestClose={() => setReportTalk(null)}>
        <View style={styles.scrim}>
          <View style={styles.moderationModal}>
            <Text style={styles.modalTitle}>Report this Talk</Text>
            <Text style={styles.moderationDescription}>Choose the reason that best describes your concern.</Text>
            <View style={styles.formChipRow}>
              {["Spam", "Harassment", "Inappropriate content", "Other"].map((reason) => (
                <TouchableOpacity key={reason} style={[styles.formChip, reportReason === reason && styles.formChipActive]} onPress={() => setReportReason(reason)}>
                  <Text style={[styles.formChipText, reportReason === reason && styles.formChipTextActive]}>{reason}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput value={reportDetails} onChangeText={setReportDetails} multiline maxLength={1000} textAlignVertical="top" placeholder="Additional details (optional)" placeholderTextColor="#9A90AA" style={[styles.input, styles.reasonInput]} />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setReportTalk(null)}><Text style={styles.cancelText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitWide, styles.modalConfirm, submitting && styles.disabled]} onPress={() => void submitReport()} disabled={submitting}>
                {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitWideText}>Submit report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(reviewDialog)} transparent animationType="fade" onRequestClose={() => setReviewDialog(null)}>
        <View style={styles.scrim}>
          <View style={styles.moderationModal}>
            <Text style={styles.modalTitle}>
              {reviewDialog?.action === "start_review" ? "Start review" :
                reviewDialog?.action === "request_changes" ? "Request changes" :
                  reviewDialog?.action === "approve" ? "Approve Talk" :
                    reviewDialog?.action === "reject" ? "Reject Talk" :
                      reviewDialog?.action === "publish" ? "Publish Talk" : "Remove Talk"}
            </Text>
            <Text style={styles.moderationDescription}>{reviewDialog?.talk.title}</Text>
            <TextInput
              value={reviewReason}
              onChangeText={setReviewReason}
              multiline
              maxLength={1000}
              textAlignVertical="top"
              placeholder="Add a review note or reason (at least 3 characters)"
              placeholderTextColor="#9A90AA"
              style={[styles.input, styles.reasonInput]}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setReviewDialog(null)} disabled={reviewBusy}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitWide, styles.modalConfirm, (reviewBusy || reviewReason.trim().length < 3) && styles.disabled]}
                onPress={() => void submitModerationAction()}
                disabled={reviewBusy || reviewReason.trim().length < 3}
              >
                {reviewBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitWideText}>Confirm</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

function ConsentRow({ checked, onPress, children }: { checked: boolean; onPress: () => void; children: string }) {
  return (
    <TouchableOpacity style={styles.consentRow} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <Ionicons name={checked ? "checkbox" : "square-outline"} size={20} color={checked ? "#7C3AED" : "#9385A7"} />
      <Text style={styles.consentText}>{children}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#F8F7FC" },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 16, paddingBottom: 14 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#F1ECF9", alignItems: "center", justifyContent: "center" },
  headerTitleBlock: { flex: 1 },
  headerTitle: { color: "#24163D", fontSize: 20, fontWeight: "800" },
  headerSubtitle: { color: "#766A88", fontSize: 11, marginTop: 2 },
  submitButton: { backgroundColor: "#6D28D9", borderRadius: 19, height: 38, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 3 },
  submitButtonText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  tabRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  tabButton: { flex: 1, minHeight: 40, borderRadius: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 6 },
  tabButtonActive: { backgroundColor: "#EEE7FA" },
  tabText: { color: "#776D84", fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#5B21B6", fontWeight: "800" },
  searchBox: { minHeight: 44, marginHorizontal: 16, marginTop: 8, marginBottom: 6, backgroundColor: "#fff", borderRadius: 15, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", gap: 9, borderWidth: 1, borderColor: "#EEE8F5" },
  searchInput: { flex: 1, color: "#24163D", fontSize: 13, paddingVertical: 9 },
  categoryRow: { height: 52, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 7 },
  filterChip: { height: 34, justifyContent: "center", paddingHorizontal: 12, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEE8F5" },
  filterChipActive: { backgroundColor: "#6D28D9", borderColor: "#6D28D9" },
  filterChipText: { color: "#6E637E", fontSize: 11, fontWeight: "600" },
  filterChipTextActive: { color: "#fff" },
  listContent: { paddingHorizontal: 15, paddingTop: 8, paddingBottom: 112, gap: 12 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  talkCard: { backgroundColor: "#fff", borderRadius: 20, padding: 15, borderWidth: 1, borderColor: "#EEE8F5", shadowColor: "#2B1D45", shadowOpacity: 0.04, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  authorRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 39, height: 39, borderRadius: 20, backgroundColor: "#EEE7FA" },
  avatarFallback: { width: 39, height: 39, borderRadius: 20, backgroundColor: "#EDE5F8", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#6D28D9", fontWeight: "800", fontSize: 15 },
  authorInfo: { flex: 1 },
  authorName: { color: "#2D2140", fontSize: 13, fontWeight: "800" },
  authorMeta: { color: "#8A8097", fontSize: 10, marginTop: 3 },
  categoryPill: { backgroundColor: "#F4EFFB", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10, maxWidth: 115 },
  categoryPillText: { color: "#6841A4", fontSize: 9, fontWeight: "700" },
  talkTitle: { color: "#281B3E", fontWeight: "800", fontSize: 17, lineHeight: 23, marginTop: 15 },
  talkBody: { color: "#574D65", fontSize: 13, lineHeight: 20, marginTop: 7 },
  talkMedia: { marginTop: 12, borderRadius: 15, overflow: "hidden", backgroundColor: "#F1ECF9" },
  talkImage: { width: "100%", height: 230, backgroundColor: "#F1ECF9" },
  videoPlaceholder: { minHeight: 200, alignItems: "center", justifyContent: "center", gap: 7 },
  videoLabel: { color: "#fff", fontSize: 12, fontWeight: "700" },
  topicRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 11 },
  topicChip: { color: "#7046A8", fontSize: 11, backgroundColor: "#F6F1FB", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  careerMeta: { color: "#7A7185", fontSize: 11, marginTop: 9 },
  engagementRow: { borderTopWidth: 1, borderTopColor: "#F0EBF5", marginTop: 13, paddingTop: 11, flexDirection: "row", alignItems: "center", gap: 24 },
  engagementButton: { flexDirection: "row", alignItems: "center", gap: 6, minHeight: 28 },
  engagementText: { color: "#71687D", fontSize: 11, fontWeight: "600" },
  statusBox: { backgroundColor: "#F8F4FC", borderRadius: 12, padding: 11, marginTop: 12 },
  statusFeedback: { color: "#75658E", fontSize: 11, lineHeight: 16, marginTop: 5 },
  reviewActions: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 12 },
  reviewAction: { minHeight: 34, justifyContent: "center", paddingHorizontal: 11, borderRadius: 10, backgroundColor: "#F3EEFA", borderWidth: 1, borderColor: "#E7DDF2" },
  reviewActionText: { color: "#5B21B6", fontSize: 10, fontWeight: "800" },
  reviewActionDanger: { backgroundColor: "#FEF3F2", borderColor: "#FEE4E2" },
  reviewActionDangerText: { color: "#B42318" },
  editSubmissionButton: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 9, alignSelf: "flex-start" },
  editPublishedButton: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 11, alignSelf: "flex-start" },
  editSubmissionText: { color: "#5B21B6", fontSize: 11, fontWeight: "800" },
  statusText: { color: "#5D398A", fontWeight: "800", textTransform: "capitalize", fontSize: 12 },
  centerState: { flex: 1, alignItems: "center", justifyContent: "center", padding: 26, gap: 10 },
  emptyState: { alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  emptyTitle: { color: "#34244A", fontSize: 16, fontWeight: "800", textAlign: "center" },
  stateText: { color: "#82768F", fontSize: 12, textAlign: "center", lineHeight: 18 },
  emptyCta: { backgroundColor: "#6D28D9", borderRadius: 18, paddingHorizontal: 16, paddingVertical: 10, marginTop: 5 },
  emptyCtaText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  modalPage: { flex: 1, backgroundColor: "#F8F7FC" },
  modalHeader: { minHeight: 54, flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16 },
  modalTitle: { color: "#2A1D3E", fontSize: 17, fontWeight: "800", textTransform: "capitalize" },
  formContent: { padding: 16, paddingBottom: 36, gap: 8 },
  formBanner: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 17, padding: 15, marginBottom: 8 },
  formBannerTitle: { color: "#fff", fontSize: 14, fontWeight: "800" },
  formBannerText: { color: "#E9DDFC", fontSize: 11, lineHeight: 16, marginTop: 4 },
  fieldLabel: { color: "#443456", fontSize: 12, fontWeight: "800", marginTop: 8, marginBottom: 2 },
  optionalText: { color: "#8C8299", fontWeight: "500", fontSize: 10 },
  formatRow: { flexDirection: "row", gap: 9 },
  formatCard: { flex: 1, minHeight: 52, borderRadius: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EEE8F5", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  formatCardActive: { borderColor: "#8B5CF6", backgroundColor: "#F4EEFC" },
  formatText: { color: "#746A80", fontSize: 12, fontWeight: "700" },
  formatTextActive: { color: "#5B21B6" },
  input: { minHeight: 44, borderRadius: 13, paddingHorizontal: 12, backgroundColor: "#fff", borderWidth: 1, borderColor: "#EDE7F3", color: "#2A1D3E", fontSize: 13 },
  storyInput: { minHeight: 140, paddingTop: 12, lineHeight: 19 },
  formChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 7 },
  formChip: { borderRadius: 14, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: "#EEE8F5" },
  formChipActive: { backgroundColor: "#EFE8F8", borderColor: "#8B5CF6" },
  formChipText: { color: "#756980", fontSize: 10, fontWeight: "600" },
  formChipTextActive: { color: "#5B21B6", fontWeight: "800" },
  inlineFields: { flexDirection: "row", gap: 10 },
  inlineField: { flex: 1 },
  uploadBox: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderStyle: "dashed", borderColor: "#B8A7D0", backgroundColor: "#FBF9FD", flexDirection: "row", alignItems: "center", paddingHorizontal: 13, gap: 10 },
  uploadText: { color: "#665579", fontSize: 11, fontWeight: "600", flex: 1 },
  consentRow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginTop: 8, paddingRight: 4 },
  consentText: { color: "#685E74", fontSize: 11, lineHeight: 16, flex: 1 },
  formError: { color: "#B42318", fontSize: 12, lineHeight: 17, marginTop: 4 },
  draftButton: { minHeight: 42, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#F4EEFC", borderWidth: 1, borderColor: "#E3D7F2", marginTop: 8 },
  draftButtonText: { color: "#5B21B6", fontWeight: "800", fontSize: 12 },
  submitWide: { minHeight: 46, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#6D28D9", marginTop: 10 },
  submitWideText: { color: "#fff", fontWeight: "800", fontSize: 13 },
  disabled: { opacity: 0.6 },
  privacyNote: { color: "#75658E", fontSize: 10, textAlign: "center", marginTop: 7 },
  scrim: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(25, 16, 41, 0.38)" },
  commentSheet: { backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, minHeight: "58%", maxHeight: "88%", paddingHorizontal: 18, paddingTop: 10, paddingBottom: Platform.OS === "ios" ? 22 : 12 },
  sheetHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: "center", backgroundColor: "#DED7E8", marginBottom: 12 },
  sheetHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingBottom: 12, borderBottomWidth: 1, borderColor: "#F0EBF5" },
  commentList: { flex: 1, paddingVertical: 12 },
  commentItem: { paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: "#F3EFF6" },
  commentAuthor: { color: "#4F3A69", fontWeight: "800", fontSize: 12 },
  commentContent: { color: "#51475D", fontSize: 12, lineHeight: 18, marginTop: 4 },
  commentComposer: { flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 10 },
  commentInput: { flex: 1, minHeight: 42, borderRadius: 20, backgroundColor: "#F7F4FA", paddingHorizontal: 14, color: "#2A1D3E", fontSize: 12 },
  commentSend: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#6D28D9", alignItems: "center", justifyContent: "center" },
  moderationModal: { backgroundColor: "#fff", margin: 20, borderRadius: 20, padding: 18, gap: 10 },
  moderationDescription: { color: "#766A88", fontSize: 12 },
  reasonInput: { minHeight: 98, paddingTop: 12 },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", gap: 10 },
  cancelButton: { paddingHorizontal: 14, paddingVertical: 12 },
  cancelText: { color: "#6E637E", fontWeight: "700", fontSize: 12 },
  modalConfirm: { minWidth: 100, paddingHorizontal: 14, marginTop: 0 },
});
