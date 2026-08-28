const BLOCKED_HOSTS = [
  "localhost",
  "127.0.0.1",
  "0.0.0.0",
  "buymybio.com",
  "www.buymybio.com",
];

/** Returns a normalised https URL, or null if the destination is not allowed. */
export function safeDestination(raw: string): string | null {
  let value = (raw || "").trim();
  if (!value) return null;
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.includes(host)) return null;
  if (!host.includes(".")) return null;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  if (host.endsWith(".local") || host.endsWith(".internal")) return null;
  url.hash = "";
  return url.toString();
}

export function safeLogoUrl(raw?: string | null): string | null {
  if (!raw) return null;
  const url = safeDestination(raw);
  return url;
}

export function isEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}
