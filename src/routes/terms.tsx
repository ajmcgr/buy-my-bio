import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Buy My Bio" },
      {
        name: "description",
        content: "The rules for sponsoring creator profiles on Buy My Bio.",
      },
      { property: "og:title", content: "Terms of Service — Buy My Bio" },
      { property: "og:description", content: "The rules for sponsoring creator profiles." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <article className="mx-auto max-w-2xl space-y-4 px-5 py-14 text-sm leading-relaxed">
      <h1 className="text-3xl font-extrabold">Terms of Service</h1>
      <p>
        Buy My Bio sells <b>disclosed sponsored placements</b> on creator profiles hosted on
        BuyMyBio.com. Buying a placement gives you the right to have your sponsored message and
        tracked link displayed on that creator's Buy My Bio profile until another buyer pays more.
        Payments are for sponsorship on BuyMyBio.com only, and nothing is published on X. There is
        no minimum ownership period and no guaranteed duration.
      </p>
      <p>
        You are not buying an X account. No sale transfers ownership of, credentials for, or any
        access to an X account, username, profile photo, banner or posts. Creators retain full
        control of their accounts at all times. Sponsorships are displayed and managed by Buy My Bio
        on BuyMyBio.com, not by the creator on X.
      </p>
      <p>
        Every placement is published and labelled “Sponsored”, which Buy My Bio generates and
        verifies. Creators are never required to edit their X bio, post, follow, like, repost, reply
        or perform any other action on X. Buyers may not remove, alter or obscure that label, and a
        placement without it is treated as non-compliant.
      </p>
      <p>
        Sponsored messages must be honest advertising. You may not impersonate the creator, X Corp,
        Buy My Bio or any other person or brand, and you may not state or imply that you own,
        operate, are employed by, or are endorsed by the account beyond the paid placement. Creators
        must not misrepresent a placement as their own personal endorsement where that is untrue.
      </p>
      <p>
        Placements must comply with applicable advertising rules. Buy My Bio may suspend a listing
        or cancel a placement that breaches those rules.
      </p>
      <p>
        Buy My Bio is an independent service and is not affiliated with, endorsed by, or sponsored
        by X Corp. “X” is a trademark of X Corp.
      </p>
      <p>
        All sales are final except where two payments race for the same takeover; the losing payment
        is refunded in full and automatically.
      </p>
      <p>
        Messages and destinations are moderated. Adult content, illegal goods or services, malware,
        phishing, scams, and hate speech are prohibited and will be disabled without refund.
      </p>
      <p>
        Creators may pause a listing or reject a destination. If a listing is permanently removed
        while you own it, you'll receive a pro-rated refund at our discretion.
      </p>
      <p>Payments are processed by Stripe. We never store card details.</p>
    </article>
  ),
});
