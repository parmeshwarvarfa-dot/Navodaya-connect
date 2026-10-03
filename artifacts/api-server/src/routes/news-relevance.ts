const NAVODAYA_NEWS_PATTERN =
  /\b(?:jawahar\s+navodaya(?:\s+vidyalayas?)?|navodaya\s+vidyalaya(?:\s+samiti)?|navodaya\s+(?:schools?|students?|teachers?|alumni|community|admissions?)|jnvst|jnv)\b/i;

const OFFICIAL_NAVODAYA_HOSTS = [
  "navodaya.gov.in",
  "nvsadmissionclasssix.in",
  "nvsadmissionclassnine.in",
];

export function isOfficialNavodayaSource(urls: string[] = []): boolean {
  return urls.some((value) => {
    try {
      const hostname = new URL(value).hostname.toLowerCase();
      return OFFICIAL_NAVODAYA_HOSTS.some(
        (domain) => hostname === domain || hostname.endsWith(`.${domain}`),
      );
    } catch {
      return false;
    }
  });
}

export function isRelevantNavodayaNews(
  title: string,
  description: string,
  sourceUrls: string[] = [],
): boolean {
  if (isOfficialNavodayaSource(sourceUrls)) return true;

  const content = `${title} ${description}`;
  if (NAVODAYA_NEWS_PATTERN.test(content)) return true;

  return /\bnvs\b/i.test(content) && /\b(?:navodaya|vidyalaya|jnv|jnvst)\b/i.test(content);
}