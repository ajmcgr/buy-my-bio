import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getMarketplace } from "@/lib/marketplace.functions";
import { MarketplaceLeaderboard } from "@/components/MarketplaceLeaderboard";

const sortSchema = z.enum(["most-valuable", "trending", "new", "affordable"]);

export const Route = createFileRoute("/")({
  validateSearch: z.object({ sort: sortSchema.optional().catch("trending") }),
  loaderDeps: ({ search }) => ({ sort: search.sort ?? "trending" }),
  loader: async ({ deps }) => await getMarketplace({ data: { sort: deps.sort } }),
  head: () => ({
    meta: [
      { title: "Buy My Bio — How much are you worth on X?" },
      {
        name: "description",
        content: "Sponsor creators on BuyMyBio.com and keep the spot until somebody pays more.",
      },
      { property: "og:title", content: "How much are you worth on X?" },
      {
        property: "og:description",
        content: "Sponsor creators on BuyMyBio.com and keep the spot until somebody pays more.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "How much are you worth on X?" },
    ],
  }),
  component: Home,
  errorComponent: () => (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-extrabold">The market couldn't load.</h1>
      <p className="mt-2 text-muted-foreground">Refresh in a moment.</p>
    </div>
  ),
});

function Home() {
  return <MarketplaceLeaderboard market={Route.useLoaderData()} />;
}
