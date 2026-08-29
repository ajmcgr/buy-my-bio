import { buildPlacementText, normalizeFormat } from "./placement";
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
  ownerUrl: string | null;
  /** Exact text (including the automatic "Sponsored:" label) that must be live in the bio. */
  ownerPlacement: string | null;
  compliance: { status: string; reason: string | null } | null;
  activation: {
    status: string;
    deadline: string | null;
    firstVerifiedAt: string | null;
  } | null;
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
      .select("id, status, compliance_status, non_compliant_reason")
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
    let ownerFormat: string | null = null;
    let ownerUrl: string | null = null;
    let activation: CreatorSession["activation"] = null;
    if (listing) {
      const { data: ownership } = await db
        .from("ownerships")
        .select(
          "bio_message, destination_url, placement_format, placement_status, activation_deadline, first_verified_at",
        )
        .eq("status", "active")
        .eq("listing_id", listing.id)
        .maybeSingle();
      ownerMessage = (ownership?.bio_message as string | null) ?? null;
      ownerFormat = (ownership?.placement_format as string | null) ?? null;
      ownerUrl = (ownership?.destination_url as string | null) ?? null;
      if (ownership) {
        activation = {
          status: String(ownership.placement_status ?? "active"),
          deadline: (ownership.activation_deadline as string | null) ?? null,
          firstVerifiedAt: (ownership.first_verified_at as string | null) ?? null,
        };
      }
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
      ownerUrl,
      ownerPlacement: ownerMessage
        ? buildPlacementText(ownerMessage, ownerUrl, normalizeFormat(ownerFormat))
        : null,
      activation,
      compliance: listing
        ? {
            status: String(listing.compliance_status ?? "compliant"),
            reason: (listing.non_compliant_reason as string | null) ?? null,
          }
        : null,
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


/**
 * Creator-triggered activation check for the CURRENT owner's placement.
 * Clicking is never enough — we re-read the live X bio and only start the
 * 7-day payout hold when the sponsored message + link are actually there.
 */
export const activatePlacement = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenIn.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await import("./db.server");
    const db = admin();
    const { data: c } = await db
      .from("creators")
      .select("id, banned")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!c || c.banned) return { error: "Session expired. Connect X again." } as const;

    const { activateForCreator } = await import("./activation.server");
    const result = await activateForCreator(c.id);
    if (result.state === "activated") return { ok: true } as const;
    if (result.state === "none") return { error: "No sponsorship is waiting for activation." } as const;
    if (result.state === "unavailable")
      return {
        error: "We couldn't read your X profile just now. We'll keep retrying automatically.",
      } as const;
    return {
      error:
        "We couldn't find the sponsor's message and link in your X bio yet. Paste both exactly, save your profile, then check again.",
    } as const;
  });

const disconnectIn = z.object({
  token: z.string().min(10).max(200),
  deleteData: z.boolean().optional(),
});

/**
 * Disconnect the creator's X account (and optionally delete their Buy My Bio data).
 *
 * Disconnecting is always allowed, but it NEVER cancels an obligation:
 * - the listing is suspended so no new buyer can bid,
 * - live/awaiting sponsorships, payouts, refunds and violation history are untouched,
 * - when an obligation is still open we keep the public X user id so the
 *   server-side app-only verification can keep running (no user token involved).
 * Hard deletion is refused while an obligation or any payment history exists.
 */
export const disconnectXAccount = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => disconnectIn.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await import("./db.server");
    const db = admin();

    const { data: c } = await db
      .from("creators")
      .select("id")
      .eq("session_token", data.token)
      .maybeSingle();
    if (!c) return { error: "Session expired. Connect X again." } as const;

    const { data: listing } = await db
      .from("listings")
      .select("id")
      .eq("creator_id", c.id)
      .maybeSingle();

    let hasObligation = false;
    if (listing) {
      const { data: live } = await db
        .from("ownerships")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("status", "active")
        .limit(1);
      if (live && live.length > 0) hasObligation = true;
    }

    const { data: openPayout } = await db
      .from("payouts")
      .select("id")
      .eq("creator_id", c.id)
      .in("status", ["pending", "blocked"])
      .limit(1);
    if (openPayout && openPayout.length > 0) hasObligation = true;

    // Stop new buyers either way. Existing obligations continue unchanged.
    if (listing) await db.from("listings").update({ status: "suspended" }).eq("id", listing.id);

    const wipe: Record<string, unknown> = {
      session_token: null,
      updated_at: new Date().toISOString(),
    };
    if (!hasObligation) {
      // No open obligation: fully unlink the X identity.
      Object.assign(wipe, {
        x_user_id: null,
        x_username: null,
        x_display_name: null,
        x_profile_image_url: null,
        x_profile_url: null,
        x_follower_count: null,
        x_account_verified: false,
        x_account_verified_at: null,
        x_bio_verified: false,
        x_bio_verified_at: null,
        x_bio_verified_method: null,
        x_bio_snapshot: null,
        verification_status: "pending",
      });
    }
    await db.from("creators").update(wipe).eq("id", c.id);

    if (!data.deleteData) return { ok: true, deleted: false, hasObligation } as const;

    // Only hard-delete when nothing is owed and no money ever moved.
    let hasPayments = false;
    if (listing) {
      const { data: pay } = await db
        .from("payments")
        .select("id")
        .eq("listing_id", listing.id)
        .limit(1);
      hasPayments = Boolean(pay && pay.length > 0);
    }
    if (hasObligation || hasPayments)
      return { ok: true, deleted: false, retained: true, hasObligation } as const;

    await db.from("creators").delete().eq("id", c.id);
    return { ok: true, deleted: true, hasObligation: false } as const;
  });

