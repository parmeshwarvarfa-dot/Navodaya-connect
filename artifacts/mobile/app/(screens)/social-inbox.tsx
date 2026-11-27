import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
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
import type { SocialNotification } from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { getNotificationRoute } from "@/lib/notification-navigation";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

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
  const params = useLocalSearchParams<{ conversationId?: string; tab?: string }>();
  const conversationParam = typeof params.conversationId === "string" ? params.conversationId : "";
  const requestedTab = typeof params.tab === "string" && TABS.some((tab) => tab.id === params.tab) ? params.tab as InboxTab : "";
  const [activeTab, setActiveTab] = useState<InboxTab>(requestedTab || "messages");
  const [conversationId, setConversationId] = useState("");
  const [draft, setDraft] = useState("");
  const [toast, setToast] = useState("");
  const redirectedConversation = useRef("");
  const topPad = Platform.OS === "web" ? 0 : insets.top;

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
    query: { queryKey: getListSocialNotificationsQueryKey(), refetchInterval: 15_000 },
  });
  const messages = useListDirectMessages(conversationId, {
    query: {
      queryKey: getListDirectMessagesQueryKey(conversationId),
      enabled: !!conversationId,
      refetchInterval: 12000,
    },
  });

  useEffect(() => {
    if (conversationParam) {
      if (conversations.isLoading || redirectedConversation.current === conversationParam) return;
      const conversation = conversations.data?.find((item) => item.id === conversationParam);
      redirectedConversation.current = conversationParam;
      router.replace({
        pathname: "/(screens)/direct-chat",
        params: {
          id: conversationParam,
          name: conversation?.peerName || "Conversation",
          peerId: conversation?.peerId || "",
          photoURL: conversation?.peerPhotoUrl || "",
        },
      } as any);
      return;
    }
    redirectedConversation.current = "";
    if (requestedTab) setActiveTab(requestedTab);
  }, [conversationParam, requestedTab, conversations.isLoading, conversations.data]);

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

  const openActivity = (item: SocialNotification) => {
    router.push(getNotificationRoute(item) as any);
    if (!item.readAt) {
      void api.notifications.markRead(item.id).then(() => {
        queryClient.invalidateQueries({ queryKey: getListSocialNotificationsQueryKey() });
      }).catch(() => {
        queryClient.invalidateQueries({ queryKey: getListSocialNotificationsQueryKey() });
      });
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
          <Ionicons name={conversationId ? "chevron-back" : "arrow-back"} size={22} color="#FFFFFF" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>{conversationId ? currentConversation?.peerName || "Conversation" : "Social inbox"}</Text>
          {conversationId ? <Text style={styles.headerSubtitle}>Direct messages</Text> : null}
        </View>
        <TouchableOpacity style={styles.refreshButton} onPress={refresh}>
          <Ionicons name="refresh-outline" size={19} color="#FFFFFF" />
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
            {messages.isLoading ? <ActivityIndicator color="#7C3AED" style={{ marginTop: 20 }} /> : null}
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
                <Ionicons name={tab.icon} size={17} color={activeTab === tab.id ? "#7C3AED" : "#8992A1"} />
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
            {isLoading ? <ActivityIndicator color="#7C3AED" style={{ paddingVertical: 28 }} /> : null}
            {activeTab === "messages" && !conversations.isLoading && (
              conversations.isError ? <Text style={styles.empty}>Conversations couldn’t be loaded. Try refreshing.</Text>
                : !conversations.data?.length ? <Text style={styles.empty}>No direct conversations yet. Visit a profile to send a message request.</Text>
                  : conversations.data.map((item) => (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.row}
                      onPress={() => router.push({
                        pathname: "/(screens)/direct-chat",
                        params: { id: item.id, name: item.peerName, peerId: item.peerId, photoURL: item.peerPhotoUrl || "" },
                      } as any)}
                      activeOpacity={0.75}
                    >
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
                    <TouchableOpacity key={item.id} style={[styles.activityRow, !item.readAt && styles.activityUnread]} activeOpacity={0.8} onPress={() => openActivity(item)} accessibilityRole="button" accessibilityLabel={`${item.actorName}. ${item.message}`}>
                      <View style={styles.activityIcon}><Ionicons name="notifications-outline" size={17} color="#7C3AED" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.rowTitle}>{item.actorName}</Text>
                        <Text style={styles.rowSubtitle}>{item.message}</Text>
                      </View>
                      <Text style={styles.rowDate}>{timeLabel(item.createdAt)}</Text>
                      {!item.readAt ? <View style={styles.unreadDot} /> : null}
                      <Ionicons name="chevron-forward" size={15} color="#A0A8B6" />
                    </TouchableOpacity>
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
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, backgroundColor: "#7C3AED", borderBottomWidth: 1, borderBottomColor: "#6D28D9" },
  backButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  headerTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#FFFFFF" },
  headerSubtitle: { color: "rgba(255,255,255,0.78)", fontSize: 11, marginTop: 2 },
  refreshButton: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,255,255,0.16)" },
  tabs: { flexDirection: "row", backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#EAECEF", paddingHorizontal: 5 },
  tab: { flex: 1, minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabText: { fontSize: 10, color: "#8992A1", fontFamily: "Inter_500Medium" },
  tabTextActive: { color: "#7C3AED", fontFamily: "Inter_600SemiBold" },
  countBadge: { minWidth: 17, height: 17, paddingHorizontal: 4, borderRadius: 9, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  countText: { color: "#fff", fontSize: 9, fontFamily: "Inter_700Bold" },
  empty: { textAlign: "center", color: "#7B8492", fontSize: 13, lineHeight: 20, fontFamily: "Inter_400Regular", paddingVertical: 26, paddingHorizontal: 18, backgroundColor: "#fff", borderRadius: 13, marginTop: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#F0F0F0", padding: 12, marginBottom: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F5F3FF" },
  avatarFallback: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  avatarInitial: { color: "#7C3AED", fontSize: 17, fontFamily: "Inter_700Bold" },
  rowTitle: { color: "#111827", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  rowSubtitle: { color: "#737B89", fontSize: 11, marginTop: 4, fontFamily: "Inter_400Regular" },
  rowDate: { color: "#9CA3AF", fontSize: 10, fontFamily: "Inter_400Regular" },
  requestCard: { backgroundColor: "#fff", borderRadius: 13, borderWidth: 1, borderColor: "#F0F0F0", padding: 13, marginBottom: 9 },
  requestHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  requestMessage: { color: "#4B5563", fontSize: 13, lineHeight: 19, marginTop: 12, marginBottom: 13 },
  requestActions: { flexDirection: "row", gap: 9 },
  acceptButton: { flex: 1, height: 38, borderRadius: 9, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  acceptText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  declineButton: { flex: 1, height: 38, borderRadius: 9, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  declineText: { color: "#4B5563", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  followActions: { flexDirection: "row", gap: 6 },
  smallAccept: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  smallDecline: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 12, borderRadius: 12, backgroundColor: "#fff", marginBottom: 8 },
  activityUnread: { borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#F8FAFF" },
  unreadDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#7C3AED" },
  activityIcon: { width: 36, height: 36, borderRadius: 13, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  messageList: { flexGrow: 1, padding: 15, gap: 8, justifyContent: "flex-end", backgroundColor: "#F8F7FF" },
  messageBubble: { alignSelf: "flex-start", maxWidth: "88%", backgroundColor: "#fff", borderWidth: 1, borderColor: "#E3E7EF", borderRadius: 20, borderBottomLeftRadius: 5, paddingHorizontal: 15, paddingVertical: 11 },
  messageBody: { color: "#1F2937", fontSize: 14, lineHeight: 20 },
  messageTime: { marginTop: 4, textAlign: "right", color: "#9CA3AF", fontSize: 9 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 9, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E3E7EF" },
  composerInput: { flex: 1, maxHeight: 100, minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 26, backgroundColor: "#F0F2F6", fontSize: 15, color: "#111827" },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", backgroundColor: "#7C3AED" },
  toast: { position: "absolute", left: 20, right: 20, padding: 12, borderRadius: 12, backgroundColor: "#1F2937" },
  toastText: { color: "#fff", fontSize: 13, textAlign: "center", fontFamily: "Inter_500Medium" },
});
