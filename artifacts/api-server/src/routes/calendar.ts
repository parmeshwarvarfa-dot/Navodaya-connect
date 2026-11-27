import { Router } from "express";
import { requireAuth } from "../lib/auth";

const router = Router();

const GOOGLE_HOLIDAY_CALENDARS = [
  {
    id: "india",
    label: "India",
    calendarId: "en.indian#holiday@group.v.calendar.google.com",
    sourceUrl: "https://calendar.google.com/calendar/u/0/r?cid=en.indian%23holiday%40group.v.calendar.google.com",
  },
  {
    id: "international-us",
    label: "International · United States",
    calendarId: "en.usa#holiday@group.v.calendar.google.com",
    sourceUrl: "https://calendar.google.com/calendar/u/0/r?cid=en.usa%23holiday%40group.v.calendar.google.com",
  },
] as const;

type HolidayEntry = {
  id: string;
  date: string;
  title: string;
  description: string;
  calendar: string;
  sourceUrl: string;
};

const calendarCache = new Map<string, { expiresAt: number; entries: HolidayEntry[] }>();
const CACHE_DURATION_MS = 6 * 60 * 60 * 1000;
const PHOTON_BASE_URL = "https://photon.komoot.io";

function decodeCalendarText(value: string) {
  return value
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function parseCalendarFeed(feed: string, calendar: typeof GOOGLE_HOLIDAY_CALENDARS[number]): HolidayEntry[] {
  const unfolded = feed.replace(/\r?\n[ \t]/g, "");
  const entries: HolidayEntry[] = [];

  for (const block of unfolded.split("BEGIN:VEVENT").slice(1)) {
    const body = block.split("END:VEVENT", 1)[0] ?? "";
    const dateValue = body.match(/^DTSTART(?:;VALUE=DATE)?:(\d{4})(\d{2})(\d{2})$/m);
    const titleValue = body.match(/^SUMMARY(?:;[^:]*)?:(.*)$/m);
    if (!dateValue || !titleValue || /^STATUS:CANCELLED$/m.test(body)) continue;

    const date = `${dateValue[1]}-${dateValue[2]}-${dateValue[3]}`;
    const title = decodeCalendarText(titleValue[1].trim());
    if (!title) continue;
    const descriptionValue = body.match(/^DESCRIPTION(?:;[^:]*)?:(.*)$/m);
    const description = descriptionValue ? decodeCalendarText(descriptionValue[1].trim()) : "";
    entries.push({
      id: `${calendar.id}:${date}:${title.toLocaleLowerCase()}`,
      date,
      title,
      description,
      calendar: calendar.label,
      sourceUrl: calendar.sourceUrl,
    });
  }
  return [...new Map(entries.map((entry) => [entry.id, entry])).values()];
}

async function getCalendarEntries(calendar: typeof GOOGLE_HOLIDAY_CALENDARS[number]) {
  const cached = calendarCache.get(calendar.id);
  if (cached && cached.expiresAt > Date.now()) return cached.entries;

  const url = `https://calendar.google.com/calendar/ical/${encodeURIComponent(calendar.calendarId)}/public/basic.ics`;
  const response = await fetch(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error(`Holiday calendar source returned ${response.status}.`);
  const feed = await response.text();
  if (!feed.startsWith("BEGIN:VCALENDAR")) throw new Error("Holiday calendar source returned invalid calendar data.");

  const entries = parseCalendarFeed(feed, calendar);
  if (!entries.length) throw new Error(`Holiday calendar source returned no ${calendar.label} entries.`);
  calendarCache.set(calendar.id, { entries, expiresAt: Date.now() + CACHE_DURATION_MS });
  return entries;
}

async function getPlaces(url: URL) {
  const response = await fetch(url, {
    headers: { "User-Agent": "NavodayaConnect/1.0 (venue search)" },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Place search source returned ${response.status}.`);
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("features" in body) || !Array.isArray(body.features)) {
    throw new Error("Place search source returned invalid data.");
  }
  return body.features.flatMap((feature: unknown) => {
    if (typeof feature !== "object" || feature === null || !("geometry" in feature) || !("properties" in feature)) return [];
    const geometry = feature.geometry;
    const properties = feature.properties;
    if (
      typeof geometry !== "object" || geometry === null || !("coordinates" in geometry) || !Array.isArray(geometry.coordinates) ||
      typeof properties !== "object" || properties === null
    ) return [];
    const [longitude, latitude] = geometry.coordinates;
    if (typeof longitude !== "number" || typeof latitude !== "number") return [];
    const props = properties as Record<string, unknown>;
    const street = [props.housenumber, props.street].filter((part): part is string => typeof part === "string" && Boolean(part.trim())).join(" ");
    const labelParts = [props.name, street, props.city, props.district, props.state, props.postcode, props.country]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()));
    const label = [...new Set(labelParts)].join(", ");
    return label ? [{ label, coordinates: [longitude, latitude] as [number, number] }] : [];
  });
}

router.get("/calendar/places/search", requireAuth, async (req, res) => {
  const query = typeof req.query.q === "string" ? req.query.q.trim().slice(0, 180) : "";
  if (query.length < 3) return res.status(400).json({ error: "Enter at least 3 characters to search for a place." });
  try {
    const url = new URL("/api/", PHOTON_BASE_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("limit", "6");
    return res.json({ places: await getPlaces(url) });
  } catch (error) {
    req.log.error({ error }, "Failed to search for event venues");
    return res.status(502).json({ error: "Place search is temporarily unavailable. You can enter the venue manually." });
  }
});

router.get("/calendar/places/reverse", requireAuth, async (req, res) => {
  const longitude = typeof req.query.lon === "string" ? Number(req.query.lon) : NaN;
  const latitude = typeof req.query.lat === "string" ? Number(req.query.lat) : NaN;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180 || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
    return res.status(400).json({ error: "Choose a valid point on the map." });
  }
  try {
    const url = new URL("/reverse", PHOTON_BASE_URL);
    url.searchParams.set("lon", String(longitude));
    url.searchParams.set("lat", String(latitude));
    url.searchParams.set("lang", "en");
    const places = await getPlaces(url);
    if (!places.length) return res.status(404).json({ error: "Could not identify that map location. Search for the place by name instead." });
    return res.json({ place: places[0] });
  } catch (error) {
    req.log.error({ error }, "Failed to resolve event venue coordinates");
    return res.status(502).json({ error: "Could not identify that map location. Search for the place by name instead." });
  }
});

router.get("/calendar/holidays", requireAuth, async (req, res) => {
  const { from, to } = req.query;
  if (typeof from !== "string" || typeof to !== "string") {
    return res.status(400).json({ error: "Both from and to dates are required." });
  }
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const rangeLength = toDate.getTime() - fromDate.getTime();
  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime()) ||
    rangeLength < 0 ||
    rangeLength > 366 * 24 * 60 * 60 * 1000
  ) {
    return res.status(400).json({ error: "Choose a valid date range of 366 days or less." });
  }

  const fromDay = from.slice(0, 10);
  const toDay = to.slice(0, 10);
  const results = await Promise.allSettled(GOOGLE_HOLIDAY_CALENDARS.map(getCalendarEntries));
  const entries = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const failedCalendars = results.flatMap((result, index) => result.status === "rejected" ? [GOOGLE_HOLIDAY_CALENDARS[index].label] : []);
  const filtered = entries
    .filter((entry) => entry.date >= fromDay && entry.date <= toDay)
    .sort((left, right) => left.date.localeCompare(right.date) || left.title.localeCompare(right.title));

  if (failedCalendars.length === GOOGLE_HOLIDAY_CALENDARS.length) {
    req.log.error({ failedCalendars }, "Failed to fetch public holiday calendars");
    return res.status(502).json({ error: "Holiday calendars are temporarily unavailable. Please try again." });
  }

  return res.json({
    entries: filtered,
    unavailableCalendars: failedCalendars,
  });
});

export default router;
