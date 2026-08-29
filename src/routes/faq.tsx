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
  ["How long do I own a bio?", "You keep the sponsored slot until somebody pays more. When another buyer takes the slot, their message replaces yours."],
  ["What happens when somebody pays more?", "The new buyer immediately becomes the current owner. The creator updates their X bio to the new sponsor's message and link. The previous owner's placement ends normally and any valid pending creator payout remains eligible for release."],
  ["How do you make sure my sponsorship stays live?", "While you are the current owner, we re-read the creator's live X bio through the X API every day and check your message and link are still there. Nobody has to keep an old sponsor's placement live once someone else has legitimately paid more."],
  ["What happens if a creator removes my sponsorship?", "If the creator removes or changes the placement while you are still the current owner, their payout for that purchase becomes ineligible and the listing is suspended until it's restored. If your placement disappears because another buyer legitimately paid more, that is a normal ownership change rather than a violation."],
  ["When does a creator get paid?", "Creator earnings are held for 7 days before payout. If a sponsor is legitimately outbid during that period, the creator still gets paid for that completed ownership period. The 7-day hold does not prevent new buyers from taking the slot."],
  ["How much of the bio can a sponsor use?", "Sponsored messages can contain up to 100 characters plus a separate link. This keeps space available for the profile owner's own bio while still giving sponsors a meaningful placement."],
  ["What if I'm outbid one minute later?", "It can happen. You keep the exposure you got, and we email you the price to take it back."],
  ["Do I get a refund if I'm outbid?", "No — you paid for ownership from the moment you bought it. If two payments race, the loser is refunded in full automatically."],
  ["Can I change my message or link?", "Contact us and we'll update it, subject to moderation."],
  ["What links are not allowed?", "Adult content, illegal goods, malware, scams, hate speech, or anything that would get the creator's X account banned."],
  ["What exactly is checked?", "We read the creator's live X bio through the X API every day and look for the current owner's message word-for-word (ignoring case and extra spacing) plus their link. A temporary X API error never counts against a creator — we simply retry."],
  ["Does each purchase have its own payout?", "Yes. Every purchase creates its own creator payout with its own 7-day release date. Rapid outbidding is fine — earlier sponsors\u2019 payouts keep their original timers and are unaffected by later sales."],
  ["What is the buymybio.com/yourhandle link for then?", "That link is only used once, during creator onboarding, to verify the creator controls the X account and can edit their bio. After verification the buyer's message and link are what get checked."],
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
        See the Bios
      </Link>
    </div>
  );
}
