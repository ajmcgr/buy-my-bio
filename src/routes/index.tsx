import { createFileRoute, Link } from "@tanstack/react-router";
import { getListing } from "@/lib/listing.functions";
import { BioListing } from "@/components/BioListing";

export const Route = createFileRoute("/")({
  loader: async () => await getListing({ data: { username: "amacg" } }),
  head: () => ({
    meta: [
      { title: "Buy My Bio — Sell your X bio" },
      {
        name: "description",
        content:
          "Buy the sponsored slot in someone's X bio. Highest bidder owns the message + link until they're outbid. No deadline, no expiry.",
      },
      { property: "og:title", content: "Buy My Bio — Sell your X bio" },
      {
        property: "og:description",
        content: "Buy the sponsored slot in someone's X bio. Highest bidder owns the message + link until they're outbid.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
  errorComponent: () => (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Couldn't load the listing.</h1>
      <p className="mt-2 text-muted-foreground">Refresh in a moment.</p>
    </div>
  ),
  notFoundComponent: () => <p className="p-10 text-center">Listing not found.</p>,
});

function Home() {
  const view = Route.useLoaderData();

  if (!view) {
    return (
      <div className="mx-auto max-w-xl px-5 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">Sell your X bio</h1>
        <p className="mt-3 text-muted-foreground">
          The first X bio listing is being set up. Check back shortly.
        </p>
        <Link to="/creator" className="btn-ink btn-ink-hover mt-8">
          List your X bio
        </Link>
      </div>
    );
  }

  return <BioListing view={view} heading />;
}
