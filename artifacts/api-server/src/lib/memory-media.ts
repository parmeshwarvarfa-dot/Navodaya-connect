import { randomUUID } from "node:crypto";
import { Readable, Transform } from "node:stream";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MAX_MEMORY_MEDIA_BYTES = 100 * 1024 * 1024;
const SIGNED_URL_TTL_SECONDS = 60 * 60;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MemoryMediaType = "image" | "video";
export type StoredMemoryMedia = {
  key: string;
  fileName: string;
  contentType: string;
  size: number;
  mediaType: MemoryMediaType;
};
export type MemoryMediaMetadata = Omit<StoredMemoryMedia, "key">;

export class MemoryMediaError extends Error {
  readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = "MemoryMediaError";
    this.statusCode = statusCode;
  }
}

type StorageConfig = {
  bucket: string;
  client: S3Client;
};

let cachedClient: S3Client | undefined;

function storageConfig(): StorageConfig {
  const bucket = process.env.NEON_STORAGE_BUCKET?.trim();
  const endpoint = process.env.AWS_ENDPOINT_URL_S3?.trim();
  const region = process.env.AWS_REGION?.trim();
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY?.trim();
  if (!bucket || !endpoint || !region || !accessKeyId || !secretAccessKey) {
    throw new MemoryMediaError("Media storage is not configured on the API server.", 503);
  }

  let parsedEndpoint: URL;
  try {
    parsedEndpoint = new URL(endpoint);
  } catch {
    throw new MemoryMediaError("Media storage is not configured on the API server.", 503);
  }
  if (parsedEndpoint.protocol !== "https:" || parsedEndpoint.username || parsedEndpoint.password) {
    throw new MemoryMediaError("Media storage endpoint must use HTTPS.", 503);
  }

  if (!cachedClient) {
    const clientOptions: S3ClientConfig = {
      endpoint: parsedEndpoint.toString().replace(/\/$/, ""),
      region,
      forcePathStyle: true,
      credentials: { accessKeyId, secretAccessKey },
      maxAttempts: 2,
    };
    cachedClient = new S3Client(clientOptions);
  }
  return { bucket, client: cachedClient };
}

function sniffMedia(prefix: Buffer): { mediaType: MemoryMediaType; contentType: string } | null {
  if (prefix.length >= 3 && prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
    return { mediaType: "image", contentType: "image/jpeg" };
  }
  if (prefix.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { mediaType: "image", contentType: "image/png" };
  }
  if (prefix.subarray(0, 6).toString("ascii").match(/^GIF8[79]a$/)) {
    return { mediaType: "image", contentType: "image/gif" };
  }
  if (prefix.length >= 12 && prefix.subarray(0, 4).toString("ascii") === "RIFF") {
    const riffType = prefix.subarray(8, 12).toString("ascii");
    if (riffType === "WEBP") return { mediaType: "image", contentType: "image/webp" };
    if (riffType === "AVI ") return { mediaType: "video", contentType: "video/x-msvideo" };
  }
  if (prefix.length >= 2 && prefix.subarray(0, 2).toString("ascii") === "BM") {
    return { mediaType: "image", contentType: "image/bmp" };
  }
  if (prefix.length >= 4 && (prefix.subarray(0, 4).equals(Buffer.from([0x49, 0x49, 0x2a, 0x00])) || prefix.subarray(0, 4).equals(Buffer.from([0x4d, 0x4d, 0x00, 0x2a])))) {
    return { mediaType: "image", contentType: "image/tiff" };
  }
  if (prefix.length >= 12 && prefix.subarray(4, 8).toString("ascii") === "ftyp") {
    const brands = [prefix.subarray(8, 12).toString("ascii"), prefix.subarray(16, 20).toString("ascii")];
    if (brands.includes("qt  ")) return { mediaType: "video", contentType: "video/quicktime" };
    if (brands.some((brand) => /^(heic|heix|hevc|hevx|mif1|msf1)$/.test(brand))) {
      return { mediaType: "image", contentType: "image/heic" };
    }
    if (brands.some((brand) => /^(avif|avis)$/.test(brand))) {
      return { mediaType: "image", contentType: "image/avif" };
    }
    if (brands.some((brand) => /^(3gp[0-9 ]|3g2[0-9 ])$/.test(brand))) {
      return { mediaType: "video", contentType: "video/3gpp" };
    }
    return { mediaType: "video", contentType: "video/mp4" };
  }
  if (prefix.length >= 4 && prefix.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) {
    return { mediaType: "video", contentType: "video/webm" };
  }
  return null;
}

