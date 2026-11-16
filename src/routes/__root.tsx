import { useEffect, type ReactNode } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { QueryClientProvider } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  type ErrorComponentProps,
  HeadContent,
  Link,
  Outlet,
  Scripts,
  useRouter,
} from "@tanstack/react-router";
import { Helmet, HelmetProvider } from "react-helmet-async";

import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import HostnameRouter from "@/components/HostnameRouter";
import NotFound from "@/pages/NotFound";
import { reportLovableError } from "@/lib/lovable-error-reporting";
import appCss from "../styles.css?url";

const SITE_TITLE = "Lake Geneva Brief – Today's Local News & Things To Do";
const SITE_DESCRIPTION =
  "Today's local news, civic updates, events, dining, and nightlife in Lake Geneva, Wisconsin — curated daily.";
const FONT_CSS =
  "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=Inter:wght@400;500;600;700&display=swap";

const ORGANIZATION_LD = {
  "@context": "https://schema.org",
  "@type": "NewsMediaOrganization",
  name: "Lake Geneva Brief",
  url: "https://lakegenevabrief.com/",
  logo: "https://storage.googleapis.com/gpt-engineer-file-uploads/SvWZJGynpjYPoF316Lv9RVB7o2F2/uploads/1764815751185-ChatGPT%20Image%20Dec%203%2C%202025%2C%2007_15_47%20PM.png",
  sameAs: ["https://twitter.com/LakeGenevaBrief"],
  areaServed: { "@type": "Place", name: "Lake Geneva, Wisconsin" },
};
const WEBSITE_LD = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Lake Geneva Brief",
  url: "https://lakegenevabrief.com/",
};

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1.0" },
      { name: "author", content: "Lake Geneva Brief" },
      { name: "google-site-verification", content: "sZy4jbEYRn2Fr3PfUoiEmQ2IuvqOKI8TFacvteY83KY" },
      { name: "google-site-verification", content: "q_Hmondkzx1T9qYJEcYZmEmaMzDvI-qqtGemogLSaNw" },
      { name: "google-site-verification", content: "4RuOJxP9ATi1v7a5-aTg-0MwKpJ5MUNoFXP-2ofevO8" },
      { property: "og:site_name", content: "Lake Geneva Brief" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@LakeGenevaBrief" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      {
        rel: "icon",
        type: "image/png",
        href: "https://storage.googleapis.com/gpt-engineer-file-uploads/SvWZJGynpjYPoF316Lv9RVB7o2F2/uploads/1764815751185-ChatGPT%20Image%20Dec%203%2C%202025%2C%2007_15_47%20PM.png",
      },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "alternate", type: "application/atom+xml", title: "Latest stories", href: "/feed.xml" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: FONT_CSS },
      { rel: "preconnect", href: "https://images.unsplash.com" },
      { rel: "preconnect", href: "https://storage.googleapis.com" },
      { rel: "preconnect", href: "https://mzumvkrpnxhkvhdyzgqa.supabase.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://mzumvkrpnxhkvhdyzgqa.supabase.co" },
    ],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(ORGANIZATION_LD) },
      { type: "application/ld+json", children: JSON.stringify(WEBSITE_LD) },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
  errorComponent: RootError,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <HelmetProvider>
      {/* Sitewide defaults. Pages render their own PageMeta, which is the innermost
          Helmet and replaces these per route in the server-rendered HTML. */}
      <Helmet>
        <title>{SITE_TITLE}</title>
        <meta name="description" content={SITE_DESCRIPTION} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={SITE_TITLE} />
        <meta property="og:description" content={SITE_DESCRIPTION} />
        <meta name="twitter:title" content={SITE_TITLE} />
        <meta name="twitter:description" content={SITE_DESCRIPTION} />
      </Helmet>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <HostnameRouter>
            <Outlet />
          </HostnameRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
}

function RootError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  useEffect(() => {
    console.error(error);
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-foreground">
      <div className="max-w-md text-center">
        <h1 className="font-serif text-3xl">This page didn't load</h1>
        <p className="mt-3 text-muted-foreground">Something went wrong. Try again, or head back to today's brief.</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            className="min-h-11 rounded-md bg-primary px-4 text-primary-foreground"
            onClick={() => {
              router.invalidate();
              reset();
            }}
          >
            Try again
          </button>
          <Link to="/" className="inline-flex min-h-11 items-center rounded-md border px-4">
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
