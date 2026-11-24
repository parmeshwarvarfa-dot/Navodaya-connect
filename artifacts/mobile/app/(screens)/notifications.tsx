import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListSocialNotificationsQueryKey,
  useListSocialNotifications,
} from "@workspace/api-client-react";
import { api, type SocialNotification } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { getNotificationRoute } from "@/lib/notification-navigation";
import { formatPublishDateTime } from "@/lib/date-formatting";

type FilterTab = "all" | "unread" | "mentions" | "social" | "messages" | "requests" | "opportunities" | "system";

const FILTER_TABS: { key: FilterTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "all", label: "All", icon: "albums-outline" },
  { key: "unread", label: "Unread", icon: "radio-button-on-outline" },
  { key: "social", label: "Social", icon: "heart-outline" },
  { key: "messages", label: "Messages", icon: "chatbubble-outline" },
  { key: "requests", label: "Requests", icon: "person-add-outline" },
  { key: "opportunities", label: "Jobs", icon: "briefcase-outline" },
  { key: "mentions", label: "Mentions", icon: "at-outline" },
  { key: "system", label: "System", icon: "shield-checkmark-outline" },
];

const TYPE_CONFIG: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  // Social
  memory_like: { icon: "heart", color: "#EF4444", bg: "#FEE2E2", label: "Liked memory" },
  memory_comment: { icon: "chatbubble-ellipses", color: "#8B5CF6", bg: "#EDE9FE", label: "Commented" },
  memory_reply: { icon: "arrow-undo", color: "#8B5CF6", bg: "#EDE9FE", label: "Replied" },
  memory_mention: { icon: "at", color: "#7C3AED", bg: "#F5F3FF", label: "Mentioned you" },
  comment_mention: { icon: "at", color: "#7C3AED", bg: "#F5F3FF", label: "Mentioned you" },
  yearbook_review: { icon: "book", color: "#10B981", bg: "#D1FAE5", label: "Yearbook note" },
  follow: { icon: "person-add", color: "#3B82F6", bg: "#DBEAFE", label: "Followed you" },
  follow_accepted: { icon: "people", color: "#10B981", bg: "#D1FAE5", label: "Follow accepted" },
  follow_request: { icon: "person-add", color: "#F59E0B", bg: "#FEF3C7", label: "Follow request" },

  // Connections
  connection_request: { icon: "link", color: "#7C3AED", bg: "#EDE9FE", label: "Connection request" },
  connection_accepted: { icon: "checkmark-circle", color: "#10B981", bg: "#D1FAE5", label: "Connected" },
  connection_declined: { icon: "close-circle", color: "#64748B", bg: "#F1F5F9", label: "Declined" },

  // Messages
  direct_message: { icon: "chatbubble", color: "#7C3AED", bg: "#EDE9FE", label: "Direct message" },
  direct_message_accepted: { icon: "checkmark-done", color: "#10B981", bg: "#D1FAE5", label: "Accepted" },
  direct_message_request: { icon: "mail-unread", color: "#8B5CF6", bg: "#EDE9FE", label: "Message request" },
  group_message: { icon: "chatbubbles", color: "#3B82F6", bg: "#DBEAFE", label: "Group message" },
  group_mention: { icon: "at", color: "#7C3AED", bg: "#F5F3FF", label: "Group mention" },
  group_reply: { icon: "arrow-undo", color: "#8B5CF6", bg: "#EDE9FE", label: "Group reply" },

  // Opportunities & Careers
  opportunity: { icon: "briefcase", color: "#2563EB", bg: "#DBEAFE", label: "Opportunity" },
  job_opportunity: { icon: "briefcase", color: "#2563EB", bg: "#DBEAFE", label: "Job opening" },
  internship_opportunity: { icon: "school", color: "#059669", bg: "#D1FAE5", label: "Internship" },
  scholarship_opportunity: { icon: "ribbon", color: "#D97706", bg: "#FEF3C7", label: "Scholarship" },
  competition_opportunity: { icon: "trophy", color: "#E11D48", bg: "#FFE4E6", label: "Competition" },

  // Mentorship
  mentor_request: { icon: "compass", color: "#7C3AED", bg: "#EDE9FE", label: "Mentorship request" },
  mentorship_accepted: { icon: "checkmark-circle", color: "#10B981", bg: "#D1FAE5", label: "Mentorship approved" },
  mentorship_declined: { icon: "close-circle", color: "#64748B", bg: "#F1F5F9", label: "Mentorship declined" },

  // Verification & Official System
  verification_approved: { icon: "shield-checkmark", color: "#10B981", bg: "#D1FAE5", label: "Verified" },
  verification_reviewed: { icon: "shield", color: "#7C3AED", bg: "#EDE9FE", label: "Verification update" },
  verification_decision: { icon: "shield", color: "#7C3AED", bg: "#EDE9FE", label: "Verification decision" },
  verification_decision_needed: { icon: "time", color: "#F59E0B", bg: "#FEF3C7", label: "Action required" },
  alumni_peer_request: { icon: "finger-print", color: "#7C3AED", bg: "#EDE9FE", label: "Peer verification" },
  credential_suspended: { icon: "card", color: "#EF4444", bg: "#FEE2E2", label: "Digital ID alert" },
  credential_reactivated: { icon: "card", color: "#10B981", bg: "#D1FAE5", label: "Digital ID active" },
  alumni_batch_transition: { icon: "school", color: "#8B5CF6", bg: "#EDE9FE", label: "Batch update" },
  event: { icon: "calendar", color: "#3B82F6", bg: "#DBEAFE", label: "Event" },
  event_reminder: { icon: "alarm", color: "#F59E0B", bg: "#FEF3C7", label: "Event reminder" },
  announcement: { icon: "megaphone", color: "#7C3AED", bg: "#EDE9FE", label: "Announcement" },
  news: { icon: "newspaper", color: "#2563EB", bg: "#DBEAFE", label: "Navodaya News" },
};

