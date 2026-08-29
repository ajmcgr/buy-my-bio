import { createFileRoute, Link } from "@tanstack/react-router";
import { settleSession } from "@/lib/checkout.functions";
import { money } from "@/lib/format";
import { z } from "zod";
import { Trophy } from "lucide-react";

export const Route = createFileRoute("/success")({
  validateSearch: z.object({ session_id: z.string().optional() }),
  loaderDeps: ({ search }) => ({ sessionId: search.session_id }),
  loader: async ({ deps }) => {
    if (!deps.sessionId) return { status: "unknown" as const };
    return await settleSession({ data: { sessionId: deps.sessionId } });
  },
  head: () => ({
    meta: [
      { title: "You own the bio — Buy My Bio" },
      { name: "description", content: "Your takeover is confirmed. The bio link is yours." },
      { property: "og:title", content: "I just bought the link in a bio" },
      {
        property: "og:description",
        content: "The bio link now points to my startup — until someone outbids me.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Success,
  errorComponent: () => (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-extrabold">We couldn't confirm this payment yet.</h1>
      <p className="mt-2 text-muted-foreground">
        If you were charged, your ownership will appear within a minute. Check your email.
      </p>
    </div>
  ),
});

function Success() {
  const result = Route.useLoaderData();

  if (result.status !== "owned") {
    const stale = result.status === "stale";
    const testMode = stale && result.reason === "test_mode_not_allowed";
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">
          {testMode
            ? "Live payments aren't enabled"
            : stale
              ? "Someone beat you to it"
              : "Payment pending"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {testMode
            ? "This was a Stripe test-mode checkout, so it cannot create ownership or public Bio Value."
            : stale
              ? "The price moved before your payment landed. You'll be refunded automatically — no charge sticks."
              : "We're still confirming your payment. This page updates within a minute."}
        </p>
        <Link to="/" className="btn-ink btn-ink-hover mt-8">
          Back to the listing
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="label-xs">Confirmed</p>
      <h1 className="mt-2 text-[clamp(2.5rem,10vw,4.5rem)] leading-[0.88] font-semibold tracking-[-0.05em]">
        {result.globalRank === 1 ? "You own the #1 bio." : "You own the bio"}
      </h1>
      {result.globalRank === 1 ? (
        <div className="mt-6 flex items-center gap-3 border-2 border-border bg-accent px-5 py-4 font-mono text-sm font-extrabold text-accent-foreground">
          <Trophy className="size-5" /> The most valuable sponsored X bio on Buy My Bio
        </div>
      ) : result.globalRank ? (
        <p className="mt-4 font-mono text-sm font-bold">Now #{result.globalRank} most valuable</p>
      ) : null}
      <div className="panel mt-8 divide-y-2 divide-border">
        <div className="px-5 py-4">
          <div className="label-xs">Owner</div>
          <div className="text-xl font-extrabold">{result.companyName}</div>
        </div>
        <div className="px-5 py-4">
          <div className="label-xs">X bio</div>
          <div className="text-xl font-extrabold">@{result.creatorHandle}</div>
        </div>
        <div className="px-5 py-4">
          <div className="label-xs">Paid</div>
          <div className="text-xl font-extrabold">{money(result.amountCents)}</div>
        </div>
        <div className="px-5 py-4">
          <div className="label-xs">Live link</div>
          <a href={`/${result.slug}`} className="font-mono font-bold underline">
            buymybio.com/{result.slug}
          </a>
        </div>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
            result.globalRank === 1
              ? `We own the #1 most valuable bio on X.\n\n@${result.creatorHandle} — ${money(result.amountCents)}`
              : `We just bought @${result.creatorHandle}'s X bio for ${money(result.amountCents)}${result.globalRank ? `. Now #${result.globalRank} on @BuyMyBio.` : "."}`,
          )}&url=${encodeURIComponent(`https://buymybio.com/u/${result.slug}`)}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ink btn-ink-hover"
        >
          {result.globalRank === 1 ? "Share the #1 win" : "Share on X"}
        </a>
        <Link to="/u/$username" params={{ username: result.slug }} className="btn-outline-ink">
          View the listing
        </Link>
      </div>

      <p className="mt-8 text-sm text-muted-foreground">
        You'll get an email if someone outbids you, so you can take it back.
      </p>
    </div>
  );
}
