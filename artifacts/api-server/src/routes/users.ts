import { Router } from "express";
import { eq, and, inArray, or, ilike, ne, asc, isNotNull } from "drizzle-orm";
import { db, digitalCredentialsTable, userBlocksTable, userFollowsTable, usersTable } from "@workspace/db";
import { avatarConfigSchema } from "@workspace/api-zod";
import { requireAuth, getUser } from "../lib/auth";
import { isValidUserId } from "./user-validation";
import { canViewProfile, isBlockedBetween } from "../lib/social-access";
import { makeJnvId } from "../lib/jnv-identity";
import { hasValidAlumniSchool } from "../lib/alumni-peer-policy";

const router = Router();

router.get("/users/search", requireAuth, async (req, res) => {
  const viewer = getUser(req);
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
  if (query.length < 2) return res.json([]);
  try {
    const normalizedDigitalId = query.replace(/\s/g, "").toUpperCase();
    if (/^NC-(?:STU|ALU|TCH|OFC)-[A-F0-9]{10}$/.test(normalizedDigitalId)) {
      const [match] = await db.select({
        id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role,
        jnvName: usersTable.jnvName, photoURL: usersTable.photoURL,
      }).from(digitalCredentialsTable).innerJoin(usersTable, eq(digitalCredentialsTable.userId, usersTable.id))
        .where(and(
          eq(digitalCredentialsTable.credentialId, normalizedDigitalId),
          eq(digitalCredentialsTable.status, "active"),
          eq(usersTable.role, digitalCredentialsTable.role),
          or(
            and(eq(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "community_verified"), isNotNull(usersTable.communityVerifiedAt)),
            and(ne(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "verified")),
          ),
          ne(usersTable.id, viewer.id),
        )).limit(1);
      if (!match || await isBlockedBetween(viewer.id, match.id)) return res.json([]);
      // Returning only the ordinary minimal search card lets a private profile
      // resolve to its existing restricted profile view, where follow requests
      // remain subject to the normal social-access rules.
      return res.json([match]);
    }
    // Search by a display name, or by an exact account ID. Never allow ID
    // prefix scans, which would make internal account identifiers enumerable.
    const isExactAccountId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query);
    const searchCondition = isExactAccountId
      ? eq(usersTable.id, query)
      : ilike(usersTable.fullName, `%${query.replace(/[%_\\]/g, "\\$&")}%`);
    const matches = await db.select({
      id: usersTable.id,
      fullName: usersTable.fullName,
      role: usersTable.role,
      jnvName: usersTable.jnvName,
      photoURL: usersTable.photoURL,
    }).from(usersTable)
      .where(and(searchCondition, ne(usersTable.id, viewer.id)))
      .orderBy(asc(usersTable.fullName))
      .limit(40);
    const visible = await Promise.all(matches.map(async (match) =>
      await canViewProfile(viewer.id, match.id) && !await isBlockedBetween(viewer.id, match.id) ? match : null,
    ));
    return res.json(visible.filter(Boolean).slice(0, 20));
  } catch (error) {
    req.log.error(error, "Failed to search chat contacts");
    return res.status(500).json({ error: "Failed to search people" });
  }
});

router.get("/users/:id/report-context", requireAuth, async (req, res) => {
  const viewer = getUser(req);
  const targetId = req.params.id as string;
  if (viewer.role !== "alumni" || !hasValidAlumniSchool(viewer)) return res.status(404).json({ error: "Report target not found." });
  const [target] = await db.select({ id: usersTable.id, fullName: usersTable.fullName, role: usersTable.role,
    jnvId: usersTable.jnvId, jnvName: usersTable.jnvName, jnvState: usersTable.jnvState,
    photoURL: usersTable.photoURL, verificationStatus: usersTable.verificationStatus,
  }).from(usersTable).where(eq(usersTable.id, targetId)).limit(1);
  if (!target || target.role !== "alumni" || target.jnvId !== viewer.jnvId || await isBlockedBetween(viewer.id, target.id)) {
    return res.status(404).json({ error: "Report target not found." });
  }
  return res.json({ ...target, skills: [], isRestricted: false });
});

