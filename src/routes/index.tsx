import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { getMarketplace } from "@/lib/marketplace.functions";
import { MarketplaceLeaderboard } from "@/components/MarketplaceLeaderboard";

const sortSchema = z.enum(["most-valuable", "trending", "new", "affordable"]);

export const Route = createFileRoute("/")({
  validateSearch: z.object({ sort: sortSchema.optional().catch("most-valuable") }),
  loaderDeps: ({ search }) => ({ sort: search.sort ?? "most-valuable" }),
  loader: async ({ deps }) => await getMarketplace({ data: { sort: deps.sort } }),
  head: () => ({
    meta: [
      { title: "BuyMyBio — The Most Valuable Bios on X" },
      {
        name: "description",
        content: "See the most valuable X bios, who owns them, and how much it costs to take them.",
      },
      { property: "og:title", content: "BuyMyBio — The Most Valuable Bios on X" },
      {
        property: "og:description",
        content: "See the most valuable X bios, who owns them, and how much it costs to take them.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
