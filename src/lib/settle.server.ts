import { admin } from "./db.server";
import { retrieveSession } from "./stripe.server";
import { sendOutbidEmail, sendWinnerEmail, humanDuration } from "./email.server";
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
    }
  | { status: "stale"; reason: string; paymentId: string }
  | { status: "unpaid" }
  | { status: "unknown" };

/**
 * Idempotent: verifies the Stripe session server-side, then applies the takeover
 * through a locking SQL function so only one owner can ever exist.
 */
export async function settleCheckoutSession(sessionId: string): Promise<SettleResult> {
  const db = admin();
  const session = (await retrieveSession(sessionId)) as Record<string, unknown>;
  const paymentId = (session["metadata"] as Record<string, string> | null)?.["payment_id"];
  if (!paymentId) return { status: "unknown" };

  const { data: payment } = await db
    .from("payments")
    .select("id, listing_id, amount_cents, email, company_name, destination_url, status")
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { status: "unknown" };

  if (session["payment_status"] !== "paid") return { status: "unpaid" };
  if (Number(session["amount_total"]) !== payment.amount_cents) {
    await db
      .from("payments")
      .update({ flagged: true, admin_notes: "amount mismatch vs stripe" })
      .eq("id", payment.id);
    return { status: "stale", reason: "amount_mismatch", paymentId: payment.id };
  }

  const stripeLivemode = session["livemode"] === true;
  if (!stripeLivemode && process.env["ALLOW_TEST_PAYMENTS"] !== "true") {
    await db
      .from("payments")
      .update({
        flagged: true,
        admin_notes: "test-mode Stripe payment blocked from takeover",
        ...(payment.status === "applied" ? {} : { status: "failed" }),
      })
      .eq("id", payment.id);
    return { status: "stale", reason: "test_mode_not_allowed", paymentId: payment.id };
  }
  await db
    .from("payments")
    .update({
      status: payment.status === "applied" ? "applied" : "paid",
      stripe_payment_intent: (session["payment_intent"] as string) ?? null,
      stripe_livemode: stripeLivemode,
      paid_at: new Date().toISOString(),
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

  // Fresh X read of the OUTGOING owner's placement while they are still the
  // current owner. Taken before the ownership row flips, persisted only if the
  // takeover actually lands, so a row turning OUTBID never makes a payout
  // eligible on its own.
  let outgoing: Awaited<
    ReturnType<typeof import("./verification.server").verifyOutgoingBeforeTakeover>
  > = null;
  try {
    const { verifyOutgoingBeforeTakeover } = await import("./verification.server");
    outgoing = await verifyOutgoingBeforeTakeover(payment.listing_id);
  } catch (e) {
    console.error("outgoing placement verification failed", e);
  }

  const { data: result } = await db.rpc("apply_takeover", { _payment_id: payment.id });
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
    let existingRank: number | null = null;
    try {
      const { loadMarketplace } = await import("./marketplace.server");
      const market = await loadMarketplace("most-valuable");
      existingRank =
        market.rows.find((row) => row.listing.id === payment.listing_id)?.globalRank ?? null;
    } catch {
      // The ownership remains valid even if a rank refresh is temporarily unavailable.
    }
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
    };
  }

  const ownershipId = String(r["ownership_id"]);

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
    detail: { status: "awaiting_activation" },
  });

  // The buyer paid, but the creator has NOT delivered yet: start the 24-hour
  // activation window and void any earlier purchase that was never activated.
  try {
    const { startActivationWindow, supersedeUnactivated } = await import("./activation.server");
    await startActivationWindow(ownershipId, new Date().toISOString());
    await supersedeUnactivated(payment.listing_id, ownershipId);
  } catch (e) {
    console.error("activation window setup failed", e);
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

  try {
    const {
      sendBuyerAwaitingActivationEmail,
      sendCreatorActionRequiredEmail,
    } = await import("./email.server");
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

  try {
    await sendWinnerEmail({
      to: payment.email,
      handle,
      username,
      amountCents: payment.amount_cents,
      destination: payment.destination_url,
      company: payment.company_name,
      ownershipId,
      globalRank,
    });

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
    console.error("email failure", e);
  }

  // Record the creator's held share. It only becomes eligible once the
  // placement is verified live on X (release_at = first_verified_at + 7 days).
  if (stripeLivemode) {
    try {
      const { recordPayout } = await import("./payouts.server");
      await recordPayout({
        paymentId: payment.id,
        listingId: payment.listing_id,
        ownershipId,
        grossCents: payment.amount_cents,
      });
    } catch (e) {
      console.error("recordPayout failed", e);
    }
  }

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
    previousOwner:
      ((r["previous"] as Record<string, unknown> | null)?.["company_name"] as string | undefined) ??
      null,
  };
}
