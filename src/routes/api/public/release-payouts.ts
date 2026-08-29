import { createFileRoute } from "@tanstack/react-router";

/**
 * Releases held creator payouts whose hold window has elapsed.
 * Call on a schedule (e.g. hourly) with:
 *   Authorization: Bearer $PAYOUT_CRON_SECRET
 */
export const Route = createFileRoute("/api/public/release-payouts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYOUT_CRON_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });

        const provided = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
        const a = new TextEncoder().encode(provided);
        const b = new TextEncoder().encode(secret);
        let diff = a.length ^ b.length;
        for (let i = 0; i < Math.max(a.length, b.length); i++) {
          diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
        }
        if (diff !== 0) return new Response("Unauthorized", { status: 401 });

        // Daily bio verification sweep first (during the hold AND after payout),
        // then release everything that is still eligible.
        const { runActivationSweep } = await import("@/lib/activation.server");
        const activation = await runActivationSweep();
        const { runPlacementSweep } = await import("@/lib/verification.server");
        const verification = await runPlacementSweep();
        const { releaseDuePayouts } = await import("@/lib/payouts.server");
        const summary = await releaseDuePayouts();
        return Response.json({ activation, verification, payouts: summary });
      },
    },
  },
});
