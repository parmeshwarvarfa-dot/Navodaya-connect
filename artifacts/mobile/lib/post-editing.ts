export const POST_EDIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Returns true if a post was published within the last 24 hours.
 */
export function isPostEditable(createdAt: Date | string | null | undefined): boolean {
  if (!createdAt) return false;
  const publishedTime = new Date(createdAt).getTime();
  if (Number.isNaN(publishedTime)) return false;
  return Date.now() - publishedTime <= POST_EDIT_WINDOW_MS;
}

/**
 * Returns human-readable time remaining within the 24-hour editing window,
 * or null if the window has expired.
 */
export function formatEditTimeRemaining(createdAt: Date | string | null | undefined): string | null {
  if (!createdAt) return null;
  const publishedTime = new Date(createdAt).getTime();
  if (Number.isNaN(publishedTime)) return null;
  const remainingMs = POST_EDIT_WINDOW_MS - (Date.now() - publishedTime);
  if (remainingMs <= 0) return null;
  const hours = Math.floor(remainingMs / (60 * 60 * 1000));
  const minutes = Math.floor((remainingMs % (60 * 60 * 1000)) / (60 * 1000));
  if (hours > 0) return `${hours}h ${minutes}m left to edit`;
  return `${minutes}m left to edit`;
}
