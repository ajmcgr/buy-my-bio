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
  pending: number;
  recovered: number;
  unavailable: number;
  skipped: number;
};

/** How long we wait before confirming a mismatch on a live placement. */
export const MISMATCH_CONFIRM_MS = 15 * 60 * 1000;

type PlacementCtx = {
  ownershipId: string;
  listingId: string;
  paymentId: string;
  creatorId: string;
  payoutId: string | null;
  payoutStatus: string | null;
};

/**
 * Terminal non-compliance for a placement whose mismatch has been CONFIRMED by
 * a second successful read (or by the final read taken at an outbid).
 */
export async function failPlacement(
  ctx: PlacementCtx,
  reason: string,
  snapshot: string | null,
  phase: "hold" | "post_payout" | "transition",
) {
  const db = admin();
  const now = new Date().toISOString();

  const failPatch = {
    last_verification_attempt_at: now,
    last_verification_error: null,
    bio_verification_status: "failed",
    verification_failure_at: now,
    verification_failure_reason: reason,
  };

  await db
    .from("ownerships")
    .update({
      ...failPatch,
      placement_status: "non_compliant",
      placement_end_reason: "seller_removed",
      final_verification_status: "failed",
      final_verification_checked_at: now,
      mismatch_pending_since: null,
      mismatch_recheck_at: null,
      mismatch_reason: reason,
    })
    .eq("id", ctx.ownershipId);

  if (ctx.payoutId) {
    await db
      .from("payouts")
      .update({
        ...failPatch,
        final_verification_status: "failed",
        ...(ctx.payoutStatus === "pending" || ctx.payoutStatus === "blocked"
          ? {
              status: "cancelled",
              payout_status: "blocked",
              last_error: `verification_failed: ${reason}`,
            }
          : {}),
      })
      .eq("id", ctx.payoutId);
  }

  await db.from("placement_violations").insert({
    creator_id: ctx.creatorId,
    listing_id: ctx.listingId,
    ownership_id: ctx.ownershipId,
    payout_id: ctx.payoutId,
    phase,
    reason,
    bio_snapshot: snapshot,
  });
  await db.from("verification_checks").insert({
    creator_id: ctx.creatorId,
    status: "failed",
    detail: reason,
  });
  await db.from("creators").update({ x_bio_verified: false }).eq("id", ctx.creatorId);
  await db
    .from("listings")
    .update({
      status: "suspended",
      compliance_status: "non_compliant",
      non_compliant_since: now,
      non_compliant_reason: reason,
    })
    .eq("id", ctx.listingId);

  const { recordEvent } = await import("./events.server");
  await recordEvent("verification_failed", {
    paymentId: ctx.paymentId,
    listingId: ctx.listingId,
    ownershipId: ctx.ownershipId,
    payoutId: ctx.payoutId,
    detail: { reason, phase, confirmed: true },
  });
  await recordEvent("listing_suspended", {
    listingId: ctx.listingId,
    detail: { reason },
  });

  // Buyer protection: the creator removed a placement the buyer paid for.
  const { refundPayment } = await import("./refunds.server");
  await refundPayment(ctx.paymentId, "creator_removed_active_placement");

  try {
    const { creatorEmail } = await import("./notify.server");
    const contactEmail = await creatorEmail(ctx.creatorId);
    if (contactEmail) {
      const { sendListingSuspendedEmail } = await import("./email.server");
      await sendListingSuspendedEmail({ to: contactEmail, reason });
    }
  } catch (e) {
    console.error("suspension email failed", e);
  }
}

/** First confirmed mismatch on a live placement: warn, don't punish yet. */
async function openMismatchWarning(ctx: PlacementCtx, reason: string) {
  const db = admin();
  const now = new Date().toISOString();
  const recheckAt = new Date(Date.now() + MISMATCH_CONFIRM_MS).toISOString();

  await db
    .from("ownerships")
    .update({
      last_verification_attempt_at: now,
      last_verification_error: null,
      bio_verification_status: "mismatch_pending",
      mismatch_pending_since: now,
      mismatch_recheck_at: recheckAt,
      mismatch_reason: reason,
    })
    .eq("id", ctx.ownershipId);
  if (ctx.payoutId)
    await db
      .from("payouts")
      .update({
        last_verification_attempt_at: now,
        bio_verification_status: "mismatch_pending",
      })
      .eq("id", ctx.payoutId);

  await db.from("verification_checks").insert({
    creator_id: ctx.creatorId,
    status: "mismatch_pending",
    detail: reason,
  });

  const { recordEvent } = await import("./events.server");
  await recordEvent("verification_mismatch_pending", {
    paymentId: ctx.paymentId,
    listingId: ctx.listingId,
    ownershipId: ctx.ownershipId,
    payoutId: ctx.payoutId,
    detail: { reason },
  });

  try {
    const { creatorEmail } = await import("./notify.server");
    const to = await creatorEmail(ctx.creatorId);
    if (to) {
      const { sendPlacementMismatchWarningEmail } = await import("./email.server");
      await sendPlacementMismatchWarningEmail({ to, reason });
    }
  } catch (e) {
    console.error("mismatch warning email failed", e);
  }
}

