/**
 * Purchase -> activation -> payout lifecycle.
 *
 * A successful payment never means the creator earned the money. Every
 * purchase moves through:
 *   awaiting_activation -> active -> outbid
 *   awaiting_activation -> activation_failed | superseded_before_activation
 *   active -> non_compliant
 *
 * Payout eligibility is tracked separately on `payouts`
 * (not_eligible -> pending -> released | blocked) and the 7-day hold starts at
 * FIRST successful live verification, never at payment time.
 */

import { admin } from "./db.server";
import { WEBSITE_ONLY_SPONSORSHIP } from "./placement";

export const ACTIVATION_WINDOW_MS = 24 * 60 * 60 * 1000;
const PAYOUT_HOLD_DAYS = 7;

export function activationDeadlineFrom(iso: string | Date): string {
  const base = typeof iso === "string" ? new Date(iso) : iso;
  return new Date(base.getTime() + ACTIVATION_WINDOW_MS).toISOString();
}

/** Called right after a takeover is applied. Starts the buyer's 24h clock. */
export async function startActivationWindow(ownershipId: string, paidAtIso?: string | null) {
  const db = admin();
  const base = paidAtIso ? new Date(paidAtIso) : new Date();
  await db
    .from("ownerships")
    .update({
      placement_status: "awaiting_activation",
      activation_deadline: activationDeadlineFrom(base),
    })
    .eq("id", ownershipId)
    .is("first_verified_at", null);
}

/**
 * Flags a payment for refund and immediately attempts the automatic Stripe
 * refund. The queue picks up anything that fails here.
 */
export async function flagForRefund(paymentId: string, reason: string) {
  const db = admin();
  await db
    .from("payments")
    .update({
      needs_refund: true,
      needs_refund_reason: reason,
      needs_refund_at: new Date().toISOString(),
      flagged: true,
      admin_notes: `refund required: ${reason}`,
    })
    .eq("id", paymentId);

  const { recordEvent } = await import("./events.server");
  await recordEvent("refund_queued", { paymentId, detail: { reason } });

  try {
    const { refundPayment, normalizeReason } = await import("./refunds.server");
    await refundPayment(paymentId, normalizeReason(reason));
  } catch (e) {
    console.error("automatic refund attempt failed", paymentId, e);
  }
}

async function killPayout(paymentId: string, reason: string) {
  const db = admin();
  await db
    .from("payouts")
    .update({ status: "cancelled", payout_status: "blocked", last_error: reason })
    .eq("payment_id", paymentId)
    .neq("status", "paid");
}

/**
 * First successful live verification. Sets activated_at / first_verified_at and
 * only NOW starts the payout hold: release_at = first_verified_at + 7 days.
 */
export async function markActivated(ownershipId: string, paymentId: string, nowIso: string) {
  const db = admin();
  const { data: existing, error: ownershipReadError } = await db
    .from("ownerships")
    .select("first_verified_at")
    .eq("id", ownershipId)
    .maybeSingle();
  if (ownershipReadError)
    throw new Error(`activation ownership lookup failed: ${ownershipReadError.message}`);
  if (!existing) throw new Error("activation ownership is missing");

  const existingFirstVerifiedAt = existing.first_verified_at as string | null;
  const { data: newlyActivated, error: ownershipUpdateError } = await db
    .from("ownerships")
    .update({
      placement_status: "active",
      activated_at: nowIso,
      first_verified_at: nowIso,
      bio_verification_status: "verified",
      last_bio_verified_at: nowIso,
      last_verification_attempt_at: nowIso,
      last_verification_error: null,
      verification_failure_at: null,
      verification_failure_reason: null,
    })
    .eq("id", ownershipId)
    .is("first_verified_at", null)
    .select("first_verified_at")
    .maybeSingle();
  if (ownershipUpdateError)
    throw new Error(`activation ownership update failed: ${ownershipUpdateError.message}`);

  const firstVerifiedAt =
    (newlyActivated?.first_verified_at as string | null) ?? existingFirstVerifiedAt;
  if (!firstVerifiedAt) throw new Error("activation timestamp was not recorded");

  const releaseAt = new Date(
    new Date(firstVerifiedAt).getTime() + PAYOUT_HOLD_DAYS * 86_400_000,
  ).toISOString();

  const { error: payoutUpdateError } = await db
    .from("payouts")
    .update({
      first_verified_at: firstVerifiedAt,
      release_at: releaseAt,
      hold_until: releaseAt,
      payout_status: "pending",
      bio_verification_status: "verified",
      last_bio_verified_at: nowIso,
      last_verification_attempt_at: nowIso,
      last_verification_error: null,
    })
    .eq("payment_id", paymentId)
    .neq("status", "paid");
  if (payoutUpdateError)
    throw new Error(`activation payout update failed: ${payoutUpdateError.message}`);

  // The first writer emits lifecycle activity and emails. Retries only repair
  // database state, avoiding duplicate activity for the same sponsorship.
  if (newlyActivated) {
    const { recordEvent } = await import("./events.server");
    await recordEvent("placement_verified", {
      paymentId,
      ownershipId,
      detail: { first_verified_at: firstVerifiedAt },
    });
  }
}

/** 24h elapsed with no successful verification. Creator earns nothing. */
export async function failActivation(
  ownershipId: string,
  paymentId: string,
  reason = "activation_deadline_missed",
) {
  const db = admin();
  const now = new Date().toISOString();
  await db
    .from("ownerships")
    .update({
      placement_status: "activation_failed",
      status: "ended",
      ended_at: now,
      placement_ended_at: now,
      placement_end_reason: "activation_failed",
      bio_verification_status: "failed",
      verification_failure_at: now,
      verification_failure_reason: reason,
    })
    .eq("id", ownershipId);
  await killPayout(paymentId, reason);
  await flagForRefund(paymentId, reason);
}

