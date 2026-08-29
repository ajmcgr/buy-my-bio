import { createFileRoute } from "@tanstack/react-router";
import alexAsset from "../assets/alex.png.asset.json";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Buy My Bio" },
      {
        name: "description",
        content: "Buy My Bio lets anyone sponsor a creator's profile on BuyMyBio.com.",
      },
      { property: "og:title", content: "About Buy My Bio" },
      {
        property: "og:description",
        content: "One sponsor spot. Pay more than the last sponsor and it's yours.",
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
      <div className="rounded-2xl border border-border bg-card p-8 shadow-sm sm:p-12">
        <h1 className="text-[clamp(2rem,6vw,3rem)] leading-[1] font-semibold tracking-[-0.04em]">
          About Buy My Bio
        </h1>

        <p className="mt-6 text-xl leading-relaxed">
          Buy My Bio is a public marketplace for creator sponsorships.
        </p>

        <div className="mt-8 space-y-6 text-lg leading-relaxed text-foreground/90">
          <p>Hello there!</p>

          <p>
            Creators spend years building an audience. Buy My Bio gives each creator a public
            profile with one clearly disclosed sponsor spot that anyone can compete for.
          </p>

          <p>
            Anyone can sponsor it. No account, no waiting, no auction deadline. Pay the current
            price and your message and link appear on BuyMyBio.com as soon as payment clears. You
            keep the spot until someone pays more — and if that happens, we'll email you the price
            to take it back.
          </p>

          <p>
            Every sponsor, price and click stays on the public record. Nothing is posted to or
            changed on X; X is used only to verify creator identity and public profile details.
          </p>
        </div>

        <div className="mt-12">
          <img
            src={alexAsset.url}
            alt="Alex MacGregor"
            className="mb-4 h-28 w-28 rounded-none object-cover"
          />
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
      </div>
    </div>
  );
}
