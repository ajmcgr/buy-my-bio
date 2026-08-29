import { admin } from "./db.server";
import { WEBSITE_ONLY_SPONSORSHIP } from "./placement";

import { retrieveSession } from "./stripe.server";
import { sendOutbidEmail, humanDuration } from "./email.server";
import { nextPriceCents } from "./format";

export type SettleResult =
  | {
      status: "owned";
      ownershipId: string;
      paymentId: string;
      companyName: string;
      amountCents: number;
      slug: string;
      creatorHandle: string;
      globalRank: number | null;
      previousOwner: string | null;
      recoveryPending?: boolean;
    }
  | { status: "stale"; reason: string; paymentId: string }
  | { status: "payment_error"; reason: string; paymentId: string }
  | { status: "unpaid" }
  | { status: "unknown" };

/**
 * Completes the idempotent work that must exist after an ownership has been
 * applied. This deliberately runs for both a newly applied payment and an
 * `already_applied` retry, so a temporary post-takeover failure is repaired by
 * the next Stripe webhook delivery without recreating ownership or activity.
 */
function logSettlementFailure(
  stage: string,
  opts: { paymentId: string; listingId?: string; ownershipId?: string },
  error: unknown,
) {
  console.error("settlement stage failed", {
    stage,
    paymentId: opts.paymentId,
    listingId: opts.listingId,
    ownershipId: opts.ownershipId,
    error: error instanceof Error ? error.message : String(error),
  });
}

async function ensurePostTakeoverSettlement(opts: {
  paymentId: string;
  listingId: string;
  ownershipId: string;
  collectedCents: number;
  stripeLivemode: boolean;
}): Promise<boolean> {
  let complete = true;
  if (opts.stripeLivemode) {
    try {
      const { recordPayout } = await import("./payouts.server");
      await recordPayout({
        paymentId: opts.paymentId,
        listingId: opts.listingId,
        ownershipId: opts.ownershipId,
        grossCents: opts.collectedCents,
      });
    } catch (error) {
      complete = false;
      logSettlementFailure("payout", opts, error);
    }
  }

  if (WEBSITE_ONLY_SPONSORSHIP) {
    try {
      const { markActivated } = await import("./activation.server");
      await markActivated(opts.ownershipId, opts.paymentId, new Date().toISOString());
    } catch (error) {
      complete = false;
      logSettlementFailure("activation", opts, error);
    }
  }
  return complete;
}

/**
 * Idempotent: verifies the Stripe session server-side, then applies the takeover
 * through a locking SQL function so only one owner can ever exist.
 */