/**
 * A newer buyer paid more before this purchase was ever verified live. The
 * creator never delivered it, so it can never become a payout.
 */
export async function supersedeUnactivated(listingId: string, keepOwnershipId: string) {
  const db = admin();
  const { data: rows } = await db
    .from("ownerships")
    .select("id, payment_id")
    .eq("listing_id", listingId)
    .neq("id", keepOwnershipId)
    .is("first_verified_at", null)
    .in("placement_status", ["awaiting_activation"]);

  const now = new Date().toISOString();
  for (const row of rows ?? []) {
    await db
      .from("ownerships")
      .update({
        placement_status: "superseded_before_activation",
        status: "ended",
        ended_at: now,
        placement_ended_at: now,
        placement_end_reason: "superseded_before_activation",
      })
      .eq("id", row.id);
    await killPayout(row.payment_id, "superseded_before_activation");
    await flagForRefund(row.payment_id, "superseded_before_activation");
  }
}

export type ActivationSummary = {
  checked: number;
  activated: number;
  waiting: number;
  failed: number;
  unavailable: number;
};

/**
 * Verifies pending placements against the live X bio and enforces the 24-hour
 * activation deadline. An X API failure NEVER fails an activation — we only act
 * on the deadline once the API has actually answered.
 */
export async function runActivationSweep(limit = 50): Promise<ActivationSummary> {
  const db = admin();
  const summary: ActivationSummary = {
    checked: 0,
    activated: 0,
    waiting: 0,
    failed: 0,
    unavailable: 0,
  };
  // No X activation exists in website-only mode.
  if (WEBSITE_ONLY_SPONSORSHIP) return summary;

  const { data: pending } = await db
    .from("ownerships")
    .select(
      "id, listing_id, payment_id, bio_message, destination_url, placement_format, activation_deadline, started_at",
    )
    .eq("status", "active")
    .eq("placement_status", "awaiting_activation")
    .is("first_verified_at", null)
    .limit(limit);

  const { checkPlacement } = await import("./verification.server");

  for (const o of pending ?? []) {
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

    summary.checked += 1;
    const now = new Date().toISOString();
    const result = await checkPlacement({
      creatorId: creator.id,
      username: creator.username,
      xUserId: creator.x_user_id ? String(creator.x_user_id) : null,
      message: (o.bio_message as string | null) ?? null,
      url: (o.destination_url as string | null) ?? null,
      placementFormat: (o.placement_format as string | null) ?? null,
    });

    if (result.outcome === "unavailable") {
      summary.unavailable += 1;
      await db
        .from("ownerships")
        .update({ last_verification_attempt_at: now, last_verification_error: result.error })
        .eq("id", o.id);
      await db.from("verification_checks").insert({
        creator_id: creator.id,
        status: "unavailable",
        detail: `activation: ${result.error}`,
      });
      continue;
    }

    if (result.outcome === "match") {
      summary.activated += 1;
      await markActivated(o.id, o.payment_id, now);
      await db.from("verification_checks").insert({
        creator_id: creator.id,
        status: "verified",
        detail: "activation",
      });
      continue;
    }

    const deadline =
      (o.activation_deadline as string | null) ??
      activationDeadlineFrom((o.started_at as string) ?? now);
    if (new Date(deadline).getTime() <= Date.now()) {
      summary.failed += 1;
      await failActivation(o.id, o.payment_id);
      await db
        .from("listings")
        .update({
          compliance_status: "non_compliant",
          non_compliant_since: now,
          non_compliant_reason: "activation_deadline_missed",
          status: "suspended",
        })
        .eq("id", listing.id);
      await db.from("placement_violations").insert({
        creator_id: creator.id,
        listing_id: listing.id,
        ownership_id: o.id,
        phase: "activation",
        reason: "activation_deadline_missed",
        bio_snapshot: result.snapshot,
      });
      continue;
    }

    summary.waiting += 1;
    await db
      .from("ownerships")
      .update({ last_verification_attempt_at: now, last_verification_error: null })
      .eq("id", o.id);
  }

  return summary;
}

/** Same check, on demand, for one creator (creator dashboard button). */
export async function activateForCreator(
  creatorId: string,
): Promise<
  | { state: "none" }
  | { state: "activated" }
  | { state: "waiting"; reason: string }
  | { state: "unavailable"; error: string }
> {
  const db = admin();
  const { data: listing } = await db
    .from("listings")
    .select("id")
    .eq("creator_id", creatorId)
    .maybeSingle();
  if (!listing) return { state: "none" };

  const { data: o } = await db
    .from("ownerships")
    .select("id, payment_id, bio_message, destination_url, placement_format")
    .eq("listing_id", listing.id)
    .eq("status", "active")
    .is("first_verified_at", null)
    .maybeSingle();
  if (!o) return { state: "none" };

  const { data: creator } = await db
    .from("creators")
    .select("id, username, x_user_id")
    .eq("id", creatorId)
    .maybeSingle();
  if (!creator) return { state: "none" };

  const { checkPlacement } = await import("./verification.server");
  const result = await checkPlacement({
    creatorId: creator.id,
    username: creator.username,
    xUserId: creator.x_user_id ? String(creator.x_user_id) : null,
    message: (o.bio_message as string | null) ?? null,
    url: (o.destination_url as string | null) ?? null,
    placementFormat: (o.placement_format as string | null) ?? null,
  });

  if (result.outcome === "unavailable") return { state: "unavailable", error: result.error };
  if (result.outcome === "mismatch") return { state: "waiting", reason: result.reason };

  await markActivated(o.id, o.payment_id, new Date().toISOString());
  return { state: "activated" };
}
