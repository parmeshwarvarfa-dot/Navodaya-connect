import React, { useState } from "react";
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ThemedText as Text } from "@/components/ThemedNative";

interface FeaturePreviewsModalProps {
  visible: boolean;
  initialIndex?: number;
  onClose: () => void;
  onJoinPress: () => void;
}

interface FeatureItem {
  key: string;
  title: string;
  renderContent: (
    likes: Record<string, { count: number; liked: boolean }>,
    toggleLike: (id: string, initialCount: number) => void
  ) => React.ReactNode;
}

export default function FeaturePreviewsModal({
  visible,
  initialIndex = 0,
  onClose,
  onJoinPress,
}: FeaturePreviewsModalProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [likes, setLikes] = useState<Record<string, { count: number; liked: boolean }>>({
    mem1: { count: 12, liked: false },
    mem2: { count: 8, liked: false },
  });
  const [toastMessage, setToastMessage] = useState("");

  if (!visible) return null;

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(""), 2600);
  };

  const toggleLike = (id: string, initialCount: number) => {
    setLikes((prev) => {
      const current = prev[id] || { count: initialCount, liked: false };
      const nextLiked = !current.liked;
      return {
        ...prev,
        [id]: {
          count: nextLiked ? current.count + 1 : current.count - 1,
          liked: nextLiked,
        },
      };
    });
  };

  const FEATURES: FeatureItem[] = [
    {
      key: "memories",
      title: "Memories",
      renderContent: (currentLikes, onToggle) => (
        <View style={styles.contentWrap}>
          {/* Card 1 */}
          <View style={styles.previewCard}>
            <View style={styles.cardUserRow}>
              <LinearGradient
                colors={["#7A2CF0", "#D8C2FF"]}
                style={styles.avatarGradient}
              />
              <Text style={styles.userName}>Demo Member A</Text>
              <View style={styles.sampleBadge}>
                <Text style={styles.sampleBadgeText}>SAMPLE</Text>
              </View>
            </View>
            <View style={styles.imagePlaceholder}>
              <Ionicons name="image-outline" size={24} color="#6A00E0" />
              <Text style={styles.imagePlaceholderText}>Sample campus photograph</Text>
            </View>
            <Text style={styles.cardCaption}>
              Sample caption: our morning assembly prayer, years ago.
            </Text>
            <TouchableOpacity
              style={styles.likeBtn}
              activeOpacity={0.7}
              onPress={() => onToggle("mem1", 12)}
            >
              <Ionicons
                name={currentLikes.mem1?.liked ? "heart" : "heart-outline"}
                size={16}
                color={currentLikes.mem1?.liked ? "#C2185B" : "#6A00E0"}
              />
              <Text
                style={[
                  styles.likeText,
                  currentLikes.mem1?.liked && styles.likeTextActive,
                ]}
              >
                {currentLikes.mem1?.liked ? "Liked" : "Like"} · {currentLikes.mem1?.count ?? 12}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Card 2 */}
          <View style={styles.previewCard}>
            <View style={styles.cardUserRow}>
              <LinearGradient
                colors={["#7A2CF0", "#D8C2FF"]}
                style={styles.avatarGradient}
              />
              <Text style={styles.userName}>Demo Member B</Text>
              <View style={styles.sampleBadge}>
                <Text style={styles.sampleBadgeText}>SAMPLE</Text>
              </View>
            </View>
            <View style={styles.imagePlaceholder}>
              <Ionicons name="play-circle-outline" size={26} color="#6A00E0" />
              <Text style={styles.imagePlaceholderText}>Sample video · ▶</Text>
            </View>
            <Text style={styles.cardCaption}>
              Sample caption: hostel memories & cross-migration compilation.
            </Text>
            <TouchableOpacity
              style={styles.likeBtn}
              activeOpacity={0.7}
              onPress={() => onToggle("mem2", 8)}
            >
              <Ionicons
                name={currentLikes.mem2?.liked ? "heart" : "heart-outline"}
                size={16}
                color={currentLikes.mem2?.liked ? "#C2185B" : "#6A00E0"}
              />
              <Text
                style={[
                  styles.likeText,
                  currentLikes.mem2?.liked && styles.likeTextActive,
                ]}
              >
                {currentLikes.mem2?.liked ? "Liked" : "Like"} · {currentLikes.mem2?.count ?? 8}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
    },
    {
      key: "chats",
      title: "Chats & Community",
      renderContent: () => (
        <View style={styles.contentWrap}>
          {/* Group Chat Item */}
          <View style={styles.chatRow}>
            <LinearGradient
              colors={["#7A2CF0", "#D8C2FF"]}
              style={styles.chatRowAvatar}
            >
              <Ionicons name="people" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatRowName}>Demo group: Batch 2014</Text>
              <Text style={styles.chatRowSub}>House & batch channel (sample)</Text>
            </View>
          </View>

          {/* Direct Chat Item */}
          <View style={styles.chatRow}>
            <LinearGradient
              colors={["#7A2CF0", "#D8C2FF"]}
              style={styles.chatRowAvatar}
            >
              <Ionicons name="person" size={16} color="#FFFFFF" />
            </LinearGradient>
            <View style={{ flex: 1 }}>
              <Text style={styles.chatRowName}>Demo member C</Text>
              <Text style={styles.chatRowSub}>Direct message (sample)</Text>
            </View>
          </View>

          {/* Sample Chat Bubbles */}
          <View style={styles.bubblesContainer}>
            <View style={styles.chatBubbleOther}>
              <Text style={styles.chatBubbleTextOther}>
                Who is attending the upcoming JNV Silver Jubilee reunion?
              </Text>
            </View>
            <View style={styles.chatBubbleMe}>
              <Text style={styles.chatBubbleTextMe}>
                I'm definitely in! Booking travel this week.
              </Text>
            </View>
          </View>
        </View>
      ),
    },
    {
      key: "events",
      title: "Events",
      renderContent: () => (
        <View style={styles.contentWrap}>
          {/* Event 1 */}
          <View style={styles.previewCard}>
            <View style={styles.cardUserRow}>
              <Text style={styles.eventTitle}>Sample: Alumni Batch Reunion</Text>
              <View style={[styles.sampleBadge, { backgroundColor: "#DCFCE7" }]}>
                <Text style={[styles.sampleBadgeText, { color: "#166534" }]}>UPCOMING</Text>
              </View>
            </View>
            <View style={styles.imagePlaceholder}>
              <Ionicons name="calendar-outline" size={24} color="#6A00E0" />
              <Text style={styles.imagePlaceholderText}>Sample reunion banner</Text>
            </View>
            <Text style={styles.cardCaption}>
              Exact date, schedule, and venue details appear once a real event is published.
            </Text>
            <TouchableOpacity
              style={styles.previewActionBtn}
              onPress={() => showToast("Preview only. Event registration opens on sign-in.")}
            >
              <Text style={styles.previewActionText}>Register (preview only)</Text>
            </TouchableOpacity>
          </View>

          {/* Event 2 */}
          <View style={styles.previewCard}>
            <View style={styles.cardUserRow}>
              <Text style={styles.eventTitle}>Sample: Inter-House Championship</Text>
              <View style={[styles.sampleBadge, { backgroundColor: "#F1EFF5" }]}>
                <Text style={[styles.sampleBadgeText, { color: "#64748B" }]}>PAST</Text>
              </View>
            </View>
            <View style={styles.imagePlaceholder}>
              <Ionicons name="trophy-outline" size={24} color="#6A00E0" />
              <Text style={styles.imagePlaceholderText}>Sample competition leaderboard</Text>
            </View>
            <Text style={styles.cardCaption}>
              Past cultural, sports, and quiz competitions are archived here.
            </Text>
            <TouchableOpacity
              style={styles.previewActionBtn}
              onPress={() => showToast("Preview only. Full event archives are available in app.")}
            >
              <Text style={styles.previewActionText}>View details (preview only)</Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
    },
    {
      key: "talks",
      title: "Navodayan Talks",
      renderContent: () => (
        <View style={styles.contentWrap}>
          <View style={styles.previewCard}>
            <View style={styles.imagePlaceholder}>
              <Ionicons name="videocam" size={24} color="#6A00E0" />
              <Text style={styles.imagePlaceholderText}>▶ Sample video story</Text>
            </View>
            <Text style={styles.storyTitle}>From JNV Classroom to Civil Services</Text>
            <Text style={styles.cardCaption}>
              Sample creator · 2012 Batch · Category: Civil Services
            </Text>
          </View>

          <View style={styles.previewCard}>
            <View style={styles.imagePlaceholder}>
              <Ionicons name="videocam" size={24} color="#6A00E0" />
              <Text style={styles.imagePlaceholderText}>▶ Sample journey story</Text>
            </View>
            <Text style={styles.storyTitle}>Building a Tech Startup from JNV Roots</Text>
            <Text style={styles.cardCaption}>
              Sample creator · 2015 Batch · Category: Entrepreneurship
            </Text>
          </View>

          <TouchableOpacity
            style={styles.previewActionBtn}
            onPress={() => showToast("Share your story is active inside the Navodayan Talks module.")}
          >
            <Text style={styles.previewActionText}>Share your story (preview only)</Text>
          </TouchableOpacity>
        </View>
      ),
    },
    {
      key: "id",
      title: "Digital ID",
      renderContent: () => (
        <View style={styles.contentWrap}>
          <LinearGradient
            colors={["#4C238C", "#7650BD"]}
            style={styles.idCardContainer}
          >
            <Text style={styles.idCardHeader}>SAMPLE ID · NOT A REAL MEMBER</Text>
            <Text style={styles.idCardName}>Sample Member Name</Text>
            <Text style={styles.idCardDetail}>JNV: [District placeholder]</Text>
            <Text style={styles.idCardDetail}>Batch: [Passout year]</Text>
            <Text style={styles.idCardDetail}>House: Aravali / Nilgiri / Shiwalik / Udaygiri</Text>
          </LinearGradient>

          <View style={styles.qrContainer}>
            <Ionicons name="qr-code-outline" size={32} color="#7A2CF0" />
            <Text style={styles.qrText}>QR verification placeholder · not functional</Text>
          </View>

          <TouchableOpacity
            style={styles.previewActionBtn}
            onPress={() => showToast("Digital ID card is issued to verified community members.")}
          >
            <Text style={styles.previewActionText}>Share ID preview</Text>
          </TouchableOpacity>
        </View>
      ),
    },
    {
      key: "alumni",
      title: "Alumni Network",
      renderContent: () => (
        <View style={styles.contentWrap}>
          <View style={styles.previewCard}>
            <View style={styles.cardUserRow}>
              <LinearGradient
                colors={["#7A2CF0", "#D8C2FF"]}
                style={styles.avatarGradient}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.userName}>Sample Senior Alumni</Text>
                <Text style={styles.userProfession}>Software Engineer · 2010 Batch</Text>
              </View>
              <View style={styles.sampleBadge}>
                <Text style={styles.sampleBadgeText}>SAMPLE</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.previewActionBtn}
              onPress={() => showToast("Connect & mentorship available after community sign-in.")}
            >
              <Text style={styles.previewActionText}>Connect (preview only)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.previewCard}>
            <View style={styles.cardUserRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.eventTitle}>Sample: Mentorship Opportunity</Text>
                <Text style={styles.userProfession}>Engineering Guidance & Career AMA</Text>
              </View>
              <View style={[styles.sampleBadge, { backgroundColor: "#EFF6FF" }]}>
                <Text style={[styles.sampleBadgeText, { color: "#1D4ED8" }]}>OPPORTUNITY</Text>
              </View>
            </View>
            <Text style={styles.cardCaption}>
              Sample internship, job or mentoring listing, shown for preview only.
            </Text>
            <TouchableOpacity
              style={styles.previewActionBtn}
              onPress={() => showToast("Opportunities are posted by verified alumni in app.")}
            >
              <Text style={styles.previewActionText}>View listing (preview only)</Text>
            </TouchableOpacity>
          </View>
        </View>
      ),
    },
  ];

  const currentFeature = FEATURES[currentIndex];

  const handlePrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  const handleNext = () => {
    if (currentIndex < FEATURES.length - 1) setCurrentIndex(currentIndex + 1);
  };

  return (
    <View style={styles.container}>
      {/* Toast Notification */}
      {!!toastMessage && (
        <View style={styles.toastWrap}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* Header Bar */}
      <View style={styles.headerBar}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.backBtn}
          activeOpacity={0.8}
        >
          <Ionicons name="chevron-back" size={14} color="#6A00E0" />
          <Text style={styles.backBtnText}>Landing</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>{currentFeature.title}</Text>

        <View style={{ width: 60 }} />
      </View>

      {/* Sample Data Disclaimer Tag */}
      <View style={styles.disclaimerPill}>
        <Ionicons name="shield-checkmark-outline" size={12} color="#8A5A00" />
        <Text style={styles.disclaimerText}>SAMPLE DATA · NOT LIVE</Text>
      </View>

      {/* Main Feature Content Body */}
      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {currentFeature.renderContent(likes, toggleLike)}
      </ScrollView>

      {/* Dots Indicator */}
      <View style={styles.dotsRow}>
        {FEATURES.map((f, i) => {
          const isActive = i === currentIndex;
          return (
            <TouchableOpacity
              key={f.key}
              onPress={() => setCurrentIndex(i)}
              style={styles.dotTouch}
              activeOpacity={0.8}
            >
              <View
                style={[
                  styles.dotBase,
                  isActive ? styles.dotActive : styles.dotInactive,
                ]}
              />
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Navigation Buttons Row: Prev / Next */}
      <View style={styles.navRow}>
        <TouchableOpacity
          onPress={handlePrev}
          disabled={currentIndex === 0}
          style={[styles.navBtn, currentIndex === 0 && styles.navBtnDisabled]}
        >
          <Text style={styles.navBtnText}>‹ Prev</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleNext}
          disabled={currentIndex === FEATURES.length - 1}
          style={[
            styles.navBtn,
            currentIndex === FEATURES.length - 1 && styles.navBtnDisabled,
          ]}
        >
          <Text style={styles.navBtnText}>Next ›</Text>
        </TouchableOpacity>
      </View>

      {/* Action Footer: Explore more / Join now */}
      <View style={styles.footerRow}>
        <TouchableOpacity
          onPress={onClose}
          style={styles.footerSecondaryBtn}
          activeOpacity={0.8}
        >
          <Text style={styles.footerSecondaryText}>Explore more</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onJoinPress}
          style={styles.footerPrimaryBtn}
          activeOpacity={0.85}
        >
          <LinearGradient
            colors={["#7A2CF0", "#6A00E0"]}
            style={styles.footerPrimaryGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.footerPrimaryText}>Join now</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    inset: 0,
    zIndex: 999,
    backgroundColor: "#F6F3FC",
    paddingTop: Platform.OS === "web" ? 36 : 46,
    paddingBottom: 24,
    paddingHorizontal: 16,
    flexDirection: "column",
    justifyContent: "space-between",
  },
  toastWrap: {
    position: "absolute",
    top: 70,
    left: 20,
    right: 20,
    zIndex: 1000,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
    borderWidth: 1,
    borderColor: "#D9CCFF",
  },
  toastText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#6A00E0",
    textAlign: "center",
  },
  headerBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1.5,
    borderColor: "#D9CCFF",
    gap: 2,
  },
  backBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6A00E0",
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0A0A2A",
    letterSpacing: -0.2,
  },
  disclaimerPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#FFF3D6",
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 10,
  },
  disclaimerText: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "#8A5A00",
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 14,
  },
  contentWrap: {
    gap: 12,
  },
  previewCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    padding: 14,
    shadowColor: "#4C238C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 2,
  },
  cardUserRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  avatarGradient: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  userName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A0A2A",
  },
  userProfession: {
    fontSize: 11,
    color: "#6B6790",
  },
  sampleBadge: {
    marginLeft: "auto",
    backgroundColor: "#F1EFF5",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sampleBadgeText: {
    fontSize: 8.5,
    fontWeight: "700",
    color: "#6B6790",
  },
  imagePlaceholder: {
    height: 96,
    borderRadius: 12,
    backgroundColor: "#E7DBFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginBottom: 8,
  },
  imagePlaceholderText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4C238C",
  },
  cardCaption: {
    fontSize: 12,
    color: "#6B6790",
    lineHeight: 16,
    marginBottom: 8,
  },
  storyTitle: {
    fontSize: 13.5,
    fontWeight: "700",
    color: "#0A0A2A",
    marginBottom: 3,
  },
  eventTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A0A2A",
  },
  likeBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  likeText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6A00E0",
  },
  likeTextActive: {
    color: "#C2185B",
  },
  previewActionBtn: {
    alignSelf: "flex-start",
    paddingVertical: 4,
  },
  previewActionText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6A00E0",
  },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 12,
  },
  chatRowAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  chatRowName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0A0A2A",
  },
  chatRowSub: {
    fontSize: 11,
    color: "#6B6790",
  },
  bubblesContainer: {
    marginTop: 8,
    gap: 8,
  },
  chatBubbleOther: {
    alignSelf: "flex-start",
    maxWidth: "80%",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  chatBubbleTextOther: {
    fontSize: 12,
    color: "#0A0A2A",
    lineHeight: 16,
  },
  chatBubbleMe: {
    alignSelf: "flex-end",
    maxWidth: "80%",
    backgroundColor: "#6A00E0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chatBubbleTextMe: {
    fontSize: 12,
    color: "#FFFFFF",
    lineHeight: 16,
  },
  idCardContainer: {
    borderRadius: 18,
    padding: 18,
    gap: 4,
    shadowColor: "#4C238C",
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 4,
  },
  idCardHeader: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    color: "rgba(255,255,255,0.8)",
    marginBottom: 4,
  },
  idCardName: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  idCardDetail: {
    fontSize: 11.5,
    color: "rgba(255,255,255,0.9)",
  },
  qrContainer: {
    height: 96,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "#B9A5ED",
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    padding: 8,
  },
  qrText: {
    fontSize: 9.5,
    color: "#6B6790",
    textAlign: "center",
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 4,
  },
  dotTouch: {
    padding: 8,
  },
  dotBase: {
    height: 6,
    borderRadius: 4,
    backgroundColor: "#CBBCE0",
  },
  dotActive: {
    width: 20,
    backgroundColor: "#6A00E0",
  },
  dotInactive: {
    width: 6,
  },
  navRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  navBtn: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D9CCFF",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 16,
  },
  navBtnDisabled: {
    opacity: 0.4,
  },
  navBtnText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#6A00E0",
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingTop: 8,
  },
  footerSecondaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderColor: "#D9CCFF",
    alignItems: "center",
    justifyContent: "center",
  },
  footerSecondaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6A00E0",
  },
  footerPrimaryBtn: {
    flex: 1,
    height: 44,
    borderRadius: 999,
    overflow: "hidden",
  },
  footerPrimaryGradient: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footerPrimaryText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
