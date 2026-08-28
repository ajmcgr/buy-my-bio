import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getCreatorSession, verifyMyBio, type CreatorSession } from "@/lib/creator.functions";

export const Route = createFileRoute("/creator")({
  head: () => ({
    meta: [
      { title: "List Your Bio — Buy My Bio" },
      {
        name: "description",
        content:
          "Connect your X account, add the BuyMyBio placement to your profile, and open your bio to bids.",
      },
      { property: "og:title", content: "List Your Bio — Buy My Bio" },
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
      className={`inline-flex items-center gap-2 border-2 border-border px-3 py-1.5 font-mono text-xs font-bold uppercase ${
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

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setMessage(errorCopy(err));
    const fromUrl = params.get("t");
    if (fromUrl) {
      localStorage.setItem(STORAGE_KEY, fromUrl);
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
  }, []);

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
      <h1 className="text-[clamp(2rem,7vw,3.25rem)] leading-[0.9] font-black tracking-[-0.05em]">
        LIST YOUR BIO
      </h1>
      <p className="mt-4 text-muted-foreground">
        Two steps. Connect your real X account, then put the BuyMyBio placement in your profile.
        Both must be verified before anyone can bid.
      </p>

      {message ? (
        <div className="panel mt-6 px-4 py-3 text-sm font-medium">{message}</div>
      ) : null}

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
            CONNECT X ACCOUNT
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
            <Badge on={session.accountVerified} label="Account verified" />
            <Badge on={session.bioVerified} label="Bio verified" />
          </div>

          <div className="panel mt-8 p-6">
            <div className="label-xs">Step 2</div>
            <h2 className="mt-1 text-xl font-extrabold">Add this to your X bio</h2>
            <div className="mt-4 inline-block border-2 border-border bg-accent px-3 py-2 font-mono text-sm font-bold">
              {session.requiredPlacement}
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Paste it into your X bio or website field, save your profile, then verify. If we
              can't read it automatically, an admin will confirm it manually.
            </p>
            <button
              onClick={onVerify}
              disabled={busy || session.bioVerified}
              className="btn-ink btn-ink-hover mt-6 disabled:opacity-50"
            >
              {session.bioVerified ? "BIO VERIFIED" : busy ? "CHECKING…" : "VERIFY MY BIO"}
            </button>
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
      return "X sign-in isn't configured yet. Try again shortly.";
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
