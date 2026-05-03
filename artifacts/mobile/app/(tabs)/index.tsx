import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
  FlatList,
  Animated,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { api } from "@/lib/api";
import type { NewsItem } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

const STUDENT_ACTIONS = [
  { label: "Ask Alumni", icon: "chatbubble-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(tabs)/chats" },
  { label: "Report Problem", icon: "alert-circle-outline" as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/report-problem" },
  { label: "Find Mentor", icon: "people-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/alumni" },
  { label: "View Events", icon: "calendar-outline" as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(tabs)/events" },
];
const TEACHER_ACTIONS = [
  { label: "Post Update", icon: "megaphone-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/create-news" },
  { label: "Create Event", icon: "calendar-outline" as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(tabs)/events" },
  { label: "View Problems", icon: "alert-circle-outline" as const, color: "#EF4444", bg: "#FEF2F2", route: "/(screens)/report-problem" },
  { label: "My Groups", icon: "people-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(tabs)/chats" },
];
const ALUMNI_ACTIONS = [
  { label: "Mentor Students", icon: "school-outline" as const, color: "#3D5AF1", bg: "#EEF2FF", route: "/(screens)/alumni" },
  { label: "Post Advice", icon: "create-outline" as const, color: "#10B981", bg: "#ECFDF5", route: "/(screens)/create-news" },
  { label: "Community", icon: "people-outline" as const, color: "#8B5CF6", bg: "#F5F3FF", route: "/(screens)/community" },
  { label: "Events", icon: "calendar-outline" as const, color: "#F59E0B", bg: "#FFFBEB", route: "/(tabs)/events" },
];

const FALLBACK_NEWS: NewsItem[] = [
  { id: "fn1", title: "JNV Selection Test 2025 Results Announced", description: "The National Testing Agency has released the JNVST 2025 results. Over 2.9 lakh students qualified for admission across 661 JNVs in India. Check the official NTA portal for your result.", category: "Exam", authorName: "NTA / NCERT", jnvName: "National", createdAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: "fn2", title: "Annual Sports Day Inter-JNV Tournament 2025", description: "Navodaya Vidyalaya Samiti announces the 31st inter-JNV National Sports Tournament. Events include Athletics, Football, Volleyball, and Kabaddi. Registrations open till 30th June.", category: "Sports", authorName: "NVS Headquarters", jnvName: "National", createdAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: "fn3", title: "CBSE Board Results 2025 — JNV Students Excel", description: "JNV students once again outperformed the national average in Class 10 and Class 12 CBSE board examinations with a 98.7% pass rate. Several students secured top district ranks.", category: "Academic", authorName: "NVS Academic Cell", jnvName: "National", createdAt: new Date(Date.now() - 86400000 * 8).toISOString() },
  { id: "fn4", title: "Navodaya Alumni Global Connect 2025", description: "The NVS Alumni Association is organising its annual Global Connect event on 15th August 2025. Alumni from over 40 countries are expected to participate virtually.", category: "Event", authorName: "NVS Alumni Association", jnvName: "National", createdAt: new Date(Date.now() - 86400000 * 12).toISOString() },
];

const FALLBACK_ANNOUNCEMENTS: NewsItem[] = [
  { id: "fa1", title: "Holiday Notice: Schools Closed on 15th August", description: "All Jawahar Navodaya Vidyalayas will remain closed on 15th August 2025 on account of Independence Day. Flag hoisting ceremony will be held at 8:00 AM. All students must attend in formal dress.", category: "Announcement", authorName: "Principal", jnvName: "JNV India", createdAt: new Date(Date.now() - 86400000).toISOString() },
  { id: "fa2", title: "Mid-Term Examinations Schedule Released", description: "Mid-term examinations for Classes 6–12 will be held from 1st to 10th August 2025. Timetable has been displayed on the school notice board. Students are advised to start preparation immediately.", category: "Announcement", authorName: "Exam Coordinator", jnvName: "JNV India", createdAt: new Date(Date.now() - 86400000 * 3).toISOString() },
  { id: "fa3", title: "Annual Prize Distribution Ceremony – 20th August", description: "The Annual Prize Distribution Ceremony will be held on 20th August 2025 at 10:00 AM in the school auditorium. Parents and guardians are cordially invited. Best dress code is mandatory.", category: "Announcement", authorName: "JNV Official", jnvName: "JNV India", createdAt: new Date(Date.now() - 86400000 * 6).toISOString() },
];

const ANNOUNCEMENT_CATEGORIES = ["announcement", "notice", "official", "circular"];
const NEWS_CATEGORY_COLORS: Record<string, { bg: string; color: string }> = {
  Academic: { bg: "#EEF2FF", color: "#3D5AF1" },
  Exam: { bg: "#FEF3C7", color: "#D97706" },
  Sports: { bg: "#ECFDF5", color: "#10B981" },
  Event: { bg: "#F5F3FF", color: "#8B5CF6" },
  Announcement: { bg: "#FEF2F2", color: "#EF4444" },
  Default: { bg: "#F3F4F6", color: "#6B7280" },
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

// ── House Arena shared data ──
const HOUSE_META_HOME: Record<string, { color: string; emoji: string }> = {
  Aravali:  { color: "#1D6ADE", emoji: "💙" },
  Nilgiri:  { color: "#16A34A", emoji: "💚" },
  Shivalik: { color: "#DC2626", emoji: "❤️" },
  Udaygiri: { color: "#D97706", emoji: "💛" },
};
type HouseScore = { name: string; points: number; delta: number };
const INITIAL_ARENA_SCORES: HouseScore[] = [
  { name: "Shivalik", points: 2840, delta: 0 },
  { name: "Aravali",  points: 2710, delta: 0 },
  { name: "Nilgiri",  points: 2590, delta: 0 },
  { name: "Udaygiri", points: 2420, delta: 0 },
];
const LIVE_CHALLENGES = [
  { id: "gk-blitz",   title: "GK Blitz Quiz",  icon: "🧠", color: "#3D5AF1", players: 63, pts: 50  },
  { id: "math-ninja", title: "Number Ninja",    icon: "🔢", color: "#10B981", players: 41, pts: 70  },
];
const RANK_MEDALS_HOME = ["🥇", "🥈", "🥉", "4️⃣"];

const GRADIENT_SETS = [
  ["#3D5AF1", "#2563EB"] as const,
  ["#10B981", "#059669"] as const,
  ["#8B5CF6", "#7C3AED"] as const,
  ["#F59E0B", "#D97706"] as const,
  ["#EF4444", "#DC2626"] as const,
];

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const [allNews, setAllNews] = useState<NewsItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const topPad = Platform.OS === "web" ? 60 : insets.top;

  const role = profile?.role ?? "student";
  const isTeacher = role === "teacher";
  const isAlumni = role === "alumni";
  const isOfficial = role === "official";

  const quickActions = isTeacher || isOfficial ? TEACHER_ACTIONS : isAlumni ? ALUMNI_ACTIONS : STUDENT_ACTIONS;

  // House Arena live state
  const [arenaScores, setArenaScores] = useState<HouseScore[]>(INITIAL_ARENA_SCORES);
  const [livePlayerCount, setLivePlayerCount] = useState({ "gk-blitz": 63, "math-ninja": 41 });
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.5, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,   duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setArenaScores((prev) => {
        const updated = prev.map((h) => {
          const delta = Math.random() < 0.6 ? Math.floor(Math.random() * 15) + 2 : 0;
          return { ...h, points: h.points + delta, delta };
        });
        return [...updated].sort((a, b) => b.points - a.points);
      });
      setLivePlayerCount((p) => ({
        "gk-blitz":   Math.max(40, p["gk-blitz"]  + (Math.random() < 0.5 ? 1 : -1)),
        "math-ninja": Math.max(20, p["math-ninja"] + (Math.random() < 0.5 ? 1 : -1)),
      }));
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const n = await api.news.list();
      setAllNews(n);
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, []);

  const announcements = allNews.filter((n) =>
    ANNOUNCEMENT_CATEGORIES.includes(n.category?.toLowerCase() || "")
  );
  const jnvNews = allNews.filter((n) =>
    !ANNOUNCEMENT_CATEGORIES.includes(n.category?.toLowerCase() || "")
  );

  const displayNews = jnvNews.length > 0 ? jnvNews : FALLBACK_NEWS;
  const displayAnnouncements = announcements.length > 0 ? announcements : FALLBACK_ANNOUNCEMENTS;

  const featuredNews = displayNews[0];
  const moreNews = displayNews.slice(1);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <View>
          <Text style={styles.headerGreeting}>Good {getGreeting()},</Text>
          <Text style={styles.headerTitle}>{profile?.fullName?.split(" ")[0] || "Navodayan"} 👋</Text>
        </View>
        <TouchableOpacity
          style={styles.bellBtn}
          onPress={() => router.push("/(screens)/notifications" as any)}
        >
          <Ionicons name="notifications-outline" size={22} color="#3D5AF1" />
          <View style={styles.bellDot} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3D5AF1" />}
      >
        {/* Welcome + Stats Card */}
        <LinearGradient colors={["#4B6EF5", "#3151E8"]} style={styles.welcomeCard}>
          <View style={styles.welcomeRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.welcomeJnv}>{profile?.jnvName || "JNV India"}</Text>
              <Text style={styles.welcomeRole}>{getRoleLabel(role)}</Text>
            </View>
            <View style={styles.houseTag}>
              <Text style={styles.houseTagText}>{profile?.house || "Aravali"}</Text>
            </View>
          </View>
          {isTeacher || isOfficial ? (
            <View style={styles.teacherStats}>
              {[
                { label: "Classes", value: "3", icon: "school-outline" as const },
                { label: "Students", value: "86", icon: "people-outline" as const },
                { label: "Events", value: "4", icon: "calendar-outline" as const },
                { label: "Issues", value: "7", icon: "alert-circle-outline" as const },
              ].map((s) => (
                <View key={s.label} style={styles.statBox}>
                  <Ionicons name={s.icon} size={14} color="rgba(255,255,255,0.75)" />
                  <Text style={styles.statVal}>{s.value}</Text>
                  <Text style={styles.statLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.studentBadgeRow}>
              {profile?.class && <View style={styles.studentBadge}><Text style={styles.studentBadgeText}>Class {profile.class}</Text></View>}
              {profile?.passoutYear && <View style={styles.studentBadge}><Text style={styles.studentBadgeText}>Batch {profile.passoutYear}</Text></View>}
              {profile?.jnvState && <View style={styles.studentBadge}><Text style={styles.studentBadgeText}>{profile.jnvState}</Text></View>}
            </View>
          )}
        </LinearGradient>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {quickActions.map((action) => (
              <TouchableOpacity key={action.label} style={styles.actionCard} activeOpacity={0.75} onPress={() => router.push(action.route as any)}>
                <View style={[styles.actionIcon, { backgroundColor: action.bg }]}>
                  <Ionicons name={action.icon} size={22} color={action.color} />
                </View>
                <Text style={styles.actionLabel}>{action.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* ── HOUSE ARENA ── */}
        <View style={[styles.section, { marginTop: 18, paddingHorizontal: 0 }]}>
          <LinearGradient colors={["#1E1B4B", "#312E81"]} style={styles.arenaCard}>
            {/* Header row */}
            <View style={styles.arenaTopRow}>
              <View>
                <Text style={styles.arenaTitle}>🏆 House Arena</Text>
                <Text style={styles.arenaSub}>Live standings · updates every 4s</Text>
              </View>
              <View style={styles.arenaLiveChip}>
                <Animated.View style={[styles.arenaLiveDot, { transform: [{ scale: pulseAnim }] }]} />
                <Text style={styles.arenaLiveText}>LIVE</Text>
              </View>
            </View>

            {/* Leaderboard */}
            <View style={styles.arenaBoard}>
              {arenaScores.map((h, i) => {
                const meta = HOUSE_META_HOME[h.name];
                const maxPts = arenaScores[0]?.points ?? 1;
                const barW = (h.points / maxPts) * 100;
                const isMe = h.name === profile?.house;
                return (
                  <View key={h.name} style={[styles.arenaRow, isMe && styles.arenaRowMe]}>
                    <Text style={styles.arenaMedal}>{RANK_MEDALS_HOME[i]}</Text>
                    <View style={[styles.arenaDot, { backgroundColor: meta?.color ?? "#888" }]} />
                    <View style={styles.arenaInfo}>
                      <View style={styles.arenaNameRow}>
                        <Text style={styles.arenaName}>{h.name} {meta?.emoji}{isMe ? " ★" : ""}</Text>
                        <View style={styles.arenaRightRow}>
                          {h.delta > 0 && <Text style={styles.arenaDelta}>+{h.delta}</Text>}
                          <Text style={styles.arenaPoints}>{h.points.toLocaleString()}</Text>
                        </View>
                      </View>
                      <View style={styles.arenaBarBg}>
                        <View style={[styles.arenaBarFill, { width: `${barW}%` as any, backgroundColor: meta?.color ?? "#888" }]} />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Live Challenges strip */}
            <View style={styles.arenaChallenges}>
              {LIVE_CHALLENGES.map((c) => (
                <TouchableOpacity
                  key={c.id}
                  style={styles.arenaChallengeCard}
                  activeOpacity={0.85}
                  onPress={() => router.push("/(tabs)/chats" as any)}
                >
                  <Text style={styles.arenaChallengeIcon}>{c.icon}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.arenaChallengeName}>{c.title}</Text>
                    <Text style={styles.arenaChallengeInfo}>
                      🔴 {livePlayerCount[c.id as keyof typeof livePlayerCount]} playing · +{c.pts} pts
                    </Text>
                  </View>
                  <View style={[styles.arenaPlayBtn, { backgroundColor: c.color }]}>
                    <Text style={styles.arenaPlayText}>Play</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={styles.arenaSeeAll} onPress={() => router.push("/(tabs)/chats" as any)}>
              <Text style={styles.arenaSeeAllText}>See all challenges in Arena</Text>
              <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
            </TouchableOpacity>
          </LinearGradient>
        </View>

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
            <TouchableOpacity key={item.id} style={styles.announceCard} activeOpacity={0.8} onPress={() => router.push("/(screens)/news" as any)}>
              <View style={styles.announceStripe} />
              <View style={styles.announceBody}>
                <View style={styles.announceTop}>
                  <View style={styles.announcerInfo}>
                    <View style={styles.announcerAvatar}>
                      <Ionicons name="megaphone-outline" size={14} color="#EF4444" />
                    </View>
                    <View>
                      <Text style={styles.announcerName}>{item.authorName || "JNV Official"}</Text>
                      <Text style={styles.announcerJnv}>{item.jnvName || "JNV India"}</Text>
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
            <TouchableOpacity activeOpacity={0.88} onPress={() => router.push("/(screens)/news" as any)} style={styles.featuredCard}>
              <LinearGradient colors={GRADIENT_SETS[0]} style={styles.featuredGradient}>
                <View style={styles.featuredCatTag}>
                  <Text style={styles.featuredCatText}>{featuredNews.category || "News"}</Text>
                </View>
                <Text style={styles.featuredTitle} numberOfLines={3}>{featuredNews.title}</Text>
                <Text style={styles.featuredDesc} numberOfLines={2}>{featuredNews.description}</Text>
                <View style={styles.featuredFooter}>
                  <View style={styles.featuredAuthorRow}>
                    <Ionicons name="person-circle-outline" size={15} color="rgba(255,255,255,0.8)" />
                    <Text style={styles.featuredAuthor}>{featuredNews.authorName || "NVS"}</Text>
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
                  <TouchableOpacity style={styles.newsCard} activeOpacity={0.82} onPress={() => router.push("/(screens)/news" as any)}>
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
          {[
            { label: "JNV Rankings", desc: "India-wide & state JNV rankings", icon: "trophy-outline" as const, iconColor: "#F59E0B", iconBg: "#FFFBEB", route: "/(screens)/rankings" },
            { label: "JNV Store", desc: "Merchandise, books & study notes", icon: "storefront-outline" as const, iconColor: "#8B5CF6", iconBg: "#F5F3FF", route: "/(tabs)/store" },
          ].map((item) => (
            <TouchableOpacity key={item.label} style={styles.exploreRow} onPress={() => router.push(item.route as any)} activeOpacity={0.75}>
              <View style={[styles.exploreIconWrap, { backgroundColor: item.iconBg }]}>
                <Ionicons name={item.icon} size={22} color={item.iconColor} />
              </View>
              <View style={styles.exploreText}>
                <Text style={styles.exploreLabel}>{item.label}</Text>
                <Text style={styles.exploreDesc}>{item.desc}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          ))}
        </View>

        {/* Available Mentors */}
        <View style={[styles.section, { marginTop: 18 }]}>
          <View style={styles.sectionRow}>
            <Text style={styles.sectionTitle}>Available Mentors</Text>
            <TouchableOpacity onPress={() => router.push("/(screens)/alumni" as any)}>
              <Text style={styles.seeAll}>See All</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.mentorsRow}>
            {[
              { id: "1", name: "Priya S.", field: "Engineering" },
              { id: "2", name: "Amit K.", field: "IAS Officer" },
              { id: "3", name: "Neha R.", field: "Medicine" },
              { id: "4", name: "Raj M.", field: "Research" },
            ].map((m) => (
              <TouchableOpacity key={m.id} style={styles.mentorCard} activeOpacity={0.8} onPress={() => router.push("/(screens)/alumni" as any)}>
                <View style={styles.mentorAvatarWrap}>
                  <View style={styles.mentorAvatar}>
                    <Text style={styles.mentorInitial}>{m.name[0]}</Text>
                  </View>
                  <View style={styles.mentorDot} />
                </View>
                <Text style={styles.mentorName} numberOfLines={1}>{m.name}</Text>
                <Text style={styles.mentorField} numberOfLines={1}>{m.field}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  container: { flex: 1, backgroundColor: "#F5F6FA" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingBottom: 12,
    backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#F0F0F0",
  },
  headerGreeting: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  headerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827" },
  bellBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: "#EF4444", borderWidth: 1.5, borderColor: "#fff" },
  welcomeCard: { marginHorizontal: 16, marginTop: 16, borderRadius: 18, padding: 18 },
  welcomeRow: { flexDirection: "row", alignItems: "flex-start", marginBottom: 14 },
  welcomeJnv: { color: "#fff", fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 3 },
  welcomeRole: { color: "rgba(255,255,255,0.75)", fontSize: 13, fontFamily: "Inter_400Regular" },
  houseTag: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  houseTagText: { color: "#fff", fontSize: 13, fontFamily: "Inter_600SemiBold" },
  teacherStats: { flexDirection: "row", gap: 0 },
  statBox: { flex: 1, alignItems: "center", gap: 2 },
  statVal: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold" },
  statLabel: { color: "rgba(255,255,255,0.7)", fontSize: 10, fontFamily: "Inter_400Regular" },
  studentBadgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  studentBadge: { backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  studentBadgeText: { color: "#fff", fontSize: 12, fontFamily: "Inter_500Medium" },
  section: { paddingHorizontal: 16, marginTop: 20 },
  sectionRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 14 },
  seeAll: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#3D5AF1" },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  actionCard: {
    width: "47%", backgroundColor: "#fff", borderRadius: 14, padding: 14,
    alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#F0F0F0",
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1,
  },
  actionIcon: { width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center" },
  actionLabel: { fontSize: 12, fontFamily: "Inter_500Medium", color: "#111827", textAlign: "center" },

  // Announcements
  announceBadge: { width: 24, height: 24, borderRadius: 8, backgroundColor: "#EF4444", alignItems: "center", justifyContent: "center" },
  newsBadge: { width: 24, height: 24, borderRadius: 8, backgroundColor: "#3D5AF1", alignItems: "center", justifyContent: "center" },
  announceCard: {
    flexDirection: "row", backgroundColor: "#fff", borderRadius: 14, marginBottom: 10,
    borderWidth: 1, borderColor: "#F0F0F0", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2,
  },
  announceStripe: { width: 4, backgroundColor: "#EF4444" },
  announceBody: { flex: 1, padding: 14 },
  announceTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 },
  announcerInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1 },
  announcerAvatar: { width: 30, height: 30, borderRadius: 8, backgroundColor: "#FEF2F2", alignItems: "center", justifyContent: "center" },
  announcerName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827" },
  announcerJnv: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },
  announceDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginLeft: 4 },
  announceTitle: { fontSize: 14, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 4, lineHeight: 20 },
  announceDesc: { fontSize: 13, fontFamily: "Inter_400Regular", color: "#6B7280", lineHeight: 19, marginBottom: 8 },
  announceFooter: { flexDirection: "row" },
  officialTag: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FEF2F2", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  officialTagText: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: "#EF4444" },

  // Featured news
  featuredCard: { borderRadius: 16, overflow: "hidden" },
  featuredGradient: { padding: 20, minHeight: 160, justifyContent: "flex-end" },
  featuredCatTag: { position: "absolute", top: 16, left: 16, backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  featuredCatText: { color: "#fff", fontSize: 12, fontFamily: "Inter_600SemiBold" },
  featuredTitle: { color: "#fff", fontSize: 18, fontFamily: "Inter_700Bold", lineHeight: 26, marginBottom: 6 },
  featuredDesc: { color: "rgba(255,255,255,0.8)", fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 19, marginBottom: 12 },
  featuredFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  featuredAuthorRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  featuredAuthor: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontFamily: "Inter_500Medium" },
  featuredDate: { color: "rgba(255,255,255,0.7)", fontSize: 12, fontFamily: "Inter_400Regular" },

  // News cards
  newsCard: { width: 180, backgroundColor: "#fff", borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: "#F0F0F0" },
  newsCardHeader: { height: 70, justifyContent: "flex-end", padding: 10 },
  newsCardCatTag: { backgroundColor: "rgba(255,255,255,0.25)", borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" },
  newsCardCatText: { color: "#fff", fontSize: 10, fontFamily: "Inter_600SemiBold" },
  newsCardBody: { padding: 12 },
  newsCardTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#111827", lineHeight: 18, marginBottom: 8 },
  newsCardFooter: { flexDirection: "row", justifyContent: "space-between" },
  newsCardDate: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#9CA3AF" },

  // Explore
  exploreRow: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#fff",
    borderRadius: 14, padding: 14, marginBottom: 10, gap: 14,
    borderWidth: 1, borderColor: "#F0F0F0",
  },
  exploreIconWrap: { width: 46, height: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  exploreText: { flex: 1 },
  exploreLabel: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#111827" },
  exploreDesc: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#6B7280", marginTop: 2 },

  // Mentors
  mentorsRow: { flexDirection: "row", gap: 12 },
  mentorCard: { alignItems: "center", gap: 6, width: 72 },
  mentorAvatarWrap: { position: "relative" },
  mentorAvatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#3D5AF1" },
  mentorDot: { position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#10B981", borderWidth: 2, borderColor: "#fff" },
  mentorInitial: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#3D5AF1" },
  mentorName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#111827" },
  mentorField: { fontSize: 10, fontFamily: "Inter_400Regular", color: "#6B7280" },

  // House Arena (home dashboard)
  arenaCard: { marginHorizontal: 16, borderRadius: 20, padding: 16 },
  arenaTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  arenaTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: "#fff" },
  arenaSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.55)", marginTop: 2 },
  arenaLiveChip: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  arenaLiveDot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#EF4444" },
  arenaLiveText: { fontSize: 10, fontFamily: "Inter_700Bold", color: "#fff", letterSpacing: 0.5 },
  arenaBoard: { gap: 9, marginBottom: 14 },
  arenaRow: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, padding: 9 },
  arenaRowMe: { backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  arenaMedal: { fontSize: 17, width: 24, textAlign: "center" },
  arenaDot: { width: 9, height: 9, borderRadius: 4.5 },
  arenaInfo: { flex: 1 },
  arenaNameRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  arenaName: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#fff" },
  arenaRightRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  arenaDelta: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: "#6EE7B7", backgroundColor: "rgba(110,231,183,0.15)", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 6 },
  arenaPoints: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  arenaBarBg: { height: 4, backgroundColor: "rgba(255,255,255,0.12)", borderRadius: 2, overflow: "hidden" },
  arenaBarFill: { height: 4, borderRadius: 2 },
  arenaChallenges: { gap: 8, marginBottom: 12 },
  arenaChallengeCard: { flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 12, padding: 10 },
  arenaChallengeIcon: { fontSize: 22, width: 32, textAlign: "center" },
  arenaChallengeName: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#fff", marginBottom: 2 },
  arenaChallengeInfo: { fontSize: 11, fontFamily: "Inter_400Regular", color: "rgba(255,255,255,0.6)" },
  arenaPlayBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  arenaPlayText: { fontSize: 12, fontFamily: "Inter_700Bold", color: "#fff" },
  arenaSeeAll: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingTop: 4 },
  arenaSeeAllText: { fontSize: 12, fontFamily: "Inter_500Medium", color: "rgba(255,255,255,0.6)" },
});
