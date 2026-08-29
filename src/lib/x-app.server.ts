/**
 * App-only (bearer token) reads of a public X profile, used for BIO VERIFIED
 * checks after the creator has already authenticated their account.
 */
import type { XUser } from "./x.server";

export { placementPresent } from "./x.server";

export async function lookupPublicProfile(xUserId: string): Promise<XUser> {
  const bearer = process.env["X_BEARER_TOKEN"];
  if (!bearer) throw new Error("X_BEARER_TOKEN is not configured");

  const url = `https://api.twitter.com/2/users/${encodeURIComponent(xUserId)}?user.fields=description,profile_image_url,public_metrics,url,name,username,entities`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
  const body = await res.text();
  if (!res.ok) throw new Error(`X user lookup failed [${res.status}]: ${body}`);

  // X's response contains nested entity shapes that vary by field expansion.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const u = (JSON.parse(body) as { data: Record<string, any> }).data;
  const entities = u["entities"] ?? {};
  const expandedUrls: string[] = [];
  for (const group of [entities?.url?.urls, entities?.description?.urls]) {
    for (const item of group ?? []) {
      if (item?.expanded_url) expandedUrls.push(String(item.expanded_url));
      if (item?.display_url) expandedUrls.push(String(item.display_url));
    }
  }

  return {
    id: String(u["id"]),
    username: String(u["username"]),
    name: String(u["name"] ?? u["username"]),
    description: String(u["description"] ?? ""),
    profile_image_url: u["profile_image_url"] ? String(u["profile_image_url"]) : null,
    url: u["url"] ? String(u["url"]) : null,
    followers: Number(u["public_metrics"]?.followers_count ?? 0),
    expandedUrls,
  };
}
