import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Image,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { useVerificationGate } from "@/components/VerificationGateModal";
import { api } from "@/lib/api";
import type { ChatContact, DirectConversation, DirectMessageRequest, Group } from "@/lib/api";
import MotionPressable from "@/components/motion/MotionPressable";
import GroupNameEmojiPicker from "@/components/GroupNameEmojiPicker";
import ImageAdjustmentModal from "@/components/media/ImageAdjustmentModal";
import { ThemedText as Text, ThemedTextInput as TextInput } from "@/components/ThemedNative";

type CommunityKind = "house" | "class" | "batch" | "school" | "all" | "interest" | "staff" | "officials";
type GroupCard = { id: string; kind?: CommunityKind; interestId?: string; icon: any; name: string; avatarUrl?: string; lastMessage: string; time: string; color: string; iconColor: string; lastMessageAt?: string | null; lastMessageSenderId?: string | null; lastMessageSenderName?: string | null };
type ChatFilter = "all" | "groups" | "unread" | "favorites" | "archived";
type ChatPreferences = { favorites: string[]; archived: string[]; muted: string[]; pinned: string[]; markedUnread: string[]; readAt: Record<string, string> };
type ChatActionTarget = { id: string; name: string; kind: "group" | "direct"; lastActivityAt?: string | null; lastActivitySenderId?: string | null };
const DEFAULT_CHAT_PREFERENCES: ChatPreferences = { favorites: [], archived: [], muted: [], pinned: [], markedUnread: [], readAt: {} };

const ALL_NAVODAYANS: GroupCard = { id: "all-navodayans", kind: "all", icon: "chatbubbles-outline", name: "All Navodayans", lastMessage: "Join the JNV community conversation", time: "", color: "#FFF7ED", iconColor: "#F59E0B" };
const IMAGE_MARKER = "__NAVODAYA_IMAGE__:";
const LOCATION_MARKER = "__NAVODAYA_LOCATION__:";

function normalizeGroupName(value: string) {
  return value.replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F]/gu, "").trim().toLowerCase();
}

function isGroupVisibleForProfile(group: Group, role?: string, profileClass?: string) {
  if (normalizeGroupName(group.name) === "jnv alumni network" && role !== "alumni") return false;
  if (group.subject === "Alumni batch" && role !== "alumni") return false;
  const namedClass = group.name.match(/^class\s+([0-9]+[a-z]?)/i)?.[1];
  const classScoped = group.subject === "Class community" || !!group.class || !!namedClass;
  if (classScoped && group.subject !== "Alumni batch") {
    const classLevel = (value?: string | null) => value?.match(/^(?:class\s*)?(\d+)/i)?.[1] ?? "";
    return role === "student" && !!profileClass && !!classLevel(group.class ?? namedClass) && classLevel(group.class ?? namedClass) === classLevel(profileClass);
  }
  return true;
}

function previewLastMessage(value?: string | null) {
  if (!value) return "Tap to start a conversation";
  if (value.startsWith(LOCATION_MARKER)) return "Ã°Å¸â€œÂ Location";
  if (value.startsWith(IMAGE_MARKER)) {
    try {
      const attachment = JSON.parse(value.slice(IMAGE_MARKER.length));
      return attachment.caption || "Ã°Å¸â€œÂ· Photo";
    } catch {
      return "Ã°Å¸â€œÂ· Photo";
    }
  }
  return value;
}

function previewDirectMessage(value?: string | null) {
  if (!value) return "Start a conversation";
  if (value.startsWith(LOCATION_MARKER)) return "Location";
  if (value.startsWith(IMAGE_MARKER)) {
    try {
      const attachment = JSON.parse(value.slice(IMAGE_MARKER.length));
      return attachment.caption || "Photo";
    } catch { return "Photo"; }
  }
  return value;
}

