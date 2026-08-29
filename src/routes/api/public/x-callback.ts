import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/x-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { exchangeCode, fetchXUser, randomToken, placementPresent } =
          await import("@/lib/x.server");
        const { admin, baseUrl } = await import("@/lib/db.server");
        const db = admin();
        const base = baseUrl();
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");

        const fail = (reason: string) =>
          new Response(null, { status: 302, headers: { Location: `/creator?error=${reason}` } });

        // The user pressed "Cancel" on X's consent screen.
        const denied = url.searchParams.get("error");
        if (denied) {
          return fail(denied === "access_denied" ? "x_denied" : "x_callback_error");
        }
        if (!code || !state) return fail("missing_code");

        const { data: row } = await db
          .from("x_oauth_states")
          .select("state, code_verifier, created_at")
          .eq("state", state)
          .maybeSingle();
        if (!row) return fail("bad_state");
        // Single-use state, regardless of what happens next.
        await db.from("x_oauth_states").delete().eq("state", state);
        const age = Date.now() - new Date(row.created_at as string).getTime();
        if (age > 10 * 60 * 1000) return fail("bad_state");

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
          .select("id, username, session_token, x_bio_verified, user_id")
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
            .select("id, x_user_id")
            .eq("username", username)
            .maybeSingle();
          // Another Buy My Bio creator already holds this handle / X account.
          if (clash) return fail(clash.x_user_id ? "x_already_connected" : "handle_taken");

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

        // X is the trusted identity proof. Bind it once to an internal user so
        // creator-only server checks never need browser-supplied handles/tokens.
        if (!existing?.user_id && creatorId) {
          const email = `x-${xUser.id}@creator.buymybio.invalid`;
          const { data: user, error } = await db.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { x_user_id: xUser.id, creator_id: creatorId },
          });
          if (error || !user.user) {
            console.error("creator identity binding failed", error);
            return fail("creator_identity_failed");
          }
          await db.from("creators").update({ user_id: user.user.id }).eq("id", creatorId);
        }

        // Website-only sponsorships: connecting X verifies identity, which is
        // all a listing needs. Nothing has to appear in the creator's X bio.
        const { WEBSITE_ONLY_SPONSORSHIP } = await import("@/lib/placement");
        if (WEBSITE_ONLY_SPONSORSHIP || (username && placementPresent(xUser, username))) {
          await db
            .from("creators")
            .update({
              x_bio_verified: true,
              x_bio_verified_at: now,
              x_bio_verified_method: "api",
            })
            .eq("id", creatorId);
          // Connecting X never publicly lists a creator. The creator must
          // explicitly click "List my profile" in the dashboard. Listings that
          // are already live stay live.
        }

        return new Response(null, {
          status: 302,
          headers: {
            Location: `/creator?t=${encodeURIComponent(sessionToken)}&connected=${encodeURIComponent(
              xUser.username,
            )}`,
            "Set-Cookie": `bmb_creator_session=${encodeURIComponent(sessionToken)}; Path=/; Max-Age=2592000; HttpOnly; Secure; SameSite=Lax`,
          },
        });
      },
    },
  },
});
