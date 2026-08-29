/**
 * Escrow-style payouts.
 *
 * Money flows: buyer -> platform Stripe balance (immediately, on checkout).
 * A `payouts` row is created in `pending` with a hold window. Nothing leaves
 * the platform until ALL of the following are true at release time:
 *   - the hold window has elapsed
 *   - the payment is still `applied` and not refunded, live-mode
 *   - the creator's X bio still contains the required BuyMyBio placement
 *   - the creator's connected account has transfers enabled
 */

import { admin } from "./db.server";

const DEFAULT_HOLD_DAYS = 3;

function holdDays(): number {
  const raw = Number(process.env["PAYOUT_HOLD_DAYS"]);
  return Number.isFinite(raw) && raw >= 0 ? raw : DEFAULT_HOLD_DAYS;
}

/** Called after a takeover is applied. Idempotent via the unique payment_id. */
export async function recordPayout(opts: {
  paymentId: string;
  listingId: string;
  ownershipId: string | null;
  grossCents: number;
}) {
  const db = admin();

  const { data: listing } = await db
    .from("listings")
    .select("id, creator_id, platform_fee_percentage")
    .eq("id", opts.listingId)
    .maybeSingle();
  if (!listing) return;

  const feePct = Number(listing.platform_fee_percentage ?? 20);
  const feeCents = Math.round((opts.grossCents * feePct) / 100);
  const netCents = Math.max(0, opts.grossCents - feeCents);

  const holdUntil = new Date(Date.now() + holdDays() * 86_400_000).toISOString();

  const { error } = await db.from("payouts").insert({
    creator_id: listing.creator_id,
    listing_id: listing.id,
    payment_id: opts.paymentId,
    ownership_id: opts.ownershipId,
    gross_cents: opts.grossCents,
    fee_cents: feeCents,
    amount_cents: netCents,
    fee_percentage: feePct,
    hold_until: holdUntil,
    status: "pending",
  });
  // A duplicate key just means the webhook and the success page both settled.
  if (error && !String(error.message).includes("duplicate")) {
    console.error("recordPayout failed", error);
  }
}

export type ReleaseSummary = {
  considered: number;
  paid: number;
  blocked: number;
  failed: number;
  details: { payoutId: string; result: string }[];
};

/** Releases every payout whose hold has elapsed and whose checks still pass. */
export async function releaseDuePayouts(limit = 25): Promise<ReleaseSummary> {
  const db = admin();
  const summary: ReleaseSummary = {
    considered: 0,
    paid: 0,
    blocked: 0,
    failed: 0,
    details: [],
  };

  const { data: due } = await db
    .from("payouts")
    .select("id, creator_id, payment_id, amount_cents, attempts")
    .in("status", ["pending", "blocked"])
    .lte("hold_until", new Date().toISOString())
    .order("hold_until", { ascending: true })
    .limit(limit);

  for (const payout of due ?? []) {
    summary.considered += 1;
    try {
      const result = await releaseOne(payout.id);
      summary.details.push({ payoutId: payout.id, result });
      if (result === "paid") summary.paid += 1;
      else summary.blocked += 1;
    } catch (e) {
      summary.failed += 1;
      summary.details.push({ payoutId: payout.id, result: `failed: ${String(e)}` });
      await db
        .from("payouts")
        .update({ status: "failed", last_error: String(e) })
        .eq("id", payout.id);
    }
  }

  return summary;
}

async function block(payoutId: string, reason: string): Promise<string> {
  await admin()
    .from("payouts")
    .update({ status: "blocked", last_error: reason })
    .eq("id", payoutId);
  return `blocked: ${reason}`;
}

