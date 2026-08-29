import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Buy My Bio" },
      {
        name: "description",
        content:
          "Buy the sponsored slot in a creator's X bio. Pay more than the current owner, own the message and tracked link, and get outbid when someone pays more.",
      },
      { property: "og:title", content: "Buy My Bio FAQ" },
      {
        property: "og:description",
        content: "Pay more than the current owner and the X bio slot is yours. No deadline.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FAQPage,
});

const faqs: [string, string][] = [
  ["What am I actually buying?", "You're buying a sponsored message + link inside this creator's X bio. You write the exact text that goes in their bio. You are not buying the X account, username, profile photo, banner, posts or access to the account."],
  ["Which platforms are supported?", "X bios only for now."],
  ["How long do I own it?", "Until you're outbid. There is no deadline and no expiry."],
  ["What if I'm outbid one minute later?", "It can happen. You keep the exposure you got, and we email you the price to take it back."],
  ["Do I get a refund if I'm outbid?", "No — you paid for ownership from the moment you bought it. If two payments race, the loser is refunded in full automatically."],
  ["Can I change my message or link?", "Contact us and we'll update it, subject to moderation."],
  ["What links are not allowed?", "Adult content, illegal goods, malware, scams, hate speech, or anything that would get the creator's X account banned."],
  ["How does the creator get paid?", "The buyer pays Buy My Bio. We hold the creator's share in escrow for 3 days, re-read their live X bio and check the buyer's exact message is still there, then transfer it to their bank via Stripe, minus the platform fee."],
  ["What exactly is checked before a payout?", "At release time we read the creator's live X bio through the X API and look for the winning bidder's message word-for-word (ignoring case and extra spacing). If it's present, the payout releases. If it isn't, the payout is blocked."],
  ["What is the buymybio.com/yourhandle link for then?", "That link is only used once, during creator onboarding, to verify the creator controls the X account and can edit their bio. After verification it isn't required for payouts — the buyer's message is what gets checked. (Older slots bought before custom messages existed still fall back to the link check.)"],
  ["What happens if a creator removes or edits the buyer's message?", "The re-check at release time fails, the payout is blocked and held, and the listing loses its verified status. Restore the exact message and the payout releases on the next hourly check."],
  ["When can a creator change their bio again?", "Once the payout for a takeover has been released and nobody currently owns the slot. While a slot is owned and unpaid, the buyer's message stays live as written."],

];


function FAQPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.88] font-semibold tracking-[-0.05em]">
        FAQ
      </h1>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[
          ["1. Buy", "Pay more than the current owner. The price is set by the last sale plus a minimum increase."],
          ["2. Own", "Your message + tracked link sits in the creator's X bio. Track the clicks you get."],
          ["3. Get outbid", "Someone pays more, they take over, and you get an email with the new price."],
        ].map(([t, d]) => (
          <div key={t} className="panel px-5 py-6">
            <div className="text-lg font-semibold">{t}</div>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-2xl font-semibold">Questions</h2>
      <div className="panel mt-4 divide-y-2 divide-border">
        {faqs.map(([q, a]) => (
          <div key={q} className="px-5 py-4">
            <h3 className="font-semibold">{q}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </div>
        ))}
      </div>


      <Link to="/" className="btn-ink btn-ink-hover mt-12">
        See the current price
      </Link>
    </div>
  );
}
