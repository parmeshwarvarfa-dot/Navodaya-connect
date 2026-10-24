import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator, FlatList, Image, KeyboardAvoidingView, Linking, Modal,
  Platform, Pressable, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { api, type DirectMessage } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { firebaseApp } from "@/lib/firebase";

const IMAGE_MARKER = "__NAVODAYA_IMAGE__:";
const LOCATION_MARKER = "__NAVODAYA_LOCATION__:";
const CHAT_EMOJIS = ["\u{1F44D}", "\u2764\uFE0F", "\u{1F602}", "\u{1F62E}", "\u{1F622}", "\u{1F64F}", "\u{1F389}", "\u{1F60A}"];

function parseImage(content: string): { url: string; caption: string } | null {
  if (!content.startsWith(IMAGE_MARKER)) return null;
  try {
    const data = JSON.parse(content.slice(IMAGE_MARKER.length));
    return typeof data?.url === "string" ? { url: data.url, caption: typeof data.caption === "string" ? data.caption : "" } : null;
  } catch { return null; }
}

function parseLocation(content: string): { latitude: number; longitude: number } | null {
  if (!content.startsWith(LOCATION_MARKER)) return null;
  try {
    const data = JSON.parse(content.slice(LOCATION_MARKER.length));
    return typeof data?.latitude === "number" && typeof data?.longitude === "number" ? data : null;
  } catch { return null; }
}

function timeLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function DirectChatScreen() {
  const { profile } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { id, name, peerId, photoURL } = useLocalSearchParams<{ id: string; name: string; peerId: string; photoURL?: string }>();
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [showAttachments, setShowAttachments] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const listRef = useRef<FlatList<DirectMessage>>(null);
  const nearBottom = useRef(true);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping = useRef(false);
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const chatName = Array.isArray(name) ? name[0] : name || "Chat";
  const peerPhoto = Array.isArray(photoURL) ? photoURL[0] : photoURL;

  const loadMessages = useCallback(async () => {
    if (!id) return;
    try {
      const rows = await api.directMessages.messages(id);
      setMessages((current) => {
        const currentIds = new Set(current.map((message) => message.id));
        const incoming = current.length ? rows.filter((message) => !currentIds.has(message.id) && message.senderId !== profile?.uid).length : 0;
        if (incoming) {
          if (nearBottom.current) setNewMessagesCount(0);
          else setNewMessagesCount((count) => count + incoming);
        }
        return rows;
      });
      setError("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not load this conversation");
    } finally {
      setLoading(false);
    }
  }, [id, profile?.uid]);

  const loadTyping = useCallback(async () => {
    if (!id) return;
    try { setTypingUsers((await api.directMessages.typing(id)).typing); } catch {}
  }, [id]);

  useEffect(() => {
    void loadMessages();
    const timer = setInterval(() => void loadMessages(), 3000);
    const typingPoll = setInterval(() => void loadTyping(), 2000);
    return () => {
      clearInterval(timer);
      clearInterval(typingPoll);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (id && isTyping.current) api.directMessages.setTyping(id, false).catch(() => {});
    };
  }, [loadMessages, loadTyping, id]);

  useEffect(() => {
    if (messages.length && nearBottom.current) setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 60);
  }, [messages.length]);

  const sendMessage = async () => {
    const content = text.trim();
    if (!content || !id || sending) return;
    setText("");
    isTyping.current = false;
    api.directMessages.setTyping(id, false).catch(() => {});
    setSending(true);
    try {
      const saved = await api.directMessages.send(id, content);
      setMessages((current) => current.some((message) => message.id === saved.id) ? current : [...current, saved]);
      nearBottom.current = true;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (reason) {
      setText((current) => current || content);
      setError(reason instanceof Error ? reason.message : "Message could not be sent");
    } finally {
      setSending(false);
    }
  };

  const handleTextChange = (value: string) => {
    setText(value);
    if (!id) return;
    if (value.trim() && !isTyping.current) {
      isTyping.current = true;
      api.directMessages.setTyping(id, true).catch(() => {});
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTyping.current = false;
      api.directMessages.setTyping(id, false).catch(() => {});
    }, 3000);
    if (!value.trim() && isTyping.current) {
      isTyping.current = false;
      api.directMessages.setTyping(id, false).catch(() => {});
    }
  };

  const sendPhoto = async (camera = false) => {
    if (!id || sending) return;
    setShowAttachments(false);
    try {
      if (!firebaseApp?.options.storageBucket) throw new Error("Photo sharing needs Firebase Storage configured in .env");
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error(camera ? "Allow camera access to take a photo" : "Allow photo access to attach a photo");
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.82 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.82 });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) return;
      if ((asset.fileSize ?? 0) > 15 * 1024 * 1024) throw new Error("Choose a photo under 15 MB");
      setSending(true);
      const response = await fetch(asset.uri);
      if (!response.ok) throw new Error("Could not read the selected photo");
      const blob = await response.blob();
      const filename = asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") || `photo-${Date.now()}.jpg`;
      const storageRef = ref(getStorage(firebaseApp), `direct-messages/${id}/${Date.now()}-${filename}`);
      await uploadBytes(storageRef, blob, asset.mimeType ? { contentType: asset.mimeType } : undefined);
      const url = await getDownloadURL(storageRef);
      const content = `${IMAGE_MARKER}${JSON.stringify({ url, caption: text.trim() })}`;
      const saved = await api.directMessages.send(id, content);
      setMessages((current) => [...current, saved]);
      setText("");
      nearBottom.current = true;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not send this photo");
    } finally { setSending(false); }
  };

  const sendLocation = async () => {
    if (!id || sending) return;
    setShowAttachments(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) throw new Error("Allow location access to share your current location");
      setSending(true);
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = location.coords;
      const saved = await api.directMessages.send(id, `${LOCATION_MARKER}${JSON.stringify({ latitude, longitude })}`);
      setMessages((current) => [...current, saved]);
      nearBottom.current = true;
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 60);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not share your location");
    } finally { setSending(false); }
  };

  const visibleMessages = searchOpen && query.trim()
    ? messages.filter((message) => message.content.toLowerCase().includes(query.trim().toLowerCase()))
    : messages;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.iconButton} accessibilityLabel="Back">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.identity} onPress={() => peerId && router.push({ pathname: "/(screens)/user-profile" as any, params: { userId: peerId } })}>
            <View style={styles.avatar}>{peerPhoto ? <Image source={{ uri: peerPhoto }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{chatName.charAt(0).toUpperCase()}</Text>}</View>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{chatName}</Text>
              <Text style={styles.subtitle}>{typingUsers.length ? `${typingUsers[0]} is typing...` : "Direct message"}</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSearchOpen((open) => !open)} style={styles.iconButton} accessibilityLabel="Search messages">
            <Ionicons name={searchOpen ? "close" : "search"} size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => peerId && router.push({ pathname: "/(screens)/report-user" as any, params: { userId: peerId } })} style={styles.iconButton} accessibilityLabel="More options">
            <Ionicons name="ellipsis-vertical" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
        {searchOpen && (
          <TextInput style={styles.search} placeholder="Search in conversation" placeholderTextColor="rgba(255,255,255,0.65)" value={query} onChangeText={setQuery} autoFocus />
        )}
      </LinearGradient>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <FlatList
          ref={listRef}
          data={visibleMessages}
          keyExtractor={(message) => message.id}
          contentContainerStyle={styles.messageList}
          scrollEventThrottle={100}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 100;
            if (nearBottom.current) setNewMessagesCount(0);
          }}
          renderItem={({ item }) => {
            const mine = item.senderId === profile?.uid;
            const image = parseImage(item.content);
            const location = parseLocation(item.content);
            return (
              <View style={[styles.messageRow, mine ? styles.mineRow : styles.theirRow]}>
                <View style={[styles.bubble, mine ? styles.mineBubble : styles.theirBubble]}>
                  {image ? (
                    <View style={{ gap: 5 }}>
                      <TouchableOpacity onPress={() => setPreviewImage(image.url)}><Image source={{ uri: image.url }} style={styles.messageImage} resizeMode="cover" /></TouchableOpacity>
                      {image.caption ? <Text style={[styles.messageText, mine && styles.mineText]}>{image.caption}</Text> : null}
                    </View>
                  ) : location ? (
                    <TouchableOpacity style={styles.locationMessage} onPress={() => void Linking.openURL(`https://maps.google.com/?q=${location.latitude},${location.longitude}`).catch(() => setError("Could not open map"))}>
                      <Ionicons name="location" size={20} color={mine ? "#fff" : "#3D5AF1"} />
                      <Text style={[styles.messageText, mine && styles.mineText]}>Shared location</Text>
                      <Ionicons name="open-outline" size={15} color={mine ? "#fff" : "#3D5AF1"} />
                    </TouchableOpacity>
                  ) : <Text style={[styles.messageText, mine && styles.mineText]}>{item.content}</Text>}
                  <View style={styles.messageMeta}>
                    <Text style={[styles.time, mine && styles.mineTime]}>{timeLabel(item.createdAt)}</Text>
                    {mine && <Ionicons name={item.readAt ? "checkmark-done" : "checkmark"} size={14} color={item.readAt ? "#53BDEB" : "#DCE6FF"} />}
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={loading
            ? <ActivityIndicator style={{ marginTop: 36 }} color={colors.primary} />
            : <View style={styles.empty}><Ionicons name="chatbubble-ellipses-outline" size={34} color="#9CA3AF" /><Text style={styles.emptyText}>{error || (query ? "No matching messages" : "Say hello to start the conversation")}</Text></View>}
        />
        {newMessagesCount > 0 && (
          <TouchableOpacity style={styles.newMessagesButton} onPress={() => {
            listRef.current?.scrollToEnd({ animated: true });
            nearBottom.current = true;
            setNewMessagesCount(0);
          }}>
            <Ionicons name="arrow-down" size={15} color="#fff" />
            <Text style={styles.newMessagesText}>{newMessagesCount} new {newMessagesCount === 1 ? "message" : "messages"}</Text>
          </TouchableOpacity>
        )}
        {showEmojis && <View style={styles.emojiBar}>{CHAT_EMOJIS.map((emoji) => <TouchableOpacity key={emoji} onPress={() => setText((current) => current + emoji)}><Text style={styles.emoji}>{emoji}</Text></TouchableOpacity>)}</View>}
        {!!error && !loading && messages.length > 0 && <Text style={styles.error}>{error}</Text>}
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <TouchableOpacity onPress={() => setShowAttachments(true)} disabled={sending} accessibilityLabel="Add attachment"><Ionicons name="add-circle-outline" size={25} color="#3D5AF1" /></TouchableOpacity>
          <TouchableOpacity onPress={() => setShowEmojis((open) => !open)} accessibilityLabel="Open emojis"><Ionicons name="happy-outline" size={21} color="#6B7280" /></TouchableOpacity>
          <TextInput
            value={text}
            onChangeText={handleTextChange}
            placeholder="Message"
            placeholderTextColor="#9CA3AF"
            style={styles.input}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <TouchableOpacity style={[styles.sendButton, !text.trim() && styles.disabledSend]} onPress={() => void sendMessage()} disabled={!text.trim() || sending} accessibilityLabel="Send message">
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
      <Modal visible={showAttachments} transparent animationType="fade" onRequestClose={() => setShowAttachments(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setShowAttachments(false)}>
          <View style={styles.attachmentSheet}>
            <Text style={styles.attachmentTitle}>Share with {chatName}</Text>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => void sendPhoto(false)}><Ionicons name="images-outline" size={22} color="#3D5AF1" /><Text style={styles.attachmentText}>Choose a photo</Text></TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => void sendPhoto(true)}><Ionicons name="camera-outline" size={22} color="#10B981" /><Text style={styles.attachmentText}>Take a photo</Text></TouchableOpacity>
            <TouchableOpacity style={styles.attachmentOption} onPress={() => void sendLocation()}><Ionicons name="location-outline" size={22} color="#EF4444" /><Text style={styles.attachmentText}>Share current location</Text></TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable style={styles.previewBackdrop} onPress={() => setPreviewImage(null)}>
          {previewImage ? <Image source={{ uri: previewImage }} style={styles.previewImage} resizeMode="contain" /> : null}
          <TouchableOpacity style={styles.previewClose} onPress={() => setPreviewImage(null)}><Ionicons name="close" size={24} color="#fff" /></TouchableOpacity>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: { paddingHorizontal: 12, paddingBottom: 12 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  iconButton: { width: 36, height: 38, alignItems: "center", justifyContent: "center" },
  identity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  avatarImage: { width: "100%", height: "100%", borderRadius: 19 },
  avatarText: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  title: { color: "#fff", fontSize: 16, fontFamily: "Inter_700Bold" },
  subtitle: { color: "rgba(255,255,255,0.72)", fontSize: 11, fontFamily: "Inter_400Regular" },
  search: { marginTop: 10, color: "#fff", borderRadius: 12, backgroundColor: "rgba(255,255,255,0.16)", paddingHorizontal: 12, paddingVertical: 9, fontFamily: "Inter_400Regular" },
  messageList: { padding: 14, gap: 8, flexGrow: 1, justifyContent: "flex-end" },
  messageRow: { flexDirection: "row", width: "100%" },
  mineRow: { justifyContent: "flex-end" },
  theirRow: { justifyContent: "flex-start" },
  bubble: { maxWidth: "82%", borderRadius: 18, paddingHorizontal: 12, paddingTop: 9, paddingBottom: 6 },
  mineBubble: { backgroundColor: "#3D5AF1", borderBottomRightRadius: 5 },
  theirBubble: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#E5E7EB", borderBottomLeftRadius: 5 },
  messageText: { color: "#111827", fontSize: 14, lineHeight: 20, fontFamily: "Inter_400Regular" },
  mineText: { color: "#fff" },
  messageImage: { width: 220, height: 185, borderRadius: 12, backgroundColor: "#E5E7EB" },
  locationMessage: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 },
  messageMeta: { marginTop: 3, flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 3 },
  time: { color: "#9CA3AF", fontSize: 10, fontFamily: "Inter_400Regular" },
  mineTime: { color: "rgba(255,255,255,0.7)" },
  empty: { alignItems: "center", gap: 10, paddingVertical: 32 },
  emptyText: { color: "#6B7280", fontSize: 13, fontFamily: "Inter_400Regular", textAlign: "center" },
  newMessagesButton: { position: "absolute", right: 14, bottom: 68, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#3D5AF1", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, elevation: 4 },
  newMessagesText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  error: { color: "#DC2626", textAlign: "center", paddingHorizontal: 10, paddingVertical: 5, fontSize: 12 },
  emojiBar: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 8, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  emoji: { fontSize: 22 },
  composer: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 12, paddingTop: 9, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#E5E7EB" },
  input: { flex: 1, maxHeight: 110, minHeight: 42, borderRadius: 22, backgroundColor: "#F3F4F6", paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#111827", fontFamily: "Inter_400Regular" },
  sendButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  disabledSend: { backgroundColor: "#9CA3AF" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.35)" },
  attachmentSheet: { backgroundColor: "#fff", borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 22, paddingBottom: 34 },
  attachmentTitle: { color: "#111827", fontSize: 16, fontFamily: "Inter_700Bold", marginBottom: 12 },
  attachmentOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  attachmentText: { color: "#374151", fontSize: 15, fontFamily: "Inter_500Medium" },
  previewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" },
  previewImage: { width: "100%", height: "82%" },
  previewClose: { position: "absolute", top: 48, right: 20, width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.4)", alignItems: "center", justifyContent: "center" },
});
