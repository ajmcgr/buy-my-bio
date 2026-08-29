import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startCheckout } from "@/lib/checkout.functions";
import { trackEvent } from "@/lib/listing.functions";
import { money } from "@/lib/format";
import type { ListingView } from "@/lib/listing.functions";

export function BuyDialog({
  view,
  open,
  onClose,
}: {
  view: ListingView;
  open: boolean;
  onClose: () => void;
}) {
  const checkout = useServerFn(startCheckout);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);

  if (!open) return null;
  const price = view.requiredPriceCents;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    try {
      const res = await checkout({
        data: {
          username: view.creator.username,
          companyName: String(f.get("company") ?? ""),
          destinationUrl: String(f.get("destination") ?? ""),
          email: String(f.get("email") ?? ""),
          xHandle: String(f.get("xhandle") ?? "") || null,
          logoUrl: String(f.get("logo") ?? "") || null,
          agreed,
        },
      });
      if ("url" in res && res.url) {
        window.location.href = res.url;
        return;
      }
      setError(("error" in res && res.error) || "Something went wrong.");
    } catch {
      setError("Something went wrong. Try again.");
    }
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/60 p-4 sm:p-8">
      <div className="panel mx-auto w-full max-w-lg">
        <div className="flex items-center justify-between border-b-2 border-border px-5 py-4">
          <span className="label-xs">{view.owner ? "Steal this X bio" : "Own this X bio"}</span>
          <button onClick={onClose} className="text-xl leading-none font-bold" aria-label="Close">
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 border-b-2 border-border">
          <div className="border-r-2 border-border px-5 py-4">
            <div className="label-xs">Current owner</div>
            <div className="font-bold">{view.owner?.company_name ?? "Available"}</div>
          </div>
          <div className="px-5 py-4">
            <div className="label-xs">{view.owner ? "Bio value" : "Starting price"}</div>
            <div className="font-bold">{view.owner ? money(view.owner.amount_cents) : "—"}</div>
          </div>
        </div>

        <div className="border-b-2 border-border px-5 py-4 text-sm">
          <p>You're buying a sponsored message + tracked link inside this creator's X bio.</p>
          <p className="mt-2 text-muted-foreground">
            You are not buying the X account, username, profile photo, banner, posts or access to
            the account.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <div>
            <label className="label-xs" htmlFor="company">
              Startup / Brand name *
            </label>
            <input id="company" name="company" required maxLength={80} className="field mt-1" />
          </div>
          <div>
            <label className="label-xs" htmlFor="destination">
              Destination URL *
            </label>
            <input
              id="destination"
              name="destination"
              required
              placeholder="https://yourstartup.com"
              className="field mt-1"
            />
          </div>
          <div>
            <label className="label-xs" htmlFor="email">
              Email *
            </label>
            <input id="email" name="email" type="email" required className="field mt-1" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-xs" htmlFor="xhandle">
                X handle
              </label>
              <input id="xhandle" name="xhandle" placeholder="@you" className="field mt-1" />
            </div>
            <div>
              <label className="label-xs" htmlFor="logo">
                Logo URL
              </label>
              <input
                id="logo"
                name="logo"
                placeholder="https://.../logo.png"
                className="field mt-1"
              />
            </div>
          </div>

          <div className="border-2 border-border bg-accent px-4 py-3">
            <div className="label-xs !text-accent-foreground/70">Your takeover price</div>
            <div className="text-4xl font-extrabold tracking-tight">{money(price)}</div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-4 accent-foreground"
              required
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className="underline">
                Terms
              </a>{" "}
              and understand destinations are subject to moderation.
            </span>
          </label>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy || !agreed}
            onClick={() => {
              void trackEvent({ data: { name: "buy_clicked", listingId: view.listing.id } });
            }}
            className="btn-ink btn-ink-hover w-full text-base disabled:opacity-40"
          >
            {busy
              ? "Opening checkout…"
              : `${view.owner ? `Steal${view.globalRank === 1 ? " #1" : " this X bio"}` : "Own this X bio"} — ${money(price)}`}
          </button>
        </form>
      </div>
    </div>
  );
}
