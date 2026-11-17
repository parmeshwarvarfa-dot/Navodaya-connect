import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import express from "express";
import memoriesRouter from "../routes/memories";
import achievementsRouter from "../routes/achievements";
import {
  isOwnedMemoryMediaKey,
  mediaMetadata,
  MemoryMediaError,
  parseStoredMemoryMedia,
  signMemoryMedia,
  uploadMemoryMedia,
  type StoredMemoryMedia,
} from "./memory-media";

const ownerId = "2f84165c-76a9-4cc8-a72a-016451ac6ea9";
const otherUserId = "80c1ca99-a838-4ecb-a4f8-dca3e45603a2";
const objectKey = `memories/${ownerId}/30e6b3ae-a1ee-472e-bc24-7e0d12912dab`;

test("stored media parsing preserves legacy URLs and safe object metadata", () => {
  const stored: StoredMemoryMedia = {
    key: objectKey,
    fileName: "school-photo.png",
    contentType: "image/png",
    size: 68,
    mediaType: "image",
  };
  const parsed = parseStoredMemoryMedia(JSON.stringify(["https://legacy.example/photo.jpg", stored]));
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0], "https://legacy.example/photo.jpg");
  assert.deepEqual(parsed[1], stored);
  assert.deepEqual(mediaMetadata(stored), {
    fileName: "school-photo.png",
    contentType: "image/png",
    size: 68,
    mediaType: "image",
  });
  assert.equal("key" in (mediaMetadata(stored) ?? {}), false);
});

test("object keys are restricted to the authenticated owner's media prefix", () => {
  assert.equal(isOwnedMemoryMediaKey(ownerId, objectKey), true);
  assert.equal(isOwnedMemoryMediaKey(otherUserId, objectKey), false);
  assert.equal(isOwnedMemoryMediaKey(ownerId, `${objectKey}/../private`), false);
  assert.equal(isOwnedMemoryMediaKey(ownerId, `memories/${ownerId}/not-a-uuid`), false);
});

test("signed media access rejects a different owner before contacting storage", async () => {
  const asset: StoredMemoryMedia = {
    key: objectKey,
    fileName: "school-photo.png",
    contentType: "image/png",
    size: 68,
    mediaType: "image",
  };
  await assert.rejects(
    signMemoryMedia(asset, otherUserId),
    (error: unknown) => error instanceof MemoryMediaError && error.statusCode === 404,
  );
});

test("upload rejects unsupported content types before storage access", async () => {
  await assert.rejects(
    uploadMemoryMedia({
      ownerId,
      stream: Readable.from([Buffer.from("not media")]),
      contentLength: 9,
      declaredContentType: "text/plain",
      fileName: "notes.txt",
    }),
    (error: unknown) => error instanceof MemoryMediaError && error.statusCode === 400,
  );
});

test("the Express upload route rejects unauthenticated requests before storage access", async (context) => {
  const app = express();
  app.use("/api", memoriesRouter);
  app.use("/api", achievementsRouter);
  const server = app.listen(0);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");

  const response = await fetch(`http://127.0.0.1:${address.port}/api/memories/uploads`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: Buffer.from("unauthenticated"),
  });
  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: "Unauthorized" });
  const achievementResponse = await fetch(`http://127.0.0.1:${address.port}/api/achievements/uploads`, {
    method: "POST",
    headers: { "Content-Type": "image/png" },
    body: Buffer.from("unauthenticated"),
  });
  assert.equal(achievementResponse.status, 401);
  assert.deepEqual(await achievementResponse.json(), { error: "Unauthorized" });
});

test("achievement photo uploads enforce the 10 MB limit before storage access", async () => {
  await assert.rejects(uploadMemoryMedia({
    ownerId,
    stream: Readable.from([Buffer.from("oversized")]),
    contentLength: 10 * 1024 * 1024 + 1,
    declaredContentType: "image/png",
    fileName: "achievement.png",
    maxBytes: 10 * 1024 * 1024,
    allowedMediaTypes: ["image"],
  }), (error: unknown) => error instanceof MemoryMediaError && error.statusCode === 400);
});

test("achievement photo uploads reject video bytes even when labeled as an image", async () => {
  const video = Buffer.alloc(32);
  video.write("ftyp", 4);
  video.write("isom", 8);
  await assert.rejects(uploadMemoryMedia({
    ownerId,
    stream: Readable.from([video]),
    contentLength: video.length,
    declaredContentType: "image/jpeg",
    fileName: "achievement.jpg",
    maxBytes: 10 * 1024 * 1024,
    allowedMediaTypes: ["image"],
  }), (error: unknown) => error instanceof MemoryMediaError && error.statusCode === 400);
});
