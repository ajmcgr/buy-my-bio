import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { resolveRedirect } from "@/lib/redirect.functions";

export const Route = createFileRoute("/$username")({
  loader: async ({ params }) => {
    const { destination, username } = await resolveRedirect({
      data: { username: params.username },
    });
    if (destination) throw redirect({ href: destination, statusCode: 302 });
    return { username };
  },
  head: () => ({
    meta: [
      { title: "This bio has no owner yet — Buy My Bio" },
      {
        name: "description",
        content: "Nobody owns this bio link right now. Be the first to buy it.",
      },
      { property: "og:title", content: "This bio has no owner yet — Buy My Bio" },
      {
        property: "og:description",
        content: "Nobody owns this bio link right now. Be the first to buy it.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NoOwner,
  errorComponent: () => (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-3xl font-extrabold">Couldn't resolve this link.</h1>
    </div>
  ),
});

function NoOwner() {
  const { username } = Route.useLoaderData();
  return (
    <div className="mx-auto max-w-xl px-5 py-24 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">Nobody owns this link</h1>
      <p className="mt-3 text-muted-foreground">
        buymybio.com/{username} is unclaimed right now.
      </p>
      <Link to="/u/$username" params={{ username }} className="btn-ink btn-ink-hover mt-8">
        Buy it
      </Link>
    </div>
  );
}
