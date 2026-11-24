import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { api, type NotificationPreferences } from "@/lib/api";
import { useColors } from "@/hooks/useColors";

interface SettingItem {
  key: keyof Omit<NotificationPreferences, "userId" | "updatedAt">;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
  category: "activity" | "career" | "channels";
}

const SETTING_ITEMS: SettingItem[] = [
  // Activity Category
  {
    key: "likesComments",
    title: "Likes & Comments",
    description: "When someone likes, comments, or replies on your memories",
    icon: "heart-outline",
    category: "activity",
  },
  {
    key: "followsConnections",
    title: "Followers & Connections",
    description: "New connection requests, approvals, and profile followers",
    icon: "people-outline",
    category: "activity",
  },
  {
    key: "messages",
    title: "Direct Messages",
    description: "Incoming messages and message requests from alumni & students",
    icon: "chatbubble-outline",
    category: "activity",
  },
  // Career & Guidance
  {
    key: "opportunities",
    title: "Jobs & Opportunities",
    description: "New internships, full-time jobs, and scholarship postings",
    icon: "briefcase-outline",
    category: "career",
  },
  {
    key: "mentorship",
    title: "Mentorship & Guidance",
    description: "Session requests, mentor confirmations, and status updates",
    icon: "compass-outline",
    category: "career",
  },
  {
    key: "alumniVerification",
    title: "Alumni & Verification",
    description: "Peer verification reviews, credential status, and ID approvals",
    icon: "shield-checkmark-outline",
    category: "career",
  },
  {
    key: "events",
    title: "Events & Reunions",
    description: "Reminders for alumni meets, webinars, and Navodaya competitions",
    icon: "calendar-outline",
    category: "career",
  },
  {
    key: "systemAnnouncements",
    title: "School & System Announcements",
    description: "Official JNV circulars, platform security alerts, and updates",
    icon: "megaphone-outline",
    category: "career",
  },
  // Delivery Channels
  {
    key: "pushNotifications",
    title: "Push Notifications",
    description: "Receive instant notifications directly on your device",
    icon: "notifications-outline",
    category: "channels",
  },
  {
    key: "emailNotifications",
    title: "Email Digest",
    description: "Periodic email summaries of important community activity",
    icon: "mail-outline",
    category: "channels",
  },
];

export default function NotificationSettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    userId: "",
    likesComments: true,
    followsConnections: true,
    messages: true,
    alumniVerification: true,
    opportunities: true,
    mentorship: true,
    events: true,
    systemAnnouncements: true,
    emailNotifications: true,
    pushNotifications: true,
    updatedAt: new Date().toISOString(),
  });
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    let active = true;
    api.notifications.getPreferences()
      .then((data) => {
        if (active && data) {
          setPreferences(data);
        }
      })
      .catch(() => {
        // Fall back to default
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2200);
  };

  const toggleSetting = async (key: keyof Omit<NotificationPreferences, "userId" | "updatedAt">) => {
    const nextVal = !preferences[key];
    const prev = { ...preferences };
    const updated = { ...preferences, [key]: nextVal };
    setPreferences(updated);

    try {
      setSaving(true);
      await api.notifications.updatePreferences({ [key]: nextVal });
      showToast("Preferences saved");
    } catch {
      setPreferences(prev);
      showToast("Could not save preference. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const renderSection = (category: "activity" | "career" | "channels", title: string, subtitle: string) => {
    const items = SETTING_ITEMS.filter((i) => i.category === category);
    return (
      <View style={styles.sectionWrap}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.sectionSubtitle}>{subtitle}</Text>
        </View>
        <View style={styles.card}>
          {items.map((item, idx) => {
            const isLast = idx === items.length - 1;
            const enabled = preferences[item.key] ?? true;
            return (
              <View key={item.key} style={[styles.itemRow, !isLast && styles.itemBorder]}>
                <View style={styles.itemIconBg}>
                  <Ionicons name={item.icon} size={20} color="#7C3AED" />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  <Text style={styles.itemDesc}>{item.description}</Text>
                </View>
                <Switch
                  value={enabled}
                  onValueChange={() => void toggleSetting(item.key)}
                  trackColor={{ false: "#E2E8F0", true: "#C4B5FD" }}
                  thumbColor={enabled ? "#7C3AED" : "#94A3B8"}
                />
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={[styles.header, { paddingTop: topPad + 10 }]}
      >
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} accessibilityLabel="Go back">
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.titleCol}>
            <Text style={styles.headerTitle}>Notification Settings</Text>
            <Text style={styles.headerSubtitle}>Customize alerts & alerts preferences</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>
      </LinearGradient>

      {toastMessage ? (
        <View style={styles.toast}>
          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centerLoading}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading preferences...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: 36 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          {renderSection(
            "activity",
            "Social & Community Activity",
            "Updates on people, conversations, and memory interactions"
          )}

          {renderSection(
            "career",
            "Career & Navodaya Network",
            "Opportunities, alumni mentorship, and community alerts"
          )}

          {renderSection(
            "channels",
            "Delivery Channels",
            "Choose where you want to receive alerts"
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleCol: {
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
  },
  headerSubtitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  content: {
    padding: 16,
    gap: 20,
  },
  centerLoading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: "#64748B",
    fontFamily: "Inter_500Medium",
  },
  sectionWrap: {
    gap: 10,
  },
  sectionHeader: {
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#1E1B4B",
  },
  sectionSubtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  itemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    gap: 14,
  },
  itemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  itemIconBg: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#0F172A",
  },
  itemDesc: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "#64748B",
    lineHeight: 16,
  },
  toast: {
    position: "absolute",
    top: 96,
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
});
