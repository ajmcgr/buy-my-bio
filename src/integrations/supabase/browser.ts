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
