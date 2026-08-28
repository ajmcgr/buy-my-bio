import { useEffect, useState } from "react";
import { money, duration, hostOf } from "@/lib/format";
import type { ListingView } from "@/lib/listing.functions";
import { trackEvent } from "@/lib/listing.functions";
import { BuyDialog } from "./BuyDialog";

function ProfileCard({ view }: { view: ListingView }) {
  const c = view.creator;
  return (
    <div className="panel p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center border-2 border-border bg-accent text-xl font-extrabold">
          {c.display_name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <div className="text-lg leading-tight font-extrabold">{c.display_name}</div>
          <div className="font-mono text-sm text-muted-foreground">@{c.social_handle}</div>
          <p className="mt-3 text-sm">{c.bio}</p>
          <div className="mt-4">
            <div className="inline-block border-2 border-border bg-accent px-3 py-1.5 font-mono text-sm font-bold">
              buymybio.com/{c.username}
            </div>
            <div className="label-xs mt-2">↑ This is what you're buying</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-border px-5 py-4 not-last:border-b-2 sm:not-last:border-r-2 sm:not-last:border-b-0">
      <div className="label-xs">{label}</div>
      <div className="mt-1 truncate text-lg font-bold">{value}</div>
    </div>
  );
}

export function BioListing({ view, heading }: { view: ListingView; heading: boolean }) {
  const [open, setOpen] = useState(false);
  const owner = view.owner;
  const price = view.requiredPriceCents;

  useEffect(() => {
    void trackEvent({
      data: { name: heading ? "homepage_view" : "listing_view", listingId: view.listing.id },
    });
  }, [heading, view.listing.id]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:py-14">
      {heading ? (
        <h1 className="text-[clamp(2.75rem,11vw,6.5rem)] leading-[0.85] font-black tracking-[-0.05em]">
          BUY MY BIO
        </h1>
      ) : (
        <h1 className="text-[clamp(2rem,7vw,3.5rem)] leading-[0.9] font-black tracking-[-0.05em]">
          BUY @{view.creator.social_handle}'S BIO
        </h1>
      )}

      <p className="mt-5 text-2xl font-bold sm:text-3xl">Buy the link in my bio.</p>
      <p className="mt-1 text-base text-muted-foreground sm:text-lg">
        Highest bidder owns it until they're outbid.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <ProfileCard view={view} />

        <div className="panel flex flex-col justify-between">
          <div className="border-b-2 border-border px-5 py-4">
            <div className="label-xs">Current owner</div>
            <div className="mt-1 flex items-center gap-3">
              {owner?.logo_url && (
                <img
                  src={owner.logo_url}
                  alt={`${owner.company_name} logo`}
                  className="size-8 border-2 border-border object-contain"
                  loading="lazy"
                />
              )}
              <span className="text-2xl font-extrabold">
                {owner ? owner.company_name : "Available"}
              </span>
            </div>
          </div>

          <div className="px-5 py-6">
            <div className="label-xs">{owner ? "Current price" : "Starting price"}</div>
            <div className="text-[clamp(3rem,14vw,5.5rem)] leading-[0.85] font-black tracking-[-0.05em]">
              {money(owner ? owner.amount_cents : view.listing.starting_price_cents)}
            </div>
          </div>

          <div className="grid grid-cols-2 border-t-2 border-border">
            <div className="border-r-2 border-border px-5 py-4">
              <div className="label-xs">Destination</div>
              <div className="truncate font-bold">
                {owner ? hostOf(owner.destination_url) : "—"}
              </div>
            </div>
            <div className="px-5 py-4">
              <div className="label-xs">Clicks</div>
              <div className="font-bold">{(owner?.click_count ?? 0).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8">
        {view.canBuy ? (
          <>
            <button
              onClick={() => setOpen(true)}
              className="btn-ink btn-ink-hover w-full py-6 text-[clamp(1.25rem,4.5vw,2rem)] font-black tracking-tight"
            >
              {owner ? "TAKE MY BIO" : "BUY MY BIO"} — {money(price)}
            </button>
            <p className="mt-3 text-center text-sm text-muted-foreground">
              Pay more. Take the link. Keep it until someone outbids you.
            </p>
          </>
        ) : (
          <div className="panel px-5 py-6 text-center">
            <p className="font-bold">This bio isn't accepting buyers right now.</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {!view.creator.x_bio_verified
                ? "The creator hasn't been verified yet."
                : "The listing is paused."}
            </p>
          </div>
        )}
      </div>

      <section className="mt-20">
        <h2 className="label-xs">Previous owners</h2>
        {view.history.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">
            No previous owners yet. {owner ? "" : "Be the first."}
          </p>
        ) : (
          <div className="panel mt-3 divide-y-2 divide-border">
            <div className="label-xs grid grid-cols-4 gap-2 px-4 py-2">
              <span>Owner</span>
              <span>Paid</span>
              <span>Owned for</span>
              <span className="text-right">Clicks</span>
            </div>
            {view.history.map((o) => (
              <div key={o.id} className="grid grid-cols-4 gap-2 px-4 py-3 text-sm">
                <span className="truncate font-bold">{o.company_name}</span>
                <span>{money(o.amount_cents)}</span>
                <span>{duration(o.started_at, o.ended_at)}</span>
                <span className="text-right">{o.click_count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-20 grid gap-6 sm:grid-cols-3">
        {[
          ["1. BUY", "Pay more than the current owner."],
          ["2. OWN", "Your website becomes the destination of the bio link."],
          ["3. GET OUTBID", "Someone pays more and takes it."],
        ].map(([t, d]) => (
          <div key={t} className="panel px-5 py-6">
            <div className="text-lg font-extrabold">{t}</div>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </section>
      <p className="mt-6 font-mono text-sm">
        No deadline. No expiry. Highest bidder owns it.
      </p>

      <BuyDialog view={view} open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

export { Stat };
