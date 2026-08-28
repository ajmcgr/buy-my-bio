import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Buy My Bio" },
      {
        name: "description",
        content: "The rules for buying and owning a bio link on Buy My Bio.",
      },
      { property: "og:title", content: "Terms of Service — Buy My Bio" },
      { property: "og:description", content: "The rules for buying and owning a bio link." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <article className="mx-auto max-w-2xl space-y-4 px-5 py-14 text-sm leading-relaxed">
      <h1 className="text-3xl font-extrabold">Terms of Service</h1>
      <p>
        Buying a bio link gives you the right to set the destination of that link until another
        buyer pays more. There is no minimum ownership period and no guaranteed duration.
      </p>
      <p>
        All sales are final except where two payments race for the same takeover; the losing payment
        is refunded in full and automatically.
      </p>
      <p>
        Destinations are moderated. Adult content, illegal goods or services, malware, phishing,
        scams, and hate speech are prohibited and will be disabled without refund.
      </p>
      <p>
        Creators may pause a listing or reject a destination. If a listing is permanently removed
        while you own it, you'll receive a pro-rated refund at our discretion.
      </p>
      <p>Payments are processed by Stripe. We never store card details.</p>
    </article>
  ),
});
