import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator,
  TextInput, Platform, KeyboardAvoidingView, Modal, Image, Share, Linking,
  Pressable, ScrollView, Animated,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useLocalSearchParams } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "@/lib/api";
import type { ChatContact, GroupMember, GroupMessage, ReactionEntry } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useColors } from "@/hooks/useColors";
import { firebaseApp } from "@/lib/firebase";

const EMOJI_CATEGORIES = {
  Smileys: "😀 😃 😄 😁 😆 😅 😂 🤣 🥲 ☺️ 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 ☹️ 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🫡 🤫 🤥 😶 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠",
  People: "👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦",
  Nature: "🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐸 🐵 🙈 🙉 🙊 🐒 🐔 🐧 🐦 🐤 🐣 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🦋 🐌 🐞 🐜 🪰 🪲 🦟 🦗 🕷️ 🦂 🐢 🐍 🦎 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🐘 🦛 🦏 🐪 🦒 🦘 🦬 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🦮 🐈 🐓 🦃 🦚 🦜 🦢 🪿 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🍃 🍂 🍁 🍄 🌾 💐 🌷 🌹 🥀 🌺 🌸 🌼 🌻",
  Food: "🍇 🍈 🍉 🍊 🍋 🍌 🍍 🥭 🍎 🍏 🍐 🍑 🍒 🍓 🫐 🥝 🍅 🫒 🥥 🥑 🍆 🥔 🥕 🌽 🌶️ 🫑 🥒 🥬 🥦 🧄 🧅 🍄 🥜 🫘 🌰 🍞 🥐 🥖 🫓 🥨 🥯 🥞 🧇 🧀 🍖 🍗 🥩 🥓 🍔 🍟 🍕 🌭 🥪 🌮 🌯 🫔 🥙 🧆 🥚 🍳 🥘 🍲 🫕 🥣 🥗 🍿 🧈 🧂 🥫 🍱 🍘 🍙 🍚 🍛 🍜 🍝 🍠 🍢 🍣 🍤 🍥 🥮 🍡 🥟 🥠 🥡 🦪 🍦 🍧 🍨 🍩 🍪 🎂 🍰 🧁 🥧 🍫 🍬 🍭 🍮 🍯 🍼 🥛 ☕ 🫖 🍵 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧋 🧃 🥤 🧊",
  Activity: "⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🪃 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪅 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 ⛷️ 🏂 🪂 🏋️ 🤼 🤸 ⛹️ 🤺 🏇 🧘 🏄 🏊 🤽 🚣 🧗 🚵 🚴 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🪈 🎲 ♟️ 🎯 🎳 🎮 🎰 🧩",
  Travel: "🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🛵 🏍️ 🚲 🛴 🚏 🛣️ 🛤️ ⛽ 🚨 🚥 🚦 🚧 ⚓ 🛟 ⛵ 🚤 🛳️ ⛴️ 🛥️ 🚢 ✈️ 🛩️ 🛫 🛬 🪂 💺 🚁 🚟 🚠 🚡 🛰️ 🚀 🛸 🌍 🌎 🌏 🗺️ 🧭 🏔️ ⛰️ 🌋 🗻 🏕️ 🏖️ 🏜️ 🏝️ 🏞️ 🏟️ 🏛️ 🏗️ 🧱 🪨 🛖 🏘️ 🏚️ 🏠 🏡 🏢 🏥 🏦 🏨 🏫 🏬 🏭 🏯 🏰 💒 🗼 🗽 ⛪ 🕌 🛕 🕍 ⛩️ 🕋 ⛲ ⛺ 🌁 🌃 🏙️ 🌄 🌅 🌆 🌇 🌉 ♨️ 🎠 🛝 🎡 🎢",
  Objects: "⌚ 📱 📲 💻 🖥️ 🖨️ ⌨️ 🖱️ 🖲️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 💵 💴 💶 💷 💰 💳 🪙 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🧲 🔫 💣 🧨 🪓 🔪 🗡️ ⚔️ 🛡️ ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 🪬 🔭 🔬 🕳️ 🩹 🩺 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🪠 🧺 🧻 🚽 🚿 🛁 🪥 🪒 🧽 🪣 🧼 🫧 🪮 🧴 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🧸 🪆 🖼️ 🪞 🪟 🛍️ 🛒 🎁 🎈 🎀 🪄 🎊 🎉 🧧 ✉️ 📩 📨 📧 💌 📦 🏷️ 📜 📃 📄 📑 🧾 📊 📈 📉 🗒️ 🗓️ 📆 📅 📇 📋 📁 📂 🗂️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓",
  Symbols: "❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ 🉑 ☢️ ☣️ 📴 📳 🈶 🈚 🈸 🈺 🈷️ ✴️ 🆚 💮 🉐 ㊙️ ㊗️ 🈴 🈵 🈹 🈲 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛄 🛅 🚹 🚺 🚻 🚼 🚮 🎦 📶 🈁 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 🔟 🔢 ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ 🔀 🔁 🔂 ◀️ 🔼 🔽 ⏫ ⏬ ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔈 🔉 🔊 🔇 📣 📢 🔔 🔕 🃏 🀄 🎴 🎵 🎶 🔃 🔄 🔙 🔚 🔛 🔜 🔝"
} as const;
const EMOJIS = Object.values(EMOJI_CATEGORIES).flatMap((category) => category.split(" "));
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
const ATTACHMENT_MARKER = "__NAVODAYA_IMAGE__:";
const LOCATION_MARKER = "__NAVODAYA_LOCATION__:";
const CONTACT_MARKER = "__NAVODAYA_CONTACT__:";
const POLL_MARKER = "__NAVODAYA_POLL__:";

interface PinnedMsg { id: string; text: string; senderName: string; }

