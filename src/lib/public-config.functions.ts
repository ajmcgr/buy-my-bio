import { createServerFn } from "@tanstack/react-start";

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    supabaseUrl: (() => { const r = (process.env["SB_URL"] ?? "").trim().replace(/\/$/, ""); return /^https?:\/\//.test(r) ? r : (r ? `https://${r}` : ""); })(),
    supabaseKey: process.env["SB_PUBLISHABLE_KEY"] ?? "",
    baseUrl: (process.env["APP_BASE_URL"] || "https://buymybio.com").replace(/\/$/, ""),
  };
});
