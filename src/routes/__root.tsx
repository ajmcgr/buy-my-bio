import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { getPublicConfig } from "../lib/public-config.functions";
import { initSupabase } from "../integrations/supabase/browser";
import logoAsset from "../assets/logo-trans.png.asset.json";

function NotFoundComponent() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-6xl font-extrabold">404</h1>
        <p className="mt-3 text-muted-foreground">Nothing here. Nobody owns this.</p>
        <Link to="/" className="btn-ink btn-ink-hover mt-8">
          Go home
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-[70vh] items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-3xl font-extrabold">This page didn't load.</h1>
        <p className="mt-3 text-sm text-muted-foreground">Try again in a second.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="btn-ink btn-ink-hover"
          >
            Try again
          </button>
          <a href="/" className="btn-outline-ink">
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  loader: async () => await getPublicConfig(),
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Buy My Bio — Buy the Link in Someone's Bio" },
      {
        name: "description",
        content:
          "Bid to own the link in someone's social media bio. Pay more than the current owner and it's yours until you're outbid.",
      },
      { property: "og:site_name", content: "Buy My Bio" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap",
      },
      { rel: "icon", href: "/favicon.png", type: "image/png" },
    ],
    scripts: [
      { src: "https://www.googletagmanager.com/gtag/js?id=G-3848F2705Y", async: true },
      {
        children:
          "window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', 'G-3848F2705Y');",
      },
      {
        src: "https://analytics.ahrefs.com/analytics.js",
        "data-key": "N8DF+07OZVFCpj/L6EQilg",
        async: true,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function SiteHeader() {
  return (
    <header>
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-4">
        <Link to="/" className="flex items-center">
          <img src={logoAsset.url} alt="Buy My Bio" className="h-11 w-auto sm:h-12" />
        </Link>
        <nav className="flex items-center gap-4 text-sm font-medium sm:gap-6">
          <Link to="/how-it-works" className="hover:underline">
            How it works
          </Link>
          <Link to="/about" className="hover:underline">
            About
          </Link>
          <Link to="/creator" className="hover:underline">
            List your bio
          </Link>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="mt-24">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-3 px-5 py-6 text-center text-xs text-muted-foreground">
        <span>
          Built with 🫶🏻 by{" "}
          <a
            href="https://x.com/alexmacgregor__"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline"
          >
            Alex
          </a>
        </span>
        <div className="flex gap-4">
          <Link to="/terms" className="hover:underline">
            Terms
          </Link>
          <Link to="/privacy" className="hover:underline">
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const config = Route.useLoaderData();

  if (config) initSupabase(config.supabaseUrl, config.supabaseKey);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="flex min-h-screen flex-col">
        <SiteHeader />
        <main className="flex-1">
          <Outlet />
        </main>
        <SiteFooter />
      </div>
    </QueryClientProvider>
  );
}
