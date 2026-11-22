import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  AppState,
  Dimensions,
  FlatList,
  LayoutChangeEvent,
  Linking,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api, type NewsItem } from "@/lib/api";

const HORIZONTAL_MARGIN = 16;
const MAX_CARD_WIDTH = 560;
const CARD_HEIGHT = 176;

const AUTO_SLIDE_INTERVAL = 4500; // 4.5 seconds
const STORAGE_LANG_KEY = "@navodaya_news_lang";

const GRADIENT_PALETTES: readonly [string, string][] = [
  ["#7C3AED", "#6366F1"], // Violet to Indigo
  ["#6D28D9", "#4F46E5"], // Deep Purple to Royal Indigo
  ["#8B5CF6", "#7C3AED"], // Lavender Purple to Violet
  ["#5B21B6", "#4338CA"], // Night Purple to Blue
  ["#7E22CE", "#9333EA"], // Rich Violet
];

interface JnvNewsCarouselProps {
  onSeeAllPress?: () => void;
  style?: any;
}

// Clean HTML entities, unescaped tokens, and multiple spaces
function cleanHtmlEntities(text?: string): string {
  if (!text) return "";
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateOrRelative(dateStr?: string, lang: "en" | "hi" = "en"): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (lang === "hi") {
      if (diffHours < 1) return "अभी";
      if (diffHours < 24) return `${diffHours} घंटे पहले`;
      if (diffDays === 1) return "कल";
      if (diffDays < 7) return `${diffDays} दिन पहले`;
      return d.toLocaleDateString("hi-IN", { day: "numeric", month: "short" });
    }

    if (diffHours < 1) return "Just now";
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  } catch {
    return "";
  }
}

