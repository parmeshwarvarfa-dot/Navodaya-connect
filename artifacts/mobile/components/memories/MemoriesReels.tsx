import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Alert,
  Image,
  Modal,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { VideoView, useVideoPlayer } from "expo-video";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/lib/api";
import type { SocialMemory } from "@workspace/api-client-react";
import { ThemedText as Text } from "@/components/ThemedNative";

type Props = {
  memories: SocialMemory[];
  scope: "recommended" | "following" | "latest";
  onScopeChange: (scope: "recommended" | "following" | "latest") => void;
  onClose: () => void;
  isLoading: boolean;
  isError: boolean;
  isFetchingNextPage: boolean;
  onRetry: () => void;
  onLoadMore: () => void;
  autoplayVideos?: boolean;
  dataSaver?: boolean;
  onLike: (memory: SocialMemory) => void;
  onBookmark: (memory: SocialMemory) => void;
  onComments: (memory: SocialMemory) => void;
  onOpenProfile: (userId: string) => void;
  onReport: (memory: SocialMemory) => void;
  currentUserId?: string;
};

function ReelVideoPage({
  memory,
  active,
  autoplayVideos,
  onLike,
  onBookmark,
  onComments,
  onOpenProfile,
  onReport,
  currentUserId,
}: {
  memory: SocialMemory;
  active: boolean;
  autoplayVideos: boolean;
  onLike: (memory: SocialMemory) => void;
  onBookmark: (memory: SocialMemory) => void;
  onComments: (memory: SocialMemory) => void;
  onOpenProfile: (userId: string) => void;
  onReport: (memory: SocialMemory) => void;
  currentUserId?: string;
}) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followPending, setFollowPending] = useState(false);
  const [followStatusLoaded, setFollowStatusLoaded] = useState(false);
  const [followBusy, setFollowBusy] = useState(false);
  const uri = memory.mediaUrls?.[0] ?? "";
  const player = useVideoPlayer(active ? uri || null : null, (instance) => {
    instance.loop = true;
    instance.muted = false;
  });

  useEffect(() => {
    if (!uri) return;
    if (active && autoplayVideos) {
      player.play();
      setPlaying(true);
    } else {
      player.pause();
      setPlaying(false);
    }
  }, [active, autoplayVideos, player, uri]);

  useEffect(() => {
    let activeRequest = true;
    setFollowing(false);
    setFollowPending(false);
    setFollowStatusLoaded(false);
    if (!active || !memory.authorId || memory.authorId === currentUserId) return;
    api.users.socialStatus(memory.authorId)
      .then((status) => {
        if (!activeRequest) return;
        setFollowing(status.isFollowing);
        setFollowPending(status.followStatus === "pending");
        setFollowStatusLoaded(true);
      })
      .catch((error) => {
        if (activeRequest) Alert.alert("Follow status unavailable", error instanceof Error ? error.message : "Could not check this profile.");
      });
    return () => { activeRequest = false; };
  }, [active, currentUserId, memory.authorId]);

  const toggleFollow = async () => {
    if (!memory.authorId || followBusy) return;
    setFollowBusy(true);
    try {
      if (following || followPending) {
        await api.users.unfollow(memory.authorId);
        setFollowing(false);
        setFollowPending(false);
      } else {
        const result = await api.users.follow(memory.authorId);
        setFollowPending(result.followStatus === "pending");
        setFollowing(result.isFollowing);
      }
    } catch (error) {
      Alert.alert("Could not update follow", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setFollowBusy(false);
    }
  };

  return (
    <View style={[styles.viewerPage, { width, height }]}>
      {uri ? (
        <VideoView
          style={styles.viewerVideo}
          player={player}
          nativeControls={false}
          contentFit="cover"
          allowsFullscreen={false}
          allowsPictureInPicture={false}
        />
      ) : (
        <View style={styles.missingVideo}><Text style={styles.missingText}>This Reel’s video is unavailable.</Text></View>
      )}
      {uri ? (
        <TouchableOpacity
          style={StyleSheet.absoluteFill}
          activeOpacity={1}
          onPress={() => {
            if (playing) player.pause();
            else player.play();
            setPlaying(!playing);
          }}
          accessibilityRole="button"
          accessibilityLabel={playing ? "Pause Reel" : "Play Reel"}
        >
          {!playing ? <Ionicons style={styles.centerPlayIcon} name="play" size={52} color="#fff" /> : null}
        </TouchableOpacity>
      ) : null}
      <LinearGradient colors={["rgba(10,8,18,0.46)", "transparent", "rgba(10,8,18,0.72)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <TouchableOpacity
        style={[styles.soundButton, { top: insets.top + 58 }]}
        onPress={() => {
          const next = !muted;
          setMuted(next);
          player.muted = next;
        }}
        accessibilityLabel={muted ? "Unmute Reel" : "Mute Reel"}
      >
        <Ionicons name={muted ? "volume-mute" : "volume-high"} size={19} color="#fff" />
      </TouchableOpacity>
      <View style={[styles.reelInfo, { bottom: Math.max(insets.bottom, 16) + 22 }]}>
        <View style={styles.creatorLine}>
          <TouchableOpacity style={styles.reelCreator} onPress={() => memory.authorId && onOpenProfile(memory.authorId)} disabled={!memory.authorId}>
            {memory.authorPhotoUrl ? <Image source={{ uri: memory.authorPhotoUrl }} style={styles.reelAvatar} /> : null}
            <Text style={styles.reelCreatorName}>{memory.authorName || "JNV member"}</Text>
          </TouchableOpacity>
          {memory.authorId && memory.authorId !== currentUserId && followStatusLoaded ? (
            <TouchableOpacity style={styles.followButton} disabled={followBusy} onPress={() => void toggleFollow()}>
              <Text style={styles.followText}>{following ? "Following" : followPending ? "Requested" : "Follow"}</Text>
            </TouchableOpacity>
          ) : null}
        </View>
        <Text style={styles.reelCaption} numberOfLines={4}>{memory.caption}</Text>
        {!!memory.jnvName && <Text style={styles.reelJnv}>{memory.jnvName}</Text>}
      </View>
      <View style={[styles.reelActions, { bottom: Math.max(insets.bottom, 16) + 30 }]}>
        <TouchableOpacity onPress={() => onLike(memory)} style={styles.reelAction}>
          <Ionicons name={memory.liked ? "heart" : "heart-outline"} size={27} color={memory.liked ? "#FF5D83" : "#fff"} />
          <Text style={styles.reelActionText}>{memory.likes}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onComments(memory)} style={styles.reelAction}>
          <Ionicons name="chatbubble-ellipses-outline" size={25} color="#fff" />
          <Text style={styles.reelActionText}>{memory.commentsCount}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onBookmark(memory)} style={styles.reelAction}>
          <Ionicons name={memory.bookmarked ? "bookmark" : "bookmark-outline"} size={25} color="#fff" />
          <Text style={styles.reelActionText}>Save</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onReport(memory)} style={styles.reelAction}>
          <Ionicons name="flag-outline" size={23} color="#fff" />
          <Text style={styles.reelActionText}>Report</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MemoriesReels({
  memories,
  scope,
  onScopeChange,
  onClose,
  isLoading,
  isError,
  isFetchingNextPage,
  onRetry,
  onLoadMore,
  autoplayVideos = true,
  dataSaver = false,
  onLike,
  onBookmark,
  onComments,
  onOpenProfile,
  onReport,
  currentUserId,
}: Props) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [selectedIndex, setSelectedIndex] = useState(0);

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        {memories.length ? (
          <FlatList
            key={`reels-${scope}`}
            data={memories}
            initialScrollIndex={0}
            getItemLayout={(_, index) => ({ length: height, offset: height * index, index })}
            keyExtractor={(item) => item.id}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onEndReached={onLoadMore}
            onEndReachedThreshold={0.7}
            ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#fff" style={styles.pageLoading} /> : null}
            onMomentumScrollEnd={(event) => {
              setSelectedIndex(Math.round(event.nativeEvent.contentOffset.y / height));
            }}
            renderItem={({ item, index }) => (
              <ReelVideoPage
                memory={item}
                active={index === selectedIndex}
                autoplayVideos={autoplayVideos && !dataSaver}
                onLike={onLike}
                onBookmark={onBookmark}
                onComments={onComments}
                onOpenProfile={onOpenProfile}
                onReport={onReport}
                currentUserId={currentUserId}
              />
            )}
          />
        ) : (
          <View style={styles.emptyPage}>
            {isLoading ? (
              <>
                <ActivityIndicator color="#fff" />
                <Text style={styles.emptyTitle}>Loading Reels…</Text>
              </>
            ) : isError ? (
              <>
                <Ionicons name="cloud-offline-outline" size={38} color="#C4B5FD" />
                <Text style={styles.emptyTitle}>Reels could not load</Text>
                <Text style={styles.emptyMessage}>Check your connection and try again.</Text>
                <TouchableOpacity style={styles.retryButton} onPress={onRetry}><Text style={styles.retryText}>Try again</Text></TouchableOpacity>
              </>
            ) : (
              <>
                <Ionicons name="videocam-outline" size={42} color="#C4B5FD" />
                <Text style={styles.emptyTitle}>No Reels yet</Text>
                <Text style={styles.emptyMessage}>Video posts from your JNV community will appear here.</Text>
              </>
            )}
          </View>
        )}
        <View style={[styles.viewerTopBar, { top: insets.top + 8 }]}>
          <TouchableOpacity style={styles.viewerClose} onPress={onClose} accessibilityLabel="Close Reels">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.scopeRow}>
            {([
              ["recommended", "For you"],
              ["following", "Following"],
              ["latest", "Latest"],
            ] as const).map(([value, label]) => (
              <TouchableOpacity
                key={value}
                style={styles.scopeButton}
                onPress={() => {
                  if (scope !== value) {
                    setSelectedIndex(0);
                    onScopeChange(value);
                  }
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: scope === value }}
              >
                <Text style={[styles.scopeText, scope === value && styles.scopeTextActive]}>{label}</Text>
                {scope === value ? <View style={styles.scopeUnderline} /> : null}
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: "#0A0812" },
  viewerTopBar: { position: "absolute", left: 14, right: 14, zIndex: 5, minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  viewerClose: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(28,20,40,0.55)" },
  scopeRow: { flex: 1, flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 16 },
  scopeButton: { minHeight: 38, justifyContent: "center", alignItems: "center" },
  scopeText: { color: "rgba(255,255,255,0.68)", fontSize: 12, fontWeight: "600" },
  scopeTextActive: { color: "#fff", fontWeight: "800" },
  scopeUnderline: { position: "absolute", bottom: 0, width: 18, height: 2, borderRadius: 1, backgroundColor: "#fff" },
  viewerPage: { backgroundColor: "#0A0812", justifyContent: "center" },
  viewerVideo: { ...StyleSheet.absoluteFillObject },
  centerPlayIcon: { position: "absolute", alignSelf: "center", top: "46%", textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 8 },
  missingVideo: { flex: 1, alignItems: "center", justifyContent: "center" },
  missingText: { color: "#fff", fontSize: 14 },
  soundButton: { position: "absolute", right: 20, zIndex: 4, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(28,20,40,0.55)", alignItems: "center", justifyContent: "center" },
  reelInfo: { position: "absolute", left: 18, right: 78, bottom: 60 },
  reelCreator: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  creatorLine: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  reelAvatar: { width: 29, height: 29, borderRadius: 15 },
  reelCreatorName: { color: "#fff", fontSize: 13, fontWeight: "800" },
  followButton: { borderWidth: 1, borderColor: "rgba(255,255,255,0.82)", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  followText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  reelCaption: { color: "#fff", fontSize: 13, lineHeight: 19, textShadowColor: "rgba(0,0,0,0.5)", textShadowRadius: 4 },
  reelJnv: { color: "#E8DFF5", fontSize: 11, marginTop: 5 },
  reelActions: { position: "absolute", right: 18, bottom: 70, gap: 22, alignItems: "center" },
  reelAction: { alignItems: "center", gap: 4, minWidth: 42 },
  reelActionText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  emptyPage: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12, backgroundColor: "#0A0812" },
  emptyTitle: { color: "#fff", fontSize: 18, fontWeight: "800", textAlign: "center" },
  emptyMessage: { color: "#D1CBDD", fontSize: 13, textAlign: "center", lineHeight: 19 },
  retryButton: { backgroundColor: "#7C3AED", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10, marginTop: 4 },
  retryText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  pageLoading: { height: 90 },
});
