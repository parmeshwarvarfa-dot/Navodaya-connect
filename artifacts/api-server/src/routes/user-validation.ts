const USER_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUserId(value: unknown): value is string {
  return typeof value === "string" && USER_ID_PATTERN.test(value);
}

export function isSelfReport(reporterId: string, targetId: string): boolean {
  return reporterId.toLowerCase() === targetId.toLowerCase();
}