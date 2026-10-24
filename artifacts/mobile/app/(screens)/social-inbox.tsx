import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
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
import {
  getListDirectConversationsQueryKey,
  getListDirectMessageRequestsQueryKey,
  getListDirectMessagesQueryKey,
  getListFollowRequestsQueryKey,
  getListSocialNotificationsQueryKey,
  useCreateDirectMessage,
  useDecideDirectMessageRequest,
  useDecideFollowRequest,
  useListDirectConversations,
  useListDirectMessageRequests,
  useListDirectMessages,
  useListFollowRequests,
  useListSocialNotifications,
} from "@workspace/api-client-react";

type InboxTab = "messages" | "message_requests" | "follow_requests" | "activity";

const TABS: { id: InboxTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: "messages", label: "Chats", icon: "chatbubbles-outline" },
  { id: "message_requests", label: "Messages", icon: "mail-outline" },
  { id: "follow_requests", label: "Follows", icon: "person-add-outline" },
  { id: "activity", label: "Activity", icon: "notifications-outline" },
];

function errorText(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Please try again.";
}

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function SocialInboxScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ conversationId?: string }>();
  const conversationParam = typeof params.conversationId === "string" ? params.conversationId : "";
  const [activeTab, setActiveTab] = useState<InboxTab>("messages");
  const [conversationId, setConversationId] = useState(conversationParam);
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  useEffect(() => {
    if (conversationParam) {
      setConversationId(conversationParam);
      setActiveTab("messages");
    }
  }, [conversationParam]);

  const conversations = useListDirectConversations({
    query: { queryKey: getListDirectConversationsQueryKey() },
  });
  const requests = useListDirectMessageRequests({
    query: { queryKey: getListDirectMessageRequestsQueryKey() },
  });
  const followRequests = useListFollowRequests({
    query: { queryKey: getListFollowRequestsQueryKey() },
  });
  const notifications = useListSocialNotifications({
    query: { queryKey: getListSocialNotificationsQueryKey() },
  });
  const messages = useListDirectMessages(conversationId, {
    query: {
      queryKey: getListDirectMessagesQueryKey(conversationId),
      enabled: !!conversationId,
      refetchInterval: 12000,
    },
  });

  const decideMessageRequest = useDecideDirectMessageRequest({
    mutation: {
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListDirectMessageRequestsQueryKey() }),
          queryClient.invalidateQueries({ queryKey: getListDirectConversationsQueryKey() }),
        ]);
      },
    },
  });
  const decideFollowRequest = useDecideFollowRequest({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListFollowRequestsQueryKey() }),
    },
  });
  const sendMessage = useCreateDirectMessage({
    mutation: {
      onSuccess: async () => {
        setDraft("");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: getListDirectMessagesQueryKey(conversationId) }),
          queryClient.invalidateQueries({ queryKey: getListDirectConversationsQueryKey() }),
        ]);
      },
    },
  });

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(""), 2800);
  };
  const refresh = () => {
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: getListDirectConversationsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListDirectMessageRequestsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListFollowRequestsQueryKey() }),
      queryClient.invalidateQueries({ queryKey: getListSocialNotificationsQueryKey() }),
      ...(conversationId ? [queryClient.invalidateQueries({ queryKey: getListDirectMessagesQueryKey(conversationId) })] : []),
    ]);
  };

  const currentConversation = conversations.data?.find((item) => item.id === conversationId);
  const submitMessage = async () => {
    if (!conversationId || !draft.trim()) return;
    try {
      await sendMessage.mutateAsync({ id: conversationId, data: { content: draft.trim() } });
    } catch (error) {
      showToast(errorText(error));
    }
  };
  const decideMessage = async (id: string, decision: "accept" | "decline") => {
    try {
      await decideMessageRequest.mutateAsync({ id, data: { decision } });
      showToast(decision === "accept" ? "Request accepted. Conversation is ready." : "Request declined.");
    } catch (error) {
      showToast(errorText(error));
    }
  };
  const decideFollow = async (id: string, decision: "accept" | "decline") => {
    try {
      await decideFollowRequest.mutateAsync({ id, data: { decision } });
      showToast(decision === "accept" ? "Follow request accepted." : "Follow request declined.");
    } catch (error) {
      showToast(errorText(error));
    }
  };

  const isLoading = activeTab === "messages"
    ? conversations.isLoading
    : activeTab === "message_requests"
      ? requests.isLoading
      : activeTab === "follow_requests"
        ? followRequests.isLoading
        : notifications.isLoading;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => conversationId ? setConversationId("") : router.back()}>
          <Ionicons name={conversationId ? "chevron-back" : "arrow-back"} size={22} color="#111827" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{conversationId ? currentConversation?.peerName || "Conversation" : "Social inbox"}</Text>
          {conversationId ? <Text style={styles.headerSubtitle}>Direct messages</Text> : null}
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
          <Ionicons name="refresh-outline" size={19} color="#3D5AF1" />
        </TouchableOpacity>
      </View>

      {conversationId ? (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={Platform.OS === "ios" ? 12 : 0}>
          <ScrollView
            key={conversationId}
            style={{ flex: 1 }}
            contentContainerStyle={styles.messageList}
            ref={(ref) => ref?.scrollToEnd({ animated: false })}
          >
            {messages.isLoading ? <ActivityIndicator color="#3D5AF1" style={{ marginTop: 20 }} /> : null}
            {messages.isError ? <Text style={styles.empty}>Messages couldn’t be loaded. Pull refresh to try again.</Text> : null}
            {!messages.isLoading && !messages.isError && !messages.data?.length ? (
              <Text style={styles.empty}>No messages here yet. Say hello to continue the conversation.</Text>
            ) : null}
            {messages.data?.map((message) => (
              <View key={message.id} style={styles.messageBubble}>
                <Text style={styles.messageBody}>{message.content}</Text>
                <Text style={styles.messageTime}>{timeLabel(message.createdAt)}</Text>
              </View>
            ))}
          </ScrollView>
          <View style={[styles.composerRow, { paddingBottom: Math.max(insets.bottom, 8) }]}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Write a message…"
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={2000}
              style={styles.composerInput}
            />
            <TouchableOpacity
              style={[styles.sendButton, (!draft.trim() || sendMessage.isPending) && { opacity: 0.5 }]}
              onPress={submitMessage}
              disabled={!draft.trim() || sendMessage.isPending}
            >
              {sendMessage.isPending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={17} color="#fff" />}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      ) : (
        <>
          <View style={styles.tabs}>
            {TABS.map((tab) => (
              <TouchableOpacity key={tab.id} style={styles.tab} onPress={() => setActiveTab(tab.id)}>
                <Ionicons name={tab.icon} size={17} color={activeTab === tab.id ? "#3D5AF1" : "#8992A1"} />
                <Text style={[styles.tabText, activeTab === tab.id && styles.tabTextActive]}>{tab.label}</Text>
                {tab.id === "message_requests" && (requests.data?.length ?? 0) > 0 ? (
                  <View style={styles.countBadge}><Text style={styles.countText}>{requests.data?.length}</Text></View>
                ) : tab.id === "follow_requests" && (followRequests.data?.length ?? 0) > 0 ? (
                  <View style={styles.countBadge}><Text style={styles.countText}>{followRequests.data?.length}</Text></View>
                ) : null}
              </TouchableOpacity>
            ))}
          </View>
          <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: insets.bottom + 32 }}>
            {isLoading ? <ActivityIndicator color="#3D5AF1" style={{ paddingVertical: 28 }} /> : null}
            {activeTab === "messages" && !conversations.isLoading && (
              conversations.isError ? <Text style={styles.empty}>Conversations couldn’t be loaded. Try refreshing.</Text>
                : !conversations.data?.length ? <Text style={styles.empty}>No direct conversations yet. Visit a profile to send a message request.</Text>
                  : conversations.data.map((item) => (
                    <TouchableOpacity key={item.id} style={styles.row} onPress={() => setConversationId(item.id)} activeOpacity={0.75}>
                      {item.peerPhotoUrl ? <Image source={{ uri: item.peerPhotoUrl }} style={styles.avatar} /> : (
                        <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{item.peerName.slice(0, 1).toUpperCase()}</Text></View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{item.peerName}</Text>
                        <Text style={styles.rowSubtitle} numberOfLines={1}>{item.lastMessage || "Start a conversation"}</Text>
                      </View>
                      <Text style={styles.rowDate}>{timeLabel(item.updatedAt)}</Text>
                    </TouchableOpacity>
                  ))
            )}
            {activeTab === "message_requests" && !requests.isLoading && (
              requests.isError ? <Text style={styles.empty}>Message requests couldn’t be loaded. Try refreshing.</Text>
                : !requests.data?.length ? <Text style={styles.empty}>No pending message requests.</Text>
                  : requests.data.map((item) => (
                    <View key={item.id} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{item.senderName.slice(0, 1).toUpperCase()}</Text></View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowTitle}>{item.senderName}</Text>
                          <Text style={styles.rowDate}>{timeLabel(item.createdAt)}</Text>
                        </View>
                      </View>
                      <Text style={styles.requestMessage}>{item.content}</Text>
                      <View style={styles.requestActions}>
                        <TouchableOpacity style={styles.acceptButton} onPress={() => decideMessage(item.id, "accept")} disabled={decideMessageRequest.isPending}>
                          <Text style={styles.acceptText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.declineButton} onPress={() => decideMessage(item.id, "decline")} disabled={decideMessageRequest.isPending}>
                          <Text style={styles.declineText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
            )}
            {activeTab === "follow_requests" && !followRequests.isLoading && (
              followRequests.isError ? <Text style={styles.empty}>Follow requests couldn’t be loaded. Try refreshing.</Text>
                : !followRequests.data?.length ? <Text style={styles.empty}>No pending follow requests.</Text>
                  : followRequests.data.map((item) => (
                    <View key={item.id} style={styles.row}>
                      {item.followerPhotoUrl ? <Image source={{ uri: item.followerPhotoUrl }} style={styles.avatar} /> : (
                        <View style={styles.avatarFallback}><Text style={styles.avatarInitial}>{item.followerName.slice(0, 1).toUpperCase()}</Text></View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{item.followerName}</Text>
                        <Text style={styles.rowSubtitle}>Requested to follow you</Text>
                      </View>
                      <View style={styles.followActions}>
                        <TouchableOpacity style={styles.smallAccept} onPress={() => decideFollow(item.id, "accept")} disabled={decideFollowRequest.isPending}>
                          <Ionicons name="checkmark" size={17} color="#fff" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.smallDecline} onPress={() => decideFollow(item.id, "decline")} disabled={decideFollowRequest.isPending}>
                          <Ionicons name="close" size={17} color="#4B5563" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  ))
            )}
            {activeTab === "activity" && !notifications.isLoading && (
              notifications.isError ? <Text style={styles.empty}>Activity couldn’t be loaded. Try refreshing.</Text>
                : !notifications.data?.length ? <Text style={styles.empty}>No social activity yet.</Text>
                  : notifications.data.map((item) => (
                    <View key={item.id} style={styles.activityRow}>
                      <View style={styles.activityIcon}><Ionicons name="notifications-outline" size={17} color="#3D5AF1" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{item.actorName}</Text>
                        <Text style={styles.rowSubtitle}>{item.message}</Text>
                      </View>
                      <Text style={styles.rowDate}>{timeLabel(item.createdAt)}</Text>
                    </View>
                  ))
            )}
          </ScrollView>
        </>
      )}

      {toast ? <View style={[styles.toast, { top: topPad + 57 }]} pointerEvents="none"><Text style={styles.toastText}>{toast}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F3F4F6" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  headerSubtitle: { color: "#8B93A1", fontSize: 11, marginTop: 2 },
  refreshButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#EEF2FF" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EAECEF", paddingHorizontal: 5 },
  tab: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 10, color: "#8992A1", fontFamily: "Inter_500Medium" },
  tabTextActive: { color: "#3D5AF1", fontFamily: "Inter_600SemiBold" },
  countBadge: { minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  countText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  empty: { textAlign: "center", color: "#7B8492", fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", paddingVertical: 26, paddingHorizontal: 18, backgroundColor: "#fff", borderRadius: 13, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#F0F0F0", padding: 12, marginBottom: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EEF2FF" },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#3D5AF1", fontSize: 17, fontFamily: "Inter_700Bold" },
  rowTitle: { color: "#111827", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowSubtitle: { color: "#737B89", fontSize: 11, marginTop: 4, fontFamily: "Inter_400Regular" },
  rowDate: { color: "#9CA3AF", fontSize: 10, fontFamily: "Inter_400Regular" },
  requestCard: { backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#F0F0F0", padding: 13, marginBottom: 9 },
  requestHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  requestMessage: { color: "#4B5563", fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 13 },
  requestActions: { flexDirection: "row", gap: 9 },
  acceptButton: { flex: 1, height: 38, borderRadius: 9, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  acceptText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  declineButton: { flex: 1, height: 38, borderRadius: 9, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  declineText: { color: "#4B5563", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  followActions: { flexDirection: "row", gap: 6 },
  smallAccept: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  smallDecline: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#fff", marginBottom: 8 },
  activityIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  messageList: { flexGrow: 1, padding: 15, gap: 8, justifyContent: "flex-end" },
  messageBubble: { alignSelf: "flex-start", maxWidth: "88%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E8EBF0", borderRadius: 14, borderBottomLeftRadius: 4, paddingHorizontal: 12, paddingVertical: 9 },
  messageBody: { color: "#1F2937", fontSize: 14, lineHeight: 20 },
  messageTime: { marginTop: 4, textAlign: "right", color: "#9CA3AF", fontSize: 9 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 9, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  composerInput: { flex: 1, maxHeight: 100, minHeight: 42, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 18, backgroundColor: "#F3F4F6", fontSize: 14, color: "#111827" },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#3D5AF1" },
  toast: { position: "absolute", left: 20, right: 20, padding: 12, borderRadius: 12, backgroundColor: "#1F2937" },
  toastText: { color: "#fff", fontSize: 13, textAlign: "center", fontFamily: "Inter_500Medium" },
});
