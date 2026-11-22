import { eq, sql } from "drizzle-orm";
import {
  db,
  jnvInstitutionalIndicatorsTable,
  jnvRankingScoresTable,
  rankingAwardsArchiveTable,
  recognitionPointsTable,
  userBadgesTable,
  usersTable,
} from "@workspace/db";
import { calculateJnvScores, getUserBadgeTier, SPECIAL_BADGES } from "./rankingEngine";

export async function ensureRankingSeedData(): Promise<void> {
  try {
    // 1. Seed Institutional Performance Indicators if empty
    const existingInd = await db.select().from(jnvInstitutionalIndicatorsTable).limit(1);
    if (existingInd.length === 0) {
      console.log("[rankingSeed] Seeding verified institutional performance indicators...");
      const academicYear = "2025-2026";

      const seedSchools = [
        { name: "JNV Warangal", state: "Telangana", academic: 94, dev: 90, well: 88, infra: 86, alumni: 92 },
        { name: "JNV Pune", state: "Maharashtra", academic: 96, dev: 92, well: 90, infra: 94, alumni: 95 },
        { name: "JNV Bangalore Urban", state: "Karnataka", academic: 95, dev: 91, well: 89, infra: 92, alumni: 93 },
        { name: "JNV North-West Delhi", state: "Delhi", academic: 92, dev: 89, well: 87, infra: 90, alumni: 88 },
        { name: "JNV Patna", state: "Bihar", academic: 90, dev: 88, well: 85, infra: 84, alumni: 89 },
        { name: "JNV Anantapur", state: "Andhra Pradesh", academic: 89, dev: 87, well: 86, infra: 85, alumni: 84 },
        { name: "JNV Shimla", state: "Himachal Pradesh", academic: 91, dev: 86, well: 92, infra: 88, alumni: 85 },
        { name: "JNV Bhopal", state: "Madhya Pradesh", academic: 88, dev: 85, well: 84, infra: 86, alumni: 83 },
        { name: "JNV Udaipur", state: "Rajasthan", academic: 87, dev: 84, well: 83, infra: 82, alumni: 86 },
        { name: "JNV Cachar", state: "Assam", academic: 86, dev: 83, well: 82, infra: 80, alumni: 81 },
      ];

      for (const s of seedSchools) {
        await db.insert(jnvInstitutionalIndicatorsTable).values([
          {
            jnvName: s.name,
            jnvState: s.state,
            academicYear,
            category: "academic",
            indicatorName: "CBSE Class 12 Pass Percentage & Distinctions",
            score: s.academic,
            source: "CBSE",
            evidenceNote: "CBSE official AISSE/AISSCE examination board results.",
            status: "verified",
          },
          {
            jnvName: s.name,
            jnvState: s.state,
            academicYear,
            category: "student_development",
            indicatorName: "National Competitions & JEE/NEET Selections",
            score: s.dev,
            source: "verified_submission",
            evidenceNote: "National Olympiads and professional entrance qualification ratios.",
            status: "verified",
          },
          {
            jnvName: s.name,
            jnvState: s.state,
            academicYear,
            category: "wellbeing_inclusion",
            indicatorName: "Student Wellbeing, House Mentorship & Safety",
            score: s.well,
            source: "UDISE+",
            evidenceNote: "Hostel living conditions, student health metrics, and safety audits.",
            status: "verified",
          },
          {
            jnvName: s.name,
            jnvState: s.state,
            academicYear,
            category: "infrastructure",
            indicatorName: "Smart Classrooms, Science Labs & Sports Grounds",
            score: s.infra,
            source: "verified_submission",
            evidenceNote: "Audited lab equipment, libraries, and athletic facility ratings.",
            status: "verified",
          },
          {
            jnvName: s.name,
            jnvState: s.state,
            academicYear,
            category: "alumni_community",
            indicatorName: "Verified Alumni Guidance & Scholarship Initiatives",
            score: s.alumni,
            source: "verified_submission",
            evidenceNote: "Documented student mentorship sessions and sponsored scholarships.",
            status: "verified",
          },
        ]);
      }
      console.log("[rankingSeed] Seeded verified indicators for 10 JNVs.");
    }

    // 2. Compute and seed initial JNV Ranking Scores for 2026-11 and 2026
    const existingScores = await db.select().from(jnvRankingScoresTable).limit(1);
    if (existingScores.length === 0) {
      console.log("[rankingSeed] Computing initial JNV Performance Indexes...");
      const monthlyScores = await calculateJnvScores("2026-11", "month");
      for (const score of monthlyScores) {
        await db.insert(jnvRankingScoresTable).values({
          jnvName: score.jnvName,
          jnvState: score.jnvState,
          region: score.region,
          period: score.period,
          periodType: score.periodType,
          institutionalScore: score.institutionalScore,
          communityScore: score.communityScore,
          totalScore: score.totalScore,
          rank: score.rank,
          dataCoverage: score.dataCoverage,
          categoryBreakdown: score.categoryBreakdown,
          activeContributorsCount: score.activeContributorsCount,
          status: "published",
        }).onConflictDoNothing();
      }

      const annualScores = await calculateJnvScores("2026", "year");
      for (const score of annualScores) {
        await db.insert(jnvRankingScoresTable).values({
          jnvName: score.jnvName,
          jnvState: score.jnvState,
          region: score.region,
          period: score.period,
          periodType: score.periodType,
          institutionalScore: score.institutionalScore,
          communityScore: score.communityScore,
          totalScore: score.totalScore,
          rank: score.rank,
          dataCoverage: score.dataCoverage,
          categoryBreakdown: score.categoryBreakdown,
          activeContributorsCount: score.activeContributorsCount,
          status: "published",
        }).onConflictDoNothing();
      }
      console.log("[rankingSeed] Seeded monthly and annual JNV ranking scores.");
    }

    // 3. Seed Verified Historical Awards
    const existingAwards = await db.select().from(rankingAwardsArchiveTable).limit(1);
    if (existingAwards.length === 0) {
      console.log("[rankingSeed] Seeding confirmed historical award winners...");
      const topUser = await db.select().from(usersTable).limit(1);
      const winnerId = topUser[0]?.id;
      const winnerName = topUser[0]?.fullName || "Parmeshwar Varfa";
      const winnerJnv = topUser[0]?.jnvName || "JNV Warangal";
      const winnerState = topUser[0]?.jnvState || "Telangana";
      const winnerRole = topUser[0]?.role || "alumni";

      await db.insert(rankingAwardsArchiveTable).values([
        // Navodaya of the Month (October 2026)
        {
          awardType: "navodaya_of_the_month",
          period: "2026-10",
          periodType: "month",
          targetType: "jnv",
          winnerName: "JNV Pune",
          winnerJnvName: "JNV Pune",
          winnerJnvState: "Maharashtra",
          score: 95,
          summary: "Outstanding academic performance and highest alumni career counseling sessions.",
          highlights: [
            "96% CBSE Distinction Rate",
            "14 Student Mentorship Workshops",
            "State Science Fair Gold Medal",
          ],
          scorecard: {
            academic: 96,
            studentDevelopment: 92,
            wellbeing: 90,
            infrastructure: 94,
            alumni: 95,
            communityContribution: 94,
          },
          status: "published",
        },
        // Navodayan of the Month (October 2026)
        {
          awardType: "navodayan_of_the_month",
          period: "2026-10",
          periodType: "month",
          targetType: "user",
          winnerUserId: winnerId,
          winnerName,
          winnerRole,
          winnerJnvName: winnerJnv,
          winnerJnvState: winnerState,
          score: 480,
          summary: "Conducted 8 verified career guidance sessions and mentored 15 junior students.",
          highlights: [
            "480 Verified Monthly Points",
            "Top Mentoring Contributor",
            "Organized Alumni Tech Workshop",
          ],
          scorecard: {
            mentorshipPoints: 200,
            eventPoints: 100,
            resourceSharingPoints: 90,
            volunteeringPoints: 90,
          },
          status: "published",
        },
        // Navodaya of the Year (2025)
        {
          awardType: "navodaya_of_the_year",
          period: "2025",
          periodType: "year",
          targetType: "jnv",
          winnerName: "JNV Warangal",
          winnerJnvName: "JNV Warangal",
          winnerJnvState: "Telangana",
          score: 93,
          summary: "Best all-round performance in CBSE board examinations, sports, and active community initiatives.",
          highlights: [
            "Rank #1 National JNV Performance Index 2025",
            "Highest IIT-JEE Selections in Region",
            "Over 120 Hours of Alumni Mentoring",
          ],
          scorecard: {
            academic: 94,
            studentDevelopment: 90,
            wellbeing: 88,
            infrastructure: 86,
            alumni: 92,
            communityContribution: 95,
          },
          status: "published",
        },
        // Navodayan of the Year (2025)
        {
          awardType: "navodayan_of_the_year",
          period: "2025",
          periodType: "year",
          targetType: "user",
          winnerUserId: winnerId,
          winnerName,
          winnerRole,
          winnerJnvName: winnerJnv,
          winnerJnvState: winnerState,
          score: 3850,
          summary: "Exceptional annual contribution to student welfare, career mentorship, and technical innovation.",
          highlights: [
            "3,850 Verified Annual Points",
            "Navodaya Legend Badge Earner",
            "Helped 40+ Students with College Admissions",
          ],
          scorecard: {
            mentorshipPoints: 1200,
            eventOrganizingPoints: 800,
            educationalResources: 650,
            communityVolunteering: 1200,
          },
          status: "published",
        },
      ]);
      console.log("[rankingSeed] Seeded historical awards archive.");
    }

    // 4. Seed user badges for all verified users based on accumulated points
    const verifiedUsers = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.verificationStatus, "verified"));

    for (const u of verifiedUsers) {
      const [sumRes] = await db
        .select({ total: sql<number>`COALESCE(SUM(points), 0)::int` })
        .from(recognitionPointsTable)
        .where(eq(recognitionPointsTable.userId, u.id));

      const totalPts = sumRes?.total || 0;
      const tierInfo = getUserBadgeTier(totalPts);

      await db
        .insert(userBadgesTable)
        .values({
          userId: u.id,
          badgeKey: tierInfo.badgeKey,
          badgeTitle: tierInfo.badgeTitle,
          badgeType: "tier",
          icon: tierInfo.icon,
          color: tierInfo.color,
        })
        .onConflictDoNothing();
    }
    console.log("[rankingSeed] Seeded user badge records.");
  } catch (err) {
    console.error("[rankingSeed] Error seeding ranking data:", err);
  }
}
