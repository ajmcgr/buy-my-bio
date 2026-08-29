import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function firstEnvironmentValue(...names: string[]): string {
  for (const name of names) {
    const value = (process.env[name] ?? import.meta.env[name])?.trim();
    if (value) return value;
  }
  return "";
}

export function projectUrl(): string {
  const raw = firstEnvironmentValue("SB_URL", "SUPABASE_URL", "VITE_SUPABASE_URL").replace(
    /\/$/,
    "",
  );
  const url = /^https?:\/\//.test(raw) ? raw : raw ? `https://${raw}` : "";
  if (!url) {
    throw new Error("Supabase URL is missing. Set SB_URL, SUPABASE_URL, or VITE_SUPABASE_URL.");
  }
  return url;
}

function makeClient(key: string): SupabaseClient {
  if (!key) throw new Error("Supabase key is missing.");
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
  return makeClient(firstEnvironmentValue("SB_SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY"));
}

/** Publishable-key client for public reads. */
export function publicDb(): SupabaseClient {
  return makeClient(
    firstEnvironmentValue(
      "SB_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
    ),
  );
}

export function baseUrl(): string {
  return "https://socialbid.co";
}
