import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { applyAsCreator } from "@/lib/creator.functions";

export const Route = createFileRoute("/sell")({
  head: () => ({
    meta: [
      { title: "Sell Your Bio — Get Paid for the Link in Your Bio" },
      {
        name: "description",
        content:
          "Your bio link is prime real estate. List it on Buy My Bio and get paid every time someone takes it over.",
      },
      { property: "og:title", content: "Sell Your Bio — Buy My Bio" },
      {
        property: "og:description",
        content: "Get paid every time someone buys the link in your bio.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Sell,
});

function Sell() {
  const apply = useServerFn(applyAsCreator);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const f = new FormData(e.currentTarget);
    const res = await apply({
      data: {
        displayName: String(f.get("name") ?? ""),
        email: String(f.get("email") ?? ""),
        socialPlatform: String(f.get("platform") ?? "x"),
        socialHandle: String(f.get("handle") ?? ""),
        followers: Number(f.get("followers") ?? 0),
        startingPrice: Number(f.get("price") ?? 100),
      },
    });
    if ("error" in res && res.error) setError(res.error);
    else setDone(true);
    setBusy(false);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-14">
      <h1 className="text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.88] font-black tracking-[-0.05em]">
        YOUR BIO LINK IS WORTH MONEY
      </h1>
      <p className="mt-5 text-lg text-muted-foreground">
        One link. One line of your profile. Companies will pay to be there — and pay again to take
        it from each other.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-3">
        {[
          ["No effort", "You change your bio link once to buymybio.com/yourname. That's it."],
          ["No deadlines", "Owners buy in, get outbid, and you get paid on every takeover."],
          ["You stay in control", "Reject destinations you don't want. Pause the listing anytime."],
        ].map(([t, d]) => (
          <div key={t} className="panel px-5 py-6">
            <div className="font-extrabold">{t}</div>
            <p className="mt-2 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-16 text-2xl font-extrabold">Apply to list your bio</h2>

      {done ? (
        <div className="panel mt-4 px-5 py-6">
          <p className="font-bold">Application received.</p>
          <p className="mt-2 text-sm text-muted-foreground">
            We'll review and email you to verify your account. Verified creators go live with their
            own page at buymybio.com/yourname.
          </p>
          <Link to="/" className="btn-outline-ink mt-6">
            Back home
          </Link>
        </div>
      ) : (
        <form onSubmit={submit} className="panel mt-4 space-y-4 px-5 py-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label-xs" htmlFor="name">
                Your name *
              </label>
              <input id="name" name="name" required className="field mt-1" />
            </div>
            <div>
              <label className="label-xs" htmlFor="email">
                Email *
              </label>
              <input id="email" name="email" type="email" required className="field mt-1" />
            </div>
            <div>
              <label className="label-xs" htmlFor="platform">
                Platform *
              </label>
              <select id="platform" name="platform" className="field mt-1">
                <option value="x">X / Twitter</option>
                <option value="instagram">Instagram</option>
                <option value="tiktok">TikTok</option>
                <option value="youtube">YouTube</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
            <div>
              <label className="label-xs" htmlFor="handle">
                Handle *
              </label>
              <input id="handle" name="handle" required placeholder="@you" className="field mt-1" />
            </div>
            <div>
              <label className="label-xs" htmlFor="followers">
                Followers
              </label>
              <input id="followers" name="followers" type="number" min={0} className="field mt-1" />
            </div>
            <div>
              <label className="label-xs" htmlFor="price">
                Starting price (USD)
              </label>
              <input
                id="price"
                name="price"
                type="number"
                min={1}
                defaultValue={100}
                className="field mt-1"
              />
            </div>
          </div>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
          <button disabled={busy} className="btn-ink btn-ink-hover w-full disabled:opacity-40">
            {busy ? "Sending…" : "APPLY TO LIST MY BIO"}
          </button>
        </form>
      )}
    </div>
  );
}
