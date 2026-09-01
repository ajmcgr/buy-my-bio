import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;
let cfg: { url: string; key: string } | null = null;

export function initSupabase(url: string, key: string) {
  if (!url || !key) return;
  cfg = { url, key };
}

export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined") return null;
  if (client) return client;
  if (!cfg) return null;
  client = createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, storageKey: "bmb-auth" },
  });
  return client;
}

/**
 * Give the browser client an explicit chance to refresh after a long tab
 * suspension. Creator authentication itself uses the separate HttpOnly
 * first-party cookie; this only recovers an optional Supabase browser session
 * (for example, an admin session) when one exists.
 */
export async function recoverSupabaseSession() {
  const supabase = getSupabase();
  if (!supabase) return;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;

  const expiresAt = data.session?.expires_at;
  if (expiresAt && expiresAt * 1000 <= Date.now() + 60_000) {
    const { error: refreshError } = await supabase.auth.refreshSession();
    if (refreshError) throw refreshError;
  }
}