router.get("/users/alumni", requireAuth, async (req, res) => {
  try {
    const viewer = getUser(req);
    const alumni = await db.select().from(usersTable)
      .where(and(eq(usersTable.role, "alumni"), eq(usersTable.verificationStatus, "community_verified"), isNotNull(usersTable.communityVerifiedAt), eq(usersTable.jnvId, viewer.jnvId ?? makeJnvId(viewer.jnvState, viewer.jnvName))));
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
      resumeUrl: usersTable.resumeUrl,
      skills: usersTable.skills,
      verificationStatus: usersTable.verificationStatus,
      communityVerifiedAt: usersTable.communityVerifiedAt,
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
      skills, photoURL, jnvName, jnvState, house,
      passoutYear, enrollYear, class: cls, bio, phone, linkedinUrl, twitterUrl,
      instagramUrl, currentLocation,
      resumeUrl,
      avatarConfig, avatarThumbnailURL, profileImageType, uploadedPhotoURL,
    } = req.body;

    // A verified teacher's school affiliation determines the scope of academic
    // and staff access. It cannot be changed through the ordinary profile API.
    // Transfers need an authorized, auditable school-membership workflow.
    if ((jnvName !== undefined && jnvName !== user.jnvName)
      || (jnvState !== undefined && jnvState !== user.jnvState)) {
      return res.status(403).json({ error: "School affiliation changes require an authorized JNV transfer workflow" });
    }

    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (fullName !== undefined) updates.fullName = fullName;
    if (photoURL !== undefined) updates.photoURL = photoURL;
    if (uploadedPhotoURL !== undefined) {
      if (typeof uploadedPhotoURL !== "string" || uploadedPhotoURL.length > 2_000_000) {
        return res.status(400).json({ error: "Profile photo is too large or invalid" });
      }
      updates.uploadedPhotoURL = uploadedPhotoURL || null;
    }
    if (avatarConfig !== undefined) {
      const parsed = avatarConfigSchema.safeParse(avatarConfig);
      if (!parsed.success) return res.status(400).json({ error: "Invalid avatar configuration" });
      updates.avatarConfig = parsed.data;
    }
    if (avatarThumbnailURL !== undefined) {
      if (typeof avatarThumbnailURL !== "string" || avatarThumbnailURL.length > 500_000 ||
          (avatarThumbnailURL && !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(avatarThumbnailURL))) {
        return res.status(400).json({ error: "Invalid avatar thumbnail" });
      }
      updates.avatarThumbnailURL = avatarThumbnailURL || null;
    }
    if (profileImageType !== undefined) {
      if (!["photo", "avatar", "default"].includes(profileImageType)) {
        return res.status(400).json({ error: "Invalid profile image selection" });
      }
      if (profileImageType === "avatar") {
        const thumbnail = avatarThumbnailURL ?? user.avatarThumbnailURL;
        const config = avatarConfig ?? user.avatarConfig;
        if (!thumbnail || !config) return res.status(400).json({ error: "Save an avatar before selecting it" });
        updates.uploadedPhotoURL = uploadedPhotoURL ?? user.uploadedPhotoURL ?? (user.profileImageType === "avatar" ? null : user.photoURL);
        updates.photoURL = thumbnail;
      } else if (profileImageType === "photo") {
        const selectedPhoto = photoURL ?? user.uploadedPhotoURL ?? (user.profileImageType === "avatar" ? null : user.photoURL);
        if (!selectedPhoto) return res.status(400).json({ error: "Choose a profile photo first" });
        updates.photoURL = selectedPhoto;
        updates.uploadedPhotoURL = selectedPhoto;
      } else {
        updates.uploadedPhotoURL = uploadedPhotoURL ?? user.uploadedPhotoURL ?? (user.profileImageType === "avatar" ? null : user.photoURL);
        updates.photoURL = null;
      }
      updates.profileImageType = profileImageType;
    }
    if (!user.jnvId) updates.jnvId = makeJnvId(user.jnvState, user.jnvName);
    if (house !== undefined) updates.house = house;
    if (bio !== undefined) updates.bio = bio;
    if (phone !== undefined) updates.phone = phone;
    if (linkedinUrl !== undefined) updates.linkedinUrl = linkedinUrl;
    if (twitterUrl !== undefined) updates.twitterUrl = twitterUrl;
    if (instagramUrl !== undefined) updates.instagramUrl = instagramUrl;
    if (currentLocation !== undefined) updates.currentLocation = currentLocation;
    if (resumeUrl !== undefined) {
      if (user.role !== "alumni") return res.status(403).json({ error: "Only alumni can add a resume or CV" });
      if (typeof resumeUrl !== "string" || resumeUrl.length > 2_048) {
        return res.status(400).json({ error: "Resume link must be 2,048 characters or fewer" });
      }
      const trimmedResumeUrl = resumeUrl.trim();
      if (trimmedResumeUrl) {
        try {
          const parsedResumeUrl = new URL(trimmedResumeUrl);
          if (parsedResumeUrl.protocol !== "https:" || parsedResumeUrl.username || parsedResumeUrl.password) {
            return res.status(400).json({ error: "Resume link must be a valid HTTPS URL" });
          }
        } catch {
          return res.status(400).json({ error: "Resume link must be a valid HTTPS URL" });
        }
      }
      updates.resumeUrl = trimmedResumeUrl || null;
    }
    if (profession !== undefined) updates.profession = profession;
    if (company !== undefined) updates.company = company;
    if (field !== undefined) updates.field = field;
    if (subject !== undefined) updates.subject = subject;
    if (designation !== undefined) updates.designation = designation;
    if (skills !== undefined) updates.skills = JSON.stringify(skills);
    if (passoutYear !== undefined) updates.passoutYear = passoutYear;
    if (enrollYear !== undefined) updates.enrollYear = enrollYear;
    if (cls !== undefined) updates.class = cls;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    const { passwordHash, ...safe } = updated;
    res.json({ ...safe, skills: safe.skills ? JSON.parse(safe.skills) : [] });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to update profile" });
  }
});

export default router;
