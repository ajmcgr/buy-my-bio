import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/x-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { exchangeCode, fetchXUser, randomToken, placementPresent } = await import(
          "@/lib/x.server"
        );
        const { admin, baseUrl } = await import("@/lib/db.server");
        const db = admin();
        const base = baseUrl();
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        const fail = (reason: string) =>
          new Response(null, { status: 302, headers: { Location: `/creator?error=${reason}` } });

        if (!code || !state) return fail("missing_code");

        const { data: row } = await db
          .from("x_oauth_states")
          .select("state, code_verifier")
          .eq("state", state)
          .maybeSingle();
        if (!row) return fail("bad_state");
        await db.from("x_oauth_states").delete().eq("state", state);

        let xUser;
        try {
          const token = await exchangeCode(base, code, row.code_verifier as string);
          xUser = await fetchXUser(token.access_token);
        } catch (e) {
          console.error("X oauth failed", e);
          return fail("x_auth_failed");
        }

        // X user id is the authoritative identity, never the username.
        const { data: existing } = await db
          .from("creators")
          .select("id, username, session_token, x_bio_verified")
          .eq("x_user_id", xUser.id)
          .maybeSingle();

        const sessionToken = (existing?.session_token as string | null) ?? randomToken(32);
        const now = new Date().toISOString();
        const profile = {
          x_user_id: xUser.id,
          x_username: xUser.username,
          x_display_name: xUser.name,
          x_profile_image_url: xUser.profile_image_url,
          x_profile_url: `https://x.com/${xUser.username}`,
          x_follower_count: xUser.followers,
          x_account_verified: true,
          x_account_verified_at: now,
          x_bio_snapshot: xUser.description,
          session_token: sessionToken,
          display_name: xUser.name,
          profile_image_url: xUser.profile_image_url,
          social_platform: "x",
          social_handle: xUser.username,
          social_account_id: xUser.id,
          social_profile_url: `https://x.com/${xUser.username}`,
          follower_count: xUser.followers,
          updated_at: now,
        };

        let creatorId = existing?.id as string | undefined;
        let username = existing?.username as string | undefined;

        if (creatorId) {
          await db.from("creators").update(profile).eq("id", creatorId);
        } else {
          username = xUser.username.toLowerCase().replace(/[^a-z0-9_-]/g, "");
          const { data: clash } = await db
            .from("creators")
            .select("id")
            .eq("username", username)
            .maybeSingle();
          if (clash) return fail("handle_taken");

          const { data: created, error } = await db
            .from("creators")
            .insert({ ...profile, username, verification_status: "pending" })
            .select("id")
            .single();
          if (error || !created) {
            console.error("creator insert failed", error);
            return fail("creator_create_failed");
          }
          creatorId = created.id as string;
          await db
            .from("listings")
            .insert({ creator_id: creatorId, slug: username, status: "draft" });
        }

        // Opportunistic bio check on connect — never marks verified unless present.
        if (username && placementPresent(xUser, username)) {
          await db
            .from("creators")
            .update({
              x_bio_verified: true,
              x_bio_verified_at: now,
              x_bio_verified_method: "api",
            })
            .eq("id", creatorId);
          await db.from("listings").update({ status: "active" }).eq("creator_id", creatorId);
        }

        return new Response(null, {
          status: 302,
          headers: { Location: `/creator?t=${encodeURIComponent(sessionToken)}` },
        });
      },
    },
  },
});
