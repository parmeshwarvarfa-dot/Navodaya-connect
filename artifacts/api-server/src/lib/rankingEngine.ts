import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import {
  db,
  jnvInstitutionalIndicatorsTable,
  jnvRankingScoresTable,
  userBadgesTable,
  rankingAwardsArchiveTable,
  rankingAuditTable,
  recognitionPointsTable,
  recognitionRulesTable,
  usersTable,
} from "@workspace/db";

// ── 1. INDIVIDUAL BADGE CONFIGURATION ──────────────────────────────────────
export interface BadgeTier {
  key: string;
  title: string;
  minPoints: number;
  maxPoints: number;
  icon: string;
  color: string;
}

export const BADGE_TIERS: BadgeTier[] = [
  { key: "new_navodayan", title: "New Navodayan", minPoints: 0, maxPoints: 499, icon: "shield-outline", color: "#64748B" },
  { key: "active_contributor", title: "Active Contributor", minPoints: 500, maxPoints: 1499, icon: "ribbon-outline", color: "#2563EB" },
  { key: "community_champion", title: "Community Champion", minPoints: 1500, maxPoints: 3499, icon: "star-outline", color: "#7C3AED" },
  { key: "navodaya_legend", title: "Navodaya Legend", minPoints: 3500, maxPoints: 999999, icon: "trophy-outline", color: "#EAB308" },
];

export const SPECIAL_BADGES = [
  { key: "mentor_of_the_month", title: "Mentor of the Month", icon: "school-outline", color: "#059669", desc: "Top verified student mentorship impact" },
  { key: "event_star", title: "Event Star", icon: "sparkles-outline", color: "#D97706", desc: "Organized or led approved community events" },
  { key: "knowledge_sharer", title: "Knowledge Sharer", icon: "book-outline", color: "#7C3AED", desc: "Published high-value educational materials" },
  { key: "alumni_guide", title: "Alumni Guide", icon: "compass-outline", color: "#0284C7", desc: "Dedicated career and college admissions counseling" },
  { key: "community_volunteer", title: "Community Volunteer", icon: "heart-outline", color: "#DC2626", desc: "Selfless local school and community volunteering" },
  { key: "sports_champion", title: "Sports Champion", icon: "football-outline", color: "#EA580C", desc: "Outstanding sports achievements and coaching" },
  { key: "rising_contributor", title: "Rising Contributor", icon: "trending-up-outline", color: "#10B981", desc: "Highest contribution point surge this month" },
  { key: "outstanding_educator", title: "Outstanding Educator", icon: "medal-outline", color: "#4F46E5", desc: "Excellence in teaching and student mentorship" },
  { key: "community_leadership", title: "Community Leadership Award", icon: "diamond-outline", color: "#9333EA", desc: "Distinguished leadership in JNV alumni networks" },
];

export function getUserBadgeTier(points: number): {
  badgeKey: string;
  badgeTitle: string;
  icon: string;
  color: string;
  currentPoints: number;
  nextTierPoints: number;
  progressPercent: number;
} {
  const pts = Math.max(0, points);
  const tier = BADGE_TIERS.find((t) => pts >= t.minPoints && pts <= t.maxPoints) || BADGE_TIERS[0];
  const nextTier = BADGE_TIERS[BADGE_TIERS.indexOf(tier) + 1] || null;

  let progressPercent = 100;
  let nextTierPoints = tier.maxPoints + 1;

  if (nextTier) {
    const range = nextTier.minPoints - tier.minPoints;
    const progress = pts - tier.minPoints;
    progressPercent = Math.min(100, Math.max(0, Math.round((progress / range) * 100)));
    nextTierPoints = nextTier.minPoints;
  }

  return {
    badgeKey: tier.key,
    badgeTitle: tier.title,
    icon: tier.icon,
    color: tier.color,
    currentPoints: pts,
    nextTierPoints,
    progressPercent,
  };
}

