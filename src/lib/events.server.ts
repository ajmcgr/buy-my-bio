import { admin } from "./db.server";

/**
 * Lightweight audit trail. One row per meaningful marketplace event so support
 * can reconstruct exactly what happened to a purchase.
 */
export async function recordEvent(
  event: string,
  opts: {
    paymentId?: string | null;
    listingId?: string | null;
    ownershipId?: string | null;
    payoutId?: string | null;
    detail?: Record<string, unknown>;
  } = {},
) {
  try {
    await admin()
      .from("transaction_events")
      .insert({
        event,
        payment_id: opts.paymentId ?? null,
        listing_id: opts.listingId ?? null,
        ownership_id: opts.ownershipId ?? null,
        payout_id: opts.payoutId ?? null,
        detail: opts.detail ?? {},
      });
  } catch (e) {
    console.error("recordEvent failed", event, e);
  }
}