export async function settleCheckoutSession(sessionId: string): Promise<SettleResult> {
  const db = admin();
  let session: Record<string, unknown>;
  try {
    session = (await retrieveSession(sessionId)) as Record<string, unknown>;
  } catch (error) {
    logSettlementFailure("payment_verification", { paymentId: "unknown" }, error);
    throw error;
  }
  const paymentId = (session["metadata"] as Record<string, string> | null)?.["payment_id"];
  if (!paymentId) return { status: "unknown" };

  const { data: payment } = await db
    .from("payments")
    .select(
      "id, listing_id, amount_cents, actual_paid_cents, email, company_name, destination_url, status",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { status: "unknown" };

  if (session["payment_status"] !== "paid") return { status: "unpaid" };

  const amountSubtotalCents = Number(session["amount_subtotal"]);
  const actualPaidCents = Number(session["amount_total"]);
  const paymentIntent = (session["payment_intent"] as string) ?? null;
  const stripeLivemode = session["livemode"] === true;
  const validStripeAmounts =
    Number.isInteger(amountSubtotalCents) &&
    Number.isInteger(actualPaidCents) &&
    amountSubtotalCents === payment.amount_cents &&
    actualPaidCents >= 0 &&
    actualPaidCents <= amountSubtotalCents;

  if (!validStripeAmounts) {
    await db
      .from("payments")
      .update({
        status: "paid",
        stripe_payment_intent: paymentIntent,
        stripe_livemode: stripeLivemode,
        actual_paid_cents: Number.isInteger(actualPaidCents) ? actualPaidCents : null,
        paid_at: new Date().toISOString(),
        flagged: true,
        admin_notes: "checkout subtotal or total did not match the quoted sponsorship bid",
      })
      .eq("id", payment.id);
    // A verification failure after Stripe reports payment must enter the same
    // idempotent refund path as a genuine outbid. If Stripe supplied no intent
    // for a non-zero total, refundPayment records an admin-review obligation
    // rather than silently leaving the buyer stranded.
    if (paymentIntent || actualPaidCents > 0) {
      const { refundPayment } = await import("./refunds.server");
      await refundPayment(payment.id, "concurrent_purchase_conflict");
    }
    return { status: "payment_error", reason: "amount_verification_failed", paymentId: payment.id };
  }

  if (!stripeLivemode && process.env["ALLOW_TEST_PAYMENTS"] !== "true") {
    await db
      .from("payments")
      .update({
        flagged: true,
        admin_notes: "test-mode Stripe payment blocked from takeover",
        actual_paid_cents: actualPaidCents,
        stripe_payment_intent: paymentIntent,
        stripe_livemode: stripeLivemode,
        ...(payment.status === "applied" ? {} : { status: "failed" }),
      })
      .eq("id", payment.id);
    return { status: "stale", reason: "test_mode_not_allowed", paymentId: payment.id };
  }
  await db
    .from("payments")
    .update({
      status: payment.status === "applied" ? "applied" : "paid",
      stripe_payment_intent: paymentIntent,
      stripe_livemode: stripeLivemode,
      actual_paid_cents: actualPaidCents,
      paid_at: new Date().toISOString(),
      flagged: false,
      admin_notes: null,
    })
    .eq("id", payment.id);

  // Capture whether the displaced owner held the trophy before applying the
  // transaction. This powers the special "lost #1" event without inventing a
  // separate bidding system.
  let previousRank: number | null = null;
  try {
    const { loadMarketplace } = await import("./marketplace.server");
    const before = await loadMarketplace("most-valuable");
    previousRank =
      before.rows.find((row) => row.listing.id === payment.listing_id)?.globalRank ?? null;
  } catch (e) {
    console.error("pre-takeover rank lookup failed", e);
  }

  // Website-only sponsorships never depend on the outgoing sponsor's X bio, so
  // no X read happens at a transition. (Legacy path kept for historical rows.)
  let outgoing: Awaited<
    ReturnType<typeof import("./verification.server").verifyOutgoingBeforeTakeover>
  > = null;
  if (!WEBSITE_ONLY_SPONSORSHIP) {
    try {
      const { verifyOutgoingBeforeTakeover } = await import("./verification.server");
      outgoing = await verifyOutgoingBeforeTakeover(payment.listing_id);
    } catch (e) {
      console.error("outgoing placement verification failed", e);
    }
  }

  const { data: result, error: takeoverError } = await db.rpc("apply_takeover", {
    _payment_id: payment.id,
  });
  if (takeoverError) {
    logSettlementFailure(
      "takeover",
      { paymentId: payment.id, listingId: payment.listing_id },
      takeoverError,
    );
    throw new Error(`apply_takeover failed: ${takeoverError.message}`);
  }
  const r = (result ?? {}) as Record<string, unknown>;

  if (!r["ok"]) {
    const reason = String(r["reason"] ?? "unknown");
    const { recordEvent } = await import("./events.server");
    await recordEvent("ownership_conflict", {
      paymentId: payment.id,
      listingId: payment.listing_id,
      detail: { reason },
    });
    // The buyer paid but can never own this slot: refund automatically.
    if (reason === "outbid" || reason === "listing_not_active" || reason === "amount_mismatch") {
      const { refundPayment } = await import("./refunds.server");
      await refundPayment(payment.id, "concurrent_purchase_conflict");
    }
    return { status: "stale", reason, paymentId: payment.id };
  }

  const { data: slugRow } = await db
    .from("listings")
    .select("slug, creator_id")
    .eq("id", payment.listing_id)
    .maybeSingle();
  const slug = slugRow?.slug ?? "";

  if (r["reason"] === "already_applied") {
    const { data: own } = await db
      .from("ownerships")
      .select("id")
      .eq("payment_id", payment.id)
      .maybeSingle();
    const { data: existingCreator } = slugRow
      ? await db
          .from("creators")
          .select("social_handle, x_username")
          .eq("id", slugRow.creator_id)
          .maybeSingle()
      : { data: null };
    if (!own?.id) throw new Error("applied payment is missing its ownership");
    const postSettlementComplete = await ensurePostTakeoverSettlement({
      paymentId: payment.id,
      listingId: payment.listing_id,
      ownershipId: own.id,
      collectedCents: payment.actual_paid_cents ?? actualPaidCents,
      stripeLivemode,
    });
    let existingRank: number | null = null;
    try {
      const { loadMarketplace } = await import("./marketplace.server");
      const market = await loadMarketplace("most-valuable");
      existingRank =
        market.rows.find((row) => row.listing.id === payment.listing_id)?.globalRank ?? null;
    } catch {
      // The ownership remains valid even if a rank refresh is temporarily unavailable.
    }
    const { data: payout } = await db
      .from("payouts")
      .select("release_at")
      .eq("payment_id", payment.id)
      .maybeSingle();
    const { ensureSettlementEmails } = await import("./settlement-notifications.server");
    const emailComplete = postSettlementComplete
      ? await ensureSettlementEmails({
          paymentId: payment.id,
          ownershipId: own.id,
          companyName: payment.company_name,
          buyerEmail: payment.email,
          amountCents: payment.amount_cents,
          destination: payment.destination_url,
          username: slug,
          handle: existingCreator?.x_username ?? existingCreator?.social_handle ?? slug,
          creatorId: slugRow?.creator_id ?? "",
          globalRank: existingRank,
          eligibleDate: (payout?.release_at as string | null) ?? null,
        })
      : false;
    return {
      status: "owned",
      ownershipId: own?.id ?? "",
      paymentId: payment.id,
      companyName: payment.company_name,
      amountCents: payment.amount_cents,
      slug,
      creatorHandle: existingCreator?.x_username ?? existingCreator?.social_handle ?? slug,
      globalRank: existingRank,
      previousOwner: null,
      recoveryPending: !postSettlementComplete || !emailComplete,
    };
  }

  const ownershipId = r["ownership_id"];
  if (typeof ownershipId !== "string" || !ownershipId)
    throw new Error("takeover did not return an ownership id");

  const postSettlementComplete = await ensurePostTakeoverSettlement({
    paymentId: payment.id,
    listingId: payment.listing_id,
    ownershipId,
    collectedCents: actualPaidCents,
    stripeLivemode,
  });

  // The transition happened: record the outgoing owner's final verification.
  // A confirmed mismatch here is creator non-compliance (blocks that payout and
  // refunds that buyer), never a legitimate outbid.
  if (outgoing && outgoing.ownershipId !== ownershipId) {
    try {
      const { applyOutgoingVerification } = await import("./verification.server");
      const outcome = await applyOutgoingVerification(outgoing);
      await recordTransitionEvent(payment.id, outgoing.ownershipId, outcome);
    } catch (e) {
      console.error("applyOutgoingVerification failed", e);
    }
  }

  const { recordEvent } = await import("./events.server");
  await recordEvent("payment_succeeded", {
    paymentId: payment.id,
    listingId: payment.listing_id,
    ownershipId,
    detail: { amount_cents: payment.amount_cents },
  });
  await recordEvent("ownership_started", {
    paymentId: payment.id,
    listingId: payment.listing_id,
    ownershipId,
    detail: { status: WEBSITE_ONLY_SPONSORSHIP ? "live" : "awaiting_activation" },
  });

  if (!WEBSITE_ONLY_SPONSORSHIP) {
    // Legacy: the buyer paid, but the creator has NOT delivered yet.
    try {
      const { startActivationWindow, supersedeUnactivated } = await import("./activation.server");
      await startActivationWindow(ownershipId, new Date().toISOString());
      await supersedeUnactivated(payment.listing_id, ownershipId);
    } catch (e) {
      console.error("activation window setup failed", e);
    }
  }

  // context for emails
  const { data: listing } = await db
    .from("listings")
    .select("id, creator_id, minimum_increase_percentage")
    .eq("id", payment.listing_id)
    .maybeSingle();
  const { data: creator } = listing
    ? await db
        .from("creators")
        .select("username, social_handle")
        .eq("id", listing.creator_id)
        .maybeSingle()
    : { data: null };

  const username = creator?.username ?? "";
  const handle = creator?.social_handle ?? username;

  let globalRank: number | null = null;
  if (stripeLivemode) {
    try {
      const { loadMarketplace } = await import("./marketplace.server");
      const market = await loadMarketplace("most-valuable");
      globalRank =
        market.rows.find((row) => row.listing.id === payment.listing_id)?.globalRank ?? null;
    } catch (e) {
      console.error("post-takeover rank lookup failed", e);
    }
  }

  const { data: ownershipRow } = await db
    .from("ownerships")
    .select("activation_deadline, bio_message")
    .eq("id", ownershipId)
    .maybeSingle();

  if (!WEBSITE_ONLY_SPONSORSHIP) {
    try {
      const { sendBuyerAwaitingActivationEmail, sendCreatorActionRequiredEmail } =
        await import("./email.server");
      await sendBuyerAwaitingActivationEmail({
        to: payment.email,
        handle,
        amountCents: payment.amount_cents,
        message: (ownershipRow?.bio_message as string | null) ?? null,
        destination: payment.destination_url,
      });
      if (listing) {
        const { creatorEmail } = await import("./notify.server");
        const to = await creatorEmail(listing.creator_id);
        if (to)
          await sendCreatorActionRequiredEmail({
            to,
            amountCents: payment.amount_cents,
            message: (ownershipRow?.bio_message as string | null) ?? null,
            destination: payment.destination_url,
            deadline:
              (ownershipRow?.activation_deadline as string | null) ??
              new Date(Date.now() + 86_400_000).toISOString(),
          });
      }
    } catch (e) {
      console.error("activation email failure", e);
    }
  }

  try {
    const prev = r["previous"] as Record<string, unknown> | null;
    if (prev && prev["email"]) {
      await sendOutbidEmail({
        to: String(prev["email"]),
        handle,
        username,
        paidCents: Number(prev["amount_cents"]),
        newPriceCents: nextPriceCents(
          payment.amount_cents,
          Number(listing?.minimum_increase_percentage ?? 10),
        ),
        duration: humanDuration(String(prev["started_at"]), new Date().toISOString()),
        clicks: Number(prev["click_count"] ?? 0),
        lostNumberOne: previousRank === 1,
        newOwner: payment.company_name,
        takeoverAmountCents: payment.amount_cents,
      });
    }
  } catch (e) {
    logSettlementFailure(
      "outbid_email",
      { paymentId: payment.id, listingId: payment.listing_id, ownershipId },
      e,
    );
  }

  const { data: payout } = await db
    .from("payouts")
    .select("release_at")
    .eq("payment_id", payment.id)
    .maybeSingle();
  const { ensureSettlementEmails } = await import("./settlement-notifications.server");
  const emailComplete = postSettlementComplete
    ? await ensureSettlementEmails({
        paymentId: payment.id,
        ownershipId,
        companyName: payment.company_name,
        buyerEmail: payment.email,
        amountCents: payment.amount_cents,
        destination: payment.destination_url,
        username,
        handle,
        creatorId: listing?.creator_id ?? "",
        globalRank,
        eligibleDate: (payout?.release_at as string | null) ?? null,
      })
    : false;

  await db.from("analytics_events").insert({
    name: "checkout_completed",
    listing_id: payment.listing_id,
    props: { amount_cents: payment.amount_cents },
  });

  return {
    status: "owned",
    ownershipId,
    paymentId: payment.id,
    companyName: payment.company_name,
    amountCents: payment.amount_cents,
    slug,
    creatorHandle: handle,
    globalRank,
    recoveryPending: !postSettlementComplete || !emailComplete,
    previousOwner:
      ((r["previous"] as Record<string, unknown> | null)?.["company_name"] as string | undefined) ??
      null,
  };
}

/** Audit trail for the outgoing owner's final verification at a transition. */
async function recordTransitionEvent(
  newPaymentId: string,
  outgoingOwnershipId: string,
  outcome: string,
) {
  try {
    const { recordEvent } = await import("./events.server");
    await recordEvent("outgoing_final_verification", {
      paymentId: newPaymentId,
      ownershipId: outgoingOwnershipId,
      detail: { outcome },
    });
  } catch (e) {
    console.error("transition event failed", e);
  }
}
