import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  displayName: z.string().min(1).max(80),
  email: z.string().email().max(160),
  socialPlatform: z.string().min(1).max(20),
  socialHandle: z.string().min(1).max(40),
  followers: z.number().int().min(0).max(1_000_000_000).optional(),
  startingPrice: z.number().min(1).max(1_000_000),
});

export const applyAsCreator = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data }) => {
    const { admin } = await import("./db.server");
    const db = admin();

    const handle = data.socialHandle.replace(/^@/, "").trim().toLowerCase();
    const username = handle.replace(/[^a-z0-9_-]/g, "");
    if (!username) return { error: "That handle isn't valid." } as const;

    const { data: existing } = await db
      .from("creators")
      .select("id")
      .eq("username", username)
      .maybeSingle();
    if (existing) return { error: "That handle is already applied or listed." } as const;

    const { data: creator, error } = await db
      .from("creators")
      .insert({
        display_name: data.displayName.trim(),
        username,
        email: data.email.trim().toLowerCase(),
        social_platform: data.socialPlatform,
        social_handle: handle,
        follower_count: data.followers ?? 0,
        verification_status: "pending",
      })
      .select("id")
      .single();
    if (error || !creator) return { error: "Could not submit your application." } as const;

    await db.from("listings").insert({
      creator_id: creator.id,
      slug: username,
      status: "draft",
      starting_price_cents: Math.round(data.startingPrice * 100),
    });

    await db.from("analytics_events").insert({ name: "creator_applied", props: { username } });
    return { ok: true } as const;
  });
