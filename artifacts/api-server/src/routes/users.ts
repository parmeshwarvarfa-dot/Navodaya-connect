import { Router } from "express";
import { eq, and, inArray, or } from "drizzle-orm";
import { db, userBlocksTable, userFollowsTable, usersTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";
import { isValidUserId } from "./user-validation";
import { canViewProfile, isBlockedBetween } from "../lib/social-access";
import { makeJnvId } from "../lib/jnv-identity";

const router = Router();

router.get("/users/alumni", requireAuth, async (req, res) => {
  try {
    const viewer = getUser(req);
    const alumni = await db.select().from(usersTable)
      .where(and(eq(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "verified")));
    const ids = alumni.map((user) => user.id);
    const [follows, blocks] = ids.length ? await Promise.all([
      db.select({ followingId: userFollowsTable.followingId })
        .from(userFollowsTable)
        .where(and(
          eq(userFollowsTable.followerId, viewer.id),
          eq(userFollowsTable.status, "accepted"),
          inArray(userFollowsTable.followingId, ids),
        )),
      db.select({
        blockerId: userBlocksTable.blockerId,
        blockedId: userBlocksTable.blockedId,
      }).from(userBlocksTable).where(or(
        and(eq(userBlocksTable.blockerId, viewer.id), inArray(userBlocksTable.blockedId, ids)),
        and(inArray(userBlocksTable.blockerId, ids), eq(userBlocksTable.blockedId, viewer.id)),
      )),
    ]) : [[], []];
    const followedIds = new Set(follows.map((follow) => follow.followingId));
    const blockedIds = new Set(blocks.map((block) =>
      block.blockerId === viewer.id ? block.blockedId : block.blockerId,
    ));
    const safe = alumni
      .filter((user) => !blockedIds.has(user.id))
      .map(({ passwordHash, ...u }) => {
        const isRestricted = u.id !== viewer.id
          && u.profileVisibility === "private"
          && !followedIds.has(u.id);
        if (isRestricted) {
          return {
            id: u.id,
            fullName: u.fullName,
            role: u.role,
            jnvName: u.jnvName,
            jnvState: u.jnvState,
            photoURL: u.photoURL,
            verificationStatus: u.verificationStatus,
            profileVisibility: u.profileVisibility,
            isRestricted: true,
          };
        }
        return {
          ...u,
          jnvId: u.jnvId ?? makeJnvId(u.jnvState, u.jnvName),
          skills: u.skills ? JSON.parse(u.skills) : [],
          isRestricted: false,
        };
      });
    res.json(safe);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch alumni" });
  }
});

router.get("/users/profile/:id", requireAuth, async (req, res) => {
  const viewer = getUser(req);
  const userId = req.params.id as string;
  if (!isValidUserId(userId)) return res.status(400).json({ error: "Invalid user ID" });

  try {
    const [user] = await db.select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      role: usersTable.role,
      jnvName: usersTable.jnvName,
      jnvState: usersTable.jnvState,
      jnvId: usersTable.jnvId,
      profileVisibility: usersTable.profileVisibility,
      house: usersTable.house,
      photoURL: usersTable.photoURL,
      class: usersTable.class,
      passoutYear: usersTable.passoutYear,
      profession: usersTable.profession,
      field: usersTable.field,
      company: usersTable.company,
      skills: usersTable.skills,
      verificationStatus: usersTable.verificationStatus,
      subject: usersTable.subject,
      designation: usersTable.designation,
      bio: usersTable.bio,
    }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);

    if (!user) return res.status(404).json({ error: "User not found" });
    if (await isBlockedBetween(viewer.id, userId)) return res.status(404).json({ error: "User not found" });
    if (!await canViewProfile(viewer.id, userId)) {
      return res.json({
        id: user.id,
        fullName: user.fullName,
        role: user.role,
        jnvName: user.jnvName,
        jnvState: user.jnvState,
        photoURL: user.photoURL,
        verificationStatus: user.verificationStatus,
        profileVisibility: user.profileVisibility ?? "private",
        isRestricted: true,
      });
    }
    res.json({
      ...user,
      jnvId: user.jnvId ?? makeJnvId(user.jnvState, user.jnvName),
      isRestricted: false,
      skills: user.skills ? JSON.parse(user.skills) : [],
    });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch user profile" });
  }
});

router.patch("/users/me", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const {
      fullName, profession, company, field, subject, designation,
      skills, verificationStatus, photoURL, jnvName, jnvState, house,
      passoutYear, enrollYear, class: cls, bio, phone, linkedinUrl, twitterUrl,
    } = req.body;

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (photoURL !== undefined) updates.photoURL = photoURL;
    if (jnvName !== undefined) updates.jnvName = jnvName;
    if (jnvState !== undefined) updates.jnvState = jnvState;
    if (jnvName !== undefined || jnvState !== undefined || !user.jnvId) {
      updates.jnvId = makeJnvId(jnvState ?? user.jnvState, jnvName ?? user.jnvName);
    }
    if (house !== undefined) updates.house = house;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (linkedinUrl !== undefined) updates.linkedinUrl = linkedinUrl;
    if (twitterUrl !== undefined) updates.twitterUrl = twitterUrl;
    if (profession !== undefined) updates.profession = profession;
    if (company !== undefined) updates.company = company;
    if (field !== undefined) updates.field = field;
    if (subject !== undefined) updates.subject = subject;
    if (designation !== undefined) updates.designation = designation;
    if (skills !== undefined) updates.skills = JSON.stringify(skills);
    if (passoutYear !== undefined) updates.passoutYear = passoutYear;
    if (enrollYear !== undefined) updates.enrollYear = enrollYear;
    if (cls !== undefined) updates.class = cls;
    if (verificationStatus !== undefined && user.role === "alumni") {
      updates.verificationStatus = verificationStatus;
    }

    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    const { passwordHash, ...safe } = updated;
    res.json({ ...safe, skills: safe.skills ? JSON.parse(safe.skills) : [] });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
