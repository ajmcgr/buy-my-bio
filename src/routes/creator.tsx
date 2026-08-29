import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Share2 } from "lucide-react";
import {
  getCreatorSession,
  disconnectXAccount,
  publishListing,
  type CreatorSession,
} from "@/lib/creator.functions";
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
      { title: "Add Your Profile — Buy My Bio" },
      {
        name: "description",
        content: "Connect X, list your profile, and let anyone sponsor you on BuyMyBio.com.",
      },
      { property: "og:title", content: "Add Your Profile — Buy My Bio" },
      {
        property: "og:description",
        content: "Connect X to confirm your identity, then list your profile on Buy My Bio.",
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
    if (connected && !err) setMessage(`X account connected — @${connected}`);
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

  async function onPublish() {
    if (!token) return;
    setBusy(true);
    const res = await publishListing({ data: { token } });
    setBusy(false);
    if ("error" in res) {
      setMessage(res.error);
      return;
    }
    setMessage("Your profile is now listed on Buy My Bio.");
    const next = await getCreatorSession({ data: { token } });
    setSession(next);
  }

  async function onDisconnect(deleteData: boolean) {
    if (!token) return;
    const obligation = Boolean(session?.ownerMessage || session?.activation);
    const obligationWarning =
      "Disconnecting X will keep your profile in the rankings but stop it from accepting new sponsors. It does not cancel any current sponsorship or pending payout obligations.";
    const warn = deleteData
      ? "Disconnect X and delete your Buy My Bio data? This can't be undone."
      : "Disconnect your X account from Buy My Bio?";
    if (!window.confirm(obligation ? `${obligationWarning}\n\n${warn}` : warn)) return;
    setBusy(true);
    setMessage(null);
    const res = await disconnectXAccount({ data: { token, deleteData } });
    setBusy(false);
    if ("error" in res) {
      setMessage(res.error);
      return;
    }
    localStorage.removeItem(STORAGE_KEY);
    setToken(null);
    setSession(null);
    setPayouts(null);
    setMessage(
      res.deleted
        ? "Your X account is disconnected and your data has been deleted."
        : "hasObligation" in res && res.hasObligation
          ? "Your X account is disconnected and your listing no longer accepts new buyers. Your current sponsorship and any held payout continue under the existing rules."
          : "retained" in res && res.retained
            ? "Your X account is disconnected. Your profile remains in the rankings but is unsponsored and unavailable until you reconnect. Past transaction records are retained."
            : "Your X account is disconnected. Your profile remains in the rankings but is unsponsored and unavailable until you reconnect.",
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-5 py-14">
      <h1 className="text-[clamp(2rem,7vw,3.25rem)] leading-[0.9] font-semibold tracking-[-0.05em]">
        Add your profile
      </h1>
      <p className="mt-4 text-muted-foreground">
        Connect X to confirm your identity, then put your profile up for sponsorship on
        BuyMyBio.com.
      </p>

      {message ? <div className="panel mt-6 px-4 py-3 text-sm font-medium">{message}</div> : null}

      {loading ? (
        <p className="mt-10 text-sm text-muted-foreground">Loading…</p>
      ) : !session ? (
        <div className="panel mt-8 p-6">
          <div className="label-xs">Get listed</div>
          <h2 className="mt-1 text-xl font-semibold">Connect X to confirm your account</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Your connection confirms your identity and imports your public profile. Sponsorships
            appear on BuyMyBio.com.
          </p>
          <a href="/api/public/x-start" className="btn-ink btn-ink-hover mt-6">
            Connect X
          </a>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            Used for identity verification only.
          </p>
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

          {!session.publiclyListed ? (
            <div className="panel mt-6 p-6">
              <div className="label-xs">Not listed yet</div>
              <h2 className="mt-1 text-xl font-semibold">List my profile</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Connecting X does not list you publicly. Publish when you're ready, then buyers can
                sponsor your profile on BuyMyBio.com.
              </p>
              <button
                onClick={onPublish}
                disabled={busy}
                className="btn-ink btn-ink-hover mt-5 disabled:opacity-50"
              >
                {busy ? "Working…" : "List my profile"}
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Badge on={session.accountVerified} label="X account connected" />
            <Badge on={session.publiclyListed} label="Listed publicly" />
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
                    Sponsored by
                  </div>
                  <div className="mt-1 truncate text-xl font-extrabold">
                    {session.ownerName ?? "Unowned"}
                  </div>
                </div>
              </div>
              {session.globalRank && session.bioValueCents !== null ? (
                <a
                  href={`https://x.com/intent/post?text=${encodeURIComponent(
                    `My profile sponsorship is now worth ${money(session.bioValueCents)}.\n\nCurrently #${session.globalRank} on @BuyMyBio.`,
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

          {session.ownerMessage ? (
            <div className="panel mt-8 p-6">
              <div className="label-xs">Sponsored on Buy My Bio</div>
              <h2 className="mt-1 text-xl font-semibold">
                Your sponsored slot is live on Buy My Bio
              </h2>
              <div className="mt-4 inline-block border-2 border-border bg-accent px-3 py-2 font-mono text-sm font-bold text-accent-foreground">
                {session.ownerPlacement ??
                  `${session.ownerMessage}${session.ownerUrl ? ` ${session.ownerUrl}` : ""}`}
              </div>
              <p className="mt-3 text-sm text-muted-foreground">
                Each sponsorship is paid out 7 days after purchase. Being outbid doesn't affect
                payouts you've already earned.
              </p>
            </div>
          ) : null}

          {token ? (
            <PayoutsPanel token={token} status={payouts} onChange={() => loadPayouts(token)} />
          ) : null}

          <div className="panel mt-8 p-6">
            <div className="label-xs">Account</div>
            <h2 className="mt-1 text-xl font-extrabold">Disconnect your X account</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This unlinks @{session.handle} and signs you out. Your profile stays permanently in
              the rankings, but its sponsor is hidden and nobody can bid until you reconnect and
              list it again. Existing payment and payout records remain intact.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => onDisconnect(false)}
                disabled={busy}
                className="btn-outline-ink disabled:opacity-50"
              >
                {busy ? "Working…" : "Disconnect X"}
              </button>
              <button
                onClick={() => onDisconnect(true)}
                disabled={busy}
                className="btn-outline-ink text-destructive disabled:opacity-50"
              >
                Disconnect and delete my data
              </button>
            </div>
          </div>

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
      return "That X account is already connected to another Buy My Bio creator.";
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
      return "Held until release";
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
        Buyers pay Buy My Bio. We hold your share for 7 days, then transfer it to your bank via
        Stripe.
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
                On hold
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
              No sponsorships yet. Payouts appear here when someone sponsors your profile.
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
              <button onClick={onDashboard} disabled={busy} className="btn-outline-ink">
                Stripe dashboard
              </button>
            ) : null}
            <button onClick={onChange} className="btn-outline-ink">
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