function formatListTime(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function chatOpenError(error: unknown, fallback: string) {
  if (error instanceof Error && error.message === "Not Found") {
    return "Chat API is out of date. Restart the API server, then try again.";
  }
  return error instanceof Error ? error.message : fallback;
}

const HOUSE_META: Record<string, { color: string; bg: string; emoji: string }> = {
  Aravali:  { color: "#1D6ADE", bg: "#EFF6FF", emoji: "\u{1F499}" },
  Nilgiri:  { color: "#16A34A", bg: "#F0FDF4", emoji: "\u{1F49A}" },
  Shivalik: { color: "#DC2626", bg: "#FEF2F2", emoji: "\u2764\uFE0F" },
  Udaygiri: { color: "#D97706", bg: "#FFFBEB", emoji: "\u{1F49B}" },
};

const EXPLORE_GROUPS = [
  { id: "alumni-network", name: "JNV Alumni Network", icon: "people-outline" as const, color: "#7C3AED" },
  { id: "upsc-aspirants", name: "UPSC Aspirants", icon: "trophy-outline" as const, color: "#F59E0B" },
  { id: "tech-careers", name: "Tech Careers", icon: "laptop-outline" as const, color: "#10B981" },
  { id: "jee-neet", name: "JEE & NEET Prep", icon: "school-outline" as const, color: "#8B5CF6" },
  { id: "arts-culture", name: "Arts & Culture", icon: "color-palette-outline" as const, color: "#EF4444" },
];

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isVerified, refreshProfile } = useAuth();
  const { tryAccess, modal: verificationGate } = useVerificationGate(isVerified);
  const params = useLocalSearchParams<{ filter?: string }>();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinedExplore, setJoinedExplore] = useState<Set<string>>(new Set());
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMemberSearch, setGroupMemberSearch] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<ChatContact[]>([]);
  const [joinToast, setJoinToast] = useState("");
  const [schoolGroups, setSchoolGroups] = useState<Group[]>([]);
  const [groupLoadError, setGroupLoadError] = useState("");
  const [newGroupAvatar, setNewGroupAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [avatarToAdjust, setAvatarToAdjust] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showAvatarAdjuster, setShowAvatarAdjuster] = useState(false);
  const [staffGroupError, setStaffGroupError] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [openingGroup, setOpeningGroup] = useState(false);
  const [directConversations, setDirectConversations] = useState<DirectConversation[]>([]);
  const [messageRequests, setMessageRequests] = useState<DirectMessageRequest[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [selectedContact, setSelectedContact] = useState<ChatContact | null>(null);
  const [requestMessage, setRequestMessage] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [respondingRequestId, setRespondingRequestId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ChatFilter>(params.filter === "groups" ? "groups" : "all");
  const [chatPreferences, setChatPreferences] = useState<ChatPreferences>(DEFAULT_CHAT_PREFERENCES);
  const [chatActionTarget, setChatActionTarget] = useState<ChatActionTarget | null>(null);
  const [chatActionBusy, setChatActionBusy] = useState(false);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const preferencesKey = profile?.uid ? `chat-preferences:${profile.uid}` : null;
  const showToast = useCallback((msg: string) => {
    setJoinToast(msg);
    setTimeout(() => setJoinToast(""), 2500);
  }, []);

  useFocusEffect(useCallback(() => {
    if (params.filter === "groups") {
      setSearchQuery("");
      setFilter("groups");
      router.setParams({ filter: "" });
    }
  }, [params.filter]));

  useFocusEffect(useCallback(() => {
    let active = true;
    void refreshProfile().catch(() => {});
    const refreshInbox = () => {
      if (isVerified) api.groups.list().then((groups) => {
        if (!active) return;
        const visibleGroups = groups.filter((group) => isGroupVisibleForProfile(group, profile?.role, profile?.class));
        setSchoolGroups(visibleGroups);
        setGroupLoadError("");
        setStaffGroupError("");
        const names = new Set(visibleGroups.map((group) => normalizeGroupName(group.name)));
        setJoinedExplore(new Set(EXPLORE_GROUPS.filter((group) => names.has(normalizeGroupName(group.name))).map((group) => group.id)));
      }).catch((error) => {
        if (!active) return;
        setGroupLoadError(chatOpenError(error, "Could not load your community groups."));
        if (profile?.role === "teacher" || profile?.role === "official") {
          setStaffGroupError(error instanceof Error ? error.message : "Could not sync the Staff Group.");
        }
      });
      api.directMessages.conversations().then((rows) => { if (active) setDirectConversations(rows); }).catch(() => {});
      api.directMessages.requests().then((rows) => { if (active) setMessageRequests(rows); }).catch(() => {});
    };
    if (isVerified && (profile?.role === "teacher" || profile?.role === "official")) {
      const promises = [api.groups.ensureStaffWorkspace()];
      if (profile?.role === "official") {
        promises.push(api.groups.ensureOfficialsWorkspace());
      }
      Promise.all(promises).then(() => {
        if (!active) return;
        setStaffGroupError("");
        refreshInbox();
      }).catch((error) => {
        if (active) setStaffGroupError(error instanceof Error ? error.message : "Could not sync staff groups.");
        refreshInbox();
      });
    } else {
      refreshInbox();
    }
    const refreshTimer = setInterval(refreshInbox, 5000);
    if (preferencesKey) {
      setPreferencesReady(false);
      AsyncStorage.getItem(preferencesKey).then((stored) => {
        if (!active) return;
        if (stored) {
          try {
            const parsed = JSON.parse(stored) as Partial<ChatPreferences>;
            setChatPreferences({
              favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
              archived: Array.isArray(parsed.archived) ? parsed.archived : [],
              muted: Array.isArray(parsed.muted) ? parsed.muted : [],
              pinned: Array.isArray(parsed.pinned) ? parsed.pinned : [],
              markedUnread: Array.isArray(parsed.markedUnread) ? parsed.markedUnread : [],
              readAt: parsed.readAt && typeof parsed.readAt === "object" ? parsed.readAt : {},
            });
          } catch { setChatPreferences(DEFAULT_CHAT_PREFERENCES); }
        } else setChatPreferences(DEFAULT_CHAT_PREFERENCES);
        setPreferencesReady(true);
      }).catch(() => setPreferencesReady(true));
    }
    return () => { active = false; clearInterval(refreshTimer); };
  }, [isVerified, preferencesKey, profile?.class, profile?.role]));

  useEffect(() => {
    const creatingGroup = showNewGroup;
    const query = (creatingGroup ? groupMemberSearch : contactSearch).trim();
    if ((!showNewChat && !creatingGroup) || (!creatingGroup && selectedContact) || query.length < 2) { setContacts([]); return; }
    const timer = setTimeout(() => {
      setContactsLoading(true);
      api.users.search(query).then(setContacts).catch((error) => {
        showToast(error instanceof Error ? error.message : "Could not search people");
      }).finally(() => setContactsLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [contactSearch, groupMemberSearch, selectedContact, showNewChat, showNewGroup, showToast]);

  useEffect(() => {
    if (preferencesReady && preferencesKey) {
      AsyncStorage.setItem(preferencesKey, JSON.stringify(chatPreferences)).catch(() => {});
    }
  }, [chatPreferences, preferencesKey, preferencesReady]);

  // Groups
  const house = profile?.house ?? "";
  const houseMeta = HOUSE_META[house];
  const visibleExploreGroups = profile?.role === "alumni"
    ? EXPLORE_GROUPS
    : EXPLORE_GROUPS.filter((group) => group.id !== "alumni-network");

  const houseGroup = house && (profile?.role === "student" || profile?.role === "alumni")
    ? { id: `${house.toLowerCase()}-myhouse`, kind: "house" as const, icon: "home-outline" as const, name: `${house} House ${houseMeta?.emoji ?? "\u{1F3E0}"}`, lastMessage: "Tap to start a conversation", time: "", color: houseMeta?.bg ?? "#F5F3FF", iconColor: houseMeta?.color ?? "#7C3AED" }
    : null;

  const batchOrClassGroup = (() => {
    if (!profile) return null;
    if (profile.role === "alumni" && profile.passoutYear)
      return { id: `batch-${profile.passoutYear}`, kind: "batch" as const, icon: "people-outline" as const, name: `Batch ${profile.passoutYear}`, lastMessage: "Tap to start a conversation", time: "", color: "#F5F3FF", iconColor: "#7C3AED" };
    if (profile.role === "student" && profile.class) {
      const className = profile.class.replace(/^class\s+/i, "");
      return { id: `class-${profile.class}`, kind: "class" as const, icon: "school-outline" as const, name: `Class ${className}`, lastMessage: "Tap to start a conversation", time: "", color: "#F5F3FF", iconColor: "#7C3AED" };
    }
    return null;
  })();

  const jnvGroup = profile?.jnvName
    ? { id: `jnv-${profile.jnvName.toLowerCase().replace(/\s+/g, "-")}`, kind: "school" as const, icon: "chatbubble-outline" as const, name: profile.jnvName, lastMessage: "Tap to start a conversation", time: "", color: "#F0FDF4", iconColor: "#10B981" }
    : null;

  // JNV Officials Group: dedicated chat for JNV Officials
  const officialsGroupCard: GroupCard | null = profile?.role === "official"
    ? {
        id: "officials-group",
        kind: "officials" as const,
        icon: "shield-checkmark-outline",
        name: "JNV Officials Group",
        lastMessage: "Official administration & verification",
        time: "",
        color: "#FEF3C7",
        iconColor: "#D97706",
      }
    : null;

  // Staff Group: collaboration chat for Teachers & Officials
  const staffGroupCard: GroupCard | null = (profile?.role === "teacher" || profile?.role === "official")
    ? {
        id: "staff-group",
        kind: "staff" as const,
        icon: "people-circle-outline",
        name: "Staff Group",
        lastMessage: "Teacher & staff collaboration",
        time: "",
        color: "#EDE9FE",
        iconColor: "#6D28D9",
      }
    : null;

  const personalGroups = [
    officialsGroupCard,
    staffGroupCard,
    batchOrClassGroup,
    houseGroup,
    jnvGroup,
    ALL_NAVODAYANS,
  ].filter(Boolean) as GroupCard[];

  const persistedPersonalGroups = personalGroups.map((personal) => {
    const saved = schoolGroups.find((group) => {
      if (personal.kind === "staff" && (group.subject === "Staff Group" || normalizeGroupName(group.name) === "staff group")) return true;
      if (personal.kind === "officials" && (group.subject === "Officials Group" || normalizeGroupName(group.name) === "jnv officials group")) return true;
      return normalizeGroupName(group.name) === normalizeGroupName(personal.name);
    });
    return saved
      ? { ...personal, id: saved.id, kind: undefined, avatarUrl: saved.avatarUrl, lastMessage: previewLastMessage(saved.lastMessage), time: formatListTime(saved.lastMessageAt), lastMessageAt: saved.lastMessageAt, lastMessageSenderId: saved.lastMessageSenderId, lastMessageSenderName: saved.lastMessageSenderName }
      : personal;
  });

  const YOUR_GROUPS: GroupCard[] = [
    ...persistedPersonalGroups,
    ...schoolGroups
      .filter((group) => !persistedPersonalGroups.some((personal) =>
        normalizeGroupName(personal.name) === normalizeGroupName(group.name) ||
        (personal.kind === "staff" && group.subject === "Staff Group") ||
        (personal.kind === "officials" && group.subject === "Officials Group")
      ))
      .map((group) => {
        const isStaff = group.subject === "Staff Group";
        const isOfficial = group.subject === "Officials Group";
        return {
          id: group.id,
          icon: isOfficial ? "shield-checkmark-outline" : isStaff ? "people-circle-outline" : "people-outline",
          name: group.name,
          avatarUrl: group.avatarUrl,
          lastMessage: previewLastMessage(group.lastMessage),
          time: formatListTime(group.lastMessageAt),
          color: isOfficial ? "#FEF3C7" : isStaff ? "#EDE9FE" : "#F5F3FF",
          iconColor: isOfficial ? "#D97706" : "#7C3AED",
          lastMessageAt: group.lastMessageAt,
          lastMessageSenderId: group.lastMessageSenderId,
          lastMessageSenderName: group.lastMessageSenderName,
        };
      }),
  ];

  const unreadIds = useMemo(() => new Set(YOUR_GROUPS.filter((group) => {
    const lastRead = chatPreferences.readAt[group.id];
    const hasNewMessage = !!group.lastMessageAt
      && group.lastMessageSenderId !== profile?.uid
      && (!lastRead || new Date(group.lastMessageAt).getTime() > new Date(lastRead).getTime());
    return (hasNewMessage || chatPreferences.markedUnread.includes(group.id)) && !chatPreferences.muted.includes(group.id);
  }).map((group) => group.id)), [YOUR_GROUPS, chatPreferences, profile?.uid]);
  const unreadChatCount = unreadIds.size + directConversations.filter((chat) => (chat.unreadCount > 0 || chatPreferences.markedUnread.includes(chat.id)) && !chatPreferences.muted.includes(chat.id)).length;

  const filtered = useMemo(() => {
    let groups = YOUR_GROUPS;
    if (filter === "archived") groups = groups.filter((group) => chatPreferences.archived.includes(group.id));
    else {
      groups = groups.filter((group) => !chatPreferences.archived.includes(group.id));
      if (filter === "unread") groups = groups.filter((group) => unreadIds.has(group.id));
      if (filter === "favorites") groups = groups.filter((group) => chatPreferences.favorites.includes(group.id));
    }
    if (filter !== "archived") {
      groups = [...groups].sort((a, b) => {
        const pinnedOrder = Number(chatPreferences.pinned.includes(b.id)) - Number(chatPreferences.pinned.includes(a.id));
        if (pinnedOrder) return pinnedOrder;
        const favoriteOrder = Number(chatPreferences.favorites.includes(b.id)) - Number(chatPreferences.favorites.includes(a.id));
        if (favoriteOrder) return favoriteOrder;
        const aTime = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
        const bTime = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
        return bTime - aTime;
      });
    }
    if (searchQuery.trim()) groups = groups.filter((group) => group.name.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return groups;
  }, [YOUR_GROUPS, filter, chatPreferences, unreadIds, searchQuery]);

  const visibleDirectConversations = useMemo(() => {
    let conversations = filter === "groups" ? [] : directConversations;
    if (filter === "archived") conversations = conversations.filter((chat) => chatPreferences.archived.includes(chat.id));
    else {
      conversations = conversations.filter((chat) => !chatPreferences.archived.includes(chat.id));
      if (filter === "unread") conversations = conversations.filter((chat) => chat.unreadCount > 0 && !chatPreferences.muted.includes(chat.id));
      if (filter === "favorites") conversations = conversations.filter((chat) => chatPreferences.favorites.includes(chat.id));
    }
    if (searchQuery.trim()) conversations = conversations.filter((chat) => chat.peerName.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return [...conversations].sort((a, b) =>
      Number(chatPreferences.pinned.includes(b.id)) - Number(chatPreferences.pinned.includes(a.id))
      || Number(chatPreferences.favorites.includes(b.id)) - Number(chatPreferences.favorites.includes(a.id))
      || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [directConversations, filter, chatPreferences, searchQuery]);

  const updateGroupPreference = (field: "favorites" | "archived" | "muted" | "pinned", groupId: string) => {
    setChatPreferences((current) => {
      const values = current[field];
      return { ...current, [field]: values.includes(groupId) ? values.filter((id) => id !== groupId) : [...values, groupId] };
    });
  };

  const showChatActions = (target: ChatActionTarget) => setChatActionTarget(target);

  const toggleMarkedUnread = (chatId: string) => {
    setChatPreferences((current) => ({
      ...current,
      markedUnread: current.markedUnread.includes(chatId)
        ? current.markedUnread.filter((id) => id !== chatId)
        : [...current.markedUnread, chatId],
    }));
  };

  const applyChatAction = async (action: "pinned" | "favorites" | "muted" | "archived" | "markUnread" | "markRead") => {
    if (!chatActionTarget || chatActionBusy) return;
    if (action === "markUnread") {
      toggleMarkedUnread(chatActionTarget.id);
      setChatActionTarget(null);
      return;
    }
    if (action === "markRead" && chatActionTarget.kind === "direct") {
      setChatActionBusy(true);
      try {
        await api.directMessages.messages(chatActionTarget.id);
        const conversations = await api.directMessages.conversations();
        setDirectConversations(conversations);
        setChatPreferences((current) => ({
          ...current,
          markedUnread: current.markedUnread.filter((id) => id !== chatActionTarget.id),
        }));
        setChatActionTarget(null);
      } catch (error) {
        showToast(error instanceof Error ? error.message : "Could not mark chat as read");
      } finally {
        setChatActionBusy(false);
      }
      return;
    }
    if (action === "markRead") {
      setChatPreferences((current) => ({
        ...current,
        readAt: { ...current.readAt, [chatActionTarget.id]: chatActionTarget.lastActivityAt || new Date().toISOString() },
        markedUnread: current.markedUnread.filter((id) => id !== chatActionTarget.id),
      }));
    } else if (chatActionTarget.kind === "group") {
      updateGroupPreference(action, chatActionTarget.id);
    } else {
      setChatPreferences((current) => {
        const values = current[action];
        return { ...current, [action]: values.includes(chatActionTarget.id) ? values.filter((id) => id !== chatActionTarget.id) : [...values, chatActionTarget.id] };
      });
    }
    setChatActionTarget(null);
  };

  const openGroup = async (group: GroupCard) => {
    if (!tryAccess(group.name)) return;
    if (openingGroup) return;
    setOpeningGroup(true);
    try {
      let chatId = group.id;
      if (group.kind === "staff") {
        const staffGroup = await api.groups.ensureStaffWorkspace();
        chatId = staffGroup.id;
      } else if (group.kind === "officials") {
        const officialGroup = await api.groups.ensureOfficialsWorkspace();
        chatId = officialGroup.id;
      } else if (group.kind) {
        const chat = await api.groups.ensureCommunity({ kind: group.kind, interestId: group.interestId });
        chatId = chat.id;
      }
      setChatPreferences((current) => ({ ...current, readAt: { ...current.readAt, [chatId]: group.lastMessageAt ?? new Date().toISOString() }, markedUnread: current.markedUnread.filter((id) => id !== chatId) }));
      router.push({ pathname: "/(screens)/group-chat" as any, params: { id: chatId, name: group.name } });
    } catch (error) {
      showToast(chatOpenError(error, "Could not open this group"));
    } finally {
      setOpeningGroup(false);
    }
  };

  const openDirectChat = (chat: DirectConversation) => {
    setChatPreferences((current) => ({ ...current, markedUnread: current.markedUnread.filter((id) => id !== chat.id) }));
    router.push({ pathname: "/(screens)/direct-chat" as any, params: { id: chat.id, name: chat.peerName, peerId: chat.peerId, photoURL: chat.peerPhotoUrl || "" } });
  };

  const chatActionIsUnread = chatActionTarget ? chatActionTarget.kind === "group"
    ? chatPreferences.markedUnread.includes(chatActionTarget.id)
      || (!!chatActionTarget.lastActivityAt && chatActionTarget.lastActivitySenderId !== profile?.uid
        && (!chatPreferences.readAt[chatActionTarget.id] || new Date(chatActionTarget.lastActivityAt).getTime() > new Date(chatPreferences.readAt[chatActionTarget.id]).getTime()))
    : (directConversations.find((chat) => chat.id === chatActionTarget.id)?.unreadCount ?? 0) > 0 || chatPreferences.markedUnread.includes(chatActionTarget.id)
    : false;

  const selectContact = (contact: ChatContact) => {
    const conversation = directConversations.find((item) => item.peerId === contact.id);
    if (conversation) {
      setShowNewChat(false);
      setSelectedContact(null);
      openDirectChat(conversation);
      return;
    }
    setSelectedContact(contact);
    setRequestMessage("");
  };

  const sendFirstMessage = async () => {
    if (!selectedContact || !requestMessage.trim() || sendingRequest) return;
    setSendingRequest(true);
    try {
      await api.directMessages.sendRequest(selectedContact.id, requestMessage.trim());
      showToast("Message request sent");
      setSelectedContact(null); setRequestMessage(""); setContactSearch(""); setShowNewChat(false);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not send message request");
    } finally { setSendingRequest(false); }
  };

  const respondToMessageRequest = async (requestId: string, decision: "accept" | "decline") => {
    setRespondingRequestId(requestId);
    try {
      await api.directMessages.respondToRequest(requestId, decision);
      setMessageRequests((current) => current.filter((request) => request.id !== requestId));
      if (decision === "accept") {
        const conversations = await api.directMessages.conversations();
        setDirectConversations(conversations);
        const accepted = conversations.find((conversation) => conversation.peerId === messageRequests.find((request) => request.id === requestId)?.senderId);
        if (accepted) { setShowRequests(false); openDirectChat(accepted); }
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not update message request");
    } finally { setRespondingRequestId(null); }
  };

  const toggleExplore = async (id: string, name: string) => {
    if (!tryAccess(name)) return;
    try {
      const group = await api.groups.ensureCommunity({ kind: "interest", interestId: id });
      if (!joinedExplore.has(id)) {
        setSchoolGroups((current) => [group, ...current.filter((item) => item.id !== group.id)]);
        setJoinedExplore((prev) => { const next = new Set(prev); next.add(id); return next; });
      }
      router.push({ pathname: "/(screens)/group-chat" as any, params: { id: group.id, name } });
    } catch (error) {
      showToast(chatOpenError(error, "Could not join this community"));
    }
  };

  const handleCreateGroup = async () => {
    if (!tryAccess("Create a group")) return;
    if (!newGroupName.trim() || !selectedGroupMembers.length) return;
    const name = newGroupName.trim();
    setCreatingGroup(true);
    let uploadedAvatarKey: string | undefined;
    try {
      if (newGroupAvatar) {
        const uploaded = await api.memories.uploadMedia(newGroupAvatar.uri, newGroupAvatar.fileName || "group-avatar.jpg", newGroupAvatar.mimeType);
        uploadedAvatarKey = uploaded.key;
      }
      const group = await api.groups.create({ name, memberIds: selectedGroupMembers.map((member) => member.id), ...(uploadedAvatarKey ? { avatarKey: uploadedAvatarKey } : {}) });
      setSchoolGroups((current) => [group, ...current.filter((item) => item.id !== group.id)]);
      setNewGroupName(""); setGroupMemberSearch(""); setSelectedGroupMembers([]); setContacts([]); setNewGroupAvatar(null); setShowNewGroup(false);
      router.push({ pathname: "/(screens)/group-chat" as any, params: { id: group.id, name: group.name } });
    } catch (error) {
      if (uploadedAvatarKey) {
        try { await api.memories.cleanupUploads([uploadedAvatarKey]); } catch {}
      }
      showToast(error instanceof Error ? error.message : "Could not create this group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const chooseGroupAvatar = async (camera = false) => {
    try {
      const permission = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) return showToast(camera ? "Allow camera access to take a group photo" : "Allow photo access to choose a group photo");
      const result = camera
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.85 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.85 });
      const asset = result.canceled ? null : result.assets?.[0] ?? null;
      if (!asset) return;
      setAvatarToAdjust(asset);
      setShowAvatarAdjuster(true);
    } catch {
      showToast("Could not open the photo picker. Please try again.");
    }
  };

  const chatActionRows = chatActionTarget ? [
    { key: "pinned" as const, title: chatPreferences.pinned.includes(chatActionTarget.id) ? "Unpin chat" : "Pin chat", icon: "pin-outline" },
    { key: "favorites" as const, title: chatPreferences.favorites.includes(chatActionTarget.id) ? "Remove from favorites" : "Add to favorites", icon: "star-outline" },
    { key: "muted" as const, title: chatPreferences.muted.includes(chatActionTarget.id) ? "Unmute notifications" : "Mute notifications", icon: "notifications-off-outline" },
    { key: "archived" as const, title: chatPreferences.archived.includes(chatActionTarget.id) ? "Restore from archive" : "Archive chat", icon: "archive-outline" },
    { key: chatActionIsUnread ? "markRead" as const : "markUnread" as const, title: chatActionIsUnread ? "Mark as read" : "Mark as unread", icon: chatActionIsUnread ? "mail-open-outline" : "mail-unread-outline" },
  ] : [];

  return (
    <View style={styles.container}>
      {verificationGate}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        {showSearch ? (
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search chats..."
              placeholderTextColor="#9CA3AF"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            <TouchableOpacity onPress={() => { setShowSearch(false); setSearchQuery(""); }}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.headerTitle}>Chats</Text>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconBtn} onPress={() => setShowSearch(true)}>
                <Ionicons name="search-outline" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { setSelectedContact(null); setShowNewChat(true); }} accessibilityLabel="Start a direct chat">
                <Ionicons name="person-add-outline" size={19} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { if (!tryAccess("Create a group")) return; setNewGroupName(""); setGroupMemberSearch(""); setSelectedGroupMembers([]); setNewGroupAvatar(null); setShowNewGroup(true); }} accessibilityLabel="Create a group">
                <Ionicons name="people-outline" size={19} color="#fff" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        keyboardShouldPersistTaps="handled"
      >
        {messageRequests.length > 0 && (
          <TouchableOpacity style={styles.requestsBanner} onPress={() => setShowRequests(true)} activeOpacity={0.85}>
            <View style={styles.requestsIcon}><Ionicons name="mail-unread-outline" size={20} color="#7C3AED" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.requestsTitle}>Message requests</Text>
              <Text style={styles.requestsSubtitle}>{messageRequests.length} {messageRequests.length === 1 ? "person wants" : "people want"} to chat</Text>
            </View>
            <View style={styles.requestsCount}><Text style={styles.requestsCountText}>{messageRequests.length}</Text></View>
          </TouchableOpacity>
        )}
        {!showSearch && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
            {([
              ["all", "All"], ["groups", "Groups"], ["unread", `Unread${unreadChatCount ? ` (${unreadChatCount})` : ""}`], ["favorites", "Favorites"], ["archived", "Archived"],
            ] as [ChatFilter, string][]).map(([key, label]) => (
              <TouchableOpacity key={key} style={[styles.filterChip, filter === key && styles.filterChipActive]} onPress={() => setFilter(key)}>
                <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {!!staffGroupError && (profile?.role === "teacher" || profile?.role === "official") && (
          <View style={styles.staffGroupError}>
            <Ionicons name="alert-circle-outline" size={18} color="#B45309" />
            <Text style={styles.staffGroupErrorText}>Staff Group could not sync: {staffGroupError}</Text>
          </View>
        )}

        {/* Group conversations live in Chats alongside direct messages. */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{filter === "archived" ? "Archived chats" : filter === "favorites" ? "Favorite chats" : filter === "unread" ? "Unread chats" : filter === "groups" ? "Community Groups" : "Recent chats"}</Text>
            <Text style={styles.chatCount}>{filtered.length + visibleDirectConversations.length}</Text>
          </View>
          {filter === "groups" ? (
            <View style={styles.communityGroupsIntro}>
              <View style={styles.communityGroupsCopy}>
                <Text style={styles.communityGroupsTitle}>Your groups, all in one place</Text>
                <Text style={styles.communityGroupsSubtitle}>Open a group chat or explore communities to join.</Text>
              </View>
              <TouchableOpacity
                style={styles.communityGroupsCreate}
                onPress={() => {
                  if (!tryAccess("Create a group")) return;
                  setNewGroupName("");
                  setGroupMemberSearch("");
                  setSelectedGroupMembers([]);
                  setNewGroupAvatar(null);
                  setShowNewGroup(true);
                }}
                accessibilityRole="button"
                accessibilityLabel="Create a community group"
              >
                <Ionicons name="add" size={17} color="#fff" />
                <Text style={styles.communityGroupsCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          {filter === "groups" && !isVerified ? (
            <View style={styles.groupAccessNotice}>
              <Ionicons name="shield-checkmark-outline" size={18} color="#8A5A00" />
              <Text style={styles.groupAccessNoticeText}>Verify your account to browse, join, and create community groups.</Text>
            </View>
          ) : null}
          {!!groupLoadError ? (
            <TouchableOpacity style={styles.groupLoadError} onPress={() => {
              api.groups.list()
                .then((groups) => {
                  setSchoolGroups(groups.filter((group) => isGroupVisibleForProfile(group, profile?.role, profile?.class)));
                  setGroupLoadError("");
                })
                .catch((error: unknown) => setGroupLoadError(chatOpenError(error, "Could not load your community groups.")));
            }} accessibilityRole="button">
              <Ionicons name="refresh-outline" size={17} color="#B42318" />
              <Text style={styles.groupLoadErrorText}>Could not load community groups. Tap to retry. {groupLoadError}</Text>
            </TouchableOpacity>
          ) : null}
          {visibleDirectConversations.map((chat) => {
            const unread = (chat.unreadCount > 0 || chatPreferences.markedUnread.includes(chat.id)) && !chatPreferences.muted.includes(chat.id);
            return (
              <View key={`direct-${chat.id}`} style={styles.groupRow}>
                <MotionPressable style={styles.groupRowMain} onPress={() => openDirectChat(chat)}>
                  <View style={[styles.groupIcon, styles.directAvatar]}>{chat.peerPhotoUrl ? <Image source={{ uri: chat.peerPhotoUrl }} style={styles.contactPhoto} /> : <Text style={styles.directAvatarText}>{chat.peerName.charAt(0).toUpperCase()}</Text>}</View>
                  <View style={styles.groupInfo}>
                    <View style={styles.groupTitleLine}>
                      <Text style={[styles.groupName, unread && styles.groupNameUnread]} numberOfLines={1}>{chat.peerName}</Text>
                      {chatPreferences.pinned.includes(chat.id) ? <Ionicons name="pin" size={13} color="#5268F5" /> : null}
                      <Text style={[styles.groupTime, unread && styles.unreadText]}>{formatListTime(chat.updatedAt)}</Text>
                    </View>
                    <View style={styles.groupPreviewLine}>
                      <Text style={[styles.groupMessage, unread && styles.groupMessageUnread]} numberOfLines={1}>{previewDirectMessage(chat.lastMessage)}</Text>
                      {unread ? <View style={styles.unreadBadge} /> : null}
                    </View>
                  </View>
                </MotionPressable>
                <TouchableOpacity style={styles.moreButton} accessibilityRole="button" accessibilityLabel={`Actions for ${chat.peerName}`} onPress={() => showChatActions({ id: chat.id, name: chat.peerName, kind: "direct", lastActivityAt: chat.updatedAt })}>
                  <Ionicons name="ellipsis-vertical" size={18} color="#8A94A6" />
                </TouchableOpacity>
              </View>
            );
          })}
          {visibleDirectConversations.length > 0 && filtered.length > 0 && <Text style={styles.groupDividerLabel}>GROUP CHATS</Text>}
          <View style={styles.groupList}>
            {filtered.map((group) => {
              const unread = unreadIds.has(group.id);
              const preview = group.lastMessageSenderId === profile?.uid ? `You: ${group.lastMessage}` : group.lastMessageSenderName ? `${group.lastMessageSenderName}: ${group.lastMessage}` : group.lastMessage;
              return (
                <View key={group.id} style={styles.groupRow}>
                  <MotionPressable style={styles.groupRowMain} onPress={() => openGroup(group)}>
                    <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
                      {group.avatarUrl ? <Image source={{ uri: group.avatarUrl }} style={styles.groupAvatarPhoto} /> : <Ionicons name={group.icon} size={22} color={group.iconColor} />}
                    </View>
                    <View style={styles.groupInfo}>
                      <View style={styles.groupTitleLine}>
                        <Text style={[styles.groupName, unread && styles.groupNameUnread]} numberOfLines={1}>{group.name}</Text>
                        {chatPreferences.pinned.includes(group.id) ? <Ionicons name="pin" size={13} color="#5268F5" /> : null}
                        {group.time ? <Text style={[styles.groupTime, unread && styles.unreadText]}>{group.time}</Text> : null}
                      </View>
                      <View style={styles.groupPreviewLine}>
                        <Text style={[styles.groupMessage, unread && styles.groupMessageUnread]} numberOfLines={1}>{preview}</Text>
                        {unread ? <View style={styles.unreadBadge} /> : null}
                      </View>
                    </View>
                  </MotionPressable>
                  {!group.kind ? <TouchableOpacity style={styles.moreButton} accessibilityRole="button" accessibilityLabel={`Actions for ${group.name}`} onPress={() => showChatActions({ id: group.id, name: group.name, kind: "group", lastActivityAt: group.lastMessageAt, lastActivitySenderId: group.lastMessageSenderId })}>
                    <Ionicons name="ellipsis-vertical" size={18} color="#8A94A6" />
                  </TouchableOpacity> : null}
                </View>
              );
            })}
            {!filtered.length && !visibleDirectConversations.length && <View style={styles.emptyList}><Ionicons name={filter === "unread" ? "mail-open-outline" : "chatbubbles-outline"} size={28} color="#9CA3AF" /><Text style={styles.emptyListText}>{filter === "unread" ? "YouÃ¢â‚¬â„¢re all caught up" : filter === "archived" ? "No archived chats" : filter === "favorites" ? "Star chats to keep them here" : filter === "groups" ? "No group chats yet" : "No chats match your search"}</Text></View>}
          </View>
        </View>

        {!searchQuery && (filter === "all" || filter === "groups") && (
          <>
            {/* Explore Groups */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Explore Groups</Text>
              {visibleExploreGroups.map((g) => {
                const joined = joinedExplore.has(g.id);
                const groupCard: GroupCard = {
                  id: g.id,
                  icon: g.icon,
                  name: g.name,
                  color: g.color,
                  iconColor: g.color,
                  kind: "interest",
                  interestId: g.id,
                  lastMessage: `Join ${g.name} and start a conversation`,
                  time: "",
                };
                return (
                  <TouchableOpacity
                    key={g.id}
                    style={styles.exploreRow}
                    activeOpacity={0.7}
                    onPress={() => { if (joined) void openGroup(groupCard); }}
                  >
                    <View style={[styles.exploreIcon, { backgroundColor: g.color + "18" }]}>
                      <Ionicons name={g.icon} size={20} color={g.color} />
                    </View>
                    <View style={styles.exploreInfo}>
                      <Text style={styles.exploreName}>{g.name}</Text>
                  <Text style={styles.exploreMembers}>Community discussion group</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.joinSmBtn, { borderColor: joined ? "#E5E7EB" : g.color, backgroundColor: joined ? g.color : "transparent" }]}
                      onPress={() => toggleExplore(g.id, g.name)}
                    >
                      <Text style={[styles.joinSmText, { color: joined ? "#fff" : g.color }]}>
                        {joined ? "Joined Ã¢Å“â€œ" : "Join"}
                      </Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      <Modal visible={!!chatActionTarget} transparent animationType="fade" onRequestClose={() => { if (!chatActionBusy) setChatActionTarget(null); }}>
        <View style={styles.actionBackdrop}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => { if (!chatActionBusy) setChatActionTarget(null); }} accessibilityLabel="Close conversation actions" />
          <View style={[styles.actionSheet, { paddingBottom: 18 + Math.max(insets.bottom, 8) }]}>
            <View style={styles.actionHandle} />
            <Text style={styles.actionTitle} numberOfLines={1}>{chatActionTarget?.name}</Text>
            {chatActionRows.map((row) => (
              <TouchableOpacity key={row.key} style={styles.actionRow} onPress={() => void applyChatAction(row.key)} disabled={chatActionBusy} accessibilityRole="button">
                {chatActionBusy && row.key === "markRead" ? <ActivityIndicator size="small" color="#7C3AED" /> : <Ionicons name={row.icon as any} size={20} color="#5268F5" />}
                <Text style={styles.actionRowText}>{row.title}</Text>
                <Ionicons name="chevron-forward" size={16} color="#A0A8B6" />
              </TouchableOpacity>
            ))}
            <Text style={styles.actionFootnote}>These chat list preferences are saved on this device.</Text>
          </View>
        </View>
      </Modal>

      {/* New Group Modal */}
      <Modal visible={showNewChat} animationType="slide" presentationStyle="formSheet" onRequestClose={() => { setShowNewChat(false); setSelectedContact(null); }}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            {selectedContact ? <TouchableOpacity onPress={() => setSelectedContact(null)}><Ionicons name="arrow-back" size={22} color="#374151" /></TouchableOpacity> : null}
            <Text style={styles.modalTitle}>{selectedContact ? "New message" : "Start a chat"}</Text>
            <TouchableOpacity onPress={() => { setShowNewChat(false); setSelectedContact(null); }}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
          </View>
          {selectedContact ? (
            <View style={styles.modalBody}>
              <View style={styles.selectedContact}>
                <View style={[styles.groupIcon, styles.directAvatar]}>{selectedContact.photoURL ? <Image source={{ uri: selectedContact.photoURL }} style={styles.contactPhoto} /> : <Text style={styles.directAvatarText}>{selectedContact.fullName.charAt(0).toUpperCase()}</Text>}</View>
                <View><Text style={styles.groupName}>{selectedContact.fullName}</Text><Text style={styles.contactMeta}>{selectedContact.role} Ã‚Â· {selectedContact.jnvName || "Navodaya Connect"}</Text></View>
              </View>
              <Text style={styles.inputLabel}>Introduce yourself</Text>
              <TextInput style={[styles.modalInput, styles.firstMessageInput]} placeholder="Write a short message request..." placeholderTextColor="#9CA3AF" value={requestMessage} onChangeText={setRequestMessage} multiline maxLength={2000} />
              <Text style={styles.requestHint}>They can accept your request before the private chat starts.</Text>
              <TouchableOpacity style={[styles.createBtn, (!requestMessage.trim() || sendingRequest) && { opacity: 0.5 }]} onPress={() => void sendFirstMessage()} disabled={!requestMessage.trim() || sendingRequest}>
                <Text style={styles.createBtnText}>{sendingRequest ? "Sending..." : "Send message request"}</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.modalBody}>
              <TextInput style={styles.modalInput} placeholder="Search Navodayans by name" placeholderTextColor="#9CA3AF" value={contactSearch} onChangeText={setContactSearch} autoFocus />
              <TouchableOpacity style={styles.requestLink} onPress={() => { setShowNewChat(false); setShowRequests(true); }}>
                <Ionicons name="mail-unread-outline" size={18} color="#7C3AED" />
                <Text style={styles.requestLinkText}>Message requests{messageRequests.length ? ` (${messageRequests.length})` : ""}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
              {contactsLoading ? <ActivityIndicator style={{ marginTop: 22 }} color="#7C3AED" /> : contacts.map((contact) => (
                <TouchableOpacity key={contact.id} style={styles.contactRow} onPress={() => selectContact(contact)}>
                  <View style={[styles.groupIcon, styles.directAvatar]}>{contact.photoURL ? <Image source={{ uri: contact.photoURL }} style={styles.contactPhoto} /> : <Text style={styles.directAvatarText}>{contact.fullName.charAt(0).toUpperCase()}</Text>}</View>
                  <View style={{ flex: 1 }}><Text style={styles.groupName}>{contact.fullName}</Text><Text style={styles.contactMeta}>{contact.role} Ã‚Â· {contact.jnvName}</Text></View>
                  <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
                </TouchableOpacity>
              ))}
              {!contactsLoading && contactSearch.trim().length >= 2 && !contacts.length ? <Text style={styles.contactEmpty}>No people found for that name.</Text> : null}
              {!contactSearch.trim() && <Text style={styles.contactEmpty}>Enter at least 2 letters to find a Navodayan.</Text>}
            </View>
          )}
        </View>
      </Modal>

      <Modal visible={showRequests} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowRequests(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}><Text style={styles.modalTitle}>Message requests</Text><TouchableOpacity onPress={() => setShowRequests(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity></View>
          <ScrollView contentContainerStyle={styles.requestList}>
            {!messageRequests.length ? <Text style={styles.contactEmpty}>You have no pending message requests.</Text> : messageRequests.map((request) => (
              <View key={request.id} style={styles.requestCard}>
                <Text style={styles.groupName}>{request.senderName}</Text>
                <Text style={styles.requestMessage}>{request.content}</Text>
                <Text style={styles.requestHint}>{new Date(request.createdAt).toLocaleDateString()}</Text>
                <View style={styles.requestActions}>
                  <TouchableOpacity style={styles.declineButton} disabled={respondingRequestId === request.id} onPress={() => void respondToMessageRequest(request.id, "decline")}><Text style={styles.declineText}>Decline</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.acceptButton} disabled={respondingRequestId === request.id} onPress={() => void respondToMessageRequest(request.id, "accept")}><Text style={styles.acceptText}>{respondingRequestId === request.id ? "Please wait..." : "Accept"}</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {/* New Group Modal */}
      <Modal visible={showNewGroup} animationType="slide" presentationStyle="formSheet" onRequestClose={() => { setShowNewGroup(false); setNewGroupAvatar(null); }}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create group</Text>
            <TouchableOpacity onPress={() => { setShowNewGroup(false); setNewGroupAvatar(null); }}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Group name</Text>
            <TextInput style={styles.modalInput} placeholder="Enter group name" placeholderTextColor="#9CA3AF" value={newGroupName} onChangeText={setNewGroupName} maxLength={80} />
            <GroupNameEmojiPicker onSelect={(emoji) => setNewGroupName((current) => `${current.trimEnd()}${current.trim() ? " " : ""}${emoji}`)} />
            <Text style={[styles.inputLabel, { marginTop: 20 }]}>Group photo</Text>
            <View style={styles.groupPhotoRow}>
              <View style={styles.groupPhotoPreview}>
                {newGroupAvatar ? <Image source={{ uri: newGroupAvatar.uri }} style={styles.groupPhotoImage} /> : <Ionicons name="people-outline" size={26} color="#7C3AED" />}
              </View>
              <View style={styles.groupPhotoActions}>
                <TouchableOpacity style={styles.groupPhotoAction} onPress={() => void chooseGroupAvatar(false)}>
                  <Ionicons name="images-outline" size={17} color="#7C3AED" /><Text style={styles.groupPhotoActionText}>{newGroupAvatar ? "Change photo" : "Choose photo"}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.groupPhotoAction} onPress={() => void chooseGroupAvatar(true)}>
                  <Ionicons name="camera-outline" size={17} color="#7C3AED" /><Text style={styles.groupPhotoActionText}>Take photo</Text>
                </TouchableOpacity>
                {newGroupAvatar ? <TouchableOpacity onPress={() => setNewGroupAvatar(null)}><Text style={styles.removeGroupPhoto}>Remove photo</Text></TouchableOpacity> : null}
              </View>
            </View>
            <Text style={styles.groupPhotoHint}>Crop, rotate, and zoom the photo before adding it.</Text>
            <Text style={styles.inputLabel}>Add participants</Text>
            <TextInput style={styles.modalInput} placeholder="Search Navodayans by name" placeholderTextColor="#9CA3AF" value={groupMemberSearch} onChangeText={setGroupMemberSearch} />
            {selectedGroupMembers.length > 0 && <View style={styles.selectedMembers}><Text style={styles.inputLabel}>{selectedGroupMembers.length} selected</Text><View style={styles.selectedMemberChips}>{selectedGroupMembers.map((member) => <TouchableOpacity key={member.id} style={styles.memberChip} onPress={() => setSelectedGroupMembers((current) => current.filter((item) => item.id !== member.id))}><Text style={styles.memberChipText}>{member.fullName} Ã—</Text></TouchableOpacity>)}</View></View>}
            {contactsLoading ? <ActivityIndicator color="#7C3AED" style={{ paddingVertical: 14 }} /> : contacts.filter((contact) => !selectedGroupMembers.some((selected) => selected.id === contact.id)).map((contact) => <TouchableOpacity key={contact.id} style={styles.contactRow} onPress={() => setSelectedGroupMembers((current) => [...current, contact])}><View style={[styles.groupIcon, styles.directAvatar]}>{contact.photoURL ? <Image source={{ uri: contact.photoURL }} style={styles.contactPhoto} /> : <Text style={styles.directAvatarText}>{contact.fullName.charAt(0).toUpperCase()}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.groupName}>{contact.fullName}</Text><Text style={styles.contactMeta}>{contact.role} Â· {contact.jnvName}</Text></View><Ionicons name="add-circle-outline" size={22} color="#7C3AED" /></TouchableOpacity>)}
            {groupMemberSearch.trim().length >= 2 && !contactsLoading && !contacts.length ? <Text style={styles.contactEmpty}>No people found for that name.</Text> : null}
            <TouchableOpacity style={[styles.createBtn, (!newGroupName.trim() || !selectedGroupMembers.length || creatingGroup) && { opacity: 0.5 }]} onPress={() => void handleCreateGroup()} disabled={!newGroupName.trim() || !selectedGroupMembers.length || creatingGroup}>
              <Text style={styles.createBtnText}>{creatingGroup ? "Creating groupâ€¦" : `Create group${selectedGroupMembers.length ? ` Â· ${selectedGroupMembers.length + 1} people` : ""}`}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
      <ImageAdjustmentModal
        visible={showAvatarAdjuster}
        asset={avatarToAdjust}
        title="Adjust group photo"
        defaultAspect="square"
        onCancel={() => { setShowAvatarAdjuster(false); setAvatarToAdjust(null); }}
        onDone={(asset) => { setNewGroupAvatar(asset); setShowAvatarAdjuster(false); setAvatarToAdjust(null); }}
      />
      {/* Toast */}
      {joinToast ? (
        <View style={styles.toast} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={16} color="#fff" />
          <Text style={styles.toastText}>{joinToast}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: { paddingHorizontal: 20, paddingBottom: 16, backgroundColor: "#7C3AED" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#fff" },
  headerRight: { position: "absolute", right: 16, bottom: 12, flexDirection: "row", gap: 6 },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, backgroundColor: "rgba(255,255,255,0.22)", borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, fontFamily: "Inter_400Regular", color: "#fff" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#fff" },
  section: { paddingHorizontal: 18, paddingTop: 20 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 4 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  chatCount: { minWidth: 26, textAlign: "center", color: "#7C3AED", backgroundColor: "#F5F3FF", borderRadius: 12, overflow: "hidden", paddingHorizontal: 9, paddingVertical: 3, fontSize: 11, fontFamily: "Inter_700Bold" },
  communityGroupsIntro: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 10, borderRadius: 16, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "#E9D5FF" },
  communityGroupsCopy: { flex: 1 },
  communityGroupsTitle: { color: "#31245A", fontSize: 13, fontFamily: "Inter_700Bold" },
  communityGroupsSubtitle: { color: "#746A87", fontSize: 11, lineHeight: 16, fontFamily: "Inter_400Regular", marginTop: 3 },
  communityGroupsCreate: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 11, borderRadius: 11, backgroundColor: "#7C3AED" },
  communityGroupsCreateText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  groupAccessNotice: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 10, borderRadius: 12, backgroundColor: "#FFF8E7" },
  groupAccessNoticeText: { flex: 1, color: "#815500", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  groupLoadError: { flexDirection: "row", alignItems: "center", gap: 8, padding: 12, marginBottom: 10, borderRadius: 12, backgroundColor: "#FEF3F2" },
  groupLoadErrorText: { flex: 1, color: "#B42318", fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium" },
  filterRow: { paddingHorizontal: 18, paddingTop: 14, gap: 8 },
  filterChip: { borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)", backgroundColor: "#FFFFFF" },
  filterChipActive: { backgroundColor: "#7C3AED", borderColor: "#7C3AED" },
  filterText: { color: "#64748B", fontSize: 13, fontFamily: "Inter_500Medium" },
  filterTextActive: { color: "#FFFFFF", fontFamily: "Inter_700Bold" },
  staffGroupError: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 18, marginTop: 12, padding: 12, backgroundColor: "#FFFBEB", borderWidth: 1, borderColor: "#FDE68A", borderRadius: 14 },
  staffGroupErrorText: { flex: 1, fontSize: 12, lineHeight: 17, fontFamily: "Inter_500Medium", color: "#92400E" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", marginBottom: 14 },
  groupList: {},
  groupRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 12, marginTop: 10, borderRadius: 20, borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)", backgroundColor: "#FFFFFF", gap: 6, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  groupRowMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", paddingVertical: 2, gap: 12 },
  moreButton: { width: 36, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  groupIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  groupAvatarPhoto: { width: 52, height: 52, borderRadius: 26 },
  groupInfo: { flex: 1, minWidth: 0, gap: 3 },
  groupTitleLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  groupPreviewLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupName: { flex: 1, fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  groupNameUnread: { color: "#1E1B4B" },
  groupMessage: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B" },
  groupMessageUnread: { color: "#1E1B4B", fontFamily: "Inter_600SemiBold" },
  unreadText: { color: "#7C3AED", fontFamily: "Inter_600SemiBold" },
  unreadBadge: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#7C3AED" },
  directAvatar: { backgroundColor: "#F5F3FF", borderWidth: 1.5, borderColor: "rgba(233, 213, 255, 0.8)" },
  contactPhoto: { width: "100%", height: "100%", borderRadius: 26 },
  directAvatarText: { color: "#7C3AED", fontSize: 19, fontFamily: "Inter_700Bold" },
  groupDividerLabel: { marginTop: 16, marginBottom: 4, color: "#7C3AED", fontSize: 11, letterSpacing: 1, fontFamily: "Inter_700Bold" },
  requestsBanner: { marginHorizontal: 18, marginTop: 14, padding: 14, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.8)", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  requestsIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFF" },
  requestsTitle: { color: "#1E1B4B", fontSize: 14, fontFamily: "Inter_700Bold" },
  requestsSubtitle: { color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  requestsCount: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 7, alignItems: "center", justifyContent: "center", backgroundColor: "#7C3AED" },
  requestsCountText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  selectedContact: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
  selectedMembers: { marginBottom: 14 },
  selectedMemberChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberChip: { borderRadius: 18, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)" },
  memberChipText: { color: "#7C3AED", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  contactMeta: { color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, textTransform: "capitalize" },
  firstMessageInput: { minHeight: 110, textAlignVertical: "top" },
  requestHint: { color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 14 },
  requestLink: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  requestLinkText: { flex: 1, color: "#1E1B4B", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  contactEmpty: { color: "#64748B", fontSize: 13, textAlign: "center", paddingVertical: 28, fontFamily: "Inter_400Regular" },
  requestList: { padding: 16, gap: 12 },
  requestCard: { backgroundColor: "#fff", padding: 16, borderRadius: 20, borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)" },
  requestMessage: { color: "#1E1B4B", fontSize: 14, lineHeight: 20, marginTop: 8, fontFamily: "Inter_400Regular" },
  requestActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 10 },
  declineButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, backgroundColor: "#F1F5F9" },
  declineText: { color: "#64748B", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  acceptButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: "#7C3AED" },
  acceptText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyList: { alignItems: "center", paddingVertical: 36, gap: 10 },
  emptyListText: { color: "#64748B", fontSize: 13, fontFamily: "Inter_400Regular" },
  groupRight: { alignItems: "flex-end", gap: 4 },
  groupTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#94A3B8" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#7C3AED" },

  // Explore
  exploreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", gap: 14 },
  exploreIcon: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  exploreInfo: { flex: 1 },
  exploreName: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  exploreMembers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  joinSmBtn: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, borderWidth: 1.5 },
  joinSmText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Modals
  actionBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15, 12, 35, 0.4)" },
  actionSheet: { backgroundColor: "#fff", borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 20, paddingTop: 12 },
  actionHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: "#E2E8F0", marginBottom: 14 },
  actionTitle: { color: "#1E1B4B", fontSize: 17, fontFamily: "Inter_700Bold", paddingBottom: 8 },
  actionRow: { minHeight: 48, flexDirection: "row", alignItems: "center", gap: 13, borderTopWidth: 1, borderTopColor: "#F1F5F9" },
  actionRowText: { flex: 1, color: "#1E1B4B", fontSize: 14, fontFamily: "Inter_500Medium" },
  actionFootnote: { color: "#94A3B8", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center", paddingTop: 9 },
  modalWrap: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", marginBottom: 8 },
  modalInput: { borderWidth: 1.5, borderColor: "rgba(233, 213, 255, 0.9)", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: "#1E1B4B", marginBottom: 16, backgroundColor: "#F8F7FF" },
  groupPhotoRow: { flexDirection: "row", alignItems: "center", gap: 14, marginBottom: 7 },
  groupPhotoPreview: { width: 70, height: 70, borderRadius: 35, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", overflow: "hidden", borderWidth: 1.5, borderColor: "#7C3AED" },
  groupPhotoImage: { width: "100%", height: "100%" },
  groupPhotoActions: { flex: 1, flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  groupPhotoAction: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, borderRadius: 20, backgroundColor: "#F5F3FF", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)" },
  groupPhotoActionText: { color: "#7C3AED", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  removeGroupPhoto: { color: "#EF4444", fontSize: 12, fontFamily: "Inter_600SemiBold", padding: 8 },
  groupPhotoHint: { color: "#94A3B8", fontSize: 11, fontFamily: "Inter_400Regular", marginBottom: 18 },
  createBtn: { backgroundColor: "#7C3AED", borderRadius: 16, paddingVertical: 15, alignItems: "center", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 4 },
  createBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 24, left: 24, right: 24, backgroundColor: "#1E1B4B", borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 },
  toastText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
