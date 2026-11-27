import React, { useRef, useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import CampusSvgArt from "./CampusSvgArt";
import FeaturePreviewsModal from "./FeaturePreviewsModal";
import { ThemedText as Text } from "@/components/ThemedNative";

interface ExploreLandingViewProps {
  visible: boolean;
  onClose: () => void;
  onReplayIntro: () => void;
  onJoinPress: (preferredRole?: "Student" | "Alumni" | "Teacher" | "JNV Official") => void;
}

const EXPERIENCE_ITEMS = [
  { label: "Campus", icon: "school-outline" },
  { label: "Hostel life", icon: "bed-outline" },
  { label: "Classrooms", icon: "book-outline" },
  { label: "Assembly", icon: "people-outline" },
  { label: "Sports", icon: "football-outline" },
  { label: "Celebrations", icon: "sparkles-outline" },
];

const PLATFORM_FEATURES = [
  {
    title: "Memories",
    badge: "Preview",
    desc: "Share photos, videos and experiences with your batch. Sample data only.",
  },
  {
    title: "Chats & Community",
    badge: "Preview",
    desc: "Connect with fellow Navodayans in batch and house groups. Demo only.",
  },
  {
    title: "Events",
    badge: "Preview",
    desc: "Discover reunions, competitions and community events. Sample listings only.",
  },
  {
    title: "Navodayan Talks",
    badge: "Preview",
    desc: "Inspiring stories and career journeys from alumni. Demo content only.",
  },
  {
    title: "Digital ID",
    badge: "Preview",
    desc: "A digital identity for the Navodaya community. Sample card only.",
  },
  {
    title: "Alumni Network",
    badge: "Preview",
    desc: "Connect with alumni and discover opportunities. Sample listings only.",
  },
];

const COMMUNITIES: {
  role: "Student" | "Alumni" | "Teacher" | "JNV Official";
  desc: string;
  borderColor: string;
}[] = [
  {
    role: "Student",
    desc: "Learn, participate, connect and preserve school memories.",
    borderColor: "#7650BD",
  },
  {
    role: "Alumni",
    desc: "Reconnect with batchmates, share career journeys and discover opportunities.",
    borderColor: "#3676D9",
  },
  {
    role: "Teacher",
    desc: "Guide students and stay connected with the Navodaya community.",
    borderColor: "#72C9AD",
  },
  {
    role: "JNV Official",
    desc: "Manage authorised JNV community activities and support institutional connections.",
    borderColor: "#EAB64C",
  },
];

const HOUSES = [
  { name: "Aravali", color: "#6A00E0" },
  { name: "Nilgiri", color: "#7A2CF0" },
  { name: "Shivalik", color: "#9B5CF7" },
  { name: "Udaygiri", color: "#B98CFF" },
];

const HOW_IT_WORKS = [
  { step: 1, title: "Join", desc: "Sign up with your batch and house details." },
  { step: 2, title: "Verify", desc: "Your JNV reviewers confirm your Navodaya details." },
  { step: 3, title: "Connect", desc: "Find your batch, house and people." },
];

const TESTIMONIALS = [
  {
    quote: "Finding my batch again felt like coming home.",
    author: "Alumnus, JNV Wardha",
  },
  {
    quote: "The verification steps made me trust the community completely.",
    author: "Senior Teacher, JNV Rohru",
  },
  {
    quote: "I found my house group and seniors within a single day.",
    author: "Student, JNV Gandhinagar",
  },
];

export default function ExploreLandingView({
  visible,
  onClose,
  onReplayIntro,
  onJoinPress,
}: ExploreLandingViewProps) {
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const experienceSectionY = useRef(0);
  const howSectionY = useRef(0);
  const featuresSectionY = useRef(0);
  const housesSectionY = useRef(0);
  const commSectionY = useRef(0);

  if (!visible) return null;

  const handleOpenPreview = (index: number) => {
    setPreviewIndex(index);
  };

  const handleClosePreview = () => {
    setPreviewIndex(null);
  };

  const scrollToExperience = () => {
    scrollViewRef.current?.scrollTo({
      y: experienceSectionY.current || 320,
      animated: true,
    });
  };

  const scrollToY = (y: number) => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(0, y - 80),
      animated: true,
    });
  };

  return (
    <View style={styles.container}>
      {/* 6 Feature Previews Interactive Modal */}
      {previewIndex !== null && (
        <FeaturePreviewsModal
          visible={true}
          initialIndex={previewIndex}
          onClose={handleClosePreview}
          onJoinPress={() => {
            handleClosePreview();
            onJoinPress();
          }}
        />
      )}

      {/* Sticky Header with Navigation Bar */}
      <View style={styles.topHeader}>
        <View style={styles.topHeaderMainRow}>
          <View style={styles.brandRow}>
            <Text style={styles.brandText}>NAVODAYA CONNECT</Text>
          </View>

          <TouchableOpacity
            onPress={onReplayIntro}
            style={styles.replayBtn}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={13} color="#6A00E0" />
            <Text style={styles.replayBtnText}>Replay intro</Text>
          </TouchableOpacity>
        </View>

        {/* Quick-Jump Section Navigation Pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.subnavRow}
        >
          <TouchableOpacity
            style={styles.subnavPill}
            onPress={() => scrollToY(featuresSectionY.current)}
          >
            <Text style={styles.subnavPillText}>Features</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.subnavPill}
            onPress={() => scrollToY(howSectionY.current)}
          >
            <Text style={styles.subnavPillText}>How it works</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.subnavPill}
            onPress={() => scrollToY(housesSectionY.current)}
          >
            <Text style={styles.subnavPillText}>Houses</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.subnavPill}
            onPress={() => scrollToY(commSectionY.current)}
          >
            <Text style={styles.subnavPillText}>Communities</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.subnavPill, styles.subnavPillPrimary]}
            onPress={() => onJoinPress()}
          >
            <Text style={[styles.subnavPillText, styles.subnavPillTextPrimary]}>Join</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <ScrollView
        ref={scrollViewRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero Section */}
        <LinearGradient
          colors={["#4C238C", "#7650BD"]}
          style={styles.heroSection}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
        >
          <View style={styles.heroArtCard}>
            <CampusSvgArt progress={0.5} width="100%" height={160} />
          </View>

          <Text style={styles.heroTitle}>
            Once a Navodayan, Always a Navodayan.
          </Text>
          <Text style={styles.heroSubtitle}>
            One Community. Countless Memories. Connections for Life.
          </Text>

          <View style={styles.heroActions}>
            <TouchableOpacity
              onPress={() => onJoinPress()}
              style={styles.joinPrimaryBtn}
              activeOpacity={0.85}
            >
              <Text style={styles.joinPrimaryText}>Join the Community</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={scrollToExperience}
              style={styles.exploreSecondaryBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.exploreSecondaryText}>
                Explore Navodaya Connect ↓
              </Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* How It Works Section */}
        <View
          style={styles.section}
          onLayout={(e) => {
            howSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionHeading}>How it works</Text>
          <View style={styles.stepsList}>
            {HOW_IT_WORKS.map((s) => (
              <View key={s.step} style={styles.stepCard}>
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>{s.step}</Text>
                </View>
                <View style={styles.stepContent}>
                  <Text style={styles.stepTitle}>{s.title}</Text>
                  <Text style={styles.stepDesc}>{s.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* The Navodaya Experience Section */}
        <View
          style={styles.section}
          onLayout={(e) => {
            experienceSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionHeading}>The Navodaya experience</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.experienceStrip}
          >
            {EXPERIENCE_ITEMS.map((item, idx) => (
              <LinearGradient
                key={idx}
                colors={["#D8C2FF", "#B9A5ED"]}
                style={styles.experiencePill}
              >
                <Ionicons name={item.icon as any} size={20} color="#2D1466" />
                <Text style={styles.experiencePillText}>{item.label}</Text>
              </LinearGradient>
            ))}
          </ScrollView>
          <Text style={styles.sectionNote}>
            Campus art and photos celebrate your Vidyalaya memories.
          </Text>
        </View>

        {/* Platform Features (6 Previews) */}
        <View
          style={styles.section}
          onLayout={(e) => {
            featuresSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionHeading}>Platform features</Text>
          <View style={styles.featuresGrid}>
            {PLATFORM_FEATURES.map((feat, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.featureCard}
                activeOpacity={0.85}
                onPress={() => handleOpenPreview(idx)}
              >
                <View style={styles.featureBadge}>
                  <Text style={styles.featureBadgeText}>{feat.badge}</Text>
                </View>
                <Text style={styles.featureTitle}>{feat.title}</Text>
                <Text style={styles.featureDesc} numberOfLines={3}>
                  {feat.desc}
                </Text>
                <View style={styles.tapPromptRow}>
                  <Text style={styles.tapPromptText}>Tap to preview</Text>
                  <Ionicons name="arrow-forward" size={11} color="#6A00E0" />
                </View>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionNote}>
            Tap a feature to explore its interactive preview.
          </Text>
        </View>

        {/* Our Four Houses Section */}
        <View
          style={styles.section}
          onLayout={(e) => {
            housesSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionHeading}>Our four houses</Text>
          <View style={styles.housesGrid}>
            {HOUSES.map((h) => (
              <TouchableOpacity
                key={h.name}
                style={[styles.houseCard, { borderLeftColor: h.color }]}
                activeOpacity={0.85}
                onPress={() => onJoinPress()}
              >
                <Text style={styles.houseName}>{h.name}</Text>
                <Text style={styles.houseSub}>House</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionNote}>
            Students and alumni choose their house when they join.
          </Text>
        </View>

        {/* Four Communities Section */}
        <View
          style={styles.section}
          onLayout={(e) => {
            commSectionY.current = e.nativeEvent.layout.y;
          }}
        >
          <Text style={styles.sectionHeading}>Four communities</Text>
          <View style={styles.communitiesList}>
            {COMMUNITIES.map((c, idx) => (
              <TouchableOpacity
                key={idx}
                style={[styles.communityCard, { borderLeftColor: c.borderColor }]}
                activeOpacity={0.85}
                onPress={() => onJoinPress(c.role)}
              >
                <Text style={styles.communityRole}>{c.role}</Text>
                <Text style={styles.communityDesc}>{c.desc}</Text>
                <View style={styles.communityChooseRow}>
                  <Text style={styles.communityChooseText}>
                    Choose {c.role} ›
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* What Navodaya Says (Testimonials) */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>What Navodaya says</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.testimonialsStrip}
          >
            {TESTIMONIALS.map((t, idx) => (
              <View key={idx} style={styles.testimonialCard}>
                <Text style={styles.testimonialQuote}>"{t.quote}"</Text>
                <Text style={styles.testimonialAuthor}>— {t.author}</Text>
              </View>
            ))}
          </ScrollView>
        </View>

        {/* Your Privacy Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Your privacy</Text>
          <View style={styles.privacyCard}>
            <Ionicons name="shield-checkmark" size={20} color="#6A00E0" />
            <Text style={styles.privacyText}>
              Your details are shared only with your JNV-verified community. No public directory without verification.
            </Text>
          </View>
        </View>

        {/* CTA Bottom Section */}
        <LinearGradient
          colors={["#F6F3FC", "#E7DBFF"]}
          style={styles.bottomCtaSection}
        >
          <Text style={styles.bottomCtaTitle}>
            Your Navodaya journey never ends.
          </Text>
          <Text style={styles.bottomCtaSubtitle}>
            Years may pass. Cities may change. But the Navodaya connection stays.
          </Text>
          <TouchableOpacity
            onPress={() => onJoinPress()}
            style={styles.bottomJoinBtn}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={["#7A2CF0", "#6A00E0"]}
              style={styles.bottomJoinGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.bottomJoinText}>Join Navodaya Connect</Text>
            </LinearGradient>
          </TouchableOpacity>
        </LinearGradient>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    inset: 0,
    zIndex: 900,
    backgroundColor: "#F6F3FC",
  },
  topHeader: {
    paddingTop: Platform.OS === "web" ? 34 : 44,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: "rgba(246, 243, 252, 0.98)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(217, 204, 255, 0.5)",
  },
  topHeaderMainRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  subnavRow: {
    flexDirection: "row",
    gap: 7,
    paddingVertical: 2,
  },
  subnavPill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D9CCFF",
  },
  subnavPillPrimary: {
    backgroundColor: "#6A00E0",
    borderColor: "#6A00E0",
  },
  subnavPillText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6A00E0",
  },
  subnavPillTextPrimary: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  stepsList: {
    gap: 9,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 12,
    shadowColor: "#4C238C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  stepNumBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#6A00E0",
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 13.5,
    fontWeight: "600",
    color: "#0A0A2A",
  },
  stepDesc: {
    fontSize: 11.5,
    color: "#6B6790",
    marginTop: 1,
  },
  housesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  houseCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    borderLeftWidth: 4,
    shadowColor: "#4C238C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  houseName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#0A0A2A",
  },
  houseSub: {
    fontSize: 11,
    color: "#6B6790",
    marginTop: 2,
  },
  testimonialsStrip: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 6,
  },
  testimonialCard: {
    width: 260,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#4C238C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
    justifyContent: "space-between",
  },
  testimonialQuote: {
    fontSize: 12.5,
    lineHeight: 18,
    color: "#0A0A2A",
    fontWeight: "500",
    marginBottom: 8,
  },
  testimonialAuthor: {
    fontSize: 11,
    color: "#6B6790",
    fontWeight: "600",
  },
  privacyCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#4C238C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    color: "#0A0A2A",
    fontWeight: "500",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  brandText: {
    fontSize: 12.5,
    fontWeight: "600",
    letterSpacing: 1.4,
    color: "#6A00E0",
  },
  replayBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D9CCFF",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  replayBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6A00E0",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroSection: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  heroArtCard: {
    height: 160,
    borderRadius: 18,
    overflow: "hidden",
    marginBottom: 18,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(255, 255, 255, 0.5)",
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: "600",
    lineHeight: 30,
    color: "#FFFFFF",
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#E4D9FF",
    lineHeight: 18,
    marginBottom: 18,
  },
  heroActions: {
    gap: 10,
  },
  joinPrimaryBtn: {
    height: 48,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  joinPrimaryText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#6A00E0",
  },
  exploreSecondaryBtn: {
    height: 48,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
  exploreSecondaryText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  section: {
    paddingHorizontal: 18,
    paddingTop: 24,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0A0A2A",
    marginBottom: 12,
    letterSpacing: -0.2,
  },
  experienceStrip: {
    flexDirection: "row",
    gap: 10,
    paddingBottom: 6,
  },
  experiencePill: {
    width: 140,
    height: 96,
    borderRadius: 16,
    padding: 12,
    justifyContent: "space-between",
  },
  experiencePillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2D1466",
  },
  sectionNote: {
    fontSize: 10,
    color: "#6B6790",
    marginTop: 8,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  featureCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 14,
    shadowColor: "#4C238C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
    justifyContent: "space-between",
    minHeight: 132,
  },
  featureBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#EEE8FF",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
    marginBottom: 6,
  },
  featureBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6A00E0",
  },
  featureTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A0A2A",
    marginBottom: 4,
  },
  featureDesc: {
    fontSize: 11,
    color: "#6B6790",
    lineHeight: 15,
  },
  tapPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 8,
  },
  tapPromptText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#6A00E0",
  },
  communitiesList: {
    gap: 10,
  },
  communityCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 16,
    borderLeftWidth: 4,
    shadowColor: "#4C238C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
    gap: 4,
  },
  communityRole: {
    fontSize: 14.5,
    fontWeight: "600",
    color: "#0A0A2A",
  },
  communityDesc: {
    fontSize: 11.5,
    color: "#6B6790",
    lineHeight: 16,
  },
  communityChooseRow: {
    marginTop: 4,
  },
  communityChooseText: {
    fontSize: 11.5,
    fontWeight: "700",
    color: "#6A00E0",
  },
  bottomCtaSection: {
    marginTop: 28,
    paddingHorizontal: 20,
    paddingVertical: 32,
    alignItems: "center",
    textAlign: "center",
  },
  bottomCtaTitle: {
    fontSize: 21,
    fontWeight: "600",
    color: "#0A0A2A",
    textAlign: "center",
    lineHeight: 26,
    marginBottom: 8,
  },
  bottomCtaSubtitle: {
    fontSize: 12.5,
    color: "#6B6790",
    textAlign: "center",
    lineHeight: 18,
    marginBottom: 18,
  },
  bottomJoinBtn: {
    width: "100%",
    height: 50,
    borderRadius: 999,
    overflow: "hidden",
  },
  bottomJoinGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  bottomJoinText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