/** The placement came back. Clear the warning, keep everything valid. */
async function clearMismatchWarning(ctx: PlacementCtx) {
  const db = admin();
  await db
    .from("ownerships")
    .update({ mismatch_pending_since: null, mismatch_recheck_at: null, mismatch_reason: null })
    .eq("id", ctx.ownershipId);
  await db.from("verification_checks").insert({
    creator_id: ctx.creatorId,
    status: "recovered",
    detail: "placement_restored_before_confirmation",
  });
  const { recordEvent } = await import("./events.server");
  await recordEvent("verification_recovered", {
    paymentId: ctx.paymentId,
    listingId: ctx.listingId,
    ownershipId: ctx.ownershipId,
    payoutId: ctx.payoutId,
    detail: {},
  });
}

/**
 * Daily sweep across every active placement (during the 7-day hold AND after
 * payout, because the buyer owns the slot until someone pays more).
 * A single confirmed mismatch only opens a warning; terminal non-compliance
 * needs a second successful read ~15 minutes later that still mismatches.
 */
export async function runPlacementSweep(limit = 50): Promise<SweepSummary> {
  const db = admin();
  const summary: SweepSummary = {
    checked: 0,
    verified: 0,
    mismatched: 0,
    pending: 0,
    recovered: 0,
    unavailable: 0,
    skipped: 0,
  };
  const cutoff = new Date(Date.now() - VERIFY_INTERVAL_MS).toISOString();
  const nowMs = Date.now();

  const { data: ownerships } = await db
    .from("ownerships")
    .select(
      "id, listing_id, payment_id, bio_message, destination_url, last_verification_attempt_at, mismatch_pending_since, mismatch_recheck_at",
    )
    .eq("status", "active")
    .not("first_verified_at", "is", null)
    .limit(limit);

  for (const o of ownerships ?? []) {
    const pendingConfirmation = Boolean(o.mismatch_pending_since);
    const recheckDue =
      pendingConfirmation &&
      (!o.mismatch_recheck_at || new Date(String(o.mismatch_recheck_at)).getTime() <= nowMs);

    if (pendingConfirmation && !recheckDue) {
      summary.skipped += 1;
      continue;
    }
    if (
      !recheckDue &&
      o.last_verification_attempt_at &&
      o.last_verification_attempt_at > cutoff
    ) {
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

    const ctx: PlacementCtx = {
      ownershipId: o.id,
      listingId: listing.id,
      paymentId: o.payment_id,
      creatorId: creator.id,
      payoutId: payout?.id ?? null,
      payoutStatus: (payout?.status as string | null) ?? null,
    };

    if (result.outcome === "unavailable") {
      // Technical failure. Never punishes the creator, and a pending mismatch
      // stays pending so we can confirm it later.
      summary.unavailable += 1;
      await db
        .from("ownerships")
        .update({
          last_verification_attempt_at: now,
          last_verification_error: result.error,
          ...(pendingConfirmation
            ? { mismatch_recheck_at: new Date(nowMs + MISMATCH_CONFIRM_MS).toISOString() }
            : {}),
        })
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
      if (pendingConfirmation) {
        summary.recovered += 1;
        await clearMismatchWarning(ctx);
      }
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
    // the old message is expected to be gone: that transition is handled by the
    // final verification taken at takeover time, not here.
    const { data: fresh } = await db
      .from("ownerships")
      .select("status")
      .eq("id", o.id)
      .maybeSingle();
    if (!fresh || fresh.status !== "active") {
      summary.skipped += 1;
      continue;
    }

    if (!pendingConfirmation) {
      summary.pending += 1;
      await openMismatchWarning(ctx, result.reason);
      continue;
    }

    summary.mismatched += 1;
    await failPlacement(
      ctx,
      result.reason,
      result.snapshot,
      payout && payout.status === "paid" ? "post_payout" : "hold",
    );
  }

  return summary;
}

/* -------------------------------------------------------------------------
 * Final verification at an ownership transition.
 *
 * When a new buyer takes an ACTIVE slot, the outgoing owner's placement is
 * read fresh from X *before* the DB ownership row flips. Only that read makes
 * the outgoing transaction payout-eligible — a row changing to OUTBID never
 * does on its own.
 * ---------------------------------------------------------------------- */

export type OutgoingCheck = {
  ownershipId: string;
  listingId: string;
  paymentId: string;
  creatorId: string;
  outcome: VerifyOutcome;
};

/** Reads the outgoing owner's placement while they are still the current owner. */
export async function verifyOutgoingBeforeTakeover(
  listingId: string,
): Promise<OutgoingCheck | null> {
  const db = admin();
  const { data: o } = await db
    .from("ownerships")
    .select("id, payment_id, bio_message, destination_url, first_verified_at, placement_status")
    .eq("listing_id", listingId)
    .eq("status", "active")
    .not("first_verified_at", "is", null)
    .maybeSingle();
  if (!o) return null;

  const { data: listing } = await db
    .from("listings")
    .select("id, creator_id")
    .eq("id", listingId)
    .maybeSingle();
  if (!listing) return null;
  const { data: creator } = await db
    .from("creators")
    .select("id, username, x_user_id")
    .eq("id", listing.creator_id)
    .maybeSingle();
  if (!creator) return null;

  const outcome = await checkPlacement({
    creatorId: creator.id,
    username: creator.username,
    xUserId: creator.x_user_id ? String(creator.x_user_id) : null,
    message: (o.bio_message as string | null) ?? null,
    url: (o.destination_url as string | null) ?? null,
  });

  return {
    ownershipId: o.id,
    listingId: listing.id,
    paymentId: o.payment_id,
    creatorId: creator.id,
    outcome,
  };
}

/**
 * Persists the pre-takeover read AFTER the ownership actually changed hands.
 * Nothing is written when the takeover didn't happen, so a stale "verified"
 * stamp can never be left behind.
 */
export async function applyOutgoingVerification(check: OutgoingCheck): Promise<string> {
  const db = admin();
  const now = new Date().toISOString();

  const { data: payout } = await db
    .from("payouts")
    .select("id, status")
    .eq("payment_id", check.paymentId)
    .maybeSingle();

  // Idempotency: never overwrite a terminal result.
  const { data: current } = await db
    .from("ownerships")
    .select("final_verification_status, final_verification_attempts")
    .eq("id", check.ownershipId)
    .maybeSingle();
  const existing = (current?.final_verification_status as string | null) ?? null;
  if (existing === "verified" || existing === "failed") return existing;

  if (check.outcome.outcome === "match") {
    await db
      .from("ownerships")
      .update({
        final_verification_status: "verified",
        final_verified_at: now,
        final_verification_checked_at: now,
        final_verification_error: null,
        last_bio_verified_at: now,
        last_verification_attempt_at: now,
        last_verification_error: null,
        bio_verification_status: "verified",
        mismatch_pending_since: null,
        mismatch_recheck_at: null,
      })
      .eq("id", check.ownershipId);
    if (payout)
      await db
        .from("payouts")
        .update({
          final_verification_status: "verified",
          final_verified_at: now,
          bio_verification_status: "verified",
          last_bio_verified_at: now,
          last_verification_attempt_at: now,
          last_verification_error: null,
        })
        .eq("id", payout.id);
    await db
      .from("verification_checks")
      .insert({ creator_id: check.creatorId, status: "verified", detail: "transition" });
    return "verified";
  }

  if (check.outcome.outcome === "unavailable") {
    // Do NOT stamp verified, do NOT punish. The payout stays ineligible until
    // the resolver settles it.
    await db
      .from("ownerships")
      .update({
        final_verification_status: "unresolved",
        final_verification_checked_at: now,
        final_verification_error: check.outcome.error,
        final_verification_attempts: Number(current?.final_verification_attempts ?? 0) + 1,
        last_verification_attempt_at: now,
        last_verification_error: check.outcome.error,
      })
      .eq("id", check.ownershipId);
    if (payout && payout.status !== "paid")
      await db
        .from("payouts")
        .update({
          final_verification_status: "unresolved",
          payout_status: "blocked",
          last_verification_attempt_at: now,
          last_verification_error: check.outcome.error,
          last_error: `unable_to_verify_at_transition: ${check.outcome.error}`,
        })
        .eq("id", payout.id);
    await db.from("verification_checks").insert({
      creator_id: check.creatorId,
      status: "unavailable",
      detail: `transition: ${check.outcome.error}`,
    });
    return "unresolved";
  }

  // Confirmed mismatch WHILE the outgoing buyer was still the current owner.
  // A newer purchase does not turn that into a legitimate outbid.
  await failPlacement(
    {
      ownershipId: check.ownershipId,
      listingId: check.listingId,
      paymentId: check.paymentId,
      creatorId: check.creatorId,
      payoutId: payout?.id ?? null,
      payoutStatus: (payout?.status as string | null) ?? null,
    },
    check.outcome.reason,
    check.outcome.snapshot,
    "transition",
  );
  return "failed";
}

export type ResolveSummary = { considered: number; verified: number; unresolved: number };

/**
 * Retries transition verifications that the X API couldn't answer. A retry can
 * only ever CONFIRM the placement (the new owner's message legitimately
 * replaces the old one shortly after, so a late mismatch proves nothing).
 * Anything still unresolved after a few attempts goes to admin review.
 */
export async function resolveUnresolvedFinalVerifications(limit = 25): Promise<ResolveSummary> {
  const db = admin();
  const summary: ResolveSummary = { considered: 0, verified: 0, unresolved: 0 };

  const { data: rows } = await db
    .from("ownerships")
    .select(
      "id, listing_id, payment_id, bio_message, destination_url, final_verification_attempts",
    )
    .eq("final_verification_status", "unresolved")
    .limit(limit);

  for (const o of rows ?? []) {
    summary.considered += 1;
    const attempts = Number(o.final_verification_attempts ?? 0);

    const { data: listing } = await db
      .from("listings")
      .select("id, creator_id")
      .eq("id", o.listing_id)
      .maybeSingle();
    if (!listing) continue;
    const { data: creator } = await db
      .from("creators")
      .select("id, username, x_user_id")
      .eq("id", listing.creator_id)
      .maybeSingle();
    if (!creator) continue;

    const result = await checkPlacement({
      creatorId: creator.id,
      username: creator.username,
      xUserId: creator.x_user_id ? String(creator.x_user_id) : null,
      message: (o.bio_message as string | null) ?? null,
      url: (o.destination_url as string | null) ?? null,
    });

    if (result.outcome === "match") {
      await applyOutgoingVerification({
        ownershipId: o.id,
        listingId: listing.id,
        paymentId: o.payment_id,
        creatorId: creator.id,
        outcome: result,
      } as OutgoingCheck);
      // applyOutgoingVerification returns early on a terminal status, so force
      // the verified stamp here for rows that are still 'unresolved'.
      const now = new Date().toISOString();
      await db
        .from("ownerships")
        .update({
          final_verification_status: "verified",
          final_verified_at: now,
          final_verification_checked_at: now,
          final_verification_error: null,
        })
        .eq("id", o.id)
        .eq("final_verification_status", "unresolved");
      await db
        .from("payouts")
        .update({
          final_verification_status: "verified",
          final_verified_at: now,
          payout_status: "pending",
          last_error: null,
        })
        .eq("payment_id", o.payment_id)
        .neq("status", "paid");
      summary.verified += 1;
      continue;
    }

    summary.unresolved += 1;
    await db
      .from("ownerships")
      .update({
        final_verification_attempts: attempts + 1,
        final_verification_checked_at: new Date().toISOString(),
        final_verification_error:
          result.outcome === "unavailable" ? result.error : `unconfirmed: ${result.reason}`,
      })
      .eq("id", o.id);

    if (attempts + 1 >= 3) {
      // Never punish and never release on a guess: a human decides.
      await db
        .from("payments")
        .update({
          admin_review_required: true,
          admin_review_reason: "transition_verification_unresolved",
          flagged: true,
        })
        .eq("id", o.payment_id);
      const { recordEvent } = await import("./events.server");
      await recordEvent("admin_review_required", {
        paymentId: o.payment_id,
        ownershipId: o.id,
        detail: { reason: "transition_verification_unresolved" },
      });
    }
  }

  return summary;
}

