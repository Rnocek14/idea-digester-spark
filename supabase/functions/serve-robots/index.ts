// serve-robots — a per-city robots.txt.
//
// WHY THIS EXISTS
// public/robots.txt is one static file inside one shared dist/. It is served on
// EVERY city's domain, so the two absolute `Sitemap:` lines it used to carry
// pointed city #2's crawlers at city #1's sitemap, and its
// "# Canonical host is lakegenevabrief.com" comment claimed one town's domain
// as canonical for all of them. A static file cannot fix this: the Sitemap
// directive requires an absolute URL, and an absolute URL is city-specific.
//
// This function resolves the city from the request and emits a robots.txt whose
// sitemap URL carries that city's own ?city_id=. Nothing here names a city, a
// domain or a project ref.
//
// DEPLOYMENT PRECONDITION — READ THIS.
// Crawlers only ever fetch /robots.txt at the site root. This function does
// nothing until the hosting layer routes  /robots.txt -> serve-robots  for each
// city domain (a Netlify/Vercel/Cloudflare rewrite, same mechanism serve-page
// needs). Until that rewrite exists, public/robots.txt is what crawlers get,
// which is why that file is now written to be safe on any hostname rather than
// correct on one.
//
// Fails OPEN, always. Google treats a 5xx (and a persistent fetch failure) on
// robots.txt as "crawl nothing" for the whole site. So every error path here
// still returns 200 with a permissive body; the worst case is a robots.txt with
// no Sitemap line, never a robots.txt that de-indexes a town.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type CityConfig, resolveCityConfig, siteBase } from "../_shared/renderPage.ts";
import { isTemplateCity } from "../_shared/siteRoutes.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEXT_HEADERS: Record<string, string> = {
  ...CORS_HEADERS,
  "Content-Type": "text/plain; charset=utf-8",
  // Crawlers re-fetch robots.txt often and cache it for about a day anyway.
  "Cache-Control": "public, max-age=3600",
  // The body depends on which city's HOST asked for it, and every city's
  // /robots.txt rewrite proxies to this one function URL. Without Vary, a
  // shared cache keyed on that upstream URL is entitled to serve city A's
  // robots.txt — including its Sitemap: line — on city B's domain, which is
  // precisely the cross-city bug this function exists to remove.
  Vary: "Host, X-Forwarded-Host, X-Original-Host",
};

/**
 * Agents given an explicit group. The AI crawlers are listed deliberately: this
 * site now serves them real HTML (serve-page) and machine-readable incident
 * data (serve-data), so being legible to them is the point, not an accident.
 * Naming them also documents the decision — an operator who wants to block one
 * changes a line here instead of guessing at wildcard semantics.
 */
const NAMED_AGENTS = [
  "Googlebot",
  "Bingbot",
  "DuckDuckBot",
  "Twitterbot",
  "facebookexternalhit",
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "PerplexityBot",
  "Applebot",
];

/**
 * Paths with no public content: auth screens, the operator dashboard, the
 * signed-in portals, and debug routes. Repeated in every group on purpose — a
 * named user-agent group REPLACES the wildcard group rather than adding to it,
 * so a Disallow written only under `User-agent: *` would not apply to
 * Googlebot at all.
 */
const DISALLOWED_PATHS = [
  "/dashboard",
  "/employer-dashboard",
  "/sponsor-portal",
  "/auth",
  "/debug/",
];

/**
 * Collapse a config value to a single safe line before it is interpolated.
 *
 * robots.txt is a LINE-ORIENTED format: a newline inside an interpolated value
 * ends the current line and starts a new directive. A `city_config.site_name`
 * of "Foo\nDisallow: /" — that column is free text typed into the Add-City
 * admin form — turned the header comment into a real, group-less
 * `Disallow: /` line. Same hazard for `site_domain` on the Sitemap: line.
 * Strip CR/LF (and the leading `#` a value could use to comment out the rest
 * of a line) so a config row can never write a directive.
 */
function oneLine(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function agentGroup(agent: string): string {
  return [`User-agent: ${agent}`, "Allow: /", ...DISALLOWED_PATHS.map((p) => `Disallow: ${p}`)].join("\n");
}

/** Absolute URL of the live sitemap for one city, or null if unknowable. */
function liveSitemapUrl(cityId: string): string | null {
  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/+$/, "");
  if (!supabaseUrl) return null;
  return `${supabaseUrl}/functions/v1/serve-sitemap?city_id=${encodeURIComponent(cityId)}`;
}

export function renderRobots(config: CityConfig): string {
  const lines: string[] = [
    `# robots.txt for ${oneLine(config.site_name)} — generated per request by serve-robots.`,
    `# Resolved city: ${oneLine(config.id)}. Edit supabase/functions/serve-robots/index.ts, not a static file.`,
    "",
    ...NAMED_AGENTS.map(agentGroup).flatMap((g) => [g, ""]),
    agentGroup("*"),
    "",
  ];

  const live = liveSitemapUrl(config.id);
  if (live) {
    lines.push("# Live sitemap, generated from the database for THIS city only.");
    lines.push(`Sitemap: ${live}`);
  }

  // The build-time sitemap in dist/ is generated for the template city alone
  // (scripts/generate-sitemap.ts walks one route list). It sits in the shared
  // dist/, so every city's domain serves it — advertising it from another
  // city's robots.txt would submit the template city's URLs under that city's
  // domain. Hence: template city only.
  //
  // When a city's host also rewrites /sitemap.xml -> serve-sitemap with its own
  // ?city_id=, this line becomes correct for that city too and can move up into
  // the unconditional block.
  if (isTemplateCity(config)) {
    lines.push(`Sitemap: ${oneLine(siteBase(config))}/sitemap.xml`);
  }

  // Deliberately absent: any "canonical host" comment. Canonical belongs in a
  // per-page <link rel="canonical">, which is city-resolved; asserting it here
  // would be a claim made on every city's domain at once.
  return lines.join("\n") + "\n";
}

/** Last-resort body when the city cannot be resolved at all. Names no city. */
function fallbackRobots(): string {
  return [
    "# Fallback robots.txt — city could not be resolved for this request.",
    "# Serving a permissive body on purpose: a 5xx here reads as crawl-nothing.",
    "",
    ...NAMED_AGENTS.map(agentGroup).flatMap((g) => [g, ""]),
    agentGroup("*"),
    "",
  ].join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const config = await resolveCityConfig(supabase, req);
    return new Response(renderRobots(config), { headers: TEXT_HEADERS });
  } catch (error) {
    console.error("[serve-robots] falling back to permissive robots:", error);
    return new Response(fallbackRobots(), { headers: TEXT_HEADERS });
  }
});
