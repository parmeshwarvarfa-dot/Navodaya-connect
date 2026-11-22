import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { api, type RankingMethodologyData } from "@/lib/api";

export default function MethodologySection() {
  const [loading, setLoading] = useState(false);
  const [methodology, setMethodology] = useState<RankingMethodologyData | null>(null);

  useEffect(() => {
    async function loadMethodology() {
      try {
        setLoading(true);
        const res = await api.ranking.methodology();
        setMethodology(res);
      } catch (e) {
        console.warn("Failed to load methodology", e);
      } finally {
        setLoading(false);
      }
    }
    void loadMethodology();
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator size="large" color="#7C3AED" />
        <Text style={styles.loadingText}>Loading published ranking methodology...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Title Card */}
      <View style={styles.headerCard}>
        <View style={styles.versionBadge}>
          <Text style={styles.versionText}>OFFICIAL METHODOLOGY v2.0</Text>
        </View>
        <Text style={styles.mainTitle}>Transparent & Verified Ranking System</Text>
        <Text style={styles.mainSubtitle}>
          Navodaya Connect calculates rankings and awards through strict server-verified activity records and institutional indices.
        </Text>
      </View>

      {/* 1. Individual Contribution Points */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="person" size={18} color="#7C3AED" />
          <Text style={styles.sectionTitle}>1. Individual Contribution Scoring</Text>
        </View>
        <Text style={styles.sectionDesc}>
          Points are strictly awarded for genuine, verified activities. Passive engagement (likes, follows, app time) awards zero points.
        </Text>

        <View style={styles.activitiesTable}>
          {methodology?.individualScoring.activities.map((act) => (
            <View key={act.activity} style={styles.activityRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.actTitle}>{act.activity}</Text>
                <Text style={styles.actNote}>{act.note}</Text>
              </View>
              <View style={styles.actPtsPill}>
                <Text style={styles.actPtsText}>+{act.points} pts</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Badges Matrix */}
        <Text style={[styles.sectionSubtitle, { marginTop: 14 }]}>Achievement Badge Tiers</Text>
        <View style={styles.badgesGrid}>
          {methodology?.individualScoring.badges.map((b) => (
            <View key={b.badge} style={[styles.badgeCard, { borderLeftColor: b.color }]}>
              <Text style={styles.badgeName}>{b.badge}</Text>
              <Text style={[styles.badgeRange, { color: b.color }]}>{b.range}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.tieBreakText}>
          <Text style={{ fontWeight: "700" }}>Tie-Break Policy: </Text>
          {methodology?.individualScoring.tieBreakPolicy}
        </Text>
      </View>

      {/* 2. JNV Institutional Scoring (90% + 10%) */}
      <View style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="business" size={18} color="#2563EB" />
          <Text style={styles.sectionTitle}>2. JNV Institutional Index (90% + 10%)</Text>
        </View>
        <Text style={styles.sectionDesc}>
          JNVs are evaluated through a two-component model balancing school infrastructure and educational quality (90%) with community engagement (10%).
        </Text>

        <View style={styles.categoriesTable}>
          {methodology?.jnvInstitutionalScoring.categories.map((cat) => (
            <View key={cat.category} style={styles.categoryItem}>
              <View style={styles.catHeader}>
                <Text style={styles.catName}>{cat.category}</Text>
                <View style={styles.catWeightPill}>
                  <Text style={styles.catWeightText}>{cat.weight}</Text>
                </View>
              </View>
              <Text style={styles.catMetrics}>{cat.metrics}</Text>
            </View>
          ))}
        </View>

        {/* Normalization Policy */}
        <View style={styles.policyCallout}>
          <Ionicons name="shield-checkmark" size={16} color="#059669" />
          <View style={{ flex: 1 }}>
            <Text style={styles.policyTitle}>Fairness & Normalization Guarantee</Text>
            <Text style={styles.policyDesc}>
              {methodology?.jnvInstitutionalScoring.normalizationPolicy}
            </Text>
          </View>
        </View>

        {/* Data Coverage Policy */}
        <View style={[styles.policyCallout, { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" }]}>
          <Ionicons name="alert-circle" size={16} color="#D97706" />
          <View style={{ flex: 1 }}>
            <Text style={[styles.policyTitle, { color: "#92400E" }]}>Data Coverage Quality Standard</Text>
            <Text style={[styles.policyDesc, { color: "#B45309" }]}>
              {methodology?.jnvInstitutionalScoring.dataCoveragePolicy}
            </Text>
          </View>
        </View>
      </View>

      {/* Independent Notice */}
      <View style={styles.disclaimerBox}>
        <Ionicons name="information-circle-outline" size={16} color="#64748B" />
        <Text style={styles.disclaimerText}>
          {methodology?.jnvInstitutionalScoring.disclaimer}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 14,
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
  headerCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  versionBadge: {
    backgroundColor: "#F5F3FF",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  versionText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#7C3AED",
  },
  mainTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#0F172A",
  },
  mainSubtitle: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
    marginTop: 4,
  },
  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1E293B",
  },
  sectionDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
    marginBottom: 12,
  },
  activitiesTable: {
    gap: 8,
  },
  activityRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    gap: 12,
  },
  actTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  actNote: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 1,
  },
  actPtsPill: {
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#DDD6FE",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  actPtsText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#7C3AED",
  },
  sectionSubtitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#334155",
    marginBottom: 8,
  },
  badgesGrid: {
    gap: 6,
  },
  badgeCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderLeftWidth: 4,
  },
  badgeName: {
    fontSize: 12,
    fontWeight: "700",
    color: "#1E293B",
  },
  badgeRange: {
    fontSize: 11,
    fontWeight: "800",
  },
  tieBreakText: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 12,
    lineHeight: 16,
  },
  categoriesTable: {
    gap: 8,
    marginBottom: 12,
  },
  categoryItem: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  catHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  catName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  catWeightPill: {
    backgroundColor: "#EFF6FF",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  catWeightText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  catMetrics: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 4,
    lineHeight: 15,
  },
  policyCallout: {
    flexDirection: "row",
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 12,
    gap: 10,
    marginTop: 8,
  },
  policyTitle: {
    fontSize: 12,
    fontWeight: "800",
    color: "#065F46",
  },
  policyDesc: {
    fontSize: 11,
    color: "#047857",
    lineHeight: 16,
    marginTop: 2,
  },
  disclaimerBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 12,
    gap: 8,
    marginBottom: 16,
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
