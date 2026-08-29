import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  username: z.string().min(1).max(40),
  companyName: z.string().min(1).max(80),
  bioMessage: z.string().trim().min(3).max(100),
  destinationUrl: z.string().min(3).max(400),
  email: z.string().email().max(160),
  xHandle: z.string().max(40).optional().nullable(),
  logoUrl: z.string().max(400).optional().nullable(),
  agreed: z.boolean(),
  creatorToken: z.string().max(200).optional().nullable(),
});

export const startCheckout = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { admin, baseUrl } = await import("./db.server");
    const { safeDestination, safeLogoUrl } = await import("./validate");
    const { createCheckoutSession } = await import("./stripe.server");
    const { CURRENT_PLACEMENT_FORMAT, validatePlacement } = await import("./placement");
    const db = admin();

    if (!data.agreed) return { error: "You must accept the terms." };

    const destination = safeDestination(data.destinationUrl);
    if (!destination) return { error: "Destination must be a valid public domain." };
    const logo = safeLogoUrl(data.logoUrl ?? null);

    const { data: creator } = await db
      .from("creators")
      .select("id, user_id, username, social_handle, x_username, x_account_verified, banned")
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (!creator || creator.banned) return { error: "Listing unavailable." };
    if (!creator.x_account_verified) return { error: "This creator has disconnected X." };

    // Self-bidding guard. The HttpOnly session cookie is set only by the
    // trusted X OAuth callback; request-body identity fields are never used.
    const { getRequest } = await import("@tanstack/react-start/server");
    const creatorSession = getRequest().headers
      .get("cookie")
      ?.match(/(?:^|;\s*)bmb_creator_session=([^;]+)/)?.[1];
    if (creatorSession) {
      const { data: currentCreator } = await db
        .from("creators")
        .select("user_id")
        .eq("session_token", decodeURIComponent(creatorSession))
        .maybeSingle();
      if (currentCreator?.user_id && currentCreator.user_id === creator.user_id)
        return { error: "You can't sponsor your own profile." };
    }

    // Legacy advisory checks only; never used as the authoritative decision.
    const norm = (v: string | null | undefined) => (v ?? "").trim().replace(/^@/, "").toLowerCase();
    const buyerHandle = norm(data.xHandle);
    const creatorHandles = [creator.x_username, creator.social_handle, creator.username].map(norm);
    if (buyerHandle && creatorHandles.includes(buyerHandle))
      return { error: "You can't sponsor your own profile." };
    if (data.creatorToken) {
      const { data: self } = await db
        .from("creators")
        .select("id")
        .eq("session_token", data.creatorToken)
        .maybeSingle();
      if (self?.id === creator.id) return { error: "You can't sponsor your own profile." };
    }

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

    // Website-only placement validation. The creator's X bio length is irrelevant.
    const placement = validatePlacement({
      message: data.bioMessage,
      url: destination,
      retainedChars: 0,
    });
    if (!placement.ok) return { error: placement.error };

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
        placement_format: CURRENT_PLACEMENT_FORMAT,
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
