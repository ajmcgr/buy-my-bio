import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Buy My Bio" },
      {
        name: "description",
        content:
          "Buy My Bio turns the most valuable link on the internet — the one in someone's bio — into something anyone can own.",
      },
      { property: "og:title", content: "About Buy My Bio" },
      {
        property: "og:description",
        content: "One link. One owner. Pay more than the last person and it's yours.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="text-[clamp(2.25rem,8vw,3.5rem)] leading-[0.95] font-semibold tracking-[-0.04em]">
        About Buy My Bio
      </h1>

      <p className="mt-6 text-xl leading-relaxed">
        Buy My Bio is the link in someone's bio, for sale.
      </p>

      <div className="mt-10 space-y-6 text-lg leading-relaxed text-foreground/90">
        <p>Hello there!</p>

        <p>
          Creators spend years building an audience, and the single most valuable piece of real
          estate they own is one link — the one in their bio. It usually points at a link
          aggregator nobody clicks. We thought it should point at whoever values it most.
        </p>

        <p>
          Anyone can buy it. No account, no waiting, no auction deadline. Pay more than the current
          owner and the link redirects to you the moment your payment clears. You keep it until
          someone pays more than you did — and if that happens, we'll email you the price to take
          it back.
        </p>

        <p>
          Every owner, every price and every click stays on the public record. Whether you're
          launching something, hiring, or just want to plant your flag in someone's profile, the
          bio is yours if you pay for it.
        </p>
      </div>

      <div className="mt-12 border-t-2 border-border pt-8">
        <p className="font-semibold">Alex MacGregor</p>
        <p className="text-sm text-muted-foreground">Founder, Buy My Bio</p>
        <a
          href="https://x.com/alexmacgregor__"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-block text-sm font-medium underline"
        >
          Follow me on X
        </a>
      </div>

      <Link to="/" className="btn-ink btn-ink-hover mt-12">
        Buy the bio
      </Link>
    </div>
  );
}
