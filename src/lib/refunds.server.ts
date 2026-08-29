/**
 * Automatic buyer refunds.
 *
 * A refund is ONLY ever issued when the buyer did not receive the product:
 *   creator_failed_to_activate     — 24h deadline passed, never verified live
 *   outbid_before_activation       — a newer buyer took the slot before activation
 *   creator_removed_active_placement — confirmed removal while still current owner
 *   concurrent_purchase_conflict   — payment could not become a valid ownership
 *
 * A legitimately outbid, successfully activated placement is NEVER refunded.
 * A temporary X API failure NEVER triggers a refund.
 *
 * Every path is idempotent: a deterministic Stripe idempotency key per payment
 * plus refund-state guards mean the same purchase can never be refunded twice.
 */

import { admin } from "./db.server";
import { recordEvent } from "./events.server";

export type RefundReason =
  | "creator_failed_to_activate"
  | "outbid_before_activation"
  | "creator_removed_active_placement"
  | "concurrent_purchase_conflict";

export type RefundResult =
  | { status: "refunded"; refundId: string }
  | { status: "already_refunded"; refundId: string | null }
  | { status: "skipped"; reason: string }
  | { status: "admin_review"; reason: string }
  | { status: "failed"; error: string };

async function flagAdminReview(paymentId: string, reason: string) {
  await admin()
    .from("payments")
    .update({
      admin_review_required: true,
      admin_review_reason: reason,
      needs_refund: true,
      needs_refund_reason: reason,
      flagged: true,
    })
    .eq("id", paymentId);
  await recordEvent("admin_review_required", { paymentId, detail: { reason } });
}

/**
 * Refunds one payment. Safe to call repeatedly and from several jobs at once.
 */
export async function refundPayment(
  paymentId: string,
  reason: RefundReason,
  opts: { allowAfterPayout?: boolean } = {},
): Promise<RefundResult> {
  const db = admin();

  const { data: payment } = await db
    .from("payments")
    .select(
      "id, listing_id, email, company_name, amount_cents, status, refund_status, stripe_refund_id, stripe_payment_intent, stripe_livemode, refund_attempts",
    )
    .eq("id", paymentId)
    .maybeSingle();
  if (!payment) return { status: "skipped", reason: "payment_not_found" };

  if (payment.refund_status === "refunded" || payment.stripe_refund_id) {
    return {
      status: "already_refunded",
      refundId: (payment.stripe_refund_id as string | null) ?? null,
    };
  }

  if (!["paid", "applied", "stale", "refunded"].includes(String(payment.status))) {
    return { status: "skipped", reason: `payment_not_settled:${payment.status}` };
  }
  if (!payment.stripe_payment_intent) {
    await flagAdminReview(paymentId, "no_stripe_payment_intent");
    return { status: "admin_review", reason: "no_stripe_payment_intent" };
  }

  // Never pay the creator AND the buyer out of platform funds.
  const { data: payout } = await db
    .from("payouts")
    .select("id, status")
    .eq("payment_id", paymentId)
    .maybeSingle();
  if (payout && payout.status === "paid" && !opts.allowAfterPayout) {
    await flagAdminReview(paymentId, "payout_already_released");
    return { status: "admin_review", reason: "payout_already_released" };
  }

  // Block the payout before touching Stripe, so a concurrent release job loses.
  if (payout && payout.status !== "paid") {
    await db
      .from("payouts")
      .update({ status: "cancelled", payout_status: "blocked", last_error: `refund: ${reason}` })
      .eq("id", payout.id);
  }

  await db
    .from("payments")
    .update({
      refund_status: "pending",
      refund_reason: reason,
      refund_attempts: Number(payment.refund_attempts ?? 0) + 1,
      refund_last_attempt_at: new Date().toISOString(),
    })
    .eq("id", paymentId);
  await recordEvent("refund_requested", { paymentId, detail: { reason } });

  try {
    const { refundPaymentIntent } = await import("./stripe.server");
    const refund = await refundPaymentIntent(String(payment.stripe_payment_intent), {
      idempotencyKey: `bmb_refund_${paymentId}`,
      reason,
      paymentId,
    });
    const refundId = String(refund["id"] ?? "");
    const now = new Date().toISOString();

    await db
      .from("payments")
      .update({
        refund_status: "refunded",
        stripe_refund_id: refundId || null,
        refunded_at: now,
        refund_reason: reason,
        refund_error: null,
        needs_refund: false,
      })
      .eq("id", paymentId);

    await db
      .from("ownerships")
      .update({ status: "ended", ended_at: now, placement_ended_at: now })
      .eq("payment_id", paymentId)
      .eq("status", "active");

    await recordEvent("refund_succeeded", {
      paymentId,
      detail: { reason, refund_id: refundId, amount_cents: payment.amount_cents },
    });

    try {
      const { sendRefundEmail } = await import("./email.server");
      await sendRefundEmail({
        to: String(payment.email),
        amountCents: Number(payment.amount_cents),
        reason,
      });
    } catch (e) {
      console.error("refund email failed", e);
    }

    return { status: "refunded", refundId };
  } catch (e) {
    const message = String(e instanceof Error ? e.message : e).slice(0, 500);
    await db
      .from("payments")
      .update({
        refund_status: "failed",
        refund_error: message,
        needs_refund: true,
        needs_refund_reason: reason,
        flagged: true,
      })
      .eq("id", paymentId);
    await recordEvent("refund_failed", { paymentId, detail: { reason, error: message } });
    console.error("refund failed", paymentId, message);
    return { status: "failed", error: message };
  }
}

