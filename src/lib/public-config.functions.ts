import { createServerFn } from "@tanstack/react-start";

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  const firstEnvironmentValue = (...names: string[]) => {
    for (const name of names) {
      const value = (process.env[name] ?? import.meta.env[name])?.trim();
      if (value) return value;
    }
    return "";
  };
  return {
    supabaseUrl: (() => {
      const r = firstEnvironmentValue("SB_URL", "SUPABASE_URL", "VITE_SUPABASE_URL").replace(
        /\/$/,
        "",
      );
      return /^https?:\/\//.test(r) ? r : r ? `https://${r}` : "";
    })(),
    supabaseKey: firstEnvironmentValue(
      "SB_PUBLISHABLE_KEY",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY",
      "VITE_SUPABASE_PUBLISHABLE_KEY",
      "VITE_SUPABASE_ANON_KEY",
    ),
    baseUrl: (process.env["APP_BASE_URL"] || "https://buymybio.com").replace(/\/$/, ""),
  };
});