function getGroupTitle(dateString: string): "Today" | "Yesterday" | "This Week" | "Earlier" {
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "Earlier";
  const now = new Date();

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);

  if (d >= startOfToday) return "Today";
  if (d >= startOfYesterday) return "Yesterday";
  if (d >= startOfWeek) return "This Week";
  return "Earlier";
}

function getInitials(name?: string) {
  if (!name) return "N";
  return name.trim().split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");
  const [selectedItem, setSelectedItem] = useState<SocialNotification | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [handledRequests, setHandledRequests] = useState<Record<string, "accepted" | "declined">>({});
  const [toastMessage, setToastMessage] = useState("");

  const queryKey = getListSocialNotificationsQueryKey();
  const notificationsQuery = useListSocialNotifications({
    query: {
      queryKey,
      refetchInterval: 12_000,
    },
  });

  const rawList: SocialNotification[] = (notificationsQuery.data as any) ?? [];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2400);
  };

  // Compute live counts per filter tab
  const filterCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      all: rawList.length,
      unread: 0,
      mentions: 0,
      social: 0,
      messages: 0,
      requests: 0,
      opportunities: 0,
      system: 0,
    };

    for (const item of rawList) {
      if (!item.readAt) {
        counts.unread++;
      }
      if (["group_mention", "memory_mention", "comment_mention"].includes(item.type)) {
        counts.mentions++;
      } else if (["memory_like", "memory_comment", "memory_reply", "yearbook_review", "follow", "follow_accepted"].includes(item.type)) {
        counts.social++;
      } else if (["direct_message", "direct_message_accepted", "direct_message_request", "group_message", "group_reply"].includes(item.type)) {
        counts.messages++;
      } else if (["connection_request", "follow_request", "direct_message_request", "mentor_request", "alumni_peer_request", "verification_decision_needed"].includes(item.type)) {
        counts.requests++;
      } else if (["opportunity", "job_opportunity", "internship_opportunity", "scholarship_opportunity", "competition_opportunity"].includes(item.type)) {
        counts.opportunities++;
      } else {
        counts.system++;
      }
    }
    return counts;
  }, [rawList]);

  // Filter items according to the active tab
  const filteredList = useMemo(() => {
    return rawList.filter((item) => {
      if (activeFilter === "all") return true;
      if (activeFilter === "unread") return !item.readAt;
      if (activeFilter === "mentions") {
        return ["group_mention", "memory_mention", "comment_mention"].includes(item.type);
      }
      if (activeFilter === "social") {
        return ["memory_like", "memory_comment", "memory_reply", "yearbook_review", "follow", "follow_accepted"].includes(item.type);
      }
      if (activeFilter === "messages") {
        return ["direct_message", "direct_message_accepted", "direct_message_request", "group_message", "group_reply"].includes(item.type);
      }
      if (activeFilter === "requests") {
        return ["connection_request", "follow_request", "direct_message_request", "mentor_request", "alumni_peer_request", "verification_decision_needed"].includes(item.type);
      }
      if (activeFilter === "opportunities") {
        return ["opportunity", "job_opportunity", "internship_opportunity", "scholarship_opportunity", "competition_opportunity"].includes(item.type);
      }
      if (activeFilter === "system") {
        return [
          "verification_approved", "verification_reviewed", "verification_decision",
          "verification_admin_appointed", "verification_admin_removed", "credential_suspended",
          "credential_reactivated", "alumni_batch_transition", "academic_assignment",
          "announcement", "news", "problem_update", "report_update", "event",
          "event_reminder", "event_invitation", "event_updated", "event_cancelled",
        ].includes(item.type);
      }
      return true;
    });
  }, [rawList, activeFilter]);

  // Group into chronological sections
  const sections = useMemo(() => {
    const buckets: Record<string, SocialNotification[]> = {
      Today: [],
      Yesterday: [],
      "This Week": [],
      Earlier: [],
    };

    for (const item of filteredList) {
      const bucket = getGroupTitle(item.createdAt);
      buckets[bucket].push(item);
    }

    const result: { title: string; data: SocialNotification[] }[] = [];
    for (const key of ["Today", "Yesterday", "This Week", "Earlier"]) {
      if (buckets[key].length > 0) {
        result.push({ title: key, data: buckets[key] });
      }
    }
    return result;
  }, [filteredList]);

  // Open notification and mark as read
  const handleOpenNotification = useCallback((item: SocialNotification) => {
    router.push(getNotificationRoute(item) as any);
    if (!item.readAt) {
      void api.notifications.markRead(item.id)
        .then(() => queryClient.invalidateQueries({ queryKey }))
        .catch(() => {});
    }
  }, [queryClient, queryKey]);

  // Mark single as read
  const handleMarkRead = async (item: SocialNotification) => {
    setShowActionModal(false);
    try {
      await api.notifications.markRead(item.id);
      await queryClient.invalidateQueries({ queryKey });
      showToast("Marked as read");
    } catch {
      showToast("Could not update notification");
    }
  };

  // Mark single as unread
  const handleMarkUnread = async (item: SocialNotification) => {
    setShowActionModal(false);
    try {
      await api.notifications.markUnread(item.id);
      await queryClient.invalidateQueries({ queryKey });
      showToast("Marked as unread");
    } catch {
      showToast("Could not update notification");
    }
  };

  // Delete single notification
  const handleDelete = async (item: SocialNotification) => {
    setShowActionModal(false);
    try {
      await api.notifications.delete(item.id);
      await queryClient.invalidateQueries({ queryKey });
      showToast("Notification deleted");
    } catch {
      showToast("Could not delete notification");
    }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    if (filterCounts.unread === 0) {
      showToast("All notifications are already read");
      return;
    }
    try {
      setActionLoading(true);
      await api.notifications.markAllRead();
      await queryClient.invalidateQueries({ queryKey });
      showToast("All notifications marked as read");
    } catch {
      showToast("Failed to mark all as read");
    } finally {
      setActionLoading(false);
    }
  };

  // Inline connection request response
  const handleInlineConnection = async (item: SocialNotification, decision: "accept" | "decline") => {
    const mappedStatus: "accepted" | "declined" = decision === "accept" ? "accepted" : "declined";
    setHandledRequests((prev) => ({ ...prev, [item.id]: mappedStatus }));
    try {
      if (decision === "accept") {
        if (item.entityId) {
          await api.connections.accept(item.entityId);
        }
        showToast("Connection accepted");
      } else {
        if (item.entityId) {
          await api.connections.decline(item.entityId);
        }
        showToast("Connection declined");
      }
      await api.notifications.markRead(item.id);
      await queryClient.invalidateQueries({ queryKey });
    } catch {
      showToast("Could not complete action");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 1. Header */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.headerBtn}
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          <View style={styles.headerTitleWrap}>
            <Text style={styles.headerTitle}>Notifications</Text>
            {filterCounts.unread > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadBadgeText}>
                  {filterCounts.unread} new
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.headerRightActions}>
            <TouchableOpacity
              onPress={() => void handleMarkAllRead()}
              style={styles.headerBtn}
              accessibilityLabel="Mark all as read"
              disabled={actionLoading}
            >
              <Ionicons name="checkmark-done-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/(screens)/notification-settings" as any)}
              style={styles.headerBtn}
              accessibilityLabel="Notification settings"
            >
              <Ionicons name="settings-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* 2. Horizontal Filter Tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          style={styles.filterScrollView}
        >
          {FILTER_TABS.map((tab) => {
            const isActive = activeFilter === tab.key;
            const count = filterCounts[tab.key];
            return (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                style={[
                  styles.filterPill,
                  isActive ? styles.filterPillActive : styles.filterPillInactive,
                ]}
                activeOpacity={0.8}
              >
                <Ionicons
                  name={tab.icon}
                  size={14}
                  color={isActive ? "#7C3AED" : "#64748B"}
                />
                <Text
                  style={[
                    styles.filterText,
                    isActive ? styles.filterTextActive : styles.filterTextInactive,
                  ]}
                >
                  {tab.label}
                </Text>
                {count > 0 && tab.key !== "all" ? (
                  <View
                    style={[
                      styles.filterBadge,
                      isActive ? styles.filterBadgeActive : styles.filterBadgeInactive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterBadgeText,
                        isActive ? styles.filterBadgeTextActive : styles.filterBadgeTextInactive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </LinearGradient>

      {/* Toast banner */}
      {toastMessage ? (
        <View style={styles.toast}>
          <Ionicons name="information-circle" size={16} color="#A78BFA" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* 3. Notification List States */}
      {notificationsQuery.isLoading ? (
        <View style={styles.skeletonContainer}>
          {[1, 2, 3, 4, 5].map((i) => (
            <View key={i} style={styles.skeletonCard}>
              <View style={styles.skeletonAvatar} />
              <View style={styles.skeletonContent}>
                <View style={styles.skeletonBarShort} />
                <View style={styles.skeletonBarLong} />
                <View style={styles.skeletonBarTiny} />
              </View>
            </View>
          ))}
        </View>
      ) : notificationsQuery.isError ? (
        <View style={styles.centerState}>
          <Ionicons name="cloud-offline-outline" size={36} color="#94A3B8" />
          <Text style={styles.stateTitle}>Unable to load notifications</Text>
          <Text style={styles.stateSubtitle}>Please check your connection and try again.</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void notificationsQuery.refetch()}
          >
            <Ionicons name="reload" size={16} color="#FFFFFF" />
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : filteredList.length === 0 ? (
        <View style={styles.centerState}>
          <View style={styles.emptyIconBg}>
            <Ionicons
              name={
                activeFilter === "unread"
                  ? "mail-open-outline"
                  : activeFilter === "requests"
                  ? "people-outline"
                  : activeFilter === "opportunities"
                  ? "briefcase-outline"
                  : "notifications-off-outline"
              }
              size={36}
              color="#7C3AED"
            />
          </View>
          <Text style={styles.stateTitle}>
            {activeFilter === "unread"
              ? "You're all caught up!"
              : `No ${activeFilter} notifications`}
          </Text>
          <Text style={styles.stateSubtitle}>
            {activeFilter === "unread"
              ? "New alerts and community updates will appear here."
              : `Check back soon for updates in the ${activeFilter} category.`}
          </Text>
          {activeFilter !== "all" ? (
            <TouchableOpacity
              style={styles.viewAllBtn}
              onPress={() => setActiveFilter("all")}
            >
              <Text style={styles.viewAllBtnText}>View all notifications</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: insets.bottom + 36 },
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={notificationsQuery.isRefetching}
              onRefresh={() => void notificationsQuery.refetch()}
              tintColor="#7C3AED"
            />
          }
          renderSectionHeader={({ section: { title, data } }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionHeaderText}>{title}</Text>
              <View style={styles.sectionCountPill}>
                <Text style={styles.sectionCountText}>{data.length}</Text>
              </View>
            </View>
          )}
          renderItem={({ item }) => {
            const config = TYPE_CONFIG[item.type] ?? {
              icon: "notifications" as const,
              color: "#7C3AED",
              bg: "#F5F3FF",
              label: "Alert",
            };
            const unread = !item.readAt;
            const initials = getInitials(item.actorName);
            const isConnectionRequest = item.type === "connection_request";
            const handledStatus = handledRequests[item.id];

            return (
              <TouchableOpacity
                activeOpacity={0.88}
                onPress={() => handleOpenNotification(item)}
                onLongPress={() => {
                  setSelectedItem(item);
                  setShowActionModal(true);
                }}
                style={[
                  styles.card,
                  unread && styles.cardUnread,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${item.actorName}: ${item.message}. ${unread ? "Unread" : "Read"}`}
              >
                {/* Unread Accent Indicator */}
                {unread ? <View style={styles.unreadBar} /> : null}

                <View style={styles.cardInner}>
                  {/* Sender Avatar with Activity Icon Overlay */}
                  <View style={styles.avatarWrap}>
                    {item.actorPhotoURL ? (
                      <Image
                        source={{ uri: item.actorPhotoURL }}
                        style={styles.avatarImg}
                      />
                    ) : (
                      <View style={[styles.avatarFallback, { backgroundColor: config.bg }]}>
                        <Text style={[styles.avatarInitial, { color: config.color }]}>
                          {initials}
                        </Text>
                      </View>
                    )}
                    {/* Activity Badge Overlay */}
                    <View style={[styles.badgeOverlay, { backgroundColor: config.color }]}>
                      <Ionicons name={config.icon} size={11} color="#FFFFFF" />
                    </View>
                  </View>

                  {/* Notification Content */}
                  <View style={styles.cardContent}>
                    <View style={styles.topMetaRow}>
                      <Text numberOfLines={1} style={styles.actorName}>
                        {item.actorName || "Navodaya Connect"}
                      </Text>
                      <Text style={styles.timeText}>
                        {formatPublishDateTime(item.createdAt)}
                      </Text>
                    </View>

                    <Text style={styles.messageText} numberOfLines={3}>
                      {item.message}
                    </Text>

                    {/* Quick Inline Connection Actions */}
                    {isConnectionRequest && !handledStatus ? (
                      <View style={styles.inlineActionRow}>
                        <TouchableOpacity
                          style={styles.acceptBtn}
                          onPress={() => void handleInlineConnection(item, "accept")}
                        >
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                          <Text style={styles.acceptBtnText}>Accept</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.declineBtn}
                          onPress={() => void handleInlineConnection(item, "decline")}
                        >
                          <Text style={styles.declineBtnText}>Decline</Text>
                        </TouchableOpacity>
                      </View>
                    ) : handledStatus ? (
                      <View style={styles.inlineHandledTag}>
                        <Ionicons
                          name={handledStatus === "accepted" ? "checkmark-circle" : "close-circle"}
                          size={14}
                          color={handledStatus === "accepted" ? "#10B981" : "#64748B"}
                        />
                        <Text style={styles.inlineHandledText}>
                          {handledStatus === "accepted" ? "Connection accepted" : "Request declined"}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  {/* Chevron & Action Menu Button */}
                  <TouchableOpacity
                    style={styles.moreBtn}
                    onPress={() => {
                      setSelectedItem(item);
                      setShowActionModal(true);
                    }}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    accessibilityLabel="Notification options"
                  >
                    <Ionicons name="ellipsis-horizontal" size={16} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}

      {/* 4. Contextual Action Modal (Mark Read/Unread, Delete, Open) */}
      <Modal
        visible={showActionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActionModal(false)}
      >
        <TouchableOpacity
          style={styles.modalBackdrop}
          activeOpacity={1}
          onPress={() => setShowActionModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle} numberOfLines={1}>
              {selectedItem?.actorName || "Notification Options"}
            </Text>
            <Text style={styles.modalSub} numberOfLines={2}>
              {selectedItem?.message}
            </Text>

            <View style={styles.modalActions}>
              {selectedItem?.readAt ? (
                <TouchableOpacity
                  style={styles.modalActionRow}
                  onPress={() => selectedItem && void handleMarkUnread(selectedItem)}
                >
                  <View style={[styles.modalActionIcon, { backgroundColor: "#EDE9FE" }]}>
                    <Ionicons name="mail-unread-outline" size={18} color="#7C3AED" />
                  </View>
                  <Text style={styles.modalActionText}>Mark as unread</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={styles.modalActionRow}
                  onPress={() => selectedItem && void handleMarkRead(selectedItem)}
                >
                  <View style={[styles.modalActionIcon, { backgroundColor: "#D1FAE5" }]}>
                    <Ionicons name="checkmark-done" size={18} color="#10B981" />
                  </View>
                  <Text style={styles.modalActionText}>Mark as read</Text>
                </TouchableOpacity>
              )}

              {selectedItem?.actorId ? (
                <TouchableOpacity
                  style={styles.modalActionRow}
                  onPress={() => {
                    setShowActionModal(false);
                    if (selectedItem.actorId) {
                      router.push({
                        pathname: "/(screens)/user-profile",
                        params: { userId: selectedItem.actorId },
                      } as any);
                    }
                  }}
                >
                  <View style={[styles.modalActionIcon, { backgroundColor: "#DBEAFE" }]}>
                    <Ionicons name="person-outline" size={18} color="#2563EB" />
                  </View>
                  <Text style={styles.modalActionText}>View user profile</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[styles.modalActionRow, styles.modalActionDestructive]}
                onPress={() => selectedItem && void handleDelete(selectedItem)}
              >
                <View style={[styles.modalActionIcon, { backgroundColor: "#FEE2E2" }]}>
                  <Ionicons name="trash-outline" size={18} color="#EF4444" />
                </View>
                <Text style={[styles.modalActionText, { color: "#EF4444" }]}>Delete notification</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowActionModal(false)}
            >
              <Text style={styles.modalCloseBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  headerTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
  },
  unreadBadge: {
    backgroundColor: "#EF4444",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  unreadBadgeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
  },
  headerRightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  filterScrollView: {
    marginTop: 2,
  },
  filterScroll: {
    gap: 8,
    paddingVertical: 4,
  },
  filterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  filterPillActive: {
    backgroundColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterPillInactive: {
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  filterText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  filterTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_600SemiBold",
  },
  filterTextInactive: {
    color: "#FFFFFF",
  },
  filterBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 8,
  },
  filterBadgeActive: {
    backgroundColor: "#EDE9FE",
  },
  filterBadgeInactive: {
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  filterBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
  },
  filterBadgeTextActive: {
    color: "#7C3AED",
  },
  filterBadgeTextInactive: {
    color: "#FFFFFF",
  },
  toast: {
    position: "absolute",
    top: 110,
    alignSelf: "center",
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#1E1B4B",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 6,
  },
  toastText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  listContent: {
    padding: 16,
    gap: 8,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
  },
  sectionHeaderText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sectionCountPill: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  sectionCountText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
    position: "relative",
    overflow: "hidden",
  },
  cardUnread: {
    backgroundColor: "#FDFBFF",
    borderColor: "#C4B5FD",
    shadowOpacity: 0.08,
  },
  unreadBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: "#7C3AED",
  },
  cardInner: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  avatarWrap: {
    position: "relative",
  },
  avatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitial: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  badgeOverlay: {
    position: "absolute",
    bottom: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
  cardContent: {
    flex: 1,
    gap: 3,
  },
  topMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  actorName: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
    flex: 1,
  },
  timeText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: "#94A3B8",
  },
  messageText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#475569",
    lineHeight: 18,
  },
  inlineActionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 8,
  },
  acceptBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  acceptBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
  },
  declineBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  declineBtnText: {
    color: "#475569",
    fontSize: 12,
    fontFamily: "Inter_500Medium",
  },
  inlineHandledTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 6,
  },
  inlineHandledText: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: "#64748B",
  },
  moreBtn: {
    padding: 4,
  },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 12,
  },
  emptyIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stateTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#1E1B4B",
    textAlign: "center",
  },
  stateSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 280,
  },
  viewAllBtn: {
    marginTop: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "#EDE9FE",
  },
  viewAllBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#7C3AED",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 14,
    marginTop: 8,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  skeletonContainer: {
    padding: 16,
    gap: 10,
  },
  skeletonCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#F1F5F9",
  },
  skeletonAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#E2E8F0",
  },
  skeletonContent: {
    flex: 1,
    gap: 8,
  },
  skeletonBarShort: {
    width: "40%",
    height: 12,
    borderRadius: 6,
    backgroundColor: "#E2E8F0",
  },
  skeletonBarLong: {
    width: "85%",
    height: 10,
    borderRadius: 5,
    backgroundColor: "#F1F5F9",
  },
  skeletonBarTiny: {
    width: "25%",
    height: 9,
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 12,
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#CBD5E1",
    alignSelf: "center",
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  modalSub: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    lineHeight: 18,
  },
  modalActions: {
    marginTop: 6,
    gap: 4,
  },
  modalActionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  modalActionDestructive: {
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    marginTop: 4,
  },
  modalActionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  modalActionText: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "#1E293B",
  },
  modalCloseBtn: {
    marginTop: 8,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
  },
  modalCloseBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#64748B",
  },
});
