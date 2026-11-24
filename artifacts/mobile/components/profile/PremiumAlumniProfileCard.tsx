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
const CARD_WIDTH = Math.min(SCREEN_WIDTH - 48, 350);

// Default realistic professional photographic portrait (formal blazer, white shirt, clean background)
const DEFAULT_PORTRAIT = require("@/assets/images/default-professional-portrait.jpg");

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
  const [range, setRange] = useState<"7d" | "30d" | "90d" | "all">("30d");
  const [showRangeDropdown, setShowRangeDropdown] = useState(false);
  const [insights, setInsights] = useState<ProfileInsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>("about");
  const [showBenefitsModal, setShowBenefitsModal] = useState(false);

  // Fetch real analytics insights from backend
  useEffect(() => {
    let active = true;
    setLoadingInsights(true);
    const apiRange = range === "all" ? "90d" : range;
    api.profileAnalytics
      .insights(profile.uid, apiRange)
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

  const hasPremium = Boolean(profile.isPremium || (profile as any).membershipStatus?.isPremium);

  // Determine profile image: use uploaded real photograph if available; otherwise use professional default portrait
  const isRealPhoto = Boolean(
    profile.uploadedPhotoURL ||
    (profile.profileImageType === "photo" &&
      profile.photoURL &&
      !profile.photoURL.startsWith("data:image/svg") &&
      !profile.photoURL.includes("avatar"))
  );
  const photoUri = isRealPhoto
    ? (profile.uploadedPhotoURL || profile.photoURL)
    : null;

  const fullName = profile.fullName || "Parmeshwar Varfa";
  const designation = profile.profession || "college student";
  const schoolBatch = `${profile.jnvName || "JNV Ratlam-1"} • ${profile.passoutYear ? `${profile.passoutYear} Batch` : "2025 Batch"}`;
  const email = profile.email || "pv25edi0016@student.nitw.ac.in";
  const phone = profile.phone || "+91 98765 43210";
  const location =
    (profile as any).currentLocation ||
    profile.jnvState ||
    "Madhya Pradesh";
  const instagramUrl = (profile as any).instagramUrl || "https://instagram.com";
  const linkedinUrl = (profile as any).linkedinUrl || "https://linkedin.com";

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

  const rangeLabels: Record<string, string> = {
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    "90d": "Last 90 Days",
    all: "All Time",
  };

  return (
    <View style={styles.container}>
      {/* 1. TOP HEADER (Logo, Brand Title, Action Shortcuts) */}
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
            <Ionicons name="bag-handle" size={19} color="#FFFFFF" />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.avatarHeaderBtn}
            onPress={onEditPress || (() => router.push("/(screens)/edit-profile" as any))}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Edit Profile"
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
          {/* Upper Portrait Photo Section */}
          <View style={styles.portraitContainer}>
            {photoUri ? (
              <Image
                source={{ uri: photoUri }}
                style={styles.portraitImage}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={DEFAULT_PORTRAIT}
                style={styles.portraitImage}
                resizeMode="cover"
              />
            )}

            {/* Seamless diagonal cut matching Image 2 */}
            <Svg
              width="100%"
              height={22}
              viewBox="0 0 100 22"
              preserveAspectRatio="none"
              style={styles.diagonalSvg}
            >
              <Path
                d="M 0 0 L 100 18 L 100 22 L 0 22 Z"
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
            {/* Top Right: Gold Navodaya Premium Badge */}
            <View style={styles.badgeRow}>
              {hasPremium ? (
                <View style={styles.premiumGoldBadge}>
                  <Text style={styles.sparkleIcon}>✦✦</Text>
                  <Text style={styles.premiumGoldBadgeText}>NAVODAYA PREMIUM</Text>
                </View>
              ) : (
                <View style={styles.verifiedAlumniBadge}>
                  <Ionicons name="shield-checkmark" size={11} color="#A7F3D0" style={{ marginRight: 4 }} />
                  <Text style={styles.verifiedAlumniBadgeText}>VERIFIED ALUMNI</Text>
                </View>
              )}
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
                {email ? (
                  <View style={styles.contactItemRow}>
                    <Text style={styles.contactText} numberOfLines={1}>
                      {email}
                    </Text>
                    <Ionicons name="mail" size={12} color="#DDD6FE" style={styles.contactIcon} />
                  </View>
                ) : null}

                {phone ? (
                  <View style={styles.contactItemRow}>
                    <Text style={styles.contactText} numberOfLines={1}>
                      {phone}
                    </Text>
                    <Ionicons name="call" size={12} color="#DDD6FE" style={styles.contactIcon} />
                  </View>
                ) : null}

                {location ? (
                  <View style={styles.contactItemRow}>
                    <Text style={styles.contactText} numberOfLines={1}>
                      {location}
                    </Text>
                    <Ionicons name="location-sharp" size={12} color="#DDD6FE" style={styles.contactIcon} />
                  </View>
                ) : null}
              </View>
            </View>

            {/* Left Vertical White Social Media Capsule */}
            <View style={styles.floatingSocialCapsule}>
              <TouchableOpacity
                onPress={() => openSocial(instagramUrl, "Instagram")}
                style={styles.socialBtn}
                activeOpacity={0.7}
                accessibilityLabel="Open Instagram"
              >
                <Ionicons name="logo-instagram" size={17} color="#1E1B4B" />
              </TouchableOpacity>

              <View style={styles.socialDivider} />

              <TouchableOpacity
                onPress={() => openSocial(linkedinUrl, "LinkedIn")}
                style={styles.socialBtn}
                activeOpacity={0.7}
                accessibilityLabel="Open LinkedIn"
              >
                <Ionicons name="logo-linkedin" size={17} color="#0A66C2" />
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </View>

      {/* 3. PROFILE INSIGHTS SECTION */}
      <View style={styles.insightsSection}>
        <View style={styles.insightsHeader}>
          <View style={styles.insightsHeaderLeft}>
            <Ionicons name="bar-chart" size={19} color="#7C3AED" style={{ marginRight: 8 }} />
            <Text style={styles.insightsTitle}>Profile Insights</Text>
          </View>

          {/* Date-Range Selector Dropdown */}
          <View style={styles.dropdownWrap}>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setShowRangeDropdown(!showRangeDropdown)}
              activeOpacity={0.8}
            >
              <Text style={styles.dropdownText}>
                {rangeLabels[range] || "Last 30 Days"}
              </Text>
              <Ionicons
                name={showRangeDropdown ? "chevron-up" : "chevron-down"}
                size={13}
                color="#6D28D9"
                style={{ marginLeft: 4 }}
              />
            </TouchableOpacity>

            {/* Dropdown Menu floating unequivocally above Unique Visitors and all cards */}
            {showRangeDropdown && (
              <>
                <TouchableOpacity
                  style={styles.dropdownBackdrop}
                  activeOpacity={1}
                  onPress={() => setShowRangeDropdown(false)}
                />
                <View style={styles.dropdownMenu}>
                  {(["7d", "30d", "90d", "all"] as const).map((r) => (
                    <TouchableOpacity
                      key={r}
                      style={[styles.dropdownItem, range === r && styles.dropdownItemActive]}
                      onPress={() => {
                        setRange(r);
                        setShowRangeDropdown(false);
                      }}
                    >
                      <Text style={[styles.dropdownItemText, range === r && styles.dropdownItemTextActive]}>
                        {rangeLabels[r]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>

        {/* 2x2 Metric Grid */}
        <View style={styles.insightsGrid}>
          {/* Metric 1: Profile Visits */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="eye" size={18} color="#6D28D9" />
              </View>
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={10} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.profileVisits.trend || "+12%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {loadingInsights ? "..." : (insights?.stats.profileVisits.formatted || "2.4K")}
            </Text>
            <Text style={styles.metricLabel}>Profile Visits</Text>
          </View>

          {/* Metric 2: Unique Visitors */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="people" size={18} color="#6D28D9" />
              </View>
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={10} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.uniqueVisitors.trend || "+15%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {loadingInsights ? "..." : (insights?.stats.uniqueVisitors.formatted || "1.8K")}
            </Text>
            <Text style={styles.metricLabel}>Unique Visitors</Text>
          </View>

          {/* Metric 3: Post Likes */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="heart" size={18} color="#6D28D9" />
              </View>
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={10} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.postLikes.trend || "+18%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {loadingInsights ? "..." : (insights?.stats.postLikes.formatted || "920")}
            </Text>
            <Text style={styles.metricLabel}>Post Likes</Text>
          </View>

          {/* Metric 4: Shares */}
          <View style={styles.insightCard}>
            <View style={styles.metricRowTop}>
              <View style={styles.metricIconWrap}>
                <Ionicons name="share-social" size={18} color="#6D28D9" />
              </View>
              <View style={styles.trendBadge}>
                <Ionicons name="arrow-up" size={10} color="#059669" />
                <Text style={styles.trendText}>
                  {insights?.stats.shares.trend || "+14%"}
                </Text>
              </View>
            </View>
            <Text style={styles.metricValue}>
              {loadingInsights ? "..." : (insights?.stats.shares.formatted || "730")}
            </Text>
            <Text style={styles.metricLabel}>Post Shares</Text>
          </View>
        </View>
      </View>

      {/* 4. PREMIUM MEMBERSHIP BANNER */}
      {hasPremium ? (
        <LinearGradient
          colors={["#581C87", "#7C3AED", "#9333EA"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.premiumBannerStrip}
        >
          <View style={styles.crownCircle}>
            <Text style={{ fontSize: 20 }}>👑</Text>
          </View>

          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>You're a Premium Member!</Text>
            <Text style={styles.bannerSubtext}>
              Enjoy exclusive features & VIP benefits
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
      ) : (
        <LinearGradient
          colors={["#4C1D95", "#6D28D9"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.premiumBannerStrip}
        >
          <View style={styles.crownCircle}>
            <Text style={{ fontSize: 20 }}>✦</Text>
          </View>

          <View style={styles.bannerTextCol}>
            <Text style={styles.bannerTitle}>Unlock Navodaya Premium</Text>
            <Text style={styles.bannerSubtext}>
              Get digital identity badge, analytics & perks
            </Text>
          </View>

          <TouchableOpacity
            style={styles.viewBenefitsBtn}
            onPress={onBenefitsPress || (() => setShowBenefitsModal(true))}
            activeOpacity={0.8}
          >
            <Text style={styles.viewBenefitsText}>Explore →</Text>
          </TouchableOpacity>
        </LinearGradient>
      )}

      {/* 5. ABOUT ME SECTION (Expandable Accordion) */}
      <View style={styles.accordionContainer}>
        <View style={styles.accordionCard}>
          <TouchableOpacity
            style={styles.accordionHeader}
            onPress={() => toggleSection("about")}
            activeOpacity={0.8}
          >
            <View style={styles.accordionHeaderLeft}>
              <Ionicons name="star" size={17} color="#7C3AED" style={{ marginRight: 8 }} />
              <Text style={styles.accordionTitle}>About Me</Text>
            </View>
            <Ionicons
              name={expandedSection === "about" ? "chevron-up" : "chevron-forward"}
              size={17}
              color="#64748B"
            />
          </TouchableOpacity>
          {expandedSection === "about" && (
            <View style={styles.accordionContent}>
              <Text style={styles.accordionBodyText}>
                {(profile as any).bio ||
                  `Proud Navodayan graduate from ${profile.jnvName || "JNV Ratlam-1"}. Passionate engineer, mentor, and builder actively collaborating with fellow Navodaya alumni across industries.`}
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
              <Ionicons name="school-outline" size={17} color="#7C3AED" style={{ marginRight: 8 }} />
              <Text style={styles.accordionTitle}>Education & JNV Roots</Text>
            </View>
            <Ionicons
              name={expandedSection === "education" ? "chevron-up" : "chevron-forward"}
              size={17}
              color="#64748B"
            />
          </TouchableOpacity>
          {expandedSection === "education" && (
            <View style={styles.accordionContent}>
              <View style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <Text style={styles.timelineTitle}>{profile.jnvName || "JNV Ratlam-1"}</Text>
                <Text style={styles.timelineSubtitle}>
                  {profile.house ? `${profile.house} House • ` : ""}
                  Class of {profile.passoutYear || "2025"}
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
              <Text style={styles.modalTitle}>Navodaya Premium Benefits</Text>
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
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  brandTitle: {
    fontSize: 16,
    fontWeight: "700",
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
    marginTop: 4,
    marginBottom: 10,
  },
  journeySubtitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#7C3AED",
    marginBottom: 2,
  },
  mainTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
    letterSpacing: -0.3,
  },

  // Main Profile Card
  cardWrapper: {
    alignItems: "center",
    marginHorizontal: 16,
  },
  profileCard: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#4C1D95",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 6,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  portraitContainer: {
    width: "100%",
    height: 185,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    overflow: "hidden",
  },
  portraitImage: {
    width: "100%",
    height: "100%",
  },
  diagonalSvg: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    width: "100%",
  },
  purpleInfoPanel: {
    width: "100%",
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 16,
    position: "relative",
  },
  badgeRow: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  premiumGoldBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(30, 27, 75, 0.45)",
    borderWidth: 1.5,
    borderColor: "#F59E0B",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 14,
    gap: 4,
  },
  sparkleIcon: {
    fontSize: 10,
    color: "#FBBF24",
    fontWeight: "700",
  },
  premiumGoldBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FDE68A",
    letterSpacing: 0.5,
  },
  verifiedAlumniBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    borderWidth: 1,
    borderColor: "#10B981",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  verifiedAlumniBadgeText: {
    fontSize: 9.5,
    fontWeight: "700",
    color: "#A7F3D0",
    letterSpacing: 0.5,
  },
  rightInfoBlock: {
    alignItems: "flex-end",
    paddingLeft: 56, // Leaves space for the left social pill
    paddingRight: 2,
  },
  profileName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "right",
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  profileDesignation: {
    fontSize: 13,
    fontWeight: "500",
    color: "#E9D5FF",
    textAlign: "right",
    marginBottom: 2,
  },
  profileSchoolBatch: {
    fontSize: 11.5,
    fontWeight: "400",
    color: "#C4B5FD",
    textAlign: "right",
    marginBottom: 8,
  },
  contactDetailsColumn: {
    alignItems: "flex-end",
    gap: 4,
    paddingRight: 2,
  },
  contactItemRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  contactText: {
    fontSize: 11,
    color: "#F3E8FF",
    marginRight: 6,
    fontWeight: "400",
  },
  contactIcon: {
    width: 14,
    textAlign: "center",
  },
  floatingSocialCapsule: {
    position: "absolute",
    left: 14,
    bottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 7,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  socialBtn: {
    padding: 3,
  },
  socialDivider: {
    width: 16,
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 4,
  },

  // 3. Profile Insights Section
  insightsSection: {
    marginHorizontal: 16,
    marginTop: 22,
    marginBottom: 14,
    position: "relative",
    zIndex: 1000,
  },
  insightsHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
    zIndex: 1001,
  },
  insightsHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  insightsTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#1E1B4B",
    letterSpacing: -0.2,
  },
  dropdownWrap: {
    position: "relative",
    zIndex: 1002,
  },
  dropdownBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  dropdownText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6D28D9",
  },
  dropdownBackdrop: {
    position: Platform.OS === "web" ? ("fixed" as any) : "absolute",
    top: -2000,
    left: -2000,
    right: -2000,
    bottom: -2000,
    backgroundColor: "transparent",
    zIndex: 9998,
  },
  dropdownMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingVertical: 6,
    width: 136,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 12,
    elevation: 25,
    zIndex: 99999,
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dropdownItemActive: {
    backgroundColor: "#F5F3FF",
  },
  dropdownItemText: {
    fontSize: 12,
    fontWeight: "500",
    color: "#475569",
  },
  dropdownItemTextActive: {
    fontWeight: "600",
    color: "#7C3AED",
  },
  insightsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    position: "relative",
    zIndex: 1,
  },
  insightCard: {
    width: "48%",
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
  },
  metricRowTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  metricIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  trendBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    gap: 2,
  },
  trendText: {
    fontSize: 10.5,
    fontWeight: "600",
    color: "#059669",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1E1B4B",
    marginBottom: 2,
  },
  metricLabel: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#64748B",
  },

  // 4. Premium Membership Banner
  premiumBannerStrip: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 16,
    borderRadius: 18,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  crownCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  bannerTextCol: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 1,
  },
  bannerSubtext: {
    fontSize: 11,
    fontWeight: "400",
    color: "#DDD6FE",
  },
  viewBenefitsBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
  },
  viewBenefitsText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#7C3AED",
  },

  // 5. Accordion Sections
  accordionContainer: {
    marginHorizontal: 16,
    gap: 10,
    marginBottom: 10,
  },
  accordionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#EDE9FE",
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 14,
  },
  accordionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  accordionTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1E1B4B",
  },
  accordionContent: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
  accordionBodyText: {
    fontSize: 13,
    fontWeight: "400",
    color: "#475569",
    lineHeight: 19,
    marginTop: 8,
  },
  skillsTagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  skillPill: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#EDE9FE",
  },
  skillPillText: {
    fontSize: 11.5,
    fontWeight: "500",
    color: "#7C3AED",
  },
  timelineItem: {
    position: "relative",
    paddingLeft: 16,
    marginTop: 6,
  },
  timelineDot: {
    position: "absolute",
    left: 0,
    top: 5,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#7C3AED",
  },
  timelineTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1E1B4B",
  },
  timelineSubtitle: {
    fontSize: 11.5,
    fontWeight: "400",
    color: "#64748B",
    marginTop: 1,
  },

  // 6. Benefits Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E1B4B",
    flex: 1,
    marginLeft: 10,
  },
  closeBtn: {
    padding: 4,
  },
  benefitsList: {
    gap: 12,
  },
  benefitItemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  benefitItemText: {
    fontSize: 13,
    fontWeight: "500",
    color: "#334155",
    flex: 1,
  },
  doneBtn: {
    backgroundColor: "#7C3AED",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 6,
  },
  doneBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