export type RefundSweepSummary = {
  considered: number;
  refunded: number;
  failed: number;
  review: number;
  skipped: number;
};

/**
 * Picks up everything flagged for refund by the activation, verification and
 * settlement paths, plus payments that could never become a valid ownership.
 */
export async function processRefundQueue(limit = 25): Promise<RefundSweepSummary> {
  const db = admin();
  const summary: RefundSweepSummary = {
    considered: 0,
    refunded: 0,
    failed: 0,
    review: 0,
    skipped: 0,
  };

  const { data: flagged } = await db
    .from("payments")
    .select("id, needs_refund_reason, refund_attempts, refund_status")
    .eq("needs_refund", true)
    .eq("admin_review_required", false)
    .in("refund_status", ["none", "requested", "pending", "failed"])
    .lt("refund_attempts", 5)
    .order("created_at", { ascending: true })
    .limit(limit);

  // Payments that were verified as paid but could not become a valid ownership.
  const { data: conflicts } = await db
    .from("payments")
    .select("id")
    .eq("status", "stale")
    .eq("stripe_livemode", true)
    .eq("needs_refund", false)
    .eq("refund_status", "none")
    .not("stripe_payment_intent", "is", null)
    .limit(limit);

  const jobs: Array<{ id: string; reason: RefundReason }> = [
    ...(flagged ?? []).map((row) => ({
      id: row.id as string,
      reason: normalizeReason(row.needs_refund_reason as string | null),
    })),
    ...(conflicts ?? []).map((row) => ({
      id: row.id as string,
      reason: "concurrent_purchase_conflict" as const,
    })),
  ];

  for (const job of jobs) {
    summary.considered += 1;
    const result = await refundPayment(job.id, job.reason);
    if (result.status === "refunded" || result.status === "already_refunded") summary.refunded += 1;
    else if (result.status === "failed") summary.failed += 1;
    else if (result.status === "admin_review") summary.review += 1;
    else summary.skipped += 1;
  }

  return summary;
}

export function normalizeReason(raw: string | null): RefundReason {
  switch (raw) {
    case "superseded_before_activation":
    case "outbid_before_activation":
      return "outbid_before_activation";
    case "seller_removed":
    case "creator_removed_active_placement":
      return "creator_removed_active_placement";
    case "concurrent_purchase_conflict":
      return "concurrent_purchase_conflict";
    default:
      return "creator_failed_to_activate";
  }
}
