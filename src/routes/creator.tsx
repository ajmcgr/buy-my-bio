import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import { getCreatorSession, verifyMyBio, type CreatorSession } from "@/lib/creator.functions";
import {
  getPayoutStatus,
  startPayoutOnboarding,
  refreshPayoutAccount,
  payoutDashboardLink,
  type PayoutStatus,
} from "@/lib/payouts.functions";
import { money } from "@/lib/format";

export const Route = createFileRoute("/creator")({
  head: () => ({
    meta: [
      { title: "Sell Your X Bio — Buy My Bio" },
      {
        name: "description",
        content:
          "Connect your X account, add the BuyMyBio placement to your profile, and open your bio to bids.",
      },
      { property: "og:title", content: "Sell Your X Bio — Buy My Bio" },
      {
        property: "og:description",
        content: "Verify your X account and bio placement to start earning from your bio link.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CreatorPage,
});

const STORAGE_KEY = "bmb_creator_token";

function Badge({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 border-2 border-border px-3 py-1.5 font-mono text-xs font-bold ${
        on ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"
      }`}
    >
      {on ? "✓" : "○"} {label}
    </span>
  );
}

function CreatorPage() {
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<CreatorSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [payouts, setPayouts] = useState<PayoutStatus | null>(null);

  const loadPayouts = useCallback((t: string) => {
    void getPayoutStatus({ data: { token: t } }).then((p) => setPayouts(p));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setMessage(errorCopy(err));
    const connected = params.get("connected");
    if (connected && !err) setMessage(`X account verified — @${connected}`);
    const stripeReturn = params.get("stripe");
    const fromUrl = params.get("t");
    if (fromUrl || stripeReturn) {
      if (fromUrl) localStorage.setItem(STORAGE_KEY, fromUrl);
      window.history.replaceState({}, "", "/creator");
    }
    const t = fromUrl ?? localStorage.getItem(STORAGE_KEY);
    setToken(t);
    if (!t) {
      setLoading(false);
      return;
    }
    void getCreatorSession({ data: { token: t } })
      .then((s) => setSession(s))
      .finally(() => setLoading(false));

    if (stripeReturn) {
      void refreshPayoutAccount({ data: { token: t } }).then(() => loadPayouts(t));
    } else {
      loadPayouts(t);
    }
  }, [loadPayouts]);

  async function onVerify() {
    if (!token) return;
    setBusy(true);
    setMessage(null);
    const res = await verifyMyBio({ data: { token } });
    if ("error" in res) setMessage(res.error);
    else {
      setMessage("Bio verified. Your listing is live.");
      setSession(await getCreatorSession({ data: { token } }));
    }
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-[clamp(2rem,7vw,3.25rem)] leading-[0.9] font-semibold tracking-[-0.05em]">
        Sell your X bio
      </h1>
      <p className="mt-4 text-muted-foreground">
        Two steps. Connect your real X account, then put the BuyMyBio placement in your X profile.
        Both must be verified before anyone can bid.
      </p>

      {message ? <div className="panel mt-6 px-4 py-3 text-sm font-medium">{message}</div> : null}

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : !session ? (
        <div className="panel mt-8 p-6">
          <div className="label-xs">Step 1</div>
          <h2 className="mt-1 text-xl font-extrabold">Connect your X account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            We use X sign-in to confirm you own the account. Buyers never need an account.
          </p>
          <a href="/api/public/x-start" className="btn-ink btn-ink-hover mt-6">
            Connect X
          </a>
        </div>
      ) : (
        <>
          <div className="panel mt-8 flex items-center gap-4 p-6">
            {session.profileImageUrl ? (
              <img
                src={session.profileImageUrl}
                alt={session.displayName}
                className="size-14 border-2 border-border"
              />
            ) : (
              <div className="flex size-14 items-center justify-center border-2 border-border bg-accent text-xl font-extrabold">
                {session.displayName.slice(0, 1)}
              </div>
            )}
            <div className="min-w-0">
              <div className="text-lg font-extrabold">{session.displayName}</div>
              <div className="font-mono text-sm text-muted-foreground">
                @{session.handle} · {session.followers.toLocaleString()} followers
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-3">
            <Badge on={session.accountVerified} label="X account verified" />
            <Badge on={session.bioVerified} label="X bio verified" />
          </div>

          {session.bioVerified ? (
            <div className="mt-8 border-2 border-border bg-foreground text-background">
              <div className="border-b border-background/25 px-5 py-3 font-mono text-xs font-bold">
                Your bio
              </div>
              <div className="grid sm:grid-cols-3">
                <div className="px-5 py-5 sm:border-r sm:border-background/25">
                  <div className="font-mono text-[0.65rem] font-bold text-background/60">
                    Bio value
                  </div>
                  <div className="mt-1 text-3xl font-extrabold">
                    {session.bioValueCents === null ? "—" : money(session.bioValueCents)}
                  </div>
                </div>
                <div className="border-t border-background/25 px-5 py-5 sm:border-t-0 sm:border-r">
                  <div className="font-mono text-[0.65rem] font-bold text-background/60">
                    Global rank
                  </div>
                  <div className="mt-1 text-3xl font-extrabold">
                    {session.globalRank ? `#${session.globalRank}` : "Unranked"}
                  </div>
                </div>
                <div className="border-t border-background/25 px-5 py-5 sm:border-t-0">
                  <div className="font-mono text-[0.65rem] font-bold text-background/60">
                    Owned by
                  </div>
                  <div className="mt-1 truncate text-xl font-extrabold">
                    {session.ownerName ?? "Unowned"}
                  </div>
                </div>
              </div>
              {session.globalRank && session.bioValueCents !== null ? (
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(
                    `My X bio is now worth ${money(session.bioValueCents)}.\n\nCurrently #${session.globalRank} on @BuyMyBio.`,
                  )}&url=${encodeURIComponent(`https://buymybio.com/u/${session.username}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center gap-2 border-t border-background/25 px-5 py-4 font-extrabold hover:bg-background/10"
                >
                  <Share2 className="size-4" /> Share my rank
                </a>
              ) : null}
            </div>
          ) : null}

          <div className="panel mt-8 p-6">
            <div className="label-xs">Step 2</div>
            <h2 className="mt-1 text-xl font-extrabold">Add this to your X bio</h2>
            <div className="mt-4 inline-block border-2 border-border bg-accent px-3 py-2 font-mono text-sm font-bold">
              {session.requiredPlacement}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Paste it into your X bio or website field, save your profile, then verify. If we can't
              read it automatically, an admin will confirm it manually.
            </p>
            <button
              onClick={onVerify}
              disabled={busy || session.bioVerified}
              className="btn-ink btn-ink-hover mt-6 disabled:opacity-50"
            >
              {session.bioVerified ? "X bio verified" : busy ? "Checking…" : "Verify your X bio"}
            </button>
          </div>

          {token ? (
            <PayoutsPanel token={token} status={payouts} onChange={() => loadPayouts(token)} />
          ) : null}



          <p className="mt-6 text-sm text-muted-foreground">
            Listing status:{" "}
            <span className="font-mono font-bold">{session.listingStatus ?? "none"}</span>
            {session.bioVerified ? (
              <>
                {" "}
                — live at{" "}
                <a className="underline" href={`/u/${session.username}`}>
                  buymybio.com/u/{session.username}
                </a>
              </>
            ) : null}
          </p>
        </>
      )}
    </div>
  );
}

function errorCopy(code: string): string {
  switch (code) {
    case "x_not_configured":
      return "X sign-in isn't configured yet — X_CLIENT_ID and X_CLIENT_SECRET are missing.";
    case "x_denied":
      return "You cancelled the X authorisation. Nothing was connected.";
    case "x_callback_error":
      return "X returned an error during sign-in. Please try again.";
    case "x_already_connected":
      return "That X account is already connected to another BuyMyBio creator.";
    case "missing_code":
      return "That sign-in didn't complete. Please connect again.";
    case "creator_create_failed":
      return "We couldn't create your creator profile. Please try again.";
    case "bad_state":
      return "That sign-in link expired. Please connect again.";
    case "handle_taken":
      return "That handle is already listed. Contact us if it's yours.";
    case "x_auth_failed":
      return "X sign-in failed. Please try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

function payoutLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Held in escrow";
    case "blocked":
      return "On hold — needs attention";
    case "paid":
      return "Paid out";
    case "cancelled":
      return "Cancelled (refunded)";
    default:
      return "Failed";
  }
}

function PayoutsPanel({
  token,
  status,
  onChange,
}: {
  token: string;
  status: PayoutStatus | null;
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onConnect() {
    setBusy(true);
    setError(null);
    const res = await startPayoutOnboarding({ data: { token } });
    if ("error" in res) {
      setError(res.error);
      setBusy(false);
      return;
    }
    window.location.href = res.url;
  }

  async function onDashboard() {
    setBusy(true);
    const res = await payoutDashboardLink({ data: { token } });
    setBusy(false);
    if ("url" in res) window.open(res.url, "_blank", "noopener");
    else setError(res.error);
  }

  return (
    <div className="panel mt-8 p-6">
      <div className="label-xs">Step 3</div>
      <h2 className="mt-1 text-xl font-extrabold">Get paid</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Buyers pay Buy My Bio. We hold your share for {status?.holdDays ?? 3} days, re-check that
        the placement is still live in your X bio, then transfer it to your bank via Stripe.
      </p>

      {status ? (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <Badge on={status.connected} label="Payout account created" />
            <Badge on={status.payoutsEnabled} label="Payouts enabled" />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="border-2 border-border px-4 py-3">
              <div className="font-mono text-[0.65rem] font-bold text-muted-foreground">
                In escrow
              </div>
              <div className="mt-1 text-2xl font-extrabold">{money(status.pendingCents)}</div>
            </div>
            <div className="border-2 border-border px-4 py-3">
              <div className="font-mono text-[0.65rem] font-bold text-muted-foreground">
                Paid out
              </div>
              <div className="mt-1 text-2xl font-extrabold">{money(status.paidCents)}</div>
            </div>
          </div>

          {status.items.length ? (
            <ul className="mt-5 divide-y divide-border border-2 border-border">
              {status.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <div className="font-mono text-sm font-bold">{money(item.amountCents)}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {payoutLabel(item.status)}
                      {item.status === "pending"
                        ? ` · releases ${new Date(item.holdUntil).toLocaleDateString()}`
                        : ""}
                      {item.status === "blocked" && item.note ? ` · ${item.note}` : ""}
                    </div>
                  </div>
                  <div className="shrink-0 font-mono text-xs text-muted-foreground">
                    of {money(item.grossCents)}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-sm text-muted-foreground">
              No takeovers yet. Payouts appear here the moment someone buys your bio.
            </p>
          )}

          {error ? <p className="mt-4 text-sm font-medium text-destructive">{error}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={onConnect}
              disabled={busy || !status.configured}
              className="btn-ink btn-ink-hover disabled:opacity-50"
            >
              {busy
                ? "Opening Stripe…"
                : status.payoutsEnabled
                  ? "Update payout details"
                  : status.connected
                    ? "Finish payout setup"
                    : "Set up payouts"}
            </button>
            {status.connected ? (
              <button onClick={onDashboard} disabled={busy} className="btn-outline">
                Stripe dashboard
              </button>
            ) : null}
            <button onClick={onChange} className="btn-outline">
              Refresh
            </button>
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-muted-foreground">Loading payouts…</p>
      )}
    </div>
  );
}
