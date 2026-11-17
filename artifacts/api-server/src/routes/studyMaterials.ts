import { Router } from "express";
import { db, studyMaterialsTable, studyMaterialBookmarksTable } from "@workspace/db";
import { getUser, isAuthorizedSchoolStaff, requireAuth } from "../lib/auth";
import { desc, eq, and, or, isNull } from "drizzle-orm";
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

const router = Router();

const UPLOADS_DIR = path.resolve(process.cwd(), "uploads", "study-materials");
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case ".pdf":
      return "application/pdf";
    case ".doc":
      return "application/msword";
    case ".docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case ".ppt":
      return "application/vnd.ms-powerpoint";
    case ".pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case ".txt":
      return "text/plain";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".zip":
      return "application/zip";
    default:
      return "application/octet-stream";
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ---------------------------------------------------------------------------
// File Upload Endpoint for Study Materials / Notes
// ---------------------------------------------------------------------------
router.post("/study-materials/upload", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!await isAuthorizedSchoolStaff(user)) {
      return res.status(403).json({ error: "Verified school staff access is required to upload files" });
    }

    const { fileName, base64Data, contentType } = req.body ?? {};
    if (typeof fileName !== "string" || !fileName.trim()) {
      return res.status(400).json({ error: "File name is required" });
    }
    if (typeof base64Data !== "string" || !base64Data.trim()) {
      return res.status(400).json({ error: "File data is required" });
    }

    // Strip data URI scheme prefix if present: e.g. "data:application/pdf;base64,"
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    const fileBuffer = Buffer.from(cleanBase64, "base64");

    if (fileBuffer.length === 0) {
      return res.status(400).json({ error: "Empty file data" });
    }
    if (fileBuffer.length > 50 * 1024 * 1024) {
      return res.status(400).json({ error: "File size exceeds the 50MB limit" });
    }

    const cleanName = path.basename(fileName.trim()).replace(/[^a-zA-Z0-9._-]/g, "_");
    const uniqueFileName = `${Date.now()}-${randomUUID().slice(0, 8)}-${cleanName}`;
    const destinationPath = path.join(UPLOADS_DIR, uniqueFileName);

    fs.writeFileSync(destinationPath, fileBuffer);

    const formattedSize = formatBytes(fileBuffer.length);
    const fileUrl = `/api/study-materials/files/${encodeURIComponent(uniqueFileName)}`;

    req.log.info({ user: user.id, file: uniqueFileName, size: formattedSize }, "Study material file uploaded successfully");

    return res.status(201).json({
      url: fileUrl,
      fileName: cleanName,
      size: formattedSize,
      contentType: contentType || getMimeType(cleanName),
    });
  } catch (e) {
    req.log.error(e, "Error uploading study material file");
    return res.status(500).json({ error: "Failed to process and store file upload" });
  }
});

// ---------------------------------------------------------------------------
// File Serving Endpoint: Allows direct inline preview and download
// ---------------------------------------------------------------------------
router.get("/study-materials/files/:fileName", async (req, res) => {
  try {
    const rawFileName = req.params.fileName as string;
    const cleanName = path.basename(rawFileName);
    const filePath = path.join(UPLOADS_DIR, cleanName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Requested study material file was not found" });
    }

    const mimeType = getMimeType(cleanName);
    const stat = fs.statSync(filePath);

    res.setHeader("Content-Type", mimeType);
    res.setHeader("Content-Length", stat.size);
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(cleanName)}"`);
    res.setHeader("Cache-Control", "public, max-age=86400");

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  } catch (e) {
    req.log.error(e, "Error serving study material file");
    return res.status(500).json({ error: "Failed to retrieve study material file" });
  }
});

