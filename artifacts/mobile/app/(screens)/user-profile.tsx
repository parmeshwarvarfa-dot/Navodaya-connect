import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { api, type PublicUserProfile } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import {
  getGetSocialStatusQueryKey,
  getListDirectConversationsQueryKey,
  useBlockUser,
  useCreateDirectMessageRequest,
  useFollowUser,
  useGetSocialStatus,
  useListDirectConversations,
  useUnfollowUser,
} from "@workspace/api-client-react";

const ROLE_LABELS: Record<string, string> = {
  student: "Student",
  alumni: "Alumni",
  teacher: "Teacher",
  official: "JNV Official",
};

function getInitials(name: string) {
  return name.split(" ").map((part) => part[0]).join("").toUpperCase().slice(0, 2);
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function UserProfileScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const { profile: currentUser } = useAuth();
  const params = useLocalSearchParams<{ userId?: string }>();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const [user, setUser] = useState<PublicUserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [messageOpen, setMessageOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [blockConfirmOpen, setBlockConfirmOpen] = useState(false);
  const topPad = Platform.OS === "web" ? 60 : insets.top;
  const isOwnProfile = !!user && (user.id === currentUser?.uid || user.id === (currentUser as any)?.id);

  const socialStatus = useGetSocialStatus(userId, {
    query: {
      queryKey: getGetSocialStatusQueryKey(userId),
      enabled: !!userId && !!user && !isOwnProfile,
    },
  });
  const conversations = useListDirectConversations({
    query: { queryKey: getListDirectConversationsQueryKey(), enabled: !!user && !isOwnProfile },
  });
  const refreshStatus = () => queryClient.invalidateQueries({ queryKey: getGetSocialStatusQueryKey(userId) });
  const follow = useFollowUser({ mutation: { onSuccess: refreshStatus } });
  const unfollow = useUnfollowUser({ mutation: { onSuccess: refreshStatus } });
  const block = useBlockUser();
  const sendRequest = useCreateDirectMessageRequest();

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2800);
  };

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setError("User profile not found.");
      setLoading(false);
      return;
    }
    setLoading(true);
    api.users.get(userId)
      .then((result) => { if (!cancelled) setUser(result); })
      .catch((reason) => { if (!cancelled) setError(getErrorMessage(reason, "Unable to load this profile.")); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId]);

  const status = socialStatus.data;
  const busy = follow.isPending || unfollow.isPending || block.isPending || sendRequest.isPending;
  const followLabel = status?.isFollowing
    ? "Following"
    : status?.followStatus === "pending"
      ? "Requested"
      : "Follow";

  const toggleFollow = async () => {
    if (!user) return;
    try {
      if (status?.isFollowing || status?.followStatus === "pending") {
        await unfollow.mutateAsync({ id: user.id });
        showToast(status?.followStatus === "pending" ? "Follow request cancelled." : "You unfollowed this profile.");
      } else {
        const result = await follow.mutateAsync({ id: user.id });
        showToast(result.followStatus === "pending" ? "Follow request sent." : "You are now following this profile.");
      }
    } catch (reason) {
      showToast(getErrorMessage(reason, "Could not update follow status."));
    }
  };

  const openMessage = () => {
    if (!user) return;
    const conversation = conversations.data?.find((item) => item.peerId === user.id);
    if (conversation) {
      router.push({ pathname: "/(screens)/social-inbox", params: { conversationId: conversation.id } } as any);
      return;
    }
    setMessageOpen(true);
  };

  const submitMessageRequest = async () => {
    if (!user || !message.trim()) return;
    try {
      await sendRequest.mutateAsync({ data: { recipientId: user.id, content: message.trim() } });
      setMessage("");
      setMessageOpen(false);
      showToast("Message request sent.");
    } catch (reason) {
      showToast(getErrorMessage(reason, "Could not send the message request."));
    }
  };

  const confirmBlock = async () => {
    if (!user) return;
    try {
      await block.mutateAsync({ id: user.id });
      setBlockConfirmOpen(false);
      showToast("Profile blocked.");
      setTimeout(() => router.back(), 500);
    } catch (reason) {
      setBlockConfirmOpen(false);
      showToast(getErrorMessage(reason, "Could not block this profile."));
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 36 }} />
      </View>

      {loading ? (
        <View style={styles.state}><ActivityIndicator color="#3D5AF1" /></View>
      ) : !user ? (
        <View style={styles.state}><Text style={styles.stateText}>{error || "User profile not found."}</Text></View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
          <View style={styles.profileCard}>
            {user.photoURL ? (
              <Image source={{ uri: user.photoURL }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatar}><Text style={styles.avatarText}>{getInitials(user.fullName || "N")}</Text></View>
            )}
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.fullName}</Text>
              <VerifiedBadge status={user.verificationStatus} role={user.role} size="sm" />
            </View>
            <Text style={styles.role}>{ROLE_LABELS[user.role] || user.role}</Text>
            <View style={styles.schoolRow}>
              <Ionicons name="school-outline" size={16} color="#6B7280" />
              <Text style={styles.schoolText}>{user.jnvName}{user.jnvState ? ` · ${user.jnvState}` : ""}</Text>
            </View>

            {user.isRestricted ? (
              <View style={styles.privateNote}>
                <Ionicons name="lock-closed-outline" size={17} color="#6D4AFF" />
                <Text style={styles.privateText}>This is a private profile. Follow to request access to profile details and Memories.</Text>
              </View>
            ) : (
              <>
                {(user.profession || user.subject || user.designation) ? (
                  <Text style={styles.detail}>{user.profession || user.designation || user.subject}{user.company ? ` · ${user.company}` : ""}</Text>
                ) : null}
                {user.class ? <Text style={styles.detail}>{user.class}</Text> : null}
                {user.passoutYear ? <Text style={styles.detail}>Batch {user.passoutYear}</Text> : null}
                {user.bio ? <Text style={styles.bio}>{user.bio}</Text> : null}
                {status?.followsYou ? (
                  <View style={styles.followsYou}><Text style={styles.followsYouText}>Follows you</Text></View>
                ) : null}
              </>
            )}
          </View>

          {!isOwnProfile ? (
            <>
              <View style={styles.actions}>
                <TouchableOpacity
                  style={[styles.primaryAction, status?.isFollowing && styles.followingAction, busy && { opacity: 0.6 }]}
                  onPress={toggleFollow}
                  disabled={busy || socialStatus.isLoading || status?.isBlocked}
                >
                  {socialStatus.isLoading ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Ionicons name={status?.isFollowing ? "checkmark" : status?.followStatus === "pending" ? "time-outline" : "person-add-outline"} size={17} color="#fff" />
                      <Text style={styles.primaryActionText}>{followLabel}</Text>
                    </>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.secondaryAction, busy && { opacity: 0.6 }]}
                  onPress={openMessage}
                  disabled={busy || status?.isBlocked || conversations.isLoading}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={17} color="#3D5AF1" />
                  <Text style={styles.secondaryActionText}>Message</Text>
                </TouchableOpacity>
              </View>

              {status?.isBlocked ? (
                <Text style={styles.blockedHint}>You blocked this profile. Unblock it in your privacy settings to interact.</Text>
              ) : (
                <View style={styles.safetyActions}>
                  <TouchableOpacity
                    style={styles.safetyButton}
                    onPress={() => router.push({ pathname: "/(screens)/report-user", params: { userId: user.id } } as any)}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="flag-outline" size={16} color="#6B7280" />
                    <Text style={styles.safetyText}>Report</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.safetyButton} onPress={() => setBlockConfirmOpen(true)} activeOpacity={0.75}>
                    <Ionicons name="ban-outline" size={16} color="#B42318" />
                    <Text style={[styles.safetyText, { color: "#B42318" }]}>Block</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          ) : null}
        </ScrollView>
      )}

      {toast ? <View style={[styles.toast, { top: topPad + 56 }]} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}

      <Modal visible={messageOpen} transparent animationType="fade" onRequestClose={() => setMessageOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Message {user?.fullName}</Text>
            <Text style={styles.modalHelp}>This starts as a message request. The conversation opens after they accept.</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={2000}
              placeholder="Write a respectful first message…"
              placeholderTextColor="#9CA3AF"
              textAlignVertical="top"
              style={styles.messageInput}
            />
            <Text style={styles.counter}>{message.length}/2000</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setMessageOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sendButton, (!message.trim() || sendRequest.isPending) && { opacity: 0.55 }]} onPress={submitMessageRequest} disabled={!message.trim() || sendRequest.isPending}>
                <Text style={styles.sendText}>{sendRequest.isPending ? "Sending…" : "Send request"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={blockConfirmOpen} transparent animationType="fade" onRequestClose={() => setBlockConfirmOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Block {user?.fullName}?</Text>
            <Text style={styles.modalHelp}>They won’t be able to follow, message, or interact with you. Existing access is removed.</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setBlockConfirmOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.blockConfirmButton, block.isPending && { opacity: 0.6 }]} onPress={confirmBlock} disabled={block.isPending}>
                <Text style={styles.sendText}>{block.isPending ? "Blocking…" : "Block profile"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  stateText: { color: "#6B7280", fontSize: 14, fontFamily: "Inter_500Medium", textAlign: "center" },
  profileCard: { alignItems: "center", backgroundColor: "#fff", borderRadius: 14, padding: 22, borderWidth: 1, borderColor: "#F0F0F0" },
  avatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  avatarImage: { width: 76, height: 76, borderRadius: 38, marginBottom: 12 },
  avatarText: { fontSize: 26, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, flexWrap: "wrap" },
  name: { color: "#111827", fontSize: 20, fontFamily: "Inter_700Bold", textAlign: "center" },
  role: { marginTop: 4, color: "#6B7280", fontSize: 14, fontFamily: "Inter_500Medium" },
  schoolRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 14 },
  schoolText: { color: "#4B5563", fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  detail: { marginTop: 7, color: "#6B7280", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  bio: { marginTop: 14, color: "#4B5563", fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, textAlign: "center" },
  privateNote: { flexDirection: "row", alignItems: "flex-start", gap: 8, padding: 12, marginTop: 18, borderRadius: 11, backgroundColor: "#F5F3FF" },
  privateText: { flex: 1, color: "#55409A", fontSize: 12, lineHeight: 18, fontFamily: "Inter_500Medium" },
  followsYou: { marginTop: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 15, backgroundColor: "#EEF2FF" },
  followsYouText: { color: "#3D5AF1", fontSize: 11, fontFamily: "Inter_600SemiBold" },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  primaryAction: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 11, backgroundColor: "#3D5AF1" },
  followingAction: { backgroundColor: "#6B7280" },
  primaryActionText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  secondaryAction: { flex: 1, minHeight: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 11, backgroundColor: "#fff", borderWidth: 1, borderColor: "#DCE2F0" },
  secondaryActionText: { color: "#3D5AF1", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  safetyActions: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 12 },
  safetyButton: { flexDirection: "row", alignItems: "center", gap: 6, padding: 10 },
  safetyText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#6B7280" },
  blockedHint: { textAlign: "center", marginTop: 12, color: "#6B7280", fontSize: 12, lineHeight: 18 },
  toast: { position: "absolute", left: 20, right: 20, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, backgroundColor: "#1F2937" },
  toastText: { color: "#fff", fontSize: 13, fontFamily: "Inter_500Medium", textAlign: "center" },
  modalOverlay: { flex: 1, justifyContent: "center", padding: 22, backgroundColor: "rgba(17,24,39,0.45)" },
  modalCard: { backgroundColor: "#fff", borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  modalHelp: { marginTop: 7, fontSize: 13, lineHeight: 19, color: "#6B7280", fontFamily: "Inter_400Regular" },
  messageInput: { minHeight: 120, marginTop: 14, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E5E7EB", fontSize: 14, color: "#111827" },
  counter: { textAlign: "right", marginTop: 5, fontSize: 11, color: "#9CA3AF" },
  modalActions: { flexDirection: "row", justifyContent: "flex-end", gap: 9, marginTop: 14 },
  cancelButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 15, borderRadius: 10, backgroundColor: "#F3F4F6" },
  cancelText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#4B5563" },
  sendButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#3D5AF1" },
  blockConfirmButton: { minHeight: 42, justifyContent: "center", paddingHorizontal: 16, borderRadius: 10, backgroundColor: "#B42318" },
  sendText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
});
