import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView, Modal,
  Pressable, ScrollView, Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import type { GroupMessage, ReactionEntry } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface PinnedMsg { id: string; text: string; senderName: string; }

function parseReactions(raw?: string | null): ReactionEntry[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function GroupChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  const [messages, setMessages]           = useState<GroupMessage[]>([]);
  const [text, setText]                   = useState("");
  const [sending, setSending]             = useState(false);
  const [replyTo, setReplyTo]             = useState<GroupMessage | null>(null);
  const [pinnedMsg, setPinnedMsg]         = useState<PinnedMsg | null>(null);
  const [showSearch, setShowSearch]       = useState(false);
  const [searchQ, setSearchQ]             = useState("");
  const [showInfo, setShowInfo]           = useState(false);
  const [ctxMenu, setCtxMenu]             = useState<GroupMessage | null>(null);
  const [showEmojiFor, setShowEmojiFor]   = useState<string | null>(null);
  const [editingMsg, setEditingMsg]       = useState<GroupMessage | null>(null);
  const [editText, setEditText]           = useState("");
  const [typingUsers, setTypingUsers]     = useState<string[]>([]);
  const [toast, setToast]                 = useState("");
  const [voiceNoteId, setVoiceNoteId]     = useState<string | null>(null);

  const flatListRef  = useRef<FlatList>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping     = useRef(false);
  const topPad       = Platform.OS === "web" ? 67 : insets.top;
  const decName      = name ? decodeURIComponent(name) : "Group";
  const isTeacher    = profile?.role === "teacher";
  const isAdmin      = profile?.role === "teacher" || profile?.role === "official";
  const dotAnim      = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.groups.getMessages(id);
      setMessages(data);
    } catch {}
  }, [id]);

  const fetchTyping = useCallback(async () => {
    if (!id) return;
    try {
      const { typing } = await api.groups.getTyping(id);
      setTypingUsers(typing);
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 2000);
    typingRef.current = setInterval(fetchTyping, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (typingRef.current) clearInterval(typingRef.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (id && isTyping.current) api.groups.setTyping(id, false).catch(() => {});
    };
  }, [fetchMessages, fetchTyping, id]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }, [messages.length]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  };

  const handleTextChange = (val: string) => {
    setText(val);
    if (!id) return;
    if (val.trim() && !isTyping.current) {
      isTyping.current = true;
      api.groups.setTyping(id, true).catch(() => {});
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      if (id) api.groups.setTyping(id, false).catch(() => {});
    }, 3000);
    if (!val.trim() && isTyping.current) {
      isTyping.current = false;
      api.groups.setTyping(id, false).catch(() => {});
    }
  };

  const handleSend = async () => {
    if (!text.trim() || !id) return;
    const msg = text.trim();
    const reply = replyTo;
    setText("");
    setReplyTo(null);
    isTyping.current = false;
    api.groups.setTyping(id, false).catch(() => {});
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const replyData = reply
        ? { replyToId: reply.id, replyToText: reply.text.slice(0, 120), replyToSender: reply.senderName || "Unknown" }
        : undefined;
      await api.groups.sendMessage(id, msg, replyData);
      fetchMessages();
    } catch { showToast("Failed to send message"); }
    setSending(false);
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!id) return;
    setShowEmojiFor(null);
    setCtxMenu(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updated = await api.groups.reactToMessage(id, msgId, emoji);
      setMessages((prev) => prev.map((m) => m.id === msgId ? updated : m));
    } catch { showToast("Failed to react"); }
  };

  const handleDelete = async (msg: GroupMessage) => {
    if (!id) return;
    setCtxMenu(null);
    try {
      const updated = await api.groups.deleteMessage(id, msg.id);
      setMessages((prev) => prev.map((m) => m.id === msg.id ? updated : m));
      showToast("Message deleted");
    } catch (e: any) { showToast(e.message || "Failed to delete"); }
  };

  const handleEdit = async () => {
    if (!editingMsg || !editText.trim() || !id) return;
    try {
      const updated = await api.groups.editMessage(id, editingMsg.id, editText);
      setMessages((prev) => prev.map((m) => m.id === editingMsg.id ? updated : m));
      setEditingMsg(null);
      setEditText("");
    } catch (e: any) { showToast(e.message || "Failed to edit"); }
  };

  const isMe = (senderId?: string | null) => senderId === profile?.uid;

  const filteredMessages = showSearch && searchQ.trim()
    ? messages.filter((m) => !m.deletedAt && m.text.toLowerCase().includes(searchQ.toLowerCase()))
    : messages;

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const mine = isMe(item.senderId);
    const reactions = parseReactions(item.reactions);
    const myReactions = reactions.filter((r) => r.userIds.includes(profile?.uid || ""));
    const isDeleted = !!item.deletedAt;

    return (
      <Pressable
        onLongPress={() => {
          if (!isDeleted) { setCtxMenu(item); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
        }}
        delayLongPress={350}
      >
        <View style={[s.msgRow, mine ? s.msgRowMe : s.msgRowThem]}>
          {!mine && (
            <View style={[s.avatar, { backgroundColor: colors.accent }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>
                {item.senderName?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View style={{ maxWidth: "75%", gap: 3 }}>
            <View style={[
              s.bubble,
              mine
                ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
              isDeleted && { opacity: 0.5 },
            ]}>
              {!mine && <Text style={[s.senderName, { color: colors.primary }]}>{item.senderName}</Text>}

              {item.replyToId && item.replyToText && (
                <View style={s.replyBanner}>
                  <Ionicons name="return-down-forward" size={11} color="#6B7280" />
                  <Text style={s.replyBannerSender}>{item.replyToSender}: </Text>
                  <Text style={s.replyBannerText} numberOfLines={1}>{item.replyToText}</Text>
                </View>
              )}

              {item.text.startsWith("🎤 Voice note") ? (
                <TouchableOpacity
                  style={s.voiceRow}
                  onPress={() => setVoiceNoteId(voiceNoteId === item.id ? null : item.id)}
                >
                  <View style={s.voiceBtn}>
                    <Ionicons name={voiceNoteId === item.id ? "pause" : "play"} size={16} color={mine ? "#fff" : colors.primary} />
                  </View>
                  <View style={s.waveform}>
                    {Array.from({ length: 20 }).map((_, i) => (
                      <View key={i} style={[s.wave, { height: 4 + Math.sin(i * 0.8) * 8, backgroundColor: mine ? "rgba(255,255,255,0.7)" : colors.primary + "80" }]} />
                    ))}
                  </View>
                  <Text style={[s.voiceDur, { color: mine ? "rgba(255,255,255,0.8)" : colors.mutedForeground }]}>0:12</Text>
                </TouchableOpacity>
              ) : isDeleted ? (
                <Text style={[s.bubbleText, { color: mine ? "rgba(255,255,255,0.6)" : "#9CA3AF", fontStyle: "italic" }]}>
                  🚫 Message deleted
                </Text>
              ) : (
                <Text style={[s.bubbleText, { color: mine ? "#fff" : colors.foreground }]}>{item.text}</Text>
              )}

              <View style={s.timeRow}>
                <Text style={[s.timeText, { color: mine ? "rgba(255,255,255,0.65)" : colors.mutedForeground }]}>
                  {formatTime(item.createdAt)}
                  {item.isEdited && !isDeleted ? " · edited" : ""}
                </Text>
                {mine && !isDeleted && <Text style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>  ✓✓</Text>}
              </View>
            </View>

            {reactions.length > 0 && !isDeleted && (
              <View style={[s.reactionRow, mine && { justifyContent: "flex-end" }]}>
                {reactions.map((r) => {
                  const byMe = r.userIds.includes(profile?.uid || "");
                  return (
                    <TouchableOpacity
                      key={r.emoji}
                      style={[s.reactionPill, byMe && s.reactionPillMine]}
                      onPress={() => handleReact(item.id, r.emoji)}
                    >
                      <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                      <Text style={[s.reactionCount, byMe && { color: colors.primary }]}>{r.count}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={s.addReactionBtn}
                  onPress={() => setShowEmojiFor(showEmojiFor === item.id ? null : item.id)}
                >
                  <Ionicons name="add" size={12} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}

            {showEmojiFor === item.id && !isDeleted && (
              <View style={[s.emojiPicker, mine && { alignSelf: "flex-end" }]}>
                {EMOJIS.map((e) => (
                  <TouchableOpacity key={e} onPress={() => handleReact(item.id, e)}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowInfo(true)} activeOpacity={0.8}>
            <Text style={s.headerTitle} numberOfLines={1}>{decName}</Text>
            <Text style={s.headerSub}>
              {typingUsers.length > 0
                ? `${typingUsers.slice(0, 2).join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...`
                : "Tap for group info"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name={showSearch ? "close" : "search"} size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {showSearch && (
          <View style={s.searchBar}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={s.searchInput}
              placeholder="Search messages..."
              placeholderTextColor="#9CA3AF"
              value={searchQ}
              onChangeText={setSearchQ}
              autoFocus
            />
            {searchQ ? <TouchableOpacity onPress={() => setSearchQ("")}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
          </View>
        )}
      </LinearGradient>

      {pinnedMsg && (
        <View style={s.pinnedBanner}>
          <Ionicons name="pin" size={14} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={s.pinnedLabel}>Pinned Message</Text>
            <Text style={s.pinnedText} numberOfLines={1}>{pinnedMsg.text}</Text>
          </View>
          {isAdmin && (
            <TouchableOpacity onPress={() => setPinnedMsg(null)}>
              <Ionicons name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"} keyboardVerticalOffset={0}>
        <FlatList
          ref={flatListRef}
          data={filteredMessages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[s.chatContent, { paddingBottom: 8 }]}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={s.emptyState}>
              <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
              <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                {showSearch && searchQ ? "No messages match your search" : "No messages yet — say hello!"}
              </Text>
            </View>
          }
          renderItem={renderMessage}
        />

        {typingUsers.length > 0 && (
          <View style={s.typingBanner}>
            <View style={s.typingDots}>
              {[0, 1, 2].map((i) => (
                <Animated.View
                  key={i}
                  style={[s.typingDot, {
                    opacity: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3 + i * 0.25, 1 - i * 0.2] }),
                    transform: [{ translateY: dotAnim.interpolate({ inputRange: [0, 1], outputRange: [0, i === 1 ? -3 : -1.5] }) }],
                  }]}
                />
              ))}
            </View>
            <Text style={s.typingText}>
              {typingUsers.slice(0, 2).join(", ")} {typingUsers.length === 1 ? "is" : "are"} typing
            </Text>
          </View>
        )}

        {replyTo && (
          <View style={[s.replyingTo, { backgroundColor: colors.accent }]}>
            <View style={s.replyingToBar} />
            <View style={{ flex: 1 }}>
              <Text style={[s.replyingToName, { color: colors.primary }]}>↩ Replying to {replyTo.senderName}</Text>
              <Text style={[s.replyingToText, { color: colors.foreground }]} numberOfLines={1}>{replyTo.text}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyTo(null)}>
              <Ionicons name="close" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {editingMsg && (
          <View style={s.editBanner}>
            <Ionicons name="create-outline" size={16} color="#3D5AF1" />
            <TextInput
              style={s.editInput}
              value={editText}
              onChangeText={setEditText}
              autoFocus
              multiline
              maxLength={500}
            />
            <TouchableOpacity style={s.editSave} onPress={handleEdit}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setEditText(""); }}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        <View style={[s.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[s.attachBtn]}
            onPress={() => {
              if (id) {
                setSending(true);
                api.groups.sendMessage(id, "🎤 Voice note (0:12)").then(fetchMessages).finally(() => setSending(false));
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }
            }}
          >
            <Ionicons name="mic-outline" size={22} color={colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[s.input, { backgroundColor: colors.muted, color: colors.foreground, borderRadius: colors.radius - 4 }]}
            placeholder="Type a message..."
            placeholderTextColor={colors.mutedForeground}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={500}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: text.trim() ? colors.primary : colors.muted }]}
            onPress={handleSend}
            disabled={!text.trim() || sending}
          >
            <Ionicons name="send" size={18} color={text.trim() ? "#fff" : colors.mutedForeground} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Context Menu */}
      <Modal visible={!!ctxMenu} transparent animationType="fade" onRequestClose={() => setCtxMenu(null)}>
        <Pressable style={s.overlay} onPress={() => { setCtxMenu(null); setShowEmojiFor(null); }}>
          <View style={s.ctxCard}>
            <Text style={s.ctxPreview} numberOfLines={2}>{ctxMenu?.text}</Text>
            <View style={s.ctxEmojiRow}>
              {EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => ctxMenu && handleReact(ctxMenu.id, e)}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {[
              { icon: "return-down-forward-outline" as const, label: "Reply", action: () => { setReplyTo(ctxMenu!); setCtxMenu(null); } },
              ...(isAdmin ? [{ icon: "pin-outline" as const, label: "Pin Message", action: () => { if (ctxMenu) setPinnedMsg({ id: ctxMenu.id, text: ctxMenu.text, senderName: ctxMenu.senderName || "Unknown" }); setCtxMenu(null); } }] : []),
              ...(isMe(ctxMenu?.senderId) ? [{ icon: "create-outline" as const, label: "Edit Message", action: () => { setEditingMsg(ctxMenu!); setEditText(ctxMenu?.text || ""); setCtxMenu(null); } }] : []),
              ...(isMe(ctxMenu?.senderId) || isAdmin ? [{ icon: "trash-outline" as const, label: "Delete Message", action: () => ctxMenu && handleDelete(ctxMenu), danger: true }] : []),
              ...(!isMe(ctxMenu?.senderId) ? [{ icon: "person-remove-outline" as const, label: `Report ${ctxMenu?.senderName ?? "User"}`, action: () => { setCtxMenu(null); router.push({ pathname: "/(screens)/report-user" as any, params: { userName: ctxMenu?.senderName ?? "" } }); } }] : []),
            ].map((opt) => (
              <TouchableOpacity key={opt.label} style={s.ctxRow} onPress={opt.action}>
                <Ionicons name={opt.icon} size={20} color={(opt as any).danger ? "#EF4444" : "#374151"} />
                <Text style={[s.ctxLabel, (opt as any).danger && { color: "#EF4444" }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* Group Info Modal */}
      <Modal visible={showInfo} animationType="slide" presentationStyle="pageSheet">
        <View style={s.infoModal}>
          <View style={s.infoHeader}>
            <Text style={s.infoTitle}>Group Info</Text>
            <TouchableOpacity style={s.iconBtn2} onPress={() => setShowInfo(false)}>
              <Ionicons name="close" size={22} color="#111" />
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <View style={s.infoGroupCard}>
              <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={s.infoGroupAvatar}>
                <Ionicons name="people" size={32} color="#fff" />
              </LinearGradient>
              <Text style={s.infoGroupName}>{decName}</Text>
              <Text style={s.infoGroupMeta}>{messages.filter(m => !m.deletedAt).length} messages · {isAdmin ? "Admin" : "Member"}</Text>
            </View>

            <View style={s.infoSection}>
              <Text style={s.infoSectionTitle}>PARTICIPANTS</Text>
              {Array.from(new Map(messages.map((m) => [m.senderId, m.senderName])).entries())
                .filter(([uid]) => uid)
                .slice(0, 20)
                .map(([uid, n]) => (
                  <View key={uid} style={s.infoMemberRow}>
                    <View style={[s.infoMemberAvatar, { backgroundColor: colors.accent }]}>
                      <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{n?.[0] ?? "?"}</Text>
                    </View>
                    <Text style={s.infoMemberName}>{n}</Text>
                    {uid === profile?.uid && <View style={s.youTag}><Text style={s.youTagText}>You</Text></View>}
                  </View>
                ))}
            </View>

            {isAdmin && (
              <View style={s.adminSection}>
                <Text style={s.infoSectionTitle}>ADMIN CONTROLS</Text>
                {[
                  { icon: "notifications-off-outline" as const, label: "Mute Notifications", onPress: () => { showToast("Notifications muted"); setShowInfo(false); } },
                  { icon: "download-outline" as const, label: "Export Chat", onPress: () => { showToast("Chat exported"); setShowInfo(false); } },
                ].map((opt) => (
                  <TouchableOpacity key={opt.label} style={s.adminRow} onPress={opt.onPress}>
                    <Ionicons name={opt.icon} size={18} color="#374151" />
                    <Text style={s.adminLabel}>{opt.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>

      {toast ? (
        <View style={s.toast} pointerEvents="none">
          <Text style={s.toastText}>{toast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  searchInput: { flex: 1, color: "#fff", fontFamily: "Inter_400Regular", fontSize: 14 },
  pinnedBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#FFFBEB", borderBottomWidth: 1, borderBottomColor: "#FDE68A" },
  pinnedLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#F59E0B" },
  pinnedText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151" },
  chatContent: { padding: 12, gap: 6 },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },
  avatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  bubble: { padding: 12, borderRadius: 16, gap: 3 },
  senderName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  replyBanner: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.07)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 },
  replyBannerSender: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  replyBannerText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", flex: 1 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  voiceRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  voiceBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  waveform: { flexDirection: "row", alignItems: "center", gap: 2, flex: 1 },
  wave: { width: 3, borderRadius: 2 },
  voiceDur: { fontSize: 11, fontFamily: "Inter_400Regular" },
  reactionRow: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  reactionPill: { flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#F3F4F6", borderRadius: 12, paddingHorizontal: 7, paddingVertical: 3, borderWidth: 1, borderColor: "#E5E7EB" },
  reactionPillMine: { backgroundColor: "#EEF2FF", borderColor: "#3D5AF1" },
  reactionCount: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#6B7280" },
  addReactionBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  emojiPicker: { flexDirection: "row", gap: 6, backgroundColor: "#fff", borderRadius: 24, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#F0F0F0", elevation: 4 },
  typingBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  typingDots: { flexDirection: "row", gap: 3, alignItems: "center" },
  typingDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#9CA3AF" },
  typingText: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", fontStyle: "italic" },
  replyingTo: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  replyingToBar: { width: 3, height: 36, borderRadius: 2, backgroundColor: "#3D5AF1" },
  replyingToName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  replyingToText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  editBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#EEF2FF", borderTopWidth: 1, borderTopColor: "#C7D2FE" },
  editInput: { flex: 1, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827", maxHeight: 80 },
  editSave: { width: 32, height: 32, borderRadius: 16, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  emptyState: { alignItems: "center", paddingTop: 80, gap: 10 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 10, borderTopWidth: 1 },
  attachBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular", maxHeight: 100 },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  ctxCard: { backgroundColor: "#fff", borderRadius: 20, margin: 12, padding: 16, gap: 8 },
  ctxPreview: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, marginBottom: 4 },
  ctxEmojiRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", marginBottom: 6 },
  ctxRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: "#F9FAFB" },
  ctxLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: "#374151" },
  infoModal: { flex: 1, backgroundColor: "#F5F6FA" },
  infoHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  infoTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  iconBtn2: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  infoGroupCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  infoGroupAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  infoGroupName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  infoGroupMeta: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  infoSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  infoSectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 12 },
  infoMemberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  infoMemberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  infoMemberName: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#111827" },
  youTag: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  youTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  adminSection: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#F0F0F0" },
  adminRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderRadius: 10, paddingHorizontal: 4, marginBottom: 4 },
  adminLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
  toast: { position: "absolute", bottom: 90, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
