import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, type JnvRankingScoreItem } from "@/lib/api";
import { STATES } from "@/data/jnvData";
import { ThemedText as Text } from "@/components/ThemedNative";

export default function JnvRankingSection() {
  const [periodType, setPeriodType] = useState<"month" | "year">("month");
  const [period, setPeriod] = useState("2026-11");
  const [selectedState, setSelectedState] = useState("all");
  const [loading, setLoading] = useState(false);
  const [scores, setScores] = useState<JnvRankingScoreItem[]>([]);
  const [expandedJnv, setExpandedJnv] = useState<string | null>(null);

  const fetchJnvScores = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.ranking.jnv({
        periodType,
        period: periodType === "month" ? "2026-11" : "2026",
        state: selectedState !== "all" ? selectedState : undefined,
      });
      setScores(res.scores || []);
    } catch (e) {
      console.warn("Failed to load JNV rankings", e);
    } finally {
      setLoading(false);
    }
  }, [periodType, selectedState]);

  useEffect(() => {
    void fetchJnvScores();
  }, [fetchJnvScores]);

  const toggleExpand = (id: string) => {
    setExpandedJnv((prev) => (prev === id ? null : id));
  };

  return (
    <View style={styles.container}>
      {/* Methodology Summary Banner */}
      <View style={styles.infoBanner}>
        <Ionicons name="information-circle" size={18} color="#7C3AED" />
        <View style={{ flex: 1 }}>
          <Text style={styles.infoBannerTitle}>Two-Component Institutional Model</Text>
          <Text style={styles.infoBannerDesc}>
            90% Institutional Performance (Academic, Student Development, Wellbeing, Infrastructure, Alumni) + 10% Normalized Community Contribution.
          </Text>
        </View>
      </View>

      {/* Period Type Selector */}
      <View style={styles.periodRow}>
        <TouchableOpacity
          style={[styles.periodBtn, periodType === "month" && styles.periodBtnActive]}
          onPress={() => {
            setPeriodType("month");
            setPeriod("2026-11");
          }}
        >
          <Text style={[styles.periodBtnText, periodType === "month" && styles.periodBtnTextActive]}>
            November 2026 (Monthly)
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.periodBtn, periodType === "year" && styles.periodBtnActive]}
          onPress={() => {
            setPeriodType("year");
            setPeriod("2026");
          }}
        >
          <Text style={[styles.periodBtnText, periodType === "year" && styles.periodBtnTextActive]}>
            Year 2026 (Annual)
          </Text>
        </TouchableOpacity>
      </View>

      {/* State Filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stateScroll}>
        <TouchableOpacity
          style={[styles.stateChip, selectedState === "all" && styles.stateChipActive]}
          onPress={() => setSelectedState("all")}
        >
          <Text style={[styles.stateChipText, selectedState === "all" && styles.stateChipTextActive]}>
            All States
          </Text>
        </TouchableOpacity>
        {STATES.slice(0, 12).map((st) => (
          <TouchableOpacity
            key={st}
            style={[styles.stateChip, selectedState === st && styles.stateChipActive]}
            onPress={() => setSelectedState(st)}
          >
            <Text style={[styles.stateChipText, selectedState === st && styles.stateChipTextActive]}>
              {st}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#7C3AED" />
          <Text style={styles.loadingText}>Calculating institutional scores & participation...</Text>
        </View>
      ) : scores.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyEmoji}>🏫</Text>
          <Text style={styles.emptyTitle}>No verified JNV records found</Text>
          <Text style={styles.emptySub}>Adjust state filter or check back later.</Text>
        </View>
      ) : (
        <View style={styles.jnvList}>
          {scores.map((school) => {
            const isExpanded = expandedJnv === school.id;
            const medal = ["🥇", "🥈", "🥉"][school.rank - 1] || `#${school.rank}`;
            const isSufficient = school.dataCoverage === "sufficient";

            return (
              <View key={school.id} style={styles.schoolCard}>
                <TouchableOpacity
                  style={styles.schoolCardHeader}
                  onPress={() => toggleExpand(school.id)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.rankMedal}>{medal}</Text>

                  <View style={styles.schoolInfo}>
                    <Text style={styles.schoolName}>{school.jnvName}</Text>
                    <Text style={styles.schoolState}>{school.jnvState}</Text>

                    {/* Data Coverage Pill */}
                    <View style={styles.coverageRow}>
                      <View
                        style={[
                          styles.coveragePill,
                          {
                            backgroundColor: isSufficient ? "#ECFDF5" : "#FFFBEB",
                            borderColor: isSufficient ? "#A7F3D0" : "#FDE68A",
                          },
                        ]}
                      >
                        <View
                          style={[
                            styles.coverageDot,
                            { backgroundColor: isSufficient ? "#10B981" : "#F59E0B" },
                          ]}
                        />
                        <Text
                          style={[
                            styles.coverageText,
                            { color: isSufficient ? "#065F46" : "#B45309" },
                          ]}
                        >
                          {isSufficient ? "Verified Data Coverage" : "Insufficient Verified Data"}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.scoreBlock}>
                    <Text style={styles.scoreNumber}>{school.totalScore}</Text>
                    <Text style={styles.scoreOutOf}>/ 100 Index</Text>
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={16}
                      color="#94A3B8"
                      style={{ marginTop: 4 }}
                    />
                  </View>
                </TouchableOpacity>

                {/* Score Ratio Progress Bar */}
                <View style={styles.barWrap}>
                  <View style={styles.barLabelsRow}>
                    <Text style={styles.barLabelText}>
                      Inst. (90%): {school.institutionalScore}
                    </Text>
                    <Text style={styles.barLabelText}>
                      Comm. (10%): {school.communityScore}
                    </Text>
                  </View>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFillInst,
                        { width: `${Math.min(90, (school.institutionalScore / 100) * 90)}%` },
                      ]}
                    />
                    <View
                      style={[
                        styles.barFillComm,
                        { width: `${Math.min(10, (school.communityScore / 100) * 10)}%` },
                      ]}
                    />
                  </View>
                </View>

                {/* Expandable Category Breakdown */}
                {isExpanded && (
                  <View style={styles.breakdownBox}>
                    <Text style={styles.breakdownHeading}>Detailed Category Breakdown</Text>

                    <CategoryScoreRow
                      label="Academic Performance (30%)"
                      score={school.categoryBreakdown.academic}
                      color="#2563EB"
                    />
                    <CategoryScoreRow
                      label="Student Development (25%)"
                      score={school.categoryBreakdown.studentDevelopment}
                      color="#7C3AED"
                    />
                    <CategoryScoreRow
                      label="Student Wellbeing & Inclusion (20%)"
                      score={school.categoryBreakdown.wellbeing}
                      color="#059669"
                    />
                    <CategoryScoreRow
                      label="Infrastructure & Facilities (15%)"
                      score={school.categoryBreakdown.infrastructure}
                      color="#D97706"
                    />
                    <CategoryScoreRow
                      label="Alumni & Community Initiatives (10%)"
                      score={school.categoryBreakdown.alumni}
                      color="#DB2777"
                    />

                    <View style={styles.commStatsRow}>
                      <Ionicons name="people-outline" size={14} color="#64748B" />
                      <Text style={styles.commStatsText}>
                        {school.activeContributorsCount} active verified contributors from this JNV
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            );
          })}
        </View>
      )}

      {/* Independent Ranking Disclaimer */}
      <View style={styles.disclaimerCard}>
        <Ionicons name="shield-checkmark-outline" size={16} color="#64748B" />
        <Text style={styles.disclaimerText}>
          Independent Navodaya Connect ranking based on verified public and community contributions. Not an official NVS publication.
        </Text>
      </View>
    </View>
  );
}

