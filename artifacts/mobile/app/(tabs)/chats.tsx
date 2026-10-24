import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  View,
  Image,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  TextInput,
  Modal,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import type { ChatContact, DirectConversation, DirectMessageRequest, Group } from "@/lib/api";

type CommunityKind = "house" | "class" | "batch" | "school" | "all" | "interest";
type GroupCard = { id: string; kind?: CommunityKind; interestId?: string; icon: any; name: string; lastMessage: string; time: string; color: string; iconColor: string; lastMessageAt?: string | null; lastMessageSenderId?: string | null; lastMessageSenderName?: string | null };
type ChatFilter = "all" | "unread" | "favorites" | "archived";
type ChatPreferences = { favorites: string[]; archived: string[]; muted: string[]; readAt: Record<string, string> };
const DEFAULT_CHAT_PREFERENCES: ChatPreferences = { favorites: [], archived: [], muted: [], readAt: {} };

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
  { id: "alumni-network", name: "JNV Alumni Network", icon: "people-outline" as const, color: "#3D5AF1" },
  { id: "upsc-aspirants", name: "UPSC Aspirants", icon: "trophy-outline" as const, color: "#F59E0B" },
  { id: "tech-careers", name: "Tech Careers", icon: "laptop-outline" as const, color: "#10B981" },
  { id: "jee-neet", name: "JEE & NEET Prep", icon: "school-outline" as const, color: "#8B5CF6" },
  { id: "arts-culture", name: "Arts & Culture", icon: "color-palette-outline" as const, color: "#EF4444" },
];

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [joinedExplore, setJoinedExplore] = useState<Set<string>>(new Set());
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupMemberSearch, setGroupMemberSearch] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<ChatContact[]>([]);
  const [joinToast, setJoinToast] = useState("");
  const [schoolGroups, setSchoolGroups] = useState<Group[]>([]);
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
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [chatPreferences, setChatPreferences] = useState<ChatPreferences>(DEFAULT_CHAT_PREFERENCES);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const preferencesKey = profile?.uid ? `chat-preferences:${profile.uid}` : null;
  const showToast = useCallback((msg: string) => {
    setJoinToast(msg);
    setTimeout(() => setJoinToast(""), 2500);
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    const refreshInbox = () => {
      api.groups.list().then((groups) => {
        if (!active) return;
        const visibleGroups = groups.filter((group) => isGroupVisibleForProfile(group, profile?.role, profile?.class));
        setSchoolGroups(visibleGroups);
        const names = new Set(visibleGroups.map((group) => normalizeGroupName(group.name)));
        setJoinedExplore(new Set(EXPLORE_GROUPS.filter((group) => names.has(normalizeGroupName(group.name))).map((group) => group.id)));
      }).catch(() => {});
      api.directMessages.conversations().then((rows) => { if (active) setDirectConversations(rows); }).catch(() => {});
      api.directMessages.requests().then((rows) => { if (active) setMessageRequests(rows); }).catch(() => {});
    };
    refreshInbox();
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
              readAt: parsed.readAt && typeof parsed.readAt === "object" ? parsed.readAt : {},
            });
          } catch { setChatPreferences(DEFAULT_CHAT_PREFERENCES); }
        } else setChatPreferences(DEFAULT_CHAT_PREFERENCES);
        setPreferencesReady(true);
      }).catch(() => setPreferencesReady(true));
    }
    return () => { active = false; clearInterval(refreshTimer); };
  }, [preferencesKey, profile?.class, profile?.role]));

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
    ? { id: `${house.toLowerCase()}-myhouse`, kind: "house" as const, icon: "home-outline" as const, name: `${house} House ${houseMeta?.emoji ?? "\u{1F3E0}"}`, lastMessage: "Tap to start a conversation", time: "", color: houseMeta?.bg ?? "#EEF2FF", iconColor: houseMeta?.color ?? "#3D5AF1" }
    : null;

  const batchOrClassGroup = (() => {
    if (!profile) return null;
    if (profile.role === "alumni" && profile.passoutYear)
      return { id: `batch-${profile.passoutYear}`, kind: "batch" as const, icon: "people-outline" as const, name: `Batch ${profile.passoutYear}`, lastMessage: "Tap to start a conversation", time: "", color: "#EEF2FF", iconColor: "#3D5AF1" };
    if (profile.role === "student" && profile.class) {
      const className = profile.class.replace(/^class\s+/i, "");
      return { id: `class-${profile.class}`, kind: "class" as const, icon: "school-outline" as const, name: `Class ${className}`, lastMessage: "Tap to start a conversation", time: "", color: "#EEF2FF", iconColor: "#3D5AF1" };
    }
    return null;
  })();

  const jnvGroup = profile?.jnvName
    ? { id: `jnv-${profile.jnvName.toLowerCase().replace(/\s+/g, "-")}`, kind: "school" as const, icon: "chatbubble-outline" as const, name: profile.jnvName, lastMessage: "Tap to start a conversation", time: "", color: "#F0FDF4", iconColor: "#10B981" }
    : null;

  const personalGroups = [batchOrClassGroup, houseGroup, jnvGroup, ALL_NAVODAYANS].filter(Boolean) as GroupCard[];
  const persistedPersonalGroups = personalGroups.map((personal) => {
    const saved = schoolGroups.find((group) => normalizeGroupName(group.name) === normalizeGroupName(personal.name));
    return saved
      ? { ...personal, id: saved.id, kind: undefined, lastMessage: previewLastMessage(saved.lastMessage), time: formatListTime(saved.lastMessageAt), lastMessageAt: saved.lastMessageAt, lastMessageSenderId: saved.lastMessageSenderId, lastMessageSenderName: saved.lastMessageSenderName }
      : personal;
  });
  const YOUR_GROUPS: GroupCard[] = [
    ...persistedPersonalGroups,
    ...schoolGroups
      .filter((group) => !persistedPersonalGroups.some((personal) => normalizeGroupName(personal.name) === normalizeGroupName(group.name)))
      .map((group) => ({ id: group.id, icon: "people-outline", name: group.name, lastMessage: previewLastMessage(group.lastMessage), time: formatListTime(group.lastMessageAt), color: "#EEF2FF", iconColor: "#3D5AF1", lastMessageAt: group.lastMessageAt, lastMessageSenderId: group.lastMessageSenderId, lastMessageSenderName: group.lastMessageSenderName })),
  ];

  const unreadIds = useMemo(() => new Set(YOUR_GROUPS.filter((group) => {
    const lastRead = chatPreferences.readAt[group.id];
    return !!group.lastMessageAt
      && group.lastMessageSenderId !== profile?.uid
      && !chatPreferences.muted.includes(group.id)
      && (!lastRead || new Date(group.lastMessageAt).getTime() > new Date(lastRead).getTime());
  }).map((group) => group.id)), [YOUR_GROUPS, chatPreferences, profile?.uid]);
  const unreadChatCount = unreadIds.size + directConversations.filter((chat) => chat.unreadCount > 0 && !chatPreferences.muted.includes(chat.id)).length;

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
    let conversations = directConversations;
    if (filter === "archived") conversations = conversations.filter((chat) => chatPreferences.archived.includes(chat.id));
    else {
      conversations = conversations.filter((chat) => !chatPreferences.archived.includes(chat.id));
      if (filter === "unread") conversations = conversations.filter((chat) => chat.unreadCount > 0 && !chatPreferences.muted.includes(chat.id));
      if (filter === "favorites") conversations = conversations.filter((chat) => chatPreferences.favorites.includes(chat.id));
    }
    if (searchQuery.trim()) conversations = conversations.filter((chat) => chat.peerName.toLowerCase().includes(searchQuery.trim().toLowerCase()));
    return [...conversations].sort((a, b) => Number(chatPreferences.favorites.includes(b.id)) - Number(chatPreferences.favorites.includes(a.id)) || new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [directConversations, filter, chatPreferences, searchQuery]);

  const updateGroupPreference = (field: "favorites" | "archived" | "muted", groupId: string) => {
    setChatPreferences((current) => {
      const values = current[field];
      return { ...current, [field]: values.includes(groupId) ? values.filter((id) => id !== groupId) : [...values, groupId] };
    });
  };

  const openGroup = async (group: GroupCard) => {
    if (openingGroup) return;
    setOpeningGroup(true);
    try {
      const chat = group.kind
        ? await api.groups.ensureCommunity({ kind: group.kind, interestId: group.interestId })
        : { id: group.id };
      setChatPreferences((current) => ({ ...current, readAt: { ...current.readAt, [chat.id]: new Date().toISOString() } }));
      router.push({ pathname: "/(screens)/group-chat" as any, params: { id: chat.id, name: group.name } });
    } catch (error) {
      showToast(chatOpenError(error, "Could not open this group"));
    } finally {
      setOpeningGroup(false);
    }
  };

  const openDirectChat = (chat: DirectConversation) => {
    router.push({ pathname: "/(screens)/direct-chat" as any, params: { id: chat.id, name: chat.peerName, peerId: chat.peerId, photoURL: chat.peerPhotoUrl || "" } });
  };

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
    if (!newGroupName.trim() || !selectedGroupMembers.length) return;
    const name = newGroupName.trim();
    setCreatingGroup(true);
    try {
      const group = await api.groups.create({ name, memberIds: selectedGroupMembers.map((member) => member.id) });
      setSchoolGroups((current) => [group, ...current.filter((item) => item.id !== group.id)]);
      setNewGroupName(""); setGroupMemberSearch(""); setSelectedGroupMembers([]); setContacts([]); setShowNewGroup(false);
      router.push({ pathname: "/(screens)/group-chat" as any, params: { id: group.id, name: group.name } });
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Could not create this group");
    } finally {
      setCreatingGroup(false);
    }
  };

  return (
    <View style={styles.container}>
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
                <Ionicons name="search-outline" size={20} color="#3D5AF1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { setSelectedContact(null); setShowNewChat(true); }} accessibilityLabel="Start a direct chat">
                <Ionicons name="person-add-outline" size={19} color="#3D5AF1" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.iconBtn} onPress={() => { setNewGroupName(""); setGroupMemberSearch(""); setSelectedGroupMembers([]); setShowNewGroup(true); }} accessibilityLabel="Create a group">
                <Ionicons name="people-outline" size={19} color="#3D5AF1" />
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
            <View style={styles.requestsIcon}><Ionicons name="mail-unread-outline" size={20} color="#3D5AF1" /></View>
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
              ["all", "All"], ["unread", `Unread${unreadChatCount ? ` (${unreadChatCount})` : ""}`], ["favorites", "Favorites"], ["archived", "Archived"],
            ] as [ChatFilter, string][]).map(([key, label]) => (
              <TouchableOpacity key={key} style={[styles.filterChip, filter === key && styles.filterChipActive]} onPress={() => setFilter(key)}>
                <Text style={[styles.filterText, filter === key && styles.filterTextActive]}>{label}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* Your Groups */}
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>{filter === "archived" ? "Archived chats" : filter === "favorites" ? "Favorite chats" : filter === "unread" ? "Unread chats" : "Recent chats"}</Text>
            <Text style={styles.chatCount}>{filtered.length + visibleDirectConversations.length}</Text>
          </View>
          {visibleDirectConversations.map((chat) => {
            const unread = chat.unreadCount > 0 && !chatPreferences.muted.includes(chat.id);
            return (
              <View key={`direct-${chat.id}`} style={styles.groupRow}>
                <TouchableOpacity style={styles.groupRowMain} onPress={() => openDirectChat(chat)} activeOpacity={0.7}>
                  <View style={[styles.groupIcon, styles.directAvatar]}>{chat.peerPhotoUrl ? <Image source={{ uri: chat.peerPhotoUrl }} style={styles.contactPhoto} /> : <Text style={styles.directAvatarText}>{chat.peerName.charAt(0).toUpperCase()}</Text>}</View>
                  <View style={styles.groupInfo}>
                    <View style={styles.groupTitleLine}>
                      <Text style={[styles.groupName, unread && styles.groupNameUnread]} numberOfLines={1}>{chat.peerName}</Text>
                      <Text style={[styles.groupTime, unread && styles.unreadText]}>{formatListTime(chat.updatedAt)}</Text>
                    </View>
                    <View style={styles.groupPreviewLine}>
                      <Text style={[styles.groupMessage, unread && styles.groupMessageUnread]} numberOfLines={1}>{previewDirectMessage(chat.lastMessage)}</Text>
                      {unread ? <View style={styles.unreadBadge} /> : null}
                    </View>
                  </View>
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
                  <TouchableOpacity style={styles.groupRowMain} activeOpacity={0.7} onPress={() => openGroup(group)}>
                    <View style={[styles.groupIcon, { backgroundColor: group.color }]}>
                      <Ionicons name={group.icon} size={22} color={group.iconColor} />
                    </View>
                    <View style={styles.groupInfo}>
                      <View style={styles.groupTitleLine}>
                        <Text style={[styles.groupName, unread && styles.groupNameUnread]} numberOfLines={1}>{group.name}</Text>
                        {group.time ? <Text style={[styles.groupTime, unread && styles.unreadText]}>{group.time}</Text> : null}
                      </View>
                      <View style={styles.groupPreviewLine}>
                        <Text style={[styles.groupMessage, unread && styles.groupMessageUnread]} numberOfLines={1}>{preview}</Text>
                        {unread ? <View style={styles.unreadBadge} /> : null}
                      </View>
                    </View>
                  </TouchableOpacity>

                </View>
              );
            })}
            {!filtered.length && !visibleDirectConversations.length && <View style={styles.emptyList}><Ionicons name={filter === "unread" ? "mail-open-outline" : "chatbubbles-outline"} size={28} color="#9CA3AF" /><Text style={styles.emptyListText}>{filter === "unread" ? "YouÃ¢â‚¬â„¢re all caught up" : filter === "archived" ? "No archived chats" : filter === "favorites" ? "Star chats to keep them here" : "No chats match your search"}</Text></View>}
          </View>
        </View>

        {!searchQuery && filter === "all" && (
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
                <Ionicons name="mail-unread-outline" size={18} color="#3D5AF1" />
                <Text style={styles.requestLinkText}>Message requests{messageRequests.length ? ` (${messageRequests.length})` : ""}</Text>
                <Ionicons name="chevron-forward" size={16} color="#9CA3AF" />
              </TouchableOpacity>
              {contactsLoading ? <ActivityIndicator style={{ marginTop: 22 }} color="#3D5AF1" /> : contacts.map((contact) => (
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
      <Modal visible={showNewGroup} animationType="slide" presentationStyle="formSheet" onRequestClose={() => setShowNewGroup(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Create group</Text>
            <TouchableOpacity onPress={() => setShowNewGroup(false)}><Ionicons name="close" size={24} color="#111" /></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.inputLabel}>Group name</Text>
            <TextInput style={styles.modalInput} placeholder="Enter group name" placeholderTextColor="#9CA3AF" value={newGroupName} onChangeText={setNewGroupName} maxLength={80} />
            <Text style={styles.inputLabel}>Add participants</Text>
            <TextInput style={styles.modalInput} placeholder="Search Navodayans by name" placeholderTextColor="#9CA3AF" value={groupMemberSearch} onChangeText={setGroupMemberSearch} />
            {selectedGroupMembers.length > 0 && <View style={styles.selectedMembers}><Text style={styles.inputLabel}>{selectedGroupMembers.length} selected</Text><View style={styles.selectedMemberChips}>{selectedGroupMembers.map((member) => <TouchableOpacity key={member.id} style={styles.memberChip} onPress={() => setSelectedGroupMembers((current) => current.filter((item) => item.id !== member.id))}><Text style={styles.memberChipText}>{member.fullName} Ã—</Text></TouchableOpacity>)}</View></View>}
            {contactsLoading ? <ActivityIndicator color="#3D5AF1" style={{ paddingVertical: 14 }} /> : contacts.filter((contact) => !selectedGroupMembers.some((selected) => selected.id === contact.id)).map((contact) => <TouchableOpacity key={contact.id} style={styles.contactRow} onPress={() => setSelectedGroupMembers((current) => [...current, contact])}><View style={[styles.groupIcon, styles.directAvatar]}>{contact.photoURL ? <Image source={{ uri: contact.photoURL }} style={styles.contactPhoto} /> : <Text style={styles.directAvatarText}>{contact.fullName.charAt(0).toUpperCase()}</Text>}</View><View style={{ flex: 1 }}><Text style={styles.groupName}>{contact.fullName}</Text><Text style={styles.contactMeta}>{contact.role} Â· {contact.jnvName}</Text></View><Ionicons name="add-circle-outline" size={22} color="#3D5AF1" /></TouchableOpacity>)}
            {groupMemberSearch.trim().length >= 2 && !contactsLoading && !contacts.length ? <Text style={styles.contactEmpty}>No people found for that name.</Text> : null}
            <TouchableOpacity style={[styles.createBtn, (!newGroupName.trim() || !selectedGroupMembers.length || creatingGroup) && { opacity: 0.5 }]} onPress={() => void handleCreateGroup()} disabled={!newGroupName.trim() || !selectedGroupMembers.length || creatingGroup}>
              <Text style={styles.createBtnText}>{creatingGroup ? "Creating groupâ€¦" : `Create group${selectedGroupMembers.length ? ` Â· ${selectedGroupMembers.length + 1} people` : ""}`}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  container: { flex: 1, backgroundColor: "#fff" },
  header: { paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", backgroundColor: "#fff" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  headerRight: { position: "absolute", right: 16, bottom: 12, flexDirection: "row", gap: 4 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  searchRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchInput: { flex: 1, backgroundColor: "#F3F4F6", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, fontSize: 14, fontFamily: "Inter_400Regular", color: "#111827" },
  cancelText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  section: { paddingHorizontal: 20, paddingTop: 20 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 5 },
  chatCount: { minWidth: 24, textAlign: "center", color: "#6B7280", backgroundColor: "#F3F4F6", borderRadius: 12, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontFamily: "Inter_600SemiBold" },
  filterRow: { paddingHorizontal: 20, paddingTop: 14, gap: 8 },
  filterChip: { borderRadius: 18, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff" },
  filterChipActive: { backgroundColor: "#EAF0FF", borderColor: "#C7D2FE" },
  filterText: { color: "#6B7280", fontSize: 13, fontFamily: "Inter_500Medium" },
  filterTextActive: { color: "#3D5AF1", fontFamily: "Inter_700Bold" },
  sectionSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", marginBottom: 14 },
  groupList: {},
  groupRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#F1F3F5", gap: 4 },
  groupRowMain: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", paddingVertical: 4, gap: 12 },
  groupIcon: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  groupInfo: { flex: 1, minWidth: 0, gap: 3 },
  groupTitleLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  groupPreviewLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  groupName: { flex: 1, fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" },
  groupNameUnread: { fontFamily: "Inter_700Bold" },
  groupMessage: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280" },
  groupMessageUnread: { color: "#374151", fontFamily: "Inter_600SemiBold" },
  unreadText: { color: "#16A34A", fontFamily: "Inter_600SemiBold" },
  unreadBadge: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#16A34A" },
  directAvatar: { backgroundColor: "#EAF0FF" },
  contactPhoto: { width: "100%", height: "100%", borderRadius: 28 },
  directAvatarText: { color: "#3D5AF1", fontSize: 19, fontFamily: "Inter_700Bold" },
  groupDividerLabel: { marginTop: 14, marginBottom: 2, color: "#9CA3AF", fontSize: 10, letterSpacing: 1, fontFamily: "Inter_700Bold" },
  requestsBanner: { marginHorizontal: 20, marginTop: 14, padding: 12, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 11, backgroundColor: "#EEF2FF" },
  requestsIcon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  requestsTitle: { color: "#111827", fontSize: 14, fontFamily: "Inter_700Bold" },
  requestsSubtitle: { color: "#6B7280", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  requestsCount: { minWidth: 24, height: 24, borderRadius: 12, paddingHorizontal: 6, alignItems: "center", justifyContent: "center", backgroundColor: "#3D5AF1" },
  requestsCountText: { color: "#fff", fontSize: 12, fontFamily: "Inter_700Bold" },
  selectedContact: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 22 },
  selectedMembers: { marginBottom: 14 },
  selectedMemberChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberChip: { borderRadius: 18, paddingHorizontal: 11, paddingVertical: 7, backgroundColor: "#EEF2FF" },
  memberChipText: { color: "#3D5AF1", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  contactMeta: { color: "#6B7280", fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 3, textTransform: "capitalize" },
  firstMessageInput: { minHeight: 110, textAlignVertical: "top" },
  requestHint: { color: "#6B7280", fontSize: 12, fontFamily: "Inter_400Regular", marginBottom: 14 },
  requestLink: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F1F3F5" },
  requestLinkText: { flex: 1, color: "#374151", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  contactRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F1F3F5" },
  contactEmpty: { color: "#6B7280", fontSize: 13, textAlign: "center", paddingVertical: 28, fontFamily: "Inter_400Regular" },
  requestList: { padding: 16, gap: 12 },
  requestCard: { backgroundColor: "#fff", padding: 16, borderRadius: 16, borderWidth: 1, borderColor: "#E5E7EB" },
  requestMessage: { color: "#374151", fontSize: 14, lineHeight: 20, marginTop: 8, fontFamily: "Inter_400Regular" },
  requestActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 8 },
  declineButton: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 18, backgroundColor: "#F3F4F6" },
  declineText: { color: "#4B5563", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  acceptButton: { paddingHorizontal: 18, paddingVertical: 9, borderRadius: 18, backgroundColor: "#3D5AF1" },
  acceptText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyList: { alignItems: "center", paddingVertical: 34, gap: 10 },
  emptyListText: { color: "#6B7280", fontSize: 13, fontFamily: "Inter_400Regular" },
  groupRight: { alignItems: "flex-end", gap: 4 },
  groupTime: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#3D5AF1" },

  // Explore
  exploreRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F5F5F5", gap: 14 },
  exploreIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  exploreInfo: { flex: 1 },
  exploreName: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#111827" },
  exploreMembers: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280" },
  joinSmBtn: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5 },
  joinSmText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  // Modals
  modalWrap: { flex: 1, backgroundColor: "#fff" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  modalBody: { padding: 20 },
  inputLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#374151", marginBottom: 8 },
  modalInput: { borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: "#111827", marginBottom: 16 },
  createBtn: { backgroundColor: "#3D5AF1", borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  createBtnText: { color: "#fff", fontFamily: "Inter_700Bold", fontSize: 16 },
  toast: { position: "absolute", bottom: 24, left: 24, right: 24, backgroundColor: "#1F2937", borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 8 },
  toastText: { flex: 1, color: "#fff", fontFamily: "Inter_500Medium", fontSize: 13 },
});
