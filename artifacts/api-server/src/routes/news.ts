import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db, newsTable } from "@workspace/db";
import { requireAuth, getUser } from "../lib/auth";
import { isOfficialNavodayaSource, isRelevantNavodayaNews } from "./news-relevance";

const router = Router();

const LIVE_FEED_QUERY = [
  '"Jawahar Navodaya Vidyalaya"',
  '"Jawahar Navodaya Vidyalayas"',
  '"Navodaya Vidyalaya Samiti"',
  '"Navodaya Vidyalaya"',
  '"Navodaya schools"',
  '"Navodaya students"',
  '"Navodaya teachers"',
  '"Navodaya alumni"',
  '"Navodaya community"',
  "JNVST",
  '"JNV school"',
  '"JNV students"',
  "(NVS AND (Navodaya OR Vidyalaya OR JNV))",
].join(" OR ");
const LIVE_FEED_URL = `https://news.google.com/rss/search?q=${encodeURIComponent(LIVE_FEED_QUERY)}&hl=en-IN&gl=IN&ceid=IN%3Aen`;
const LIVE_CACHE_MS = 5 * 60 * 1000;
let liveCache: { expiresAt: number; items: Array<Record<string, unknown>> } = { expiresAt: 0, items: [] };

function decodeXml(value: string) {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/<[^>]+>/g, "")
    .trim();
}

function readTag(item: string, tag: string) {
  const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function readSource(item: string) {
  const match = item.match(/<source[^>]*>([\s\S]*?)<\/source>/i);
  const url = item.match(/<source[^>]*url="([^"]+)"/i)?.[1];
  return { name: match ? decodeXml(match[1]) : "JNV News", url: url || "" };
}

async function resolveArticleUrl(url: string) {
  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: { "User-Agent": "NavodayaConnect/1.0" },
      signal: AbortSignal.timeout(5000),
    });
    if (response.url && !response.url.includes("news.google.com")) return response.url;
  } catch {}
  return url;
}

async function fetchLiveNews() {
  if (Date.now() < liveCache.expiresAt) return liveCache.items;

  try {
    const response = await fetch(LIVE_FEED_URL, {
      headers: { "User-Agent": "NavodayaConnect/1.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`Live news feed returned ${response.status}`);
    const xml = await response.text();
    const items = xml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
    const parsed = items.slice(0, 50).map((item, index) => {
      const source = readSource(item);
      return {
        id: `live-${index}-${Buffer.from(readTag(item, "title")).toString("base64url").slice(0, 16)}`,
        title: readTag(item, "title"),
        description: readTag(item, "description"),
        category: "JNV News",
        authorName: source.name,
        sourceName: source.name,
        sourceUrl: readTag(item, "link"),
        publisherUrl: source.url,
        publishedAt: new Date(readTag(item, "pubDate")).toISOString(),
        createdAt: new Date(readTag(item, "pubDate")).toISOString(),
        isLive: true,
      };
    }).filter((item) =>
      item.title &&
      item.sourceUrl &&
      isRelevantNavodayaNews(item.title, item.description, [item.publisherUrl, item.sourceUrl])
    );

    const resolved = await Promise.all(
      parsed.map(async (item) => ({ ...item, sourceUrl: await resolveArticleUrl(item.sourceUrl as string) })),
    );
    const publicItems = resolved.map(({ publisherUrl: _publisherUrl, ...item }) => item);
    liveCache = { expiresAt: Date.now() + LIVE_CACHE_MS, items: publicItems };
    return publicItems;
  } catch {
    return [];
  }
}

router.get("/news", requireAuth, async (req, res) => {
  try {
    const [storedItems, liveItems] = await Promise.all([
      db.select().from(newsTable).where(eq(newsTable.isPublished, true)).orderBy(desc(newsTable.createdAt)).limit(50),
      fetchLiveNews(),
    ]);
    const stored = storedItems.map((item) => ({
      ...item,
      sourceName: item.sourceName ?? item.authorName ?? undefined,
      publishedAt: item.publishedAt?.toISOString() ?? item.createdAt?.toISOString(),
      createdAt: item.createdAt?.toISOString(),
      isLive: false,
    }));
    const items = [...stored, ...liveItems]
      .sort((a, b) =>
        Number(isOfficialNavodayaSource([String(b.sourceUrl ?? "")])) -
          Number(isOfficialNavodayaSource([String(a.sourceUrl ?? "")])) ||
        new Date(String(b.publishedAt ?? b.createdAt ?? 0)).getTime() -
          new Date(String(a.publishedAt ?? a.createdAt ?? 0)).getTime()
      )
      .slice(0, 50);
    res.json(items);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

router.post("/news", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    if (user.role !== "teacher" && user.role !== "official") {
      return res.status(403).json({ error: "Only teachers and officials can post news" });
    }
    const { title, description, category, sourceName, sourceUrl, imageUrl, publishedAt } = req.body;
    if (!title || !description) return res.status(400).json({ error: "title and description required" });
    if (sourceUrl) {
      try {
        const parsedUrl = new URL(sourceUrl);
        if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error();
      } catch {
        return res.status(400).json({ error: "sourceUrl must be a valid http or https URL" });
      }
    }
    const [item] = await db.insert(newsTable).values({
      title,
      description,
      category: category || "General",
      authorId: user.id,
      authorName: user.fullName,
      jnvName: user.jnvName,
      sourceName: sourceName || user.jnvName,
      sourceUrl: sourceUrl || null,
      imageUrl: imageUrl || null,
      publishedAt: publishedAt ? new Date(publishedAt) : new Date(),
      isPublished: true,
    }).returning();
    res.json(item);
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to post news" });
  }
});

router.delete("/news/:id", requireAuth, async (req, res) => {
  try {
    const user = getUser(req);
    const [item] = await db.select().from(newsTable).where(eq(newsTable.id, req.params.id as string)).limit(1);
    if (!item) return res.status(404).json({ error: "Not found" });
    if (item.authorId !== user.id && user.role !== "official") {
      return res.status(403).json({ error: "Forbidden" });
    }
    await db.delete(newsTable).where(eq(newsTable.id, req.params.id as string));
    res.json({ ok: true });
  } catch (e: any) {
    req.log.error(e);
    res.status(500).json({ error: "Failed to delete" });
  }
});

export default router;
