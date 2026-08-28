import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/x-start")({
  server: {
    handlers: {
      GET: async () => {
        const { xConfigured, pkce, randomToken, authorizeUrl } = await import("@/lib/x.server");
        const { admin, baseUrl } = await import("@/lib/db.server");
        if (!xConfigured()) {
          return new Response(null, {
            status: 302,
            headers: { Location: "/creator?error=x_not_configured" },
          });
        }

        const state = randomToken(24);
        const { verifier, challenge } = await pkce();
        await admin().from("x_oauth_states").insert({ state, code_verifier: verifier });

        return new Response(null, {
          status: 302,
          headers: { Location: authorizeUrl(baseUrl(), state, challenge) },
        });
      },
    },
  },
});
