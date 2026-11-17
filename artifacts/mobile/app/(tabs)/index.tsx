import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  FlatList,
  Linking,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router, useFocusEffect } from "expo-router";
import { api } from "@/lib/api";
import type { AlumniUser, NewsItem, SchoolAdminDashboardMetrics } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useVerificationGate } from "@/components/VerificationGateModal";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import AchievementsHighlights from "@/components/AchievementsHighlights";
import MotionPressable from "@/components/motion/MotionPressable";
import FadeIn from "@/components/motion/FadeIn";

const STUDENT_ACTIONS = [
  { label: "Study Hub",        icon: "book-outline"            as const, color: "#7C3AED", bg: "#F5F3FF", route: "/(screens)/study-section"          },
  { label: "Opportunities",   icon: "sparkles-outline"        as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/alumni-opportunities" },
  { label: "Ask Senior",       icon: "help-circle-outline"    as const, color: "#6366F1", bg: "#F5F3FF", route: "/(screens)/ask-senior"             },
  { label: "Report Problem",   icon: "alert-circle-outline"   as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/report-problem"         },
];
const TEACHER_ACTIONS = [
  { label: "Teacher Zone",    icon: "school-outline"          as const, color: "#7C3AED", bg: "#F5F3FF", route: "/(screens)/teacher-zone"     },
  { label: "Post Update",     icon: "megaphone-outline"       as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/create-news"      },
  { label: "My Classes",      icon: "people-outline"          as const, color: "#6366F1", bg: "#F5F3FF", route: "/(screens)/teacher-classes"  },
  { label: "Opportunities",   icon: "sparkles-outline"        as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/alumni-opportunities" },
];
const ALUMNI_ACTIONS = [
  { label: "Alumni Zone",     icon: "school-outline"          as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/alumni-zone"       },
  { label: "Business Network", icon: "business-outline"       as const, color: "#7C3AED", bg: "#F5F3FF", route: "/(screens)/alumni-business" },
  { label: "Alumni Directory", icon: "people-outline"         as const, color: "#6366F1", bg: "#F5F3FF", route: "/(tabs)/alumni" },
  { label: "Opportunities",   icon: "briefcase-outline"       as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(screens)/alumni-opportunities"},
];
const OFFICIAL_ACTIONS = [
  { label: "Dashboard",       icon: "grid-outline"             as const, color: "#7C3AED", bg: "#F5F3FF", route: "/(screens)/official-dashboard" },
  { label: "Verify Users",    icon: "shield-checkmark-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/user-management"    },
  { label: "View Problems",   icon: "alert-circle-outline"    as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/view-problems"      },
  { label: "School Directory", icon: "people-outline"          as const, color: "#6366F1", bg: "#F5F3FF", route: "/(screens)/school-directory"  },
];

const ANNOUNCEMENT_CATEGORIES = ["announcement", "notice", "official", "circular", "holiday", "exam", "other"];
const NEWS_CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Academic: { bg: "#F5F3FF", color: "#7C3AED" },
  Exam: { bg: "#FEF3C7", color: "#D97706" },
  Sports: { bg: "#ECFDF5", color: "#10B981" },
  Event: { bg: "#EDE9FE", color: "#6D28D9" },
  Announcement: { bg: "#FEF2F2", color: "#EF4444" },
  Default: { bg: "#F1F5F9", color: "#64748B" },
};

function getCategoryStyle(cat: string) {
  return NEWS_CATEGORY_COLORS[cat] || NEWS_CATEGORY_COLORS.Default;
}

function formatDate(dateStr: string) {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch { return ""; }
}

const GRADIENT_SETS = [
  ["#7C3AED", "#6366F1"] as const,
  ["#8B5CF6", "#6D28D9"] as const,
  ["#10B981", "#059669"] as const,
  ["#F59E0B", "#D97706"] as const,
  ["#EC4899", "#BE185D"] as const,
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile, isVerified } = useAuth();
  const { tryAccess, modal: gateModal } = useVerificationGate(isVerified);
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [newsLoading, setNewsLoading] = useState(true);
  const [newsError, setNewsError] = useState(false);
  const [newsLinkError, setNewsLinkError] = useState("");
  const [canReviewVerification, setCanReviewVerification] = useState(false);
  const [officialMetrics, setOfficialMetrics] = useState<SchoolAdminDashboardMetrics | null>(null);
  const [officialMetricsLoading, setOfficialMetricsLoading] = useState(false);
  const [officialMetricsError, setOfficialMetricsError] = useState(false);
  const [schoolAlumni, setSchoolAlumni] = useState<AlumniUser[]>([]);
  const [schoolAlumniLoading, setSchoolAlumniLoading] = useState(true);
  const [schoolAlumniError, setSchoolAlumniError] = useState(false);
  const headerTopPad = Platform.OS === "web" ? 0 : insets.top + 8;

  const role = profile?.role ?? "student";
  const isTeacher = role === "teacher";
  const isAlumni = role === "alumni";
  const isOfficial = role === "official";

  useEffect(() => {
    api.verification.permissions().then((permissions) => setCanReviewVerification(permissions.canReview)).catch(() => {});
  }, []);

  const fetchOfficialMetrics = useCallback(async () => {
    if (!isOfficial) return;
    setOfficialMetricsLoading(true);
    setOfficialMetricsError(false);
    try {
      setOfficialMetrics(await api.schoolAdmin.dashboardMetrics());
    } catch {
      setOfficialMetrics(null);
      setOfficialMetricsError(true);
    } finally {
      setOfficialMetricsLoading(false);
    }
  }, [isOfficial]);

  useFocusEffect(useCallback(() => {
    if (isOfficial) void fetchOfficialMetrics();
    return undefined;
  }, [fetchOfficialMetrics, isOfficial]));

  useEffect(() => {
    let active = true;
    setSchoolAlumniLoading(true);
    setSchoolAlumniError(false);
    api.users.alumni().then((alumni) => {
      if (active) setSchoolAlumni(alumni.filter((person) => !person.isRestricted && person.id !== profile?.uid).slice(0, 4));
    }).catch(() => {
      if (active) {
        setSchoolAlumni([]);
        setSchoolAlumniError(true);
      }
    }).finally(() => { if (active) setSchoolAlumniLoading(false); });
    return () => { active = false; };
  }, [profile?.jnvName, profile?.jnvState, profile?.uid]);

  const roleActions = isOfficial ? OFFICIAL_ACTIONS : isTeacher ? TEACHER_ACTIONS : isAlumni ? ALUMNI_ACTIONS : STUDENT_ACTIONS;
  const verifyAction = { label: "Verify Users", icon: "shield-checkmark-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/user-management" };
  const quickActions = canReviewVerification && !isOfficial
    ? [...roleActions, verifyAction]
    : roleActions;
  const limitedActionLabels = new Set(["Opportunities", ...(role === "student" ? ["Study Hub", "Report Problem"] : [])]);
  const openFeature = (route: string, featureName: string, limited = false) => {
    // Official accounts are authorized by their JNV assignment, not by the
    // standard alumni/student verification badge. Keep their management tools
    // reachable from the home screen.
    if (limited || isVerified || isOfficial) {
      router.push(route as any);
      return;
    }
    tryAccess(featureName, () => router.push(route as any));
  };

  const fetchData = useCallback(async () => {
    setNewsError(false);
    try {
      const n = await api.news.list();
      setAllNews(n);
    } catch {
      setNewsError(true);
    } finally {
      setNewsLoading(false);
    }
  }, [profile?.uid]);

  useFocusEffect(useCallback(() => {
    void fetchData();
    return undefined;
  }, [fetchData]));

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchData(), isOfficial ? fetchOfficialMetrics() : Promise.resolve()]);
    setRefreshing(false);
  }, [fetchData, fetchOfficialMetrics, isOfficial]);

  const openArticle = async (item: NewsItem) => {
    if (!item.sourceUrl) {
      setNewsLinkError("This item does not have an original source link.");
      setTimeout(() => setNewsLinkError(""), 3000);
      return;
    }
    try {
      const url = new URL(item.sourceUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      await Linking.openURL(url.toString());
    } catch {
      setNewsLinkError("Unable to open the original source article.");
      setTimeout(() => setNewsLinkError(""), 3000);
    }
  };

  const announcements = allNews.filter((n) =>
    ANNOUNCEMENT_CATEGORIES.includes(n.category?.toLowerCase() || "")
  );
  const jnvNews = allNews.filter((n) =>
    !ANNOUNCEMENT_CATEGORIES.includes(n.category?.toLowerCase() || "")
  );

  const displayNews = jnvNews;
  const displayAnnouncements = announcements;

  const featuredNews = displayNews[0];
  const moreNews = displayNews.slice(1);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: headerTopPad }]}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerBrand}>NAVODAYA CONNECT</Text>
          <Text style={styles.headerTitle}>{profile?.fullName?.split(" ")[0] || "Navodayan"} 👋</Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.bellBtn}
            onPress={() => router.push("/(screens)/notifications" as any)}
            accessibilityRole="button"
            accessibilityLabel="Notifications"
          >
            <Ionicons name="notifications-outline" size={20} color="#7C3AED" />
            <View style={styles.bellDot} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 110 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#7C3AED" />}
      >
        {/* Welcome Hero Banner */}
        <FadeIn>
          <LinearGradient
            colors={["#7C3AED", "#6366F1"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.welcomeCard}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.heroBadge}>
                <Ionicons name="school" size={12} color="#FFFFFF" />
                <Text style={styles.heroBadgeText}>{profile?.jnvName || "JNV Community"}</Text>
              </View>
              {(role === "student" || role === "alumni") && (
                <TouchableOpacity
                  style={styles.heroIdBtn}
                  onPress={() => router.push("/(screens)/digital-id" as any)}
                  activeOpacity={0.85}
                >
                  <Ionicons name="id-card-outline" size={13} color="#FFFFFF" />
                  <Text style={styles.heroIdBtnText}>Digital ID</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.heroGreeting}>Good {getGreeting()}</Text>
            <Text style={styles.heroSubTitle}>Welcome to your alumni & campus hub</Text>

            <View style={styles.welcomeRow}>
              <View style={styles.roleTag}>
                <Text style={styles.roleTagText}>{getRoleLabel(role)}</Text>
              </View>
              {(role === "student" || role === "alumni") && profile?.house && (
                <View style={styles.houseTag}>
                  <Text style={styles.houseTagText}>{profile.house}</Text>
                </View>
              )}
              {profile?.class && (
                <View style={styles.houseTag}>
                  <Text style={styles.houseTagText}>Class {profile.class.replace(/^class\s+/i, "")}</Text>
                </View>
              )}
              {profile?.passoutYear && (
                <View style={styles.houseTag}>
                  <Text style={styles.houseTagText}>Batch {profile.passoutYear}</Text>
                </View>
              )}
            </View>

            {isOfficial && (
              <>
                <View style={styles.teacherStats}>
                  {[
                    { label: "Classes", value: String(officialMetrics?.classes ?? "—"), icon: "school-outline" as const },
                    { label: "Students", value: String(officialMetrics?.students ?? "—"), icon: "people-outline" as const },
                    { label: "Events", value: String(officialMetrics?.events ?? "—"), icon: "calendar-outline" as const },
                    { label: "Open Issues", value: String(officialMetrics?.issues ?? "—"), icon: "alert-circle-outline" as const },
                  ].map((stat) => (
                    <View key={stat.label} style={styles.statBox}>
                      <Ionicons name={stat.icon} size={14} color="rgba(255,255,255,0.75)" />
                      <Text style={styles.statVal}>{stat.value}</Text>
                      <Text style={styles.statLabel}>{stat.label}</Text>
                    </View>
                  ))}
                </View>
                {(officialMetricsLoading || officialMetricsError) && (
                  <Text style={styles.metricsHint}>
                    {officialMetricsError ? "Live school metrics unavailable. Pull to refresh." : "Loading live school metrics…"}
                  </Text>
                )}
              </>
            )}
          </LinearGradient>
        </FadeIn>

        <AchievementsHighlights />

        {/* Verification Banner — only for non-verified non-officials */}
        {!isVerified && role !== "official" && (
          <TouchableOpacity
            style={styles.verifyBanner}
            onPress={() => router.push((role === "alumni" ? "/(screens)/alumni-peer-verification" : "/(screens)/verification-center") as any)}
            activeOpacity={0.85}
          >
            <View style={styles.verifyBannerLeft}>
              <Ionicons name="shield-outline" size={20} color="#FF7A00" />
              <View style={{ flex: 1 }}>
                <Text style={styles.verifyBannerTitle}>{role === "alumni" ? "Confirm your alumni status" : "Complete your verification"}</Text>
                <Text style={styles.verifyBannerSub}>{role === "alumni" ? "One peer from your JNV can confirm you" : "Unlock messaging, events &amp; more features"}</Text>
              </View>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#FF7A00" />
          </TouchableOpacity>
        )}

        {newsLoading && (
          <View style={styles.syncRow}>
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text style={styles.syncText}>Updating your community feed…</Text>
          </View>
        )}

        {newsError && (
          <TouchableOpacity style={styles.retryBanner} onPress={fetchData} activeOpacity={0.8}>
            <View style={styles.retryIcon}>
              <Ionicons name="cloud-offline-outline" size={18} color="#D97706" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.retryTitle}>Feed needs a refresh</Text>
              <Text style={styles.retryText}>Showing the latest available updates for now.</Text>
            </View>
            <Text style={styles.retryAction}>Retry</Text>
          </TouchableOpacity>
        )}

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action, actionIndex) => (
              <FadeIn
                key={action.label}
                delay={Math.min(actionIndex, 4) * 35}
                style={styles.actionFadeItem}
              >
              <MotionPressable
                style={styles.actionCard}
                onPress={() => openFeature(action.route, action.label, limitedActionLabels.has(action.label))}
                accessibilityRole="button"
                accessibilityLabel={action.label}
              >
                <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                  {!isVerified && !isOfficial && !limitedActionLabels.has(action.label) && (
                    <View style={styles.actionLock}>
                      <Ionicons name="lock-closed" size={9} color="#fff" />
                    </View>
                  )}
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </MotionPressable>
              </FadeIn>
            ))}
          </View>
        </View>

        {gateModal}

        {/* ── ANNOUNCEMENTS SECTION ── */}
        <View style={[styles.section, { marginTop: 18 }]}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.announceBadge}>
                <Ionicons name="megaphone" size={13} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>Announcements</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(screens)/news" as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {displayAnnouncements.slice(0, 3).map((item) => (
            <TouchableOpacity key={item.id} style={styles.announceCard} activeOpacity={0.8} onPress={() => openArticle(item)}>
              <View style={styles.announceStripe} />
              <View style={styles.announceBody}>
                <View style={styles.announceTop}>
                  <View style={styles.announcerInfo}>
                    <View style={styles.announcerAvatar}>
                      <Ionicons name="megaphone-outline" size={14} color="#EF4444" />
                    </View>
                    <View>
                      <Text style={styles.announcerName}>{item.authorName || "Unknown author"}</Text>
                      <Text style={styles.announcerJnv}>{item.jnvName || "School not specified"}</Text>
                    </View>
                  </View>
                  <Text style={styles.announceDate}>{formatDate(item.createdAt)}</Text>
                </View>
                <Text style={styles.announceTitle}>{item.title}</Text>
                <Text style={styles.announceDesc} numberOfLines={2}>{item.description}</Text>
                <View style={styles.announceFooter}>
                  <View style={styles.officialTag}>
                    <Ionicons name="shield-checkmark" size={11} color="#EF4444" />
                    <Text style={styles.officialTagText}>Official Notice</Text>
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          ))}
          {displayAnnouncements.length === 0 && !newsLoading && (
            <Text style={styles.emptyNewsText}>No official announcements are available right now.</Text>
          )}
        </View>

        {/* ── JNV NEWS SECTION ── */}
        <View style={[styles.section, { marginTop: 18 }]}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitleRow}>
              <View style={styles.newsBadge}>
                <Ionicons name="newspaper" size={13} color="#fff" />
              </View>
              <Text style={styles.sectionTitle}>JNV News</Text>
            </View>
            <TouchableOpacity onPress={() => router.push("/(screens)/news" as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>

          {/* Featured news card */}
          {featuredNews && (
          <TouchableOpacity activeOpacity={0.88} onPress={() => openArticle(featuredNews)} style={styles.featuredCard}>
              <LinearGradient colors={GRADIENT_SETS[0]} style={styles.featuredGradient}>
                <View style={styles.featuredCatTag}>
                  <Text style={styles.featuredCatText}>{featuredNews.category || "News"}</Text>
                </View>
                <Text style={styles.featuredTitle} numberOfLines={3}>{featuredNews.title}</Text>
                <Text style={styles.featuredDesc} numberOfLines={2}>{featuredNews.description}</Text>
                <View style={styles.featuredFooter}>
                  <View style={styles.featuredAuthorRow}>
                    <Ionicons name="person-circle-outline" size={15} color="rgba(255,255,255,0.8)" />
                  <Text style={styles.featuredAuthor}>{featuredNews.authorName || "Unknown author"}</Text>
                  </View>
                  <Text style={styles.featuredDate}>{formatDate(featuredNews.createdAt)}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>
          )}

          {/* Horizontal scroll of remaining news */}
          {moreNews.length > 0 && (
            <FlatList
              data={moreNews.slice(0, 6)}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ gap: 10, paddingRight: 4 }}
              style={{ marginTop: 10 }}
              renderItem={({ item, index }) => {
                const grad = GRADIENT_SETS[(index + 1) % GRADIENT_SETS.length];
                const catStyle = getCategoryStyle(item.category);
                return (
                  <TouchableOpacity style={styles.newsCard} activeOpacity={0.82} onPress={() => openArticle(item)}>
                    <LinearGradient colors={grad} style={styles.newsCardHeader}>
                      <View style={styles.newsCardCatTag}>
                        <Text style={styles.newsCardCatText}>{item.category || "News"}</Text>
                      </View>
                    </LinearGradient>
                    <View style={styles.newsCardBody}>
                      <Text style={styles.newsCardTitle} numberOfLines={3}>{item.title}</Text>
                      <View style={styles.newsCardFooter}>
                        <Text style={styles.newsCardDate}>{formatDate(item.createdAt)}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>

        {/* Explore More */}
        <View style={[styles.section, { marginTop: 18 }]}>
          <Text style={styles.sectionTitle}>Explore More</Text>
          <TouchableOpacity
            style={styles.mapRankingCard}
            onPress={() => router.push("/(screens)/jnv-map-ranking" as any)}
            activeOpacity={0.86}
            accessibilityRole="button"
            accessibilityLabel="JNV Map and Ranking. Explore Navodaya schools and discover their rankings."
          >
            <LinearGradient colors={["#273F8F", "#3151E8"]} style={styles.mapRankingGradient}>
              <View style={styles.mapRankingText}>
                <Text style={styles.mapRankingTitle}>JNV Map & Ranking</Text>
                <Text style={styles.mapRankingSubtitle}>Explore Navodaya schools and discover their rankings.</Text>
              </View>
              <View style={styles.mapRankingIcons}>
                <Ionicons name="map-outline" size={25} color="#fff" />
                <Ionicons name="trophy-outline" size={23} color="#FDE68A" />
              </View>
              <Ionicons name="chevron-forward" size={19} color="rgba(255,255,255,0.9)" />
            </LinearGradient>
          </TouchableOpacity>
          {[
            { label: "JNV Store", desc: "Books, JNV merchandise & learning essentials", icon: "bag-handle-outline" as const, iconColor: "#7C3AED", iconBg: "#F5F3FF", route: "/(screens)/store" },
            ...(role !== "official" ? [{ label: "Inter House Competition", desc: "Compete in games & earn points for your house", icon: "game-controller-outline" as const, iconColor: "#10B981", iconBg: "#ECFDF5", route: "/(screens)/house-arena" }] : []),
          ].map((item) => (
            <TouchableOpacity
              key={item.label}
              style={styles.exploreRow}
              onPress={() => openFeature(item.route, item.label, item.label === "JNV Store")}
              activeOpacity={0.75}
            >
              <View style={[styles.exploreIconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <View style={styles.exploreText}>
                <Text style={styles.exploreLabel}>{item.label}</Text>
                <Text style={styles.exploreDesc}>{item.desc}</Text>
              </View>
              {item.label !== "JNV Store" && !isVerified && <Ionicons name="lock-closed" size={14} color="#9CA3AF" />}
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Verified alumni from this JNV */}
        <View style={[styles.section, { marginTop: 18 }]}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Verified Alumni</Text>
            <TouchableOpacity onPress={() => openFeature("/(screens)/alumni", "Alumni directory")}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          {schoolAlumniLoading ? (
            <Text style={styles.alumniEmpty}>Loading alumni from your JNV…</Text>
          ) : schoolAlumniError ? (
            <Text style={styles.alumniEmpty}>Could not load the JNV alumni directory.</Text>
          ) : schoolAlumni.length === 0 ? (
            <Text style={styles.alumniEmpty}>No verified alumni profiles to show yet.</Text>
          ) : (
            <View style={styles.mentorsRow}>
              {schoolAlumni.map((person) => (
                <TouchableOpacity
                  key={person.id}
                  style={styles.mentorCard}
                  activeOpacity={0.8}
                  onPress={() => router.push({ pathname: "/(screens)/user-profile", params: { userId: person.id } } as any)}
                  accessibilityRole="button"
                  accessibilityLabel={`Open ${person.fullName}'s profile`}
                >
                  <View style={styles.mentorAvatar}>
                    <Text style={styles.mentorInitial}>{person.fullName[0]?.toUpperCase() || "A"}</Text>
                  </View>
                  <Text style={styles.mentorName} numberOfLines={1}>{person.fullName}</Text>
                  <Text style={styles.mentorField} numberOfLines={1}>{person.profession || person.field || person.company || "Alumni"}</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 17) return "Afternoon";
  return "Evening";
}

function getRoleLabel(role: string) {
  const map: Record<string, string> = { student: "Student", alumni: "Alumni", teacher: "Teacher", official: "JNV Official" };
  return map[role] || "Member";
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 14,
    backgroundColor: "#FFFFFF", borderBottomWidth: 1, borderBottomColor: "rgba(233, 213, 255, 0.5)",
  },
  headerLeft: { gap: 2 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerBrand: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#7C3AED", letterSpacing: 1.2 },
  headerGreeting: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B" },
  headerTitle: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1E1B4B" },
  emptyNewsText: { color: "#64748B", fontSize: 13, fontFamily: "Inter_500Medium", paddingVertical: 10 },
  bellBtn: { width: 42, height: 42, borderRadius: 21, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.8)" },
  bellDot: { position: "absolute", top: 9, right: 9, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#fff" },
  welcomeCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 24, padding: 20, shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 18, elevation: 8 },
  heroTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  heroBadge: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255, 255, 255, 0.22)", borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 5 },
  heroBadgeText: { color: "#FFFFFF", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  heroIdBtn: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#1E1B4B", borderRadius: 9999, paddingHorizontal: 12, paddingVertical: 6, shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 6, elevation: 3 },
  heroIdBtnText: { color: "#FFFFFF", fontSize: 11, fontFamily: "Inter_700Bold", letterSpacing: 0.3 },
  heroGreeting: { color: "#FFFFFF", fontSize: 24, fontFamily: "Inter_700Bold", letterSpacing: -0.3, marginBottom: 2 },
  heroSubTitle: { color: "rgba(255, 255, 255, 0.85)", fontSize: 13, fontFamily: "Inter_400Regular", marginBottom: 16 },
  mapRankingCard: { marginHorizontal: 16, marginTop: 14, borderRadius: 22, overflow: "hidden", minHeight: 92, elevation: 5, shadowColor: "#7C3AED", shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
  mapRankingGradient: { minHeight: 92, paddingHorizontal: 18, paddingVertical: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  mapRankingText: { flex: 1, gap: 5 },
  mapRankingTitle: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold" },
  mapRankingSubtitle: { color: "rgba(255,255,255,0.85)", fontSize: 12, lineHeight: 17, fontFamily: "Inter_400Regular" },
  mapRankingIcons: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 4 },
  welcomeRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  welcomeJnv: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 3 },
  welcomeRole: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" },
  roleTag: { backgroundColor: "#FFFFFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 5 },
  roleTagText: { color: "#6D28D9", fontSize: 12, fontFamily: "Inter_700Bold" },
  houseTag: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  houseTagText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  teacherStats: { flexDirection: "row", gap: 0, marginTop: 14 },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statVal: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular" },
  metricsHint: { marginTop: 8, color: "rgba(255,255,255,0.75)", fontSize: 11, fontFamily: "Inter_400Regular", textAlign: "center" },
  studentBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  studentBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  studentBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  verifyBanner: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginHorizontal: 16, marginTop: 14, backgroundColor: "#FFF7ED", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, borderWidth: 1.5, borderColor: "#FDBA74" },
  verifyBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  verifyBannerTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#C2410C" },
  verifyBannerSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#EA580C", marginTop: 1 },
  syncRow: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 14, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "#F5F3FF", borderRadius: 14 },
  syncText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#7C3AED" },
  retryBanner: { flexDirection: "row", alignItems: "center", gap: 10, marginHorizontal: 16, marginTop: 14, padding: 14, backgroundColor: "#FFFBEB", borderRadius: 16, borderWidth: 1, borderColor: "#FDE68A" },
  retryIcon: { width: 34, height: 34, borderRadius: 10, backgroundColor: "#FEF3C7", alignItems: "center", justifyContent: "center" },
  retryTitle: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#92400E" },
  retryText: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#A16207", marginTop: 2 },
  retryAction: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#B45309" },
  section: { paddingHorizontal: 16, marginTop: 22 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 14 },
  seeAll: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionFadeItem: { width: "47%", flexGrow: 0, flexShrink: 0 },
  actionCard: {
    width: "100%", backgroundColor: "#FFFFFF", borderRadius: 22, padding: 16,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)",
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3,
  },
  actionIcon: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", position: "relative" },
  actionLock: { position: "absolute", right: -4, top: -4, width: 18, height: 18, borderRadius: 9, backgroundColor: "#64748B", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" },
  actionLabel: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", textAlign: "center" },

  // Announcements
  announceBadge: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#7C3AED", alignItems: "center", justifyContent: "center" },
  newsBadge: { width: 26, height: 26, borderRadius: 8, backgroundColor: "#6366F1", alignItems: "center", justifyContent: "center" },
  announceCard: {
    flexDirection: "row", backgroundColor: "#FFFFFF", borderRadius: 20, marginBottom: 12,
    borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)", overflow: "hidden",
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 10, elevation: 2,
  },
  announceStripe: { width: 5, backgroundColor: "#7C3AED" },
  announceBody: { flex: 1, padding: 16 },
  announceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  announcerInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  announcerAvatar: { width: 32, height: 32, borderRadius: 10, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center" },
  announcerName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  announcerJnv: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },
  announceDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginLeft: 4 },
  announceTitle: { fontSize: 15, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 4, lineHeight: 21 },
  announceDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B", lineHeight: 19, marginBottom: 10 },
  announceFooter: { flexDirection: "row" },
  officialTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#F5F3FF", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  officialTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },

  // Featured news
  featuredCard: { borderRadius: 22, overflow: "hidden", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.16, shadowRadius: 14, elevation: 5 },
  featuredGradient: { padding: 22, minHeight: 160, justifyContent: "flex-end" },
  featuredCatTag: { position: "absolute", top: 16, left: 16, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  featuredCatText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  featuredTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 26, marginBottom: 6 },
  featuredDesc: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 12 },
  featuredFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  featuredAuthorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  featuredAuthor: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontFamily: "Inter_500Medium" },
  featuredDate: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontFamily: "Inter_400Regular" },

  // News cards
  newsCard: { width: 190, backgroundColor: "#FFFFFF", borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)", shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  newsCardHeader: { height: 74, justifyContent: "flex-end", padding: 10 },
  newsCardCatTag: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, alignSelf: "flex-start" },
  newsCardCatText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  newsCardBody: { padding: 12 },
  newsCardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#1E1B4B", lineHeight: 18, marginBottom: 8 },
  newsCardFooter: { flexDirection: "row", justifyContent: "space-between" },
  newsCardDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B" },

  // Explore
  exploreRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#FFFFFF",
    borderRadius: 20, padding: 14, marginBottom: 10, gap: 14,
    borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)",
    shadowColor: "#7C3AED", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  exploreIconWrap: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  exploreText: { flex: 1 },
  exploreLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  exploreDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#64748B", marginTop: 2 },

  // Mentors
  mentorsRow: { flexDirection: "row", gap: 14 },
  mentorCard: { alignItems: "center", gap: 6, width: 76 },
  mentorAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#F5F3FF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#7C3AED" },
  mentorInitial: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#7C3AED" },
  mentorName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  mentorField: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#64748B" },
  alumniEmpty: { paddingVertical: 14, color: "#64748B", fontSize: 13, fontFamily: "Inter_400Regular" },
});
