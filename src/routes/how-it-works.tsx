import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How It Works — Buy My Bio" },
      {
        name: "description",
        content:
          "Buy the link in a creator's bio. Pay more than the current owner, own the redirect, and get outbid when someone pays more.",
      },
      { property: "og:title", content: "How Buy My Bio Works" },
      {
        property: "og:description",
        content: "Pay more than the current owner and the bio link is yours. No deadline.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HowItWorks,
});

const faqs: [string, string][] = [
  ["What am I actually buying?", "The destination of the link in the creator's social bio. It points to your URL until someone pays more."],
  ["How long do I own it?", "Until you're outbid. There is no deadline and no expiry."],
  ["What if I'm outbid one minute later?", "It can happen. You keep the clicks you got, and we email you the price to take it back."],
  ["Do I get a refund if I'm outbid?", "No — you paid for ownership from the moment you bought it. If two payments race, the loser is refunded in full automatically."],
  ["Can I change my destination URL?", "Contact us and we'll update it, subject to moderation."],
  ["What links are not allowed?", "Adult content, illegal goods, malware, scams, hate speech, or anything that would get the creator's account banned."],
  ["How does the creator get paid?", "Payouts are sent after each takeover, minus the platform fee."],
];

function HowItWorks() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.88] font-black tracking-[-0.05em]">
        HOW IT WORKS
      </h1>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[
          ["1. BUY", "Pay more than the current owner. The price is set by the last sale plus a minimum increase."],
          ["2. OWN", "The bio link redirects to your site. Track the clicks you get."],
          ["3. GET OUTBID", "Someone pays more, they take over, and you get an email with the new price."],
        ].map(([t, d]) => (
          <div key={t} className="panel px-5 py-6">
            <div className="text-lg font-extrabold">{t}</div>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-2xl font-extrabold">Questions</h2>
      <div className="panel mt-4 divide-y-2 divide-border">
        {faqs.map(([q, a]) => (
          <details key={q} className="group px-5 py-4">
            <summary className="cursor-pointer font-bold">{q}</summary>
            <p className="mt-2 text-sm text-muted-foreground">{a}</p>
          </details>
        ))}
      </div>

      <Link to="/" className="btn-ink btn-ink-hover mt-12">
        SEE THE CURRENT PRICE
      </Link>
    </div>
  );
}