function CategoryScoreRow({
  label,
  score,
  color,
}: {
  label: string;
  score: number;
  color: string;
}) {
  return (
    <View style={styles.catRow}>
      <Text style={styles.catLabel}>{label}</Text>
      <View style={styles.catRight}>
        <View style={styles.catBarTrack}>
          <View style={[styles.catBarFill, { width: `${score}%`, backgroundColor: color }]} />
        </View>
        <Text style={[styles.catScore, { color }]}>{score}/100</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  infoBanner: {
    flexDirection: "row",
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    borderRadius: 14,
    padding: 12,
    gap: 10,
    marginBottom: 12,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: "600",
    color: "#5B21B6",
  },
  infoBannerDesc: {
    fontSize: 11,
    color: "#6D28D9",
    lineHeight: 15,
    marginTop: 2,
  },
  periodRow: {
    flexDirection: "row",
    backgroundColor: "#EEF2F6",
    borderRadius: 12,
    padding: 4,
    gap: 6,
    marginBottom: 10,
  },
  periodBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  periodBtnActive: {
    backgroundColor: "#7C3AED",
  },
  periodBtnText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
  },
  periodBtnTextActive: {
    color: "#fff",
    fontWeight: "700",
  },
  stateScroll: {
    gap: 8,
    paddingBottom: 10,
  },
  stateChip: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  stateChipActive: {
    backgroundColor: "#EFF6FF",
    borderColor: "#3B82F6",
  },
  stateChipText: {
    fontSize: 11,
    color: "#64748B",
  },
  stateChipTextActive: {
    color: "#2563EB",
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
  emptyCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginVertical: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyEmoji: {
    fontSize: 34,
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
  },
  emptySub: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 4,
  },
  jnvList: {
    gap: 10,
  },
  schoolCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  schoolCardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  rankMedal: {
    fontSize: 22,
  },
  schoolInfo: {
    flex: 1,
  },
  schoolName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1E293B",
  },
  schoolState: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 1,
  },
  coverageRow: {
    marginTop: 6,
  },
  coveragePill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    borderWidth: 1,
    alignSelf: "flex-start",
    gap: 5,
  },
  coverageDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  coverageText: {
    fontSize: 10,
    fontWeight: "700",
  },
  scoreBlock: {
    alignItems: "flex-end",
  },
  scoreNumber: {
    fontSize: 18,
    fontWeight: "600",
    color: "#7C3AED",
  },
  scoreOutOf: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "600",
  },
  barWrap: {
    marginTop: 12,
  },
  barLabelsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  barLabelText: {
    fontSize: 10,
    color: "#64748B",
  },
  barTrack: {
    flexDirection: "row",
    height: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 4,
    overflow: "hidden",
  },
  barFillInst: {
    height: "100%",
    backgroundColor: "#7C3AED",
  },
  barFillComm: {
    height: "100%",
    backgroundColor: "#10B981",
  },
  breakdownBox: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
    gap: 8,
  },
  breakdownHeading: {
    fontSize: 12,
    fontWeight: "600",
    color: "#475569",
    marginBottom: 2,
  },
  catRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  catLabel: {
    fontSize: 11,
    color: "#334155",
    flex: 1,
  },
  catRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  catBarTrack: {
    width: 70,
    height: 6,
    backgroundColor: "#F1F5F9",
    borderRadius: 3,
    overflow: "hidden",
  },
  catBarFill: {
    height: "100%",
    borderRadius: 3,
  },
  catScore: {
    fontSize: 11,
    fontWeight: "600",
    width: 48,
    textAlign: "right",
  },
  commStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
  },
  commStatsText: {
    fontSize: 11,
    color: "#64748B",
    fontStyle: "italic",
  },
  disclaimerCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginVertical: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  disclaimerText: {
    fontSize: 11,
    color: "#64748B",
    lineHeight: 15,
    flex: 1,
  },
});
