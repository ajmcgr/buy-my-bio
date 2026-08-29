import { createServerFn } from "@tanstack/react-start";

const SHARE_ID = "3BTUSlr3W6nAGqWJ";
const GATEWAY = "https://gateway-us.umami.is/api";

type Cached = { at: number; pageviews: number; online: number };
let cache: Cached | null = null;
const TTL_MS = 30_000;

/** Public page-view counters pulled from the Umami public share link. */
export const getSiteTraffic = createServerFn({ method: "GET" }).handler(async () => {
  if (cache && Date.now() - cache.at < TTL_MS) {
    return { pageviews: cache.pageviews, online: cache.online };
  }

  try {
    const shareRes = await fetch(`${GATEWAY}/share/${SHARE_ID}`, {
      headers: { accept: "application/json" },
    });
    if (!shareRes.ok) throw new Error(`umami share [${shareRes.status}]`);
    const share = (await shareRes.json()) as { token: string; websiteId: string };

    const headers = {
      accept: "application/json",
      "x-umami-share-token": share.token,
      "x-umami-share-context": "1",
    };
    const base = `${GATEWAY}/websites/${share.websiteId}`;
    const endAt = Date.now();
    const startAt = Date.UTC(2020, 0, 1);

    const [statsRes, activeRes] = await Promise.all([
      fetch(`${base}/stats?startAt=${startAt}&endAt=${endAt}`, { headers }),
      fetch(`${base}/active`, { headers }),
    ]);
    if (!statsRes.ok) throw new Error(`umami stats [${statsRes.status}]`);

    const stats = (await statsRes.json()) as { pageviews?: number };
    const active = activeRes.ok ? ((await activeRes.json()) as { visitors?: number }) : {};

    const out = {
      pageviews: Number(stats.pageviews ?? 0),
      online: Number(active.visitors ?? 0),
    };
    cache = { at: Date.now(), ...out };
    return out;
  } catch (e) {
    console.error("umami traffic fetch failed", e);
    return cache
      ? { pageviews: cache.pageviews, online: cache.online }
      : { pageviews: 0, online: 0 };
  }
});
