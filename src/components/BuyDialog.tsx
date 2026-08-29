import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { startCheckout } from "@/lib/checkout.functions";
import { trackEvent } from "@/lib/listing.functions";
import { money } from "@/lib/format";
import type { ListingView } from "@/lib/listing.functions";
import {
  MESSAGE_MAX_CHARS,
  SPONSOR_PREFIX,
  buildPlacementText,
  messageCharLimit,
  validatePlacement,
} from "@/lib/placement";

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
  const [message, setMessage] = useState("");
  const [link, setLink] = useState("");

  if (!open) return null;
  const price = view.requiredPriceCents;
  const retainedChars = view.retainedBioChars ?? 0;
  const limit = messageCharLimit(retainedChars, link);
  const preview = buildPlacementText(
    message.trim() || "Your message",
    link.trim() || "https://yourlink.com",
  );
  const overLimit = message.trim().length > limit;

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const msg = message.trim();
    if (!/^https?:\/\/\S+\.\S+/i.test(link.trim())) {
      setError("Your link must be a valid http:// or https:// URL.");
      setBusy(false);
      return;
    }
    const check = validatePlacement({ message: msg, url: link.trim(), retainedChars });
    if (!check.ok) {
      setError(check.error);
      setBusy(false);
      return;
    }
    try {
      const res = await checkout({
        data: {
          username: view.creator.username,
          companyName: String(f.get("company") ?? ""),
          bioMessage: msg,
          destinationUrl: link.trim(),
          email: String(f.get("email") ?? ""),
          xHandle: String(f.get("xhandle") ?? "") || null,
          logoUrl: String(f.get("logo") ?? "") || null,
          agreed,
          creatorToken:
            typeof window === "undefined" ? null : localStorage.getItem("bmb_creator_token"),
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
          <span className="label-xs !text-foreground">{view.owner ? "Steal this X bio" : "Own this X bio"}</span>
          <button
            onClick={onClose}
            className="text-2xl leading-none font-bold text-foreground hover:opacity-70"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-2 border-b-2 border-border">
          <div className="border-r-2 border-border px-5 py-4">
            <div className="label-xs">Current owner</div>
            <div className="font-bold text-foreground">{view.owner?.company_name ?? "Available"}</div>
          </div>
          <div className="px-5 py-4">
            <div className="label-xs">{view.owner ? "Bio value" : "Starting price"}</div>
            <div className="font-bold text-foreground">
              {view.owner ? money(view.owner.amount_cents) : "—"}
            </div>
          </div>
        </div>

        <div className="border-b-2 border-border px-5 py-4 text-sm text-foreground">
          <p>
            You're buying a <b>sponsored placement</b> — a disclosed advertising message and
            tracked link on this creator's Buy My Bio profile.
          </p>
          <p className="mt-2 text-foreground/75">
            You are not buying the X account, username, profile photo, banner, posts, or any
            access to the account, and nothing is added to the creator's X profile. The placement
            appears on buymybio.com only.
          </p>
          <p className="mt-2 text-foreground/75">
            Your placement is always published with a “{SPONSOR_PREFIX}” label so it's clear to
            everyone that it's paid advertising. Your message must not imply that you own, run or
            are employed by the account, and must not impersonate the creator or anyone else.
          </p>
        </div>


        <form onSubmit={submit} className="space-y-4 px-5 py-5">
          <div>
            <label className="label-xs" htmlFor="biomessage">
              Your message *
            </label>
            <input
              id="biomessage"
              name="biomessage"
              required
              minLength={3}
              maxLength={MESSAGE_MAX_CHARS}
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX_CHARS))}
              placeholder="Sponsored by YourStartup"
              className="field mt-1"
            />
            <div className="mt-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {limit < MESSAGE_MAX_CHARS
                  ? `${limit} characters available.`
                  : "Your placement stays live until someone pays more."}
              </span>
              <span
                className={overLimit ? "font-semibold text-destructive" : "text-muted-foreground"}
              >
                {message.trim().length} / {limit}
              </span>
            </div>
          </div>
          <div>
            <label className="label-xs" htmlFor="destination">
              Your link *
            </label>
            <input
              id="destination"
              name="destination"
              required
              type="url"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="https://yourstartup.com"
              className="field mt-1"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Your link is shown with your message on the creator's Buy My Bio profile.
            </p>
          </div>

          <div className="border-2 border-border bg-muted px-4 py-3">
            <div className="label-xs">Exactly how your placement appears</div>
            <p className="mt-1 text-sm font-medium break-words text-foreground">{preview}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              We add the “{SPONSOR_PREFIX}” label automatically — it can't be removed, so your
              placement is always clearly disclosed as paid advertising.
            </p>
          </div>

          <div>
            <label className="label-xs" htmlFor="company">
              Startup / Brand name *
            </label>
            <input id="company" name="company" required maxLength={80} className="field mt-1" />
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
            <div className="text-4xl font-extrabold tracking-tight text-accent-foreground">{money(price)}</div>
          </div>

          <div className="border-2 border-border px-4 py-3 text-sm text-foreground">
            <p className="font-semibold">You'll own this sponsored slot until somebody pays more.</p>
            <p className="mt-1 text-muted-foreground">
              Your sponsored message goes live on this creator's Buy My Bio profile immediately
              after payment. Nothing needs to change on X.
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-1 size-4 accent-foreground"
              required
            />
            <span>
              I agree to the{" "}
              <a href="/terms" className="font-semibold underline">
                Terms
              </a>{" "}
              , confirm my placement is honest advertising that doesn't impersonate the creator
              or anyone else, and understand messages and destinations are subject to moderation.
            </span>
          </label>


          {error && <p className="text-sm font-medium text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={busy || !agreed || message.trim().length < 3 || overLimit || limit <= 0}
            onClick={() => {
              void trackEvent({ data: { name: "buy_clicked", listingId: view.listing.id } });
            }}
            className="btn-ink btn-ink-hover w-full text-base disabled:cursor-not-allowed disabled:opacity-70"
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