function parseReactions(raw?: string | null): ReactionEntry[] {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

function formatTime(ts: string) {
  if (!ts) return "";
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function parseImageAttachment(text: string): { url: string; caption: string } | null {
  if (!text.startsWith(ATTACHMENT_MARKER)) return null;
  try {
    const value = JSON.parse(text.slice(ATTACHMENT_MARKER.length));
    return typeof value?.url === "string" ? { url: value.url, caption: typeof value.caption === "string" ? value.caption : "" } : null;
  } catch {
    return null;
  }
}

function parseLocationAttachment(text: string): { latitude: number; longitude: number } | null {
  if (!text.startsWith(LOCATION_MARKER)) return null;
  try {
    const value = JSON.parse(text.slice(LOCATION_MARKER.length));
    return typeof value?.latitude === "number" && typeof value?.longitude === "number"
      ? { latitude: value.latitude, longitude: value.longitude }
      : null;
  } catch {
    return null;
  }
}

function parseContactAttachment(text: string): { id?: string; name: string; phone?: string } | null {
  if (!text.startsWith(CONTACT_MARKER)) return null;
  try {
    const value = JSON.parse(text.slice(CONTACT_MARKER.length));
    return typeof value?.name === "string" ? value : null;
  } catch { return null; }
}

function parsePollAttachment(text: string): { question: string; options: string[] } | null {
  if (!text.startsWith(POLL_MARKER)) return null;
  try {
    const value = JSON.parse(text.slice(POLL_MARKER.length));
    return typeof value?.question === "string" && Array.isArray(value?.options) ? value : null;
  } catch { return null; }
}

function messagePreview(text: string) {
  const attachment = parseImageAttachment(text);
  if (attachment) return attachment.caption || "Photo";
  if (parseLocationAttachment(text)) return "Location";
  const contact = parseContactAttachment(text);
  if (contact) return `Contact: ${contact.name}`;
  const poll = parsePollAttachment(text);
  if (poll) return `Poll: ${poll.question}`;
  return text;
}

type InboxPreferences = { favorites: string[]; archived: string[]; muted: string[]; readAt: Record<string, string> };

function isOlderMessage(message: GroupMessage, cursor: GroupMessage) {
  const timeDifference = new Date(message.createdAt).getTime() - new Date(cursor.createdAt).getTime();
  return timeDifference < 0 || (timeDifference === 0 && message.id < cursor.id);
}

function isNewerMessage(message: GroupMessage, cursor: GroupMessage) {
  const timeDifference = new Date(message.createdAt).getTime() - new Date(cursor.createdAt).getTime();
  return timeDifference > 0 || (timeDifference === 0 && message.id > cursor.id);
}

export default function GroupChatScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const { id, name } = useLocalSearchParams<{ id: string; name: string }>();

  const [messages, setMessages]           = useState<GroupMessage[]>([]);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [loadError, setLoadError]         = useState("");
  const [hasOlderMessages, setHasOlderMessages] = useState(false);
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [text, setText]                   = useState("");
  const [sending, setSending]             = useState(false);
  const [replyTo, setReplyTo]             = useState<GroupMessage | null>(null);
  const [pinnedMsg, setPinnedMsg]         = useState<PinnedMsg | null>(null);
  const [showSearch, setShowSearch]       = useState(false);
  const [searchQ, setSearchQ]             = useState("");
  const [showInfo, setShowInfo]           = useState(false);
  const [showChatMenu, setShowChatMenu]   = useState(false);
  const [ctxMenu, setCtxMenu]             = useState<GroupMessage | null>(null);
  const [deleteTarget, setDeleteTarget]   = useState<GroupMessage | null>(null);
  const [editingMsg, setEditingMsg]       = useState<GroupMessage | null>(null);
  const [editText, setEditText]           = useState("");
  const [typingUsers, setTypingUsers]     = useState<string[]>([]);
  const [toast, setToast]                 = useState("");
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showComposerEmojis, setShowComposerEmojis] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [emojiTargetId, setEmojiTargetId] = useState<string | null>(null);
  const [emojiSearch, setEmojiSearch] = useState("");
  const [previewImage, setPreviewImage]   = useState<string | null>(null);
  const [newMessagesCount, setNewMessagesCount] = useState(0);
  const [groupTab, setGroupTab] = useState<"members" | "media" | "settings">("members");
  const [darkChat, setDarkChat] = useState(true);
  const [muted, setMuted] = useState(false);
  const [favorite, setFavorite] = useState(false);
  const [archived, setArchived] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [showContactPicker, setShowContactPicker] = useState(false);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState("");
  const [addMemberContacts, setAddMemberContacts] = useState<ChatContact[]>([]);
  const [selectedAddMembers, setSelectedAddMembers] = useState<ChatContact[]>([]);
  const [addingMembers, setAddingMembers] = useState(false);
  const [showPollComposer, setShowPollComposer] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState(["", ""]);

  const flatListRef  = useRef<FlatList>(null);
  const pollRef      = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTyping     = useRef(false);
  const topPad       = Platform.OS === "web" ? 0 : insets.top;
  const decName      = Array.isArray(name) ? name[0] : name || "Group";
  const isAdmin      = profile?.role === "teacher" || profile?.role === "official" || members.some((member) => member.id === profile?.uid && member.role === "admin");
  const dotAnim      = useRef(new Animated.Value(0)).current;
  const nearBottom   = useRef(true);
  const loadingOlderRef = useRef(false);
  const scrollMetrics = useRef({ offset: 0, height: 0 });
  const preserveScroll = useRef<{ offset: number; height: number } | null>(null);
  const chatKey = `group-chat-prefs:${profile?.uid ?? "guest"}:${id ?? "unknown"}`;
  const inboxKey = profile?.uid ? `chat-preferences:${profile.uid}` : null;
  const chatPalette = darkChat
    ? { background: "#0b141a", surface: "#202c33", incoming: "#202c33", outgoing: "#005c4b", foreground: "#e9edef", muted: "#8696a0", border: "#26343b", accent: "#00a884" }
    : { background: "#efeae2", surface: "#ffffff", incoming: "#ffffff", outgoing: "#d9fdd3", foreground: "#111b21", muted: "#667781", border: "#e9edef", accent: "#008069" };

  useEffect(() => {
    if (!id || !profile?.uid) return;
    AsyncStorage.getItem(chatKey).then((stored) => {
      if (!stored) return;
      try {
        const prefs = JSON.parse(stored);
        if (typeof prefs.darkChat === "boolean") setDarkChat(prefs.darkChat);
        if (typeof prefs.muted === "boolean") setMuted(prefs.muted);
      } catch {}
    }).catch(() => {});
  }, [chatKey, id, profile?.uid]);

  useEffect(() => {
    if (!id || !inboxKey) return;
    AsyncStorage.getItem(inboxKey).then((stored) => {
      if (!stored) return;
      try {
        const prefs = JSON.parse(stored) as Partial<InboxPreferences>;
        setFavorite(Array.isArray(prefs.favorites) && prefs.favorites.includes(id));
        setArchived(Array.isArray(prefs.archived) && prefs.archived.includes(id));
        setMuted((current) => current || (Array.isArray(prefs.muted) && prefs.muted.includes(id)));
      } catch {}
    }).catch(() => {});
  }, [id, inboxKey]);

  const saveChatPrefs = (next: { darkChat?: boolean }) => {
    const value = { darkChat, ...next };
    AsyncStorage.setItem(chatKey, JSON.stringify(value)).catch(() => {});
  };

  const updateInboxPreference = async (field: "favorites" | "archived" | "muted", enabled: boolean) => {
    if (!inboxKey || !id) return;
    try {
      const stored = await AsyncStorage.getItem(inboxKey);
      const prefs: InboxPreferences = stored ? JSON.parse(stored) as InboxPreferences : { favorites: [], archived: [], muted: [], readAt: {} };
      const values = Array.isArray(prefs[field]) ? prefs[field] : [];
      const nextValues = enabled ? [...new Set([...values, id])] : values.filter((item) => item !== id);
      await AsyncStorage.setItem(inboxKey, JSON.stringify({ ...prefs, [field]: nextValues }));
      if (field === "favorites") setFavorite(enabled);
      if (field === "archived") setArchived(enabled);
      if (field === "muted") setMuted(enabled);
      showToast(field === "favorites" ? (enabled ? "Added to favorites" : "Removed from favorites") : field === "archived" ? (enabled ? "Chat archived" : "Chat unarchived") : (enabled ? "Notifications muted on this device" : "Notifications unmuted"));
    } catch {
      showToast("Could not save this chat setting");
    }
  };

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(dotAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        Animated.timing(dotAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [dotAnim]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2500);
  }, []);

  const fetchMessages = useCallback(async () => {
    if (!id) return;
    try {
      const data = await api.groups.getMessages(id);
      setMessages((current) => {
        if (!data.length) return current.length ? [] : current;
        const currentIds = new Set(current.map((message) => message.id));
        const incoming = current.length
          ? data.filter((message) => !currentIds.has(message.id) && message.senderId !== profile?.uid).length
          : 0;
        if (incoming) {
          if (nearBottom.current) setNewMessagesCount(0);
          else setNewMessagesCount((count) => count + incoming);
        }
        const latestIds = new Set(data.map((message) => message.id));
        const loadedEarlier = current.filter((message) =>
          !latestIds.has(message.id) && (isOlderMessage(message, data[0]) || isNewerMessage(message, data[data.length - 1])),
        );
        return [...loadedEarlier, ...data];
      });
      setHasOlderMessages(data.length >= 200);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load messages");
    } finally {
      setLoadingMessages(false);
    }
  }, [id, profile?.uid]);

  const loadOlderMessages = useCallback(async () => {
    const firstMessage = messages[0];
    if (!id || !firstMessage || !hasOlderMessages || loadingOlderRef.current) return;
    loadingOlderRef.current = true;
    setLoadingOlderMessages(true);
    preserveScroll.current = { ...scrollMetrics.current };
    try {
      const older = await api.groups.getMessages(id, { createdAt: firstMessage.createdAt, id: firstMessage.id });
      if (!older.length) {
        preserveScroll.current = null;
        setHasOlderMessages(false);
      } else {
        setMessages((current) => {
          const currentIds = new Set(current.map((message) => message.id));
          return [...older.filter((message) => !currentIds.has(message.id)), ...current];
        });
        setHasOlderMessages(older.length >= 200);
        setTimeout(() => { preserveScroll.current = null; }, 1200);
      }
    } catch (error) {
      preserveScroll.current = null;
      showToast(error instanceof Error ? error.message : "Could not load older messages");
    } finally {
      loadingOlderRef.current = false;
      setLoadingOlderMessages(false);
    }
  }, [hasOlderMessages, id, messages, showToast]);

  const fetchTyping = useCallback(async () => {
    if (!id) return;
    try {
      const { typing } = await api.groups.getTyping(id);
      setTypingUsers(typing);
    } catch {}
  }, [id]);

  useEffect(() => {
    fetchMessages();
    pollRef.current = setInterval(fetchMessages, 3500);
    typingRef.current = setInterval(fetchTyping, 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      if (typingRef.current) clearInterval(typingRef.current);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      if (id && isTyping.current) api.groups.setTyping(id, false).catch(() => {});
    };
  }, [fetchMessages, fetchTyping, id]);

  useEffect(() => {
    if (!id) return;
    api.groups.members(id).then(setMembers).catch(() => {});
  }, [id]);

  useEffect(() => {
    const query = addMemberSearch.trim();
    if (!showAddMembers || query.length < 2) { setAddMemberContacts([]); return; }
    const timer = setTimeout(() => api.users.search(query).then(setAddMemberContacts).catch(() => setAddMemberContacts([])), 300);
    return () => clearTimeout(timer);
  }, [addMemberSearch, showAddMembers]);

  useEffect(() => {
    if (messages.length > 0 && nearBottom.current)
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: false }), 100);
  }, [messages.length]);

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
        ? { replyToId: reply.id, replyToText: messagePreview(reply.text).slice(0, 120), replyToSender: reply.senderName || "Unknown" }
        : undefined;
      const saved = await api.groups.sendMessage(id, msg, replyData);
      setMessages((previous) => previous.some((item) => item.id === saved.id) ? previous : [...previous, saved]);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error) {
      setText((current) => current || msg);
      setReplyTo(reply);
      showToast(error instanceof Error ? error.message : "Failed to send message");
    } finally {
      setSending(false);
    }
  };

  const chooseImage = async (useCamera = false) => {
    if (!id || sending) return;
    setShowAttachMenu(false);
    try {
      if (useCamera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) return showToast("Allow camera access to take a photo");
      } else {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) return showToast("Allow photo library access to attach a photo");
      }

      const result = useCamera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.82 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.82 });
      const asset = result.canceled ? undefined : result.assets?.[0];
      if (!asset) return;
      if ((asset.fileSize ?? 0) > 15 * 1024 * 1024) return showToast("Choose a photo under 15 MB");
      if (!firebaseApp?.options.storageBucket) {
        return showToast("Photo sharing needs Firebase Storage configured in .env");
      }

      setSending(true);
      isTyping.current = false;
      api.groups.setTyping(id, false).catch(() => {});
      const blobResponse = await fetch(asset.uri);
      if (!blobResponse.ok) throw new Error("Could not read the selected photo");
      const blob = await blobResponse.blob();
      const filename = asset.fileName?.replace(/[^a-zA-Z0-9._-]/g, "_") || `photo-${Date.now()}.jpg`;
      const storageRef = ref(getStorage(firebaseApp), `group-messages/${id}/${Date.now()}-${filename}`);
      await uploadBytes(storageRef, blob, asset.mimeType ? { contentType: asset.mimeType } : undefined);
      const url = await getDownloadURL(storageRef);
      const caption = text.trim();
      const replyData = replyTo
        ? { replyToId: replyTo.id, replyToText: messagePreview(replyTo.text).slice(0, 120), replyToSender: replyTo.senderName || "Unknown" }
        : undefined;
      await api.groups.sendMessage(id, `${ATTACHMENT_MARKER}${JSON.stringify({ url, caption })}`, replyData);
      setText("");
      setReplyTo(null);
      await fetchMessages();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not send this photo");
    } finally {
      setSending(false);
    }
  };

  const exportChat = async () => {
    const transcript = messages
      .filter((message) => !message.deletedAt)
      .map((message) => `${message.senderName || "Member"} Â· ${formatTime(message.createdAt)}\n${messagePreview(message.text)}`)
      .join("\n\n");
    if (!transcript) return showToast("There are no messages to export yet");
    try {
      await Share.share({ title: decName, message: `${decName}\n\n${transcript}` });
      setShowInfo(false);
    } catch {
      showToast("Could not share this chat");
    }
  };

  const shareLocation = async () => {
    if (!id || sending) return;
    setShowAttachMenu(false);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) return showToast("Allow location access to share your current location");
      setSending(true);
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = position.coords;
      const replyData = replyTo
        ? { replyToId: replyTo.id, replyToText: messagePreview(replyTo.text).slice(0, 120), replyToSender: replyTo.senderName || "Unknown" }
        : undefined;
      await api.groups.sendMessage(id, `${LOCATION_MARKER}${JSON.stringify({ latitude, longitude })}`, replyData);
      setReplyTo(null);
      await fetchMessages();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not share your location");
    } finally {
      setSending(false);
    }
  };

  const shareContact = async (member: GroupMember) => {
    if (!id || sending) return;
    setShowContactPicker(false);
    setShowAttachMenu(false);
    try {
      const replyData = replyTo
        ? { replyToId: replyTo.id, replyToText: messagePreview(replyTo.text).slice(0, 120), replyToSender: replyTo.senderName || "Unknown" }
        : undefined;
      const saved = await api.groups.sendMessage(id, `${CONTACT_MARKER}${JSON.stringify({ id: member.id, name: member.fullName, phone: member.phone || undefined })}`, replyData);
      setMessages((previous) => previous.some((item) => item.id === saved.id) ? previous : [...previous, saved]);
      setReplyTo(null);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not share this contact");
    }
  };

  const addSelectedMembers = async () => {
    if (!id || !selectedAddMembers.length || addingMembers) return;
    setAddingMembers(true);
    try {
      setMembers(await api.groups.addMembers(id, selectedAddMembers.map((member) => member.id)));
      setShowAddMembers(false); setAddMemberSearch(""); setSelectedAddMembers([]);
      showToast("Members added to the group");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not add members");
    } finally { setAddingMembers(false); }
  };

  const sendPoll = async () => {
    const question = pollQuestion.trim();
    const options = pollOptions.map((option) => option.trim()).filter(Boolean);
    if (!id || !question || options.length < 2 || options.length > 8 || sending) return;
    if (new Set(options.map((option) => option.toLocaleLowerCase())).size !== options.length) return showToast("Poll options must be different");
    setSending(true);
    try {
      const replyData = replyTo
        ? { replyToId: replyTo.id, replyToText: messagePreview(replyTo.text).slice(0, 120), replyToSender: replyTo.senderName || "Unknown" }
        : undefined;
      const saved = await api.groups.sendMessage(id, `${POLL_MARKER}${JSON.stringify({ question, options })}`, replyData);
      setMessages((previous) => previous.some((item) => item.id === saved.id) ? previous : [...previous, saved]);
      setReplyTo(null);
      setPollQuestion(""); setPollOptions(["", ""]); setShowPollComposer(false);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create poll");
    } finally { setSending(false); }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!id) return;
    setCtxMenu(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const updated = await api.groups.reactToMessage(id, msgId, emoji);
      setMessages((prev) => prev.map((m) => m.id === msgId ? updated : m));
    } catch { showToast("Failed to react"); }
  };

  const openEmojiPicker = (messageId: string | null = null) => {
    setEmojiTargetId(messageId);
    setEmojiSearch("");
    setShowEmojiPicker(true);
  };

  const chooseEmoji = (emoji: string) => {
    const targetId = emojiTargetId;
    setShowEmojiPicker(false);
    setEmojiTargetId(null);
    if (targetId) void handleReact(targetId, emoji);
    else setText((current) => `${current}${emoji}`);
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
  const groupMembers = members.length
    ? members.map((member) => [member.id, member.fullName] as [string, string])
    : Array.from(new Map(messages.filter((m) => m.senderId).map((m) => [m.senderId!, m.senderName || "Member"])).entries());
  if (profile?.uid && !groupMembers.some(([uid]) => uid === profile.uid)) groupMembers.unshift([profile.uid, "You"]);
  const visibleMembers = groupMembers.filter(([, memberName]) => memberName.toLowerCase().includes(memberSearch.toLowerCase()));
  const groupMedia = messages.map((message) => ({ message, attachment: parseImageAttachment(message.text) })).filter((item) => item.attachment && !item.message.deletedAt);
  const chatBackground = chatPalette.background;

  const filteredMessages = showSearch && searchQ.trim()
    ? messages.filter((m) => !m.deletedAt && messagePreview(m.text).toLowerCase().includes(searchQ.toLowerCase()))
    : messages;

  const renderMessage = ({ item }: { item: GroupMessage }) => {
    const mine = isMe(item.senderId);
    const reactions = parseReactions(item.reactions);
    const isDeleted = !!item.deletedAt;
    const attachment = !isDeleted ? parseImageAttachment(item.text) : null;
    const locationAttachment = !isDeleted ? parseLocationAttachment(item.text) : null;
    const contactAttachment = !isDeleted ? parseContactAttachment(item.text) : null;
    const pollAttachment = !isDeleted ? parsePollAttachment(item.text) : null;

    return (
      <Pressable
        onLongPress={() => {
          if (!isDeleted) { setCtxMenu(item); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); }
        }}
        delayLongPress={350}
      >
        <View style={[s.msgRow, mine ? s.msgRowMe : s.msgRowThem]}>
          {!mine && (
            <View style={[s.avatar, { backgroundColor: "#26343b" }]}>
              <Text style={[s.avatarText, { color: "#b4e1d3" }]}>
                {item.senderName?.charAt(0).toUpperCase() ?? "?"}
              </Text>
            </View>
          )}
          <View style={{ maxWidth: "75%", gap: 3 }}>
            <View style={[
              s.bubble,
              mine
                ? { backgroundColor: "#005c4b", borderBottomRightRadius: 4 }
                : { backgroundColor: "#202c33", borderBottomLeftRadius: 4 },
              isDeleted && { opacity: 0.5 },
            ]}>
              {!mine && <Text style={[s.senderName, { color: "#53bdeb" }]}>{item.senderName}</Text>}

              {item.replyToId && item.replyToText && (
                <View style={s.replyBanner}>
                  <Ionicons name="return-down-forward" size={11} color="#6B7280" />
                  <Text style={s.replyBannerSender}>{item.replyToSender}: </Text>
                  <Text style={s.replyBannerText} numberOfLines={1}>{item.replyToText}</Text>
                </View>
              )}

              {isDeleted ? (
                <Text style={[s.bubbleText, { color: mine ? "rgba(255,255,255,0.6)" : "#9CA3AF", fontStyle: "italic" }]}>
                  ðŸš« Message deleted
                </Text>
              ) : attachment ? (
                <View style={s.attachmentMessage}>
                  <TouchableOpacity onPress={() => setPreviewImage(attachment.url)} activeOpacity={0.9}>
                    <Image source={{ uri: attachment.url }} style={s.messageImage} resizeMode="cover" />
                  </TouchableOpacity>
              {!!attachment.caption && <Text style={[s.bubbleText, { color: mine ? "#e9edef" : "#e9edef" }]}>{attachment.caption}</Text>}
                </View>
              ) : locationAttachment ? (
                <TouchableOpacity
                  style={s.locationMessage}
                  onPress={() => void Linking.openURL(`https://maps.google.com/?q=${locationAttachment.latitude},${locationAttachment.longitude}`).catch(() => showToast("Could not open the map"))}
                >
                  <Ionicons name="location" size={22} color={mine ? "#fff" : colors.primary} />
                  <View style={{ flex: 1 }}>
                    <Text style={[s.locationTitle, { color: mine ? "#e9edef" : "#e9edef" }]}>Shared location</Text>
                    <Text style={[s.locationCoords, { color: mine ? "rgba(233,237,239,0.75)" : "#8696a0" }]}>
                      {locationAttachment.latitude.toFixed(4)}, {locationAttachment.longitude.toFixed(4)}
                    </Text>
                  </View>
                  <Ionicons name="open-outline" size={16} color={mine ? "#fff" : colors.primary} />
                </TouchableOpacity>
              ) : contactAttachment ? (
                <TouchableOpacity style={[s.sharedContactCard, { backgroundColor: darkChat ? "#26343b" : "#eef4f5" }]} onPress={() => contactAttachment.id ? router.push({ pathname: "/(screens)/user-profile" as any, params: { userId: contactAttachment.id } }) : showToast("This contact profile is unavailable")}>
                <View style={s.sharedContactAvatar}><Ionicons name="person" size={20} color="#fff" /></View>
                  <View style={{ flex: 1 }}><Text style={[s.locationTitle, { color: chatPalette.foreground }]}>{contactAttachment.name}</Text><Text style={[s.locationCoords, { color: chatPalette.muted }]}>Navodaya Connect contact</Text></View>
                  <Ionicons name="person-outline" size={18} color={chatPalette.accent} />
                </TouchableOpacity>
              ) : pollAttachment ? (
                <View style={[s.pollCard, { backgroundColor: darkChat ? "#26343b" : "#eef4f5" }]}>
                  <Text style={[s.pollQuestion, { color: chatPalette.foreground }]}>{pollAttachment.question}</Text>
                  {pollAttachment.options.map((option) => {
                    const vote = reactions.find((reaction) => reaction.emoji === option);
                    const voted = !!vote?.userIds.includes(profile?.uid || "");
                    return <TouchableOpacity key={option} style={[s.pollOption, { borderColor: chatPalette.border }, voted && { borderColor: chatPalette.accent, backgroundColor: "rgba(0,168,132,0.12)" }]} onPress={() => void handleReact(item.id, option)}><Text style={[s.pollOptionText, { color: chatPalette.foreground }]}>{option}</Text><Text style={[s.pollVoteCount, { color: chatPalette.muted }]}>{vote?.count ?? 0}</Text></TouchableOpacity>;
                  })}
                  <Text style={[s.pollHint, { color: chatPalette.muted }]}>Tap an option to vote</Text>
                </View>
              ) : (
                <Text style={[s.bubbleText, { color: mine ? "#e9edef" : "#e9edef" }]}>{item.text}</Text>
              )}

              <View style={s.timeRow}>
                <Text style={[s.timeText, { color: mine ? "rgba(233,237,239,0.65)" : "#8696a0" }]}>
                  {formatTime(item.createdAt)}
                  {item.isEdited && !isDeleted ? " Â· edited" : ""}
                </Text>
                {mine && !isDeleted && <Text accessibilityLabel="Sent" style={{ color: "rgba(255,255,255,0.65)", fontSize: 10 }}>  âœ“</Text>}
              </View>
            </View>

            {reactions.length > 0 && !isDeleted && !pollAttachment && (
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
                      <Text style={[s.reactionCount, byMe && { color: "#00a884" }]}>{r.count}</Text>
                    </TouchableOpacity>
                  );
                })}
                <TouchableOpacity
                  style={s.addReactionBtn}
                  onPress={() => openEmojiPicker(item.id)}
                >
                  <Ionicons name="add" size={14} color="#9CA3AF" />
                </TouchableOpacity>
              </View>
            )}


          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[s.container, { backgroundColor: chatBackground }]}>
      <View style={[s.header, { paddingTop: topPad + 8, backgroundColor: darkChat ? "#111b21" : "#ffffff", borderBottomWidth: 1, borderBottomColor: chatPalette.border }]}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={s.iconBtn}>
            <Ionicons name="arrow-back" size={22} color={chatPalette.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={s.headerAvatar} onPress={() => { setGroupTab("members"); setShowInfo(true); }} activeOpacity={0.8}>
            <Ionicons name="people" size={19} color={darkChat ? "#d7f7ef" : "#087e69"} />
          </TouchableOpacity>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => { setGroupTab("members"); setShowInfo(true); }} activeOpacity={0.8}>
            <Text style={[s.headerTitle, { color: chatPalette.foreground }]} numberOfLines={1}>{decName}</Text>
            <Text style={[s.headerSub, { color: chatPalette.muted }]} numberOfLines={1}>
              {typingUsers.length > 0
                ? `${typingUsers.slice(0, 2).join(", ")} ${typingUsers.length === 1 ? "is" : "are"} typing...`
                : groupMembers.length ? `${groupMembers.length} members${muted ? " · muted" : ""}` : "Group chat"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowSearch(!showSearch)}>
            <Ionicons name={showSearch ? "close" : "search"} size={20} color={chatPalette.foreground} />
          </TouchableOpacity>
          <TouchableOpacity style={s.iconBtn} onPress={() => setShowChatMenu(true)}>
            <Ionicons name="ellipsis-vertical" size={20} color={chatPalette.foreground} />
          </TouchableOpacity>
        </View>
        {showSearch && (
          <View style={[s.searchBar, { backgroundColor: darkChat ? "#233138" : "#f0f2f5" }]}>
            <Ionicons name="search" size={16} color="#9CA3AF" />
            <TextInput
              style={[s.searchInput, { color: chatPalette.foreground }]}
              placeholder="Search messages..."
              placeholderTextColor="#9CA3AF"
              value={searchQ}
              onChangeText={setSearchQ}
              autoFocus
            />
            {searchQ ? <TouchableOpacity onPress={() => setSearchQ("")}><Ionicons name="close-circle" size={16} color="#9CA3AF" /></TouchableOpacity> : null}
          </View>
        )}
      </View>

      {pinnedMsg && (
        <View style={[s.pinnedBanner, { backgroundColor: chatPalette.surface, borderBottomColor: chatPalette.border }]}>
          <Ionicons name="pin" size={14} color={chatPalette.accent} />
          <View style={{ flex: 1 }}>
            <Text style={[s.pinnedLabel, { color: chatPalette.accent }]}>Pinned Message</Text>
          <Text style={[s.pinnedText, { color: chatPalette.foreground }]} numberOfLines={1}>{messagePreview(pinnedMsg.text)}</Text>
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
          contentContainerStyle={[s.chatContent, { paddingBottom: 8, flexGrow: 1 }]}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={100}
          ListHeaderComponent={hasOlderMessages ? (
            <TouchableOpacity style={s.loadOlderBtn} onPress={() => void loadOlderMessages()} disabled={loadingOlderMessages}>
              {loadingOlderMessages
                ? <ActivityIndicator size="small" color={chatPalette.accent} />
                : <Text style={[s.loadOlderText, { color: chatPalette.accent }]}>Load earlier messages</Text>}
            </TouchableOpacity>
          ) : null}
          onContentSizeChange={(_, height) => {
            const previous = preserveScroll.current;
            if (previous) {
              flatListRef.current?.scrollToOffset({ offset: previous.offset + height - previous.height, animated: false });
              preserveScroll.current = null;
            }
            scrollMetrics.current.height = height;
          }}
          onScroll={(event) => {
            const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
            scrollMetrics.current.offset = contentOffset.y;
            nearBottom.current = contentOffset.y + layoutMeasurement.height >= contentSize.height - 120;
            if (nearBottom.current) setNewMessagesCount(0);
            if (contentOffset.y < 40 && hasOlderMessages && !loadingOlderRef.current) void loadOlderMessages();
          }}
          ListEmptyComponent={
            <View style={s.emptyState}>
              {loadingMessages ? (
                <Text style={[s.emptyText, { color: chatPalette.muted }]}>Loading messagesâ€¦</Text>
              ) : loadError ? (
                <TouchableOpacity onPress={() => void fetchMessages()} style={s.retryMessages}>
                  <Ionicons name="refresh-outline" size={20} color={colors.primary} />
                  <Text style={[s.emptyText, { color: colors.primary }]}>{loadError} Â· Tap to retry</Text>
                </TouchableOpacity>
              ) : (
                <>
                  <Ionicons name="chatbubbles-outline" size={40} color={colors.mutedForeground} />
                  <Text style={[s.emptyText, { color: colors.mutedForeground }]}>
                    {showSearch && searchQ ? "No messages match your search" : "No messages yet â€” say hello!"}
                  </Text>
                </>
              )}
            </View>
          }
          renderItem={renderMessage}
        />
        {newMessagesCount > 0 && (
          <TouchableOpacity
            style={[s.newMessagesButton, { backgroundColor: "#233138" }]}
            onPress={() => {
              flatListRef.current?.scrollToEnd({ animated: true });
              nearBottom.current = true;
              setNewMessagesCount(0);
            }}
            activeOpacity={0.9}
          >
            <Ionicons name="arrow-down" size={15} color="#fff" />
            <Text style={s.newMessagesText}>{newMessagesCount} new {newMessagesCount === 1 ? "message" : "messages"}</Text>
          </TouchableOpacity>
        )}

        {typingUsers.length > 0 && (
          <View style={[s.typingBanner, { backgroundColor: chatPalette.background }]}>
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
          <View style={[s.replyingTo, { backgroundColor: "#26343b" }]}>
            <View style={s.replyingToBar} />
            <View style={{ flex: 1 }}>
              <Text style={[s.replyingToName, { color: colors.primary }]}>â†© Replying to {replyTo.senderName}</Text>
              <Text style={[s.replyingToText, { color: colors.foreground }]} numberOfLines={1}>{messagePreview(replyTo.text)}</Text>
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
            maxLength={4000}
            />
            <TouchableOpacity style={s.editSave} onPress={handleEdit}>
              <Ionicons name="checkmark" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingMsg(null); setEditText(""); }}>
              <Ionicons name="close" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        )}

        {showComposerEmojis && (
          <View style={[s.composerEmojiBar, { backgroundColor: chatPalette.surface, borderTopColor: chatPalette.border }]}>
            {QUICK_REACTIONS.map((emoji) => (
              <TouchableOpacity key={emoji} onPress={() => setText((current) => `${current}${emoji}`)}>
                <Text style={s.composerEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.allEmojiButton} onPress={() => openEmojiPicker()}><Text style={s.allEmojiText}>All</Text></TouchableOpacity>
          </View>
        )}
        <View style={[s.inputBar, { backgroundColor: darkChat ? "#111b21" : "#f0f2f5", borderTopColor: chatPalette.border, paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={[s.composerPill, { backgroundColor: darkChat ? "#202c33" : "#ffffff" }]}>
            <TouchableOpacity style={s.emojiToggle} onPress={() => setShowComposerEmojis((shown) => !shown)}>
              <Ionicons name="happy-outline" size={22} color={chatPalette.muted} />
            </TouchableOpacity>

          <TextInput
            style={[s.input, { backgroundColor: "transparent", color: chatPalette.foreground }]}
            placeholder="Message"
            placeholderTextColor={chatPalette.muted}
            value={text}
            onChangeText={handleTextChange}
            multiline
            maxLength={4000}
            returnKeyType="send"
            onSubmitEditing={handleSend}
          />

            {!text.trim() && <TouchableOpacity style={s.composerAction} onPress={() => setShowAttachMenu(true)} disabled={sending}>
              <Ionicons name="attach" size={24} color={chatPalette.muted} />
            </TouchableOpacity>}
            {!text.trim() && <TouchableOpacity style={s.composerAction} onPress={() => void chooseImage(true)} disabled={sending}>
              <Ionicons name="camera-outline" size={23} color={chatPalette.muted} />
            </TouchableOpacity>}
          </View>
          <TouchableOpacity
            style={[s.sendBtn, { backgroundColor: "#00a884" }]}
            onPress={text.trim() ? handleSend : () => showToast("Voice messages are not available yet")}
            disabled={sending}
            accessibilityLabel={text.trim() ? "Send message" : "Voice messages unavailable"}
          >
            <Ionicons name={text.trim() ? "send" : "mic"} size={19} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showChatMenu} transparent animationType="fade" onRequestClose={() => setShowChatMenu(false)}>
        <Pressable style={s.menuBackdrop} onPress={() => setShowChatMenu(false)}>
          <View style={[s.chatMenu, { backgroundColor: darkChat ? "#233138" : "#ffffff" }]}>
            {[
              { label: "Group info", icon: "people-outline" as const, action: () => { setShowChatMenu(false); setGroupTab("members"); setShowInfo(true); } },
              { label: "Group media", icon: "images-outline" as const, action: () => { setShowChatMenu(false); setGroupTab("media"); setShowInfo(true); } },
              { label: "Search", icon: "search-outline" as const, action: () => { setShowChatMenu(false); setShowSearch(true); } },
              { label: muted ? "Unmute notifications" : "Mute notifications", icon: "notifications-outline" as const, action: () => { setShowChatMenu(false); void updateInboxPreference("muted", !muted); } },
              { label: "Chat theme", icon: "color-palette-outline" as const, action: () => { setShowChatMenu(false); setGroupTab("settings"); setShowInfo(true); } },
              { label: "More settings", icon: "ellipsis-horizontal" as const, action: () => { setShowChatMenu(false); setGroupTab("settings"); setShowInfo(true); } },
            ].map((item) => <TouchableOpacity key={item.label} style={s.chatMenuItem} onPress={item.action}><Ionicons name={item.icon} size={19} color={chatPalette.foreground} /><Text style={[s.chatMenuText, { color: chatPalette.foreground }]}>{item.label}</Text></TouchableOpacity>)}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showEmojiPicker} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowEmojiPicker(false)}>
        <View style={[s.emojiModal, { backgroundColor: darkChat ? "#111b21" : "#ffffff" }]}>
          <View style={[s.emojiModalHeader, { borderBottomColor: chatPalette.border }]}>
            <Text style={[s.emojiModalTitle, { color: chatPalette.foreground }]}>{emojiTargetId ? "React to message" : "Choose an emoji"}</Text>
            <TouchableOpacity onPress={() => setShowEmojiPicker(false)}><Ionicons name="close" size={24} color={chatPalette.foreground} /></TouchableOpacity>
          </View>
          <View style={[s.emojiSearch, { backgroundColor: darkChat ? "#202c33" : "#f0f2f5" }]}>
            <Ionicons name="search" size={18} color={chatPalette.muted} />
            <TextInput style={[s.emojiSearchInput, { color: chatPalette.foreground }]} placeholder="Search or type any emoji" placeholderTextColor={chatPalette.muted} value={emojiSearch} onChangeText={setEmojiSearch} />
            {!!emojiSearch && <TouchableOpacity onPress={() => chooseEmoji(emojiSearch)}><Text style={{ color: chatPalette.accent, fontFamily: "Inter_600SemiBold" }}>Use</Text></TouchableOpacity>}
          </View>
          <ScrollView keyboardShouldPersistTaps="always" contentContainerStyle={s.emojiCategories}>
            {Object.entries(EMOJI_CATEGORIES).map(([category, value]) => {
              const categoryEmojis = value.split(" ");
              const filteredEmojis = emojiSearch ? categoryEmojis.filter((emoji) => emoji.includes(emojiSearch)) : categoryEmojis;
              if (!filteredEmojis.length) return null;
              return <View key={category}>
                <Text style={[s.emojiCategoryTitle, { color: chatPalette.muted }]}>{category}</Text>
                <View style={s.emojiGrid}>{filteredEmojis.map((emoji, index) => <TouchableOpacity key={`${emoji}-${index}`} style={s.emojiCell} onPress={() => chooseEmoji(emoji)}><Text style={s.emojiCellText}>{emoji}</Text></TouchableOpacity>)}</View>
              </View>;
            })}
            {emojiSearch && !EMOJIS.some((emoji) => emoji.includes(emojiSearch)) && <Text style={[s.infoEmpty, { color: chatPalette.muted }]}>Type an emoji and tap Use to insert it.</Text>}
          </ScrollView>
        </View>
      </Modal>

      {/* Context Menu */}
      <Modal visible={!!ctxMenu} transparent animationType="fade" onRequestClose={() => setCtxMenu(null)}>
        <Pressable style={s.overlay} onPress={() => setCtxMenu(null)}>
          <View style={s.ctxCard}>
            <Text style={s.ctxPreview} numberOfLines={2}>{ctxMenu ? messagePreview(ctxMenu.text) : ""}</Text>
            <View style={s.ctxEmojiRow}>
              {QUICK_REACTIONS.map((e) => (
                <TouchableOpacity key={e} onPress={() => ctxMenu && handleReact(ctxMenu.id, e)}>
                  <Text style={{ fontSize: 26 }}>{e}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => ctxMenu && openEmojiPicker(ctxMenu.id)}><Ionicons name="add-circle-outline" size={26} color="#8696a0" /></TouchableOpacity>
            </View>
            {[
              { icon: "return-down-forward-outline" as const, label: "Reply", action: () => { setReplyTo(ctxMenu!); setCtxMenu(null); } },
              ...(isAdmin ? [{ icon: "pin-outline" as const, label: "Pin Message", action: () => { if (ctxMenu) setPinnedMsg({ id: ctxMenu.id, text: messagePreview(ctxMenu.text), senderName: ctxMenu.senderName || "Unknown" }); setCtxMenu(null); } }] : []),
              ...(isMe(ctxMenu?.senderId) && !parseImageAttachment(ctxMenu?.text ?? "") && !parseLocationAttachment(ctxMenu?.text ?? "") && !parseContactAttachment(ctxMenu?.text ?? "") && !parsePollAttachment(ctxMenu?.text ?? "") ? [{ icon: "create-outline" as const, label: "Edit Message", action: () => { setEditingMsg(ctxMenu!); setEditText(ctxMenu?.text || ""); setCtxMenu(null); } }] : []),
              ...(isMe(ctxMenu?.senderId) || isAdmin ? [{ icon: "trash-outline" as const, label: "Delete Message", action: () => { if (ctxMenu) setDeleteTarget(ctxMenu); setCtxMenu(null); }, danger: true }] : []),
              ...(ctxMenu?.senderId && !isMe(ctxMenu.senderId) ? [{ icon: "person-remove-outline" as const, label: `Report ${ctxMenu.senderName ?? "User"}`, action: () => { setCtxMenu(null); router.push({ pathname: "/(screens)/report-user" as any, params: { userId: ctxMenu.senderId! } }); } }] : []),
            ].map((opt) => (
              <TouchableOpacity key={opt.label} style={s.ctxRow} onPress={opt.action}>
                <Ionicons name={opt.icon} size={20} color={(opt as any).danger ? "#EF4444" : "#374151"} />
                <Text style={[s.ctxLabel, (opt as any).danger && { color: "#EF4444" }]}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!deleteTarget} transparent animationType="fade" onRequestClose={() => setDeleteTarget(null)}>
        <View style={s.confirmOverlay}>
          <View style={s.confirmCard}>
            <Text style={s.confirmTitle}>Delete this message?</Text>
            <Text style={s.confirmText}>It will be removed from the group chat for everyone.</Text>
            <View style={s.confirmActions}>
              <TouchableOpacity style={s.confirmCancel} onPress={() => setDeleteTarget(null)}>
                <Text style={s.confirmCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmDelete}
                onPress={() => {
                  const target = deleteTarget;
                  setDeleteTarget(null);
                  if (target) void handleDelete(target);
                }}
              >
                <Text style={s.confirmDeleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Group Info Modal */}
      <Modal visible={showInfo} animationType="slide" presentationStyle="pageSheet">
        <View style={[s.infoModal, { backgroundColor: darkChat ? "#0b141a" : "#f0f2f5" }]}>
          <View style={[s.infoHeader, { backgroundColor: darkChat ? "#111b21" : "#ffffff", borderBottomWidth: 1, borderBottomColor: chatPalette.border }]}>
            <TouchableOpacity style={s.iconBtn2} onPress={() => setShowInfo(false)}><Ionicons name="arrow-back" size={20} color={chatPalette.foreground} /></TouchableOpacity>
            <Text style={[s.infoTitle, { color: chatPalette.foreground, flex: 1, marginLeft: 10 }]} numberOfLines={1}>{decName}</Text>
            <TouchableOpacity style={s.iconBtn2} onPress={() => { setShowInfo(false); setShowSearch(true); }}><Ionicons name="search" size={20} color={chatPalette.foreground} /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ paddingBottom: 28 }}>
            <View style={[s.infoHero, { backgroundColor: darkChat ? "#111b21" : "#ffffff" }]}>
              <View style={s.infoGroupAvatar}><Ionicons name="people" size={40} color="#d7f7ef" /></View>
              <Text style={[s.infoGroupName, { color: chatPalette.foreground }]}>{decName}</Text>
              <Text style={[s.infoGroupMeta, { color: chatPalette.muted }]}>Group · {groupMembers.length} active participants</Text>
              <Text style={[s.groupDescription, { color: chatPalette.accent }]}>Add group description</Text>
              <View style={s.infoQuickActions}>
                <TouchableOpacity style={s.infoQuickAction} onPress={() => showToast("Voice chat is not available yet")}><Ionicons name="mic-outline" size={22} color={chatPalette.foreground} /><Text style={[s.infoQuickText, { color: chatPalette.foreground }]}>Voice chat</Text></TouchableOpacity>
                <TouchableOpacity style={s.infoQuickAction} onPress={() => { setShowInfo(false); setShowSearch(true); }}><Ionicons name="search" size={22} color={chatPalette.foreground} /><Text style={[s.infoQuickText, { color: chatPalette.foreground }]}>Search</Text></TouchableOpacity>
              </View>
            </View>
            <View style={[s.infoTabs, { backgroundColor: darkChat ? "#111b21" : "#ffffff", borderBottomWidth: 1, borderBottomColor: chatPalette.border }]}>
              {(["members", "media", "settings"] as const).map((tab) => <TouchableOpacity key={tab} style={[s.infoTab, groupTab === tab && { borderBottomColor: "#00a884", borderBottomWidth: 3 }]} onPress={() => setGroupTab(tab)}><Text style={[s.infoTabText, { color: groupTab === tab ? chatPalette.foreground : chatPalette.muted }]}>{tab[0].toUpperCase() + tab.slice(1)}</Text></TouchableOpacity>)}
            </View>
            {groupTab === "members" && <View style={s.infoPage}>
              <View style={s.infoCountRow}><Text style={[s.infoSectionTitle, { color: chatPalette.muted }]}>{groupMembers.length} members · active in chat</Text><TouchableOpacity onPress={() => setMemberSearch((value) => value ? "" : "a")}><Ionicons name="search" size={20} color={chatPalette.muted} /></TouchableOpacity></View>
              {memberSearch !== "" && <TextInput style={[s.memberSearch, { color: chatPalette.foreground, backgroundColor: chatPalette.surface }]} value={memberSearch.trim()} onChangeText={setMemberSearch} placeholder="Search members" placeholderTextColor={chatPalette.muted} />}
              {isAdmin && <TouchableOpacity style={s.infoMemberRow} onPress={() => setShowAddMembers(true)}><View style={[s.infoMemberAvatar, { backgroundColor: "#00a884" }]}><Ionicons name="person-add" size={18} color="#fff" /></View><Text style={[s.infoMemberName, { color: chatPalette.accent }]}>Add members</Text></TouchableOpacity>}
              {visibleMembers.map(([uid, memberName]) => <View key={uid} style={s.infoMemberRow}><View style={[s.infoMemberAvatar, { backgroundColor: darkChat ? "#26343b" : "#e9edef" }]}><Text style={{ color: chatPalette.accent, fontFamily: "Inter_700Bold", fontSize: 14 }}>{memberName?.[0]?.toUpperCase() ?? "?"}</Text></View><Text style={[s.infoMemberName, { color: chatPalette.foreground }]}>{memberName}</Text>{uid === profile?.uid && <View style={[s.youTag, { backgroundColor: "rgba(0,168,132,0.14)" }]}><Text style={[s.youTagText, { color: chatPalette.accent }]}>You</Text></View>}</View>)}
            </View>}
            {groupTab === "media" && <View style={s.infoPage}><Text style={[s.infoSectionTitle, { color: chatPalette.muted }]}>MEDIA, LINKS, AND DOCS ï¿½ {groupMedia.length} photos</Text>{groupMedia.length ? <View style={s.mediaGrid}>{groupMedia.map(({ message, attachment }) => attachment && <TouchableOpacity key={message.id} onPress={() => setPreviewImage(attachment.url)}><Image source={{ uri: attachment.url }} style={s.mediaThumb} /></TouchableOpacity>)}</View> : <Text style={[s.infoEmpty, { color: chatPalette.muted }]}>Photos shared in this chat will appear here.</Text>}<View style={[s.infoSection, { backgroundColor: darkChat ? "#111b21" : "#fff" }]}><Text style={[s.infoSectionTitle, { color: chatPalette.muted }]}>CHAT ACTIONS</Text><TouchableOpacity style={s.adminRow} onPress={exportChat}><Ionicons name="share-outline" size={19} color={chatPalette.accent} /><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Export chat</Text><Ionicons name="chevron-forward" size={16} color={chatPalette.muted} /></TouchableOpacity></View></View>}
            {groupTab === "settings" && <View style={s.infoPage}><Text style={[s.infoSectionTitle, { color: chatPalette.muted }]}>SETTINGS</Text><View style={[s.infoSection, { backgroundColor: darkChat ? "#111b21" : "#fff" }]}>
              <TouchableOpacity style={s.adminRow} onPress={() => void updateInboxPreference("muted", !muted)}><Ionicons name="notifications-outline" size={20} color={chatPalette.muted} /><View style={{ flex: 1 }}><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Notifications</Text><Text style={[s.settingSub, { color: chatPalette.muted }]}>{muted ? "Muted on this device" : "On"}</Text></View><Ionicons name={muted ? "volume-mute-outline" : "chevron-forward"} size={18} color={chatPalette.muted} /></TouchableOpacity>
              <TouchableOpacity style={s.adminRow} onPress={() => showToast("Media is shared in this group chat")}><Ionicons name="image-outline" size={20} color={chatPalette.muted} /><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Media visibility</Text><Ionicons name="chevron-forward" size={16} color={chatPalette.muted} /></TouchableOpacity>
              <View style={s.adminRow}><Ionicons name="lock-closed-outline" size={20} color={chatPalette.muted} /><View style={{ flex: 1 }}><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Transport security</Text><Text style={[s.settingSub, { color: chatPalette.muted }]}>Messages use the app connection. End-to-end encryption is not enabled.</Text></View></View>
              <TouchableOpacity style={s.adminRow} onPress={() => showToast("Disappearing messages are not available yet")}><Ionicons name="timer-outline" size={20} color={chatPalette.muted} /><View style={{ flex: 1 }}><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Disappearing messages</Text><Text style={[s.settingSub, { color: chatPalette.muted }]}>Off</Text></View><Ionicons name="chevron-forward" size={16} color={chatPalette.muted} /></TouchableOpacity>
              <View style={s.adminRow}><Ionicons name="shield-checkmark-outline" size={20} color={chatPalette.muted} /><View style={{ flex: 1 }}><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Chat lock</Text><Text style={[s.settingSub, { color: chatPalette.muted }]}>Not available in this app version</Text></View></View>
              <TouchableOpacity style={s.adminRow} onPress={() => { setDarkChat((value) => !value); saveChatPrefs({ darkChat: !darkChat }); }}><Ionicons name="color-palette-outline" size={20} color={chatPalette.muted} /><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Chat theme</Text><Text style={[s.settingSub, { color: chatPalette.muted }]}>{darkChat ? "Dark" : "Light"}</Text></TouchableOpacity>
              <TouchableOpacity style={s.adminRow} onPress={() => void updateInboxPreference("favorites", !favorite)}><Ionicons name={favorite ? "star" : "star-outline"} size={20} color={favorite ? "#f5c451" : chatPalette.muted} /><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>{favorite ? "Remove from favorites" : "Add to favorites"}</Text></TouchableOpacity>
              <TouchableOpacity style={s.adminRow} onPress={() => void updateInboxPreference("archived", !archived)}><Ionicons name={archived ? "archive" : "archive-outline"} size={20} color={chatPalette.muted} /><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>{archived ? "Unarchive chat" : "Archive chat"}</Text></TouchableOpacity>
              <TouchableOpacity style={s.adminRow} onPress={exportChat}><Ionicons name="download-outline" size={20} color={chatPalette.muted} /><Text style={[s.adminLabel, { color: chatPalette.foreground }]}>Export chat</Text><Ionicons name="chevron-forward" size={16} color={chatPalette.muted} /></TouchableOpacity>
            </View></View>}
          </ScrollView>
        </View>
      </Modal>
      <Modal visible={showAttachMenu} transparent animationType="fade" onRequestClose={() => setShowAttachMenu(false)}>
        <Pressable style={s.overlay} onPress={() => setShowAttachMenu(false)}>
          <View style={s.attachmentMenu}>
            <Text style={s.attachmentTitle}>Attach</Text>
            <TouchableOpacity style={s.attachmentOption} onPress={() => void chooseImage(false)}>
              <Ionicons name="images-outline" size={22} color="#3D5AF1" />
              <Text style={s.attachmentOptionText}>Choose from photos</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.attachmentOption} onPress={() => void chooseImage(true)}>
              <Ionicons name="camera-outline" size={22} color="#10B981" />
              <Text style={s.attachmentOptionText}>Take a photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.attachmentOption} onPress={() => void shareLocation()}>
              <Ionicons name="location-outline" size={22} color="#EF4444" />
              <Text style={s.attachmentOptionText}>Share current location</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.attachmentOption} onPress={() => { setShowAttachMenu(false); setShowContactPicker(true); }}>
              <Ionicons name="person-circle-outline" size={22} color="#0EA5E9" />
              <Text style={s.attachmentOptionText}>Share a group contact</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.attachmentOption} onPress={() => { setShowAttachMenu(false); setShowPollComposer(true); }}>
              <Ionicons name="stats-chart-outline" size={22} color="#F59E0B" />
              <Text style={s.attachmentOptionText}>Create a poll</Text>
            </TouchableOpacity>
            <Text style={s.attachmentUnavailable}>Documents, events, and AI image creation aren’t available in this app version.</Text>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showContactPicker} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowContactPicker(false)}>
        <View style={s.pickerModal}>
          <View style={s.infoHeader}><Text style={s.infoTitle}>Share a contact</Text><TouchableOpacity style={s.iconBtn2} onPress={() => setShowContactPicker(false)}><Ionicons name="close" size={22} color="#111827" /></TouchableOpacity></View>
          {members.map((member) => <TouchableOpacity key={member.id} style={s.infoMemberRow} onPress={() => void shareContact(member)}><View style={s.infoMemberAvatar}><Text style={s.avatarText}>{member.fullName[0]?.toUpperCase() || "?"}</Text></View><Text style={s.infoMemberName}>{member.fullName}</Text><Ionicons name="send-outline" size={18} color="#00a884" /></TouchableOpacity>)}
          {!members.length && <Text style={s.infoEmpty}>No group contacts are available yet.</Text>}
        </View>
      </Modal>

      <Modal visible={showAddMembers} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowAddMembers(false)}>
        <View style={s.pickerModal}>
          <View style={s.infoHeader}><Text style={s.infoTitle}>Add members</Text><TouchableOpacity style={s.iconBtn2} onPress={() => setShowAddMembers(false)}><Ionicons name="close" size={22} color="#111827" /></TouchableOpacity></View>
          <TextInput style={[s.memberSearch, { backgroundColor: "#fff" }]} value={addMemberSearch} onChangeText={setAddMemberSearch} placeholder="Search Navodayans by name" />
          {selectedAddMembers.length > 0 && <View style={s.selectedMemberChips}>{selectedAddMembers.map((member) => <TouchableOpacity key={member.id} style={s.memberChip} onPress={() => setSelectedAddMembers((current) => current.filter((item) => item.id !== member.id))}><Text style={s.memberChipText}>{member.fullName} ×</Text></TouchableOpacity>)}</View>}
          <ScrollView keyboardShouldPersistTaps="handled">
            {addMemberContacts.filter((contact) => !members.some((member) => member.id === contact.id) && !selectedAddMembers.some((member) => member.id === contact.id)).map((contact) => <TouchableOpacity key={contact.id} style={s.infoMemberRow} onPress={() => setSelectedAddMembers((current) => [...current, contact])}><View style={s.infoMemberAvatar}><Text style={s.avatarText}>{contact.fullName[0]?.toUpperCase() || "?"}</Text></View><Text style={s.infoMemberName}>{contact.fullName}</Text><Ionicons name="add-circle-outline" size={20} color="#008069" /></TouchableOpacity>)}
          </ScrollView>
          <TouchableOpacity style={[s.createPollButton, (!selectedAddMembers.length || addingMembers) && { opacity: 0.5 }]} disabled={!selectedAddMembers.length || addingMembers} onPress={() => void addSelectedMembers()}><Text style={s.createPollText}>{addingMembers ? "Adding…" : `Add ${selectedAddMembers.length} member${selectedAddMembers.length === 1 ? "" : "s"}`}</Text></TouchableOpacity>
        </View>
      </Modal>

      <Modal visible={showPollComposer} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowPollComposer(false)}>
        <View style={s.pickerModal}>
          <View style={s.infoHeader}><Text style={s.infoTitle}>Create a poll</Text><TouchableOpacity style={s.iconBtn2} onPress={() => setShowPollComposer(false)}><Ionicons name="close" size={22} color="#111827" /></TouchableOpacity></View>
          <View style={{ padding: 18 }}>
            <TextInput style={s.pollInput} value={pollQuestion} onChangeText={setPollQuestion} placeholder="Ask a question" maxLength={300} />
            {pollOptions.map((option, index) => <TextInput key={index} style={s.pollInput} value={option} onChangeText={(value) => setPollOptions((current) => current.map((item, itemIndex) => itemIndex === index ? value : item))} placeholder={`Option ${index + 1}`} maxLength={80} />)}
            {pollOptions.length < 8 && <TouchableOpacity style={s.addPollOption} onPress={() => setPollOptions((current) => [...current, ""])}><Ionicons name="add-circle-outline" size={18} color="#008069" /><Text style={{ color: "#008069", fontFamily: "Inter_600SemiBold" }}>Add option</Text></TouchableOpacity>}
            {pollOptions.length > 2 && <TouchableOpacity style={s.addPollOption} onPress={() => setPollOptions((current) => current.slice(0, -1))}><Ionicons name="remove-circle-outline" size={18} color="#6B7280" /><Text style={{ color: "#6B7280", fontFamily: "Inter_600SemiBold" }}>Remove last option</Text></TouchableOpacity>}
            <TouchableOpacity style={[s.createPollButton, (!pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2 || sending) && { opacity: 0.5 }]} onPress={() => void sendPoll()} disabled={!pollQuestion.trim() || pollOptions.filter((option) => option.trim()).length < 2 || sending}><Text style={s.createPollText}>{sending ? "Sending…" : "Send poll"}</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={!!previewImage} transparent animationType="fade" onRequestClose={() => setPreviewImage(null)}>
        <Pressable style={s.imagePreviewBackdrop} onPress={() => setPreviewImage(null)}>
          {previewImage && <Image source={{ uri: previewImage }} style={s.imagePreview} resizeMode="contain" />}
          <TouchableOpacity style={s.imagePreviewClose} onPress={() => setPreviewImage(null)}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
        </Pressable>
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
  header: { paddingHorizontal: 12, paddingBottom: 9 },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  iconBtn: { width: 36, height: 40, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  headerAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#26343b", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  headerSub: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontFamily: "Inter_400Regular" },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  searchInput: { flex: 1, color: "#fff", fontFamily: "Inter_400Regular", fontSize: 14 },
  pinnedBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#FFFBEB", borderBottomWidth: 1, borderBottomColor: "#FDE68A" },
  pinnedLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#F59E0B" },
  pinnedText: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#374151" },
  chatContent: { paddingHorizontal: 10, paddingVertical: 12, gap: 6 },
  loadOlderBtn: { alignItems: "center", paddingVertical: 8 },
  loadOlderText: { fontSize: 12, fontFamily: "Inter_600SemiBold" },
  newMessagesButton: { position: "absolute", right: 14, bottom: 78, zIndex: 2, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#3D5AF1", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, elevation: 4, shadowColor: "#111827", shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 } },
  newMessagesText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  msgRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginBottom: 4 },
  msgRowMe: { justifyContent: "flex-end" },
  msgRowThem: { justifyContent: "flex-start" },
  avatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#26343b" },
  avatarText: { fontSize: 13, fontFamily: "Inter_700Bold" },
  bubble: { paddingHorizontal: 10, paddingTop: 7, paddingBottom: 5, borderRadius: 13, gap: 3, minWidth: 80 },
  senderName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#53bdeb" },
  replyBanner: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(0,0,0,0.18)", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 4 },
  replyBannerSender: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  replyBannerText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#6B7280", flex: 1 },
  // Leave the typeface to the platform so emoji use the native color emoji font.
  bubbleText: { fontSize: 15, lineHeight: 21 },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 2 },
  timeText: { fontSize: 10, fontFamily: "Inter_400Regular" },
  attachmentMessage: { gap: 6 },
  messageImage: { width: 220, height: 190, borderRadius: 10, backgroundColor: "#E5E7EB" },
  locationMessage: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 210, paddingVertical: 6 },
  locationTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  locationCoords: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
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
  retryMessages: { alignItems: "center", gap: 10, paddingHorizontal: 20 },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center", paddingHorizontal: 24 },
  composerEmojiBar: { flexDirection: "row", justifyContent: "space-around", paddingHorizontal: 12, paddingVertical: 10, borderTopWidth: 1 },
  composerEmoji: { fontSize: 24 },
  emojiToggle: { width: 28, height: 40, alignItems: "center", justifyContent: "center" },
  inputBar: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10, paddingTop: 9, borderTopWidth: 1 },
  composerPill: { flex: 1, minHeight: 46, borderRadius: 25, flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 6, gap: 3 },
  composerAction: { width: 34, height: 42, alignItems: "center", justifyContent: "center" },
  attachBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, fontFamily: "Inter_400Regular", maxHeight: 100 },
  sendBtn: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  menuBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.28)", alignItems: "flex-end", paddingTop: 58, paddingRight: 8 },
  chatMenu: { width: 245, borderRadius: 12, paddingVertical: 6, elevation: 12, shadowColor: "#000", shadowOpacity: 0.24, shadowRadius: 16, shadowOffset: { width: 0, height: 5 } },
  chatMenuItem: { flexDirection: "row", alignItems: "center", gap: 14, paddingHorizontal: 16, paddingVertical: 13 },
  chatMenuText: { fontSize: 14, fontFamily: "Inter_500Medium" },
  emojiModal: { flex: 1, paddingBottom: 12 },
  emojiModalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1 },
  emojiModalTitle: { fontSize: 18, fontFamily: "Inter_700Bold" },
  emojiSearch: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 14, marginTop: 12, paddingHorizontal: 12, borderRadius: 12 },
  emojiSearchInput: { flex: 1, minHeight: 44, fontSize: 14 },
  emojiCategories: { padding: 14, gap: 18 },
  emojiCategoryTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 8 },
  emojiGrid: { flexDirection: "row", flexWrap: "wrap" },
  emojiCell: { width: "12.5%", minWidth: 38, height: 44, alignItems: "center", justifyContent: "center" },
  emojiCellText: { fontSize: 25 },
  allEmojiButton: { height: 34, minWidth: 44, borderRadius: 17, backgroundColor: "#26343b", alignItems: "center", justifyContent: "center" },
  allEmojiText: { color: "#e9edef", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  confirmOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", paddingHorizontal: 28 },
  confirmCard: { backgroundColor: "#fff", borderRadius: 20, padding: 20, gap: 10 },
  confirmTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#111827" },
  confirmText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 20 },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  confirmCancel: { borderRadius: 12, backgroundColor: "#F3F4F6", paddingHorizontal: 16, paddingVertical: 10 },
  confirmCancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#374151" },
  confirmDelete: { borderRadius: 12, backgroundColor: "#EF4444", paddingHorizontal: 16, paddingVertical: 10 },
  confirmDeleteText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  ctxCard: { backgroundColor: "#fff", borderRadius: 20, margin: 12, padding: 16, gap: 8 },
  ctxPreview: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", backgroundColor: "#F9FAFB", borderRadius: 10, padding: 10, marginBottom: 4 },
  ctxEmojiRow: { flexDirection: "row", justifyContent: "space-around", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", marginBottom: 6 },
  ctxRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: "#F9FAFB" },
  ctxLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: "#374151" },
  infoModal: { flex: 1, backgroundColor: "#0b141a" },
  infoHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#111b21", borderBottomWidth: 1, borderBottomColor: "#26343b" },
  infoTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#e9edef" },
  iconBtn2: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  infoGroupCard: { backgroundColor: "#fff", borderRadius: 16, padding: 20, alignItems: "center", gap: 8, borderWidth: 1, borderColor: "#F0F0F0" },
  infoGroupAvatar: { width: 72, height: 72, borderRadius: 36, alignItems: "center", justifyContent: "center" },
  infoGroupName: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  infoGroupMeta: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  infoHero: { alignItems: "center", paddingHorizontal: 20, paddingTop: 24, paddingBottom: 16 },
  groupDescription: { fontSize: 15, fontFamily: "Inter_600SemiBold", marginTop: 14 },
  infoQuickActions: { flexDirection: "row", gap: 26, marginTop: 18 },
  infoQuickAction: { width: 92, height: 76, borderRadius: 26, backgroundColor: "#26343b", alignItems: "center", justifyContent: "center", gap: 4 },
  infoQuickText: { fontSize: 12, fontFamily: "Inter_500Medium" },
  infoTabs: { flexDirection: "row", borderBottomWidth: 1, marginTop: 1 },
  infoTab: { flex: 1, alignItems: "center", paddingVertical: 14, borderBottomWidth: 3, borderBottomColor: "transparent" },
  infoTabText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  infoPage: { paddingHorizontal: 16, paddingTop: 18, gap: 6 },
  infoCountRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 },
  memberSearch: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, marginVertical: 4 },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 4, marginTop: 8 },
  mediaThumb: { width: 104, height: 104, borderRadius: 6, backgroundColor: "#26343b" },
  infoEmpty: { fontSize: 14, paddingVertical: 14 },
  settingSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, flexShrink: 1 },
  infoSection: { backgroundColor: "#111b21", borderRadius: 12, padding: 14, marginTop: 18 },
  infoSectionTitle: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#9CA3AF", letterSpacing: 0.8, marginBottom: 12 },
  infoMemberRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#F9FAFB" },
  infoMemberAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  infoMemberName: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: "#e9edef" },
  attachmentMenu: { backgroundColor: "#fff", borderRadius: 20, margin: 12, padding: 18, gap: 6 },
  attachmentTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },
  attachmentOption: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#F3F4F6" },
  attachmentOptionText: { fontSize: 15, fontFamily: "Inter_500Medium", color: "#374151" },
  attachmentUnavailable: { color: "#6B7280", fontSize: 12, lineHeight: 17, paddingTop: 6 },
  pickerModal: { flex: 1, backgroundColor: "#f5f6f8", paddingTop: 10 },
  selectedMemberChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 14, paddingVertical: 6 },
  memberChip: { borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#e1f5ef" },
  memberChipText: { color: "#008069", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  sharedContactCard: { flexDirection: "row", alignItems: "center", gap: 10, minWidth: 220, padding: 10, borderRadius: 10 },
  sharedContactAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#00a884", alignItems: "center", justifyContent: "center" },
  pollCard: { minWidth: 235, maxWidth: 290, padding: 11, borderRadius: 10, gap: 8 },
  pollQuestion: { fontSize: 15, fontFamily: "Inter_700Bold", marginBottom: 2 },
  pollOption: { minHeight: 38, borderWidth: 1, borderRadius: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  pollOptionText: { flex: 1, fontSize: 13, fontFamily: "Inter_500Medium" },
  pollVoteCount: { fontSize: 12, fontFamily: "Inter_700Bold", marginLeft: 10 },
  pollHint: { fontSize: 11 },
  pollInput: { minHeight: 46, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#fff", marginBottom: 10, borderWidth: 1, borderColor: "#d9dfe2", color: "#111827" },
  addPollOption: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8 },
  createPollButton: { marginTop: 12, borderRadius: 10, alignItems: "center", paddingVertical: 13, backgroundColor: "#008069" },
  createPollText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 15 },
  imagePreviewBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.96)", justifyContent: "center", alignItems: "center" },
  imagePreview: { width: "100%", height: "82%" },
  imagePreviewClose: { position: "absolute", top: 48, right: 20, width: 42, height: 42, borderRadius: 21, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  youTag: { backgroundColor: "#EEF2FF", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  youTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  adminSection: { backgroundColor: "#111b21", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#26343b" },
  adminRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, borderRadius: 10, paddingHorizontal: 4, marginBottom: 4 },
  adminLabel: { flex: 1, fontSize: 15, fontFamily: "Inter_500Medium", color: "#e9edef" },
  toast: { position: "absolute", bottom: 90, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center" },
  toastText: { color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
