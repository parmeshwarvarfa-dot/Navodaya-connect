import React from "react";
import {
  Image,
  Linking,
  Modal,
  Share,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { SocialMemory } from "@workspace/api-client-react";
import MotionPressable from "@/components/motion/MotionPressable";
import { formatPublishDateTime } from "@/lib/date-formatting";
import { ThemedText as Text } from "@/components/ThemedNative";

type Props = {
  memory: SocialMemory;
  currentUserId?: string;
  actionPending?: boolean;
  onLike: (memory: SocialMemory) => void;
  onBookmark: (memory: SocialMemory) => void;
  onComments: (memory: SocialMemory) => void;
  onMore: (memory: SocialMemory) => void;
  onVote: (memory: SocialMemory, optionIndex: number) => void;
  onOpenProfile: (userId: string) => void;
  onMessage: (message: string) => void;
};

const TYPE_LABEL: Record<string, string> = {
  achievement: "Achievement",
  event: "Event",
  poll: "POLL",
};

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function MemoryPostCard({
  memory,
  currentUserId,
  actionPending = false,
  onLike,
  onBookmark,
  onComments,
  onMore,
  onVote,
  onOpenProfile,
  onMessage,
}: Props) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [mediaIndex, setMediaIndex] = useState(0);
  const { width, height } = useWindowDimensions();
  const mediaWidth = Math.max(220, Math.min(width - 68, 680));
  const mediaUrls = memory.mediaUrls ?? [];
  const totalVotes = (memory.pollVotes ?? []).reduce((sum, value) => sum + value, 0);
  const isOwner = memory.authorId === currentUserId;
  const isPollClosed = Boolean(
    memory.isPollClosed ||
    (memory.pollExpiresAt && new Date(memory.pollExpiresAt).getTime() <= Date.now()),
  );
  const showPollResults = memory.viewerVote !== undefined || isPollClosed;

  const share = async () => {
    try {
      const url = mediaUrls[0];
      await Share.share({
        message: [memory.caption, url].filter(Boolean).join("\n\n"),
        ...(url ? { url } : {}),
      });
    } catch {
      onMessage("Could not open the share sheet.");
    }
  };

  const openVideo = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch {
      onMessage("Could not open this video.");
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.avatar}
          onPress={() => memory.authorId && onOpenProfile(memory.authorId)}
          disabled={!memory.authorId}
          accessibilityLabel={`Open ${memory.authorName ?? "member"} profile`}
        >
          {memory.authorPhotoUrl ? (
            <Image source={{ uri: memory.authorPhotoUrl }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarInitial}>{(memory.authorName || "J").charAt(0).toUpperCase()}</Text>
          )}
        </TouchableOpacity>
        <View style={styles.headerText}>
          <TouchableOpacity onPress={() => memory.authorId && onOpenProfile(memory.authorId)} disabled={!memory.authorId}>
            <Text style={styles.authorName} numberOfLines={1}>{memory.authorName || "JNV member"}</Text>
          </TouchableOpacity>
          <Text style={styles.meta} numberOfLines={2}>
            {[memory.jnvName, formatPublishDateTime(memory.createdAt)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {memory.contentType === "navodayan_talk" || TYPE_LABEL[memory.postType] ? (
          <View style={[
            styles.typePill,
            memory.contentType === "navodayan_talk"
              ? styles.talkPill
              : memory.postType === "event"
                ? styles.eventPill
                : memory.postType === "achievement"
                  ? styles.achievementPill
                  : styles.pollPill,
          ]}>
            <Text style={styles.typePillText}>
              {memory.contentType === "navodayan_talk" ? "NAVODAYAN TALKS" : TYPE_LABEL[memory.postType]}
            </Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.moreButton} onPress={() => onMore(memory)} accessibilityLabel="Post options">
          <Ionicons name="ellipsis-horizontal" size={19} color="#69758B" />
        </TouchableOpacity>
      </View>

      {memory.talkTitle ? <Text style={styles.talkTitle}>{memory.talkTitle}</Text> : null}
      {memory.talkCategory ? <Text style={styles.talkCategory}>{memory.talkCategory}</Text> : null}
      {memory.caption ? <Text style={styles.caption}>{memory.caption}</Text> : null}

      {memory.postType === "poll" && memory.pollOptions?.length > 0 && (
        <View style={styles.poll}>
          {memory.pollOptions.map((option, index) => {
            const count = memory.pollVotes?.[index] ?? 0;
            const percentage = totalVotes ? Math.round((count / totalVotes) * 100) : 0;
            const chosen = memory.viewerVote === index;
            return (
              <TouchableOpacity
                key={`${memory.id}-${index}`}
                style={[styles.pollOption, chosen && styles.pollOptionChosen]}
                onPress={() => onVote(memory, index)}
                disabled={showPollResults || actionPending}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen, disabled: showPollResults || actionPending }}
              >
                <View style={[styles.pollFill, { width: `${percentage}%` }]} />
                <Text style={styles.pollOptionText}>{option}</Text>
                <Text style={styles.pollPercent}>{showPollResults ? `${percentage}%` : ""}</Text>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollTotal}>
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
            {isPollClosed ? " · Poll closed" : memory.pollExpiresAt ? ` · Ends ${formatDate(memory.pollExpiresAt)}` : ""}
          </Text>
        </View>
      )}

      {mediaUrls.length > 0 && (
        <View style={[styles.mediaCarousel, { width: mediaWidth }]}>
          {memory.postType === "video" ? (
            <TouchableOpacity style={styles.videoCard} onPress={() => openVideo(mediaUrls[0])} accessibilityLabel="Play video">
              <View style={styles.videoPlay}>
                <Ionicons name="play-circle" size={52} color="#fff" />
                <Text style={styles.videoText}>Tap to play video</Text>
              </View>
            </TouchableOpacity>
          ) : (
            <ScrollView
              horizontal
              pagingEnabled
              decelerationRate="fast"
              accessibilityLabel={`Photo carousel with ${mediaUrls.length} photos. Swipe to view more.`}
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(event) => setMediaIndex(Math.round(event.nativeEvent.contentOffset.x / mediaWidth))}
            >
              {mediaUrls.map((url, index) => (
                <TouchableOpacity
                  key={`${memory.id}-${index}`}
                  style={{ width: mediaWidth }}
                  onPress={() => setLightboxIndex(index)}
                  accessibilityLabel={`Open photo ${index + 1}`}
                >
                  <Image source={{ uri: url }} style={[styles.mediaImage, { width: mediaWidth }]} resizeMode="cover" />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
          {memory.postType !== "video" && mediaUrls.length > 1 ? (
            <>
              <View style={styles.mediaCount}><Text style={styles.mediaCountText}>{mediaIndex + 1}/{mediaUrls.length}</Text></View>
              <View style={styles.mediaPagination} accessibilityLabel={`Photo ${mediaIndex + 1} of ${mediaUrls.length}`}>
                {mediaUrls.map((_, index) => (
                  <View key={`${memory.id}-indicator-${index}`} style={[styles.mediaDot, index === mediaIndex && styles.mediaDotActive]} />
                ))}
              </View>
            </>
          ) : null}
        </View>
      )}

      <View style={styles.stats}>
        <View style={styles.statGroup}>
          <Ionicons name="heart" size={13} color="#E55367" />
          <Text style={styles.statText}>{memory.likes}</Text>
        </View>
        <TouchableOpacity onPress={() => onComments(memory)} disabled={!memory.commentsEnabled}>
          <Text style={styles.statText}>{memory.commentsCount} {memory.commentsCount === 1 ? "comment" : "comments"}</Text>
        </TouchableOpacity>
        {memory.visibility === "followers" && (
          <View style={styles.visibility}>
            <Ionicons name="people-outline" size={13} color="#65728A" />
            <Text style={styles.visibilityText}>Followers</Text>
          </View>
        )}
      </View>

      <View style={styles.actions}>
        <MotionPressable style={styles.action} onPress={() => onLike(memory)} disabled={actionPending} accessibilityLabel={memory.liked ? "Unlike post" : "Like post"}>
          <Ionicons name={memory.liked ? "heart" : "heart-outline"} size={19} color={memory.liked ? "#E55367" : "#65728A"} />
          <Text style={[styles.actionText, memory.liked && styles.actionActive]}>Like</Text>
        </MotionPressable>
        <TouchableOpacity style={styles.action} onPress={() => onComments(memory)} disabled={!memory.commentsEnabled}>
          <Ionicons name="chatbubble-outline" size={18} color="#65728A" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={share}>
          <Ionicons name="share-social-outline" size={18} color="#65728A" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
        <MotionPressable style={styles.action} onPress={() => onBookmark(memory)} disabled={actionPending} accessibilityLabel={memory.bookmarked ? "Remove bookmark" : "Bookmark post"}>
          <Ionicons name={memory.bookmarked ? "bookmark" : "bookmark-outline"} size={18} color={memory.bookmarked ? "#355BE5" : "#65728A"} />
          <Text style={[styles.actionText, memory.bookmarked && styles.bookmarkActive]}>Save</Text>
        </MotionPressable>
        {isOwner && <Ionicons name="lock-closed-outline" size={13} color="#8A95A8" style={styles.ownerIcon} />}
      </View>

      {memory.postType !== "video" && (
        <Modal visible={lightboxIndex !== null} transparent animationType="fade" onRequestClose={() => setLightboxIndex(null)}>
          <View style={styles.lightbox}>
            <TouchableOpacity style={styles.lightboxClose} onPress={() => setLightboxIndex(null)} accessibilityLabel="Close photo viewer">
              <Ionicons name="close" size={25} color="#fff" />
            </TouchableOpacity>
            {lightboxIndex !== null && mediaUrls[lightboxIndex] && (
              <Image source={{ uri: mediaUrls[lightboxIndex] }} style={{ width: width - 24, height: height - 100 }} resizeMode="contain" />
            )}
            {mediaUrls.length > 1 && lightboxIndex !== null && (
              <View style={styles.lightboxControls}>
                <TouchableOpacity
                  style={styles.lightboxArrow}
                  onPress={() => setLightboxIndex((lightboxIndex + mediaUrls.length - 1) % mediaUrls.length)}
                  accessibilityLabel="Previous photo"
                >
                  <Ionicons name="chevron-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.lightboxCount}>{lightboxIndex + 1} / {mediaUrls.length}</Text>
                <TouchableOpacity
                  style={styles.lightboxArrow}
                  onPress={() => setLightboxIndex((lightboxIndex + 1) % mediaUrls.length)}
                  accessibilityLabel="Next photo"
                >
                  <Ionicons name="chevron-forward" size={24} color="#fff" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 16,
    paddingTop: 13,
    paddingBottom: 8,
    marginTop: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#F0EBF5",
  },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: "#F5F3FF", borderWidth: 1.5, borderColor: "#7C3AED", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: "#7C3AED", fontSize: 16, fontFamily: "Inter_700Bold" },
  headerText: { flex: 1, minWidth: 0 },
  authorName: { color: "#1E1B4B", fontSize: 14, fontFamily: "Inter_700Bold" },
  meta: { color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  moreButton: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  typePill: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 4 },
  achievementPill: { backgroundColor: "#ECFDF5" },
  eventPill: { backgroundColor: "#FFFBEB" },
  pollPill: { backgroundColor: "#F5F3FF" },
  talkPill: { backgroundColor: "#EDE9FE" },
  typePillText: { color: "#7C3AED", fontSize: 10, fontFamily: "Inter_700Bold" },
  talkTitle: { color: "#211B45", fontSize: 17, lineHeight: 23, fontFamily: "Inter_700Bold", marginTop: 12 },
  talkCategory: { color: "#7C3AED", fontSize: 11, fontFamily: "Inter_600SemiBold", marginTop: 5 },
  caption: { color: "#1E1B4B", fontSize: 14, lineHeight: 22, fontFamily: "Inter_400Regular", marginTop: 12, marginBottom: 12 },
  mediaCarousel: { alignSelf: "center", position: "relative", overflow: "hidden", borderRadius: 14, marginTop: 3, backgroundColor: "#EDE9FE" },
  mediaImage: { height: 300, backgroundColor: "#EDE9FE" },
  videoCard: { width: "100%", height: 240, backgroundColor: "#1E1B4B", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  videoPlay: { alignItems: "center", justifyContent: "center", backgroundColor: "#211B45", ...StyleSheet.absoluteFillObject },
  videoText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  mediaCount: { position: "absolute", top: 10, right: 10, borderRadius: 14, paddingHorizontal: 9, paddingVertical: 5, backgroundColor: "rgba(28,22,44,0.68)" },
  mediaCountText: { color: "#fff", fontSize: 10, fontFamily: "Inter_700Bold" },
  mediaPagination: { position: "absolute", bottom: 10, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 9, paddingVertical: 7, borderRadius: 14, backgroundColor: "rgba(28,22,44,0.62)" },
  mediaDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.66)" },
  mediaDotActive: { width: 15, backgroundColor: "#FFFFFF" },
  poll: { gap: 8, marginTop: 10, marginBottom: 10 },
  pollOption: { minHeight: 44, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.8)", backgroundColor: "#FFFFFF" },
  pollOptionChosen: { borderColor: "#7C3AED", backgroundColor: "#F5F3FF" },
  pollFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#EDE9FE" },
  pollOptionText: { flex: 1, color: "#1E1B4B", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pollPercent: { color: "#6D28D9", fontSize: 12, fontFamily: "Inter_700Bold" },
  pollTotal: { color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular" },
  stats: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 10 },
  statGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: "#64748B", fontSize: 11, fontFamily: "Inter_400Regular" },
  visibility: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  visibilityText: { color: "#64748B", fontSize: 10, fontFamily: "Inter_500Medium" },
  actions: { minHeight: 44, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "rgba(233, 213, 255, 0.6)" },
  action: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 10 },
  actionText: { color: "#64748B", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actionActive: { color: "#EF4444" },
  bookmarkActive: { color: "#7C3AED" },
  ownerIcon: { marginLeft: 1, marginTop: 8 },
  lightbox: { flex: 1, backgroundColor: "rgba(15, 12, 35, 0.98)", alignItems: "center", justifyContent: "center" },
  lightboxClose: { position: "absolute", zIndex: 2, top: 44, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  lightboxControls: { position: "absolute", bottom: 30, left: 25, right: 25, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lightboxArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  lightboxCount: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
