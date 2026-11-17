type ApiUrlOptions = {
  configuredApiUrl?: string;
  domain?: string;
  metroHostUri?: string | null;
  browserOrigin?: string;
  native: boolean;
  development: boolean;
};

export function resolveApiBaseUrl({ configuredApiUrl, domain, metroHostUri, browserOrigin, native, development }: ApiUrlOptions): string {
  const configured = configuredApiUrl?.trim().replace(/\/+$/, "");
  const localApi = configured && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?(?:\/|$)/i.test(configured);

  if (!native && development && browserOrigin && (!configured || localApi)) {
    return `${new URL(browserOrigin).origin}/api`;
  }

  // Metro forwards /api to the local backend. Sharing its origin also works
  // through a phone-preview tunnel, where a separate :3001 is not reachable.
  if (native && development && metroHostUri && (!configured || localApi)) {
    const metro = new URL(metroHostUri.includes("://") ? metroHostUri : `http://${metroHostUri}`);
    if (metro.port === "443" || /\.(exp\.direct|trycloudflare\.com|ngrok(?:-free)?\.(?:app|io))$/i.test(metro.hostname)) {
      metro.protocol = "https:";
      if (metro.port === "443") metro.port = "";
    }
    return `${metro.origin}/api`;
  }

  if (configured) return configured;
  if (domain?.trim()) return `https://${domain.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "")}/api`;
  return "http://localhost:3001/api";
}
