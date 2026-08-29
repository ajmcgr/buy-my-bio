import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: "FAQ — Buy My Bio" },
      {
        name: "description",
        content:
          "Buy the sponsored slot on a creator's Buy My Bio profile. Pay more than the current owner, own the message and tracked link, and get outbid when someone pays more.",
      },
      { property: "og:title", content: "Buy My Bio FAQ" },
      {
        property: "og:description",
        content: "Pay more than the current owner and the sponsored slot is yours. No deadline.",

      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FAQPage,
});

const faqs: [string, string][] = [
  ["How does Buy My Bio work?", "X creators list a sponsored slot on their Buy My Bio profile. Anyone can buy that slot at the current price. Your sponsored message and link go live immediately on buymybio.com and stay there until somebody pays more."],
  ["Does the sponsorship appear in the creator's X bio?", "No. The sponsored placement appears on the creator's Buy My Bio profile only. Creators never have to edit their X bio or take any action on X."],
  ["How long do I own a slot?", "Until somebody pays more. There is no fixed sponsorship period and no deadline."],
  ["What happens when somebody pays more?", "The new buyer takes over the slot on the creator's Buy My Bio profile and your ownership ends normally. You get an email with the new price."],
  ["How quickly does my sponsorship go live?", "Instantly. As soon as your payment succeeds, your placement is live on buymybio.com."],
  ["When do creators get paid?", "Creators keep 80% of every sale. Earnings are held for 7 days after purchase as a standard risk and chargeback window, then paid out automatically to their connected Stripe account. Being outbid during that window doesn't affect a payout you've already earned."],
  ["Can someone buy a slot immediately after another person buys it?", "Yes. There is no waiting period. If someone pays the next price, they take over instantly, and every purchase is tracked separately."],
  ["How long can my sponsored message be?", "Up to 100 characters, plus a separate link. Every placement is published with a \u201CSponsored:\u201D label in front of your message."],
  ["Is a placement labelled as an ad?", "Yes. Buy My Bio generates the \u201CSponsored:\u201D label automatically and buyers can't remove or reword it."],
  ["Am I buying an X account?", "No. You're buying a disclosed sponsored placement \u2014 an advertising message and tracked link \u2014 on a creator's Buy My Bio profile. You never get the account, username, password, profile photo, banner, posts or any access to it."],
  ["What isn't allowed in a sponsored message?", "Messages must be honest advertising. You can't impersonate the creator, X Corp, Buy My Bio, or anyone else; you can't imply that you own, run, work for or are endorsed by the account beyond the paid placement; and you can't post adult content, illegal goods, malware, scams or hate speech. We moderate messages as well as destinations."],
  ["Is Buy My Bio affiliated with X?", "No. Buy My Bio is an independent marketplace. We are not affiliated with, endorsed by or sponsored by X Corp, and \u201CX\u201D is a trademark of X Corp."],
  ["Does Buy My Bio control my X account?", "No. The X connection is read-only and used to verify your identity and pull your public profile. We never post, edit your profile, send DMs or change anything on your account."],
  ["Why do I connect X?", "Connecting X proves you control the account you're listing and provides your handle, name, photo and follower count. That's all it's used for."],
  ["Can buyers access my X account?", "No. Buyers never receive access to your account, credentials or X connection."],
  ["Can I buy my own bio?", "No. Listing owners can't buy or outbid their own slot."],
  ["How do refunds work?", "If a placement can't be delivered, or a purchase is cancelled for policy or moderation reasons, the payment is automatically refunded in full to the original payment method. Refunds usually appear within 5-10 business days."],
  ["Can I change my message or link?", "Contact us and we'll update it, subject to moderation."],
  ["What links are not allowed?", "Adult content, illegal goods, malware, scams, hate speech, or anything abusive."],
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
          ["2. Own", "Once the creator activates it, your \u201CSponsored:\u201D message + tracked link sits in their X bio. Own the placement until someone pays more."],
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
