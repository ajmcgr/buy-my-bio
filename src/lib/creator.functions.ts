import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenIn = z.object({ token: z.string().min(10).max(200) });

export type CreatorSession = {
  username: string;
  displayName: string;
  handle: string | null;
  profileImageUrl: string | null;
  profileUrl: string | null;
  followers: number;
  accountVerified: boolean;
  bioVerified: boolean;
  bioVerifiedMethod: string | null;
  listingStatus: string | null;
  requiredPlacement: string;
  banned: boolean;
  bioValueCents: number | null;
  globalRank: number | null;
  ownerName: string | null;
  ownerMessage: string | null;
};

export const getCreatorSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenIn.parse(input))
  .handler(async ({ data }): Promise<CreatorSession | null> => {
    const { admin } = await import("./db.server");
    const { requiredPlacement } = await import("./x.server");
    const db = admin();

    const { data: c } = await db
      .from("creators")
      .select(
        "id, username, display_name, x_username, x_profile_image_url, x_profile_url, x_follower_count, x_account_verified, x_bio_verified, x_bio_verified_method, banned",
      )
      .eq("session_token", data.token)
      .maybeSingle();
    if (!c) return null;

    const { data: listing } = await db
      .from("listings")
      .select("status")
      .eq("creator_id", c.id)
      .maybeSingle();

    let marketRow = null;
    if (c.x_account_verified && c.x_bio_verified) {
      const { loadMarketplace } = await import("./marketplace.server");
      const market = await loadMarketplace("new");
      marketRow =
        [...market.rows, ...market.unowned].find((row) => row.creator.id === c.id) ?? null;
    }

    let ownerMessage: string | null = null;
    if (listing) {
      const { data: ownership } = await db
        .from("ownerships")
        .select("bio_message")
        .eq("status", "active")
        .eq("listing_id", (await db.from("listings").select("id").eq("creator_id", c.id).maybeSingle()).data?.id ?? "")
        .maybeSingle();
      ownerMessage = (ownership?.bio_message as string | null) ?? null;
    }

    return {
      username: c.username,
      displayName: c.display_name,
      handle: c.x_username ?? null,
      profileImageUrl: c.x_profile_image_url ?? null,
      profileUrl: c.x_profile_url ?? null,
      followers: Number(c.x_follower_count ?? 0),
      accountVerified: Boolean(c.x_account_verified),
      bioVerified: Boolean(c.x_bio_verified),
      bioVerifiedMethod: c.x_bio_verified_method ?? null,
      listingStatus: listing?.status ?? null,
      requiredPlacement: requiredPlacement(c.username),
      banned: Boolean(c.banned),
      bioValueCents: marketRow?.bioValueCents ?? null,
      globalRank: marketRow?.globalRank ?? null,
      ownerName: marketRow?.owner?.company_name ?? null,
      ownerMessage,
    };
  });

/**
 * Re-reads the creator's live X profile and only flips BIO VERIFIED when the
 * required placement is actually present right now.
 */
export const verifyMyBio = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenIn.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await import("./db.server");
    const { xConfigured } = await import("./x.server");
    const db = admin();

    const { data: c } = await db
      .from("creators")
      .select("id, username, x_user_id, banned")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!c || c.banned) return { error: "Session expired. Connect X again." } as const;
    if (!c.x_user_id) return { error: "Connect your X account first." } as const;
    if (!xConfigured()) return { error: "X verification isn't configured yet." } as const;

    const { lookupPublicProfile, placementPresent } = await import("./x-app.server");
    let profile;
    try {
      profile = await lookupPublicProfile(String(c.x_user_id));
    } catch (e) {
      console.error("bio verify lookup failed", e);
      return {
        error: "We couldn't read your X profile automatically. An admin will review it shortly.",
      } as const;
    }

    const present = placementPresent(profile, c.username);
    const now = new Date().toISOString();
    await db
      .from("creators")
      .update({
        x_bio_snapshot: profile.description,
        x_follower_count: profile.followers,
        ...(present
          ? { x_bio_verified: true, x_bio_verified_at: now, x_bio_verified_method: "api" }
          : {}),
      })
      .eq("id", c.id);

    if (present) {
      await db.from("listings").update({ status: "active" }).eq("creator_id", c.id);
      return { ok: true } as const;
    }
    return {
      error: `We couldn't find "buymybio.com/${c.username}" in your X profile yet. Add it, save, then try again.`,
    } as const;
  });
