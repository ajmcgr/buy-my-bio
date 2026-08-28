import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export function projectUrl(): string {
  const raw = (process.env["SB_URL"] ?? "").trim().replace(/\/$/, "");
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

function makeClient(key: string): SupabaseClient {
  const url = projectUrl();
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) {
          h.delete("Authorization");
        }
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

/** Service-role client. Bypasses RLS — server-only, privileged operations. */
export function admin(): SupabaseClient {
  return makeClient(process.env["SB_SERVICE_ROLE_KEY"]!);
}

/** Publishable-key client for public reads. */
export function publicDb(): SupabaseClient {
  return makeClient(process.env["SB_PUBLISHABLE_KEY"]!);
}

export function baseUrl(): string {
  return (process.env["APP_BASE_URL"] || "https://buymybio.com").replace(/\/$/, "");
}