function safeFileName(value: string): string {
  let decoded = value;
  try { decoded = decodeURIComponent(value); } catch { /* Keep the sanitized original. */ }
  const cleaned = decoded.replace(/[\\/\u0000-\u001f\u007f"']/g, "_").replace(/[^\p{L}\p{N}._ -]/gu, "_").trim();
  return (cleaned || "memory-media").slice(0, 160);
}

export function parseStoredMemoryMedia(value: string | null | undefined): (string | StoredMemoryMedia)[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((entry): (string | StoredMemoryMedia)[] => {
      if (typeof entry === "string" && entry.startsWith("https://")) return [entry];
      if (!entry || typeof entry !== "object") return [];
      const item = entry as Record<string, unknown>;
      if (typeof item.key !== "string" || typeof item.fileName !== "string" ||
        typeof item.contentType !== "string" || typeof item.size !== "number" ||
        (item.mediaType !== "image" && item.mediaType !== "video")) return [];
      return [{
        key: item.key,
        fileName: item.fileName,
        contentType: item.contentType,
        size: item.size,
        mediaType: item.mediaType,
      }];
    }).slice(0, 10);
  } catch {
    return [];
  }
}

export function mediaMetadata(media: string | StoredMemoryMedia): MemoryMediaMetadata | null {
  if (typeof media === "string") return null;
  return { fileName: media.fileName, contentType: media.contentType, size: media.size, mediaType: media.mediaType };
}

function ownedKey(ownerId: string, key: string): boolean {
  if (!UUID.test(ownerId) || !key.startsWith(`memories/${ownerId}/`)) return false;
  const filename = key.slice(`memories/${ownerId}/`.length);
  return UUID.test(filename);
}

export async function uploadMemoryMedia(input: {
  ownerId: string;
  stream: Readable;
  contentLength?: number;
  declaredContentType?: string;
  fileName: string;
  maxBytes?: number;
  allowedMediaTypes?: readonly MemoryMediaType[];
}): Promise<StoredMemoryMedia> {
  const maxBytes = input.maxBytes ?? MAX_MEMORY_MEDIA_BYTES;
  const maxMegabytes = Math.floor(maxBytes / (1024 * 1024));
  if (input.contentLength !== undefined && (!Number.isSafeInteger(input.contentLength) || input.contentLength <= 0 || input.contentLength > maxBytes)) {
    throw new MemoryMediaError(`Each photo or video must be between 1 byte and ${maxMegabytes} MB.`);
  }
  if (!UUID.test(input.ownerId)) throw new MemoryMediaError("Could not identify the signed-in user.", 401);
  const declaredType = (input.declaredContentType || "").split(";")[0].trim().toLowerCase();
  if (declaredType && declaredType !== "application/octet-stream" && !/^(image|video)\//.test(declaredType)) {
    throw new MemoryMediaError("Choose a supported photo or video file.");
  }

  const iterator = input.stream[Symbol.asyncIterator]();
  const firstChunks: Buffer[] = [];
  let prefix = Buffer.alloc(0);
  let sourceEnded = false;
  try {
    while (prefix.length < 32) {
      const next = await iterator.next();
      if (next.done) {
        sourceEnded = true;
        break;
      }
      const chunk = Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value as Uint8Array);
      firstChunks.push(chunk);
      if (prefix.length < 64) prefix = Buffer.concat([prefix, chunk.subarray(0, 64 - prefix.length)]);
    }
  } catch {
    throw new MemoryMediaError("The selected media file could not be read.");
  }
  const detected = sniffMedia(prefix);
  if (!detected) {
    input.stream.resume();
    throw new MemoryMediaError("This file is not a supported image or video.");
  }
  if (input.allowedMediaTypes && !input.allowedMediaTypes.includes(detected.mediaType)) {
    input.stream.resume();
    throw new MemoryMediaError("Choose a supported image file.");
  }
  if (declaredType && declaredType !== "application/octet-stream" && declaredType.startsWith("image/") !== (detected.mediaType === "image")) {
    input.stream.resume();
    throw new MemoryMediaError("The selected file type does not match its contents.");
  }
  const replay = Readable.from((async function* () {
    yield* firstChunks;
    if (!sourceEnded) {
      while (true) {
        const next = await iterator.next();
        if (next.done) break;
        yield Buffer.isBuffer(next.value) ? next.value : Buffer.from(next.value as Uint8Array);
      }
    }
  })());

  let size = 0;
  let streamError: MemoryMediaError | null = null;
  const meter = new Transform({
    transform(chunk: Buffer | string, _encoding, callback) {
      const bytes = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      size += bytes.length;
      if (size > maxBytes) {
        streamError = new MemoryMediaError(`Each photo or video must be under ${maxMegabytes} MB.`);
        return callback(streamError);
      }
      callback(null, bytes);
    },
    flush(callback) {
      if (!size) return callback(new MemoryMediaError("This file is empty."));
      if (input.contentLength !== undefined && size !== input.contentLength) {
        streamError = new MemoryMediaError("The uploaded file size did not match the selected file.");
        return callback(streamError);
      }
      callback();
    },
  });

  const { bucket, client } = storageConfig();
  const fileName = safeFileName(input.fileName);
  const key = `memories/${input.ownerId}/${randomUUID()}`;
  const body = replay.pipe(meter);
  const upload = new Upload({
    client,
    params: {
      Bucket: bucket,
      Key: key,
      Body: body,
      ...(input.contentLength ? { ContentLength: input.contentLength } : {}),
      ContentType: detected.contentType,
      Metadata: { ownerid: input.ownerId, filename: encodeURIComponent(fileName) },
      CacheControl: "private, no-store",
    },
    queueSize: 2,
    partSize: 5 * 1024 * 1024,
    leavePartsOnError: false,
  });

  try {
    await upload.done();
  } catch (error) {
    if (error instanceof MemoryMediaError) throw error;
    if (streamError) throw streamError;
    throw new MemoryMediaError("The media upload failed. Please try again.", 502);
  }

  return { key, fileName, contentType: detected.contentType, size, mediaType: detected.mediaType };
}

