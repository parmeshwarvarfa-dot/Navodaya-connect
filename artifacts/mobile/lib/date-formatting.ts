/**
 * Utility functions for formatting publish timestamps across all features:
 * Displays exact date, time, and relative elapsed time:
 * e.g. "20-11-2026 4 am (2 days ago)" or "23-11-2026 1:15 pm (just now)"
 */

export function formatPublishDateTime(
  value: string | number | Date | null | undefined
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;

  const timeStr =
    minutes === 0
      ? `${hours} ${ampm}`
      : `${hours}:${String(minutes).padStart(2, "0")} ${ampm}`;

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  let agoStr = "just now";
  if (diffSec < 45) {
    agoStr = "just now";
  } else if (diffMin === 1) {
    agoStr = "1 min ago";
  } else if (diffMin < 60) {
    agoStr = `${diffMin} mins ago`;
  } else if (diffHours === 1) {
    agoStr = "1 hour ago";
  } else if (diffHours < 24) {
    agoStr = `${diffHours} hours ago`;
  } else if (diffDays === 1) {
    agoStr = "1 day ago";
  } else if (diffDays < 7) {
    agoStr = `${diffDays} days ago`;
  } else if (diffWeeks === 1) {
    agoStr = "1 week ago";
  } else if (diffWeeks < 5) {
    agoStr = `${diffWeeks} weeks ago`;
  } else if (diffMonths === 1) {
    agoStr = "1 month ago";
  } else if (diffMonths < 12) {
    agoStr = `${diffMonths} months ago`;
  } else if (diffYears === 1) {
    agoStr = "1 year ago";
  } else {
    agoStr = `${diffYears} years ago`;
  }

  return `${day}-${month}-${year} ${timeStr} (${agoStr})`;
}

export function formatTimeAgo(
  value: string | number | Date | null | undefined
): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const diffMs = Math.max(0, Date.now() - date.getTime());
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHours = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSec < 45) return "just now";
  if (diffMin === 1) return "1 min ago";
  if (diffMin < 60) return `${diffMin} mins ago`;
  if (diffHours === 1) return "1 hour ago";
  if (diffHours < 24) return `${diffHours} hours ago`;
  if (diffDays === 1) return "1 day ago";
  return `${diffDays} days ago`;
}

export function parseDateTimeInput(value: string | null | undefined): Date | null {
  const input = value?.trim();
  if (!input) return null;

  const dayFirst = /^(\d{1,2})-(\d{1,2})-(\d{4})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  const legacyYearFirst = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(input);
  const parts = dayFirst
    ? [Number(dayFirst[3]), Number(dayFirst[2]), Number(dayFirst[1]), Number(dayFirst[4]), Number(dayFirst[5]), Number(dayFirst[6] ?? 0)]
    : legacyYearFirst
      ? [Number(legacyYearFirst[1]), Number(legacyYearFirst[2]), Number(legacyYearFirst[3]), Number(legacyYearFirst[4]), Number(legacyYearFirst[5]), Number(legacyYearFirst[6] ?? 0)]
      : null;

  if (parts) {
    const [year, month, day, hours, minutes, seconds] = parts;
    if (
      month < 1 || month > 12 || day < 1 || day > 31 ||
      hours > 23 || minutes > 59 || seconds > 59
    ) return null;
    const date = new Date(year, month - 1, day, hours, minutes, seconds);
    return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
      ? date
      : null;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTimeInput(value: string | number | Date | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
