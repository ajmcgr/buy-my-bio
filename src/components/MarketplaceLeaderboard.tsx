import { useEffect, useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { ArrowUpRight, Share2, Trophy } from "lucide-react";
import { money } from "@/lib/format";
import type {
  MarketplaceActivity,
  MarketplaceRow,
  MarketplaceSnapshot,
  MarketplaceSort,
} from "@/lib/marketplace.server";
import { getSupabase } from "@/integrations/supabase/browser";

import { BuyDialog } from "./BuyDialog";
import { XIcon } from "./XIcon";

const sorts: Array<{ value: MarketplaceSort; label: string }> = [
  { value: "new", label: "New" },
  { value: "trending", label: "Trending" },
  { value: "affordable", label: "Affordable" },
  { value: "most-valuable", label: "Most valuable" },
];

function TrafficCounters() {
  return (
    <a
      href="https://cloud.umami.is/share/3BTUSlr3W6nAGqWJ"
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-xs font-bold text-primary hover:underline"
    >
      Total visitors 1,360 ↗
    </a>
  );
}

function handleOf(row: MarketplaceRow) {
  return row.creator.x_username ?? row.creator.social_handle ?? row.creator.username;
}

function CreatorIdentity({ row, large = false }: { row: MarketplaceRow; large?: boolean }) {
  const handle = handleOf(row);
  const creatorUrl = row.creator.x_profile_url ?? row.creator.social_profile_url;
  return (
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      {row.creator.profile_image_url ? (
        <img
          src={row.creator.profile_image_url}
          alt=""
          className={`${large ? "size-16 sm:size-20" : "size-12"} shrink-0 border-2 border-border object-cover`}
        />
      ) : (
        <div
          className={`${large ? "size-16 text-2xl sm:size-20" : "size-12 text-lg"} flex shrink-0 items-center justify-center border-2 border-border bg-accent font-extrabold`}
        >
          {row.creator.display_name.slice(0, 1)}
        </div>
      )}
      <div className="min-w-0">
        <Link
          to="/u/$username"
          params={{ username: row.creator.username }}
          className={`${large ? "text-xl sm:text-2xl" : "text-base sm:text-lg"} block truncate font-extrabold hover:underline`}
        >
          {row.creator.display_name}
        </Link>
        <div className="flex items-center gap-1.5 truncate font-mono text-xs text-muted-foreground sm:text-sm">
          <XIcon className="size-3 shrink-0" />
          {creatorUrl ? (
            <a
              href={creatorUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate hover:underline"
              aria-label={`Open @${handle} on X`}
            >
              @{handle}
            </a>
          ) : (
            <span>@{handle}</span>
          )}
          {row.creator.x_account_verified ? <span aria-label="X account connected">✓</span> : null}
        </div>
        {large && row.creator.x_follower_count ? (
          <div className="mt-1 text-xs text-muted-foreground">
            {row.creator.x_follower_count.toLocaleString()} followers
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SponsorDetails({ row }: { row: MarketplaceRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {row.owner?.logo_url ? (
        <img
          src={row.owner.logo_url}
          alt={`${row.owner.company_name} logo`}
          className="size-8 shrink-0 border-2 border-border object-contain"
          loading="lazy"
        />
      ) : null}
      <div className="min-w-0">
        <div className="label-xs">Sponsored</div>
        {row.owner ? (
          <a
            href={row.owner.destination_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 flex min-w-0 items-center gap-1 font-bold hover:underline"
          >
            <span className="truncate">{row.owner.company_name}</span>
            <ArrowUpRight className="size-3.5 shrink-0" />
          </a>
        ) : (
          <div className="mt-0.5 font-bold">—</div>
        )}
      </div>
    </div>
  );
}

function TakeoverButton({ row, prominent = false }: { row: MarketplaceRow; prominent?: boolean }) {
  const [open, setOpen] = useState(false);
  const verb = row.owner ? "Take over" : "Sponsor";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!row.canBuy}
        className={`${prominent ? "w-full py-4 text-base sm:text-lg" : "px-4 py-2.5 text-sm"} btn-ink btn-ink-hover whitespace-nowrap disabled:opacity-40`}
      >
        {row.canBuy
          ? `${verb}${row.globalRank === 1 ? " #1" : ""} — ${money(row.requiredPriceCents)}`
          : "Unavailable"}
      </button>
      <BuyDialog view={row} open={open} onClose={() => setOpen(false)} />
    </>
  );
}

function TrophyCard({ row }: { row: MarketplaceRow }) {
  return (
    <article className="relative overflow-hidden border-x-2 border-b-2 border-border bg-card">
      <div className="flex items-center justify-between gap-3 border-b-2 border-border bg-accent px-4 py-3 text-accent-foreground sm:px-6">
        <div className="flex items-center gap-2 font-mono text-xs font-extrabold">
          <Trophy className="size-4" /> #1 most valuable bio
        </div>
        <span className="font-mono text-[0.65rem] font-bold">The trophy</span>
      </div>
      <div className="grid lg:grid-cols-[1.25fr_0.9fr]">
        <div className="p-5 sm:p-7">
          <CreatorIdentity row={row} large />
          {row.creator.bio ? (
            <p className="mt-5 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {row.creator.bio}
            </p>
          ) : null}
          {row.owner ? (
            <div className="mt-5 border-2 border-border bg-background px-4 py-3 text-sm">
              <SponsorDetails row={row} />
            </div>
          ) : null}
        </div>
        <div className="border-t-2 border-border bg-foreground p-5 text-background lg:border-t-0 lg:border-l-2 lg:p-7">
          <div className="font-mono text-[0.65rem] font-bold text-background/60">Bio value</div>
          <div className="mt-1 text-[clamp(3.25rem,9vw,6rem)] leading-none font-extrabold tracking-[-0.06em]">
            {money(row.bioValueCents ?? 0)}
          </div>
          <div className="mt-6 grid grid-cols-3 gap-5 border-t border-background/30 pt-5">
            <div>
              <div className="font-mono text-[0.6rem] font-bold text-background/60">Sponsor</div>
              <div className="mt-1 truncate font-extrabold">{row.owner?.company_name}</div>
            </div>
            <div>
              <div className="font-mono text-[0.6rem] font-bold text-background/60">Next price</div>
              <div className="mt-1 font-extrabold">{money(row.requiredPriceCents)}</div>
            </div>
            <div>
              <div className="font-mono text-[0.6rem] font-bold text-background/60">Sponsor clicks</div>
              <div className="mt-1 font-extrabold">{row.sponsorClickCount.toLocaleString()}</div>
            </div>
          </div>
          <div className="mt-6 [&_.btn-ink]:border-accent [&_.btn-ink]:bg-accent [&_.btn-ink]:text-accent-foreground">
            <TakeoverButton row={row} prominent />
          </div>
          <p className="mt-3 text-center font-mono text-[0.65rem] text-background/60">
            Pay more → value rises → rank holds or climbs
          </p>
        </div>
      </div>
    </article>
  );
}

function LeaderboardRow({ row, position }: { row: MarketplaceRow; position: number }) {
  const owned = row.bioValueCents !== null && row.owner;
  const displayRank = row.globalRank ?? (owned ? position + 1 : null);
  return (
    <article className="grid gap-4 border-x-2 border-b-2 border-border bg-card p-4 sm:grid-cols-[3rem_minmax(0,1.4fr)_0.75fr_0.8fr_0.6fr_auto] sm:items-center sm:gap-5 sm:px-5">
      <div className="font-mono text-2xl font-extrabold">
        {displayRank ? `#${displayRank}` : "—"}
      </div>
      <CreatorIdentity row={row} />
      <div>
        <div className="label-xs">
          {!row.canBuy ? "Sponsorship" : owned ? "Bio value" : "Starting price"}
        </div>
        <div className="mt-0.5 text-xl font-extrabold">
          {!row.canBuy
            ? "Unavailable"
            : money(owned ? row.bioValueCents! : row.listing.starting_price_cents)}
        </div>
        {!owned && row.canBuy ? (
          <div className="mt-0.5 font-mono text-[0.65rem] font-bold">Unsponsored</div>
        ) : null}
      </div>
      <div className="min-w-0">
        <SponsorDetails row={row} />
      </div>
      <div>
        <div className="label-xs">Sponsor clicks</div>
        <div className="mt-0.5 text-xl font-extrabold">
          {row.sponsorClickCount.toLocaleString()}
        </div>
      </div>
      <TakeoverButton row={row} />
    </article>
  );
}

function ActivityLine({ item }: { item: MarketplaceActivity }) {
  const copy =
    item.type === "listed"
      ? `@${item.handle} entered the market`
      : item.globalRank === 1
        ? `${item.companyName} just took the #1 bio`
        : `${item.companyName} ${item.previousOwner ? "stole" : "bought"} @${item.handle}`;
  return (
    <div className="flex flex-col gap-1 border-b border-border/30 py-3 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <Link
        to="/u/$username"
        params={{ username: item.username }}
        className="font-mono text-xs font-bold hover:underline"
      >
        {copy}
      </Link>
      <div className="flex shrink-0 items-center gap-3 font-mono text-xs">
        <span className="font-bold">
          {item.amountCents !== null
            ? `${item.type === "listed" ? "From " : ""}${money(item.amountCents)}`
            : ""}
        </span>
        <span className="text-muted-foreground">{timeAgo(item.happenedAt)}</span>
      </div>
    </div>
  );
}

function timeAgo(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function AddYourBio() {
  const [handle, setHandle] = useState("");
  return (
    <section
      aria-labelledby="add-heading"
      className="mb-8 border-2 border-border bg-card px-4 py-5 sm:px-6 sm:py-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 id="add-heading" className="text-xl font-semibold">
            Add your bio
          </h2>
          <p className="mt-1 max-w-xl text-sm text-muted-foreground">
            Connect X to add your profile and let anyone sponsor it on Buy My Bio.
          </p>
        </div>
        <form
          className="flex w-full max-w-md flex-col gap-2 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            window.location.href = "/api/public/x-start";
          }}
        >
          <div className="flex min-w-0 flex-1 items-center gap-2 border-2 border-border bg-background px-3">
            <span className="font-mono text-sm text-muted-foreground">@</span>
            <input
              value={handle}
              onChange={(e) => setHandle(e.target.value.replace(/^@/, ""))}
              placeholder="yourhandle"
              aria-label="Your X handle"
              className="min-w-0 flex-1 bg-transparent py-3 font-mono text-sm outline-none"
            />
          </div>
          <button type="submit" className="btn-ink btn-ink-hover shrink-0 px-5 py-3 text-sm">
            Connect X
          </button>
        </form>
      </div>
    </section>
  );
}

export function MarketplaceLeaderboard({ market }: { market: MarketplaceSnapshot }) {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => void router.invalidate();
    const interval = window.setInterval(refresh, 30_000);
    const db = getSupabase();
    const channel = db
      ?.channel("public-market")
      .on("postgres_changes", { event: "*", schema: "public", table: "ownerships" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "listings" }, refresh)
      .subscribe();
    return () => {
      window.clearInterval(interval);
      if (db && channel) void db.removeChannel(channel);
    };
  }, [router]);

  const numberOne = market.sort === "most-valuable" ? market.rows[0] : null;
  const remainingRows = numberOne ? market.rows.slice(1) : market.rows;
  const showSeparateUnowned = market.sort === "most-valuable" && market.unowned.length > 0;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-12 sm:px-5">
      <section className="pb-6 pt-4 sm:pb-8 sm:pt-7">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex flex-col items-center">
            <TrafficCounters />
            <h1 className="mt-1 text-[clamp(2.2rem,7vw,4.8rem)] leading-[0.88] font-extrabold tracking-[-0.055em]">
              What’s your X profile worth?
            </h1>
            <p className="mt-3 max-w-2xl text-base font-medium text-muted-foreground sm:text-lg">
              Put your profile up for sponsorship and find out.
            </p>
          </div>
        </div>
      </section>

      <AddYourBio />

      <section aria-labelledby="leaderboard-heading">
        <div className="flex flex-col gap-4 border-2 border-border bg-card px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div>
            <h2 id="leaderboard-heading" className="text-lg font-extrabold">
              X rankings
            </h2>
            <p className="text-xs text-muted-foreground">
              Ranked by successful sponsorship payments. No weighting. No boosting.
            </p>
          </div>
          <div className="flex max-w-full gap-1 overflow-x-auto" aria-label="Leaderboard sorting">
            {sorts.map((sort) => {
              const active = market.sort === sort.value;
              const href = sort.value === "new" ? "/" : `/?sort=${sort.value}`;
              return (
                <a
                  key={sort.value}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`shrink-0 px-3 py-2 font-mono text-[0.65rem] font-bold ${
                    active ? "bg-foreground text-background" : "bg-muted hover:bg-accent"
                  }`}
                >
                  {sort.label}
                </a>
              );
            })}
          </div>
        </div>

        {numberOne ? <TrophyCard row={numberOne} /> : null}
        {remainingRows.length > 0 ? (
          <div>
            {remainingRows.map((row, index) => (
              <LeaderboardRow
                key={row.listing.id}
                row={row}
                position={index + (numberOne ? 1 : 0)}
              />
            ))}
          </div>
        ) : !numberOne ? (
          <div className="border-x-2 border-b-2 border-border bg-card px-5 py-10 text-center">
            <p className="text-xl font-extrabold">No profiles have been listed yet.</p>
            <p className="mt-2 text-sm text-muted-foreground">
              The first successful live payment will create the first real market value and #1 rank.
            </p>
          </div>
        ) : null}
      </section>

      {showSeparateUnowned ? (
        <section className="mt-12" aria-labelledby="unowned-heading">
          <div className="mb-3 flex items-end justify-between gap-4">
            <div>
              <h2 id="unowned-heading" className="text-xl font-extrabold">
                Unsponsored profiles
              </h2>
              <p className="text-xs text-muted-foreground">
                Starting prices are not Bio Value and do not affect the rankings.
              </p>
            </div>
            <Link to="/creator" className="hidden text-sm font-bold underline sm:block">
              List yours
            </Link>
          </div>
          <div className="border-t-2 border-border">
            {market.unowned.map((row, index) => (
              <LeaderboardRow key={row.listing.id} row={row} position={index} />
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-12 grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="border-2 border-border bg-card px-4 sm:px-5">
          <div className="flex items-center justify-between border-b-2 border-border py-4">
            <h2 className="font-mono text-xs font-extrabold">Live activity</h2>
            <span className="size-2 animate-pulse rounded-full bg-primary" />
          </div>
          {market.activity.length ? (
            market.activity.map((item) => <ActivityLine key={item.id} item={item} />)
          ) : (
            <p className="py-8 text-sm text-muted-foreground">No market activity yet.</p>
          )}
        </div>
        <div className="border-2 border-border bg-accent p-5 text-accent-foreground">
          <div className="label-xs !text-accent-foreground/60">The status loop</div>
          <p className="mt-3 text-xl leading-tight font-extrabold">
            Sponsor a profile. Its value rises. Its rank rises. Everyone sees it.
          </p>
          <Link
            to="/creator"
            className="mt-6 inline-flex items-center gap-2 text-sm font-extrabold underline"
          >
            Add your bio <ArrowUpRight className="size-4" />
          </Link>
          {numberOne ? (
            <a
              className="mt-4 flex items-center gap-2 text-sm font-bold underline"
              href={`https://x.com/intent/post?text=${encodeURIComponent(
                `@${handleOf(numberOne)} has the #1 creator sponsorship on Buy My Bio at ${money(numberOne.bioValueCents ?? 0)}.`,
              )}&url=${encodeURIComponent(`https://buymybio.com/u/${numberOne.creator.username}`)}`}
              target="_blank"
              rel="noreferrer"
            >
              <Share2 className="size-4" /> Share #1
            </a>
          ) : null}
        </div>
      </section>
    </div>
  );
}