// ── 2. JNV INSTITUTIONAL INDEX CALCULATION (90% + 10%) ─────────────────────
// Weights:
// Institutional (90%): Academic (30%), Student Dev (25%), Wellbeing (20%), Infrastructure (15%), Alumni Initiatives (10%)
// Community Contribution (10%): Normalized active contributors ratio
export async function calculateJnvScores(period: string, periodType: "month" | "year" = "month") {
  // 1. Fetch verified indicators
  const indicators = await db
    .select()
    .from(jnvInstitutionalIndicatorsTable)
    .where(eq(jnvInstitutionalIndicatorsTable.status, "verified"));

  // Group by school
  const schoolIndicatorsMap = new Map<string, typeof indicators>();
  for (const ind of indicators) {
    const list = schoolIndicatorsMap.get(ind.jnvName) || [];
    list.push(ind);
    schoolIndicatorsMap.set(ind.jnvName, list);
  }

  // 2. Fetch community contributions for the period
  // We count unique active contributors and points from this period
  const isYear = periodType === "year";
  const start = isYear ? `${period}-01` : period;
  const end = isYear ? `${Number(period) + 1}-01` : getNextPeriodMonth(period);

  const communityStats = await db.execute(sql`
    SELECT u.jnv_name AS "jnvName", u.jnv_state AS "jnvState",
      COUNT(DISTINCT p.user_id)::int AS "activeContributors",
      COALESCE(SUM(p.points), 0)::int AS "periodPoints",
      COUNT(DISTINCT u.id)::int AS "totalRegistered"
    FROM users u
    LEFT JOIN recognition_points p ON p.user_id = u.id
      AND p.period_month >= ${start} AND p.period_month < ${end}
    WHERE u.verification_status = 'verified' AND u.jnv_name IS NOT NULL
    GROUP BY u.jnv_name, u.jnv_state
  `);

  const communityMap = new Map<string, any>();
  const commRows = (communityStats as any).rows || (communityStats as any) || [];
  for (const row of commRows) {
    if (row.jnvName) communityMap.set(row.jnvName, row);
  }

  // 3. Score each school
  const results: any[] = [];

  for (const [schoolName, indList] of schoolIndicatorsMap.entries()) {
    const schoolState = indList[0]?.jnvState || "India";
    const comm = communityMap.get(schoolName);

    // Categories
    const catScores: Record<string, number[]> = {
      academic: [],
      student_development: [],
      wellbeing_inclusion: [],
      infrastructure: [],
      alumni_community: [],
    };

    for (const ind of indList) {
      if (catScores[ind.category]) {
        catScores[ind.category].push(ind.score);
      }
    }

    const avg = (arr: number[]) => (arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 70);

    const academicAvg = avg(catScores.academic);
    const studentDevAvg = avg(catScores.student_development);
    const wellbeingAvg = avg(catScores.wellbeing_inclusion);
    const infraAvg = avg(catScores.infrastructure);
    const alumniAvg = avg(catScores.alumni_community);

    // Weighted Institutional Score (out of 100):
    // 30% Academic + 25% Student Dev + 20% Wellbeing + 15% Infra + 10% Alumni
    const institutionalScore = Math.round(
      academicAvg * 0.30 +
      studentDevAvg * 0.25 +
      wellbeingAvg * 0.20 +
      infraAvg * 0.15 +
      alumniAvg * 0.10
    );

    // Normalized Community Contribution (out of 100):
    // Active contributor ratio + quality score, bounded so school size doesn't dominate
    const activeContributors = comm?.activeContributors || 0;
    const totalReg = Math.max(1, comm?.totalRegistered || 1);
    const participationRate = Math.min(1, activeContributors / totalReg);
    // Base 60 + up to 40 points for active verified engagement
    const communityScore = Math.round(60 + participationRate * 40);

    // Final JNV Performance Index: 90% Institutional + 10% Community Contribution
    const totalScore = Math.round(institutionalScore * 0.90 + communityScore * 0.10);

    // Coverage check: Needs at least 3 categories with verified data
    const categoriesWithData = Object.values(catScores).filter((arr) => arr.length > 0).length;
    const dataCoverage = categoriesWithData >= 3 ? "sufficient" : "insufficient_data";

    results.push({
      jnvName: schoolName,
      jnvState: schoolState,
      region: "NVS Regional Office",
      period,
      periodType,
      institutionalScore,
      communityScore,
      totalScore,
      dataCoverage,
      categoryBreakdown: {
        academic: Math.round(academicAvg),
        studentDevelopment: Math.round(studentDevAvg),
        wellbeing: Math.round(wellbeingAvg),
        infrastructure: Math.round(infraAvg),
        alumni: Math.round(alumniAvg),
        communityContribution: communityScore,
      },
      activeContributorsCount: activeContributors,
    });
  }

  // Sort and assign rank (only schools with sufficient data get ranked at top)
  results.sort((a, b) => {
    if (a.dataCoverage !== b.dataCoverage) {
      return a.dataCoverage === "sufficient" ? -1 : 1;
    }
    return b.totalScore - a.totalScore;
  });

  results.forEach((item, idx) => {
    item.rank = idx + 1;
  });

  return results;
}

function getNextPeriodMonth(period: string) {
  const [year, month] = period.split("-").map(Number);
  return month === 12 ? `${year + 1}-01` : `${year}-${String(month + 1).padStart(2, "0")}`;
}
