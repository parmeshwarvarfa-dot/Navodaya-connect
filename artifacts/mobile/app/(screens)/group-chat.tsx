import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, Platform, KeyboardAvoidingView, Modal,
  Pressable, ScrollView,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import type { GroupMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";

const EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface Reaction { emoji: string; count: number; byMe: boolean; }
interface ReactionMap { [msgId: string]: Reaction[]; }

interface PinnedMsg { id: string; text: string; senderName: string; }

export default function GroupChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  const [messages, setMessages]       = useState<GroupMessage[]>([]);
  const [text, setText]               = useState("");
  const [sending, setSending]         = useState(false);
  const [reactions, setReactions]     = useState<ReactionMap>({});
  const [replyTo, setReplyTo]         = useState<GroupMessage | null>(null);
  const [pinnedMsg, setPinnedMsg]     = useState<PinnedMsg | null>(null);
  const [showSearch, setShowSearch]   = useState(false);
  const [searchQ, setSearchQ]         = useState("");
  const [showInfo, setShowInfo]       = useState(false);
  const [ctxMenu, setCtxMenu]         = useState<GroupMessage | null>(null);
  const [showEmojiFor, setShowEmojiFor] = useState<string | null>(null);
  const [voiceNoteId, setVoiceNoteId] = useState<string | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const pollRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const topPad      = Platform.OS === "web" ? 67 : insets.top;
  const decName     = name ? decodeURIComponent(name) : "Group";
  const isTeacher   = profile?.role === "teacher";

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try { const data = await api.groups.getMessages(id); setMessages(data); } catch {}
  }, [id]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchMessages]);

  useEffect(() => {
    if (messages.length > 0)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }, [messages.length]);

  const handleSend = async () => {
    if (!text.trim() || !id) return;
    const msg = text.trim();
    const reply = replyTo;
    setText("");
    setReplyTo(null);
    setSending(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const fullMsg = reply ? `↩ ${reply.senderName}: "${reply.text.slice(0, 40)}${reply.text.length > 40 ? "…" : ""}"\n${msg}` : msg;
      await api.groups.sendMessage(id, fullMsg);
      fetchMessages();
    } catch {}
    setSending(false);
  };

  const addReaction = (msgId: string, emoji: string) => {
    setReactions((prev) => {
      const existing = prev[msgId] ?? [];
      const idx = existing.findIndex((r) => r.emoji === emoji);
      if (idx >= 0) {
        const updated = [...existing];
        if (updated[idx].byMe) {
          updated[idx] = { ...updated[idx], count: updated[idx].count - 1, byMe: false };
          if (updated[idx].count <= 0) updated.splice(idx, 1);
        } else {
          updated[idx] = { ...updated[idx], count: updated[idx].count + 1, byMe: true };
        }
        return { ...prev, [msgId]: updated };
      }
      return { ...prev, [msgId]: [...existing, { emoji, count: 1, byMe: true }] };
    });
    setShowEmojiFor(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const pinMessage = (msg: GroupMessage) => {
    setPinnedMsg({ id: msg.id, text: msg.text, senderName: msg.senderName || "Unknown" });
    setCtxMenu(null);
  };

  const isMe = (senderId?: string | null) => senderId === profile?.uid;

  const formatTime = (ts: string) => {
    if (!ts) return "";
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const isVoiceNote = (msg: GroupMessage) => msg.text.startsWith("🎤 Voice note");

  const filteredMessages = showSearch && searchQ.trim()
    ? messages.filter((m) => m.text.toLowerCase().includes(searchQ.toLowerCase()))
    : messages;

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const mine = isMe(item.senderId);
    const msgReactions = reactions[item.id] ?? [];
    const isReply = item.text.startsWith("↩ ");

    const replyLine = isReply ? item.text.split("\n")[0].replace("↩ ", "") : null;
    const mainText  = isReply ? item.text.split("\n").slice(1).join("\n") : item.text;
    const isVoice   = isVoiceNote(item);

    return (
      <Pressable
        onLongPress={() => { setCtxMenu(item); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }}
        delayLongPress={350}
      >
        <View style={[s.msgRow, mine ? s.msgRowMe : s.msgRowThem]}>
          {!mine && (
            <View style={[s.avatar, { backgroundColor: colors.accent }]}>
              <Text style={[s.avatarText, { color: colors.primary }]}>
                {item.senderName?.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <View style={{ maxWidth: "75%", gap: 3 }}>
            <View style={[
              s.bubble,
              mine
                ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
                : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderBottomLeftRadius: 4 },
            ]}>
              {!mine && <Text style={[s.senderName, { color: colors.primary }]}>{item.senderName}</Text>}
              {replyLine && (
                <View style={s.replyBanner}>
                  <Ionicons name="return-down-forward" size={11} color="#6B7280" />
                  <Text style={s.replyBannerText} numberOfLines={1}>{replyLine}</Text>
                </View>
              )}
              {isVoice ? (
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
              ) : (
                <Text style={[s.bubbleText, { color: mine ? "#fff" : colors.foreground }]}>{mainText}</Text>
              )}
              <Text style={[s.timeText, { color: mine ? "rgba(255,255,255,0.65)" : colors.mutedForeground }]}>
                {formatTime(item.createdAt)}
                {mine && <Text>  ✓✓</Text>}
              </Text>
            </View>
            {msgReactions.length > 0 && (
              <View style={[s.reactionRow, mine && { justifyContent: "flex-end" }]}>
                {msgReactions.map((r) => (
                  <TouchableOpacity key={r.emoji} style={[s.reactionPill, r.byMe && s.reactionPillMine]} onPress={() => addReaction(item.id, r.emoji)}>
                    <Text style={{ fontSize: 12 }}>{r.emoji}</Text>
                    <Text style={[s.reactionCount, r.byMe && { color: colors.primary }]}>{r.count}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity style={s.addReactionBtn} onPress={() => setShowEmojiFor(showEmojiFor === item.id ? null : item.id)}>
                  <Ionicons name="add" size={12} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}
            {showEmojiFor === item.id && (
              <View style={[s.emojiPicker, mine && { alignSelf: "flex-end" }]}>
                {EMOJIS.map((e) => (
                  <TouchableOpacity key={e} onPress={() => addReaction(item.id, e)}>
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
      {/* ─── Header ─── */}
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[s.header, { paddingTop: topPad + 8 }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowInfo(true)} activeOpacity={0.8}>
            <Text style={s.headerTitle} numberOfLines={1}>{decName}</Text>
            <Text style={s.headerSub}>Tap for group info</Text>
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

      {/* ─── Pinned Message ─── */}
      {pinnedMsg && (
        <View style={s.pinnedBanner}>
          <Ionicons name="pin" size={14} color="#F59E0B" />
          <View style={{ flex: 1 }}>
            <Text style={s.pinnedLabel}>Pinned Message</Text>
            <Text style={s.pinnedText} numberOfLines={1}>{pinnedMsg.text}</Text>
          </View>
          {isTeacher && (
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

        {/* ─── Reply Banner ─── */}
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

        {/* ─── Input Bar ─── */}
        <View style={[s.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border, paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[s.attachBtn]}
            onPress={() => {
              const noteText = "🎤 Voice note (0:12)";
              if (id) {
                setSending(true);
                api.groups.sendMessage(id, noteText).then(fetchMessages).finally(() => setSending(false));
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
            onChangeText={setText}
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

      {/* ─── Context Menu ─── */}
      <Modal visible={!!ctxMenu} transparent animationType="fade" onRequestClose={() => setCtxMenu(null)}>
        <Pressable style={s.overlay} onPress={() => setCtxMenu(null)}>
          <View style={s.ctxCard}>
            <Text style={s.ctxPreview} numberOfLines={2}>{ctxMenu?.text}</Text>
            <View style={s.ctxEmojiRow}>
              {EMOJIS.map((e) => (
                <TouchableOpacity key={e} onPress={() => { addReaction(ctxMenu!.id, e); setCtxMenu(null); }}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {[
              { icon: "return-down-forward-outline" as const, label: "Reply",  action: () => { setReplyTo(ctxMenu!); setCtxMenu(null); } },
              ...(isTeacher ? [{ icon: "pin-outline" as const, label: "Pin Message", action: () => pinMessage(ctxMenu!) }] : []),
              { icon: "copy-outline" as const, label: "Copy Text", action: () => setCtxMenu(null) },
              { icon: "flag-outline" as const, label: "Report Message", action: () => { setCtxMenu(null); router.push("/(screens)/report-user" as any); } },
            ].map((opt) => (
              <TouchableOpacity key={opt.label} style={s.ctxRow} onPress={opt.action}>
                <Ionicons name={opt.icon} size={20} color="#374151" />
                <Text style={s.ctxLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      {/* ─── Group Info Modal ─── */}
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
              <Text style={s.infoGroupMeta}>{messages.length} messages · {isTeacher ? "You are admin" : "Group member"}</Text>
            </View>

            <View style={s.infoSection}>
              <Text style={s.infoSectionTitle}>MEMBERS</Text>
              {Array.from(new Set(messages.map((m) => m.senderName).filter(Boolean))).slice(0, 12).map((n) => (
                <View key={n} style={s.infoMemberRow}>
                  <View style={[s.infoMemberAvatar, { backgroundColor: colors.accent }]}>
                    <Text style={{ color: colors.primary, fontFamily: "Inter_700Bold", fontSize: 14 }}>{n![0]}</Text>
                  </View>
                  <Text style={s.infoMemberName}>{n}</Text>
                  {n === profile?.fullName && <View style={s.youTag}><Text style={s.youTagText}>You</Text></View>}
                </View>
              ))}
            </View>

            {isTeacher && (
              <View style={s.adminSection}>
                <Text style={s.infoSectionTitle}>ADMIN CONTROLS</Text>
                {[
                  { icon: "person-add-outline" as const, label: "Add Members" },
                  { icon: "notifications-off-outline" as const, label: "Mute Group" },
                  { icon: "trash-outline" as const, label: "Clear Messages", danger: true },
                ].map((opt) => (
                  <TouchableOpacity key={opt.label} style={[s.adminRow, opt.danger && { borderColor: "#FEE2E2" }]} onPress={() => setShowInfo(false)}>
                    <Ionicons name={opt.icon} size={18} color={opt.danger ? "#EF4444" : "#374151"} />
                    <Text style={[s.adminLabel, opt.danger && { color: "#EF4444" }]}>{opt.label}</Text>
                    <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
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
  replyBannerText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", flex: 1 },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 20 },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular", alignSelf: "flex-end" },
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
  emojiPicker: { flexDirection: "row", gap: 6, backgroundColor: "#fff", borderRadius: 24, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: "#F0F0F0", shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  replyingTo: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.06)" },
  replyingToBar: { width: 3, height: 36, borderRadius: 2, backgroundColor: "#3D5AF1" },
  replyingToName: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  replyingToText: { fontSize: 13, fontFamily: "Inter_400Regular" },
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
  adminRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderRadius: 10, paddingHorizontal: 4, borderWidth: 1, borderColor: "#transparent", marginBottom: 4 },
  adminLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#374151" },
});