// ---------------------------------------------------------------------------
// Study Materials List
// ---------------------------------------------------------------------------
router.get("/study-materials", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const canReviewAll = await isAuthorizedSchoolStaff(user);
    if (!canReviewAll && user.role !== "student") return res.status(403).json({ error: "Study material access is unavailable for this account" });
    const rows = await db.select().from(studyMaterialsTable)
      .where(canReviewAll
        ? eq(studyMaterialsTable.jnvName, user.jnvName)
        : and(eq(studyMaterialsTable.jnvName, user.jnvName), or(isNull(studyMaterialsTable.targetClass), eq(studyMaterialsTable.targetClass, user.class ?? ""))))
      .orderBy(desc(studyMaterialsTable.createdAt));
    const bookmarks = await db.select().from(studyMaterialBookmarksTable)
      .where(eq(studyMaterialBookmarksTable.userId, user.id));
    const bmSet = new Set(bookmarks.map((b) => b.materialId));
    res.json(rows.map((r) => ({ ...r, bookmarked: bmSet.has(r.id) })));
  } catch (e) {
    req.log.error(e, "study materials error");
    res.status(500).json({ error: "Failed to fetch materials" });
  }
});

// ---------------------------------------------------------------------------
// Publish Study Material
// ---------------------------------------------------------------------------
router.post("/study-materials", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (!await isAuthorizedSchoolStaff(user)) return res.status(403).json({ error: "Verified school staff access is required" });
    const { title, subject, type, url, size, targetClass } = req.body ?? {};
    if (typeof title !== "string" || !title.trim() || title.length > 200 || typeof subject !== "string" || !subject.trim() || subject.length > 100 ||
        (type !== undefined && (typeof type !== "string" || type.length > 50)) ||
        (url !== undefined && (typeof url !== "string" || url.length > 2000 || (url && !/^(https?:\/\/|\/api\/)/i.test(url)))) ||
        (size !== undefined && (typeof size !== "string" || size.length > 50)) ||
        (targetClass !== undefined && (typeof targetClass !== "string" || targetClass.length > 100))) {
      return res.status(400).json({ error: "Valid title and subject required" });
    }
    const [row] = await db.insert(studyMaterialsTable).values({
      title: title.trim(),
      subject: subject.trim(),
      type: type || "Notes",
      url: url?.trim(),
      size: size?.trim(),
      targetClass: targetClass?.trim(),
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
    }).returning();
    res.json({ ...row, bookmarked: false });
  } catch (e) {
    req.log.error(e, "Failed to publish study material");
    res.status(500).json({ error: "Failed to upload material" });
  }
});

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------
router.post("/study-materials/:id/bookmark", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const canReviewAll = await isAuthorizedSchoolStaff(user);
    if (!canReviewAll && user.role !== "student") return res.status(403).json({ error: "Study material access is unavailable for this account" });
    const materialScope = canReviewAll
      ? and(eq(studyMaterialsTable.id, req.params.id as string), eq(studyMaterialsTable.jnvName, user.jnvName))
      : and(
        eq(studyMaterialsTable.id, req.params.id as string),
        eq(studyMaterialsTable.jnvName, user.jnvName),
        or(isNull(studyMaterialsTable.targetClass), eq(studyMaterialsTable.targetClass, user.class ?? "")),
      );
    const [material] = await db.select().from(studyMaterialsTable).where(materialScope).limit(1);
    if (!material) return res.status(404).json({ error: "Study material not found" });
    const existing = await db.select().from(studyMaterialBookmarksTable)
      .where(and(
        eq(studyMaterialBookmarksTable.materialId, req.params.id as string),
        eq(studyMaterialBookmarksTable.userId, user.id),
      ));
    if (existing.length > 0) {
      await db.delete(studyMaterialBookmarksTable)
        .where(eq(studyMaterialBookmarksTable.id, existing[0].id));
      res.json({ bookmarked: false });
    } else {
      await db.insert(studyMaterialBookmarksTable).values({
        materialId: req.params.id as string,
        userId: user.id,
      });
      res.json({ bookmarked: true });
    }
  } catch (e) {
    res.status(500).json({ error: "Failed to toggle bookmark" });
  }
});

export default router;
