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
  ["How does Buy My Bio work?", "X users list sponsored space in their bio. Anyone can buy the slot at the current price. Once the placement is verified live, you own it until somebody pays more."],
  ["How long do I own a bio?", "Until somebody pays more. There is no fixed sponsorship period. Your message and link stay in the bio while you're the current owner."],
  ["What happens when somebody pays more?", "The new buyer takes ownership of the slot and the creator updates their X bio with the new sponsor's message and link. If your placement was already live, your ownership simply ends normally."],
  ["How quickly does my sponsorship go live?", "Creators have up to 24 hours to activate a new placement. Buy My Bio verifies the sponsored message and link directly against their connected X account."],
  ["What if the creator never adds my sponsorship?", "Creators only earn a transaction after Buy My Bio verifies the sponsored placement live. If they don't activate it within 24 hours, the payout is cancelled and your payment is automatically refunded to the original payment method."],
  ["What if somebody outbids me before my sponsorship goes live?", "A creator only earns a sponsorship after it has been verified live. If you're outbid before your placement is ever activated, that transaction is cancelled and you're automatically refunded in full."],
  ["How do you make sure sponsorships stay live?", "Buy My Bio checks active sponsored placements against connected X accounts. We also verify the outgoing placement when a new buyer takes the slot, so creators can't remove a sponsor early and still treat the ownership as successfully completed."],
  ["What if I accidentally edit my bio?", "Buy My Bio allows for normal formatting differences and confirms an active-placement mismatch before treating it as non-compliance. If your sponsored message or link is missing, restore it immediately."],
  ["What happens if a creator removes my sponsorship?", "If a creator removes or changes your placement while you're still the current owner, their payout is blocked and you're refunded automatically. Being replaced because another buyer legitimately paid more is different and counts as a normal ownership change, with no refund."],
  ["When do creators get paid?", "Creator earnings are held for 7 days after a placement is first verified live. Being legitimately outbid during that period doesn't cancel a valid payout. The hold exists to protect the marketplace and doesn't prevent anyone from buying the bio."],
  ["Can someone buy my bio immediately after another person buys it?", "Yes. There is no waiting period. If someone pays the next price, they can take ownership. Every successfully activated purchase is tracked separately."],
  ["How much can a sponsor put in my bio?", "Sponsored messages can contain up to 100 characters plus a separate link, and the whole placement — including the \u201CSponsored:\u201D label — must fit inside X's 160-character bio limit alongside whatever the creator keeps of their own bio. If a creator's own bio text takes up space, the available message length is reduced automatically at checkout."],
  ["Is a placement labelled as an ad?", "Yes. Every placement is published with a \u201CSponsored:\u201D label in front of the buyer's message. Buy My Bio generates that text \u2014 buyers can't remove or reword the label, and we verify it is live before releasing any payout."],
  ["Am I buying an X account?", "No. You're buying a disclosed sponsored placement \u2014 an advertising message and tracked link \u2014 inside a creator's X bio. You never get the account, username, password, profile photo, banner, posts or any access to the account. Creators keep full control of their profile and can remove a placement at any time (which cancels that payout and refunds the buyer)."],
  ["What isn't allowed in a sponsored message?", "Messages must be honest advertising. You can't impersonate the creator, X Corp, Buy My Bio, or anyone else; you can't imply that you own, run, work for or are endorsed by the account beyond the paid placement; and you can't post adult content, illegal goods, malware, scams or hate speech. We moderate messages as well as destinations."],
  ["Is Buy My Bio affiliated with X?", "No. Buy My Bio is an independent marketplace for disclosed sponsored placements in X bios. We are not affiliated with, endorsed by or sponsored by X Corp, and \u201CX\u201D is a trademark of X Corp."],
  ["Will this get my X account in trouble?", "Sponsored placements are permitted advertising when they're clearly disclosed, which is why the \u201CSponsored:\u201D label is mandatory and generated by us. Creators are still responsible for following X's rules, and we suspend listings for placements that break them."],
  ["Are X accounts verified?", "Yes. Creators connect their X account so Buy My Bio can verify account ownership and check active sponsored placements."],
  ["Does Buy My Bio control my X account?", "No. You always remain in control of your X account. Buy My Bio uses the X connection to verify your identity and sponsored placement. You manually update your own bio."],
  ["Can buyers access my X account?", "No. Buyers never receive access to your account, credentials or X connection."],
  ["Who changes my bio when someone buys the slot?", "You do. When somebody buys your sponsored slot, Buy My Bio gives you the exact sponsored message and link to add. Once you've updated your bio, we verify that the placement is live."],
  ["Why do I connect X?", "Connecting X verifies that you control the account you're listing and allows Buy My Bio to verify sponsored placements. The connection is read-only \u2014 we never post, edit your profile, send DMs or change anything on your account."],
  ["Can I buy my own bio?", "No. Listing owners can't buy or outbid their own bio."],
  ["How do refunds work?", "Refunds are automatic and go back to your original payment method. You're refunded if the creator never activates your placement within 24 hours, if you're outbid before it ever goes live, or if the creator removes your placement while you still own the slot. Refunds usually appear within 5-10 business days."],
  ["Can I change my message or link?", "Contact us and we'll update it, subject to moderation."],
  ["What links are not allowed?", "Adult content, illegal goods, malware, scams, hate speech, or anything that would get the creator's X account banned."],
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
