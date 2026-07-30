// serve-llms — a per-city llms.txt.
//
// WHY THIS EXISTS
// public/llms.txt was 47 lines of hand-written Lake Geneva prose and relative
// Lake Geneva URLs, sitting in the shared dist/ and therefore served on every
// city's hostname. City #2 would have introduced itself to language models as
// Lake Geneva. This function builds the same document from city_config plus the
// route table both it and the sitemap read (../_shared/siteRoutes.ts).
//
// IS llms.txt WORTH ANYTHING? HONEST ANSWER: unproven.
// llms.txt is a community proposal (llmstxt.org), not a standard any major
// crawler has committed to. As of this writing no vendor — OpenAI, Anthropic,
// Google, Perplexity — documents reading it, and there is no public evidence of
// it changing what a model retrieves. Anyone telling you it is "how you get
// into ChatGPT" is selling something.
//
// The argument for it is cost, not adoption: it is a few hundred bytes,
// generated from data this function already loads, with no maintenance surface
// of its own. It costs approximately nothing and pays off only if the
// convention is ever adopted. Do not build anything on the assumption that it
// is being read; the work that actually opens the AI-crawler channel is
// serve-page (real HTML) and serve-data (machine-readable records), because
// those are fetched by crawlers that exist today.
//
// DEPLOYMENT PRECONDITION: needs /llms.txt routed to this function per city
// domain at the hosting layer, exactly like serve-robots. Without that rewrite
// crawlers get the static public/llms.txt fallback.
//
// NO INVENTED FACTS. Every line below is either a city_config value or a
// description of a page. No counts, no hours, no prices, no claims about
// coverage that the database cannot back.

// deno-lint-ignore-file no-explicit-any

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { type CityConfig, absoluteUrl, resolveCityConfig } from "../_shared/renderPage.ts";
import { fillBlurb, isTemplateCity, type SiteRoute, staticRoutesFor } from "../_shared/siteRoutes.ts";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEXT_HEADERS: Record<string, string> = {
  // Served as text/plain to match how a static /llms.txt is served; the body is
  // Markdown, which is what the convention asks for.
  ...CORS_HEADERS,
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "public, max-age=3600",
  // Host-dependent body behind a single upstream URL — see the same note in
  // serve-robots. Without Vary a shared cache may hand city A's llms.txt,
  // absolute URLs and all, to city B's domain.
  Vary: "Host, X-Forwarded-Host, X-Original-Host",
};

/**
 * Machine-readable endpoints (serve-data). These are the reason an AI crawler
 * would care about this site at all, so they get their own section. Paths are
 * the on-domain rewrite form; they only resolve where that rewrite is in place.
 */
const DATA_ROUTES: Array<{ path: string; title: string; blurb: string }> = [
  {
    path: "/data/incidents.json",
    title: "Incident records (JSON)",
    blurb: "Paginated incident records, each naming the source of record it came from.",
  },
  {
    path: "/data/incidents.csv",
    title: "Incident records (CSV)",
    blurb: "The same records as CSV.",
  },
  {
    path: "/data/dataset.json",
    title: "Dataset description",
    blurb: "schema.org/Dataset description of the two feeds above, including what they exclude.",
  },
];

/**
 * Collapse a config value to one line. llms.txt is Markdown, and Markdown is
 * line-oriented: a newline inside `city_config.site_name` (free text from the
 * Add-City form) ends the `# ` heading and lets the rest of the value become
 * its own block — a value of "Foo\n## Data" injects a fake section into a
 * document whose whole purpose is to be read literally by a model.
 */
function oneLine(value: unknown): string {
  return String(value ?? "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function link(config: CityConfig, path: string, title: string, blurb: string): string {
  return `- [${title}](${absoluteUrl(config, path)}): ${oneLine(fillBlurb(blurb, config))}`;
}

function section(config: CityConfig, heading: string, routes: SiteRoute[]): string[] {
  if (routes.length === 0) return [];
  return [`## ${heading}`, "", ...routes.map((r) => link(config, r.path, r.title, r.blurb)), ""];
}

export function renderLlms(config: CityConfig): string {
  const routes = staticRoutesFor(config);
  const siteName = oneLine(config.site_name);
  const place = [config.city_name, config.state_code].map(oneLine).filter(Boolean).join(", ");
  const county = oneLine(config.county_name)
    ? ` and the surrounding ${oneLine(config.county_name)} area`
    : "";

  const lines: string[] = [
    `# ${siteName}`,
    "",
    // Hedged on purpose: describes what the site publishes, claims no
    // readership, no completeness, no frequency the database cannot prove.
    `> Local news and reference for ${place}${county}.`,
    "",
    `${siteName} is an independent local news and community site covering ${place}${county}.`,
    "It publishes civic and community news, an events calendar, public-safety incident records,",
    "business and dining listings, and job postings. Incident entries name the source of record",
    "they were compiled from — a public agency feed, a county release, or a named publication —",
    "so any single entry can be verified against that source.",
    "",
    `Editorial contact and methodology: ${absoluteUrl(config, "/about")}`,
    "",
    ...section(config, "Pages", routes.filter((r) => r.section === "core")),
    ...section(config, "Guides", routes.filter((r) => r.section === "guides")),
    "## Data",
    "",
    ...DATA_ROUTES.map((d) => link(config, d.path, d.title, d.blurb)),
    "",
    ...section(config, "Optional", routes.filter((r) => r.section === "optional")),
  ];

  if (!isTemplateCity(config)) {
    // Say the quiet part out loud rather than shipping an empty Guides heading:
    // the long-form guides are hand-written for the template city and have not
    // been built for any other city yet.
    lines.push(
      "## Notes",
      "",
      "- This city's long-form guides have not been written yet. Only the pages listed above exist.",
      ""
    );
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n");
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
    return new Response(renderLlms(config), { headers: TEXT_HEADERS });
  } catch (error) {
    console.error("[serve-llms] Error:", error);
    // 404, not 500: llms.txt is optional by construction, and a missing one is
    // a truer statement than a broken one.
    return new Response("llms.txt unavailable\n", {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "text/plain; charset=utf-8" },
    });
  }
});
