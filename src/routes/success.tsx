import { createFileRoute, Link } from "@tanstack/react-router";
import { settleSession } from "@/lib/checkout.functions";
import { money } from "@/lib/format";
import { z } from "zod";

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
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-4xl font-black tracking-tight">
          {stale ? "Someone beat you to it" : "Payment pending"}
        </h1>
        <p className="mt-3 text-muted-foreground">
          {stale
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
      <h1 className="mt-2 text-[clamp(2.5rem,10vw,4.5rem)] leading-[0.88] font-black tracking-[-0.05em]">
        You own the bio
      </h1>
      <div className="panel mt-8 divide-y-2 divide-border">
        <div className="px-5 py-4">
          <div className="label-xs">Owner</div>
          <div className="text-xl font-extrabold">{result.companyName}</div>
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
            `I just bought the link in a bio for ${money(result.amountCents)}. buymybio.com/${result.slug}`,
          )}`}
          target="_blank"
          rel="noreferrer"
          className="btn-ink btn-ink-hover"
        >
          Share on X
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
