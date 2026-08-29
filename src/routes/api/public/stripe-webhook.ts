import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const payload = await request.text();
        const { verifyStripeSignature } = await import("@/lib/stripe.server");
        let ok: boolean;
        try {
          ok = await verifyStripeSignature(payload, request.headers.get("stripe-signature"));
        } catch (e) {
          console.error("Stripe webhook configuration error", e);
          return new Response("Stripe webhook is not configured", { status: 500 });
        }
        if (!ok) return new Response("Invalid signature", { status: 401 });

        const event = JSON.parse(payload) as {
          type: string;
          data: { object: Record<string, unknown> };
        };

        const { admin } = await import("@/lib/db.server");

        if (event.type === "checkout.session.completed") {
          const session = event.data.object;
          const { settleCheckoutSession } = await import("@/lib/settle.server");
          try {
            await settleCheckoutSession(String(session["id"]));
          } catch (e) {
            console.error("settle failed", e);
            return new Response("settle failed", { status: 500 });
          }
        }

        if (event.type === "checkout.session.expired") {
          const paymentId = (event.data.object["metadata"] as Record<string, string> | null)?.[
            "payment_id"
          ];
          if (paymentId) {
            await admin()
              .from("payments")
              .update({ status: "expired" })
              .eq("id", paymentId)
              .eq("status", "created");
          }
        }

        if (event.type === "charge.refunded") {
          const pi = event.data.object["payment_intent"];
          if (pi) {
            const db = admin();
            const { data: refundedPayment } = await db
              .from("payments")
              .update({ refund_status: "refunded" })
              .eq("stripe_payment_intent", String(pi))
              .select("id")
              .maybeSingle();
            if (refundedPayment) {
              await db
                .from("ownerships")
                .update({ status: "ended", ended_at: new Date().toISOString() })
                .eq("payment_id", refundedPayment.id)
                .eq("status", "active");
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});
