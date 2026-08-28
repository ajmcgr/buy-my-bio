import { createServerFn } from "@tanstack/react-start";

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async () => {
  return {
    supabaseUrl: process.env["SB_URL"] ?? "",
    supabaseKey: process.env["SB_PUBLISHABLE_KEY"] ?? "",
    baseUrl: (process.env["APP_BASE_URL"] || "https://buymybio.com").replace(/\/$/, ""),
  };
});