/** Runs all guards for one payout and, when they pass, transfers the funds. */
export async function releaseOne(payoutId: string): Promise<string> {
  const db = admin();

  const { data: payout } = await db
    .from("payouts")
    .select("id, creator_id, payment_id, amount_cents, status, attempts")
    .eq("id", payoutId)
    .maybeSingle();
  if (!payout) return "blocked: payout_missing";
  if (payout.status === "paid") return "paid";
  if (payout.status === "cancelled") return "blocked: cancelled";
  if (payout.amount_cents < 100) return block(payoutId, "amount_below_stripe_minimum");

  await db
    .from("payouts")
    .update({ attempts: Number(payout.attempts ?? 0) + 1 })
    .eq("id", payoutId);

  const { data: payment } = await db
    .from("payments")
    .select("id, status, refund_status, stripe_livemode, stripe_payment_intent, flagged")
    .eq("id", payout.payment_id)
    .maybeSingle();
  if (!payment) return block(payoutId, "payment_missing");
  if (payment.refund_status && payment.refund_status !== "none") {
    await db
      .from("payouts")
      .update({ status: "cancelled", last_error: "payment_refunded" })
      .eq("id", payoutId);
    return "blocked: payment_refunded";
  }
  if (payment.flagged) return block(payoutId, "payment_flagged");
  if (payment.status !== "applied") return block(payoutId, "payment_not_applied");
  if (!payment.stripe_livemode) return block(payoutId, "test_mode_payment");

  const { data: creator } = await db
    .from("creators")
    .select(
      "id, username, banned, x_user_id, x_bio_verified, stripe_account_id, stripe_payouts_enabled",
    )
    .eq("id", payout.creator_id)
    .maybeSingle();
  if (!creator) return block(payoutId, "creator_missing");
  if (creator.banned) return block(payoutId, "creator_banned");
  if (!creator.stripe_account_id) return block(payoutId, "no_connected_account");

  // Re-check the connected account rather than trusting the cached flag.
  const { retrieveAccount, retrievePaymentIntent, createTransfer } = await import(
    "./stripe.server"
  );
  const account = (await retrieveAccount(creator.stripe_account_id)) as Record<string, unknown>;
  const payoutsEnabled = account["payouts_enabled"] === true;
  const transfersActive =
    ((account["capabilities"] as Record<string, string> | undefined)?.["transfers"] ?? "") ===
    "active";
  await db
    .from("creators")
    .update({
      stripe_payouts_enabled: payoutsEnabled,
      stripe_details_submitted: account["details_submitted"] === true,
    })
    .eq("id", creator.id);
  if (!payoutsEnabled || !transfersActive) return block(payoutId, "onboarding_incomplete");

  // The placement must still be live on X right now — this is the whole point
  // of the hold: creators cannot take the money and delete the link.
  const { xConfigured } = await import("./x.server");
  if (creator.x_user_id && xConfigured()) {
    const { lookupPublicProfile, placementPresent } = await import("./x-app.server");
    try {
      const profile = await lookupPublicProfile(String(creator.x_user_id));
      const present = placementPresent(profile, creator.username);
      await db
        .from("creators")
        .update({
          x_bio_snapshot: profile.description,
          x_follower_count: profile.followers,
          ...(present ? {} : { x_bio_verified: false }),
        })
        .eq("id", creator.id);
      if (!present) return block(payoutId, "placement_missing_on_x");
    } catch (e) {
      return block(payoutId, `x_lookup_failed: ${String(e)}`);
    }
  } else if (!creator.x_bio_verified) {
    return block(payoutId, "bio_not_verified");
  }

  // Prefer settling against the original charge so the funds are traceable.
  let sourceTransaction: string | null = null;
  if (payment.stripe_payment_intent) {
    try {
      const pi = (await retrievePaymentIntent(payment.stripe_payment_intent)) as Record<
        string,
        unknown
      >;
      const charge = pi["latest_charge"];
      if (typeof charge === "string") sourceTransaction = charge;
    } catch (e) {
      console.error("payment intent lookup failed", e);
    }
  }

  const transfer = await createTransfer({
    amountCents: payout.amount_cents,
    destination: creator.stripe_account_id,
    sourceTransaction,
    payoutId: payout.id,
    paymentId: payout.payment_id,
  });

  await db
    .from("payouts")
    .update({
      status: "paid",
      released_at: new Date().toISOString(),
      stripe_transfer_id: String(transfer["id"]),
      last_error: null,
    })
    .eq("id", payoutId);

  return "paid";
}
