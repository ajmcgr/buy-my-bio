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

    const [creators, listings, payments, ownerships] = await Promise.all([
      db
        .from("creators")
        .select("id, display_name, username, social_handle, verification_status, banned, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      db.from("listings").select("id, creator_id, slug, status, starting_price_cents").limit(200),
      db
        .from("payments")
        .select("id, company_name, email, amount_cents, status, flagged, created_at")
        .order("created_at", { ascending: false })
        .limit(50),
      db
        .from("ownerships")
        .select("id, company_name, destination_url, amount_cents, status, click_count, destination_disabled")
        .eq("status", "active")
        .limit(100),
    ]);

    const paid = (payments.data ?? []).filter((p) => p.status === "paid" || p.status === "settled");
    return {
      creators: creators.data ?? [],
      listings: listings.data ?? [],
      payments: payments.data ?? [],
      active: ownerships.data ?? [],
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
