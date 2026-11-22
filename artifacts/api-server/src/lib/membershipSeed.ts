import { db, alumniMembershipPlansTable } from "@workspace/db";

export async function ensureMembershipPlansSeed(): Promise<void> {
  try {
    const existing = await db.select().from(alumniMembershipPlansTable).limit(1);
    if (existing.length > 0) return;

    await db.insert(alumniMembershipPlansTable).values([
      {
        slug: "alumni-monthly",
        name: "Alumni Premium (Monthly)",
        billingCycle: "monthly",
        durationMonths: 1,
        pricePaise: 19900, // ₹199 / month
        originalPricePaise: 29900,
        features: [
          "✦ Navodaya Premium Golden Badge & Frame",
          "Exclusive Diagonal Identity Profile View",
          "Real Profile Insights (Visits, Reach, Likes, Shares)",
          "Featured Memories & Pinned Posts",
          "Exclusive Alumni Communities Access",
          "Special Store Room Alumni Discounts",
        ],
        isActive: true,
      },
      {
        slug: "alumni-yearly",
        name: "Alumni Premium (Annual)",
        billingCycle: "yearly",
        durationMonths: 12,
        pricePaise: 199900, // ₹1,999 / year
        originalPricePaise: 358800,
        features: [
          "✦ Everything in Monthly Plan included",
          "2 Months Free compared to monthly plan",
          "Priority listing in Alumni Directory",
          "30-day and 90-day deep profile analytics",
          "Exclusive JNV Alumni Conclave passes",
          "Flat ₹200 OFF Store Room Welcome Coupon",
        ],
        isActive: true,
      },
    ]);
    console.log("[membershipSeed] Seeded default Alumni Premium membership plans.");
  } catch (err) {
    console.warn("[membershipSeed] Failed to seed default plans:", err);
  }
}
