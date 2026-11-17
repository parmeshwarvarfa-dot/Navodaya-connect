import { Router } from "express";
import { db, achievementsTable } from "@workspace/db";
import { getUser, requireAuth } from "../lib/auth";
import { desc, eq } from "drizzle-orm";
import { isValidUserId } from "./user-validation";
import {
  MemoryMediaError, parseStoredMemoryMedia, signMemoryMedia,
  uploadMemoryMedia, validateOwnedMemoryMedia,
} from "../lib/memory-media";

const router = Router();
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

router.post("/achievements/uploads", requireAuth, async (req, res) => {
  try {
    const length = req.headers["content-length"];
    const fileName = req.headers["x-media-filename"];
    const media = await uploadMemoryMedia({
      ownerId: getUser(req).id,
      stream: req,
      contentLength: typeof length === "string" ? Number(length) : undefined,
      declaredContentType: req.headers["content-type"],
      fileName: typeof fileName === "string" ? fileName : "achievement-photo",
      maxBytes: MAX_IMAGE_BYTES,
      allowedMediaTypes: ["image"],
    });
    return res.status(201).json(media);
  } catch (error) {
    req.resume();
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error({ errorName: error instanceof Error ? error.name : "unknown" }, "Achievement image upload failed");
    return res.status(502).json({ error: "The photo could not be uploaded. Please try again." });
  }
});

router.get("/achievements", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(achievementsTable)
      .orderBy(desc(achievementsTable.createdAt));
    return res.json(await Promise.all(rows.map(async ({ image, ...row }) => {
      const [media] = parseStoredMemoryMedia(image);
      const imageUrl = media && typeof media !== "string" && row.authorId
        ? await signMemoryMedia(media, row.authorId) : null;
      return { ...row, imageUrl };
    })));
  } catch (e) {
    return res.status(500).json({ error: "Failed to fetch achievements" });
  }
});

router.post("/achievements", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const { title, description, category, imageKey } = req.body ?? {};

    if (typeof title !== "string" || !title.trim() || typeof description !== "string" || !description.trim()) {
      return res.status(400).json({ error: "Title and description required" });
    }

    let image = null;
    if (imageKey !== undefined) {
      if (typeof imageKey !== "string") return res.status(400).json({ error: "Choose a valid achievement photo." });
      image = await validateOwnedMemoryMedia(user.id, imageKey);
      if (image.mediaType !== "image" || image.size > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: "Choose a photo under 10 MB." });
      }
    }
    const imageUrl = image ? await signMemoryMedia(image, user.id) : null;

    const [row] = await db.insert(achievementsTable).values({
      title: title.trim(),
      description: description.trim(),
      category: typeof category === "string" && category.trim() ? category.trim() : "Career",
      image: image ? JSON.stringify([image]) : null,
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
      batch: user.passoutYear,
    }).returning();

    const { image: _storedImage, ...achievement } = row;
    return res.json({ ...achievement, imageUrl });
  } catch (e) {
    if (e instanceof MemoryMediaError) return res.status(e.statusCode).json({ error: e.message });
    return res.status(500).json({ error: "Failed to post achievement" });
  }
});

router.patch("/achievements/:id", requireAuth, async (req, res) => {
  const user = getUser(req);
  const id = req.params.id as string;
  if (!isValidUserId(id)) return res.status(404).json({ error: "Achievement not found." });

  try {
    const [existing] = await db.select().from(achievementsTable).where(eq(achievementsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Achievement not found." });
    if (existing.authorId !== user.id) return res.status(403).json({ error: "You can only edit your own achievements." });

    const { title, description, category, imageKey } = req.body ?? {};
    if (title === undefined && description === undefined && category === undefined && imageKey === undefined) {
      return res.status(400).json({ error: "Make at least one change before saving." });
    }
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return res.status(400).json({ error: "Add an achievement title." });
    }
    if (description !== undefined && (typeof description !== "string" || !description.trim())) {
      return res.status(400).json({ error: "Add your achievement story." });
    }
    if (category !== undefined && (typeof category !== "string" || !category.trim())) {
      return res.status(400).json({ error: "Choose an achievement category." });
    }
    if (imageKey !== undefined && typeof imageKey !== "string") {
      return res.status(400).json({ error: "Choose a valid achievement photo." });
    }

    let image = existing.image;
    if (typeof imageKey === "string") {
      const uploadedImage = await validateOwnedMemoryMedia(user.id, imageKey);
      if (uploadedImage.mediaType !== "image" || uploadedImage.size > MAX_IMAGE_BYTES) {
        return res.status(400).json({ error: "Choose a photo under 10 MB." });
      }
      image = JSON.stringify([uploadedImage]);
    }

    const [row] = await db.update(achievementsTable).set({
      ...(title !== undefined ? { title: title.trim() } : {}),
      ...(description !== undefined ? { description: description.trim() } : {}),
      ...(category !== undefined ? { category: category.trim() } : {}),
      ...(imageKey !== undefined ? { image } : {}),
    }).where(eq(achievementsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "Achievement not found." });

    const [media] = parseStoredMemoryMedia(row.image);
    const imageUrl = media && typeof media !== "string" && row.authorId
      ? await signMemoryMedia(media, row.authorId) : null;
    const { image: _storedImage, ...achievement } = row;
    return res.json({ ...achievement, imageUrl });
  } catch (error) {
    if (error instanceof MemoryMediaError) return res.status(error.statusCode).json({ error: error.message });
    req.log.error(error, "Failed to update achievement");
    return res.status(500).json({ error: "Could not update this achievement." });
  }
});

router.delete("/achievements/:id", requireAuth, async (req, res) => {
  const user = getUser(req);
  const id = req.params.id as string;
  if (!isValidUserId(id)) return res.status(404).json({ error: "Achievement not found." });

  try {
    const [existing] = await db.select({ id: achievementsTable.id, authorId: achievementsTable.authorId })
      .from(achievementsTable).where(eq(achievementsTable.id, id)).limit(1);
    if (!existing) return res.status(404).json({ error: "Achievement not found." });
    if (existing.authorId !== user.id) return res.status(403).json({ error: "You can only delete your own achievements." });
    await db.delete(achievementsTable).where(eq(achievementsTable.id, id));
    return res.json({ deleted: true });
  } catch (error) {
    req.log.error(error, "Failed to delete achievement");
    return res.status(500).json({ error: "Could not delete this achievement." });
  }
});

export default router;
