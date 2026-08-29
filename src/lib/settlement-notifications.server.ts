import { admin } from "./db.server";
import { sendPlacementVerifiedEmail, sendWinnerEmail, type EmailSendResult } from "./email.server";
import { recordEvent } from "./events.server";
import { creatorEmail } from "./notify.server";

type EmailType = "winner" | "activation_buyer" | "activation_creator";

function logFailure(stage: string, paymentId: string, error: unknown) {
  console.error("settlement notification failed", {
    stage,
    paymentId,
    error: error instanceof Error ? error.message : String(error),
  });
}

async function deliverOnce(opts: {
  paymentId: string;
  type: EmailType;
  send: (idempotencyKey: string) => Promise<EmailSendResult | { sent: false }>;
}): Promise<boolean> {
  const db = admin();
  const { data: delivery, error: insertError } = await db
    .from("payment_email_deliveries")
    .upsert(
      { payment_id: opts.paymentId, email_type: opts.type },
      { onConflict: "payment_id,email_type", ignoreDuplicates: true },
    )
    .select("id, status, attempts")
    .maybeSingle();

  if (insertError) {
    logFailure(`${opts.type}_tracking`, opts.paymentId, insertError.message);
    return false;
  }

  let row = delivery;
  if (!row) {
    const { data: existing, error } = await db
      .from("payment_email_deliveries")
      .select("id, status, attempts")
      .eq("payment_id", opts.paymentId)
      .eq("email_type", opts.type)
      .maybeSingle();
    if (error || !existing) {
      logFailure(`${opts.type}_tracking`, opts.paymentId, error?.message ?? "delivery missing");
      return false;
    }
    row = existing;
  }
  if (row.status === "sent") return true;

  try {
    const result = await opts.send(`socialbid:${opts.paymentId}:${opts.type}`);
    if (!result.sent) throw new Error("Resend did not accept the email");
    const { error } = await db
      .from("payment_email_deliveries")
      .update({
        status: "sent",
        provider_id: result.providerId,
        sent_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    await recordEvent("settlement_email_sent", {
      paymentId: opts.paymentId,
      detail: { type: opts.type },
    });
    return true;
  } catch (error) {
    await db
      .from("payment_email_deliveries")
      .update({
        status: "failed",
        attempts: Number(row.attempts ?? 0) + 1,
        last_error: error instanceof Error ? error.message : String(error),
      })
      .eq("id", row.id);
    logFailure(opts.type, opts.paymentId, error);
    await recordEvent("settlement_email_failed", {
      paymentId: opts.paymentId,
      detail: { type: opts.type },
    });
    return false;
  }
}

export async function ensureSettlementEmails(opts: {
  paymentId: string;
  ownershipId: string;
  companyName: string;
  buyerEmail: string;
  amountCents: number;
  destination: string;
  username: string;
  handle: string;
  creatorId: string;
  globalRank: number | null;
  eligibleDate: string | null;
}): Promise<boolean> {
  const winner = await deliverOnce({
    paymentId: opts.paymentId,
    type: "winner",
    send: (idempotencyKey) =>
      sendWinnerEmail({
        to: opts.buyerEmail,
        handle: opts.handle,
        username: opts.username,
        amountCents: opts.amountCents,
        destination: opts.destination,
        company: opts.companyName,
        ownershipId: opts.ownershipId,
        globalRank: opts.globalRank,
        idempotencyKey,
        throwOnFailure: true,
      }),
  });
  const buyerActivation = await deliverOnce({
    paymentId: opts.paymentId,
    type: "activation_buyer",
    send: (idempotencyKey) =>
      sendPlacementVerifiedEmail({
        to: opts.buyerEmail,
        audience: "buyer",
        handle: opts.handle,
        idempotencyKey,
        throwOnFailure: true,
      }),
  });
  const creatorRecipient = await creatorEmail(opts.creatorId);
  if (!creatorRecipient)
    console.warn("settlement creator email unavailable", { paymentId: opts.paymentId });
  const creatorActivation = creatorRecipient
    ? await deliverOnce({
        paymentId: opts.paymentId,
        type: "activation_creator",
        send: (idempotencyKey) =>
          sendPlacementVerifiedEmail({
            to: creatorRecipient,
            audience: "creator",
            handle: opts.handle,
            eligibleDate: opts.eligibleDate,
            idempotencyKey,
            throwOnFailure: true,
          }),
      })
    : true;

  return winner && buyerActivation && creatorActivation;
}
