import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { api, type RankingAwardItem } from "@/lib/api";

interface AwardsSectionProps {
  onSelectUser: (userId: string) => void;
}

export default function AwardsSection({ onSelectUser }: AwardsSectionProps) {
  const [subTab, setSubTab] = useState<"monthly" | "annual" | "history">("monthly");
  const [loading, setLoading] = useState(false);
  const [monthlyAwards, setMonthlyAwards] = useState<RankingAwardItem[]>([]);
  const [annualAwards, setAnnualAwards] = useState<RankingAwardItem[]>([]);

  useEffect(() => {
    async function fetchAwards() {
      try {
        setLoading(true);
        const res = await api.ranking.awards();
        setMonthlyAwards(res.monthlyAwards || []);
        setAnnualAwards(res.annualAwards || []);
      } catch (e) {
        console.warn("Failed to load awards", e);
      } finally {
        setLoading(false);
      }
    }
    void fetchAwards();
  }, []);

  const currentNavodayaMonth = monthlyAwards.find((a) => a.awardType === "navodaya_of_the_month");
  const currentNavodayanMonth = monthlyAwards.find((a) => a.awardType === "navodayan_of_the_month");

  const currentNavodayaYear = annualAwards.find((a) => a.awardType === "navodaya_of_the_year");
  const currentNavodayanYear = annualAwards.find((a) => a.awardType === "navodayan_of_the_year");

  return (
    <View style={styles.container}>
      {/* Sub-tab Navigation */}
      <View style={styles.subTabBar}>
        <TouchableOpacity
          style={[styles.subTabBtn, subTab === "monthly" && styles.subTabBtnActive]}
          onPress={() => setSubTab("monthly")}
        >
          <Text style={[styles.subTabText, subTab === "monthly" && styles.subTabTextActive]}>
            Monthly Awards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, subTab === "annual" && styles.subTabBtnActive]}
          onPress={() => setSubTab("annual")}
        >
          <Text style={[styles.subTabText, subTab === "annual" && styles.subTabTextActive]}>
            Annual Awards
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.subTabBtn, subTab === "history" && styles.subTabBtnActive]}
          onPress={() => setSubTab("history")}
        >
          <Text style={[styles.subTabText, subTab === "history" && styles.subTabTextActive]}>
            Award History
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Fetching official award records...</Text>
        </View>
      ) : (
        <>
          {/* MONTHLY AWARDS */}
          {subTab === "monthly" && (
            <View style={styles.cardsWrap}>
              {/* 1. NAVODAYA OF THE MONTH */}
              {currentNavodayaMonth ? (
                <View style={styles.awardCard}>
                  <LinearGradient colors={["#B45309", "#D97706", "#F59E0B"]} style={styles.cardHeaderGrad}>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>INSTITUTIONAL EXCELLENCE</Text>
                    </View>
                    <Text style={styles.awardName}>NAVODAYA OF THE MONTH</Text>
                    <Text style={styles.periodText}>Period: {currentNavodayaMonth.period}</Text>
                  </LinearGradient>

                  <View style={styles.awardBody}>
                    <View style={styles.winnerHeader}>
                      <Text style={styles.trophyEmoji}>🏆</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.winnerName}>{currentNavodayaMonth.winnerJnvName}</Text>
                        <Text style={styles.winnerState}>{currentNavodayaMonth.winnerJnvState}</Text>
                      </View>
                      <View style={styles.scorePill}>
                        <Text style={styles.scoreNum}>{currentNavodayaMonth.score}</Text>
                        <Text style={styles.scoreUnit}>/100</Text>
                      </View>
                    </View>

                    <Text style={styles.summaryText}>{currentNavodayaMonth.summary}</Text>

                    {currentNavodayaMonth.highlights && currentNavodayaMonth.highlights.length > 0 && (
                      <View style={styles.highlightsBox}>
                        <Text style={styles.highlightsTitle}>Monthly Key Achievements:</Text>
                        {currentNavodayaMonth.highlights.map((h, i) => (
                          <View key={i} style={styles.highlightRow}>
                            <Ionicons name="checkmark-circle" size={14} color="#10B981" />
                            <Text style={styles.highlightItem}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <EmptyAwardBox title="Navodaya of the Month" desc="Monthly JNV institutional award is under review." />
              )}

              {/* 2. NAVODAYAN OF THE MONTH */}
              {currentNavodayanMonth ? (
                <View style={styles.awardCard}>
                  <LinearGradient colors={["#581C87", "#7C3AED", "#9333EA"]} style={styles.cardHeaderGrad}>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>INDIVIDUAL COMMUNITY CHAMPION</Text>
                    </View>
                    <Text style={styles.awardName}>NAVODAYAN OF THE MONTH</Text>
                    <Text style={styles.periodText}>Period: {currentNavodayanMonth.period}</Text>
                  </LinearGradient>

                  <View style={styles.awardBody}>
                    <View style={styles.winnerHeader}>
                      <View style={styles.userAvatarWrap}>
                        {currentNavodayanMonth.winnerAvatarUrl ? (
                          <Image source={{ uri: currentNavodayanMonth.winnerAvatarUrl }} style={styles.avatarImg} />
                        ) : (
                          <View style={styles.avatarInitials}>
                            <Text style={styles.avatarText}>
                              {currentNavodayanMonth.winnerName.substring(0, 2).toUpperCase()}
                            </Text>
                          </View>
                        )}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.winnerName}>{currentNavodayanMonth.winnerName}</Text>
                        <Text style={styles.winnerState}>
                          {currentNavodayanMonth.winnerRole?.toUpperCase()} • {currentNavodayanMonth.winnerJnvName}
                        </Text>
                      </View>
                      <View style={[styles.scorePill, { backgroundColor: "#F5F3FF", borderColor: "#DDD6FE" }]}>
                        <Text style={[styles.scoreNum, { color: "#7C3AED" }]}>+{currentNavodayanMonth.score}</Text>
                        <Text style={[styles.scoreUnit, { color: "#7C3AED" }]}>pts</Text>
                      </View>
                    </View>

                    <Text style={styles.summaryText}>{currentNavodayanMonth.summary}</Text>

                    {currentNavodayanMonth.highlights && currentNavodayanMonth.highlights.length > 0 && (
                      <View style={styles.highlightsBox}>
                        <Text style={styles.highlightsTitle}>Verified Contributions:</Text>
                        {currentNavodayanMonth.highlights.map((h, i) => (
                          <View key={i} style={styles.highlightRow}>
                            <Ionicons name="sparkles" size={14} color="#7C3AED" />
                            <Text style={styles.highlightItem}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {currentNavodayanMonth.winnerUserId && (
                      <TouchableOpacity
                        style={styles.openProfileBtn}
                        onPress={() => onSelectUser(currentNavodayanMonth.winnerUserId!)}
                      >
                        <Text style={styles.openProfileText}>View Contributor Award Profile</Text>
                        <Ionicons name="arrow-forward" size={14} color="#7C3AED" />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              ) : (
                <EmptyAwardBox title="Navodayan of the Month" desc="Individual contribution award is under review." />
              )}
            </View>
          )}

          {/* ANNUAL AWARDS */}
          {subTab === "annual" && (
            <View style={styles.cardsWrap}>
              {/* NAVODAYA OF THE YEAR */}
              {currentNavodayaYear ? (
                <View style={styles.awardCard}>
                  <LinearGradient colors={["#78350F", "#B45309", "#D97706"]} style={styles.cardHeaderGrad}>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>ANNUAL INSTITUTIONAL SUPREME</Text>
                    </View>
                    <Text style={styles.awardName}>NAVODAYA OF THE YEAR</Text>
                    <Text style={styles.periodText}>Year {currentNavodayaYear.period}</Text>
                  </LinearGradient>

                  <View style={styles.awardBody}>
                    <View style={styles.winnerHeader}>
                      <Text style={styles.trophyEmoji}>🏆</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.winnerName}>{currentNavodayaYear.winnerJnvName}</Text>
                        <Text style={styles.winnerState}>{currentNavodayaYear.winnerJnvState}</Text>
                      </View>
                      <View style={styles.scorePill}>
                        <Text style={styles.scoreNum}>{currentNavodayaYear.score}</Text>
                        <Text style={styles.scoreUnit}>/100</Text>
                      </View>
                    </View>
                    <Text style={styles.summaryText}>{currentNavodayaYear.summary}</Text>

                    {currentNavodayaYear.highlights && (
                      <View style={styles.highlightsBox}>
                        <Text style={styles.highlightsTitle}>Yearly Highlights:</Text>
                        {currentNavodayaYear.highlights.map((h, i) => (
                          <View key={i} style={styles.highlightRow}>
                            <Ionicons name="ribbon" size={14} color="#D97706" />
                            <Text style={styles.highlightItem}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <EmptyAwardBox title="Navodaya of the Year" desc="Annual institutional evaluation is underway." />
              )}

              {/* NAVODAYAN OF THE YEAR */}
              {currentNavodayanYear ? (
                <View style={styles.awardCard}>
                  <LinearGradient colors={["#312E81", "#4338CA", "#6366F1"]} style={styles.cardHeaderGrad}>
                    <View style={styles.badgePill}>
                      <Text style={styles.badgePillText}>ANNUAL COMMUNITY LEGEND</Text>
                    </View>
                    <Text style={styles.awardName}>NAVODAYAN OF THE YEAR</Text>
                    <Text style={styles.periodText}>Year {currentNavodayanYear.period}</Text>
                  </LinearGradient>

                  <View style={styles.awardBody}>
                    <View style={styles.winnerHeader}>
                      <View style={styles.userAvatarWrap}>
                        <View style={[styles.avatarInitials, { backgroundColor: "#4338CA" }]}>
                          <Text style={styles.avatarText}>
                            {currentNavodayanYear.winnerName.substring(0, 2).toUpperCase()}
                          </Text>
                        </View>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.winnerName}>{currentNavodayanYear.winnerName}</Text>
                        <Text style={styles.winnerState}>
                          {currentNavodayanYear.winnerRole?.toUpperCase()} • {currentNavodayanYear.winnerJnvName}
                        </Text>
                      </View>
                      <View style={[styles.scorePill, { backgroundColor: "#EEF2FF", borderColor: "#C7D2FE" }]}>
                        <Text style={[styles.scoreNum, { color: "#4338CA" }]}>+{currentNavodayanYear.score}</Text>
                        <Text style={[styles.scoreUnit, { color: "#4338CA" }]}>pts</Text>
                      </View>
                    </View>
                    <Text style={styles.summaryText}>{currentNavodayanYear.summary}</Text>

                    {currentNavodayanYear.highlights && (
                      <View style={styles.highlightsBox}>
                        <Text style={styles.highlightsTitle}>Yearly Highlights:</Text>
                        {currentNavodayanYear.highlights.map((h, i) => (
                          <View key={i} style={styles.highlightRow}>
                            <Ionicons name="star" size={14} color="#4338CA" />
                            <Text style={styles.highlightItem}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              ) : (
                <EmptyAwardBox title="Navodayan of the Year" desc="Annual contributor calculation is underway." />
              )}
            </View>
          )}

          {/* AWARD HISTORY */}
          {subTab === "history" && (
            <View style={styles.historyWrap}>
              <Text style={styles.historyHeading}>Historical Verified Awards Archive</Text>
              {[...monthlyAwards, ...annualAwards].map((aw) => (
                <View key={aw.id} style={styles.historyCard}>
                  <View style={styles.historyTop}>
                    <View style={styles.historyBadgeWrap}>
                      <Text style={styles.historyEmoji}>
                        {aw.targetType === "jnv" ? "🏫" : "🌟"}
                      </Text>
                      <View>
                        <Text style={styles.historyType}>
                          {aw.awardType.replaceAll("_", " ").toUpperCase()}
                        </Text>
                        <Text style={styles.historyPeriod}>Period: {aw.period}</Text>
                      </View>
                    </View>
                    <View style={styles.historyScorePill}>
                      <Text style={styles.historyScoreText}>
                        {aw.targetType === "jnv" ? `${aw.score}/100` : `+${aw.score} pts`}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.historyWinnerName}>
                    {aw.winnerName} {aw.winnerJnvState ? `(${aw.winnerJnvState})` : ""}
                  </Text>
                  <Text style={styles.historySummary}>{aw.summary}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </View>
  );
}

function EmptyAwardBox({ title, desc }: { title: string; desc: string }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyEmoji}>🏅</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDesc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  subTabBar: {
    flexDirection: "row",
    backgroundColor: "#EEF2F6",
    borderRadius: 12,
    padding: 4,
    gap: 6,
    marginBottom: 16,
  },
  subTabBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  subTabBtnActive: {
    backgroundColor: "#7C3AED",
  },
  subTabText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  subTabTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  loadingBox: {
    paddingVertical: 36,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "#64748B",
  },
  cardsWrap: {
    gap: 16,
  },
  awardCard: {
    backgroundColor: "#fff",
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  cardHeaderGrad: {
    padding: 16,
  },
  badgePill: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  badgePillText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  awardName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#fff",
  },
  periodText: {
    fontSize: 11,
    color: "rgba(255, 255, 255, 0.8)",
    marginTop: 2,
  },
  awardBody: {
    padding: 16,
  },
  winnerHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 10,
  },
  trophyEmoji: {
    fontSize: 32,
  },
  userAvatarWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
  },
  avatarImg: {
    width: "100%",
    height: "100%",
  },
  avatarInitials: {
    width: "100%",
    height: "100%",
    backgroundColor: "#7C3AED",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
  },
  winnerName: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  winnerState: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  scorePill: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: "#FEFCE8",
    borderWidth: 1,
    borderColor: "#FEF08A",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 2,
  },
  scoreNum: {
    fontSize: 15,
    fontWeight: "900",
    color: "#854D0E",
  },
  scoreUnit: {
    fontSize: 10,
    fontWeight: "700",
    color: "#A16207",
  },
  summaryText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    marginBottom: 12,
  },
  highlightsBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  highlightsTitle: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 2,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  highlightItem: {
    fontSize: 11,
    color: "#475569",
    flex: 1,
  },
  openProfileBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    gap: 6,
  },
  openProfileText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#7C3AED",
  },
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyEmoji: {
    fontSize: 32,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  emptyDesc: {
    fontSize: 12,
    color: "#64748B",
    textAlign: "center",
    marginTop: 4,
  },
  historyWrap: {
    gap: 10,
  },
  historyHeading: {
    fontSize: 14,
    fontWeight: "800",
    color: "#1E293B",
    marginBottom: 4,
  },
  historyCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  historyTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  historyBadgeWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  historyEmoji: {
    fontSize: 20,
  },
  historyType: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7C3AED",
  },
  historyPeriod: {
    fontSize: 10,
    color: "#94A3B8",
  },
  historyScorePill: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  historyScoreText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#334155",
  },
  historyWinnerName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 2,
  },
  historySummary: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
});
