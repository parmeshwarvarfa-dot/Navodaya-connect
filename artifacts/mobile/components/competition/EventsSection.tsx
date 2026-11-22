import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { OFFICIAL_HOUSES, type HouseName, normalizeHouseName } from "@/constants/HouseTheme";
import { api } from "@/lib/api";

export default function EventsSection() {
  const [loading, setLoading] = useState(false);
  const [tournaments, setTournaments] = useState<any[]>([]);

  useEffect(() => {
    async function loadEvents() {
      try {
        setLoading(true);
        const res = await api.competition.events();
        setTournaments(res.tournaments || []);
      } catch (err) {
        console.warn("Failed to load events", err);
      } finally {
        setLoading(false);
      }
    }
    void loadEvents();
  }, []);

  const activeTournament = tournaments[0] || {
    name: "Annual Inter House Championship 2026",
    season: "Season 2026-Q4",
    status: "active",
  };

  return (
    <View style={styles.container}>
      {/* Season Banner */}
      <LinearGradient colors={["#1E1B4B", "#312E81", "#4338CA"]} style={styles.seasonBanner}>
        <View style={styles.badgeRow}>
          <View style={styles.activePill}>
            <View style={styles.activeDot} />
            <Text style={styles.activeText}>OFFICIAL TOURNAMENT</Text>
          </View>
          <Text style={styles.seasonTag}>{activeTournament.season || "Season 2026-Q4"}</Text>
        </View>

        <Text style={styles.seasonTitle}>{activeTournament.name}</Text>
        <Text style={styles.seasonDesc}>
          Quarterly high-stakes championship between Aravali, Nilgiri, Shiwalik, and Udaygiri.
          All points contribute directly to the House Trophy.
        </Text>

        <View style={styles.bannerStatsRow}>
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatNum}>4</Text>
            <Text style={styles.bannerStatLabel}>Houses Competing</Text>
          </View>
          <View style={styles.bannerDivider} />
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatNum}>1,000</Text>
            <Text style={styles.bannerStatLabel}>Trophy Points</Text>
          </View>
          <View style={styles.bannerDivider} />
          <View style={styles.bannerStat}>
            <Text style={styles.bannerStatNum}>DEC 2026</Text>
            <Text style={styles.bannerStatLabel}>Grand Finale</Text>
          </View>
        </View>
      </LinearGradient>

      {/* Tournament Stage & Matchups */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="git-network" size={20} color="#7C3AED" />
          <Text style={styles.sectionHeading}>Tournament Bracket</Text>
        </View>
        <Text style={styles.sectionSub}>Current knockout stage pairings and standings</Text>

        {/* Semi Final 1 */}
        <View style={styles.matchCard}>
          <View style={styles.matchHeader}>
            <Text style={styles.matchStage}>SEMI-FINAL 1 · LIVE MATCHUP</Text>
            <View style={styles.ptsRewardBadge}>
              <Text style={styles.ptsRewardText}>+200 pts</Text>
            </View>
          </View>

          <View style={styles.matchTeamsRow}>
            {/* Team 1 */}
            <View style={styles.teamSide}>
              <View style={[styles.teamDot, { backgroundColor: OFFICIAL_HOUSES.Aravali.color }]} />
              <Text style={styles.teamEmoji}>{OFFICIAL_HOUSES.Aravali.emoji}</Text>
              <Text style={styles.teamName}>Aravali</Text>
              <Text style={styles.teamScore}>3 Wins</Text>
            </View>

            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Team 2 */}
            <View style={styles.teamSide}>
              <View style={[styles.teamDot, { backgroundColor: OFFICIAL_HOUSES.Nilgiri.color }]} />
              <Text style={styles.teamEmoji}>{OFFICIAL_HOUSES.Nilgiri.emoji}</Text>
              <Text style={styles.teamName}>Nilgiri</Text>
              <Text style={styles.teamScore}>2 Wins</Text>
            </View>
          </View>
        </View>

        {/* Semi Final 2 */}
        <View style={styles.matchCard}>
          <View style={styles.matchHeader}>
            <Text style={styles.matchStage}>SEMI-FINAL 2 · SCHEDULED</Text>
            <View style={styles.ptsRewardBadge}>
              <Text style={styles.ptsRewardText}>+200 pts</Text>
            </View>
          </View>

          <View style={styles.matchTeamsRow}>
            {/* Team 1 */}
            <View style={styles.teamSide}>
              <View style={[styles.teamDot, { backgroundColor: OFFICIAL_HOUSES.Shiwalik.color }]} />
              <Text style={styles.teamEmoji}>{OFFICIAL_HOUSES.Shiwalik.emoji}</Text>
              <Text style={styles.teamName}>Shiwalik</Text>
              <Text style={styles.teamScore}>2 Wins</Text>
            </View>

            <View style={styles.vsBadge}>
              <Text style={styles.vsText}>VS</Text>
            </View>

            {/* Team 2 */}
            <View style={styles.teamSide}>
              <View style={[styles.teamDot, { backgroundColor: OFFICIAL_HOUSES.Udaygiri.color }]} />
              <Text style={styles.teamEmoji}>{OFFICIAL_HOUSES.Udaygiri.emoji}</Text>
              <Text style={styles.teamName}>Udaygiri</Text>
              <Text style={styles.teamScore}>1 Win</Text>
            </View>
          </View>
        </View>

        {/* Championship Final */}
        <View style={[styles.matchCard, styles.finalMatchCard]}>
          <View style={styles.matchHeader}>
            <View style={styles.finalTitleWrap}>
              <Text style={styles.finalTrophy}>🏆</Text>
              <Text style={styles.finalStage}>GRAND CHAMPIONSHIP FINAL</Text>
            </View>
            <View style={[styles.ptsRewardBadge, { backgroundColor: "#FBBF2420", borderColor: "#FBBF24" }]}>
              <Text style={[styles.ptsRewardText, { color: "#B45309" }]}>+500 Trophy pts</Text>
            </View>
          </View>
          <Text style={styles.finalDesc}>
            Winner of Semi-Final 1 meets Winner of Semi-Final 2 in the ultimate 5-round showdown.
          </Text>
        </View>
      </View>

      {/* Official Rules & Scoring Matrix */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="document-text" size={20} color="#7C3AED" />
          <Text style={styles.sectionHeading}>Official Competition Rules</Text>
        </View>
        <Text style={styles.sectionSub}>All points are cryptographically validated by the server ledger</Text>

        <View style={styles.rulesCard}>
          <RuleRow
            icon="flash"
            iconColor="#7C3AED"
            title="Battle Arena Victories"
            desc="1v1 Battle Win gives +100 pts. Team Battle Win gives +150 pts. Draw gives +50 pts."
          />
          <RuleRow
            icon="bulb"
            iconColor="#10B981"
            title="Daily Brain Puzzles"
            desc="Official daily attempt awards 20–50 verified points. Only 1 official attempt per day; unlimited practice."
          />
          <RuleRow
            icon="flame"
            iconColor="#F59E0B"
            title="Daily Streaks"
            desc="Completing puzzles on consecutive days earns a streak bonus multiplier."
          />
          <RuleRow
            icon="shield-checkmark"
            iconColor="#2563EB"
            title="Zero Trust Server Ledger"
            desc="Scores cannot be forged or sent from the client. Every score event requires an immutable ledger entry."
          />
        </View>
      </View>

      {/* Hall of Fame */}
      <View style={styles.sectionBlock}>
        <View style={styles.sectionHeaderRow}>
          <Ionicons name="ribbon" size={20} color="#F59E0B" />
          <Text style={styles.sectionHeading}>House Hall of Fame</Text>
        </View>
        <Text style={styles.sectionSub}>Previous season champions etched in Navodaya history</Text>

        <View style={styles.hallCard}>
          <View style={styles.hallItem}>
            <Text style={styles.hallYear}>2025</Text>
            <View style={styles.hallHouse}>
              <Text style={styles.hallMedal}>🥇</Text>
              <Text style={styles.hallName}>Aravali House</Text>
            </View>
            <Text style={styles.hallPts}>12,450 pts</Text>
          </View>
          <View style={styles.hallDivider} />
          <View style={styles.hallItem}>
            <Text style={styles.hallYear}>2024</Text>
            <View style={styles.hallHouse}>
              <Text style={styles.hallMedal}>🥇</Text>
              <Text style={styles.hallName}>Shiwalik House</Text>
            </View>
            <Text style={styles.hallPts}>11,920 pts</Text>
          </View>
          <View style={styles.hallDivider} />
          <View style={styles.hallItem}>
            <Text style={styles.hallYear}>2023</Text>
            <View style={styles.hallHouse}>
              <Text style={styles.hallMedal}>🥇</Text>
              <Text style={styles.hallName}>Nilgiri House</Text>
            </View>
            <Text style={styles.hallPts}>11,300 pts</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function RuleRow({
  icon,
  iconColor,
  title,
  desc,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.ruleRow}>
      <View style={[styles.ruleIconWrap, { backgroundColor: `${iconColor}15` }]}>
        <Ionicons name={icon} size={18} color={iconColor} />
      </View>
      <View style={styles.ruleInfo}>
        <Text style={styles.ruleTitle}>{title}</Text>
        <Text style={styles.ruleDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  seasonBanner: {
    borderRadius: 18,
    padding: 16,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  activePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#10B981",
  },
  activeText: {
    fontSize: 10,
    fontWeight: "800",
    color: "#10B981",
    letterSpacing: 0.5,
  },
  seasonTag: {
    fontSize: 11,
    color: "#C7D2FE",
    fontWeight: "700",
  },
  seasonTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#fff",
    marginBottom: 6,
  },
  seasonDesc: {
    fontSize: 12,
    color: "#E2E8F0",
    lineHeight: 18,
    marginBottom: 16,
  },
  bannerStatsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingVertical: 10,
  },
  bannerStat: {
    alignItems: "center",
  },
  bannerStatNum: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FBBF24",
  },
  bannerStatLabel: {
    fontSize: 10,
    color: "#C7D2FE",
    marginTop: 2,
  },
  bannerDivider: {
    width: 1,
    height: 24,
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  sectionBlock: {
    marginBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1E293B",
  },
  sectionSub: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 12,
  },
  matchCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  finalMatchCard: {
    borderColor: "#FBBF24",
    backgroundColor: "#FEFCE850",
    borderWidth: 1.5,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  matchStage: {
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
    letterSpacing: 0.5,
  },
  ptsRewardBadge: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  ptsRewardText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2563EB",
  },
  matchTeamsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  teamSide: {
    flex: 1,
    alignItems: "center",
  },
  teamDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginBottom: 4,
  },
  teamEmoji: {
    fontSize: 22,
    marginBottom: 2,
  },
  teamName: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  teamScore: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },
  vsBadge: {
    backgroundColor: "#F1F5F9",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  vsText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#475569",
  },
  finalTitleWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  finalTrophy: {
    fontSize: 16,
  },
  finalStage: {
    fontSize: 11,
    fontWeight: "900",
    color: "#B45309",
    letterSpacing: 0.5,
  },
  finalDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
  },
  rulesCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 12,
  },
  ruleRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  ruleIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ruleInfo: {
    flex: 1,
  },
  ruleTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1E293B",
  },
  ruleDesc: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 16,
    marginTop: 2,
  },
  hallCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  hallItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  hallYear: {
    fontSize: 13,
    fontWeight: "800",
    color: "#64748B",
    width: 45,
  },
  hallHouse: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flex: 1,
  },
  hallMedal: {
    fontSize: 18,
  },
  hallName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
  },
  hallPts: {
    fontSize: 13,
    fontWeight: "800",
    color: "#7C3AED",
  },
  hallDivider: {
    height: 1,
    backgroundColor: "#F1F5F9",
  },
});
