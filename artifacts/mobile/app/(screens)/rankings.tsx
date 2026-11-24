import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { api, type RankingOverviewData } from "@/lib/api";

import RankingOverviewSection from "@/components/ranking/RankingOverviewSection";
import IndividualRankingSection from "@/components/ranking/IndividualRankingSection";
import JnvRankingSection from "@/components/ranking/JnvRankingSection";
import AwardsSection from "@/components/ranking/AwardsSection";
import MethodologySection from "@/components/ranking/MethodologySection";
import UserRankingProfileModal from "@/components/ranking/UserRankingProfileModal";
import AdminRankingModal from "@/components/ranking/AdminRankingModal";

type RankingTab = "overview" | "individual" | "jnv" | "awards" | "methodology";

export default function RankingsScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  const [activeTab, setActiveTab] = useState<RankingTab>("overview");
  const [overviewData, setOverviewData] = useState<RankingOverviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Modals
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [adminModalVisible, setAdminModalVisible] = useState(false);

  const canAccessAdmin = profile?.role === "official" || profile?.role === "teacher";

  const fetchOverview = useCallback(async () => {
    try {
      const res = await api.ranking.overview();
      setOverviewData(res);
    } catch (err) {
      console.warn("Failed to load ranking overview", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void fetchOverview();
  }, [fetchOverview]);

  const handleOpenUserProfile = (userId: string) => {
    setSelectedUserId(userId);
    setProfileModalVisible(true);
  };

  return (
    <View style={styles.container}>
      {/* Top Header */}
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backBtn}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#1E293B" />
        </TouchableOpacity>

        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitle}>Ranking</Text>
          <Text style={styles.headerSubtitle}>Performance & Recognition</Text>
        </View>

        {canAccessAdmin ? (
          <TouchableOpacity
            style={styles.adminBtn}
            onPress={() => setAdminModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Open Admin Hub"
          >
            <Ionicons name="shield-checkmark" size={18} color="#7C3AED" />
          </TouchableOpacity>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      {/* 5-Section Segment Navigation Bar */}
      <View style={styles.navBarWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.navScroll}
        >
          <TabButton
            active={activeTab === "overview"}
            icon="grid-outline"
            label="Overview"
            onPress={() => setActiveTab("overview")}
          />
          <TabButton
            active={activeTab === "individual"}
            icon="person-outline"
            label="Individual Ranking"
            onPress={() => setActiveTab("individual")}
          />
          <TabButton
            active={activeTab === "jnv"}
            icon="business-outline"
            label="JNV Ranking"
            onPress={() => setActiveTab("jnv")}
          />
          <TabButton
            active={activeTab === "awards"}
            icon="trophy-outline"
            label="Awards"
            badge="LIVE"
            onPress={() => setActiveTab("awards")}
          />
          <TabButton
            active={activeTab === "methodology"}
            icon="document-text-outline"
            label="Methodology"
            onPress={() => setActiveTab("methodology")}
          />
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 18) + 28 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={["#7C3AED"]} />}
      >
        {activeTab === "overview" && (
          <RankingOverviewSection
            data={overviewData}
            onSelectUser={handleOpenUserProfile}
            onNavigateTab={(tab) => setActiveTab(tab)}
          />
        )}

        {activeTab === "individual" && (
          <IndividualRankingSection onSelectUser={handleOpenUserProfile} />
        )}

        {activeTab === "jnv" && <JnvRankingSection />}

        {activeTab === "awards" && (
          <AwardsSection onSelectUser={handleOpenUserProfile} />
        )}

        {activeTab === "methodology" && <MethodologySection />}
      </ScrollView>

      {/* Contributor Profile Modal */}
      <UserRankingProfileModal
        userId={selectedUserId}
        visible={profileModalVisible}
        onClose={() => {
          setProfileModalVisible(false);
          setSelectedUserId(null);
        }}
      />

      {/* Admin Ranking Modal */}
      {canAccessAdmin && (
        <AdminRankingModal
          visible={adminModalVisible}
          onClose={() => setAdminModalVisible(false)}
          onSuccess={() => {
            void fetchOverview();
          }}
        />
      )}
    </View>
  );
}

function TabButton({
  active,
  icon,
  label,
  badge,
  onPress,
}: {
  active: boolean;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.tabBtn, active && styles.tabBtnActive]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={15} color={active ? "#7C3AED" : "#64748B"} />
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
      {badge && (
        <View style={[styles.badgeWrap, active && styles.badgeWrapActive]}>
          <Text style={[styles.badgeText, active && styles.badgeTextActive]}>{badge}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F8F7FF",
  },
  header: {
    minHeight: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },
  headerTitleWrap: {
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    color: "#0F172A",
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    color: "#64748B",
    marginTop: 1,
  },
  adminBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
  },
  headerSpacer: {
    width: 36,
  },
  navBarWrap: {
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
    paddingVertical: 8,
  },
  navScroll: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 5,
  },
  tabBtnActive: {
    backgroundColor: "#F5F3FF",
    borderColor: "#7C3AED",
  },
  tabText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    color: "#64748B",
  },
  tabTextActive: {
    color: "#7C3AED",
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },
  badgeWrap: {
    backgroundColor: "#E2E8F0",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 6,
  },
  badgeWrapActive: {
    backgroundColor: "#7C3AED",
  },
  badgeText: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    color: "#475569",
  },
  badgeTextActive: {
    color: "#fff",
  },
});
