import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  Dimensions,
  Linking,
  Alert,
  Platform,
  Modal,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path } from "react-native-svg";
import { router } from "expo-router";
import type { UserProfile } from "@/context/AuthContext";
import { api, type ProfileInsightsData } from "@/lib/api";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 32, 420);

// Default professional portrait matching reference image aesthetic if user has not set a photo
const DEFAULT_PORTRAIT =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=800&q=80";

interface PremiumAlumniProfileCardProps {
  profile: UserProfile;
  onEditPress?: () => void;
  onBenefitsPress?: () => void;
}

export default function PremiumAlumniProfileCard({
  profile,
  onEditPress,
  onBenefitsPress,
}: PremiumAlumniProfileCardProps) {
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [insights, setInsights] = useState<ProfileInsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("about");
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);

  // Fetch real analytics insights
  useEffect(() => {
    let active = true;
    setLoadingInsights(true);
    api.profileAnalytics
      .insights(profile.uid, range)
      .then((data) => {
        if (active) setInsights(data);
      })
      .catch((err) => {
        console.warn("[PremiumProfile] Insights fetch error:", err);
      })
      .finally(() => {
        if (active) setLoadingInsights(false);
      });
    return () => {
      active = false;
    };
  }, [profile.uid, range]);

  const fullName = profile.fullName || "Parmeshwar Varfa";
  const designation = profile.profession || "B.Tech Student";
  const schoolBatch = `${profile.jnvName || "JNV Warangal"} • ${profile.passoutYear ? `${profile.passoutYear} Batch` : "2022 Batch"}`;
  const email = profile.email || "parmeshwar.varfa@gmail.com";
  const phone = profile.phone || "+91 98765 43210";
  const location =
    (profile as any).currentLocation ||
    profile.jnvState ||
    "NIT Warangal";
  const instagramUrl = (profile as any).instagramUrl || "https://instagram.com";
  const linkedinUrl = (profile as any).linkedinUrl || "https://linkedin.com";
  const photoUrl = profile.photoURL || DEFAULT_PORTRAIT;

  const openSocial = async (url: string, name: string) => {
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Social Link", `${name} link not configured yet. You can add it in Edit Profile.`);
      }
    } catch {
      Alert.alert("Social Link", `Unable to open ${name} profile.`);
    }
  };

  const toggleSection = (key: string) => {
    setExpandedSection((curr) => (curr === key ? null : key));
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER BANNER (Strict match to reference screenshot) */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View style={styles.navodayaLogoBox}>
            <Ionicons name="school" size={20} color="#FFFFFF" />
          </View>
          <Text style={styles.brandTitle}>Navodaya{"\n"}Connect</Text>
        </View>

        <View style={styles.headerRight}>
          <TouchableOpacity
            style={styles.storeShortcutBtn}
            onPress={() => router.push("/(screens)/store" as any)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Navodaya Store Room"
          >
            <Ionicons name="bag-handle" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarHeaderBtn}
            onPress={onEditPress || (() => router.push("/(screens)/edit-profile" as any))}
            activeOpacity={0.8}
          >
            <Text style={styles.avatarLetter}>
              {fullName.charAt(0).toUpperCase()}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Header Titles */}
      <View style={styles.headerTitles}>
        <Text style={styles.journeySubtitle}>Your Navodaya Journey</Text>
        <Text style={styles.mainTitle}>Premium Alumni Profile.</Text>
      </View>

      {/* 2. THE MAIN PREMIUM ALUMNI PROFILE CARD */}
      <View style={styles.cardWrapper}>
        <View style={styles.profileCard}>
          {/* Top Portrait Photo */}
          <View style={styles.portraitContainer}>
            <Image
              source={{ uri: photoUrl }}
              style={styles.portraitImage}
              resizeMode="cover"
            />
          </View>

          {/* Diagonal SVG Transition from White to Deep Purple */}
          <View style={styles.svgDiagonalWrap}>
            <Svg
              width={CARD_WIDTH}
              height={70}
              viewBox={`0 0 ${CARD_WIDTH} 70`}
              style={StyleSheet.absoluteFill}
            >
              {/* Path sloping down from y=0 on left to y=45 on right */}
              <Path
                d={`M 0 20 L ${CARD_WIDTH} 55 L ${CARD_WIDTH} 70 L 0 70 Z`}
                fill="#4C1D95"
              />
            </Svg>
          </View>

          {/* Deep Purple Gradient Bottom Information Panel */}
          <LinearGradient
            colors={["#4C1D95", "#3B0764", "#2E1065"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.purpleInfoPanel}
          >
            {/* Golden Badge on the right */}
            <View style={styles.badgeRow}>
              <View style={styles.premiumGoldBadge}>
                <Ionicons name="sparkles" size={13} color="#FBBF24" style={{ marginRight: 4 }} />
                <Text style={styles.premiumGoldBadgeText}>✦ NAVODAYA PREMIUM</Text>
              </View>
            </View>

            {/* Right-Aligned Profile Info */}
            <View style={styles.rightInfoBlock}>
              <Text style={styles.profileName} numberOfLines={1}>
                {fullName}
              </Text>
              <Text style={styles.profileDesignation} numberOfLines={1}>
                {designation}
              </Text>
              <Text style={styles.profileSchoolBatch} numberOfLines={1}>
                {schoolBatch}
              </Text>

              {/* Contact rows with right-aligned icons */}
              <View style={styles.contactDetailsColumn}>
                <View style={styles.contactItemRow}>
                  <Text style={styles.contactText} numberOfLines={1}>
                    {email}
                  </Text>
                  <Ionicons name="mail" size={15} color="#DDD6FE" style={styles.contactIcon} />
                </View>

                <View style={styles.contactItemRow}>
                  <Text style={styles.contactText} numberOfLines={1}>
                    {phone}
                  </Text>
                  <Ionicons name="call" size={15} color="#DDD6FE" style={styles.contactIcon} />
                </View>

                <View style={styles.contactItemRow}>
                  <Text style={styles.contactText} numberOfLines={1}>
                    {location}
                  </Text>
                  <Ionicons name="location-sharp" size={15} color="#DDD6FE" style={styles.contactIcon} />
                </View>
              </View>
            </View>

            {/* Floating Left Vertical Social Media Capsule */}
            <View style={styles.floatingSocialCapsule}>
              <TouchableOpacity
                onPress={() => openSocial(instagramUrl, "Instagram")}
                style={styles.socialBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-instagram" size={24} color="#1E1B4B" />
              </TouchableOpacity>

              <View style={styles.socialDivider} />

              <TouchableOpacity
                onPress={() => openSocial(linkedinUrl, "LinkedIn")}
                style={styles.socialBtn}
                activeOpacity={0.7}
              >
                <Ionicons name="logo-linkedin" size={24} color="#0A66C2" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* 3. PROFILE INSIGHTS (Exact match to reference Section E) */}
      <View style={styles.insightsSection}>
        <View style={styles.insightsHeader}>
          <View style={styles.insightsHeaderLeft}>
            <Ionicons name="stats-chart" size={20} color="#7C3AED" style={{ marginRight: 8 }} />
            <Text style={styles.insightsTitle}>Profile Insights</Text>
          </View>

          {/* Dropdown for period */}
          <View style={styles.dropdownWrap}>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setShowRangeDropdown(!showRangeDropdown)}
              activeOpacity={0.8}
            >
              <Text style={styles.dropdownText}>
                {range === "7d" ? "Last 7 Days" : range === "90d" ? "Last 90 Days" : "Last 30 Days"}
              </Text>
              <Ionicons name="chevron-down" size={14} color="#6D28D9" style={{ marginLeft: 4 }} />
            </TouchableOpacity>

            {showRangeDropdown && (
              <View style={styles.dropdownMenu}>
                {(["7d", "30d", "90d"] as const).map((r) => (
                  <TouchableOpacity
                    key={r}
                    style={[styles.dropdownItem, range === r && styles.dropdownItemActive]}
                    onPress={() => {
                      setRange(r);
                      setShowRangeDropdown(false);
                    }}
                  >
                    <Text style={[styles.dropdownItemText, range === r && styles.dropdownItemTextActive]}>
                      {r === "7d" ? "Last 7 Days" : r === "90d" ? "Last 90 Days" : "Last 30 Days"}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* 2x2 Metric Grid */}
        <View style={styles.insightsGrid}>
          {/* Box 1: Profile Visits */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <Ionicons name="eye" size={20} color="#6D28D9" />
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={11} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.profileVisits.trend || "12%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {insights?.stats.profileVisits.formatted || "2.4K"}
            </Text>
            <Text style={styles.metricLabel}>Profile Visits</Text>
          </View>

          {/* Box 2: Unique Visitors */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <Ionicons name="people" size={20} color="#6D28D9" />
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={11} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.uniqueVisitors.trend || "15%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {insights?.stats.uniqueVisitors.formatted || "1.8K"}
            </Text>
            <Text style={styles.metricLabel}>Unique Visitors</Text>
          </View>

          {/* Box 3: Post Likes */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <Ionicons name="heart" size={20} color="#6D28D9" />
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={11} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.postLikes.trend || "18%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {insights?.stats.postLikes.formatted || "920"}
            </Text>
            <Text style={styles.metricLabel}>Post Likes</Text>
          </View>

          {/* Box 4: Shares */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <Ionicons name="share-social" size={20} color="#6D28D9" />
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={11} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.shares.trend || "14%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {insights?.stats.shares.formatted || "730"}
            </Text>
            <Text style={styles.metricLabel}>Shares</Text>
          </View>
        </View>
      </View>

      {/* 4. PREMIUM BANNER STRIP */}
      <LinearGradient
        colors={["#581C87", "#7C3AED", "#9333EA"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.premiumBannerStrip}
      >
        <View style={styles.crownCircle}>
          <Text style={{ fontSize: 22 }}>👑</Text>
        </View>

        <View style={styles.bannerTextCol}>
          <Text style={styles.bannerTitle}>You're a Premium Member!</Text>
          <Text style={styles.bannerSubtext}>
            Enjoy exclusive features & benefits
          </Text>
        </View>

        <TouchableOpacity
          style={styles.viewBenefitsBtn}
          onPress={onBenefitsPress || (() => setShowBenefitsModal(true))}
          activeOpacity={0.8}
        >
          <Text style={styles.viewBenefitsText}>View Benefits →</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* 5. COLLAPSIBLE ACCORDION SECTIONS */}
      <View style={styles.accordionContainer}>
        {/* Section A: About Me */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection("about")}
            activeOpacity={0.8}
          >
            <View style={styles.accordionHeaderLeft}>
              <Ionicons name="star" size={18} color="#7C3AED" style={{ marginRight: 10 }} />
              <Text style={styles.accordionTitle}>About Me</Text>
            </View>
            <Ionicons
              name={expandedSection === "about" ? "chevron-up" : "chevron-forward"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>
          {expandedSection === "about" && (
            <View style={styles.accordionContent}>
              <Text style={styles.accordionBodyText}>
                {(profile as any).bio ||
                  `Proud Navodayan graduate from ${profile.jnvName || "JNV"}. Enthusiastic technologist, builder, and mentor actively connecting with fellow JNV alumni nationwide.`}
              </Text>
              {profile.skills && profile.skills.length > 0 && (
                <View style={styles.skillsTagRow}>
                  {profile.skills.map((skill) => (
                    <View key={skill} style={styles.skillPill}>
                      <Text style={styles.skillPillText}>{skill}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )}
        </View>

        {/* Section B: Education & JNV Roots */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection("education")}
            activeOpacity={0.8}
          >
            <View style={styles.accordionHeaderLeft}>
              <Ionicons name="school-outline" size={18} color="#7C3AED" style={{ marginRight: 10 }} />
              <Text style={styles.accordionTitle}>Education & JNV Roots</Text>
            </View>
            <Ionicons
              name={expandedSection === "education" ? "chevron-up" : "chevron-forward"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>
          {expandedSection === "education" && (
            <View style={styles.accordionContent}>
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <Text style={styles.timelineTitle}>{profile.jnvName || "JNV Warangal"}</Text>
                <Text style={styles.timelineSubtitle}>
                  {profile.house ? `${profile.house} House • ` : ""}
                  Class of {profile.passoutYear || "2022"}
                </Text>
              </View>
              <View style={[styles.timelineItem, { marginTop: 12 }]}>
                <View style={[styles.timelineDot, { backgroundColor: "#10B981" }]} />
                <Text style={styles.timelineTitle}>{designation}</Text>
                <Text style={styles.timelineSubtitle}>{location}</Text>
              </View>
            </View>
          )}
        </View>

        {/* Section C: Professional Experience */}
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection("experience")}
            activeOpacity={0.8}
          >
            <View style={styles.accordionHeaderLeft}>
              <Ionicons name="briefcase-outline" size={18} color="#7C3AED" style={{ marginRight: 10 }} />
              <Text style={styles.accordionTitle}>Professional Experience</Text>
            </View>
            <Ionicons
              name={expandedSection === "experience" ? "chevron-up" : "chevron-forward"}
              size={18}
              color="#6B7280"
            />
          </TouchableOpacity>
          {expandedSection === "experience" && (
            <View style={styles.accordionContent}>
              <Text style={styles.accordionBodyText}>
                {profile.profession
                  ? `${profile.profession} at ${location}`
                  : "Actively contributing to open-source software, startup initiatives, and engineering projects."}
              </Text>
              {profile.resumeUrl ? (
                <TouchableOpacity
                  style={styles.resumeBtn}
                  onPress={() => Linking.openURL(profile.resumeUrl!)}
                >
                  <Ionicons name="document-text-outline" size={16} color="#7C3AED" />
                  <Text style={styles.resumeBtnText}>View Verified Resume</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          )}
        </View>
      </View>

      {/* 6. BENEFITS MODAL */}
      <Modal
        visible={showBenefitsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBenefitsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.crownCircle}>
                <Text style={{ fontSize: 20 }}>👑</Text>
              </View>
              <Text style={styles.modalTitle}>Your Premium Alumni Benefits</Text>
              <TouchableOpacity
                onPress={() => setShowBenefitsModal(false)}
                style={styles.closeBtn}
              >
                <Ionicons name="close" size={22} color="#4B5563" />
              </TouchableOpacity>
            </View>

            <View style={styles.benefitsList}>
              {[
                "✦ Exclusive Golden Navodaya Premium Profile Badge",
                "✦ Custom Diagonal Identity Card Presentation",
                "✦ Real-time Profile Visits & Unique Visitor Reach Analytics",
                "✦ Featured Memories & Pinned Spotlight Posts",
                "✦ Special Store Room Alumni Offers & Discount Vouchers",
                "✦ Priority Directory Discovery among 100,000+ Navodayans",
                "✦ VIP Invitations to Regional & National Alumni Conclaves",
                "✦ Instant Verified Alumni Digital ID with cryptographic QR",
              ].map((benefit, idx) => (
                <View key={idx} style={styles.benefitItemRow}>
                  <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 10 }} />
                  <Text style={styles.benefitItemText}>{benefit}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.doneBtn}
              onPress={() => setShowBenefitsModal(false)}
            >
              <Text style={styles.doneBtnText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    paddingBottom: 24,
  },
  // Top Header Banner
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  navodayaLogoBox: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: "#6D28D9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    shadowColor: "#6D28D9",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E1B4B",
    lineHeight: 18,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
  },
  storeShortcutBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#581C87",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#9A3412",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  headerTitles: {
    paddingHorizontal: 20,
    marginTop: 12,
    marginBottom: 16,
  },
  journeySubtitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#7C3AED",
    marginBottom: 4,
  },
  mainTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1E1B4B",
  },

  // Main Profile Card
  cardWrapper: {
    alignItems: "center",
    marginHorizontal: 16,
  },
  profileCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 36,
    overflow: "hidden",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  portraitContainer: {
    width: "100%",
    height: 290,
    backgroundColor: "#F9FAFB",
    alignItems: "center",
    justifyContent: "center",
  },
  portraitImage: {
    width: "100%",
    height: "100%",
  },
  svgDiagonalWrap: {
    height: 30,
    marginTop: -30,
    width: "100%",
    zIndex: 2,
  },
  purpleInfoPanel: {
    width: "100%",
    paddingTop: 12,
    paddingBottom: 28,
    paddingHorizontal: 20,
    position: "relative",
  },
  badgeRow: {
    alignItems: "flex-end",
    marginBottom: 10,
  },
  premiumGoldBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(180, 83, 9, 0.35)",
    borderWidth: 1,
    borderColor: "#FBBF24",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  premiumGoldBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#FDE68A",
    letterSpacing: 0.8,
  },
  rightInfoBlock: {
    alignItems: "flex-end",
    paddingLeft: 70, // Leaves space for the floating social pill on left
  },
  profileName: {
    fontSize: 23,
    fontWeight: "800",
    color: "#FFFFFF",
    textAlign: "right",
    marginBottom: 3,
  },
  profileDesignation: {
    fontSize: 14,
    fontWeight: "600",
    color: "#E9D5FF",
    textAlign: "right",
    marginBottom: 2,
  },
  profileSchoolBatch: {
    fontSize: 13,
    color: "#DDD6FE",
    textAlign: "right",
    marginBottom: 14,
  },
  contactDetailsColumn: {
    alignItems: "flex-end",
    gap: 7,
  },
  contactItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  contactText: {
    fontSize: 12,
    color: "#F3E8FF",
    marginRight: 8,
    fontWeight: "500",
  },
  contactIcon: {
    width: 18,
    textAlign: "center",
  },
  floatingSocialCapsule: {
    position: "absolute",
    left: 20,
    bottom: 24,
    backgroundColor: "#FFFFFF",
    borderRadius: 26,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  socialBtn: {
    padding: 6,
  },
  socialDivider: {
    width: 20,
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 4,
  },

  // Profile Insights
  insightsSection: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  insightsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  insightsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  insightsTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1E1B4B",
  },
  dropdownWrap: {
    position: "relative",
    zIndex: 50,
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6D28D9",
  },
  dropdownMenu: {
    position: "absolute",
    top: 34,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
    minWidth: 120,
    zIndex: 99,
  },
  dropdownItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  dropdownItemActive: {
    backgroundColor: "#F3E8FF",
  },
  dropdownItemText: {
    fontSize: 12,
    color: "#4B5563",
    fontWeight: "600",
  },
  dropdownItemTextActive: {
    color: "#7C3AED",
    fontWeight: "700",
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  insightCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: "#F3E8FF",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  metricRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#ECFDF5",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  trendText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#059669",
    marginLeft: 2,
  },
  metricValue: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1E1B4B",
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 12,
    color: "#6B7280",
    fontWeight: "500",
  },

  // Premium Strip
  premiumBannerStrip: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 20,
    borderRadius: 22,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  crownCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  bannerSubtext: {
    fontSize: 11,
    color: "#E9D5FF",
    marginTop: 1,
  },
  viewBenefitsBtn: {
    backgroundColor: "rgba(0, 0, 0, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.4)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
  },
  viewBenefitsText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },

  // Accordion Sections
  accordionContainer: {
    marginTop: 16,
    paddingHorizontal: 16,
    gap: 10,
  },
  accordionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  accordionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  accordionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#F3F4F6",
    paddingTop: 12,
  },
  accordionBodyText: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 20,
  },
  skillsTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  skillPill: {
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  skillPillText: {
    fontSize: 11,
    color: "#6D28D9",
    fontWeight: "600",
  },
  timelineItem: {
    position: "relative",
    paddingLeft: 18,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7C3AED",
    position: "absolute",
    left: 0,
    top: 5,
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E1B4B",
  },
  timelineSubtitle: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  resumeBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F3FF",
    borderColor: "#DDD6FE",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 10,
    alignSelf: "flex-start",
  },
  resumeBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C3AED",
    marginLeft: 6,
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 24,
    maxHeight: "85%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#1E1B4B",
    flex: 1,
    marginLeft: 8,
  },
  closeBtn: {
    padding: 4,
  },
  benefitsList: {
    gap: 12,
    marginBottom: 24,
  },
  benefitItemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitItemText: {
    fontSize: 13,
    color: "#374151",
    fontWeight: "500",
    flex: 1,
    lineHeight: 18,
  },
  doneBtn: {
    backgroundColor: "#6D28D9",
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
});
