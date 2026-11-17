import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Platform,
  RefreshControl,
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
import type { SocialNotification } from "@workspace/api-client-react";
import { api } from "@/lib/api";
import { useColors } from "@/hooks/useColors";
import { PremiumCard } from "@/components/PremiumCard";
import { getNotificationRoute } from "@/lib/notification-navigation";

const TYPE_ICONS: Record<string, { icon: keyof typeof Ionicons.glyphMap; color: string }> = {
  direct_message: { icon: "chatbubble-outline", color: "#3D5AF1" },
  direct_message_accepted: { icon: "checkmark-done-outline", color: "#10B981" },
  direct_message_request: { icon: "mail-outline", color: "#8B5CF6" },
  follow: { icon: "person-add-outline", color: "#3B82F6" },
  follow_accepted: { icon: "people-outline", color: "#10B981" },
  follow_request: { icon: "person-add-outline", color: "#F59E0B" },
  memory_like: { icon: "heart-outline", color: "#EF4444" },
  memory_comment: { icon: "chatbox-ellipses-outline", color: "#8B5CF6" },
  yearbook_review: { icon: "book-outline", color: "#10B981" },
  verification_approved: { icon: "shield-checkmark-outline", color: "#10B981" },
  verification_reviewed: { icon: "shield-outline", color: "#3D5AF1" },
  verification_decision: { icon: "shield-outline", color: "#3D5AF1" },
  verification_decision_needed: { icon: "time-outline", color: "#F59E0B" },
  verification_resubmitted: { icon: "document-text-outline", color: "#3D5AF1" },
  verification_admin_appointed: { icon: "person-add-outline", color: "#3D5AF1" },
  verification_admin_removed: { icon: "person-remove-outline", color: "#6B7280" },
  credential_suspended: { icon: "card-outline", color: "#EF4444" },
  credential_reactivated: { icon: "card-outline", color: "#10B981" },
  alumni_batch_transition: { icon: "school-outline", color: "#8B5CF6" },
};

function timeLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const topPad = Platform.OS === "web" ? 0 : insets.top;
  const queryKey = getListSocialNotificationsQueryKey();
  const notifications = useListSocialNotifications({
    query: { queryKey, refetchInterval: 15_000 },
  });

  const openNotification = (item: SocialNotification) => {
    router.push(getNotificationRoute(item) as any);
    if (!item.readAt) {
      void api.notifications.markRead(item.id)
        .then(() => queryClient.invalidateQueries({ queryKey }))
        .catch(() => queryClient.invalidateQueries({ queryKey }));
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 8 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Notifications</Text>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      {notifications.isLoading ? (
        <View style={styles.state}>
          <ActivityIndicator color={colors.primary} />
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Loading notifications...</Text>
        </View>
      ) : notifications.isError ? (
        <View style={styles.state}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.mutedForeground} />
          <Text style={[styles.stateTitle, { color: colors.foreground }]}>Notifications could not load</Text>
          <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Check your connection and try again.</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void notifications.refetch()}>
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={notifications.data ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: 24 + insets.bottom }, !notifications.data?.length && styles.emptyList]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={notifications.isRefetching} onRefresh={() => void notifications.refetch()} tintColor={colors.primary} />}
          ListEmptyComponent={(
            <View style={styles.emptyState}>
              <Ionicons name="notifications-off-outline" size={30} color={colors.mutedForeground} />
              <Text style={[styles.stateTitle, { color: colors.foreground }]}>No notifications yet</Text>
              <Text style={[styles.stateText, { color: colors.mutedForeground }]}>New activity will appear here.</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const config = TYPE_ICONS[item.type] ?? { icon: "notifications-outline" as const, color: colors.primary };
            const unread = !item.readAt;
            return (
              <TouchableOpacity
                activeOpacity={0.82}
                onPress={() => openNotification(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.actorName}. ${item.message}. ${timeLabel(item.createdAt)}${unread ? ". Unread" : ""}`}
              >
                <PremiumCard style={[styles.notifCard, unread && { borderLeftWidth: 3, borderLeftColor: colors.primary }] as any}>
                  <View style={styles.notifRow}>
                    <View style={[styles.iconBg, { backgroundColor: `${config.color}15` }]}>
                      <Ionicons name={config.icon} size={20} color={config.color} />
                    </View>
                    <View style={styles.notifContent}>
                      <Text style={[styles.notifTitle, { color: colors.foreground }]}>{item.actorName}</Text>
                      <Text style={[styles.notifBody, { color: colors.mutedForeground }]}>{item.message}</Text>
                      <Text style={[styles.notifTime, { color: colors.mutedForeground }]}>{timeLabel(item.createdAt)}</Text>
                    </View>
                    {unread ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
                    <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
                  </View>
                </PremiumCard>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 20 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  backBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  headerTitle: { color: "#fff", fontSize: 20, fontFamily: "Inter_700Bold" },
  listContent: { padding: 16 },
  emptyList: { flexGrow: 1, justifyContent: "center" },
  notifCard: { marginBottom: 8 },
  notifRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  iconBg: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  notifContent: { flex: 1 },
  notifTitle: { fontSize: 14, fontFamily: "Inter_600SemiBold", marginBottom: 3 },
  notifBody: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18, marginBottom: 4 },
  notifTime: { fontSize: 11, fontFamily: "Inter_400Regular" },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  state: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28, gap: 10 },
  stateTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  stateText: { fontSize: 13, lineHeight: 19, fontFamily: "Inter_400Regular", textAlign: "center" },
  retryButton: { marginTop: 8, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12, backgroundColor: "#3D5AF1" },
  retryText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  emptyState: { alignItems: "center", gap: 8 },
});
