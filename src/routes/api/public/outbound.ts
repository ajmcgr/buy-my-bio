import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/outbound")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const username = url.searchParams.get("username");
        if (!username) return new Response("Not found", { status: 404 });

        try {
          const { resolveSponsorRedirect } = await import("@/lib/redirect.functions");
          const result = await resolveSponsorRedirect(username, request);
          if (!result.destination) return new Response("Not found", { status: 404 });

          return new Response(null, {
            status: 302,
            headers: {
              Location: result.destination,
              "Cache-Control": "no-store",
            },
          });
        } catch (error) {
          console.error("sponsor outbound redirect failed", {
            error: error instanceof Error ? error.message : String(error),
          });
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
