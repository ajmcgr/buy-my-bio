/**
 * Continuous placement verification.
 *
 * The current owner's sponsored message + sponsored URL must stay live in the
 * creator's X bio. We re-read the live profile through the X API and record
 * every check. A CONFIRMED mismatch (the API answered and the placement is
 * gone/changed) fails the placement. A technical failure (rate limit, timeout,
 * API error) is recorded and retried — it never punishes the creator.
 */

import { admin } from "./db.server";
import type { XUser } from "./x.server";

export const VERIFY_INTERVAL_MS = 24 * 60 * 60 * 1000;

export type VerifyOutcome =
  | { outcome: "match" }
  | { outcome: "mismatch"; reason: string; snapshot: string }
  | { outcome: "unavailable"; error: string };

/** Loose text match: case-insensitive, whitespace/punctuation tolerant. */
export function normalizeBioText(value: string): string {
  return value
    .toLowerCase()
    .replace(/https?:\/\//g, "")
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[^a-z0-9'@.\/_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function haystackOf(profile: {
  description: string;
  url: string | null;
  expandedUrls: string[];
}): string {
  return normalizeBioText(
    [profile.description, profile.url ?? "", ...(profile.expandedUrls ?? [])].join(" "),
  );
}

export function bioContainsMessage(
  profile: { description: string; url: string | null; expandedUrls: string[] },
  message: string,
): boolean {
  const needle = normalizeBioText(message);
  if (!needle) return false;
  return haystackOf(profile).includes(needle);
}

/** host + path of the sponsored URL, which is what shows up in a bio. */
export function urlNeedle(raw: string): string {
  try {
    const u = new URL(raw);
    const path = u.pathname.replace(/\/$/, "");
    return normalizeBioText(`${u.hostname.replace(/^www\./, "")}${path}`);
  } catch {
    return normalizeBioText(raw);
  }
}

export function bioContainsUrl(
  profile: { description: string; url: string | null; expandedUrls: string[] },
  url: string,
): boolean {
  const needle = urlNeedle(url);
  if (!needle) return false;
  return haystackOf(profile).includes(needle);
}

/**
 * Reads the creator's live X profile and checks the required placement.
 * `message` and `url` come from the CURRENT owner.
 */
export async function checkPlacement(opts: {
  creatorId: string;
  username: string;
  xUserId: string | null;
  message: string | null;
  url: string | null;
}): Promise<VerifyOutcome> {
  const { xConfigured } = await import("./x.server");
  if (!opts.xUserId || !xConfigured()) {
    return { outcome: "unavailable", error: "x_not_configured" };
  }

  const { lookupPublicProfile, placementPresent } = await import("./x-app.server");
  let profile: XUser;
  try {
    profile = await lookupPublicProfile(String(opts.xUserId));
  } catch (e) {
    return { outcome: "unavailable", error: `x_lookup_failed: ${String(e)}` };
  }

  const db = admin();
  await db
    .from("creators")
    .update({ x_bio_snapshot: profile.description, x_follower_count: profile.followers })
    .eq("id", opts.creatorId);

  const message = (opts.message ?? "").trim();
  const url = (opts.url ?? "").trim();

  // Legacy slots bought before custom messages: fall back to the link check.
  if (!message && !url) {
    return placementPresent(profile, opts.username)
      ? { outcome: "match" }
      : { outcome: "mismatch", reason: "placement_missing_on_x", snapshot: profile.description };
  }

  const messageOk = message ? bioContainsMessage(profile, message) : true;
  const urlOk = url ? bioContainsUrl(profile, url) : true;
  if (messageOk && urlOk) return { outcome: "match" };

  return {
    outcome: "mismatch",
    reason: !messageOk && !urlOk
      ? "sponsored_message_and_url_missing"
      : !messageOk
        ? "sponsored_message_missing"
        : "sponsored_url_missing",
    snapshot: profile.description,
  };
}

export type SweepSummary = {
  checked: number;
  verified: number;
  mismatched: number;
  unavailable: number;
  skipped: number;
};

/**
 * Daily sweep across every active placement (during the 7-day hold AND after
 * payout, because the buyer owns the slot until someone pays more).
 */
export async function runPlacementSweep(limit = 50): Promise<SweepSummary> {
  const db = admin();
  const summary: SweepSummary = {
    checked: 0,
    verified: 0,
    mismatched: 0,
    unavailable: 0,
    skipped: 0,
  };
  const cutoff = new Date(Date.now() - VERIFY_INTERVAL_MS).toISOString();

  const { data: ownerships } = await db
    .from("ownerships")
    .select(
      "id, listing_id, payment_id, bio_message, destination_url, last_verification_attempt_at",
    )
    .eq("status", "active")
    .not("first_verified_at", "is", null)
    .limit(limit);

  for (const o of ownerships ?? []) {
    if (o.last_verification_attempt_at && o.last_verification_attempt_at > cutoff) {
      summary.skipped += 1;
      continue;
    }

    const { data: listing } = await db
      .from("listings")
      .select("id, creator_id, status, compliance_status")
      .eq("id", o.listing_id)
      .maybeSingle();
    if (!listing) continue;

    const { data: creator } = await db
      .from("creators")
      .select("id, username, x_user_id")
      .eq("id", listing.creator_id)
      .maybeSingle();
    if (!creator) continue;

    summary.checked += 1;
    const now = new Date().toISOString();
    const result = await checkPlacement({
      creatorId: creator.id,
      username: creator.username,
      xUserId: creator.x_user_id ? String(creator.x_user_id) : null,
      message: (o.bio_message as string | null) ?? null,
      url: (o.destination_url as string | null) ?? null,
    });

    const { data: payout } = await db
      .from("payouts")
      .select("id, status")
      .eq("payment_id", o.payment_id)
      .maybeSingle();

    if (result.outcome === "unavailable") {
      summary.unavailable += 1;
      await db
        .from("ownerships")
        .update({ last_verification_attempt_at: now, last_verification_error: result.error })
        .eq("id", o.id);
      if (payout)
        await db
          .from("payouts")
          .update({ last_verification_attempt_at: now, last_verification_error: result.error })
          .eq("id", payout.id);
      await db.from("verification_checks").insert({
        creator_id: creator.id,
        status: "unavailable",
        detail: result.error,
      });
      continue;
    }

    if (result.outcome === "match") {
      summary.verified += 1;
      const patch = {
        last_verification_attempt_at: now,
        last_verification_error: null,
        last_bio_verified_at: now,
        bio_verification_status: "verified",
      };
      await db.from("ownerships").update(patch).eq("id", o.id);
      if (payout) await db.from("payouts").update(patch).eq("id", payout.id);
      await db.from("verification_checks").insert({ creator_id: creator.id, status: "verified" });
      // Restore a listing that was suspended for non-compliance.
      if (listing.compliance_status === "non_compliant") {
        await db
          .from("listings")
          .update({
            compliance_status: "compliant",
            non_compliant_since: null,
            non_compliant_reason: null,
            ...(listing.status === "suspended" ? { status: "active" } : {}),
          })
          .eq("id", listing.id);
        await db.from("creators").update({ x_bio_verified: true }).eq("id", creator.id);
      }
      continue;
    }

    // Confirmed mismatch — but first make sure this buyer is STILL the current
    // owner. If a newer buyer legitimately paid more between the two reads,
    // the old message is expected to be gone: that is an outbid, not a
    // violation, and the old payout stays eligible.
    const { data: fresh } = await db
      .from("ownerships")
      .select("status")
      .eq("id", o.id)
      .maybeSingle();
    if (!fresh || fresh.status !== "active") {
      summary.skipped += 1;
      continue;
    }

    summary.mismatched += 1;
    const phase = payout && payout.status === "paid" ? "post_payout" : "hold";
    const failPatch = {
      last_verification_attempt_at: now,
      last_verification_error: null,
      bio_verification_status: "failed",
      verification_failure_at: now,
      verification_failure_reason: result.reason,
    };
    await db
      .from("ownerships")
      .update({
        ...failPatch,
        placement_status: "non_compliant",
        placement_end_reason: "seller_removed",
      })
      .eq("id", o.id);
    if (payout) {
      await db
        .from("payouts")
        .update({
          ...failPatch,
          ...(payout.status === "pending" || payout.status === "blocked"
            ? {
                status: "cancelled",
                payout_status: "blocked",
                last_error: `verification_failed: ${result.reason}`,
              }
            : {}),
        })
        .eq("id", payout.id);
    }
    await db.from("placement_violations").insert({
      creator_id: creator.id,
      listing_id: listing.id,
      ownership_id: o.id,
      payout_id: payout?.id ?? null,
      phase,
      reason: result.reason,
      bio_snapshot: result.snapshot,
    });
    await db.from("verification_checks").insert({
      creator_id: creator.id,
      status: "failed",
      detail: result.reason,
    });
    await db.from("creators").update({ x_bio_verified: false }).eq("id", creator.id);
    // Suspend the listing: no new buyers while the placement is missing.
    await db
      .from("listings")
      .update({
        status: "suspended",
        compliance_status: "non_compliant",
        non_compliant_since: now,
        non_compliant_reason: result.reason,
      })
      .eq("id", listing.id);
  }

  return summary;
}
