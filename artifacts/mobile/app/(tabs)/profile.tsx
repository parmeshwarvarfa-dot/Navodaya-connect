import React, { useEffect, useState } from "react";
import {
  View,
  Alert,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Image,
  Linking,
  Share,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { RoleBadge } from "@/components/RoleBadge";
import ProfilePostsSection from "@/components/profile/ProfilePostsSection";
import FadeIn from "@/components/motion/FadeIn";
import { api, type RecognitionProfile, type AlumniMembershipStatus } from "@/lib/api";
import type { DigitalCredential } from "@/lib/api";
import { LinearGradient } from "expo-linear-gradient";
import PremiumAlumniProfileCard from "@/components/profile/PremiumAlumniProfileCard";
import AlumniPremiumSubscriptionModal from "@/components/profile/AlumniPremiumSubscriptionModal";
import { ThemedText as Text } from "@/components/ThemedNative";

function getInitials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

const ROLE_LABEL: Record<string, string> = {
  student: "Student",
  alumni: "Alumni",
  teacher: "Teacher",
  official: "JNV Official",
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { profile, signOut, refreshProfile } = useAuth();
  const [membershipStatus, setMembershipStatus] = useState<AlumniMembershipStatus | null>(null);
  const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
  const [previewPremium, setPreviewPremium] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [showBioDetails, setShowBioDetails] = useState(false);
  const [recognition, setRecognition] = useState<RecognitionProfile | null>(null);
  const [recognitionLoading, setRecognitionLoading] = useState(true);
  const [recognitionError, setRecognitionError] = useState("");
  const [digitalCredential, setDigitalCredential] = useState<DigitalCredential | null>(null);
  const [digitalIdLoading, setDigitalIdLoading] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [openMenuSections, setOpenMenuSections] = useState<string[]>(["My Account"]);
  const topPad = Platform.OS === "web" ? 0 : insets.top;

  useEffect(() => {
    let active = true;
    if (profile?.role === "alumni") {
      api.alumniMembership
        .status()
        .then((st) => {
          if (active) setMembershipStatus(st);
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [profile?.role, profile?.uid]);

  useEffect(() => {
    let active = true;
    if (!profile?.uid) { setRecognition(null); setRecognitionLoading(false); return; }
    setRecognitionLoading(true); setRecognitionError("");
    void (async () => {
      try {
        const data = await api.recognition.profile(profile.uid);
        if (active) setRecognition(data);
      } catch (error) {
        if (active) {
          setRecognition(null);
          setRecognitionError(error instanceof Error ? error.message : "Could not load recognition.");
        }
      } finally {
        if (active) setRecognitionLoading(false);
      }
    })();
    return () => { active = false; };
  }, [profile?.uid]);

  useEffect(() => {
    let active = true;
    const eligible = profile?.role === "alumni"
      ? profile.verificationStatus === "community_verified" && !!profile.communityVerifiedAt
      : profile?.verificationStatus === "verified";
    if (!profile || !eligible) {
      setDigitalCredential(null);
      setDigitalIdLoading(false);
      return () => { active = false; };
    }
    setDigitalIdLoading(true);
    void api.verification.myCredential().then((credential) => {
      if (active) setDigitalCredential(credential);
    }).catch(() => {
      if (active) setDigitalCredential(null);
    }).finally(() => {
      if (active) setDigitalIdLoading(false);
    });
    return () => { active = false; };
  }, [profile?.uid, profile?.role, profile?.verificationStatus, profile?.communityVerifiedAt]);

  const handleSignOut = () => setShowSignOutModal(true);

  const confirmSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } finally {
      setSigningOut(false);
      setShowSignOutModal(false);
    }
  };

  if (!profile) return null;

  const initials = getInitials(profile.fullName || "N");
  const roleLabel = ROLE_LABEL[profile.role] || profile.role;

  const infoItems = [
    { icon: "mail-outline" as const, label: "Email", value: profile.email || "—" },
    { icon: "location-outline" as const, label: "JNV Location", value: profile.jnvName || "—" },
    ...(profile.role === "student" && profile.class
      ? [{ icon: "school-outline" as const, label: "Class", value: profile.class }]
      : []),
    ...(profile.house && (profile.role === "student" || profile.role === "alumni")
      ? [{ icon: "ribbon-outline" as const, label: "House", value: { Aravali: "Aravali House 💙", Nilgiri: "Nilgiri House 💚", Shivalik: "Shivalik House ❤️", Udaygiri: "Udaygiri House 💛" }[profile.house] ?? profile.house }]
      : []),
    ...(profile.role === "alumni" && profile.passoutYear
      ? [{ icon: "calendar-outline" as const, label: "Batch", value: profile.passoutYear }]
      : []),
    ...(profile.role === "alumni" && profile.profession
      ? [{ icon: "briefcase-outline" as const, label: "Profession", value: profile.profession }]
      : []),
    ...(profile.role === "teacher" && profile.subject
      ? [{ icon: "book-outline" as const, label: "Subject", value: profile.subject }]
      : []),
    ...(profile.jnvState
      ? [{ icon: "map-outline" as const, label: "State", value: profile.jnvState }]
      : []),
  ];

  const toggleMenuSection = (title: string) => {
    setOpenMenuSections((current) =>
      current.includes(title)
        ? current.filter((item) => item !== title)
        : [...current, title],
    );
  };

  const profileMenuSections = [
    {
      title: "My Account",
      icon: "person-circle-outline" as const,
      items: [
        { label: "Edit Profile", icon: "create-outline" as const, onPress: () => router.push("/(screens)/edit-profile" as any) },
        { label: "Personal Information", icon: "information-circle-outline" as const, onPress: () => router.push("/(screens)/edit-profile" as any) },
        { label: "Profile Photo Management", icon: "camera-outline" as const, onPress: () => router.push("/(screens)/edit-profile" as any) },
        { label: "Public Profile Preview", icon: "eye-outline" as const, onPress: () => router.push({ pathname: "/profile/[id]", params: { id: profile.uid } } as any) },
        { label: "Digital ID Card", icon: "card-outline" as const, onPress: () => router.push("/(screens)/digital-id" as any) },
        { label: "My QR Code", icon: "qr-code-outline" as const, onPress: () => router.push("/(screens)/digital-id" as any) },
        { label: "Account Verification", icon: "shield-checkmark-outline" as const, onPress: () => router.push((profile.role === "alumni" ? "/(screens)/alumni-peer-verification" : "/(screens)/verification-center") as any) },
        { label: "My JNV & Batch", icon: "location-outline" as const, onPress: () => router.push("/(screens)/edit-profile" as any) },
        { label: "Education, Skills & Experience", icon: "school-outline" as const, onPress: () => router.push("/(screens)/edit-profile" as any) },
        {
          label: "Share My Profile",
          icon: "share-social-outline" as const,
          onPress: () => void Share.share({
            title: `${profile.fullName}'s Navodaya Connect profile`,
            message: `View ${profile.fullName}'s profile on Navodaya Connect\nhttps://navodayaconnect.com/profile/${profile.uid}`,
          }).catch(() => undefined),
        },
        {
          label: "Copy Profile Link",
          icon: "link-outline" as const,
          onPress: () => void Clipboard.setStringAsync(`https://navodayaconnect.com/profile/${profile.uid}`),
        },
      ],
    },
    {
      title: "Social Connections",
      icon: "people-outline" as const,
      items: [
        { label: "Find Navodayans", icon: "compass-outline" as const, onPress: () => router.push("/(screens)/explore" as any) },
        { label: "Alumni Network", icon: "school-outline" as const, onPress: () => router.push("/(screens)/alumni-connect" as any) },
        { label: "Community Groups", icon: "people-circle-outline" as const, onPress: () => router.push({ pathname: "/(tabs)/chats", params: { filter: "groups" } } as any) },
        { label: "Social Inbox", icon: "mail-unread-outline" as const, onPress: () => router.push("/(screens)/social-inbox" as any) },
        { label: "Message Requests", icon: "mail-outline" as const, onPress: () => router.push({ pathname: "/(screens)/social-inbox", params: { tab: "message_requests" } } as any) },
        { label: "Follow Requests", icon: "person-add-outline" as const, onPress: () => router.push({ pathname: "/(screens)/social-inbox", params: { tab: "follow_requests" } } as any) },
        { label: "Blocked Accounts", icon: "ban-outline" as const, onPress: () => router.push("/(screens)/privacy-settings" as any) },
        { label: "Follow & Privacy Preferences", icon: "people-circle-outline" as const, onPress: () => router.push("/(screens)/privacy-settings" as any) },
      ],
    },
    {
      title: "Content & Memories",
      icon: "grid-outline" as const,
      items: [
        { label: "My Posts", icon: "albums-outline" as const, onPress: () => router.push({ pathname: "/(screens)/profile-posts", params: { userId: profile.uid, isOwner: "true" } } as any) },
        { label: "My Photos", icon: "image-outline" as const, onPress: () => router.push({ pathname: "/(tabs)/memories", params: { filter: "photo" } } as any) },
        { label: "My Videos", icon: "videocam-outline" as const, onPress: () => router.push({ pathname: "/(tabs)/memories", params: { filter: "video" } } as any) },
        { label: "My Polls", icon: "stats-chart-outline" as const, onPress: () => router.push({ pathname: "/(tabs)/memories", params: { filter: "poll" } } as any) },
        { label: "Saved Posts", icon: "bookmark-outline" as const, onPress: () => router.push("/(tabs)/memories-saved" as any) },
        { label: "Memories", icon: "images-outline" as const, onPress: () => router.push({ pathname: "/(tabs)/memories", params: { filter: "all" } } as any) },
        { label: "Create New Memory", icon: "add-circle-outline" as const, onPress: () => router.push("/(tabs)/memories" as any) },
        { label: "Digital Yearbook", icon: "book-outline" as const, onPress: () => router.push("/(screens)/yearbook" as any) },
      ],
    },
    {
      title: "Events",
      icon: "calendar-outline" as const,
      items: [
        { label: "Explore Events", icon: "calendar-outline" as const, onPress: () => router.push("/(screens)/events" as any) },
      ],
    },
    {
      title: "Career & Learning",
      icon: "briefcase-outline" as const,
      items: [
        { label: "Opportunities", icon: "briefcase-outline" as const, onPress: () => router.push("/(tabs)/jobs" as any) },
        { label: "Mentorship", icon: "accessibility-outline" as const, onPress: () => router.push("/(tabs)/mentorship" as any) },
        { label: "Study Resources", icon: "library-outline" as const, onPress: () => router.push("/(screens)/study" as any) },
        { label: "Job Bookmarks", icon: "bookmark-outline" as const, onPress: () => router.push("/(tabs)/jobs" as any) },
        ...(profile.role === "alumni"
          ? [{ label: "Alumni Opportunities", icon: "rocket-outline" as const, onPress: () => router.push("/(screens)/alumni-opportunities" as any) }]
          : []),
      ],
    },
    {
      title: "Activity & Analytics",
      icon: "analytics-outline" as const,
      items: [
        { label: "My Activity", icon: "pulse-outline" as const, onPress: () => router.push({ pathname: "/(screens)/social-inbox", params: { tab: "activity" } } as any) },
        { label: "Notifications", icon: "notifications-outline" as const, onPress: () => router.push("/(screens)/notifications" as any) },
        { label: "Notification Settings", icon: "options-outline" as const, onPress: () => router.push("/(screens)/notification-settings" as any) },
        { label: "Rankings", icon: "stats-chart-outline" as const, onPress: () => router.push("/(screens)/rankings" as any) },
      ],
    },
    {
      title: "Privacy, Security & Support",
      icon: "settings-outline" as const,
      items: [
        { label: "Account Privacy", icon: "lock-closed-outline" as const, onPress: () => router.push("/(screens)/privacy-settings" as any) },
        { label: "Help & Support", icon: "help-circle-outline" as const, onPress: () => router.push("/(screens)/alumni-support" as any) },
        { label: "Report a Problem", icon: "alert-circle-outline" as const, onPress: () => router.push("/(screens)/report-problem" as any) },
        { label: "Explore Platform", icon: "compass-outline" as const, onPress: () => router.push("/(screens)/explore" as any) },
        { label: "Replay Launch Experience", icon: "sparkles-outline" as const, onPress: () => router.push("/onboarding" as any) },
      ],
    },
    ...(profile.role === "alumni"
      ? [{
          title: "Alumni Premium",
          icon: "diamond-outline" as const,
          items: [
            { label: "Membership & Benefits", icon: "sparkles-outline" as const, onPress: () => setShowSubscriptionModal(true) },
          ],
        }]
      : []),
    ...(profile.role === "alumni"
      ? [{
          title: "Alumni Tools",
          icon: "school-outline" as const,
          items: [
            { label: "Alumni Zone", icon: "business-outline" as const, onPress: () => router.push("/(screens)/alumni-zone" as any) },
          ],
        }]
      : []),
    ...(profile.role === "student"
      ? [{
          title: "Student Tools",
          icon: "school-outline" as const,
          items: [
            { label: "Academic Access", icon: "book-outline" as const, onPress: () => router.push("/(screens)/academic-access" as any) },
          ],
        }]
      : profile.role === "teacher"
        ? [{
            title: "Teacher Tools",
            icon: "briefcase-outline" as const,
            items: [
              { label: "Teacher Zone", icon: "easel-outline" as const, onPress: () => router.push("/(screens)/teacher-zone" as any) },
            ],
          }]
        : profile.role === "official"
          ? [{
              title: "Official Tools",
              icon: "business-outline" as const,
              items: [
                { label: "Official Dashboard", icon: "grid-outline" as const, onPress: () => router.push("/(screens)/official-dashboard" as any) },
              ],
            }]
          : []),
  ];

  const renderProfileMenu = () => (
    <Modal
      visible={showProfileMenu}
      transparent
      animationType="slide"
      onRequestClose={() => setShowProfileMenu(false)}
    >
      <View style={styles.profileMenuOverlay}>
        <TouchableOpacity
          style={styles.profileMenuDismiss}
          onPress={() => setShowProfileMenu(false)}
          accessibilityRole="button"
          accessibilityLabel="Close profile menu"
        />
        <View style={[styles.profileMenuDrawer, { paddingTop: topPad + 10 }]}>
          <View style={styles.profileMenuHeader}>
            <View style={styles.profileMenuIdentity}>
              {profile.photoURL ? (
                <Image source={{ uri: profile.photoURL }} style={styles.profileMenuAvatar} />
              ) : (
                <View style={styles.profileMenuAvatarFallback}>
                  <Text style={styles.profileMenuAvatarText}>{initials}</Text>
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.profileMenuName} numberOfLines={1}>{profile.fullName}</Text>
                <Text style={styles.profileMenuRole}>
                  {roleLabel}
                  {profile.jnvName ? ` · ${profile.jnvName}` : ""}
                  {profile.role === "alumni" && profile.passoutYear ? ` · ${profile.passoutYear} Batch` : ""}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.profileMenuClose}
              onPress={() => setShowProfileMenu(false)}
              accessibilityRole="button"
              accessibilityLabel="Close profile menu"
            >
              <Ionicons name="close" size={22} color="#1F2937" />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
            {profileMenuSections.map((section) => {
              const isOpen = openMenuSections.includes(section.title);
              return (
                <View key={section.title} style={styles.profileMenuSection}>
                  <TouchableOpacity
                    style={styles.profileMenuSectionHeader}
                    onPress={() => toggleMenuSection(section.title)}
                    activeOpacity={0.75}
                  >
                    <View style={styles.profileMenuSectionIcon}>
                      <Ionicons name={section.icon} size={17} color="#7C3AED" />
                    </View>
                    <Text style={styles.profileMenuSectionTitle}>{section.title}</Text>
                    <Ionicons name={isOpen ? "chevron-up" : "chevron-forward"} size={17} color="#9CA3AF" />
                  </TouchableOpacity>
                  {isOpen ? (
                    <View style={styles.profileMenuItems}>
                      {section.items.map((item) => (
                        <TouchableOpacity
                          key={item.label}
                          style={styles.profileMenuItem}
                          onPress={() => {
                            setShowProfileMenu(false);
                            item.onPress();
                          }}
                          activeOpacity={0.72}
                        >
                          <View style={styles.profileMenuItemIcon}>
                            <Ionicons name={item.icon} size={17} color="#6D28D9" />
                          </View>
                          <Text style={styles.profileMenuItemText}>{item.label}</Text>
                          <Ionicons name="chevron-forward" size={15} color="#C4B5FD" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <TouchableOpacity
              style={styles.profileMenuSignOut}
              onPress={() => {
                setShowProfileMenu(false);
                handleSignOut();
              }}
              activeOpacity={0.8}
            >
              <Ionicons name="log-out-outline" size={18} color="#DC2626" />
              <Text style={styles.profileMenuSignOutText}>Sign Out</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );

  const isPremiumAlumni =
    profile.role === "alumni" &&
    Boolean(profile.isPremium || membershipStatus?.isPremium || previewPremium);

  if (isPremiumAlumni) {
    return (
      <View style={[styles.container]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 150 + insets.bottom }}
        >
          {previewPremium && (
            <View style={styles.previewModeBanner}>
              <View style={styles.previewModeTextWrap}>
                <Ionicons name="eye-outline" size={16} color="#7C3AED" />
                <Text style={styles.previewModeBannerText}>
                  Premium Alumni Profile Preview Mode
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setPreviewPremium(false)}
                style={styles.previewExitBtn}
                activeOpacity={0.8}
              >
                <Text style={styles.previewExitText}>Exit Preview</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ paddingTop: topPad }}>
            <PremiumAlumniProfileCard
              profile={profile}
              previewMode={previewPremium}
              onEditPress={() => router.push("/(screens)/edit-profile" as any)}
              onBenefitsPress={() => setShowSubscriptionModal(true)}
              onMenuPress={() => setShowProfileMenu(true)}
            />
          </View>

          <View style={{ paddingHorizontal: 16 }}>
            <ProfilePostsSection userId={profile.uid} isOwner />

            <View style={styles.recognitionCard}>
              <View style={styles.recognitionHeader}>
                <Ionicons name="trophy-outline" size={18} color="#B7791F" />
                <Text style={styles.cardTitle}>Community Recognition</Text>
              </View>
              {recognitionLoading ? (
                <Text style={styles.badgeSubtitle}>Loading your points and awards…</Text>
              ) : recognitionError ? (
                <Text style={styles.badgeSubtitle}>{recognitionError}</Text>
              ) : (
                <>
                  <Text style={styles.recognitionPoints}>
                    {recognition?.totalPoints ?? 0} points earned
                  </Text>
                  <Text style={styles.recognitionAward}>
                    This month: {recognition?.monthlyRank ? `rank #${recognition.monthlyRank}` : "not ranked yet"} · Annual: {recognition?.annualRank ? `rank #${recognition.annualRank}` : "not ranked yet"}
                  </Text>
                  <Text style={styles.recognitionAward}>
                    {recognition?.awardCount ?? 0} awards earned
                  </Text>
                  {recognition?.awards.slice(0, 3).map((award) => (
                    <Text key={award.id} style={styles.recognitionAward}>
                      🏅 {award.category.replaceAll("_", " ")} · {award.period}
                    </Text>
                  ))}
                  {!recognition?.awards.length && (
                    <Text style={styles.badgeSubtitle}>
                      No finalized awards yet. Earned badges and award history appear here.
                    </Text>
                  )}
                </>
              )}
              <View style={styles.recognitionLinks}>
                {[
                  { label: "Points History", section: "history" },
                  { label: "My Awards", section: "awards" },
                  { label: "Leaderboard", section: "leaderboard" },
                  { label: "Hall of Fame", section: "hall" },
                ].map((item) => (
                  <TouchableOpacity
                    key={item.section}
                    onPress={() =>
                      router.push({
                        pathname: "/(screens)/alumni-contributions",
                        params: { section: item.section },
                      } as any)
                    }
                  >
                    <Text style={styles.recognitionLink}>{item.label} ›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

          </View>
        </ScrollView>

        {renderProfileMenu()}

        <AlumniPremiumSubscriptionModal
          visible={showSubscriptionModal}
          onClose={() => setShowSubscriptionModal(false)}
          onSubscribed={async () => {
            await refreshProfile();
            const st = await api.alumniMembership.status().catch(() => null);
            if (st) setMembershipStatus(st);
          }}
        />

        <Modal
          visible={showSignOutModal}
          transparent
          animationType="fade"
          onRequestClose={() => setShowSignOutModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalBox}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="log-out-outline" size={32} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>Sign Out</Text>
              <Text style={styles.modalMessage}>
                Are you sure you want to sign out of Navodaya Connect?
              </Text>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.modalCancel}
                  onPress={() => setShowSignOutModal(false)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalConfirm}
                  onPress={confirmSignOut}
                  activeOpacity={0.8}
                  disabled={signingOut}
                >
                  <Text style={styles.modalConfirmText}>
                    {signingOut ? "Signing out…" : "Sign Out"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={[styles.container]}>
      <View style={[styles.header, { paddingTop: topPad + 8 }]}>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerEditButton}
            onPress={() => router.push("/(screens)/edit-profile" as any)}
            accessibilityRole="button"
            accessibilityLabel="Edit profile"
          >
            <Ionicons name="create-outline" size={16} color="#7C3AED" />
            <Text style={styles.headerEditText}>Edit</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.headerMenuButton}
            onPress={() => setShowProfileMenu(true)}
            accessibilityRole="button"
            accessibilityLabel="Open profile menu"
          >
            <Ionicons name="menu" size={22} color="#7C3AED" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 150 + insets.bottom, paddingHorizontal: 16 }}
      >
        {profile.role === "alumni" && (
          <LinearGradient
            colors={["#581C87", "#7C3AED", "#9333EA"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.alumniUpgradeBanner}
          >
            <View style={styles.alumniUpgradeCrown}>
              <Text style={{ fontSize: 22 }}>👑</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.alumniUpgradeTitle}>Upgrade to Premium Alumni</Text>
              <Text style={styles.alumniUpgradeSub}>
                Diagonal identity card, reach analytics, golden badge & exclusive offers
              </Text>
            </View>
            <View style={{ gap: 6, marginLeft: 8 }}>
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => setShowSubscriptionModal(true)}
              >
                <Text style={styles.upgradeBtnText}>Upgrade →</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.previewBtn}
                onPress={() => setPreviewPremium(true)}
              >
                <Text style={styles.previewBtnText}>Preview</Text>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        )}

        <View style={styles.profileCard}>
          <TouchableOpacity
            style={styles.avatarWrap}
            onPress={() => router.push("/(screens)/edit-profile" as any)}
            activeOpacity={0.85}
          >
            {profile.photoURL ? (
              <Image source={{ uri: profile.photoURL }} style={styles.avatarPhoto} />
            ) : (
              <View style={styles.avatarRing}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>
              </View>
            )}
            <View style={styles.editPhotoBadge}>
              <Ionicons name="camera" size={13} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.profileName}>{profile.fullName}</Text>
          {(profile as any).bio ? (
            <Text style={styles.profileBio} numberOfLines={2}>{(profile as any).bio}</Text>
          ) : null}
          <View style={{ marginTop: 4 }}><RoleBadge role={profile.role} /></View>
          {(profile.role === "alumni" ? profile.verificationStatus !== "community_verified" || !profile.communityVerifiedAt : profile.verificationStatus !== "verified") ? (
            <TouchableOpacity
              style={styles.profileVerifyBadge}
              onPress={() => router.push((profile.role === "alumni" ? "/(screens)/alumni-peer-verification" : "/(screens)/verification-center") as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="shield-outline" size={14} color="#FF7A00" />
              <Text style={styles.profileVerifyText}>
                {profile.role === "alumni" ? "Get Community Verified" : profile.verificationStatus === "pending" ? "Verification Pending" : "Get Verified"}
              </Text>
              <Ionicons name="chevron-forward" size={12} color="#FF7A00" />
            </TouchableOpacity>
          ) : (
            <View style={{ marginTop: 8 }}>
              <VerifiedBadge status={profile.verificationStatus} role={profile.role} size="md" />
            </View>
          )}
          {digitalCredential ? (
            <TouchableOpacity
              style={styles.digitalIdButton}
              onPress={() => router.push("/(screens)/digital-id" as any)}
              activeOpacity={0.85}
              accessibilityRole="button"
            >
              <Ionicons name="card-outline" size={17} color="#FFFFFF" />
              <Text style={styles.digitalIdButtonText}>View Digital ID</Text>
              <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
            </TouchableOpacity>
          ) : digitalIdLoading ? (
            <View style={styles.digitalIdPending}><Text style={styles.digitalIdPendingText}>Loading your Navodaya Digital ID…</Text></View>
          ) : (profile.role === "alumni" ? profile.verificationStatus === "community_verified" && !!profile.communityVerifiedAt : profile.verificationStatus === "verified") ? (
            <TouchableOpacity
              style={styles.profileVerifyBadge}
              onPress={() => router.push("/(screens)/digital-id" as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="card-outline" size={14} color="#7C3AED" />
              <Text style={[styles.profileVerifyText, { color: "#7C3AED" }]}>View Digital ID</Text>
              <Ionicons name="chevron-forward" size={12} color="#7C3AED" />
            </TouchableOpacity>
          ) : (
            <View style={styles.digitalIdPending}>
              <Ionicons name="lock-closed-outline" size={15} color="#738099" />
              <Text style={styles.digitalIdPendingText}>{profile.role === "alumni" ? "Community verification unlocks your Digital ID" : "School verification unlocks your Digital ID"}</Text>
            </View>
          )}
          {((profile as any).linkedinUrl || (profile as any).twitterUrl) && (
            <View style={styles.socialRow}>
              {(profile as any).linkedinUrl && (
                <View style={styles.socialPill}>
                  <Ionicons name="logo-linkedin" size={14} color="#0077B5" />
                  <Text style={styles.socialPillText}>LinkedIn</Text>
                </View>
              )}
              {(profile as any).twitterUrl && (
                <View style={styles.socialPill}>
                  <Ionicons name="logo-twitter" size={14} color="#1DA1F2" />
                  <Text style={styles.socialPillText}>Twitter</Text>
                </View>
              )}
            </View>
          )}
          {profile.role === "alumni" && profile.resumeUrl ? (
            <TouchableOpacity
              style={[styles.profileVerifyBadge, { backgroundColor: "#F5F3FF", borderColor: "#C7D2FE" }]}
              onPress={() => void Linking.openURL(profile.resumeUrl!).catch(() => Alert.alert("Unable to open link", "Check the resume link and try again."))}
              accessibilityRole="link"
            >
              <Ionicons name="document-text-outline" size={14} color="#7C3AED" />
              <Text style={[styles.profileVerifyText, { color: "#7C3AED" }]}>View Resume / CV</Text>
              <Ionicons name="open-outline" size={12} color="#7C3AED" />
            </TouchableOpacity>
          ) : null}
        </View>

        <ProfilePostsSection userId={profile.uid} isOwner />

        <FadeIn><View style={styles.infoCard}>
          <TouchableOpacity
            style={styles.bioToggle}
            onPress={() => setShowBioDetails((open) => !open)}
            activeOpacity={0.75}
            accessibilityRole="button"
            accessibilityState={{ expanded: showBioDetails }}
          >
            <View style={styles.infoIconWrap}><Ionicons name="person-outline" size={18} color="#7C3AED" /></View>
            <View style={styles.infoText}>
              <Text style={styles.bioTitle}>Bio</Text>
              <Text style={styles.bioSummary} numberOfLines={1}>{(profile as any).bio || `${roleLabel} · ${profile.jnvName || "JNV"}`}</Text>
            </View>
            <Ionicons name={showBioDetails ? "chevron-up" : "chevron-down"} size={20} color="#69758B" />
          </TouchableOpacity>
          {showBioDetails && infoItems.map((item, index) => (
            <FadeIn key={item.label} delay={Math.min(index, 4) * 30}>
            <View
              style={[
                styles.infoRow,
                index < infoItems.length - 1 && styles.infoRowBorder,
              ]}
            >
              <View style={styles.infoIconWrap}>
                <Ionicons name={item.icon} size={18} color="#7C3AED" />
              </View>
              <View style={styles.infoText}>
                <Text style={styles.infoLabel}>{item.label}</Text>
                <Text style={styles.infoValue}>{item.value}</Text>
              </View>
            </View></FadeIn>
          ))}
        </View></FadeIn>

        {showBioDetails && profile.skills && profile.skills.length > 0 && (
          <FadeIn><View style={styles.skillsCard}>
            <Text style={styles.cardTitle}>Skills</Text>
            <View style={styles.skillsWrap}>
              {profile.skills.map((s) => (
                <View key={s} style={styles.skillChip}>
                  <Text style={styles.skillText}>{s}</Text>
                </View>
              ))}
            </View>
          </View></FadeIn>
        )}

        {showBioDetails && <FadeIn><View style={styles.aboutCard}>
          <Text style={styles.cardTitle}>About</Text>
          <Text style={styles.aboutText}>
            {profile.role === "student"
              ? `${roleLabel} at ${profile.jnvName || "JNV"}`
              : profile.role === "alumni"
              ? `${profile.profession || "Alumni"} · ${profile.jnvName || "JNV"} Graduate`
              : profile.role === "teacher"
              ? `${profile.subject || "Teacher"} at ${profile.jnvName || "JNV"}`
              : `JNV Official at ${profile.jnvName || "JNV"}`}
          </Text>
        </View></FadeIn>}

        <View style={styles.recognitionCard}>
          <View style={styles.recognitionHeader}><Ionicons name="trophy-outline" size={18} color="#B7791F" /><Text style={styles.cardTitle}>Community Recognition</Text></View>
          {recognitionLoading ? <Text style={styles.badgeSubtitle}>Loading your points and awards…</Text> : recognitionError ? <Text style={styles.badgeSubtitle}>{recognitionError}</Text> : <>
            <Text style={styles.recognitionPoints}>{recognition?.totalPoints ?? 0} points earned</Text>
            <Text style={styles.recognitionAward}>This month: {recognition?.monthlyRank ? `rank #${recognition.monthlyRank}` : "not ranked yet"} · Annual: {recognition?.annualRank ? `rank #${recognition.annualRank}` : "not ranked yet"}</Text>
            <Text style={styles.recognitionAward}>{recognition?.awardCount ?? 0} awards earned</Text>
            {recognition?.awards.slice(0, 3).map((award) => <Text key={award.id} style={styles.recognitionAward}>🏅 {award.category.replaceAll("_", " ")} · {award.period}</Text>)}
            {!recognition?.awards.length && <Text style={styles.badgeSubtitle}>No finalized awards yet. Earned badges and award history appear here.</Text>}
          </>}
          <View style={styles.recognitionLinks}>{[{ label: "Points History", section: "history" }, { label: "My Awards", section: "awards" }, { label: "Leaderboard", section: "leaderboard" }, { label: "Hall of Fame", section: "hall" }].map((item) => <TouchableOpacity key={item.section} onPress={() => router.push({ pathname: "/(screens)/alumni-contributions", params: { section: item.section } } as any)}><Text style={styles.recognitionLink}>{item.label} ›</Text></TouchableOpacity>)}</View>
        </View>

      </ScrollView>

      {renderProfileMenu()}

      <AlumniPremiumSubscriptionModal
        visible={showSubscriptionModal}
        onClose={() => setShowSubscriptionModal(false)}
        onSubscribed={async () => {
          await refreshProfile();
          const st = await api.alumniMembership.status().catch(() => null);
          if (st) setMembershipStatus(st);
        }}
      />

      <Modal
        visible={showSignOutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowSignOutModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="log-out-outline" size={32} color="#EF4444" />
            </View>
            <Text style={styles.modalTitle}>Sign Out</Text>
            <Text style={styles.modalMessage}>Are you sure you want to sign out of Navodaya Connect?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancel}
                onPress={() => setShowSignOutModal(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={confirmSignOut}
                activeOpacity={0.8}
                disabled={signingOut}
              >
                <Text style={styles.modalConfirmText}>{signingOut ? "Signing out…" : "Sign Out"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8F7FF" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerEditButton: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "#F5F3FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  headerEditText: { color: "#7C3AED", fontSize: 14, fontFamily: "Inter_600SemiBold" },
  headerTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: "#111827" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerMenuButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  profileCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    marginTop: 16,
    paddingVertical: 26,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.8)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.1,
    shadowRadius: 18,
    elevation: 4,
  },
  digitalIdPending: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 14, backgroundColor: "#F5F3FF" },
  digitalIdPendingText: { color: "#7C3AED", fontFamily: "Inter_500Medium", fontSize: 11, textAlign: "center", flexShrink: 1 },
  digitalIdButton: {
    minHeight: 48,
    width: "100%",
    marginTop: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: "#7C3AED",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 10,
    elevation: 4,
  },
  digitalIdButtonText: { color: "#FFFFFF", fontFamily: "Inter_700Bold", fontSize: 14 },
  profileVerifyBadge: {
    flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10,
    backgroundColor: "#FFF7ED", borderRadius: 20, paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#FDBA74",
  },
  profileVerifyText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#FF7A00" },
  avatarWrap: { marginBottom: 14, position: "relative" },
  avatarPhoto: {
    width: 98, height: 98, borderRadius: 49,
    borderWidth: 3, borderColor: "#7C3AED",
  },
  avatarRing: {
    width: 98, height: 98, borderRadius: 49,
    borderWidth: 3, borderColor: "#7C3AED",
    alignItems: "center", justifyContent: "center",
  },
  avatar: {
    width: 86, height: 86, borderRadius: 43,
    backgroundColor: "#F5F3FF",
    alignItems: "center", justifyContent: "center",
  },
  avatarText: { fontSize: 32, fontFamily: "Inter_700Bold", color: "#7C3AED" },
  editPhotoBadge: {
    position: "absolute", bottom: 0, right: 0,
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: "#7C3AED", borderWidth: 2, borderColor: "#fff",
    alignItems: "center", justifyContent: "center",
  },
  profileName: { fontSize: 22, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 4 },
  profileBio: {
    fontSize: 13, fontFamily: "Inter_400Regular", color: "#64748B",
    textAlign: "center", marginHorizontal: 20, marginBottom: 8, lineHeight: 20,
  },
  socialRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  socialPill: {
    flexDirection: "row", alignItems: "center", gap: 5,
    backgroundColor: "#F5F3FF", borderRadius: 16,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "rgba(233, 213, 255, 0.7)",
  },
  socialPillText: { fontSize: 12, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    overflow: "hidden",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  bioToggle: { minHeight: 72, flexDirection: "row", alignItems: "center", paddingHorizontal: 18, gap: 12 },
  bioTitle: { color: "#1E1B4B", fontSize: 15, fontFamily: "Inter_700Bold" },
  bioSummary: { marginTop: 3, color: "#64748B", fontSize: 12, fontFamily: "Inter_400Regular" },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    gap: 14,
  },
  infoRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#F5F3FF",
    alignItems: "center", justifyContent: "center",
  },
  infoText: { flex: 1 },
  infoLabel: { fontSize: 11, fontFamily: "Inter_400Regular", color: "#64748B", marginBottom: 2 },
  infoValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: "#1E1B4B" },
  skillsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginTop: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontFamily: "Inter_700Bold", color: "#1E1B4B", marginBottom: 12 },
  skillsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skillChip: {
    backgroundColor: "#F5F3FF",
    borderRadius: 20,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
  },
  skillText: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: "#7C3AED" },
  aboutCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginTop: 14,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  aboutText: { fontSize: 14, fontFamily: "Inter_400Regular", color: "#1E1B4B", lineHeight: 22 },
  profileMenuOverlay: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    backgroundColor: "rgba(17, 24, 39, 0.42)",
  },
  profileMenuDismiss: { flex: 1 },
  profileMenuDrawer: {
    width: "86%",
    maxWidth: 390,
    height: "100%",
    backgroundColor: "#FAF9FF",
    borderTopLeftRadius: 24,
    borderBottomLeftRadius: 24,
    paddingHorizontal: 14,
    shadowColor: "#111827",
    shadowOffset: { width: -6, height: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 12,
  },
  profileMenuHeader: {
    minHeight: 74,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 4,
    paddingBottom: 12,
  },
  profileMenuIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  profileMenuAvatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: "#7C3AED" },
  profileMenuAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#EDE9FE",
    alignItems: "center",
    justifyContent: "center",
  },
  profileMenuAvatarText: { color: "#7C3AED", fontFamily: "Inter_700Bold", fontSize: 16 },
  profileMenuName: { color: "#1F2937", fontFamily: "Inter_700Bold", fontSize: 15 },
  profileMenuRole: { color: "#6B7280", fontFamily: "Inter_500Medium", fontSize: 11, marginTop: 3 },
  profileMenuClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  profileMenuSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#F0EAFE",
    overflow: "hidden",
  },
  profileMenuSectionHeader: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  profileMenuSectionIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "#F5F3FF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileMenuSectionTitle: { flex: 1, color: "#1F2937", fontFamily: "Inter_700Bold", fontSize: 13 },
  profileMenuItems: { borderTopWidth: 1, borderTopColor: "#F3F4F6", paddingVertical: 4 },
  profileMenuItem: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    gap: 10,
  },
  profileMenuItemIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#FAF5FF",
    alignItems: "center",
    justifyContent: "center",
  },
  profileMenuItemText: { flex: 1, color: "#374151", fontFamily: "Inter_500Medium", fontSize: 12 },
  profileMenuSignOut: {
    minHeight: 50,
    marginTop: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  profileMenuSignOutText: { color: "#DC2626", fontFamily: "Inter_700Bold", fontSize: 13 },
  menuCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    marginTop: 14,
    borderWidth: 1,
    borderColor: "rgba(233, 213, 255, 0.7)",
    overflow: "hidden",
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 15,
    gap: 14,
  },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  menuIconWrap: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: "#F5F3FF",
    alignItems: "center", justifyContent: "center",
  },
  menuLabel: { flex: 1, fontSize: 14, fontFamily: "Inter_500Medium", color: "#1E1B4B" },
  signOutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#EF4444",
  },
  signOutText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#EF4444" },
  recognitionCard: { marginHorizontal: 16, marginTop: 14, padding: 14, backgroundColor: "#FFFBEB", borderColor: "#FDE68A", borderWidth: 1, borderRadius: 15 }, recognitionLinks: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 8, marginTop: 9 },
  recognitionHeader: { flexDirection: "row", alignItems: "center", gap: 7 }, recognitionPoints: { marginTop: 8, color: "#17243A", fontFamily: "Inter_700Bold", fontSize: 18 }, recognitionAward: { marginTop: 5, color: "#7C5A19", fontFamily: "Inter_500Medium", fontSize: 11 }, recognitionLink: { marginTop: 9, color: "#7C3AED", fontFamily: "Inter_600SemiBold", fontSize: 11 },
  badgeCard: {
    backgroundColor: "#fff", borderRadius: 16, marginTop: 14,
    padding: 16, borderWidth: 1, borderColor: "#F0F0F0",
  },
  badgeCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  badgeSubtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: "#9CA3AF", marginBottom: 14 },
  badgesGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeItem: { alignItems: "center", width: 76, gap: 4 },
  badgeItemLocked: { opacity: 0.6 },
  badgeEmoji: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  badgeEmojiText: { fontSize: 26 },
  badgeLabel: { fontSize: 10, fontFamily: "Inter_500Medium", color: "#374151", textAlign: "center" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  modalBox: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 28,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
  },
  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: "#111827", marginBottom: 8 },
  modalMessage: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  modalActions: { flexDirection: "row", gap: 12, width: "100%" },
  modalCancel: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#E5E7EB",
    alignItems: "center",
  },
  modalCancelText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#374151" },
  modalConfirm: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 12,
    backgroundColor: "#EF4444",
    alignItems: "center",
  },
  modalConfirmText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },

  // Alumni Premium Upgrade & Preview Banners
  alumniUpgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    borderRadius: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    shadowColor: "#7C3AED",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 10,
    elevation: 4,
  },
  alumniUpgradeCrown: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  alumniUpgradeTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  alumniUpgradeSub: {
    fontSize: 11,
    color: "#E9D5FF",
    marginTop: 2,
    lineHeight: 15,
  },
  upgradeBtn: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: "center",
  },
  upgradeBtnText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#7C3AED",
  },
  previewBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.25)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.5)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    alignItems: "center",
  },
  previewBtnText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },

  previewModeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#F5F3FF",
    borderBottomWidth: 1,
    borderBottomColor: "#DDD6FE",
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  previewModeTextWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  previewModeBannerText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#7C3AED",
  },
  previewExitBtn: {
    backgroundColor: "#7C3AED",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  previewExitText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: "#FFFFFF",
  },
});