export default function JnvNewsCarousel({ onSeeAllPress, style }: JnvNewsCarouselProps) {
  const { width: windowWidth } = useWindowDimensions();
  const [containerWidth, setContainerWidth] = useState<number>(windowWidth);

  const [lang, setLang] = useState<"en" | "hi">("en");
  const [newsByLang, setNewsByLang] = useState<{ en: NewsItem[]; hi: NewsItem[] }>({
    en: [],
    hi: [],
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [isUserInteracting, setIsUserInteracting] = useState<boolean>(false);
  const [reduceMotion, setReduceMotion] = useState<boolean>(false);
  const [linkErrorToast, setLinkErrorToast] = useState<string>("");

  const flatListRef = useRef<FlatList<NewsItem>>(null);
  const autoSlideTimerRef = useRef<any>(null);
  const userInteractionResumeTimerRef = useRef<any>(null);

  // Exact viewport width for paging
  const viewportWidth = containerWidth > 0 ? containerWidth : windowWidth;
  // Exact card width within slide viewport
  const cardWidth = Math.min(
    Math.max(viewportWidth - HORIZONTAL_MARGIN * 2, 260),
    MAX_CARD_WIDTH
  );

  const handleContainerLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 0 && Math.abs(w - containerWidth) > 1) {
      setContainerWidth(w);
    }
  };

  // Check reduced motion accessibility
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => setReduceMotion(enabled))
      .catch(() => {});

    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      setReduceMotion(enabled);
    });
    return () => {
      sub?.remove();
    };
  }, []);

  // Restore persisted language preference
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_LANG_KEY).then((saved) => {
      if (saved === "hi" || saved === "en") {
        setLang(saved);
      }
    }).catch(() => {});
  }, []);

  // Fetch news for the active language
  const fetchNews = useCallback(async (targetLang: "en" | "hi") => {
    setLoading(true);
    setError("");
    try {
      const items = await api.news.list({ lang: targetLang });
      // Filter out pure internal administrative announcements from the general JNV news feed
      const filtered = items.filter(
        (n) =>
          !["circular", "notice", "holiday", "exam"].includes(
            (n.category || "").toLowerCase()
          )
      );
      setNewsByLang((prev) => ({
        ...prev,
        [targetLang]: filtered,
      }));
    } catch (err: any) {
      console.warn(`[JnvNewsCarousel] Fetch news error for ${targetLang}:`, err);
      setError(
        targetLang === "hi"
          ? "समाचार लोड करने में असमर्थ। कृपया पुनः प्रयास करें।"
          : "Unable to load news. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Trigger fetch when language changes if not already fetched
  useEffect(() => {
    if (newsByLang[lang].length === 0) {
      void fetchNews(lang);
    }
  }, [lang, fetchNews, newsByLang]);

  // Current active news list
  const currentNewsList = useMemo(() => newsByLang[lang] || [], [newsByLang, lang]);
  const displayItems = useMemo(() => currentNewsList.slice(0, 8), [currentNewsList]);

  // Change language handler
  const handleLangChange = (newLang: "en" | "hi") => {
    if (newLang === lang) return;
    setLang(newLang);
    setActiveIndex(0);
    if (flatListRef.current) {
      try {
        flatListRef.current.scrollToOffset({ offset: 0, animated: false });
      } catch {}
    }
    AsyncStorage.setItem(STORAGE_LANG_KEY, newLang).catch(() => {});
  };

  // Clean up auto slide timer
  const stopAutoSlide = useCallback(() => {
    if (autoSlideTimerRef.current) {
      clearInterval(autoSlideTimerRef.current);
      autoSlideTimerRef.current = null;
    }
  }, []);

  // Start auto slide timer
  const startAutoSlide = useCallback(() => {
    stopAutoSlide();
    if (reduceMotion || isUserInteracting || displayItems.length <= 1) return;

    autoSlideTimerRef.current = setInterval(() => {
      setActiveIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % displayItems.length;
        if (flatListRef.current && viewportWidth > 0) {
          try {
            flatListRef.current.scrollToOffset({
              offset: nextIndex * viewportWidth,
              animated: true,
            });
          } catch {}
        }
        return nextIndex;
      });
    }, AUTO_SLIDE_INTERVAL);
  }, [displayItems.length, isUserInteracting, reduceMotion, stopAutoSlide, viewportWidth]);

  // Auto-slide effect
  useEffect(() => {
    startAutoSlide();
    return () => stopAutoSlide();
  }, [startAutoSlide, stopAutoSlide]);

  // Listen to AppState so auto slide pauses when tab / app is inactive
  useEffect(() => {
    const handleAppState = (nextState: string) => {
      if (nextState === "active") {
        startAutoSlide();
      } else {
        stopAutoSlide();
      }
    };
    const sub = AppState.addEventListener("change", handleAppState);
    return () => {
      sub.remove();
    };
  }, [startAutoSlide, stopAutoSlide]);

  // Handle manual scroll interaction pause / resume
  const handleScrollBeginDrag = () => {
    setIsUserInteracting(true);
    stopAutoSlide();
    if (userInteractionResumeTimerRef.current) {
      clearTimeout(userInteractionResumeTimerRef.current);
      userInteractionResumeTimerRef.current = null;
    }
  };

  const handleScrollEndDrag = () => {
    if (userInteractionResumeTimerRef.current) {
      clearTimeout(userInteractionResumeTimerRef.current);
    }
    userInteractionResumeTimerRef.current = setTimeout(() => {
      setIsUserInteracting(false);
      startAutoSlide();
    }, 3000);
  };

  const handleMomentumScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffset = event.nativeEvent.contentOffset.x;
    if (viewportWidth > 0) {
      const computedIndex = Math.round(contentOffset / viewportWidth);
      if (computedIndex >= 0 && computedIndex < displayItems.length) {
        setActiveIndex(computedIndex);
      }
    }
  };

  const handleDotPress = (index: number) => {
    setActiveIndex(index);
    if (flatListRef.current && viewportWidth > 0) {
      try {
        flatListRef.current.scrollToOffset({
          offset: index * viewportWidth,
          animated: true,
        });
      } catch {}
    }
  };

  // Open article link
  const openArticle = async (item: NewsItem) => {
    const targetUrl = item.sourceUrl;
    if (!targetUrl) {
      setLinkErrorToast(
        lang === "hi"
          ? "इस समाचार का मूल स्रोत लिंक उपलब्ध नहीं है।"
          : "Source link is not available for this article."
      );
      setTimeout(() => setLinkErrorToast(""), 3500);
      return;
    }

    try {
      const url = new URL(targetUrl);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error("Invalid protocol");
      const canOpen = await Linking.canOpenURL(url.toString());
      if (canOpen) {
        await Linking.openURL(url.toString());
      } else {
        await Linking.openURL(targetUrl);
      }
    } catch {
      setLinkErrorToast(
        lang === "hi"
          ? "मूल समाचार लेख खोलने में असमर्थ।"
          : "Unable to open the original news article."
      );
      setTimeout(() => setLinkErrorToast(""), 3500);
    }
  };

  return (
    <View style={[styles.container, style]} onLayout={handleContainerLayout}>
      {/* ── Header: Title, Language Selector & See All ── */}
      <View style={styles.headerRow}>
        <View style={styles.titleWithBadge}>
          <LinearGradient
            colors={["#7C3AED", "#6366F1"]}
            style={styles.headerIconBadge}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Ionicons name="newspaper-outline" size={14} color="#FFFFFF" />
          </LinearGradient>
          <Text style={styles.sectionTitle}>
            {lang === "hi" ? "नवोदय समाचार" : "JNV News"}
          </Text>
        </View>

        {/* See All Button */}
        <TouchableOpacity
          onPress={onSeeAllPress || (() => router.push("/(screens)/news" as any))}
          activeOpacity={0.7}
          style={styles.seeAllBtn}
          accessibilityRole="button"
          accessibilityLabel="See All News"
        >
          <Text style={styles.seeAllText}>{lang === "hi" ? "सभी देखें" : "See All"}</Text>
          <Ionicons name="chevron-forward" size={14} color="#7C3AED" />
        </TouchableOpacity>
      </View>

      {/* ── Language Switcher Strip ── */}
      <View style={styles.langSelectorRow}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleLangChange("en")}
          style={[styles.langPill, lang === "en" && styles.langPillActive]}
          accessibilityRole="button"
          accessibilityLabel="English News"
        >
          <Text style={[styles.langPillText, lang === "en" && styles.langPillTextActive]}>
            English
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => handleLangChange("hi")}
          style={[styles.langPill, lang === "hi" && styles.langPillActive]}
          accessibilityRole="button"
          accessibilityLabel="हिंदी समाचार"
        >
          <Text style={[styles.langPillText, lang === "hi" && styles.langPillTextActive]}>
            हिंदी
          </Text>
        </TouchableOpacity>

        <View style={{ flex: 1 }} />

        {loading && (
          <View style={styles.loadingIndicatorRow}>
            <ActivityIndicator size="small" color="#7C3AED" />
            <Text style={styles.loadingText}>
              {lang === "hi" ? "अपडेट हो रहा है..." : "Updating..."}
            </Text>
          </View>
        )}
      </View>

      {/* ── Toast message if link fails ── */}
      {!!linkErrorToast && (
        <View style={styles.toastContainer}>
          <Ionicons name="information-circle" size={15} color="#EF4444" />
          <Text style={styles.toastText}>{linkErrorToast}</Text>
        </View>
      )}

      {/* ── Main Carousel Content ── */}
      {loading && displayItems.length === 0 ? (
        <View style={[styles.skeletonCard, { width: cardWidth, height: CARD_HEIGHT }]}>
          <ActivityIndicator size="small" color="#7C3AED" />
          <Text style={styles.skeletonText}>
            {lang === "hi" ? "ताज़ा समाचार प्राप्त हो रहे हैं..." : "Fetching latest news..."}
          </Text>
        </View>
      ) : displayItems.length === 0 ? (
        <View style={[styles.emptyCard, { width: cardWidth, height: CARD_HEIGHT }]}>
          <Ionicons name="newspaper-outline" size={28} color="#94A3B8" />
          <Text style={styles.emptyTitle}>
            {lang === "hi" ? "फ़िलहाल कोई समाचार उपलब्ध नहीं है" : "No news articles right now"}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void fetchNews(lang)}
            activeOpacity={0.8}
          >
            <Ionicons name="refresh" size={13} color="#7C3AED" />
            <Text style={styles.retryText}>{lang === "hi" ? "पुनः प्रयास करें" : "Refresh"}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.carouselViewport}>
          <FlatList
            ref={flatListRef}
            data={displayItems}
            keyExtractor={(item) => item.id}
            horizontal
            pagingEnabled={true}
            showsHorizontalScrollIndicator={false}
            snapToInterval={viewportWidth}
            snapToAlignment="start"
            decelerationRate="fast"
            onScrollBeginDrag={handleScrollBeginDrag}
            onScrollEndDrag={handleScrollEndDrag}
            onMomentumScrollEnd={handleMomentumScrollEnd}
            getItemLayout={(_data, index) => ({
              length: viewportWidth,
              offset: viewportWidth * index,
              index,
            })}
            renderItem={({ item, index }) => {
              const palette = GRADIENT_PALETTES[index % GRADIENT_PALETTES.length];
              const relativeDate = formatDateOrRelative(item.publishedAt || item.createdAt, lang);
              const publisherName = cleanHtmlEntities(
                item.sourceName || item.authorName || (lang === "hi" ? "नवोदय समाचार" : "JNV News")
              );
              const categoryName = cleanHtmlEntities(item.category || (lang === "hi" ? "समाचार" : "News"));
              const cleanTitle = cleanHtmlEntities(item.title);
              const cleanDesc = cleanHtmlEntities(item.description || item.title);

              return (
                <View style={[styles.slideContainer, { width: viewportWidth }]}>
                  <TouchableOpacity
                    activeOpacity={0.92}
                    onPress={() => openArticle(item)}
                    style={[
                      styles.cardWrapper,
                      { width: cardWidth, height: CARD_HEIGHT },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`${cleanTitle}. Published by ${publisherName}`}
                  >
                    <LinearGradient
                      colors={palette}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.cardGradient}
                    >
                      {/* Top Row: Category Tag & Source/Date */}
                      <View style={styles.cardTopRow}>
                        <View style={styles.catBadge}>
                          <Ionicons name="bookmark" size={10} color="#FFFFFF" />
                          <Text style={styles.catBadgeText} numberOfLines={1}>
                            {categoryName}
                          </Text>
                        </View>

                        <View style={styles.metaRow}>
                          <Text style={styles.sourceText} numberOfLines={1}>
                            {publisherName}
                          </Text>
                          {!!relativeDate && (
                            <>
                              <Text style={styles.metaDot}>•</Text>
                              <Text style={styles.dateText}>{relativeDate}</Text>
                            </>
                          )}
                        </View>
                      </View>

                      {/* Middle: Headline */}
                      <Text style={styles.headlineText} numberOfLines={2}>
                        {cleanTitle}
                      </Text>

                      {/* Short Summary Description */}
                      <Text style={styles.summaryText} numberOfLines={2}>
                        {cleanDesc}
                      </Text>

                      {/* Bottom Row: Read Action & Indicator */}
                      <View style={styles.cardBottomRow}>
                        <View style={styles.readPromptRow}>
                          <Text style={styles.readPromptText}>
                            {lang === "hi" ? "पूरा पढ़ें" : "Read full article"}
                          </Text>
                          <Ionicons name="arrow-forward-circle" size={15} color="#FFFFFF" />
                        </View>

                        <View style={styles.slideCounterPill}>
                          <Text style={styles.slideCounterText}>
                            {index + 1}/{displayItems.length}
                          </Text>
                        </View>
                      </View>
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              );
            }}
          />

          {/* ── Pagination Dots Indicator ── */}
          {displayItems.length > 1 && (
            <View style={styles.paginationDotsContainer}>
              {displayItems.map((_, dotIdx) => {
                const isActive = dotIdx === activeIndex;
                return (
                  <TouchableOpacity
                    key={`dot-${dotIdx}`}
                    onPress={() => handleDotPress(dotIdx)}
                    hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}
                    style={[
                      styles.dotBase,
                      isActive ? styles.dotActive : styles.dotInactive,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Slide ${dotIdx + 1} of ${displayItems.length}`}
                  />
                );
              })}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 18,
    marginBottom: 4,
    width: "100%",
    maxWidth: "100%",
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: HORIZONTAL_MARGIN,
    marginBottom: 8,
    width: "100%",
  },
  titleWithBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBadge: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#7C3AED",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
      },
      android: { elevation: 2 },
      web: { boxShadow: "0 2px 6px rgba(124, 58, 237, 0.25)" },
    }),
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    letterSpacing: -0.2,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    backgroundColor: "#F5F3FF",
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#7C3AED",
  },
  langSelectorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: HORIZONTAL_MARGIN,
    marginBottom: 10,
    width: "100%",
  },
  langPill: {
    paddingVertical: 5,
    paddingHorizontal: 13,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  langPillActive: {
    backgroundColor: "#EDE9FE",
    borderColor: "#7C3AED",
  },
  langPillText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
  },
  langPillTextActive: {
    color: "#7C3AED",
    fontWeight: "700",
  },
  loadingIndicatorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  loadingText: {
    fontSize: 11,
    color: "#7C3AED",
    fontWeight: "500",
  },
  toastContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FEF2F2",
    borderColor: "#FECACA",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: HORIZONTAL_MARGIN,
    marginBottom: 8,
  },
  toastText: {
    fontSize: 12,
    color: "#B91C1C",
    flex: 1,
  },
  carouselViewport: {
    width: "100%",
    overflow: "hidden",
  },
  slideContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: HORIZONTAL_MARGIN,
    boxSizing: "border-box" as any,
  },
  cardWrapper: {
    borderRadius: 16,
    overflow: "hidden",
    maxWidth: "100%",
    minWidth: 0,
    ...Platform.select({
      ios: {
        shadowColor: "#6D28D9",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 8,
      },
      android: { elevation: 3 },
      web: { boxShadow: "0 4px 12px rgba(109, 40, 217, 0.18)" },
    }),
  },
  cardGradient: {
    flex: 1,
    padding: 14,
    justifyContent: "space-between",
    width: "100%",
    minWidth: 0,
    boxSizing: "border-box" as any,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    minWidth: 0,
    gap: 8,
  },
  catBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    flexShrink: 0,
  },
  catBadgeText: {
    fontSize: 10.5,
    fontWeight: "700",
    color: "#FFFFFF",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
    justifyContent: "flex-end",
  },
  sourceText: {
    fontSize: 11,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.9)",
    flexShrink: 1,
    maxWidth: 160,
  },
  metaDot: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 11,
    flexShrink: 0,
  },
  dateText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    flexShrink: 0,
  },
  headlineText: {
    fontSize: 14.5,
    fontWeight: "700",
    color: "#FFFFFF",
    lineHeight: 20,
    marginTop: 2,
    letterSpacing: -0.15,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  summaryText: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.85)",
    lineHeight: 16.5,
    marginTop: 2,
    width: "100%",
    maxWidth: "100%",
    minWidth: 0,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  cardBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
    width: "100%",
    minWidth: 0,
  },
  readPromptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexShrink: 0,
  },
  readPromptText: {
    fontSize: 11.5,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  slideCounterPill: {
    backgroundColor: "rgba(0, 0, 0, 0.2)",
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
    flexShrink: 0,
  },
  slideCounterText: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255, 255, 255, 0.85)",
  },
  paginationDotsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 2,
    width: "100%",
  },
  dotBase: {
    height: 6,
    borderRadius: 3,
  },
  dotActive: {
    width: 22,
    backgroundColor: "#7C3AED",
  },
  dotInactive: {
    width: 6,
    backgroundColor: "#DDD6FE",
  },
  skeletonCard: {
    alignSelf: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  skeletonText: {
    fontSize: 12,
    color: "#64748B",
  },
  emptyCard: {
    alignSelf: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  emptyTitle: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "500",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    backgroundColor: "#EDE9FE",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  retryText: {
    fontSize: 12,
    color: "#7C3AED",
    fontWeight: "600",
  },
});
