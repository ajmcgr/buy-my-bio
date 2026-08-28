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

  if (payment.status === "created" || payment.status === "failed") {
    await db
      .from("payments")
      .update({
        status: "paid",
        stripe_payment_intent: (session["payment_intent"] as string) ?? null,
      })
      .eq("id", payment.id);
  }

  const { data: result } = await db.rpc("apply_takeover", { _payment_id: payment.id });
  const r = (result ?? {}) as Record<string, unknown>;

  if (!r["ok"]) {
    return { status: "stale", reason: String(r["reason"] ?? "unknown"), paymentId: payment.id };
  }

  if (r["reason"] === "already_applied") {
    const { data: own } = await db
      .from("ownerships")
      .select("id")
      .eq("payment_id", payment.id)
      .maybeSingle();
    return { status: "owned", ownershipId: own?.id ?? "", paymentId: payment.id };
  }

  const ownershipId = String(r["ownership_id"]);

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

  try {
    await sendWinnerEmail({
      to: payment.email,
      handle,
      username,
      amountCents: payment.amount_cents,
      destination: payment.destination_url,
      company: payment.company_name,
      ownershipId,
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
      });
    }
  } catch (e) {
    console.error("email failure", e);
  }

  await db.from("analytics_events").insert({
    name: "checkout_completed",
    listing_id: payment.listing_id,
    props: { amount_cents: payment.amount_cents },
  });

  return { status: "owned", ownershipId, paymentId: payment.id };
}
