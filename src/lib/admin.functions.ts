import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenIn = z.object({ token: z.string().min(10) });

export const getAdminData = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => tokenIn.parse(input))
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./authz.server");
    const { admin } = await import("./db.server");
    const gate = await requireAdmin(data.token);
    if (!gate.ok) return { error: gate.error } as const;
    const db = admin();

    const [creators, listings, payments, ownerships, payouts, violations] = await Promise.all([
      db
        .from("creators")
        .select(
          "id, display_name, username, social_handle, verification_status, x_account_verified, x_bio_verified, x_bio_verified_method, banned, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("listings").select("id, creator_id, slug, status, starting_price_cents, compliance_status, non_compliant_reason").limit(200),
      db
        .from("payments")
        .select(
          "id, company_name, email, amount_cents, status, refund_status, stripe_livemode, flagged, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("ownerships")
        .select(
          "id, company_name, destination_url, amount_cents, status, click_count, destination_disabled",
        )
        .eq("status", "active")
        .limit(100),
      db
        .from("payouts")
        .select(
          "id, creator_id, amount_cents, status, hold_until, released_at, bio_verification_status, last_bio_verified_at, verification_failure_at, verification_failure_reason, last_verification_error, last_error",
        )
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("placement_violations")
        .select("id, creator_id, phase, reason, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

    const paid = (payments.data ?? []).filter(
      (p) => p.status === "applied" && p.stripe_livemode && p.refund_status !== "refunded",
    );
    return {
      creators: creators.data ?? [],
      listings: listings.data ?? [],
      payments: payments.data ?? [],
      active: ownerships.data ?? [],
      payouts: payouts.data ?? [],
      violations: violations.data ?? [],
      gmvCents: paid.reduce((s, p) => s + p.amount_cents, 0),
    } as const;
  });

export const adminAction = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    tokenIn
      .extend({
        action: z.enum([
          "verify_creator",
          "unverify_creator",
          "verify_bio",
          "unverify_bio",
          "ban_creator",
          "unban_creator",
          "pause_listing",
          "activate_listing",
          "disable_destination",
          "enable_destination",
        ]),
        id: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { requireAdmin } = await import("./authz.server");
    const { admin } = await import("./db.server");
    const gate = await requireAdmin(data.token);
    if (!gate.ok) return { error: gate.error } as const;
    const db = admin();

    switch (data.action) {
      case "verify_creator":
        await db.from("creators").update({ verification_status: "verified" }).eq("id", data.id);
        break;
      case "unverify_creator":
        await db.from("creators").update({ verification_status: "pending" }).eq("id", data.id);
        break;
      case "verify_bio":
        // Manual fallback: only used when an admin has actually confirmed the
        // placement is present on the creator's live X profile.
        await db
          .from("creators")
          .update({
            x_bio_verified: true,
            x_bio_verified_at: new Date().toISOString(),
            x_bio_verified_method: "admin",
          })
          .eq("id", data.id);
        await db.from("listings").update({ status: "active" }).eq("creator_id", data.id);
        break;
      case "unverify_bio":
        await db
          .from("creators")
          .update({ x_bio_verified: false, x_bio_verified_at: null, x_bio_verified_method: null })
          .eq("id", data.id);
        await db.from("listings").update({ status: "draft" }).eq("creator_id", data.id);
        break;
      case "ban_creator":
        await db.from("creators").update({ banned: true }).eq("id", data.id);
        break;
      case "unban_creator":
        await db.from("creators").update({ banned: false }).eq("id", data.id);
        break;
      case "pause_listing":
        await db.from("listings").update({ status: "paused" }).eq("id", data.id);
        break;
      case "activate_listing":
        await db.from("listings").update({ status: "active" }).eq("id", data.id);
        break;
      case "disable_destination":
        await db.from("ownerships").update({ destination_disabled: true }).eq("id", data.id);
        break;
      case "enable_destination":
        await db.from("ownerships").update({ destination_disabled: false }).eq("id", data.id);
        break;
    }
    return { ok: true } as const;
  });
