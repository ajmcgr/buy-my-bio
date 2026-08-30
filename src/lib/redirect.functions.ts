import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const usernameSchema = z.string().min(1).max(40);

export async function resolveSponsorRedirect(
  input: unknown,
  request?: Request,
): Promise<{ destination: string | null; username: string }> {
  const { admin } = await import("./db.server");
  const { safeDestination } = await import("./validate");

  const username = usernameSchema.parse(input).toLowerCase();
  const db = admin();

  const { data: creator } = await db
    .from("creators")
    .select("id, username, banned")
    .eq("username", username)
    .maybeSingle();
  if (!creator) return { destination: null, username };

  const { data: listing } = await db
    .from("listings")
    .select("id, status")
    .eq("creator_id", creator.id)
    .maybeSingle();
  if (!listing) return { destination: null, username };

  const { data: owner } = await db
    .from("ownerships")
    .select("id, destination_url, destination_disabled")
    .eq("listing_id", listing.id)
    .eq("status", "active")
    .maybeSingle();

  let referrer: string | null = null;
  let visitorHash: string | null = null;
  try {
    const req = request ?? (await import("@tanstack/react-start/server")).getRequest();
    referrer = req.headers.get("referer");
    const ip =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "";
    const ua = req.headers.get("user-agent") ?? "";
    if (ip || ua) {
      const buf = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(`${ip}|${ua}|${owner?.id ?? ""}`),
      );
      visitorHash = [...new Uint8Array(buf)]
        .slice(0, 12)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    }
  } catch {
    /* headers unavailable */
  }

  const { error } = await db.rpc("record_click", {
    _listing_id: listing.id,
    _ownership_id: owner?.id ?? null,
    _creator_id: creator.id,
    _referrer: referrer,
    _visitor_hash: visitorHash,
  });
  if (error) {
    console.error("sponsor click recording failed", { username, error: error.message });
  }

  const usable =
    owner && !owner.destination_disabled && !creator.banned && listing.status === "active"
      ? safeDestination(owner.destination_url)
      : null;

  return { destination: usable, username };
}

export const resolveRedirect = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ username: usernameSchema }).parse(input))
  .handler(async ({ data }) => await resolveSponsorRedirect(data.username));
