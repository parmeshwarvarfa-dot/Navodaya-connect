import React from "react";
import {
  Image,
  Linking,
  Modal,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import type { SocialMemory } from "@workspace/api-client-react";

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
  poll: "Poll",
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
  const { width, height } = useWindowDimensions();
  const mediaUrls = memory.mediaUrls ?? [];
  const totalVotes = (memory.pollVotes ?? []).reduce((sum, value) => sum + value, 0);
  const isOwner = memory.authorId === currentUserId;

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
          <Text style={styles.meta} numberOfLines={1}>
            {[memory.jnvName, formatDate(memory.createdAt)].filter(Boolean).join(" · ")}
          </Text>
        </View>
        {TYPE_LABEL[memory.postType] ? (
          <View style={[styles.typePill, memory.postType === "event" ? styles.eventPill : memory.postType === "achievement" ? styles.achievementPill : styles.pollPill]}>
            <Text style={styles.typePillText}>{TYPE_LABEL[memory.postType]}</Text>
          </View>
        ) : null}
        <TouchableOpacity style={styles.moreButton} onPress={() => onMore(memory)} accessibilityLabel="Post options">
          <Ionicons name="ellipsis-horizontal" size={19} color="#69758B" />
        </TouchableOpacity>
      </View>

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
                disabled={memory.viewerVote !== undefined || actionPending}
                accessibilityRole="button"
                accessibilityState={{ selected: chosen, disabled: memory.viewerVote !== undefined || actionPending }}
              >
                <View style={[styles.pollFill, { width: `${percentage}%` }]} />
                <Text style={styles.pollOptionText}>{option}</Text>
                <Text style={styles.pollPercent}>{memory.viewerVote !== undefined ? `${percentage}%` : ""}</Text>
              </TouchableOpacity>
            );
          })}
          <Text style={styles.pollTotal}>{totalVotes} {totalVotes === 1 ? "vote" : "votes"}</Text>
        </View>
      )}

      {mediaUrls.length > 0 && (
        <View style={styles.mediaGrid}>
          {mediaUrls.slice(0, 4).map((url, index) => (
            memory.postType === "video" ? (
              <TouchableOpacity key={`${memory.id}-${index}`} style={styles.videoCard} onPress={() => openVideo(url)}>
                <Ionicons name="play-circle" size={50} color="#fff" />
                <Text style={styles.videoText}>Tap to play video</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                key={`${memory.id}-${index}`}
                style={[styles.mediaImageTouch, mediaUrls.length === 1 && styles.singleImageTouch]}
                onPress={() => setLightboxIndex(index)}
                accessibilityLabel={`Open photo ${index + 1}`}
              >
                <Image
                  source={{ uri: url }}
                  style={styles.mediaImage}
                  resizeMode="cover"
                />
              </TouchableOpacity>
            )
          ))}
          {mediaUrls.length > 4 && (
            <TouchableOpacity style={styles.moreMedia} onPress={() => setLightboxIndex(3)} accessibilityLabel={`View ${mediaUrls.length - 3} more photos`}>
              <Text style={styles.moreMediaText}>+{mediaUrls.length - 4}</Text>
            </TouchableOpacity>
          )}
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
        <TouchableOpacity style={styles.action} onPress={() => onLike(memory)} disabled={actionPending} accessibilityLabel={memory.liked ? "Unlike post" : "Like post"}>
          <Ionicons name={memory.liked ? "heart" : "heart-outline"} size={19} color={memory.liked ? "#E55367" : "#65728A"} />
          <Text style={[styles.actionText, memory.liked && styles.actionActive]}>Like</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => onComments(memory)} disabled={!memory.commentsEnabled}>
          <Ionicons name="chatbubble-outline" size={18} color="#65728A" />
          <Text style={styles.actionText}>Comment</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={() => onBookmark(memory)} disabled={actionPending} accessibilityLabel={memory.bookmarked ? "Remove bookmark" : "Bookmark post"}>
          <Ionicons name={memory.bookmarked ? "bookmark" : "bookmark-outline"} size={18} color={memory.bookmarked ? "#355BE5" : "#65728A"} />
          <Text style={[styles.actionText, memory.bookmarked && styles.bookmarkActive]}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.action} onPress={share}>
          <Ionicons name="share-social-outline" size={18} color="#65728A" />
          <Text style={styles.actionText}>Share</Text>
        </TouchableOpacity>
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
  card: { backgroundColor: "#fff", borderRadius: 16, padding: 15, marginHorizontal: 14, marginTop: 12, borderWidth: 1, borderColor: "#E8ECF3" },
  header: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: { width: 41, height: 41, borderRadius: 21, backgroundColor: "#E8EDFF", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  avatarImage: { width: "100%", height: "100%" },
  avatarInitial: { color: "#355BE5", fontSize: 16, fontFamily: "Inter_700Bold" },
  headerText: { flex: 1, minWidth: 0 },
  authorName: { color: "#192238", fontSize: 13, fontFamily: "Inter_700Bold" },
  meta: { color: "#8B96A9", fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 3 },
  moreButton: { width: 30, height: 32, alignItems: "center", justifyContent: "center" },
  typePill: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 5 },
  achievementPill: { backgroundColor: "#EBF8F0" },
  eventPill: { backgroundColor: "#FFF4E5" },
  pollPill: { backgroundColor: "#EEF1FF" },
  typePillText: { color: "#46546D", fontSize: 10, fontFamily: "Inter_700Bold" },
  caption: { color: "#2D384E", fontSize: 14, lineHeight: 21, fontFamily: "Inter_400Regular", marginTop: 13, marginBottom: 12 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, overflow: "hidden", borderRadius: 12, marginTop: 3 },
  mediaImageTouch: { width: "49%", height: 158 },
  singleImageTouch: { width: "100%", height: 250 },
  mediaImage: { width: "100%", height: "100%", borderRadius: 8, backgroundColor: "#E9EDF4" },
  videoCard: { width: "100%", height: 210, backgroundColor: "#243656", alignItems: "center", justifyContent: "center", gap: 6 },
  videoText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  moreMedia: { position: "absolute", right: 0, bottom: 0, width: "49%", height: 158, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(15,24,43,0.58)" },
  moreMediaText: { color: "#fff", fontSize: 23, fontFamily: "Inter_700Bold" },
  poll: { gap: 8, marginTop: 10, marginBottom: 10 },
  pollOption: { minHeight: 44, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: "#DDE3ED", backgroundColor: "#FAFBFD" },
  pollOptionChosen: { borderColor: "#98A9ED", backgroundColor: "#F5F7FF" },
  pollFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "#E9EDFF" },
  pollOptionText: { flex: 1, color: "#2E3A51", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  pollPercent: { color: "#54617A", fontSize: 12, fontFamily: "Inter_700Bold" },
  pollTotal: { color: "#8B96A9", fontSize: 11, fontFamily: "Inter_400Regular" },
  stats: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 10, paddingBottom: 9 },
  statGroup: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { color: "#8792A5", fontSize: 11, fontFamily: "Inter_400Regular" },
  visibility: { flexDirection: "row", alignItems: "center", gap: 4, marginLeft: "auto" },
  visibilityText: { color: "#65728A", fontSize: 10, fontFamily: "Inter_500Medium" },
  actions: { minHeight: 42, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: "#F0F2F6" },
  action: { flexDirection: "row", alignItems: "center", gap: 5, paddingTop: 9 },
  actionText: { color: "#65728A", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  actionActive: { color: "#E55367" },
  bookmarkActive: { color: "#355BE5" },
  ownerIcon: { marginLeft: 1, marginTop: 8 },
  lightbox: { flex: 1, backgroundColor: "rgba(8,12,22,0.97)", alignItems: "center", justifyContent: "center" },
  lightboxClose: { position: "absolute", zIndex: 2, top: 42, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.14)", alignItems: "center", justifyContent: "center" },
  lightboxControls: { position: "absolute", bottom: 30, left: 25, right: 25, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  lightboxArrow: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center" },
  lightboxCount: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
