import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(1).max(40),
  companyName: z.string().min(1).max(80),
  bioMessage: z.string().min(3).max(160),
  destinationUrl: z.string().min(3).max(400),
  email: z.string().email().max(160),
  xHandle: z.string().max(40).optional().nullable(),
  logoUrl: z.string().max(400).optional().nullable(),
  agreed: z.boolean(),
});

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { admin, baseUrl } = await import("./db.server");
    const { safeDestination, safeLogoUrl } = await import("./validate");
    const { createCheckoutSession } = await import("./stripe.server");
    const db = admin();

    if (!data.agreed) return { error: "You must accept the terms." };

    const destination = safeDestination(data.destinationUrl);
    if (!destination) return { error: "Destination must be a valid public https:// URL." };
    const logo = safeLogoUrl(data.logoUrl ?? null);

    const { data: creator } = await db
      .from("creators")
      .select("id, username, social_handle, x_account_verified, x_bio_verified, banned")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (!creator || creator.banned) return { error: "Listing unavailable." };
    if (!creator.x_account_verified || !creator.x_bio_verified)
      return { error: "This listing is not verified yet." };

    const { data: listing } = await db
      .from("listings")
      .select("id, status, starting_price_cents, minimum_increase_percentage")
      .eq("creator_id", creator.id)
      .maybeSingle();
    if (!listing || listing.status !== "active") return { error: "Listing is not accepting bids." };

    // SERVER-SIDE price. Never trust the browser.
    const { data: required } = await db.rpc("required_price_cents", { _listing_id: listing.id });
    const amountCents = Number(required);
    if (!amountCents || amountCents < 100) return { error: "Could not price this takeover." };

    // buyer record
    const email = data.email.trim().toLowerCase();
    const { data: existingBuyer } = await db
      .from("buyers")
      .select("id, banned")
      .eq("email", email)
      .maybeSingle();
    if (existingBuyer?.banned) return { error: "This account cannot purchase." };
    let buyerId = existingBuyer?.id as string | undefined;
    if (!buyerId) {
      const { data: created } = await db
        .from("buyers")
        .insert({ email, company_name: data.companyName, x_handle: data.xHandle ?? null })
        .select("id")
        .single();
      buyerId = created?.id;
    }

    const { data: payment, error: payErr } = await db
      .from("payments")
      .insert({
        listing_id: listing.id,
        buyer_id: buyerId,
        amount_cents: amountCents,
        quoted_min_cents: amountCents,
        email,
        company_name: data.companyName.trim(),
        bio_message: data.bioMessage.trim(),
        destination_url: destination,
        logo_url: logo,
        x_handle: data.xHandle ?? null,
        status: "created",
      })
      .select("id")
      .single();
    if (payErr || !payment) return { error: "Could not start checkout." };

    const base = baseUrl();
    try {
      const session = await createCheckoutSession({
        amountCents,
        email,
        companyName: data.companyName,
        creatorHandle: creator.social_handle ?? creator.username,
        paymentId: payment.id,
        successUrl: `${base}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancelUrl: `${base}/u/${creator.username}?canceled=1`,
      });
      await db
        .from("payments")
        .update({ stripe_session_id: session["id"] as string })
        .eq("id", payment.id);
      await db.from("analytics_events").insert({
        name: "checkout_started",
        listing_id: listing.id,
        props: { amount_cents: amountCents },
      });
      return { url: session["url"] as string, amountCents };
    } catch (e) {
      await db
        .from("payments")
        .update({ status: "failed", admin_notes: String(e) })
        .eq("id", payment.id);
      return { error: "Payment could not be started. Try again." };
    }
  });

/** Called by the success page: confirms/settles a session even if the webhook is delayed. */
export const settleSession = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ sessionId: z.string().min(5) }).parse(input))
  .handler(async ({ data }) => {
    const { settleCheckoutSession } = await import("./settle.server");
    return settleCheckoutSession(data.sessionId);
  });