export async function validateOwnedMemoryMedia(ownerId: string, key: string): Promise<StoredMemoryMedia> {
  if (!ownedKey(ownerId, key)) throw new MemoryMediaError("One or more selected uploads are invalid.");
  const { bucket, client } = storageConfig();
  try {
    const head = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    if (head.Metadata?.ownerid !== ownerId || !head.ContentLength || head.ContentLength > MAX_MEMORY_MEDIA_BYTES) {
      throw new MemoryMediaError("One or more selected uploads are unavailable or invalid.");
    }
    const mediaType = head.ContentType?.startsWith("image/") ? "image" : head.ContentType?.startsWith("video/") ? "video" : null;
    if (!mediaType) throw new MemoryMediaError("One or more selected uploads are unavailable or invalid.");
    const filename = key.slice(key.lastIndexOf("/") + 1);
    return {
      key,
      fileName: decodeURIComponent(head.Metadata?.filename ?? filename),
      contentType: head.ContentType!,
      size: head.ContentLength,
      mediaType,
    };
  } catch (error) {
    if (error instanceof MemoryMediaError) throw error;
    throw new MemoryMediaError("One or more selected uploads are unavailable or invalid.");
  }
}

export async function signMemoryMedia(media: StoredMemoryMedia, ownerId: string): Promise<string> {
  if (!ownedKey(ownerId, media.key)) throw new MemoryMediaError("This media is not available.", 404);
  const { bucket, client } = storageConfig();
  return getSignedUrl(client, new GetObjectCommand({
    Bucket: bucket,
    Key: media.key,
    ResponseContentType: media.contentType,
    ResponseCacheControl: "private, no-store",
    ResponseContentDisposition: "inline",
  }), { expiresIn: SIGNED_URL_TTL_SECONDS });
}

export async function deleteMemoryMediaObject(key: string): Promise<void> {
  const { bucket, client } = storageConfig();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export function isOwnedMemoryMediaKey(ownerId: string, key: string): boolean {
  return ownedKey(ownerId, key);
}

export function getMemoryMediaOwnerId(key: string): string | null {
  const match = /^memories\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.exec(key);
  return match?.[1] ?? null;
}
