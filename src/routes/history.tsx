import { createFileRoute, Link } from "@tanstack/react-router";
import { getListing } from "@/lib/listing.functions";
import { money, duration, hostOf } from "@/lib/format";

export const Route = createFileRoute("/history")({
  loader: async () => await getListing({ data: { username: "amacg" } }),
  head: () => ({
    meta: [
      { title: "Ownership History — Buy My Bio" },
      {
        name: "description",
        content:
          "Every owner of the bio link: what they paid, how long they held it, and how many clicks they got.",
      },
      { property: "og:title", content: "Ownership History — Buy My Bio" },
      {
        property: "og:description",
        content: "Every owner, every price, every click. Full public history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: History,
  errorComponent: () => <p className="p-16 text-center">Couldn't load history.</p>,
  notFoundComponent: () => <p className="p-16 text-center">No history yet.</p>,
});

function History() {
  const view = Route.useLoaderData();
  const rows = view ? [...(view.owner ? [view.owner] : []), ...view.history] : [];
  const total = rows.reduce((s, r) => s + r.amount_cents, 0);

  return (
    <div className="mx-auto max-w-4xl px-5 py-14">
      <h1 className="text-[clamp(2.25rem,8vw,4rem)] leading-[0.9] font-black tracking-[-0.05em]">
        Ownership history
      </h1>
      <p className="mt-4 text-muted-foreground">
        {rows.length} owner{rows.length === 1 ? "" : "s"} · {money(total)} total volume
      </p>

      {rows.length === 0 ? (
        <p className="mt-10">Nobody has owned this bio yet.</p>
      ) : (
        <div className="panel mt-8 divide-y-2 divide-border">
          <div className="label-xs grid grid-cols-5 gap-2 px-4 py-2">
            <span>Owner</span>
            <span>Destination</span>
            <span>Paid</span>
            <span>Held</span>
            <span className="text-right">Clicks</span>
          </div>
          {rows.map((o) => (
            <div key={o.id} className="grid grid-cols-5 items-center gap-2 px-4 py-3 text-sm">
              <span className="truncate font-bold">
                {o.company_name}
                {o.status === "active" && (
                  <span className="ml-2 bg-accent px-1.5 py-0.5 font-mono text-[10px]">NOW</span>
                )}
              </span>
              <span className="truncate text-muted-foreground">{hostOf(o.destination_url)}</span>
              <span>{money(o.amount_cents)}</span>
              <span>{duration(o.started_at, o.ended_at)}</span>
              <span className="text-right">{o.click_count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <Link to="/" className="btn-ink btn-ink-hover mt-12">
        Take it over
      </Link>
    </div>
  );
}
