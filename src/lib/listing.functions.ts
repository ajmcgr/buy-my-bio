import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type OwnerView = {
  id: string;
  company_name: string;
  destination_url: string;
  logo_url: string | null;
  amount_cents: number;
  started_at: string;
  ended_at: string | null;
  click_count: number;
  status: string;
};

export type ListingView = {
  creator: {
    id: string;
    display_name: string;
    username: string;
    bio: string | null;
    profile_image_url: string | null;
    social_platform: string;
    social_handle: string | null;
    social_profile_url: string | null;
    verification_status: string;
  };
  listing: {
    id: string;
    slug: string;
    status: string;
    starting_price_cents: number;
    minimum_increase_percentage: number;
  };
  owner: OwnerView | null;
  history: OwnerView[];
  requiredPriceCents: number;
  canBuy: boolean;
};

export const getListing = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ username: z.string().min(1).max(40) }).parse(input),
  )
  .handler(async ({ data }): Promise<ListingView | null> => {
    const { publicDb } = await import("./db.server");
    const { nextPriceCents } = await import("./format");
    const db = publicDb();

    const { data: creator } = await db
      .from("creators")
      .select(
        "id, display_name, username, bio, profile_image_url, social_platform, social_handle, social_profile_url, verification_status",
      )
      .eq("username", data.username.toLowerCase())
      .maybeSingle();
    if (!creator) return null;

    const { data: listing } = await db
      .from("listings")
      .select("id, slug, status, starting_price_cents, minimum_increase_percentage")
      .eq("creator_id", creator.id)
      .maybeSingle();
    if (!listing) return null;

    const { data: owners } = await db
      .from("ownerships")
      .select(
        "id, company_name, destination_url, logo_url, amount_cents, started_at, ended_at, click_count, status",
      )
      .eq("listing_id", listing.id)
      .order("started_at", { ascending: false });

    const all = (owners ?? []) as OwnerView[];
    const owner = all.find((o) => o.status === "active") ?? null;
    const history = all.filter((o) => o.status !== "active");
    const requiredPriceCents = owner
      ? nextPriceCents(owner.amount_cents, Number(listing.minimum_increase_percentage))
      : listing.starting_price_cents;

    return {
      creator,
      listing: {
        ...listing,
        minimum_increase_percentage: Number(listing.minimum_increase_percentage),
      },
      owner,
      history,
      requiredPriceCents,
      canBuy: listing.status === "active" && creator.verification_status === "verified",
    } as ListingView;
  });

export const getOwnership = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { publicDb } = await import("./db.server");
    const db = publicDb();
    const { data: o } = await db
      .from("ownerships")
      .select(
        "id, listing_id, company_name, destination_url, logo_url, amount_cents, started_at, ended_at, status, click_count",
      )
      .eq("id", data.id)
      .maybeSingle();
    if (!o) return null;
    const { data: listing } = await db
      .from("listings")
      .select("id, slug, creator_id")
      .eq("id", o.listing_id)
      .maybeSingle();
    const { data: creator } = listing
      ? await db
          .from("creators")
          .select("display_name, username, social_handle")
          .eq("id", listing.creator_id)
          .maybeSingle()
      : { data: null };
    return { ownership: o, creator, slug: listing?.slug ?? null };
  });

export const trackEvent = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().min(1).max(60),
        listingId: z.string().uuid().optional(),
        props: z.record(z.any()).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { admin } = await import("./db.server");
    await admin()
      .from("analytics_events")
      .insert({ name: data.name, listing_id: data.listingId ?? null, props: data.props ?? {} });
    return { ok: true };
  });
