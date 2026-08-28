import { createFileRoute, notFound } from "@tanstack/react-router";
import { getListing } from "@/lib/listing.functions";
import { BioListing } from "@/components/BioListing";

export const Route = createFileRoute("/u/$username")({
  loader: async ({ params }) => {
    const view = await getListing({ data: { username: params.username } });
    if (!view) throw notFound();
    return view;
  },
  head: ({ loaderData }) => {
    const name = loaderData?.creator.display_name ?? "this creator";
    const handle = loaderData?.creator.social_handle ?? loaderData?.creator.username ?? "";
    const title = `Buy @${handle}'s Bio — Buy My Bio`;
    const description = `Own the link in ${name}'s bio. Pay more than the current owner and it's yours until someone outbids you.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  component: () => <BioListing view={Route.useLoaderData()} heading={false} />,
  errorComponent: () => (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Couldn't load this bio.</h1>
    </div>
  ),
  notFoundComponent: () => (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-extrabold">No such bio.</h1>
      <p className="mt-2 text-muted-foreground">This creator isn't listed.</p>
    </div>
  ),
});
